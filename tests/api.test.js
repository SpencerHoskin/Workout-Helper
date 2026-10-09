import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { samePass, CoachReport, SYSTEM } from '../api/coach.js';

function call(method, body, headers = {}) {
  return new Promise(resolve => {
    const res = {
      code: 0, headers: {},
      status(c) { this.code = c; return this; },
      setHeader(k, v) { this.headers[k] = v; return this; },
      end(b) { resolve({ code: this.code, body: JSON.parse(b), headers: this.headers }); }
    };
    handler({ method, body, headers }, res);
  });
}
function env(vars) {
  for (const k of ['COACH_PASSCODE', 'COACH_ALLOW_OPEN', 'ANTHROPIC_API_KEY']) delete process.env[k];
  Object.assign(process.env, vars);
}

test('only POST', async () => {
  env({ COACH_PASSCODE: 'p' });
  assert.equal((await call('GET')).code, 405);
});

test('fails closed without a passcode (v1 bug S1)', async () => {
  env({ ANTHROPIC_API_KEY: 'sk-test' });
  const r = await call('POST', { snapshot: {} });
  assert.equal(r.code, 503);
  assert.match(r.body.error, /COACH_PASSCODE/);
});

test('wrong passcode is rejected', async () => {
  env({ COACH_PASSCODE: 'brother', ANTHROPIC_API_KEY: 'sk-test' });
  assert.equal((await call('POST', { snapshot: {} }, { 'x-coach-pass': 'nope' })).code, 401);
  assert.equal((await call('POST', { snapshot: {} })).code, 401);
});

test('missing API key gives a fix-it message (no network call)', async () => {
  env({ COACH_PASSCODE: 'brother' });
  const r = await call('POST', { snapshot: {} }, { 'x-coach-pass': 'brother' });
  assert.equal(r.code, 500);
  assert.match(r.body.error, /ANTHROPIC_API_KEY/);
  env({ COACH_ALLOW_OPEN: '1' });
  assert.equal((await call('POST', { snapshot: {} })).code, 500); // open mode skips the passcode
});

test('validates the body', async () => {
  env({ COACH_PASSCODE: 'brother', ANTHROPIC_API_KEY: 'sk-test' });
  const h = { 'x-coach-pass': 'brother' };
  assert.equal((await call('POST', {}, h)).code, 400);
  assert.equal((await call('POST', 'not json', h)).code, 400);
  assert.equal((await call('POST', { snapshot: { big: 'x'.repeat(200_000) } }, h)).code, 413);
});

test('samePass is exact', () => {
  assert.ok(samePass('brother', 'brother'));
  assert.ok(!samePass('brother', 'Brother'));
  assert.ok(!samePass(undefined, 'brother'));
});

test('report schema and safety prompt', () => {
  const ok = CoachReport.safeParse({
    headline: 'h', assessment: 'a', goal_forecast: { summary: 's', projected_date: '', confidence: 'low' },
    next_session: [{ exercise_id: 'legpress', exercise: 'Leg press', sets: 3, reps: '10–12', weight_lb: 120, note: '' }],
    four_week_plan: [], habits: [], safety_flags: [], questions_for_doctor: []
  });
  assert.ok(ok.success);
  assert.ok(!CoachReport.safeParse({ headline: 'h' }).success);
  for (const rule of ['RPE 5–7', 'cleared_limits', 'supplements', '911']) assert.ok(SYSTEM.includes(rule), rule);
});

test('coach prompt follows the app profile; older apps get the original', async () => {
  const { systemFor, SYSTEM_GENERAL } = await import('../api/coach.js');
  assert.equal(systemFor({ health_profile: 'mine' }), SYSTEM);
  assert.equal(systemFor({}), SYSTEM);
  assert.equal(systemFor({ health_profile: 'general' }), SYSTEM_GENERAL);
  assert.ok(!SYSTEM_GENERAL.includes('Brother'));
  assert.ok(!/cardiolog|bleeding/i.test(SYSTEM_GENERAL));
  for (const rule of ['RPE 5–7', 'supplements', '911', 'not their doctor']) assert.ok(SYSTEM_GENERAL.includes(rule), rule);
});
