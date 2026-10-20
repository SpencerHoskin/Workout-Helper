// Food log maths: pure functions over the meals array (see KEYS.meals in store.js).
import { dayNum, fromDayNum } from './util.js';

const N = v => (Number.isFinite(+v) ? +v : 0);
const FIELDS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg'];

/** Sum of a meal's items (or of several meals' items). */
export function totals(items) {
  const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, sodium_mg: 0 };
  for (const it of items || []) for (const f of FIELDS) t[f] += N(it[f]);
  for (const f of FIELDS) t[f] = Math.round(t[f]);
  return t;
}
export const mealTotals = m => totals(m.items);

export const mealsOn = (meals, date) => meals.filter(m => m.date === date).sort((a, b) => a.ts - b.ts);

export function dayTotals(meals, date) {
  const list = mealsOn(meals, date);
  return { ...totals(list.flatMap(m => m.items || [])), meals: list.length };
}

/** The last n days ending on `end` (oldest first), with totals; days with nothing logged have meals: 0. */
export function lastDays(meals, end, n = 7) {
  const e = dayNum(end);
  return Array.from({ length: n }, (_, i) => { const d = fromDayNum(e - (n - 1 - i)); return { date: d, ...dayTotals(meals, d) }; });
}

/** Averages over the logged days only (a day with no meals logged says nothing about intake). */
export function average(days) {
  const logged = days.filter(d => d.meals > 0);
  if (!logged.length) return null;
  const out = { days: logged.length };
  for (const f of FIELDS) out[f] = Math.round(logged.reduce((t, d) => t + d[f], 0) / logged.length);
  return out;
}

/** Recent distinct meals (by name), newest first — one tap to log the same thing again. */
export function recentMeals(meals, n = 6) {
  const seen = new Set(), out = [];
  for (const m of [...meals].sort((a, b) => b.ts - a.ts)) {
    const k = (m.name || '').trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(m);
    if (out.length >= n) break;
  }
  return out;
}
