import test from 'node:test';
import assert from 'node:assert/strict';
import { num, dayNum, fromDayNum, weekKey, normalizeCode, guessName, parseRepRange, safeUrl, csvCell, hashCode, esc } from '../js/util.js';

test('num parses phone-typed numbers', () => {
  assert.equal(num('100'), 100);
  assert.equal(num('100,5'), 100.5);
  assert.equal(num(' 82.4 '), 82.4);
  assert.equal(num(''), null);
  assert.equal(num('abc'), null);
  assert.equal(num(null), null);
  assert.equal(num(0), 0);
});

test('day numbers round-trip and weeks start on Monday', () => {
  for (const d of ['2026-01-01', '2026-02-28', '2026-10-06', '2028-02-29']) assert.equal(fromDayNum(dayNum(d)), d);
  assert.equal(dayNum('2026-10-07') - dayNum('2026-10-06'), 1);
  assert.equal(weekKey('2026-10-05'), '2026-10-05'); // Monday
  assert.equal(weekKey('2026-10-06'), '2026-10-05'); // Tuesday
  assert.equal(weekKey('2026-10-11'), '2026-10-05'); // Sunday belongs to the same week
  assert.equal(weekKey('2026-10-12'), '2026-10-12');
});

test('QR codes normalise so the same machine is recognised', () => {
  const a = normalizeCode('https://Equip.Example.com/v/leg-press/?utm_source=sticker');
  const b = normalizeCode('https://equip.example.com/v/leg-press');
  assert.equal(a, b);
  assert.notEqual(normalizeCode('https://x.com/a?id=1'), normalizeCode('https://x.com/a?id=2'));
  assert.equal(normalizeCode('  LEGPRESS-2 '), 'LEGPRESS-2');
  assert.equal(hashCode(a), hashCode(b));
});

test('machine names are guessed from the video URL', () => {
  assert.equal(guessName('https://example.com/crunch/seated-leg-press'), 'Seated Leg Press');
  assert.equal(guessName('https://example.com/cable_crossover/video'), 'Cable Crossover');
  assert.equal(guessName('https://example.com/v/12345'), '');
  assert.equal(guessName('not a url'), '');
});

test('rep ranges parse', () => {
  assert.deepEqual(parseRepRange('10–12'), [10, 12]);
  assert.deepEqual(parseRepRange('8-10'), [8, 10]);
  assert.deepEqual(parseRepRange('10 / side'), [10, 10]);
  assert.deepEqual(parseRepRange(''), [8, 12]);
});

test('safeUrl only allows http(s)', () => {
  assert.equal(safeUrl('https://youtu.be/x'), 'https://youtu.be/x');
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl(' JavaScript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,<b>'), '');
  assert.equal(safeUrl('legpress'), '');
  assert.equal(safeUrl(''), '');
});

test('csvCell quotes and neutralises formulas', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1 rep'), "'+1 rep");
  assert.equal(csvCell('-5'), '-5');
  assert.equal(csvCell(-5), '-5');
  assert.equal(csvCell('seat 4, pin 3'), '"seat 4, pin 3"');
  assert.equal(csvCell(null), '');
});

test('esc escapes HTML', () => {
  assert.equal(esc('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
});
