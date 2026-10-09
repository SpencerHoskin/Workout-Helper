// DOM helpers shared by every view.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(msg, kind = 'good') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = 'toast'; }, 2200);
}

const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tiny celebratory burst for PRs. */
export function confetti() {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#3BF5A2', '#22D3EE', '#A78BFA', '#0C9B5F', '#0891B2', '#E9EFEC'];
  const parts = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: Math.random() * -14 - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0]
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (t - t0 < 2200) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

// Light sweep: when you press something, a diagonal laser band crosses it, its edge glows for a moment,
// and a trail of violet sparks lifts off behind the beam. It's drawn in a throwaway fixed layer sized to
// the element, so the element's own layout, clipping and pseudo-elements are never touched.
// Skipped entirely when the phone asks for reduced motion.
const SWEEP_TARGETS = '.btn, .cta, .chip, .rpe-chip, .repchip, .type, .wside, .stepper button, .icon-btn, .safety-btn, .seg a, .tabs a, .plan-row, .mrow, .xlist a, a.card, .pill-select, .sheet-x';
const SWEEP_MS = 1050;   // band crossing time; keep in step with .sweep-fx::before in app.css
export function sweep(e) {
  if (e.button > 0 || reducedMotion()) return;
  const el = e.target.closest && e.target.closest(SWEEP_TARGETS);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const wrap = document.createElement('span');
  wrap.className = 'sweep-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  Object.assign(wrap.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const fx = document.createElement('span');
  fx.className = 'sweep-fx';
  fx.style.borderRadius = getComputedStyle(el).borderRadius;
  wrap.appendChild(fx);
  // Sparks spawn where the beam is at that moment (left → right), then drift up and out of the element.
  const n = Math.max(8, Math.min(22, Math.round(r.width / 16)));
  for (let i = 0; i < n; i++) {
    const f = (i + Math.random() * 0.8) / n;
    const s = document.createElement('i');
    s.className = 'spark' + (Math.random() < 0.3 ? ' lite' : '');
    const size = 4 + Math.random() * 5;
    s.style.cssText = `--x:${(f * 100).toFixed(1)}%;--y:${(15 + Math.random() * 70).toFixed(1)}%;--s:${size.toFixed(1)}px;` +
      `--dx:${((Math.random() - 0.35) * 34).toFixed(0)}px;--dy:${(-12 - Math.random() * 34).toFixed(0)}px;` +
      `--d:${Math.round(120 + f * SWEEP_MS * 0.7)}ms;--t:${Math.round(650 + Math.random() * 450)}ms`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), SWEEP_MS + 1100); // after the last spark has faded
}

let audioCtx;
/** iOS only lets audio start inside a tap. Call this from the first tap so later beeps (scan, rest done) can play. */
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio support */ }
}

/** Short beep (rest timer done / code scanned). */
export function beep(freq = 880, ms = 140) {
  try {
    if (!audioCtx) unlockAudio();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(0.18, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + ms / 1000);
  } catch { /* audio is a nice-to-have */ }
  if (navigator.vibrate) navigator.vibrate(60);
}

/* ---------- Bottom sheet (modal) ---------- */
let onSheetClose = null;
let opener = null;
export function openSheet(html, { onClose } = {}) {
  const s = $('#sheet');
  if (!s.classList.contains('open')) opener = document.activeElement;
  $('#sheetBody').innerHTML = html;
  s.classList.add('open');
  s.setAttribute('aria-hidden', 'false');
  onSheetClose = onClose || null;
  const f = $('#sheetBody [autofocus]');
  if (f) setTimeout(() => f.focus(), 250);
}
export function closeSheet() {
  const s = $('#sheet');
  if (!s.classList.contains('open')) return;
  s.classList.remove('open');
  s.setAttribute('aria-hidden', 'true');
  const cb = onSheetClose; onSheetClose = null;
  if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
  opener = null;
  if (cb) cb();
}
export const sheetOpen = () => $('#sheet').classList.contains('open');
export const onSheetClosed = fn => { onSheetClose = fn; };

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
