// Coach Claude client: builds a compact training snapshot and asks the /api/coach function.
import { SESSIONS, DAYS, SUPPS, PENDING } from './catalog.js';
import { KEYS, load, save, getLog, getGoal, getSettings, getWeighins, allExercises, getChecklist, getLimits, getSupps, getDaily } from './store.js';
import { exerciseHistory, forecast, weightPoints, movingAverage, suggestNext, weekStats } from './analytics.js';
import { todayStr, dayNum, fromDayNum, weekKey } from './util.js';

const fmtSet = s => s.min ? `${s.min} min${s.rpe ? ' @' + s.rpe : ''}` : `${s.w ?? 'BW'}x${s.r ?? '?'}${s.rpe ? '@' + s.rpe : ''}`;

export function buildSnapshot() {
  const log = getLog();
  const goal = getGoal();
  const exs = allExercises();
  const today = todayStr();
  const limits = getLimits();
  const suppSt = getSupps();

  const exercises = [];
  for (const id of [...new Set(log.map(e => e.exId))]) {
    const ex = exs[id];
    if (!ex) continue;
    const hist = exerciseHistory(log, ex);
    const cardio = log.filter(e => e.exId === id && ex.kind === 'cardio').slice(-6);
    const fc = forecast(hist.map(h => ({ x: h.x, y: ex.assisted ? h.assist : h.e1rm })));
    exercises.push({
      id, name: ex.name, kind: ex.kind, rep_range: ex.reps || null, increment_lb: ex.inc || null,
      assisted: !!ex.assisted,
      recent_sessions: ex.kind === 'cardio'
        ? cardio.map(e => ({ date: e.date, sets: e.sets.map(fmtSet).join(', ') }))
        : hist.slice(-8).map(h => ({ date: h.date, sets: h.sets.map(fmtSet).join(', '), e1rm_lb: Math.round(h.e1rm) })),
      trend_per_week_lb: fc ? +fc.perWeek.toFixed(2) : null,
      app_suggestion: suggestNext(ex, hist).text
    });
  }

  const wpts = weightPoints(getWeighins());
  const recentW = wpts.filter(p => p.x >= dayNum(today) - 120);
  const avg = movingAverage(recentW);
  const wfc = forecast(avg, { target: goal.targetWeight || null, windowDays: 42 });
  const weighins = getWeighins().filter(w => dayNum(w.date) >= dayNum(today) - 120).slice(-60)
    .map(w => ({ date: w.date, lb: w.weight, ...(w.bodyFat ? { body_fat_pct: w.bodyFat } : {}), ...(w.muscle ? { muscle_lb: w.muscle } : {}), source: w.source }));

  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const d = fromDayNum(dayNum(weekKey(today)) - i * 7);
    weeks.push({ week_of: d, sessions: weekStats(log, [], d).sessions });
  }

  const notes = log.filter(e => e.note).slice(-10).map(e => ({ date: e.date, exercise: exs[e.exId]?.name || e.exId, note: e.note }));
  const daily = getDaily();
  Object.keys(daily).sort().slice(-7).forEach(d => { if (daily[d].note) notes.push({ date: d, exercise: 'daily', note: daily[d].note }); });

  return {
    app: '5am Workout', gym: getSettings().gymName, today, units: 'lb',
    goal: {
      type: goal.type, target_weight_lb: goal.targetWeight || null, target_date: goal.targetDate || null,
      sessions_per_week: goal.sessionsPerWeek, strength_goal: goal.strengthTarget ? { exercise_id: goal.strengthEx, target_lb: +goal.strengthTarget } : null,
      why: goal.why
    },
    safety: {
      cleared_limits: { load: limits.load || PENDING, intensity: limits.intensity || PENDING, other: limits.other || PENDING },
      supplements: Object.fromEntries(SUPPS.map(s => [s.name, suppSt[s.id] || s.def])),
      open_doctor_questions: getChecklist().filter(c => !c.done).map(c => c.text)
    },
    plan: Object.fromEntries(Object.entries(SESSIONS).map(([k, s]) => [k, { day: DAYS[s.day], exercise_ids: s.ex }])),
    exercises,
    bodyweight: {
      weighins,
      avg7_lb: avg.length ? +avg[avg.length - 1].y.toFixed(1) : null,
      trend_per_week_lb: wfc ? +wfc.perWeek.toFixed(2) : null,
      app_eta_to_goal: wfc && wfc.etaDate
    },
    adherence_last_8_weeks: weeks,
    recent_notes: notes
  };
}

export async function askCoach(question = '') {
  const s = getSettings();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150000);
  let res;
  try {
    res = await fetch(s.coachUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-coach-pass': s.coachPass || '' },
      body: JSON.stringify({ snapshot: buildSnapshot(), question }),
      signal: ctrl.signal
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Coach took too long — try again.' : 'Could not reach Coach Claude. Are you online, and is the app deployed on Vercel?');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.report) throw new Error(data.error || `Coach unavailable (HTTP ${res.status}).`);
  const saved = { ts: Date.now(), report: data.report, model: data.model, question };
  save(KEYS.coach, saved);
  return saved;
}

/** Last saved report — only if it has the shape the screens render (guards old/corrupt data). */
export function lastCoach() {
  const c = load(KEYS.coach, null);
  const r = c && c.report;
  const ok = r && typeof r.headline === 'string' && r.goal_forecast && typeof r.goal_forecast === 'object' &&
    ['next_session', 'four_week_plan', 'habits', 'safety_flags', 'questions_for_doctor'].every(k => Array.isArray(r[k]));
  return ok ? c : null;
}

/** Zero-setup fallback: paste this into the Claude app. */
export function promptText(question = '') {
  return `You're my strength coach. Call me Brother. I'm training at ${getSettings().gymName} and follow a cardiologist-guided plan: keep effort at RPE 5–7, machines/cables over free weights, no max-effort lifts, no breath-holding, no supplement advice.

Analyze my data below and forecast the best path to my goal: (1) honest assessment, (2) forecast with a date and confidence, (3) exact weight × reps for each exercise next session, (4) a 4-week plan, (5) habits, (6) any safety flags or questions for my doctor.
${question ? '\nMy question: ' + question + '\n' : ''}
DATA (JSON):
${JSON.stringify(buildSnapshot(), null, 1)}`;
}
