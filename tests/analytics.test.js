import test from 'node:test';
import assert from 'node:assert/strict';
import { e1rm, linreg, forecast, weeklyCap, movingAverage, weightPoints, suggestNext, isPR, exerciseHistory, weekStats, weekStreak } from '../js/analytics.js';
import { dayNum, fromDayNum } from '../js/util.js';
import { EX } from '../js/catalog.js';

const ex = (id, extra = {}) => ({ id, kind: 'strength', sets: 3, reps: '10–12', inc: 5, ...EX[id], ...extra });
const day = (base, off) => fromDayNum(dayNum(base) + off);
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('e1rm (Epley) with sane edges', () => {
  close(e1rm(100, 10), 133.3333333);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 30), e1rm(100, 15)); // reps capped
  assert.equal(e1rm(0, 10), 0);
  assert.equal(e1rm(null, 10), 0);
});

test('linreg recovers an exact line', () => {
  const r = linreg([0, 1, 2, 3].map(x => ({ x, y: 2 * x + 5 })));
  close(r.slope, 2); close(r.intercept, 5); close(r.r2, 1);
  assert.equal(linreg([{ x: 1, y: 1 }]), null);
  assert.equal(linreg([{ x: 1, y: 1 }, { x: 1, y: 2 }]), null);
});

test('forecast needs enough signal', () => {
  assert.equal(forecast([{ x: 0, y: 1 }, { x: 7, y: 2 }]), null); // < 3 points
  assert.equal(forecast([{ x: 0, y: 1 }, { x: 2, y: 2 }, { x: 4, y: 3 }]), null); // < 7 days
});

test('forecast is anchored at the last real value (v1 bug B2)', () => {
  const pts = [{ x: 0, y: 100 }, { x: 7, y: 104 }, { x: 14, y: 105 }, { x: 21, y: 112 }];
  const f = forecast(pts);
  assert.deepEqual(f.from, { x: 21, y: 112 });
  close(f.to.y, 112 + f.perWeek / 7 * 56);
});

test('forecast caps the projected rate (v1 bug C1) but reports the raw trend', () => {
  const pts = [0, 7, 14, 21].map((x, i) => ({ x, y: 100 + i * 10 })); // +10/week
  const f = forecast(pts, { maxPerWeek: 5 });
  assert.equal(f.capped, true);
  close(f.perWeek, 5);
  close(f.rawPerWeek, 10);
  close(f.to.y, 130 + 5 * 8);
  assert.equal(forecast(pts, { maxPerWeek: 20 }).capped, false);
});

test('forecast ETA toward a target, and null when heading away', () => {
  const down = [0, 7, 14, 21].map((x, i) => ({ x, y: 180 - i })); // -1 lb/week
  const f = forecast(down, { target: 170 });
  assert.equal(f.eta, 21 + 49); // 7 lb to go at 1 lb/week = 49 days
  assert.equal(forecast(down, { target: 190 }).eta, null);
  assert.equal(forecast(down, { target: 177.2 }).eta, 21); // already there (within 0.5)
});

test('weeklyCap = one increment of working weight, in e1RM terms', () => {
  close(weeklyCap(ex('legpress'), 'e1rm'), 10 * (1 + 12 / 30));
  assert.equal(weeklyCap(ex('assistpull'), 'assist'), 5);
  assert.equal(weeklyCap(ex('deadbug'), 'reps'), null);
});

test('O(n) moving average matches the naive definition', () => {
  const pts = [];
  let x = 0;
  for (let i = 0; i < 200; i++) { x += 1 + (i * 7) % 4; pts.push({ x, y: 180 + Math.sin(i) * 3 }); }
  const naive = pts.map(p => { const w = pts.filter(q => q.x <= p.x && q.x > p.x - 7); return w.reduce((t, q) => t + q.y, 0) / w.length; });
  movingAverage(pts).forEach((p, i) => close(p.y, naive[i], 1e-9));
});

test('weightPoints averages same-day weigh-ins and skips blanks', () => {
  const pts = weightPoints([{ date: '2026-10-01', weight: 180 }, { date: '2026-10-01', weight: 182 }, { date: '2026-10-02', weight: null }, { date: '2026-10-03', weight: 179 }]);
  assert.deepEqual(pts.map(p => p.y), [181, 179]);
});

test('exerciseHistory merges two entries on the same day', () => {
  const log = [
    { date: '2026-10-01', exId: 'legpress', sets: [{ w: 100, r: 12 }] },
    { date: '2026-10-01', exId: 'legpress', sets: [{ w: 110, r: 10 }] },
    { date: '2026-10-03', exId: 'chestpress', sets: [{ w: 50, r: 10 }] }
  ];
  const h = exerciseHistory(log, ex('legpress'));
  assert.equal(h.length, 1);
  assert.equal(h[0].sets.length, 2);
  assert.equal(h[0].topW, 110);
  close(h[0].e1rm, Math.max(e1rm(100, 12), e1rm(110, 10)));
});

const hist = sets => [{ date: '2026-10-01', sets, maxRpe: Math.max(0, ...sets.map(s => s.rpe || 0)) || null }];

test('suggestNext: double progression, conservative', () => {
  const lp = ex('legpress');
  assert.match(suggestNext(lp, []).text, /First time/);
  const up = suggestNext(lp, hist([{ w: 100, r: 12, rpe: 6 }, { w: 100, r: 12, rpe: 7 }]));
  assert.equal(up.w, 110); assert.ok(up.up);
  const tooHard = suggestNext(lp, hist([{ w: 100, r: 12, rpe: 9 }]));
  assert.equal(tooHard.w, 90); assert.ok(tooHard.caution);
  const short = suggestNext(lp, hist([{ w: 100, r: 8, rpe: 8 }]));
  assert.equal(short.w, 100); assert.match(short.text, /Stay at 100/);
  const build = suggestNext(lp, hist([{ w: 100, r: 10, rpe: 6 }]));
  assert.equal(build.r, 11);
});

test('suggestNext: assisted machine removes assistance to progress', () => {
  const ap = ex('assistpull');
  assert.equal(suggestNext(ap, hist([{ w: 60, r: 10, rpe: 6 }])).w, 55);
  assert.equal(suggestNext(ap, hist([{ w: 60, r: 10, rpe: 9 }])).w, 65);
});

test('isPR', () => {
  const lp = ex('legpress');
  const h = hist([{ w: 100, r: 12 }]);
  assert.equal(isPR(lp, [], { w: 500, r: 1 }), null); // first time never counts
  assert.equal(isPR(lp, h, { w: 105, r: 8 }), 'Heaviest yet');
  assert.equal(isPR(lp, h, { w: 100, r: 13 }), 'Strength PR');
  assert.equal(isPR(lp, h, { w: 95, r: 12 }), null);
  assert.equal(isPR(ex('assistpull'), hist([{ w: 60, r: 9 }]), { w: 55, r: 8 }), 'Least assist yet');
});

test('weekStats and weekStreak', () => {
  const base = '2026-10-05'; // Monday
  const log = [];
  for (const w of [-3, -2, -1]) for (const d of [0, 2, 4]) log.push({ date: day(base, w * 7 + d), exId: 'legpress', sets: [{ w: 100, r: 10 }] });
  log.push({ date: day(base, 1), exId: 'legpress', sets: [{ w: 100, r: 10 }, { w: 100, r: 10 }] });
  const s = weekStats(log, [{ date: day(base, 2) }], day(base, 3));
  assert.deepEqual(s, { sessions: 1, sets: 2, volume: 2000, weighins: 1 });
  assert.equal(weekStreak(log, day(base, 3), 3), 3);
  assert.equal(weekStreak(log, day(base, 3), 1), 4); // this week already counts at goal 1
});
