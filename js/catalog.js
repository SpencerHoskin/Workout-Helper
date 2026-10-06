// Static program data. Exercise ids are STABLE — logged history points at them.

export const GYM = 'Crunch Stratford';
export const PENDING = 'pending cardiologist';
export const BREATH = 'Exhale on the effort, inhale on the return. No breath-holding or straining.';

// kind: 'strength' (weight × reps) | 'cardio' (minutes) | 'bodyweight' (reps only)
// inc: smallest sensible load jump in lb for that machine
// assisted: the stack ASSISTS you, so less weight = harder
export const EX = {
  bike:          { name: 'Warm-up: bike or treadmill walk', kind: 'cardio', target: '5–8 min easy (RPE 3–4)', icon: '🚴' },
  legpress:      { name: 'Leg press (machine)', sets: 3, reps: '10–12', inc: 10, group: 'Legs' },
  chestpress:    { name: 'Chest press (machine)', sets: 3, reps: '10–12', inc: 5, group: 'Chest' },
  seatedrow:     { name: 'Seated cable row', sets: 3, reps: '10–12', inc: 5, group: 'Back' },
  pulldown:      { name: 'Lat pulldown', sets: 3, reps: '10–12', inc: 5, group: 'Back' },
  legcurl:       { name: 'Seated leg curl (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Legs' },
  shoulderpress: { name: 'Shoulder press (machine)', sets: 2, reps: '10–12', inc: 5, group: 'Shoulders',
                   flag: 'Machine only — no heavy overhead dumbbells without a spotter.' },
  gobletbox:     { name: 'Box squat to bench (light DB or bodyweight)', sets: 3, reps: '10–12', inc: 5, group: 'Legs',
                   flag: 'Controlled sit-down to a bench. Not a box jump.' },
  legext:        { name: 'Leg extension (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Legs' },
  cablefly:      { name: 'Cable chest fly (or pec-deck)', sets: 2, reps: '12–15', inc: 5, group: 'Chest' },
  facepull:      { name: 'Cable face pull', sets: 2, reps: '12–15', inc: 5, group: 'Shoulders' },
  pallof:        { name: 'Pallof press (cable, each side)', sets: 2, reps: '10 / side', inc: 5, group: 'Core' },
  hipthrust:     { name: 'Glute bridge / hip thrust machine', sets: 3, reps: '10–12', inc: 10, group: 'Glutes' },
  assistpull:    { name: 'Assisted pull-up (machine)', sets: 3, reps: '8–10', inc: 5, group: 'Back', assisted: true },
  inclinepress:  { name: 'Incline chest press (machine)', sets: 3, reps: '10–12', inc: 5, group: 'Chest' },
  cablecurl:     { name: 'Cable biceps curl', sets: 2, reps: '12–15', inc: 5, group: 'Arms' },
  pushdown:      { name: 'Cable triceps pushdown', sets: 2, reps: '12–15', inc: 5, group: 'Arms' },
  deadbug:       { name: 'Dead bug (floor)', sets: 2, reps: '8 / side', kind: 'bodyweight', group: 'Core' },
  walk:          { name: 'Cool-down: easy walk + stretch', kind: 'cardio', target: '3–5 min', icon: '🚶' },
  // Extra machines found around a typical Crunch floor
  pecdeck:       { name: 'Pec deck (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Chest' },
  reversefly:    { name: 'Reverse fly / rear delt (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Shoulders' },
  abductor:      { name: 'Hip abduction (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Glutes' },
  adductor:      { name: 'Hip adduction (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Legs' },
  calfraise:     { name: 'Calf raise (machine)', sets: 2, reps: '12–15', inc: 10, group: 'Legs' },
  smithsquat:    { name: 'Smith machine squat', sets: 3, reps: '10–12', inc: 10, group: 'Legs',
                   flag: 'Set the safety stops first. Smooth reps, no grinding.' },
  abcrunch:      { name: 'Ab crunch (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Core' },
  backext:       { name: 'Back extension (machine)', sets: 2, reps: '12–15', inc: 5, group: 'Back' },
  treadmill:     { name: 'Treadmill', kind: 'cardio', target: '10–20 min, talk-test pace', icon: '🏃' },
  ubike:         { name: 'Stationary bike', kind: 'cardio', target: '10–20 min easy–moderate', icon: '🚴' },
  elliptical:    { name: 'Elliptical', kind: 'cardio', target: '10–20 min easy–moderate', icon: '🌀' },
  stairs:        { name: 'Stair climber', kind: 'cardio', target: '5–10 min, slow and steady', icon: '🪜' },
  rower:         { name: 'Rowing machine', kind: 'cardio', target: '5–10 min easy', icon: '🚣' }
};

export const SESSIONS = {
  A: { name: 'Session A', day: 1, ex: ['bike', 'legpress', 'chestpress', 'seatedrow', 'legcurl', 'pallof', 'walk'] },
  B: { name: 'Session B', day: 3, ex: ['bike', 'gobletbox', 'pulldown', 'shoulderpress', 'hipthrust', 'facepull', 'deadbug', 'walk'] },
  C: { name: 'Session C', day: 5, ex: ['bike', 'legpress', 'inclinepress', 'assistpull', 'legext', 'cablecurl', 'pushdown', 'walk'] }
};
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// What you can pick when a QR code is scanned for the first time.
export const MACHINE_TYPES = [
  { id: 'legpress',   name: 'Leg Press',            icon: '🦵', ex: ['legpress', 'calfraise'] },
  { id: 'chest',      name: 'Chest Press',          icon: '🏋️', ex: ['chestpress', 'inclinepress'] },
  { id: 'row',        name: 'Seated Row',           icon: '🚣', ex: ['seatedrow'] },
  { id: 'pulldown',   name: 'Lat Pulldown',         icon: '⬇️', ex: ['pulldown'] },
  { id: 'cable',      name: 'Cable Station',        icon: '🔗', ex: ['seatedrow', 'facepull', 'pallof', 'cablefly', 'cablecurl', 'pushdown'] },
  { id: 'shoulder',   name: 'Shoulder Press',       icon: '🙌', ex: ['shoulderpress'] },
  { id: 'legcurl',    name: 'Leg Curl',             icon: '🦿', ex: ['legcurl'] },
  { id: 'legext',     name: 'Leg Extension',        icon: '🦵', ex: ['legext'] },
  { id: 'pecdeck',    name: 'Pec Deck / Rear Delt', icon: '🦋', ex: ['pecdeck', 'reversefly'] },
  { id: 'glute',      name: 'Hip Thrust / Glute',   icon: '🍑', ex: ['hipthrust'] },
  { id: 'hips',       name: 'Abductor / Adductor',  icon: '↔️', ex: ['abductor', 'adductor'] },
  { id: 'assist',     name: 'Assisted Pull-up',     icon: '🧗', ex: ['assistpull'] },
  { id: 'smith',      name: 'Smith Machine',        icon: '🏗️', ex: ['smithsquat', 'gobletbox'] },
  { id: 'abs',        name: 'Ab / Back Machine',    icon: '🧱', ex: ['abcrunch', 'backext'] },
  { id: 'treadmill',  name: 'Treadmill',            icon: '🏃', ex: ['treadmill'] },
  { id: 'bike',       name: 'Bike',                 icon: '🚴', ex: ['ubike'] },
  { id: 'elliptical', name: 'Elliptical',           icon: '🌀', ex: ['elliptical'] },
  { id: 'stairs',     name: 'Stair Climber',        icon: '🪜', ex: ['stairs'] },
  { id: 'rower',      name: 'Rower',                icon: '🚣', ex: ['rower'] },
  { id: 'scale',      name: 'Scale',                icon: '⚖️', ex: [], scale: true },
  { id: 'other',      name: 'Something else',       icon: '✨', ex: [], custom: true }
];

export const SUPPS = [
  { id: 'protein',  name: 'Protein', def: 'ok',
    note: 'Food first; shake as backup if appetite is low. No added-potassium products.' },
  { id: 'creatine', name: 'Creatine', def: 'pending',
    note: 'Plan: 3–5 g/day monohydrate, no loading. Tell doctor before bloodwork (raises creatinine).' },
  { id: 'taurine',  name: 'Taurine', def: 'pending',
    note: 'Pending cardiologist / pharmacist OK.' }
];
export const AVOID = [
  'BCAAs — dropped (redundant with enough protein)',
  'Stimulant pre-workouts — avoid. Normal coffee is fine.',
  'High-dose fish oil, vitamin E, turmeric, ginkgo, garlic pills — avoid unless cardiologist approves (bleeding risk)'
];
export const DEFAULT_CHECKLIST = [
  'Creatine 3–5 g/day OK?',
  'Taurine OK with my meds?',
  'Any lifting load or intensity limits?',
  'Confirm no stimulant pre-workout',
  'Should I do cardiac rehab / a stress test for exercise clearance?'
].map((text, i) => ({ id: 'c' + (i + 1), text, done: false, note: '' }));

export const DEFAULT_GOAL = {
  type: 'recomp',            // 'lose' | 'recomp' | 'strength' | 'general'
  targetWeight: 165,
  targetDate: '',
  sessionsPerWeek: 3,
  strengthEx: 'legpress',
  strengthTarget: '',
  why: 'Get to 165 lbs, or hold weight while losing fat / adding muscle.'
};

export const DEFAULT_SETTINGS = {
  gymName: GYM,
  restSec: 90,
  theme: 'auto',              // 'auto' | 'light' | 'dark'
  coachUrl: '/api/coach',
  coachPass: '',
  health: { enabled: false, weightShortcut: 'WH Log Weight', workoutShortcut: 'WH Log Workout' }
};
