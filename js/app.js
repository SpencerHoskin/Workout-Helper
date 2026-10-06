// Boot, routing, and event delegation. Views export render/mount/unmount + handler maps.
import { migrate, load, KEYS } from './store.js';
import { EX, SESSIONS, PENDING } from './catalog.js';
import { esc } from './util.js';
import { $, closeSheet, sheetOpen } from './ui.js';
import { current, setRenderer, go } from './router.js';
import { addRest, stopRest } from './timer.js';
import { applyTheme } from './theme.js';
import * as today from './views/today.js';
import * as machines from './views/machines.js';
import * as scan from './views/scan.js';
import * as logger from './views/logger.js';
import * as progress from './views/progress.js';
import * as me from './views/me.js';

const VIEWS = { today, machines, scan, log: logger, progress, me };
const TAB_FOR = { today: 'today', machines: 'machines', log: 'machines', scan: 'scan', progress: 'progress', me: 'me' };

const merge = key => Object.assign({}, ...Object.values(VIEWS).map(v => v[key] || {}));
const ACTIONS = {
  ...merge('actions'),
  go: el => go(el.dataset.to),
  closeSheet: () => closeSheet(),
  weighin: () => progress.openWeighin(),
  editMachine: el => machines.editMachine(el.dataset.id),
  restAdd: () => addRest(30),
  restStop: () => stopRest(),
  safety: () => openSafety(),
  safetyClose: () => { $('#safety').hidden = true; }
};
const CHANGES = merge('changes');
const INPUTS = merge('inputs');
const SUBMITS = merge('submits');

let active = null;

function render({ keepScroll = false } = {}) {
  const ctx = current();
  const view = VIEWS[ctx.name] || today;
  if (active && active !== view && active.unmount) active.unmount();
  active = view;
  const y = window.scrollY;
  const root = $('#view');
  root.innerHTML = view.render(ctx);
  root.dataset.view = ctx.name;
  document.querySelectorAll('#tabs [data-tab]').forEach(b => {
    const on = b.dataset.tab === (TAB_FOR[ctx.name] || 'today');
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if (view.mount) view.mount(root, ctx);
  window.scrollTo(0, keepScroll ? y : 0);
}

function openSafety() {
  const lim = load(KEYS.limits, {});
  const v = x => x ? esc(x) : `<span class="pending">${PENDING}</span>`;
  $('#safetyLimits').innerHTML = `Load: ${v(lim.load)}<br>Intensity: ${v(lim.intensity)}<br>Other: ${v(lim.other)}`;
  $('#safety').hidden = false;
}

/* ---------- Event delegation ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = ACTIONS[b.dataset.act];
  if (fn) { e.preventDefault(); fn(b, e); }
});
document.addEventListener('change', e => {
  const t = e.target.closest('[data-change]');
  if (t && CHANGES[t.dataset.change]) CHANGES[t.dataset.change](t, e);
});
document.addEventListener('input', e => {
  const t = e.target.closest('[data-input]');
  if (t && INPUTS[t.dataset.input]) INPUTS[t.dataset.input](t, e);
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (SUBMITS[f.id]) { e.preventDefault(); SUBMITS[f.id](f, e); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (sheetOpen()) closeSheet();
  else if (!$('#safety').hidden) $('#safety').hidden = true;
});
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
$('#safety').addEventListener('click', e => { if (e.target.id === 'safety') $('#safety').hidden = true; });
window.addEventListener('hashchange', () => { closeSheet(); render(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------- Boot ---------- */
function check(cond, msg) {
  if (!cond) { const m = 'Bug check failed: ' + msg; console.error(m); alert(m); }
}
migrate();
applyTheme();
check(Object.values(SESSIONS).every(s => s.ex.every(id => EX[id])), 'Session references unknown exercise');
setRenderer(render);
render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
}
