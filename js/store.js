// localStorage persistence. Keys are STABLE — never rename or drop; migrate instead.
import { EX, DEFAULT_CHECKLIST, DEFAULT_GOAL, DEFAULT_SETTINGS } from './catalog.js';
import { num, todayStr, uid, hashCode, normalizeCode } from './util.js';

export const KEYS = {
  schema: 'wh_schema',       // number
  log: 'wh_log',             // [{id, date, sessionId, exId, machineId, sets:[{w,r,rpe,min,ts}], note}]
  daily: 'wh_daily',         // {date: {weight, supps:{id:bool}, note}}   (weight is legacy; see weighins)
  checklist: 'wh_checklist', // [{id, text, done, note}]
  limits: 'wh_limits',       // {load, intensity, other}
  supps: 'wh_supps',         // {id: 'ok'|'pending'|'no'}
  draft: 'wh_draft',         // v1 only: in-progress session (migrated into log in v2)
  // schema 2
  machines: 'wh_machines',   // {id: {id, code, name, type, exIds:[], video, zone, setup, created}}
  exercises: 'wh_exercises', // custom exercises {id: {name, kind, sets, reps, inc}}
  weighins: 'wh_weighins',   // [{id, date, ts, weight, bodyFat, muscle, source, note}]
  goal: 'wh_goal',
  settings: 'wh_settings',
  coach: 'wh_coach',         // last Coach Claude report {ts, report, model}
  today: 'wh_today',         // {date, sessionId} — which session is picked today
  setup: 'wh_setup'          // {exId: "seat 4, pin 3"} machine setup notes
};
export const SCHEMA = 2;

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) {
    console.error('load failed', key, e);
    return fallback;
  }
}
export function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    alert('Could not save (' + key + '): ' + e.message);
    return false;
  }
}
export const remove = key => localStorage.removeItem(key);

/* ---------- Migration ---------- */
export function migrate() {
  const v = load(KEYS.schema, 0);
  if (v > SCHEMA) console.warn('Data is from a newer version', v);
  if (v < 2) migrateTo2();
  save(KEYS.schema, SCHEMA);
}

function normSet(s) {
  return { w: num(s.w), r: num(s.r), rpe: num(s.rpe), min: num(s.min) };
}

function migrateTo2() {
  // 1) numeric sets (v1 stored the raw input strings)
  const log = load(KEYS.log, []).map(e => ({ machineId: null, ...e, sets: (e.sets || []).map(normSet) }));

  // 2) an unfinished v1 session draft becomes real log entries (v2 saves every set immediately)
  const draft = load(KEYS.draft, null);
  if (draft && draft.data) {
    for (const [exId, v] of Object.entries(draft.data)) {
      const sets = (v.sets || []).filter(s => s && (s.w || s.r || s.rpe)).map(normSet);
      if (sets.length) log.push({ id: uid('d'), date: draft.date, sessionId: draft.sessionId, exId, machineId: null, sets, note: v.note || '' });
    }
    remove(KEYS.draft);
  }
  save(KEYS.log, log);

  // 3) bodyweight from the Daily tab becomes weigh-ins
  const weighins = load(KEYS.weighins, []);
  const have = new Set(weighins.map(w => w.date + '|' + w.source));
  for (const [date, d] of Object.entries(load(KEYS.daily, {}))) {
    const w = num(d && d.weight);
    if (w && !have.has(date + '|daily')) weighins.push({ id: uid('w'), date, ts: null, weight: w, bodyFat: null, muscle: null, source: 'daily', note: '' });
  }
  weighins.sort((a, b) => a.date.localeCompare(b.date));
  save(KEYS.weighins, weighins);
}

/* ---------- Accessors ---------- */
export const getLog = () => load(KEYS.log, []);
export const setLog = log => save(KEYS.log, log);

export function getSettings() {
  const s = load(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...s, health: { ...DEFAULT_SETTINGS.health, ...(s.health || {}) } };
}
export const setSettings = s => save(KEYS.settings, s);

export const getGoal = () => ({ ...DEFAULT_GOAL, ...load(KEYS.goal, {}) });
export const setGoal = g => save(KEYS.goal, g);

export const getChecklist = () => load(KEYS.checklist, DEFAULT_CHECKLIST);

export const getMachines = () => load(KEYS.machines, {});
export const setMachines = m => save(KEYS.machines, m);

export function getWeighins() {
  return load(KEYS.weighins, []).slice().sort((a, b) => (a.date + (a.ts || 0)).localeCompare(b.date + (b.ts || 0)));
}
export const setWeighins = w => save(KEYS.weighins, w);

/** All exercises: built-in catalog + user-created, with defaults filled in. */
export function allExercises() {
  const custom = load(KEYS.exercises, {});
  const out = {};
  for (const [id, x] of Object.entries({ ...EX, ...custom })) {
    out[id] = { id, kind: 'strength', sets: 3, reps: '10–12', inc: 5, group: 'Other', ...x };
  }
  return out;
}
export const exById = id => allExercises()[id] || null;

export function addCustomExercise(name, kind = 'strength') {
  const all = load(KEYS.exercises, {});
  const id = 'x_' + hashCode(name.toLowerCase() + Date.now());
  all[id] = { name, kind, sets: kind === 'cardio' ? 1 : 3, reps: kind === 'cardio' ? '' : '10–12', inc: 5, group: 'Custom' };
  save(KEYS.exercises, all);
  return id;
}

/* ---------- Machines (QR codes) ---------- */
export const machineIdFor = code => 'm_' + hashCode(normalizeCode(code));

export function findMachineByCode(code) {
  const m = getMachines();
  const id = machineIdFor(code);
  return m[id] || Object.values(m).find(x => normalizeCode(x.code) === normalizeCode(code)) || null;
}

export function saveMachine(machine) {
  const all = getMachines();
  all[machine.id] = machine;
  setMachines(all);
  return machine;
}

export function deleteMachine(id) {
  const all = getMachines();
  delete all[id];
  setMachines(all);
}

export const getSetup = exId => load(KEYS.setup, {})[exId] || '';
export function setSetup(exId, text) {
  const all = load(KEYS.setup, {});
  if (text) all[exId] = text; else delete all[exId];
  save(KEYS.setup, all);
}

/* ---------- Today / logging ---------- */
export function todaySession() {
  const t = load(KEYS.today, null);
  return t && t.date === todayStr() ? t.sessionId : undefined; // undefined = not chosen yet
}
export const setTodaySession = sessionId => save(KEYS.today, { date: todayStr(), sessionId });

/** Append one set to today's entry for this exercise (creating the entry if needed). */
export function addSet({ exId, machineId = null, sessionId = null, set }) {
  const log = getLog();
  const date = todayStr();
  let entry = log.find(e => e.date === date && e.exId === exId);
  if (!entry) {
    entry = { id: uid('e'), date, sessionId, exId, machineId, sets: [], note: '' };
    log.push(entry);
  }
  if (machineId && !entry.machineId) entry.machineId = machineId;
  entry.sets.push({ ...set, ts: Date.now() });
  setLog(log);
  return entry;
}

export function removeSet(entryId, index) {
  const log = getLog();
  const i = log.findIndex(e => e.id === entryId);
  if (i < 0) return;
  log[i].sets.splice(index, 1);
  if (!log[i].sets.length && !log[i].note) log.splice(i, 1);
  setLog(log);
}

export function setEntryNote(exId, note) {
  const log = getLog();
  const e = log.find(x => x.date === todayStr() && x.exId === exId);
  if (e) { e.note = note; setLog(log); }
}

/* ---------- Backup ---------- */
export function exportAll() {
  const out = { app: '5am-workout', exported: new Date().toISOString(), data: {} };
  for (const k of Object.values(KEYS)) {
    const v = load(k, undefined);
    if (v !== undefined) out.data[k] = v;
  }
  return out;
}

export function importAll(obj) {
  if (!obj || obj.app !== '5am-workout' || typeof obj.data !== 'object') throw new Error('Not a 5am Workout backup file');
  const known = new Set(Object.values(KEYS));
  for (const [k, v] of Object.entries(obj.data)) if (known.has(k)) save(k, v);
  migrate();
}
