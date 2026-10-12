// Screen motion for the Signal design: section entrances, the tab push, odometer numbers, the gliding tab
// indicator, and two headline typesetting touches. It only adds classes, CSS custom properties and aria-hidden
// decoration: it never stops events and never touches data-* attributes, ids, form names or element order.
// Entrances play only when location.hash changed since the last render, so in-place re-renders (logging a set)
// never replay them. Nothing moves when the phone asks for reduced motion.
import { reducedMotion } from './ui.js';

const TABS = ['today', 'machines', 'scan', 'progress', 'me'];
const TAB_FOR = { log: 'machines' };
const tabOf = h => { const n = (h || '').replace(/^#\/?/, '').split(/[/?]/)[0] || 'today'; return TAB_FOR[n] || n; };
const ODO = '.tile b, .ring-legend b, .count, table.hist td.num';
const ENTER_MS = 900;
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FX = ['fx-enter', 'fx-push-l', 'fx-push-r'];

let view, bar, lastHash = null, lastTab = null, timer = 0;

/** Each digit becomes a 0–9 reel that rolls to its value. The real value stays in a visually hidden span. */
function odometers() {
  let k = 0;
  view.querySelectorAll(ODO).forEach(el => {
    if (el.children.length) return;
    const txt = el.textContent.trim();
    if (!/\d/.test(txt) || txt.length > 10) return;
    const digits = Array.from({ length: 20 }, (_, i) => `<span>${i % 10}</span>`).join('');
    const body = [...txt].map(ch => /\d/.test(ch)
      ? `<span class="od"><span class="od-r" style="--n:${ch};--k:${k++}">${digits}</span></span>`
      : `<span>${esc(ch)}</span>`).join('');
    el.innerHTML = `<span class="sr-only">${esc(txt)}</span><span aria-hidden="true">${body}</span>`;
  });
}

/** Me hero: "Goal: recomp · 165 lb" → two deliberate lines (the dot stays for screen readers). */
function typesetGoal() {
  const b = view.querySelector('.me-hero .big');
  if (!b || b.children.length) return;
  const t = b.textContent, i = t.indexOf(' · ');
  if (i < 0) return;
  b.innerHTML = `${esc(t.slice(0, i))}<span class="hero-dot"> · </span><span class="hero-l2">${esc(t.slice(i + 3))}</span>`;
}

/** Logger title: "Leg press (machine)" → the parenthetical drops to a small mono tag so the name holds one line. */
function typesetTitle() {
  const b = view.dataset.view === 'log' && view.querySelector(':scope > .card:first-child .big');
  if (!b || b.children.length) return;
  const m = b.textContent.match(/^(.*?)\s*(\([^)]*\))$/);
  if (!m) return;
  b.innerHTML = `${esc(m[1])} <span class="title-tag">${esc(m[2])}</span>`;
}

/** The pink bar over the active tab glides between tabs (hidden when Scan, the raised block, is active). */
function moveBar() {
  const nav = document.getElementById('tabs');
  if (!nav) return;
  if (!bar) {
    bar = document.createElement('span');
    bar.className = 'tab-ind';
    bar.setAttribute('aria-hidden', 'true');
    nav.appendChild(bar);
  }
  const on = nav.querySelector('a.on');
  if (!on || on.classList.contains('scan-tab')) { bar.style.opacity = '0'; return; }
  const w = 28;
  bar.style.opacity = '1';
  bar.style.width = w + 'px';
  bar.style.setProperty('--x', (on.offsetLeft + on.offsetWidth / 2 - w / 2) + 'px');
}

function onRender() {
  const h = location.hash || '#/today';
  moveBar();
  typesetGoal(); typesetTitle();
  if (h === lastHash) { view.classList.remove(...FX); return; } // in-place re-render: settle instantly, no replay
  const prevTab = lastTab, tab = tabOf(h);
  lastHash = h; lastTab = tab;
  if (reducedMotion()) return;
  [...view.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 6)));
  view.classList.remove(...FX);
  void view.offsetWidth; // restart the animations
  view.classList.add('fx-enter');
  if (prevTab && prevTab !== tab) view.classList.add(TABS.indexOf(tab) > TABS.indexOf(prevTab) ? 'fx-push-l' : 'fx-push-r');
  odometers();
  clearTimeout(timer);
  timer = setTimeout(() => view.classList.remove(...FX), ENTER_MS);
}

/** Start watching #view. Call once, after the first render. */
export function initMotion() {
  view = document.getElementById('view');
  if (!view) return;
  document.documentElement.style.setProperty('--day', `"${new Date().getDate()}"`);
  new MutationObserver(onRender).observe(view, { childList: true });
  if (view.children.length) onRender();
  addEventListener('resize', moveBar);
}
