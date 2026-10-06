// Pure helpers — no DOM, no storage. Safe to import from tests (node --test).

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Parse user-typed numbers ("100", "100.5", "100,5", 100). Returns null when empty/invalid. */
export function num(v) {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export const pad2 = n => String(n).padStart(2, '0');

/** Local-time YYYY-MM-DD. */
export function dateStr(d = new Date()) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
export const todayStr = () => dateStr(new Date());

/** Whole days since 1970-01-01 for a YYYY-MM-DD string (timezone-free arithmetic). */
export function dayNum(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
export function fromDayNum(n) {
  const d = new Date(n * 86400000);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(s) {
  const [, m, d] = s.split('-').map(Number);
  return MONTHS[m - 1] + ' ' + d;
}

/** Monday-based week key (YYYY-MM-DD of that Monday). */
export function weekKey(s) {
  const n = dayNum(s);
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7; // Mon=0
  return fromDayNum(n - dow);
}

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** FNV-1a 32-bit → base36. Stable short id for a scanned QR payload. */
export function hashCode(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** Canonical form of a QR payload so tiny URL differences don't create duplicate machines. */
export function normalizeCode(raw) {
  const s = String(raw || '').trim();
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return s;
    [...u.searchParams.keys()].filter(k => /^utm_/i.test(k)).forEach(k => u.searchParams.delete(k));
    let path = u.pathname.replace(/\/+$/, '');
    return u.host.toLowerCase() + path + (u.search || '');
  } catch {
    return s;
  }
}

/** Best-effort machine name from a QR URL ("…/videos/seated-leg-press?x" → "Seated Leg Press"). */
export function guessName(raw) {
  try {
    const u = new URL(String(raw).trim());
    const parts = u.pathname.split('/').filter(Boolean).reverse();
    const seg = parts.find(p => /[a-z]{3,}/i.test(p) && !/^(qr|video|videos|v|watch|exercise|exercises|equipment)$/i.test(p));
    if (!seg) return '';
    return decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i, '').replace(/[-_+]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()).slice(0, 40);
  } catch {
    return '';
  }
}

export const isUrl = s => /^https?:\/\//i.test(String(s || '').trim());

/** "10–12" → [10, 12]; "8 / side" → [8, 8]; "12" → [12, 12]. */
export function parseRepRange(reps) {
  const m = String(reps || '').match(/(\d+)\s*(?:[–-]\s*(\d+))?/);
  if (!m) return [8, 12];
  const lo = +m[1];
  return [lo, m[2] ? +m[2] : lo];
}

export const roundTo = (v, step) => Math.round(v / step) * step;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const fmtNum = (v, dp = 1) => v == null ? '–' : (Math.round(v * 10 ** dp) / 10 ** dp).toLocaleString();
