// Vercel serverless function: POST /api/meal
// A photo of a meal, snack or nutrition label in, an itemised calorie/macro estimate out.
// Same lock as /api/coach: the app must send the coach passcode (x-coach-pass) — photos cost API credits.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { samePass } from './coach.js';

const MODEL = process.env.COACH_MODEL || 'claude-opus-5-5';
const MAX_IMAGE = 3_000_000;  // base64 chars (~2.2 MB JPEG); the app sends ~1024px photos, well under this
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MealEstimate = z.object({
  is_food: z.boolean().describe('false if the photo shows no food, drink or nutrition label.'),
  name: z.string().describe('Short meal title, e.g. "Chicken, rice & broccoli" (max ~5 words).'),
  items: z.array(z.object({
    name: z.string(),
    portion: z.string().describe('Estimated amount in everyday units, e.g. "~150 g", "1 cup", "2 slices".'),
    kcal: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
    sodium_mg: z.number().describe('Best estimate; 0 if negligible.'),
    confidence: z.enum(['low', 'medium', 'high'])
  })).describe('One entry per visible food; include likely hidden extras (cooking oil, butter, dressing) as their own item.'),
  kcal_low: z.number().describe('Low end of the plausible total.'),
  kcal_high: z.number().describe('High end of the plausible total.'),
  label_read: z.boolean().describe('true if the numbers come from a readable nutrition label.'),
  comment: z.string().describe('One short, friendly coaching line about this meal (protein, balance, sodium). No medical advice.')
});

export const MEAL_SYSTEM = `You estimate calories and macros from photos for "Kiln", a gym logbook app. The member photographs meals, snacks, drinks or nutrition labels.

- Identify each food and estimate its portion from visual cues (plate and cutlery size, packaging, hand size). Use typical restaurant/home preparation.
- Add likely hidden calories as separate items (cooking oil, butter, dressings, sauces, sugar in drinks) and mark them low confidence.
- Estimate sodium for every item: salt, sauces, cheese, bread, cured meats and restaurant or packaged food are the big sources.
- If a nutrition label is readable, use its numbers (scaled to the serving shown or stated) and set label_read true.
- Give a realistic total range in kcal_low/kcal_high (wider when portions are unclear). Item kcal should add up to roughly the middle of that range.
- If the member adds a note (portion eaten, ingredients, "half of it"), it overrides what you see.
- If the photo has no food or drink, set is_food false, return no items and explain briefly in comment.
- comment: one short, encouraging line. You are not a dietitian or doctor: no diets, supplements or medical advice.`;

export const MEAL_SYSTEM_MINE = `${MEAL_SYSTEM}
- This member is on a cardiologist-guided plan: estimate sodium carefully, and if a meal looks very salty (over ~1,000 mg) say so gently in comment. Do not give medical or diet-change advice.`;

function send(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json').setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  const pass = process.env.COACH_PASSCODE;
  if (!pass && process.env.COACH_ALLOW_OPEN !== '1') {
    return send(res, 503, { error: 'Photo estimates are locked: add COACH_PASSCODE in Vercel → Settings → Environment Variables, then redeploy.' });
  }
  if (pass && !samePass(req.headers['x-coach-pass'], pass)) {
    return send(res, 401, { error: 'Photo estimates need the coach passcode — set it in Me → Coach Claude setup.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return send(res, 500, { error: 'Server is missing ANTHROPIC_API_KEY. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body.image !== 'string' || !body.image) return send(res, 400, { error: 'Missing photo' });
  if (body.image.length > MAX_IMAGE) return send(res, 413, { error: 'Photo too large' });
  if (!/^[A-Za-z0-9+/]+=*$/.test(body.image)) return send(res, 400, { error: 'Photo is not base64' });
  const mediaType = TYPES.includes(body.media_type) ? body.media_type : 'image/jpeg';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';
  const mine = body.health_profile === 'mine';

  const client = new Anthropic();
  try {
    const msg = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(MealEstimate) },
      system: mine ? MEAL_SYSTEM_MINE : MEAL_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: body.image } },
          { type: 'text', text: note ? `Member's note: ${note}` : 'Estimate this.' }
        ]
      }]
    });

    if (msg.stop_reason === 'refusal') return send(res, 502, { error: 'Could not estimate this photo. Try another angle, or add it by hand.' });
    if (msg.stop_reason === 'max_tokens' || !msg.parsed_output) return send(res, 502, { error: 'The estimate was cut off — try again.' });

    return send(res, 200, { estimate: msg.parsed_output, model: msg.model, usage: msg.usage });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.' });
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Busy (rate limited). Try again in a minute.' });
    if (err instanceof Anthropic.BadRequestError) return send(res, 400, { error: 'The photo was rejected: ' + err.message });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: `Anthropic API error ${err.status ?? ''}`.trim() });
    console.error(err);
    return send(res, 500, { error: 'Photo estimate crashed — check the Vercel function logs.' });
  }
}
