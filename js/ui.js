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

/* ---------- Which phone ---------- */
// 'ios' | 'android' | 'other'. iPadOS reports itself as a Mac, so a touch "Mac" counts as iOS.
export const PLATFORM = (() => {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
})();
/** Running as the installed home-screen app (not in a browser tab)? */
export const standalone = () => navigator.standalone === true ||
  !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches);

// Android/Chrome offers its own install dialog; we hold on to it until you tap "Install Kiln".
let installEvt = null;
export const canPromptInstall = () => !!installEvt;
export function setInstallPrompt(e) { installEvt = e; }
export async function promptInstall() {
  if (!installEvt) return false;
  const e = installEvt;
  installEvt = null; // the browser only lets each prompt be used once
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return !!(choice && choice.outcome === 'accepted');
}

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

// Pixel press: when you press something, a grid of tiny purple squares fills it left to right, sparse and pale
// at the start and dense and deep at the end (like the Ultracode effort slider), while a white shimmer runs
// through the squares. It's painted on a throwaway canvas in a fixed layer sized and rounded to the element,
// so the element's own layout, clipping and pseudo-elements are never touched.
// Skipped entirely when the phone asks for reduced motion.
const SWEEP_TARGETS = '.btn, .cta, .chip, .rpe-chip, .repchip, .type, .wside, .stepper button, .icon-btn, .safety-btn, .seg a, .tabs a, .plan-row, .mrow, .xlist a, a.card, .pill-select, .sheet-x';
const PIX_MS = 850;                // whole effect, fill → shimmer → fade
const PIX_CELL = 4, PIX_PITCH = 5; // 4px squares on a 5px grid
const PIX_SHADES = [[221, 214, 254], [196, 181, 253], [167, 139, 250], [139, 92, 246], [124, 58, 237], [109, 40, 217]];
export function sweep(e) {
  if (e.button > 0 || reducedMotion()) return;
  const el = e.target.closest && e.target.closest(SWEEP_TARGETS);
  if (!el || el.disabled) return;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const wrap = document.createElement('span');
  wrap.className = 'sweep-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  Object.assign(wrap.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
    borderRadius: getComputedStyle(el).borderRadius });
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  c.width = Math.ceil(r.width * dpr); c.height = Math.ceil(r.height * dpr);
  wrap.appendChild(c);
  document.body.appendChild(wrap);
  const ctx = c.getContext('2d');
  if (!ctx) { wrap.remove(); return; }
  ctx.scale(dpr, dpr);
  const w = r.width, h = r.height;
  const cols = Math.ceil(w / PIX_PITCH), rows = Math.ceil(h / PIX_PITCH);
  const ox = (w - cols * PIX_PITCH + 1) / 2, oy = (h - rows * PIX_PITCH + 1) / 2;
  const cells = [];
  for (let i = 0; i < cols; i++) {
    const f = cols > 1 ? i / (cols - 1) : 1;      // 0 at the left edge, 1 at the right
    for (let j = 0; j < rows; j++) {
      if (Math.random() > 0.05 + 0.9 * f ** 1.6) continue; // a scatter on the left, packed on the right
      const deep = Math.min(PIX_SHADES.length - 1, Math.floor((f * 0.75 + Math.random() * 0.45) * PIX_SHADES.length));
      cells.push({ x: ox + i * PIX_PITCH, y: oy + j * PIX_PITCH, f, rgb: PIX_SHADES[deep],
        a: 0.2 + 0.65 * f + Math.random() * 0.15, lag: Math.random() * 0.08, tw: Math.random() * 6.28, tws: 9 + Math.random() * 14 });
    }
  }
  const t0 = performance.now();
  let done = false;
  const finish = () => { if (!done) { done = true; wrap.remove(); } };
  (function frame(now) {
    if (done) return;
    const p = (now - t0) / PIX_MS;
    if (p >= 1) return finish();
    const front = Math.min(1, p / 0.38) ** 0.7 * 1.08;     // fill front, eased, slight overshoot past the edge
    const runner = -0.25 + (p - 0.12) / 0.62 * 1.5;        // white shimmer crossing left → right
    const fade = p < 0.72 ? 1 : 1 - (p - 0.72) / 0.28;
    ctx.clearRect(0, 0, w, h);
    for (const q of cells) {
      const on = (front - q.f - q.lag) / 0.08;
      if (on <= 0) continue;
      const d = (q.f - runner) / 0.11;
      let white = Math.exp(-d * d) * (0.55 + 0.45 * Math.sin(q.tw + now / 60));
      const tw = Math.sin(q.tw + now / 1000 * q.tws);
      if (tw > 0.93) white = Math.max(white, (tw - 0.93) / 0.07); // the odd square twinkles white on its own
      const [R, G, B] = q.rgb;
      const k = Math.min(1, white);
      ctx.globalAlpha = Math.min(1, on) * fade * Math.min(1, q.a + k * 0.5);
      ctx.fillStyle = `rgb(${Math.round(R + (255 - R) * k)},${Math.round(G + (255 - G) * k)},${Math.round(B + (255 - B) * k)})`;
      ctx.fillRect(q.x, q.y, PIX_CELL, PIX_CELL);
    }
    requestAnimationFrame(frame);
  })(t0);
  setTimeout(finish, PIX_MS + 600); // in case frames stop (app backgrounded mid-press)
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

/* ---------- Pop-ups and the Back button ---------- */
// Android's Back gesture (and the browser's back button) should close the pop-up on top, not leave the
// screen under it, which used to lose a half-typed weigh-in. So each open pop-up sits on its own history
// entry with the same URL: Back pops it and app.js closes the pop-up. Closing it any other way (X, Escape,
// tapping outside, saving) drops that entry again.
const LAYER = 'kilnLayer';
export const onLayerEntry = () => !!(history.state && history.state[LAYER]);
const layerOpen = () => sheetOpen() || !!($('#safety') && !$('#safety').hidden);
export function pushLayer() {
  if (!onLayerEntry()) history.pushState({ [LAYER]: 1 }, '', location.href);
}
export function dropLayer() {
  // Deferred, so a close followed straight away by navigation (go() takes over the entry) or by another
  // pop-up (which reuses it) leaves history alone.
  setTimeout(() => { if (onLayerEntry() && !layerOpen()) history.back(); }, 0);
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
  pushLayer();
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
  dropLayer();
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
