// Page swipe between Today and Food: swipe left on Today to open Food, swipe right on Food to go back.
// The page follows the finger, then slides out and the next screen makes its normal entrance (motion.js).
// Swipes that start on something with its own horizontal gesture (fields, the weight dial, charts, chip rows,
// pop-ups, the tab bar) are left alone, and so are vertical scrolls.
import { current, go } from './router.js';
import { sheetOpen, reducedMotion, $ } from './ui.js';

const PAIRS = { today: { dir: -1, to: 'food' }, food: { dir: 1, to: 'today' } };   // dir: the finger's direction
const SKIP = 'input, textarea, select, .wswipe, [data-chart], .chart, .chips, .again-chips, .weekbars, .sheet, #safety, .tabs, .top';
const EDGE = 16;   // leave the screen edges to the system's own back gestures

let st = null, lastName = null, foodFromToday = false;

/** Called on every render: remembers whether Food was opened from Today, so swiping back can step back in history. */
export function noteRoute(name) {
  if (name === 'food' && lastName !== 'food') foodFromToday = lastName === 'today';
  lastName = name;
}

function reset(view, animate) {
  view.style.transition = animate ? 'transform .2s var(--ease), opacity .2s' : '';
  view.style.transform = '';
  view.style.opacity = '';
  if (animate) setTimeout(() => { view.style.transition = ''; }, 220);
}

function navigate(name) {
  if (name === 'today') go(PAIRS.today.to);
  else if (foodFromToday && history.length > 1) history.back();
  else go(PAIRS.food.to, { replace: true });
}

export function initPageSwipe() {
  const view = $('#view');
  if (!view) return;
  document.addEventListener('touchstart', e => {
    st = null;
    if (e.touches.length !== 1 || sheetOpen() || !$('#safety').hidden) return;
    const name = current().name;
    if (!PAIRS[name] || e.target.closest(SKIP)) return;
    const t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > innerWidth - EDGE) return;
    st = { x: t.clientX, y: t.clientY, t: performance.now(), name, lock: null, dx: 0 };
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!st) return;
    if (e.touches.length !== 1) { reset(view, true); st = null; return; }
    const t = e.touches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (!st.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      st.lock = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'h' : 'v';
      if (st.lock === 'v') { st = null; return; }
    }
    st.dx = dx;
    if (reducedMotion()) return;
    const want = PAIRS[st.name].dir;
    const eff = dx * want > 0 ? dx : dx * 0.15;          // the wrong way only gives a little
    view.style.transition = 'none';
    view.style.transform = `translateX(${eff * 0.55}px)`;
    view.style.opacity = String(1 - Math.min(0.45, Math.abs(eff) / innerWidth * 0.8));
  }, { passive: true });

  const end = e => {
    if (!st) return;
    const s = st; st = null;
    if (s.lock !== 'h') return;
    const want = PAIRS[s.name].dir, along = s.dx * want, dt = performance.now() - s.t;
    const commit = e.type === 'touchend' && (along > 80 || (along > 40 && dt < 260));
    if (!commit) { reset(view, true); return; }
    if (reducedMotion()) { navigate(s.name); return; }
    view.style.transition = 'transform .14s ease-in, opacity .14s';
    view.style.transform = `translateX(${want * 35}%)`;
    view.style.opacity = '0';
    setTimeout(() => { reset(view, false); navigate(s.name); }, 140);
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
