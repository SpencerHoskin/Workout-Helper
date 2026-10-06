// Vercel serverless function: POST /api/coach
// Holds the Anthropic API key server-side (env ANTHROPIC_API_KEY) so it never reaches the phone.
// Optional env COACH_PASSCODE: when set, the app must send the same value in the x-coach-pass header.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const MODEL = process.env.COACH_MODEL || 'claude-opus-5-5';
const MAX_BODY = 100_000; // bytes — a year of training data is well under this

export const CoachReport = z.object({
  headline: z.string().describe('One punchy, encouraging line (max ~12 words).'),
  assessment: z.string().describe('2–4 sentences: what is going well, what is lagging, consistency.'),
  goal_forecast: z.object({
    summary: z.string().describe('Plain-English forecast toward the goal, with the main assumption.'),
    projected_date: z.string().describe('YYYY-MM-DD, or empty string if there is not enough data.'),
    confidence: z.enum(['low', 'medium', 'high'])
  }),
  next_session: z.array(z.object({
    exercise_id: z.string(),
    exercise: z.string(),
    sets: z.number(),
    reps: z.string().describe('e.g. "10–12", or minutes for cardio'),
    weight_lb: z.number().describe('0 for bodyweight or cardio'),
    note: z.string().describe('Why this target, cue, or seat/setup reminder.')
  })),
  four_week_plan: z.array(z.object({ week: z.number(), focus: z.string(), details: z.string() })),
  habits: z.array(z.string()).describe('Recovery, protein, sleep, consistency — specific and short.'),
  safety_flags: z.array(z.string()).describe('Anything in the data that needs caution. Empty if none.'),
  questions_for_doctor: z.array(z.string()).describe('Medical questions to bring to the cardiologist. Empty if none.')
});

export const SYSTEM = `You are Coach Claude, the strength coach inside the "5am Workout" app used at Crunch Fitness. The member likes being called "Brother" — keep it warm, upbeat and brief.

You get a JSON snapshot: the member's goal, their logged machines/exercises (sets as weight×reps@RPE, pounds), body-weight weigh-ins from the gym scale, adherence, notes, the app's own trend estimates, and their safety context. Analyze progress and forecast the best path to the goal.

Safety rules (non-negotiable — the member trains under a cardiologist's guidance with bleeding-risk precautions):
- Prescribe effort at RPE 5–7 (2–3 reps in reserve). Never prescribe max-effort lifts, 1RM tests, sets to failure, breath-holding/straining, plyometrics/box jumps, or heavy overhead free weights.
- Prefer machines and cables. Progress load by at most one increment (increment_lb) per exercise per week; hold or reduce if RPE hit 8+.
- Never exceed safety.cleared_limits. If they say "pending cardiologist", stay conservative and say clearance is still pending.
- Do not recommend supplements, medications or dose changes. Supplements not marked "ok" stay off.
- Weight change: no faster than about 1% of body weight per week; flag anything faster.
- If notes or data mention chest pain/pressure, dizziness, palpitations, unusual breathlessness, a head impact, black stools, or unusual muscle pain/dark urine: add a safety flag telling them to stop and contact their doctor (call 911 for chest pain).
- You are not their doctor. Medical questions go in questions_for_doctor.

Forecasting: ground dates in the trends in the data and say how confident you are. With little data, say exactly what to log to sharpen the forecast. Use exercise_id values from the snapshot. Weights are in pounds.`;

function send(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json').setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  const pass = process.env.COACH_PASSCODE;
  if (pass && req.headers['x-coach-pass'] !== pass) {
    return send(res, 401, { error: 'Wrong or missing coach passcode — set it in Me → Coach settings.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return send(res, 500, { error: 'Server is missing ANTHROPIC_API_KEY. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const raw = JSON.stringify(body || {});
  if (!body || typeof body.snapshot !== 'object') return send(res, 400, { error: 'Missing snapshot' });
  if (raw.length > MAX_BODY) return send(res, 413, { error: 'Snapshot too large' });

  const question = typeof body.question === 'string' ? body.question.slice(0, 500) : '';
  const client = new Anthropic();

  try {
    const msg = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(CoachReport) },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Training snapshot:\n${JSON.stringify(body.snapshot)}\n\n${question ? 'Member question: ' + question : 'Give me my analysis and forecast.'}`
      }]
    });

    if (msg.stop_reason === 'refusal') return send(res, 502, { error: 'Coach declined this request. Try rephrasing your question.' });
    if (msg.stop_reason === 'max_tokens' || !msg.parsed_output) return send(res, 502, { error: 'Coach reply was cut off — try again.' });

    return send(res, 200, { report: msg.parsed_output, model: msg.model, usage: msg.usage });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.' });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Coach is busy (rate limited). Try again in a minute.' });
    if (err instanceof Anthropic.BadRequestError) return send(res, 400, { error: 'Coach request was rejected: ' + err.message });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: `Anthropic API error ${err.status ?? ''}`.trim() });
    console.error(err);
    return send(res, 500, { error: 'Coach crashed — check the Vercel function logs.' });
  }
}
