import './helpers/storage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, migrate, clearCache, allExercises, addCustomExercise, getLog, getWeighins, addSet, removeSet, importAll, exportAll, saveMachine, findMachineByCode, machineIdFor, getChecklist, save } from '../js/store.js';
import { DEFAULT_CHECKLIST } from '../js/catalog.js';
import { todayStr } from '../js/util.js';

const reset = () => { localStorage.clear(); clearCache(); };
const raw = k => JSON.parse(localStorage.getItem(k));

test('migrates v1 data: numeric sets, unfinished draft, daily weights', () => {
  reset();
  localStorage.setItem('wh_schema', '1');
  localStorage.setItem('wh_log', JSON.stringify([{ id: 'a', date: '2026-09-28', sessionId: 'A', exId: 'legpress', sets: [{ w: '100', r: '12', rpe: '6' }, { w: '', r: '10', rpe: '' }], note: '' }]));
  localStorage.setItem('wh_draft', JSON.stringify({ date: '2026-09-30', sessionId: 'A', data: { seatedrow: { sets: [{ w: '60', r: '12', rpe: '' }, {}], note: 'seat 3' }, legcurl: { sets: [{}], note: '' } } }));
  localStorage.setItem('wh_daily', JSON.stringify({ '2026-09-28': { weight: '182.4', supps: {} }, '2026-09-29': { weight: '', supps: {} } }));
  migrate();
  assert.equal(raw('wh_schema'), 2);
  const log = raw('wh_log');
  assert.deepEqual(log[0].sets[0], { w: 100, r: 12, rpe: 6, min: null });
  assert.equal(log[0].sets[1].w, null);
  assert.equal(log.filter(e => e.exId === 'seatedrow').length, 1);
  assert.equal(log.filter(e => e.exId === 'legcurl').length, 0); // empty draft rows are dropped
  assert.equal(localStorage.getItem('wh_draft'), null);
  assert.deepEqual(raw('wh_weighins').map(w => [w.date, w.weight, w.source]), [['2026-09-28', 182.4, 'daily']]);
  // idempotent: running again changes nothing
  const before = localStorage.getItem('wh_log');
  clearCache(); migrate();
  assert.equal(localStorage.getItem('wh_log'), before);
});

test('corrupted storage reads as empty instead of crashing (v1 bug R1)', () => {
  reset();
  localStorage.setItem('wh_log', '{"oops": true}');
  localStorage.setItem('wh_weighins', 'not json');
  assert.deepEqual(getLog(), []);
  assert.deepEqual(getWeighins(), []);
});

test('addSet appends to today, removeSet cleans up empty entries', () => {
  reset();
  const e = addSet({ exId: 'legpress', machineId: 'm_x', set: { w: 100, r: 12, rpe: 6 } });
  addSet({ exId: 'legpress', set: { w: 100, r: 11 } });
  assert.equal(getLog().length, 1);
  assert.equal(raw('wh_log')[0].sets.length, 2);
  assert.equal(raw('wh_log')[0].date, todayStr());
  assert.equal(raw('wh_log')[0].machineId, 'm_x');
  assert.ok(raw('wh_log')[0].sets[0].ts > 0);
  removeSet(e.id, 0); removeSet(e.id, 0);
  assert.deepEqual(raw('wh_log'), []);
});

test('machines are found by normalised QR code', () => {
  reset();
  const code = 'https://example.com/v/leg-press';
  saveMachine({ id: machineIdFor(code), code, name: 'Leg Press', type: 'legpress', exIds: ['legpress'] });
  assert.equal(findMachineByCode('https://EXAMPLE.com/v/leg-press/?utm_medium=qr').name, 'Leg Press');
  assert.equal(findMachineByCode('https://example.com/v/chest'), null);
});

test('default checklist is copied, never mutated in place', () => {
  reset();
  const cl = getChecklist();
  cl.push({ id: 'x', text: 'new', done: false, note: '' });
  assert.equal(DEFAULT_CHECKLIST.length, 5);
});

test('backup round-trips', () => {
  reset();
  addSet({ exId: 'legpress', set: { w: 100, r: 12 } });
  save(KEYS.weighins, [{ id: 'w1', date: '2026-10-01', weight: 180 }]);
  const backup = JSON.parse(JSON.stringify(exportAll()));
  reset();
  importAll(backup);
  assert.equal(raw('wh_log').length, 1);
  assert.equal(raw('wh_weighins')[0].weight, 180);
});

test('restore validates everything before writing anything (v1 bug S4)', () => {
  reset();
  addSet({ exId: 'legpress', set: { w: 100, r: 12 } });
  const before = localStorage.getItem('wh_log');
  assert.throws(() => importAll({ app: 'other', data: {} }), /Not a Kiln backup/);
  assert.throws(() => importAll({ app: '5am-workout', data: { wh_goal: { type: 'lose' }, wh_log: { not: 'an array' } } }), /wrong shape/);
  assert.throws(() => importAll({ app: '5am-workout', data: { wh_log: [{ date: 5 }] } }), /damaged/);
  assert.equal(localStorage.getItem('wh_log'), before);
  assert.equal(localStorage.getItem('wh_goal'), null); // nothing half-written
});

test('exercise catalog is memoised, and refreshes when a custom exercise is added', () => {
  reset();
  const a = allExercises();
  assert.equal(allExercises(), a); // same object: no rebuild per lookup (v1 bug P1)
  const id = addCustomExercise('Cable lateral raise');
  const b = allExercises();
  assert.notEqual(b, a);
  assert.equal(b[id].name, 'Cable lateral raise');
  assert.equal(b[id].kind, 'strength');
});

test('Laser theme: dark is the default, and "Match iPhone" moves to dark once', async () => {
  const { getSettings, setSettings } = await import('../js/store.js');
  reset();
  migrate();
  assert.equal(getSettings().theme, 'dark');            // fresh install
  reset();
  localStorage.setItem('wh_settings', JSON.stringify({ theme: 'auto', restSec: 120 }));
  migrate();
  assert.equal(raw('wh_settings').theme, 'dark');        // one-time switch, other settings kept
  assert.equal(raw('wh_settings').restSec, 120);
  setSettings({ ...getSettings(), theme: 'auto' });      // a later deliberate choice sticks
  clearCache(); migrate();
  assert.equal(raw('wh_settings').theme, 'auto');
});

test('"My health profile": on for anyone with data, off for a fresh install, decided once', async () => {
  const { getSettings, setSettings, myHealth, getGoal } = await import('../js/store.js');
  reset();
  migrate();
  assert.equal(myHealth(), false);                        // fresh install = a friend trying the app
  assert.equal(getGoal().targetWeight, '');               // no owner goal leaking in
  assert.equal(getGoal().type, 'general');
  reset();
  localStorage.setItem('wh_schema', '2');                 // opened an older version once, never logged anything
  migrate();
  assert.equal(myHealth(), false);
  reset();
  localStorage.setItem('wh_schema', '2');                 // the owner's phone: data from before this change
  localStorage.setItem('wh_settings', JSON.stringify({ theme: 'dark', restSec: 120 }));
  localStorage.setItem('wh_weighins', JSON.stringify([{ id: 'w1', date: '2026-10-01', weight: 181 }]));
  migrate();
  assert.equal(myHealth(), true);
  assert.equal(raw('wh_settings').restSec, 120);
  assert.equal(getGoal().targetWeight, 165);              // owner defaults still apply
  setSettings({ ...getSettings(), myHealth: false });     // switching it off sticks
  clearCache(); migrate();
  assert.equal(myHealth(), false);
  reset();
  addSet({ exId: 'legpress', set: { w: 100, r: 12 } });   // logged sets but no schema stamp yet still count as data
  migrate();
  assert.equal(myHealth(), true);
});

test('backups and rescue files leave out the coach passcode; restore keeps the one on the phone', async () => {
  const { getSettings, setSettings, rawDump } = await import('../js/store.js');
  reset();
  migrate();
  setSettings({ ...getSettings(), coachPass: 's3cr"et', restSec: 150 });
  const backup = JSON.parse(JSON.stringify(exportAll()));
  assert.equal('coachPass' in backup.data.wh_settings, false);
  assert.equal(backup.data.wh_settings.restSec, 150);
  assert.ok(!JSON.stringify(rawDump()).includes('s3cr'));
  assert.equal(getSettings().coachPass, 's3cr"et');      // exporting doesn't touch the phone's copy
  importAll(backup);
  assert.equal(getSettings().coachPass, 's3cr"et');      // restoring on the same phone keeps the passcode
  reset();
  importAll(backup);
  assert.equal(getSettings().coachPass, '');              // a new phone has none until you type it
  assert.equal(getSettings().restSec, 150);
});

test('restoring a backup from before the switch existed: the owner gets the profile back on a new phone', async () => {
  const { myHealth, getGoal, setGoalField } = await import('../js/store.js');
  reset();
  addSet({ exId: 'legpress', set: { w: 100, r: 12 } });
  const old = JSON.parse(JSON.stringify(exportAll()));
  delete old.data.wh_meta; old.data.wh_settings = { theme: 'dark' }; // as written by an older version
  reset();
  migrate();                                              // the new phone starts as a fresh install
  assert.equal(myHealth(), false);
  importAll(old);
  assert.equal(myHealth(), true);
  // goal edits store only the field you changed, so switching the profile off doesn't keep the owner's 165
  setGoalField('sessionsPerWeek', 4);
  assert.deepEqual(raw('wh_goal'), { sessionsPerWeek: 4 });
  assert.equal(getGoal().targetWeight, 165);
});
