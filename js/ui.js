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
  const colors = ['#FF5CA8', '#5B21FF', '#FF8A1F', '#22E4FF', getComputedStyle(document.body).color];  // last: page text (paper on dark, ink on light)
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

// Press effect: when you press something, a white bar wipes across it left to right and off the right edge,
// inverting it (mix-blend-mode: difference; the animation is .sweep-wrap in css/app.css). The bar is a throwaway
// span in a fixed layer sized to the element, so the element's own layout, clipping and pseudo-elements are never
// touched. It follows the element if the page scrolls, sits in the element's own layer (a sheet, the tab bar, the
// page), and is cleared the moment the screen changes (clearPress, called by app.js). If a re-render replaces the
// pressed page element, its bar is hidden (the new element may sit elsewhere). Skipped entirely when the phone asks
// for reduced motion.
export { reducedMotion };
const SWEEP_TARGETS = '.btn, .cta, .chip, .rpe-chip, .repchip, .type, .wside, .stepper button, .icon-btn, .safety-btn, .seg a, .tabs a, .plan-row, .mrow, .xlist a, a.card, .pill-select, .sheet-x';
const PRESS_MS = 340;              // matches the press animation in app.css
// Fixed layers the effect has to sit in (z-index from app.css). Page content gets 19: under the header and
// tab bar (20), so a row scrolling beneath them doesn't flash on top of them, and under any sheet (40).
const PRESS_LAYERS = [['#safety', 46], ['#sheet', 41], ['#rest', 26], ['.tabs', 21], ['.top', 21]];
const PAGE_LAYER = 19;
let pressGen = 0;
/** Drop every running press effect (the screen just changed under it). */
export function clearPress() {
  pressGen++;
  document.querySelectorAll('.sweep-wrap').forEach(w => w.remove());
}
export function sweep(e) {
  if (e.button > 0 || reducedMotion()) return;
  const el = e.target.closest && e.target.closest(SWEEP_TARGETS);
  if (!el || el.disabled) return;
  let r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const wrap = document.createElement('span');
  wrap.className = 'sweep-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  const layer = PRESS_LAYERS.find(([sel]) => el.closest(sel));
  const z = layer ? layer[1] : PAGE_LAYER;
  const place = rect => Object.assign(wrap.style, { left: rect.left + 'px', top: rect.top + 'px' });
  Object.assign(wrap.style, { width: r.width + 'px', height: r.height + 'px', zIndex: z,
    borderRadius: getComputedStyle(el).borderRadius });
  place(r);
  document.body.appendChild(wrap);
  const t0 = performance.now();
  const gen = pressGen;
  let done = false;
  const finish = () => { if (!done) { done = true; wrap.remove(); } };
  (function frame(now) {
    if (done) return;
    if (now - t0 >= PRESS_MS || gen !== pressGen) return finish();
    // Stay on the element if the page scrolled; hide if a re-render swapped the page element out.
    if (el.isConnected) { if ((r = el.getBoundingClientRect()).width) place(r); }
    else if (z === PAGE_LAYER) wrap.style.visibility = 'hidden';
    requestAnimationFrame(frame);
  })(t0);
  setTimeout(finish, PRESS_MS + 400); // in case frames stop (app backgrounded mid-press)
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
