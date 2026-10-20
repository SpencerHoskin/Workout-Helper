import './helpers/storage.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { totals, dayTotals, lastDays, average, recentMeals } from '../js/nutrition.js';
import { KEYS, clearCache, getMeals, addMeal, updateMeal, deleteMeal, exportAll, importAll, getGoal } from '../js/store.js';
import { todayStr, dayNum, fromDayNum } from '../js/util.js';

const reset = () => { localStorage.clear(); clearCache(); };
const it = (kcal, p = 0, extra = {}) => ({ name: 'x', kcal, protein_g: p, carbs_g: 0, fat_g: 0, sodium_mg: 0, ...extra });

test('totals add up items and ignore junk', () => {
  assert.deepEqual(totals([it(250, 45), it(205.6, 4.4, { sodium_mg: 'oops' }), {}]), { kcal: 456, protein_g: 49, carbs_g: 0, fat_g: 0, sodium_mg: 0 });
  assert.equal(totals(null).kcal, 0);
});

test('day totals, last 7 days and averages over logged days only', () => {
  const t = todayStr(), y = fromDayNum(dayNum(t) - 1);
  const meals = [
    { id: 'a', date: t, ts: 2, name: 'Lunch', items: [it(600, 40)] },
    { id: 'b', date: t, ts: 1, name: 'Breakfast', items: [it(400, 30)] },
    { id: 'c', date: y, ts: 0, name: 'Dinner', items: [it(800, 50)] }
  ];
  assert.deepEqual([dayTotals(meals, t).kcal, dayTotals(meals, t).meals], [1000, 2]);
  const days = lastDays(meals, t, 7);
  assert.equal(days.length, 7);
  assert.equal(days[6].date, t);
  assert.equal(days[0].kcal, 0);
  const avg = average(days);
  assert.deepEqual([avg.days, avg.kcal, avg.protein_g], [2, 900, 60]);   // empty days don't drag the average down
  assert.equal(average(lastDays([], t)), null);
  assert.deepEqual(recentMeals(meals).map(m => m.name), ['Lunch', 'Breakfast', 'Dinner']);
});

test('meals are stored, edited, deleted and backed up', () => {
  reset();
  const m = addMeal({ name: 'Oats', items: [it(350, 12)], source: 'hand' });
  assert.equal(getMeals().length, 1);
  assert.equal(m.date, todayStr());
  updateMeal(m.id, { name: 'Overnight oats' });
  assert.equal(getMeals()[0].name, 'Overnight oats');
  const backup = exportAll();
  assert.equal(backup.data[KEYS.meals].length, 1);
  deleteMeal(m.id);
  assert.equal(getMeals().length, 0);
  importAll(backup);
  assert.equal(getMeals()[0].name, 'Overnight oats');
  assert.throws(() => importAll({ app: '5am-workout', data: { [KEYS.meals]: [{ date: 1 }] } }), /food log/);
});

test('photo thumbnails are dropped after two weeks; the numbers stay', () => {
  reset();
  const old = fromDayNum(dayNum(todayStr()) - 20);
  localStorage.setItem(KEYS.meals, JSON.stringify([{ id: 'o', date: old, ts: 1, name: 'Old', items: [it(500)], thumb: 'data:image/jpeg;base64,AAA' }]));
  addMeal({ name: 'New', items: [it(300)], thumb: 'data:image/jpeg;base64,BBB' });
  const [a, b] = getMeals();
  assert.equal(a.thumb, null);
  assert.equal(a.items[0].kcal, 500);
  assert.ok(b.thumb);
});

test('daily targets default to blank', () => {
  reset();
  assert.equal(getGoal().kcalTarget, '');
  assert.equal(getGoal().proteinTarget, '');
});
