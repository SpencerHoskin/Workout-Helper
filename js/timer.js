// Rest timer pill. Uses an absolute end time so it survives re-renders and app switches.
import { $, beep, toast } from './ui.js';
import { myHealth } from './store.js';

let end = 0, tick = null;

function paint() {
  const el = $('#rest');
  const left = Math.max(0, Math.round((end - Date.now()) / 1000));
  document.body.classList.toggle('resting', !!end);
  if (!end) { el.hidden = true; return; }
  el.hidden = false;
  $('#restTime').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
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
