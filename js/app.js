// Boot, routing, and event delegation. Views export render/mount/unmount + handler maps.
import { migrate, getLimits, rawDump } from './store.js';
import { EX, SESSIONS, PENDING } from './catalog.js';
import { esc, todayStr } from './util.js';
import { $, closeSheet, sheetOpen, unlockAudio, download } from './ui.js';
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
  safetyClose: () => { $('#safety').hidden = true; },
  rescueExport: () => download(`5am-workout-RESCUE-${todayStr()}.json`, JSON.stringify({ app: '5am-workout-raw', data: rawDump() }, null, 1)),
  reload: () => location.reload()
};
const CHANGES = merge('changes');
const INPUTS = merge('inputs');
const SUBMITS = merge('submits');

let active = null;
let renderedHash = null;

function render({ keepScroll = false } = {}) {
  const ctx = current();
  const view = VIEWS[ctx.name] || today;
  if (active && active !== view && active.unmount) active.unmount();
  active = view;
  renderedHash = location.hash;
  const y = window.scrollY;
  const root = $('#view');
  try {
    root.innerHTML = view.render(ctx);
  } catch (err) {
    // Error boundary: never a white screen — always offer a way to get the data out.
    console.error('render failed', err);
    active = null;
    root.innerHTML = `<section class="card caution-card"><h2>😬 Something broke on this screen</h2>
      <p class="muted">Your data is still on this phone. Grab a rescue copy, then try another tab or reload.</p>
      <p class="small code">${esc(err && err.message)}</p>
      <button class="btn primary wide" data-act="rescueExport">⬇️ Download my data</button>
      <button class="btn ghost wide" data-act="reload">↻ Reload app</button></section>`;
    return;
  }
  root.dataset.view = ctx.name;
  document.querySelectorAll('#tabs [data-tab]').forEach(b => {
    const on = b.dataset.tab === (TAB_FOR[ctx.name] || 'today');
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  try {
    if (view.mount) view.mount(root, ctx);
  } catch (err) {
    console.error('mount failed', err); // charts/camera are extras — the screen itself still works
  }
  window.scrollTo(0, keepScroll ? y : 0);
}

function openSafety() {
  const lim = getLimits();
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
// Links and back/forward. go() renders itself, so skip events for a hash we already rendered.
const onNav = () => { if (location.hash !== renderedHash) { closeSheet(); render(); } };
window.addEventListener('hashchange', onNav);
window.addEventListener('popstate', onNav);
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------- Boot ---------- */
function check(cond, msg) {
  if (!cond) { const m = 'Bug check failed: ' + msg; console.error(m); alert(m); }
}
try { migrate(); } catch (e) { console.error('migration failed', e); } // render's error boundary takes it from here
applyTheme();
check(Object.values(SESSIONS).every(s => s.ex.every(id => EX[id])), 'Session references unknown exercise');
setRenderer(render);
render();

// Ask iOS/Chrome not to evict our storage under pressure (granted silently for installed apps).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
}
