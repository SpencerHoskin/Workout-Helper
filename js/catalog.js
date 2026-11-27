// Static program data. Exercise ids are STABLE — logged history points at them.

export const GYM = 'Crunch Stratford';
export const PENDING = 'pending cardiologist';
export const BREATH = 'Exhale on the effort, inhale on the return. No breath-holding or straining.';

// kind: 'strength' (weight × reps) | 'cardio' (minutes) | 'bodyweight' (reps only)
// inc: smallest sensible load jump in lb for that machine
// assisted: the stack ASSISTS you, so less weight = harder
export const EX = {
  bike:          { name: 'Warm-up: bike or treadmill walk', kind: 'cardio', target: '5–8 min easy (RPE 3–4)', icon: 'bike' },
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
  walk:          { name: 'Cool-down: easy walk + stretch', kind: 'cardio', target: '3–5 min', icon: 'run' },
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
  treadmill:     { name: 'Treadmill', kind: 'cardio', target: '10–20 min, talk-test pace', icon: 'run' },
  ubike:         { name: 'Stationary bike', kind: 'cardio', target: '10–20 min easy–moderate', icon: 'bike' },
  elliptical:    { name: 'Elliptical', kind: 'cardio', target: '10–20 min easy–moderate', icon: 'elliptical' },
  stairs:        { name: 'Stair climber', kind: 'cardio', target: '5–10 min, slow and steady', icon: 'stairs' },
  rower:         { name: 'Rowing machine', kind: 'cardio', target: '5–10 min easy', icon: 'rower' }
};

// Weekly plans (Me → Weekly plan). Session ids are STABLE — logged sets point at them — and unique across plans.
// day: 0 = Sunday. Both plans hit every muscle about twice a week and keep each session around 45 minutes.
export const PLANS = {
  full: {
    name: 'Full body',
    blurb: '3 full-body sessions. Every session works legs, a push, a pull and core, so each muscle gets about 3 visits a week.',
    sessions: {
      A: { name: 'Session A', day: 1, ex: ['bike', 'legpress', 'chestpress', 'seatedrow', 'legcurl', 'pallof', 'walk'] },
      B: { name: 'Session B', day: 3, ex: ['bike', 'gobletbox', 'pulldown', 'shoulderpress', 'hipthrust', 'facepull', 'deadbug', 'walk'] },
      C: { name: 'Session C', day: 5, ex: ['bike', 'legpress', 'inclinepress', 'assistpull', 'legext', 'cablecurl', 'pushdown', 'walk'] }
    }
  },
  paired: {
    name: 'Push · Pull · Full',
    blurb: 'Muscles that work together share a day: chest, shoulders and triceps on Push; back and biceps on Pull. Friday is full body, so each muscle still gets 2 visits a week, and legs are spread over the week instead of one hard leg day.',
    sessions: {
      push: { name: 'Push day', focus: 'Chest, shoulders & triceps + quads', day: 1, ex: ['bike', 'legpress', 'chestpress', 'shoulderpress', 'pushdown', 'legext', 'walk'] },
      pull: { name: 'Pull day', focus: 'Back & biceps + hamstrings & core', day: 3, ex: ['bike', 'pulldown', 'seatedrow', 'facepull', 'cablecurl', 'legcurl', 'deadbug', 'walk'] },
      mix:  { name: 'Full body', focus: 'A bit of everything', day: 5, ex: ['bike', 'legpress', 'inclinepress', 'assistpull', 'hipthrust', 'abcrunch', 'walk'] }
    }
  }
};
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// What you can pick when a QR code is scanned for the first time. icon = a name from js/icons.js.
export const MACHINE_TYPES = [
  { id: 'legpress',   name: 'Leg Press',            icon: 'dumbbell', ex: ['legpress', 'calfraise'] },
  { id: 'chest',      name: 'Chest Press',          icon: 'press', ex: ['chestpress', 'inclinepress'] },
  { id: 'row',        name: 'Seated Row',           icon: 'cable', ex: ['seatedrow'] },
  { id: 'pulldown',   name: 'Lat Pulldown',         icon: 'pulldown', ex: ['pulldown'] },
  { id: 'cable',      name: 'Cable Station',        icon: 'cable', ex: ['seatedrow', 'facepull', 'pallof', 'cablefly', 'cablecurl', 'pushdown'] },
  { id: 'shoulder',   name: 'Shoulder Press',       icon: 'overhead', ex: ['shoulderpress'] },
  { id: 'legcurl',    name: 'Leg Curl',             icon: 'dumbbell', ex: ['legcurl'] },
  { id: 'legext',     name: 'Leg Extension',        icon: 'dumbbell', ex: ['legext'] },
  { id: 'pecdeck',    name: 'Pec Deck / Rear Delt', icon: 'dumbbell', ex: ['pecdeck', 'reversefly'] },
  { id: 'glute',      name: 'Hip Thrust / Glute',   icon: 'dumbbell', ex: ['hipthrust'] },
  { id: 'hips',       name: 'Abductor / Adductor',  icon: 'hips', ex: ['abductor', 'adductor'] },
  { id: 'assist',     name: 'Assisted Pull-up',     icon: 'overhead', ex: ['assistpull'] },
  { id: 'smith',      name: 'Smith Machine',        icon: 'dumbbell', ex: ['smithsquat', 'gobletbox'] },
  { id: 'abs',        name: 'Ab / Back Machine',    icon: 'dumbbell', ex: ['abcrunch', 'backext'] },
  { id: 'treadmill',  name: 'Treadmill',            icon: 'run', ex: ['treadmill'] },
  { id: 'bike',       name: 'Bike',                 icon: 'bike', ex: ['ubike'] },
  { id: 'elliptical', name: 'Elliptical',           icon: 'elliptical', ex: ['elliptical'] },
  { id: 'stairs',     name: 'Stair Climber',        icon: 'stairs', ex: ['stairs'] },
  { id: 'rower',      name: 'Rower',                icon: 'rower', ex: ['rower'] },
  { id: 'scale',      name: 'Scale',                icon: 'scale', ex: [], scale: true },
  { id: 'other',      name: 'Something else',       icon: 'sparkle', ex: [], custom: true }
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
  type: 'general',           // 'lose' | 'recomp' | 'strength' | 'general'
  targetWeight: '',
  targetDate: '',
  sessionsPerWeek: 3,
  strengthEx: 'legpress',
  strengthTarget: '',
  why: '',
  kcalTarget: '',            // daily calories (Food screen); blank = no target yet
  proteinTarget: '',         // daily protein, grams
  sodiumLimit: ''            // daily sodium limit, mg
};
// Goal defaults for "My health profile" (the app's first user). Anything they've saved still wins.
export const MY_GOAL = {
  type: 'recomp',
  targetWeight: 165,
  why: 'Get to 165 lbs, or hold weight while losing fat / adding muscle.',
  sodiumLimit: 2300          // the general daily limit until the cardiologist gives a number (Food → Daily targets)
};

export const DEFAULT_SETTINGS = {
  gymName: GYM,
  restSec: 90,
  theme: 'candy',             // 'candy' | 'dark' | 'light' | 'auto' (Miami Heat) | 'neon' (Night Drive) — Candy Cloud is the default look
  coachUrl: '/api/coach',
  coachPass: '',
  plan: 'full',               // a key of PLANS
  myHealth: false,            // "My health profile": cardiologist plan, supplement clearance, bleeding-risk notes, "Brother"
  health: { enabled: false, weightShortcut: 'WH Log Weight', workoutShortcut: 'WH Log Workout' }
};

// What each exercise works and how to spot its machine on the floor. mus = the main muscles, also = the helpers
// (ids from MUSCLES in js/muscles.js). Custom exercises carry their own `mus` (Edit exercise).
export const ANATOMY = {
  legpress:      { mus: ['quads', 'glutes'], also: ['hamstrings', 'adductors'], look: 'A big angled sled: you sit reclined and push a large foot plate away. Plates or a pin stack on the side.' },
  chestpress:    { mus: ['chest'], also: ['front-delts', 'triceps'], look: 'Seated upright against a back pad, two handles at chest height that you push straight forward.' },
  seatedrow:     { mus: ['upper-back', 'lats'], also: ['rear-delts', 'biceps'], look: 'Low cable with a foot plate (or a machine with a chest pad): you pull the handle in to your belly.' },
  pulldown:      { mus: ['lats'], also: ['biceps', 'upper-back', 'rear-delts'], look: 'Tall frame with a long bar hanging from a cable overhead; you sit with pads holding your thighs down.' },
  legcurl:       { mus: ['hamstrings'], also: ['calves'], look: 'Seated, legs straight out, a padded roller behind your ankles that you curl down and under.' },
  shoulderpress: { mus: ['front-delts', 'side-delts'], also: ['triceps', 'upper-back'], look: 'Seated, handles beside your shoulders that you push straight up overhead.' },
  gobletbox:     { mus: ['quads', 'glutes'], also: ['adductors', 'abs'], look: 'No machine: a bench or box behind you and one light dumbbell held at your chest.' },
  legext:        { mus: ['quads'], also: [], look: 'Seated, a padded roller in front of your shins; you straighten your knees to lift it.' },
  cablefly:      { mus: ['chest'], also: ['front-delts'], look: 'Two tall cable towers with a handle each; you bring the handles together in front of your chest.' },
  facepull:      { mus: ['rear-delts', 'upper-back'], also: ['side-delts'], look: 'Cable tower with a rope set at face height; you pull the rope apart toward your eyes.' },
  pallof:        { mus: ['abs', 'obliques'], also: [], look: 'Cable tower with one handle at chest height; stand side-on and press it straight out without twisting.' },
  hipthrust:     { mus: ['glutes'], also: ['hamstrings'], look: 'A low seat with a padded belt across your hips (often labelled Glute Drive or Hip Thrust); you push your hips up.' },
  assistpull:    { mus: ['lats'], also: ['biceps', 'upper-back'], look: 'Tall frame with high handles and a knee pad or foot bar that pushes you up: the weight helps you.' },
  inclinepress:  { mus: ['chest', 'front-delts'], also: ['triceps'], look: 'Like the chest press, but the seat leans back so you push up and forward.' },
  cablecurl:     { mus: ['biceps'], also: ['forearms'], look: 'Cable tower with a short bar or handle at the bottom; you curl it up, palms up.' },
  pushdown:      { mus: ['triceps'], also: [], look: 'Cable tower with a rope or short bar at the top; you push it down to your thighs.' },
  deadbug:       { mus: ['abs'], also: ['obliques'], look: 'No machine: a mat on the floor.' },
  pecdeck:       { mus: ['chest'], also: ['front-delts'], look: 'Seated with two padded arms or handles out to your sides; you bring them together in front.' },
  reversefly:    { mus: ['rear-delts', 'upper-back'], also: [], look: 'The pec deck, sitting facing the pad: you push the handles back and apart.' },
  abductor:      { mus: ['abductors'], also: ['glutes'], look: 'Seated with pads on the outside of your knees; you push your knees apart. Same machine as hip adduction.' },
  adductor:      { mus: ['adductors'], also: [], look: 'Seated with pads on the inside of your knees; you squeeze your knees together.' },
  calfraise:     { mus: ['calves'], also: [], look: 'Shoulder pads or a seat over a step under the balls of your feet; you rise up onto your toes.' },
  smithsquat:    { mus: ['quads', 'glutes'], also: ['hamstrings', 'adductors', 'lower-back'], look: 'A barbell fixed on vertical rails, with safety stops; you squat under it.' },
  abcrunch:      { mus: ['abs'], also: ['obliques'], look: 'Seated with chest pads or handles by your head; you curl forward against the weight.' },
  backext:       { mus: ['lower-back'], also: ['glutes', 'hamstrings'], look: 'A 45° bench with ankle pads (or a seated machine); you hinge forward and lift your chest back up.' },
  bike:          { mus: [], also: ['quads', 'glutes', 'calves'], look: 'Any bike, or a treadmill at a walk.' },
  walk:          { mus: [], also: ['quads', 'calves'], look: 'A treadmill at an easy walk, then a few stretches.' },
  treadmill:     { mus: [], also: ['quads', 'hamstrings', 'calves'], look: 'A treadmill.' },
  ubike:         { mus: [], also: ['quads', 'glutes'], look: 'An upright or recumbent bike.' },
  elliptical:    { mus: [], also: ['quads', 'glutes', 'hamstrings'], look: 'Two long foot pedals and moving handles.' },
  stairs:        { mus: [], also: ['glutes', 'quads', 'calves'], look: 'A machine with moving steps.' },
  rower:         { mus: [], also: ['upper-back', 'lats', 'quads'], look: 'A long rail with a sliding seat, foot straps and a handle on a cord.' }
};
