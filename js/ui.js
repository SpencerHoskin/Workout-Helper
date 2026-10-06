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
  const colors = ['#ff8a3d', '#ff4f8b', '#8b5cf6', '#3b82f6', '#22d3ee', '#a3e635', '#facc15'];
  const parts = Array.from({ length: 120 }, () => ({
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
