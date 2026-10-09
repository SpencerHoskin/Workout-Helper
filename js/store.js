// localStorage persistence. Keys are STABLE — never rename or drop; migrate instead.
//
// Reads go through an in-memory cache (parsed once, invalidated on write), so callers get the
// SAME object back each time: mutate it only if you save it straight after.
import { EX, DEFAULT_CHECKLIST, DEFAULT_GOAL, DEFAULT_SETTINGS } from './catalog.js';
import { num, todayStr, uid, hashCode, normalizeCode } from './util.js';

export const KEYS = {
  schema: 'wh_schema',       // number
  log: 'wh_log',             // [{id, date, sessionId, exId, machineId, sets:[{w,r,rpe,min,lvl,ts}], note}]
  daily: 'wh_daily',         // {date: {weight, supps:{id:bool}, note}}   (weight is legacy; see weighins)
  checklist: 'wh_checklist', // [{id, text, done, note}]
  limits: 'wh_limits',       // {load, intensity, other}
  supps: 'wh_supps',         // {id: 'ok'|'pending'|'no'}
  draft: 'wh_draft',         // v1 only: in-progress session (migrated into log in v2)
  // schema 2
  machines: 'wh_machines',   // {id: {id, code, name, type, exIds:[], video, zone, created}}
  exercises: 'wh_exercises', // custom exercises {id: {name, kind, sets, reps, inc}}
  weighins: 'wh_weighins',   // [{id, date, ts, weight, bodyFat, muscle, source, note}]
  goal: 'wh_goal',
  settings: 'wh_settings',
  coach: 'wh_coach',         // last Coach Claude report {ts, report, model, question}
  today: 'wh_today',         // {date, sessionId} — which session is picked today
  setup: 'wh_setup',         // {exId: "seat 4, pin 3"} machine setup notes
  meta: 'wh_meta'            // {lastBackup: ms}
};
export const SCHEMA = 2;

// Expected top-level type per key — used by typed loaders and by backup restore.
const SHAPE = {
  schema: 'number', log: 'array', daily: 'object', checklist: 'array', limits: 'object', supps: 'object',
  draft: 'object?', machines: 'object', exercises: 'object', weighins: 'array', goal: 'object', settings: 'object',
  coach: 'object?', today: 'object?', setup: 'object', meta: 'object'
};
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function fits(shape, v) {
  if (shape.endsWith('?') && v === null) return true;
  const s = shape.replace('?', '');
  return s === 'array' ? Array.isArray(v) : s === 'object' ? isObj(v) : typeof v === s;
}

const cache = new Map();
export const clearCache = () => cache.clear();
// Another tab/window wrote to storage → drop our cached copy of that key.
if (typeof window !== 'undefined') window.addEventListener('storage', e => (e.key ? cache.delete(e.key) : cache.clear()));

export function load(key, fallback) {
  if (cache.has(key)) return cache.get(key);
  let v;
  try {
    const raw = localStorage.getItem(key);
    v = raw == null ? undefined : JSON.parse(raw);
  } catch (e) {
    console.error('load failed', key, e);
  }
  if (v === undefined) return fallback;
  cache.set(key, v);
  return v;
}

/** Load and insist on the expected type; anything else (corruption, old bug) reads as the fallback. */
function loadTyped(name, fallback) {
  const v = load(KEYS[name], fallback);
  if (v !== fallback && !fits(SHAPE[name], v)) {
    console.warn(`Ignoring ${KEYS[name]}: expected ${SHAPE[name]}`);
    return fallback;
  }
  return v;
}

export function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    cache.set(key, val);
    return true;
  } catch (e) {
    cache.delete(key);
    if (typeof alert === 'function') alert('Could not save (' + key + '): ' + e.message);
    return false;
  }
}
export function remove(key) {
  cache.delete(key);
  localStorage.removeItem(key);
}

/* ---------- Migration ---------- */
export function migrate() {
  const v = Number(load(KEYS.schema, 0)) || 0;
  if (v > SCHEMA) console.warn('Data is from a newer version', v);
  if (v < 2) migrateTo2();
  save(KEYS.schema, Math.max(v, SCHEMA));
  // Laser theme (Oct 2026): dark is the default look. One time only, move anyone still on
  // "Match iPhone" to dark; after that, whatever they pick in Me → Theme sticks.
  const meta = getMeta();
  if (!meta.darkDefault) {
    const s = loadTyped('settings', {});
    if (s.theme === 'auto') save(KEYS.settings, { ...s, theme: 'dark' });
    save(KEYS.meta, { ...meta, darkDefault: true });
  }
}

function normSet(s) {
  return { w: num(s.w), r: num(s.r), rpe: num(s.rpe), min: num(s.min) };
}

function migrateTo2() {
  // 1) numeric sets (v1 stored the raw input strings)
  const log = loadTyped('log', []).map(e => ({ machineId: null, ...e, sets: (e.sets || []).map(normSet) }));

  // 2) an unfinished v1 session draft becomes real log entries (v2 saves every set immediately)
  const draft = loadTyped('draft', null);
  if (draft && draft.data) {
    for (const [exId, v] of Object.entries(draft.data)) {
      const sets = (v.sets || []).filter(s => s && (s.w || s.r || s.rpe)).map(normSet);
      if (sets.length) log.push({ id: uid('d'), date: draft.date, sessionId: draft.sessionId, exId, machineId: null, sets, note: v.note || '' });
    }
    remove(KEYS.draft);
  }
  save(KEYS.log, log);

  // 3) bodyweight from the Daily tab becomes weigh-ins
  const weighins = loadTyped('weighins', []).slice();
  const have = new Set(weighins.map(w => w.date + '|' + w.source));
  for (const [date, d] of Object.entries(loadTyped('daily', {}))) {
    const w = num(d && d.weight);
    if (w && !have.has(date + '|daily')) weighins.push({ id: uid('w'), date, ts: null, weight: w, bodyFat: null, muscle: null, source: 'daily', note: '' });
  }
  weighins.sort((a, b) => a.date.localeCompare(b.date));
  save(KEYS.weighins, weighins);
}

/* ---------- Accessors ---------- */
export const getLog = () => loadTyped('log', []);
export const setLog = log => save(KEYS.log, log);
export const getDaily = () => loadTyped('daily', {});
export const getLimits = () => loadTyped('limits', {});
export const getSupps = () => loadTyped('supps', {});

export function getSettings() {
  const s = loadTyped('settings', {});
  return { ...DEFAULT_SETTINGS, ...s, health: { ...DEFAULT_SETTINGS.health, ...(isObj(s.health) ? s.health : {}) } };
}
export const setSettings = s => save(KEYS.settings, s);

export const getGoal = () => ({ ...DEFAULT_GOAL, ...loadTyped('goal', {}) });
export const setGoal = g => save(KEYS.goal, g);

export const getChecklist = () => loadTyped('checklist', null) || DEFAULT_CHECKLIST.map(c => ({ ...c }));

export const getMachines = () => loadTyped('machines', {});
export const setMachines = m => save(KEYS.machines, m);

export function getWeighins() {
  return loadTyped('weighins', []).slice().sort((a, b) => (a.date + (a.ts || 0)).localeCompare(b.date + (b.ts || 0)));
}
export const setWeighins = w => save(KEYS.weighins, w);

let exMemo = { src: null, out: null };
const NO_CUSTOM = Object.freeze({}); // stable identity so the memo also hits when there are no custom exercises
/** All exercises: built-in catalog + user-created, with defaults filled in (memoised). */
export function allExercises() {
  const custom = loadTyped('exercises', NO_CUSTOM);
  if (exMemo.src === custom && exMemo.out) return exMemo.out;
  const out = {};
  for (const [id, x] of Object.entries({ ...EX, ...custom })) {
    out[id] = { id, kind: 'strength', sets: 3, reps: '10–12', inc: 5, group: 'Other', ...x };
  }
  exMemo = { src: custom, out };
  return out;
}
export const exById = id => allExercises()[id] || null;

export function addCustomExercise(name, kind = 'strength') {
  const all = { ...loadTyped('exercises', NO_CUSTOM) };
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
  setMachines({ ...getMachines(), [machine.id]: machine });
  return machine;
}

export function deleteMachine(id) {
  const all = { ...getMachines() };
  delete all[id];
  setMachines(all);
}

export const getSetup = exId => loadTyped('setup', {})[exId] || '';
export function setSetup(exId, text) {
  const all = { ...loadTyped('setup', {}) };
  if (text) all[exId] = text; else delete all[exId];
  save(KEYS.setup, all);
}

/* ---------- Today / logging ---------- */
export function todaySession() {
  const t = loadTyped('today', null);
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
export const getMeta = () => loadTyped('meta', {});
export const markBackedUp = () => save(KEYS.meta, { ...getMeta(), lastBackup: Date.now() });

export function exportAll() {
  // '5am-workout' is the backup FORMAT id (the app's original name) — keep it so old and new backups restore.
  const out = { app: '5am-workout', exported: new Date().toISOString(), data: {} };
  for (const k of Object.values(KEYS)) {
    const v = load(k, undefined);
    if (v !== undefined) out.data[k] = v;
  }
  return out;
}

/** Restore a backup. Validates EVERYTHING first, so a bad file never half-overwrites your data. */
export function importAll(obj) {
  if (!isObj(obj) || obj.app !== '5am-workout' || !isObj(obj.data)) throw new Error('Not a Kiln backup file');
  const byKey = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [key, name]));
  const writes = [];
  for (const [k, v] of Object.entries(obj.data)) {
    const name = byKey[k];
    if (!name) continue;
    if (!fits(SHAPE[name], v)) throw new Error(`Backup field ${k} has the wrong shape`);
    if (name === 'log' && !v.every(e => isObj(e) && typeof e.date === 'string' && typeof e.exId === 'string' && Array.isArray(e.sets))) {
      throw new Error('Backup workout log is damaged');
    }
    if (name === 'weighins' && !v.every(w => isObj(w) && typeof w.date === 'string')) throw new Error('Backup weigh-ins are damaged');
    writes.push([k, v]);
  }
  if (!writes.length) throw new Error('Backup is empty');
  for (const [k, v] of writes) save(k, v);
  migrate();
}

/** Raw dump of every wh_* key — works even when the data can't be parsed (rescue path). */
export function rawDump() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('wh_')) out[k] = localStorage.getItem(k);
  }
  return out;
}
