// Pure training math: strength estimates, trends, forecasts, progression. No DOM/storage.
import { dayNum, fromDayNum, weekKey, parseRepRange, roundTo } from './util.js';

/** Estimated 1-rep max (Epley). Reps capped at 15 where the formula stops meaning much. */
export function e1rm(w, r) {
  if (!(w > 0) || !(r > 0)) return 0;
  if (r === 1) return w;
  return w * (1 + Math.min(r, 15) / 30);
}

const working = sets => (sets || []).filter(s => s && s.r > 0);

/** One point per training day for an exercise. Metric: e1RM, or top assist weight for assisted moves. */
export function exerciseHistory(log, ex) {
  const byDate = new Map();
  for (const e of log) {
    if (e.exId !== ex.id) continue;
    const prev = byDate.get(e.date) || [];
    byDate.set(e.date, prev.concat(working(e.sets)));
  }
  const out = [];
  for (const [date, sets] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!sets.length) continue;
    const rpes = sets.map(s => s.rpe).filter(v => v > 0);
    const top = sets.reduce((best, s) => (e1rm(s.w, s.r) > e1rm(best.w, best.r) ? s : best), sets[0]);
    out.push({
      date,
      x: dayNum(date),
      sets,
      topW: Math.max(...sets.map(s => s.w || 0)),
      topSet: top,
      e1rm: Math.max(...sets.map(s => e1rm(s.w, s.r))),
      volume: sets.reduce((t, s) => t + (s.w || 0) * (s.r || 0), 0),
      reps: sets.reduce((t, s) => t + (s.r || 0), 0),
      maxRpe: rpes.length ? Math.max(...rpes) : null,
      // assisted: lowest assistance that still hit the bottom of the rep range
      assist: ex.assisted ? Math.min(...sets.filter(s => s.r >= parseRepRange(ex.reps)[0]).map(s => s.w || 0).concat([Infinity])) : null
    });
  }
  return out;
}

/** Least-squares line. Returns null with < 2 points or zero x-variance. */
export function linreg(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((t, p) => t + p.x, 0) / n;
  const my = points.reduce((t, p) => t + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n, at: x => intercept + slope * x };
}

/**
 * Trend + projection, anchored at your latest real value (not the regression line).
 * Needs ≥3 points spanning ≥7 days, otherwise null (not enough signal).
 *  target      optional y → eta (dayNum) when the projection reaches it, if heading that way
 *  maxPerWeek  optional cap on the projected rate (e.g. one safe load increment per week)
 */
export function forecast(points, { horizonDays = 56, target = null, windowDays = 56, maxPerWeek = null } = {}) {
  if (points.length < 3) return null;
  const last = points[points.length - 1];
  const recent = points.filter(p => p.x >= last.x - windowDays);
  const use = recent.length >= 3 ? recent : points.slice(-3);
  if (use[use.length - 1].x - use[0].x < 7) return null;
  const reg = linreg(use);
  if (!reg) return null;
  let slope = reg.slope;
  const capped = maxPerWeek != null && Math.abs(slope * 7) > maxPerWeek;
  if (capped) slope = Math.sign(slope) * maxPerWeek / 7;
  const from = { x: last.x, y: last.y };
  const at = x => from.y + slope * (x - from.x);
  let eta = null;
  if (target != null) {
    const gap = target - from.y;
    if (Math.abs(gap) < 0.5) eta = from.x;
    else if (slope !== 0 && gap * slope > 0 && gap / slope < 3 * 365) eta = Math.round(from.x + gap / slope);
  }
  return {
    perWeek: slope * 7,
    rawPerWeek: reg.slope * 7,
    capped,
    r2: reg.r2,
    n: use.length,
    from,
    to: { x: from.x + horizonDays, y: at(from.x + horizonDays) },
    eta,
    etaDate: eta != null ? fromDayNum(eta) : null
  };
}

/** Safe projected strength gain: one load increment per week, expressed in the chart's metric. */
export function weeklyCap(ex, metric) {
  if (metric === 'e1rm') return (ex.inc || 5) * (1 + parseRepRange(ex.reps)[1] / 30);
  if (metric === 'assist') return ex.inc || 5;
  return null;
}

/** Trailing moving average by calendar window (default 7 days) — smooths scale noise. O(n), points sorted by x. */
export function movingAverage(points, windowDays = 7) {
  const out = [];
  let lo = 0, sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i].y;
    while (points[lo].x <= points[i].x - windowDays) sum -= points[lo++].y;
    out.push({ x: points[i].x, y: sum / (i - lo + 1) });
  }
  return out;
}

/** Daily bodyweight points (multiple weigh-ins on one day are averaged). */
export function weightPoints(weighins) {
  const byDay = new Map();
  for (const w of weighins) {
    if (!(w.weight > 0)) continue;
    const a = byDay.get(w.date) || [];
    a.push(w.weight);
    byDay.set(w.date, a);
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ws]) => ({ x: dayNum(date), y: ws.reduce((t, v) => t + v, 0) / ws.length, date }));
}

/**
 * Double progression, tuned conservative (RPE 5–7 ceiling):
 * hit the top of the rep range on every set at RPE ≤7 → add one increment; RPE 9+ → back off ~10%.
 */
export function suggestNext(ex, history) {
  const [lo, hi] = parseRepRange(ex.reps);
  const inc = ex.inc || 5;
  if (ex.kind === 'cardio') return { text: ex.target || 'Easy–moderate, talk-test pace', w: null, r: null };
  if (!history.length) {
    return { w: null, r: lo, text: `First time — pick a weight that feels like RPE 5–6 for ${ex.reps} reps.`, why: 'Start light, learn the machine, set the seat.' };
  }
  const last = history[history.length - 1];
  const sets = last.sets;
  const w = ex.kind === 'bodyweight' ? null : Math.max(...sets.map(s => s.w || 0));
  const allTop = sets.length > 0 && sets.every(s => s.r >= hi);
  const anyLow = sets.some(s => s.r < lo);
  const rpe = last.maxRpe;

  if (ex.kind === 'bodyweight') {
    return allTop ? { r: hi, text: `Own all ${hi} reps — slow it down (3 sec lowering).`, why: 'Top of range hit; make it harder with tempo, not load.' }
                  : { r: Math.min(hi, Math.max(...sets.map(s => s.r)) + 1), text: `Aim for ${Math.min(hi, Math.max(...sets.map(s => s.r)) + 1)} reps per set.`, why: 'Build reps first.' };
  }
  if (rpe >= 9) {
    const nw = ex.assisted ? w + inc : Math.max(0, roundTo(w * 0.9, 5));
    return { w: nw, r: lo, text: `Back off to ${nw} lb × ${lo}–${hi}.`, why: 'Last time hit RPE 9+. Stay around RPE 6–7.', caution: true };
  }
  if (allTop && (rpe == null || rpe <= 7)) {
    const nw = ex.assisted ? Math.max(0, w - inc) : w + inc;
    return { w: nw, r: lo, text: `${ex.assisted ? 'Less assist' : 'Add ' + inc + ' lb'} → ${nw} lb × ${lo}–${hi}.`, why: 'You hit the top of the range on every set at a comfortable effort.', up: true };
  }
  if (anyLow && rpe >= 8) {
    return { w, r: lo, text: `Stay at ${w} lb and get every set to ${lo}+ reps.`, why: 'Some sets fell short and it felt hard — consolidate first.' };
  }
  const target = Math.min(hi, Math.max(...sets.map(s => s.r || 0)) + 1);
  return { w, r: target, text: `Stay at ${w} lb, aim for ${target} reps.`, why: 'Build reps first, then add weight.' };
}

/** Did this set beat everything before it? */
export function isPR(ex, history, set) {
  if (ex.kind !== 'strength' || !(set.w > 0) || !(set.r > 0) || !history.length) return null;
  const prior = history.flatMap(h => h.sets);
  if (!prior.length) return null;
  if (ex.assisted) {
    const lo = parseRepRange(ex.reps)[0];
    const best = Math.min(...prior.filter(s => s.r >= lo).map(s => s.w || Infinity));
    return set.r >= lo && set.w < best ? 'Least assist yet' : null;
  }
  const bestE = Math.max(...prior.map(s => e1rm(s.w, s.r)));
  const bestW = Math.max(...prior.map(s => s.w || 0));
  if (set.w > bestW) return 'Heaviest yet';
  if (e1rm(set.w, set.r) > bestE + 0.01) return 'Strength PR';
  return null;
}

/** Sessions (distinct days with a logged set), sets and weigh-ins in the week containing `date`. */
export function weekStats(log, weighins, date) {
  const wk = weekKey(date);
  const days = new Set();
  let sets = 0, volume = 0;
  for (const e of log) {
    if (weekKey(e.date) !== wk) continue;
    const ws = working(e.sets);
    if (ws.length || (e.sets || []).some(s => s.min > 0)) days.add(e.date);
    sets += (e.sets || []).length;
    volume += ws.reduce((t, s) => t + (s.w || 0) * (s.r || 0), 0);
  }
  const wi = weighins.filter(w => weekKey(w.date) === wk).length;
  return { sessions: days.size, sets, volume, weighins: wi };
}

/** Consecutive weeks (ending last week, plus this week if already met) that hit the sessions goal. */
export function weekStreak(log, date, goal) {
  const perWeek = new Map();
  for (const e of log) {
    const k = weekKey(e.date);
    if (!perWeek.has(k)) perWeek.set(k, new Set());
    perWeek.get(k).add(e.date);
  }
  const thisWeek = dayNum(weekKey(date));
  let streak = 0;
  for (let w = thisWeek - 7; ; w -= 7) {
    const s = perWeek.get(fromDayNum(w));
    if (s && s.size >= goal) streak++;
    else break;
  }
  const cur = perWeek.get(fromDayNum(thisWeek));
  if (cur && cur.size >= goal) streak++;
  return streak;
}
