// Meal photos: shrink on the phone before upload (fast on gym Wi-Fi, cheap to estimate), keep a tiny
// thumbnail for the food log, and ask /api/meal for the estimate.
import { getSettings, myHealth } from './store.js';

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(src, max, quality, square = false) {
  const w = src.width, h = src.height;
  let sx = 0, sy = 0, sw = w, sh = h;
  if (square) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; }
  const k = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
  c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/** → { upload: base64 JPEG (≤1024px), preview: data URL, thumb: ~112px square data URL } */
export async function preparePhoto(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('That file is not a photo.');
  let src;
  try { src = await decode(file); } catch { throw new Error('Could not open that photo. Try taking it again.'); }
  const preview = draw(src, 1024, 0.8);
  const thumb = draw(src, 112, 0.7, true);
  if (src.close) src.close();
  return { upload: preview.slice(preview.indexOf(',') + 1), preview, thumb };
}

/** The meal endpoint lives next to the coach one (same Vercel deploy). */
export const mealUrl = () => (getSettings().coachUrl || '/api/coach').replace(/coach\/?$/, 'meal');

export async function estimateMeal(upload, note = '') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  let res;
  try {
    res = await fetch(mealUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-coach-pass': getSettings().coachPass || '' },
      body: JSON.stringify({ image: upload, media_type: 'image/jpeg', note, health_profile: myHealth() ? 'mine' : 'general' }),
      signal: ctrl.signal
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'The estimate took too long — try again.' : 'Could not reach Coach Claude. Are you online?');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.estimate) throw new Error(data.error || `Estimate unavailable (HTTP ${res.status}).`);
  return data.estimate;
}
