// Rest timer pill. Uses an absolute end time so it survives re-renders and app switches.
import { $, beep, toast } from './ui.js';
import { myHealth } from './store.js';

let end = 0, tick = null;

export const clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
/** Seconds of rest left, or null when no rest is running. */
export const restLeft = () => (end ? Math.max(0, Math.round((end - Date.now()) / 1000)) : null);

// The floating bar, and the logger's own rest chip ([data-rest]) when it's on screen.
function paint() {
  const el = $('#rest');
  const left = restLeft();
  document.body.classList.toggle('resting', !!end);
  document.querySelectorAll('[data-rest]').forEach(c => { c.hidden = !end; });
  if (!end) { el.hidden = true; return; }
  el.hidden = false;
  $('#restTime').textContent = clock(left);
  document.querySelectorAll('[data-rest-time]').forEach(t => { t.textContent = clock(left); });
  if (left <= 0) {
    stopRest();
    beep(988, 220);
    toast(myHealth() ? 'Rest done — next set, Brother' : 'Rest done — next set');
  }
}

export function startRest(sec) {
  end = Date.now() + sec * 1000;
  clearInterval(tick);
  tick = setInterval(paint, 250);
  paint();
}
export function addRest(sec) { if (end) { end += sec * 1000; paint(); } }
export function stopRest() { end = 0; clearInterval(tick); tick = null; paint(); }
