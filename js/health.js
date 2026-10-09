// Apple Health bridge. A web app can't touch HealthKit directly, so we hand values to
// two tiny Apple Shortcuts the user creates once ("Log Health Sample" / "Log Workout").
import { getSettings } from './store.js';
import { todayStr } from './util.js';
import { PLATFORM } from './ui.js';

export function runShortcut(name, text) {
  window.location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent(name) +
    '&input=text&text=' + encodeURIComponent(String(text));
}

// Shortcuts only exists on iPhone, so the Health buttons never show anywhere else (even if switched on there).
export const healthOn = () => PLATFORM === 'ios' && getSettings().health.enabled;

export function sendWeight(lb) {
  runShortcut(getSettings().health.weightShortcut, Math.round(lb * 10) / 10);
}

export function sendWorkout(minutes) {
  runShortcut(getSettings().health.workoutShortcut, Math.max(1, Math.round(minutes)));
}

/** Minutes from first to last set logged today, plus warm-up/cool-down padding. */
export function workoutMinutesToday(log) {
  const ts = log.filter(e => e.date === todayStr()).flatMap(e => e.sets.map(s => s.ts)).filter(Boolean);
  const cardio = log.filter(e => e.date === todayStr()).flatMap(e => e.sets.map(s => s.min || 0)).reduce((a, b) => a + b, 0);
  if (!ts.length) return cardio || 0;
  return Math.round((Math.max(...ts) - Math.min(...ts)) / 60000) + 10;
}

export const HEALTH_STEPS = `
<ol class="steps">
  <li>Open the <b>Shortcuts</b> app → <b>+</b> → name it <b>WH Log Weight</b>.</li>
  <li>Add action <b>Get Numbers from Input</b> (input: <b>Shortcut Input</b>).</li>
  <li>Add action <b>Log Health Sample</b>. Type: <b>Weight</b>. Value: <b>Numbers</b>. Unit: <b>lb</b>.</li>
  <li>Make a second shortcut <b>WH Log Workout</b>: <b>Get Numbers from Input</b>, then <b>Log Workout</b> — type <b>Traditional Strength Training</b>, Duration: <b>Numbers</b> minutes.</li>
  <li>Run each once by hand and tap <b>Allow</b> when it asks for Health access.</li>
  <li>Turn on the switch below. After a weigh-in or workout, tap <b>Send to Apple Health</b>.</li>
</ol>
<p class="muted small">Why Shortcuts? iPhone only lets real App Store apps read/write Health directly. Shortcuts is Apple's official bridge for web apps.</p>`;
