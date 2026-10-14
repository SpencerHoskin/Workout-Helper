// The weight dial: a big wheel whose centre sits off the box's bottom-right corner, so the box shows a sweep of
// its rim. Drag along the rim (up and right = heavier), flick it to spin, tap a number on the rim to jump to it.
// It snaps to the nearest step; the number under the pointer is the weight. The readout is the real <input>
// (type into it to set the weight). Colours come from the theme's --dial-* tokens (css/app.css).
// Only a band around the rim (.wring) takes touches: a thumb anywhere else on the box scrolls the page, so
// scrolling past the dial never changes the weight. The field is only written by a real turn or a number tap.

import { num } from './util.js';

const DEG = Math.PI / 180, STEP_ANG = 6.5 * DEG;   // one weight step = 6.5° of wheel
const MAX = 1000;
const fmt = w => String(Math.round(w * 10) / 10);
const norm = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const TOKENS = ['band-a', 'band-b', 'rim', 'core', 'tick', 'tick-dim', 'num', 'hi', 'prog', 'track'];

export function arcDial(wrap) {
  const cv = wrap.querySelector('canvas'), ring = wrap.querySelector('.wring'), input = wrap.querySelector('input');
  const ctx = cv.getContext('2d');
  const step = Number(wrap.dataset.inc) || 5, done = Math.min(1, Number(wrap.dataset.done) || 0);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fieldValue = () => Math.max(0, Math.min(MAX, num(input.value) ?? 0));   // num() takes "52,5" too
  let v = fieldValue(), lastStep = Math.round(v / step);
  let W = 0, H = 0, dpr = 1, P = {}, raf = 0, moving = false, drag = null, vel = 0;

  function colours() {
    const cs = getComputedStyle(wrap);
    P = Object.fromEntries(TOKENS.map(t => [t, cs.getPropertyValue('--dial-' + t).trim() || '#fff']));
  }
  // Centre off the bottom-right corner; the pointer sits mid-sweep, at -135°.
  function geo() {
    const R = Math.max(330, Math.min(W, 430) * 0.86);
    return { cx: W + R * 0.1, cy: H + R * 0.26, R, ap: -Math.PI * 0.75 };
  }
  const angleOf = (w, g) => g.ap - (w - v) / step * STEP_ANG;

  function size() {
    const r = wrap.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(3, devicePixelRatio || 1); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // The touch band: a ring from just inside the rim to past its numbers (even-odd: two circles = an annulus).
    const g = geo(), c = (r) => `M${(g.cx - r).toFixed(1)} ${g.cy.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    ring.style.clipPath = `path(evenodd, '${c(Math.round(g.R + 86))}${c(Math.round(g.R - 36))}')`;
    colours(); draw();
  }

  function draw() {
    if (!W) return;
    const g = geo();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, P['band-a']); bg.addColorStop(1, P['band-b']);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // the disc
    const dg = ctx.createRadialGradient(g.cx, g.cy, g.R * 0.2, g.cx, g.cy, g.R);
    dg.addColorStop(0, P.core); dg.addColorStop(1, P.rim);
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, Math.PI * 2); ctx.fillStyle = dg; ctx.fill();
    // today's sets: a band just inside the rim, filling up and to the right
    const sweep = 1.0;
    ctx.lineWidth = 6; ctx.lineCap = 'butt';
    ctx.strokeStyle = P.track; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R - 5, g.ap - sweep, g.ap + sweep); ctx.stroke();
    if (done > 0) {
      ctx.strokeStyle = P.prog; ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R - 5, g.ap - sweep, g.ap - sweep + 2 * sweep * done); ctx.stroke();
    }
    // ticks and numbers on the rim
    const span = Math.ceil(1.9 / STEP_ANG) + 2, base = Math.round(v / step);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    try { ctx.fontStretch = 'extra-condensed'; } catch (e) { /* older browsers: normal width */ }
    for (let k = base - span; k <= base + span; k++) {
      const w = k * step; if (w < 0 || w > MAX) continue;
      const a = angleOf(w, g), cos = Math.cos(a), sin = Math.sin(a);
      const major = k % 2 === 0, near = Math.abs(w - v) < step / 2;
      ctx.strokeStyle = P['tick-dim']; ctx.lineWidth = 1;
      for (let f = 1; f < 5; f++) {                     // fine knurl between steps
        const af = a - f / 5 * STEP_ANG, c2 = Math.cos(af), s2 = Math.sin(af);
        ctx.beginPath(); ctx.moveTo(g.cx + c2 * (g.R + 2), g.cy + s2 * (g.R + 2)); ctx.lineTo(g.cx + c2 * (g.R + 8), g.cy + s2 * (g.R + 8)); ctx.stroke();
      }
      const len = major ? 20 : 12;
      ctx.strokeStyle = near ? P.hi : P.tick; ctx.lineWidth = major ? 2.5 : 1.6;
      ctx.beginPath(); ctx.moveTo(g.cx + cos * (g.R + 2), g.cy + sin * (g.R + 2)); ctx.lineTo(g.cx + cos * (g.R + 2 + len), g.cy + sin * (g.R + 2 + len)); ctx.stroke();
      if (!major && !near) continue;
      const rr = g.R + 44, x = g.cx + cos * rr, y = g.cy + sin * rr;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      const d = Math.abs(w - v) / step;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.font = `${near ? 900 : 700} ${near ? 34 : Math.max(17, 25 - d * 1.2)}px Archivo, sans-serif`;
      ctx.fillStyle = near ? P.hi : P.num; ctx.globalAlpha = near ? 1 : Math.max(.35, 1 - d * 0.08);
      ctx.fillText(fmt(w), 0, 0); ctx.restore();
    }
    // the pointer: a notch outside the rim, aimed at the centre
    const pr = g.R + 72;
    ctx.save(); ctx.translate(g.cx + Math.cos(g.ap) * pr, g.cy + Math.sin(g.ap) * pr); ctx.rotate(g.ap + Math.PI / 2);
    ctx.fillStyle = P.hi; ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(-10, 0); ctx.lineTo(10, 0); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  // v moves freely while it turns; the readout always shows the step it would snap to.
  function setV(nv, write = true) {
    v = Math.max(0, Math.min(MAX, nv));
    const st = Math.round(v / step);
    if (st !== lastStep) { lastStep = st; if (navigator.vibrate) try { navigator.vibrate(6); } catch (e) { /* not allowed */ } }
    if (write) input.value = fmt(st * step);
    draw();
  }
  const stop = () => { cancelAnimationFrame(raf); moving = false; };
  function animateTo(w) {
    stop();
    if (RM) return setV(w);
    const from = v, t0 = performance.now();
    const tick = now => {
      if (!wrap.isConnected) return stop();
      const p = Math.min(1, (now - t0) / 220);
      setV(from + (w - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else moving = false;
    };
    moving = true; raf = requestAnimationFrame(tick);
  }
  const snap = () => animateTo(Math.round(v / step) * step);
  function numberAt(x, y) {                         // the rim number under a tap (within 26px)
    const g = geo(); let best = null, bd = 26;
    for (let k = Math.round(v / step) - 20; k <= Math.round(v / step) + 20; k++) {
      const w = k * step; if (w < 0 || w > MAX) continue;
      const a = angleOf(w, g), rr = g.R + 44;
      const d = Math.hypot(g.cx + Math.cos(a) * rr - x, g.cy + Math.sin(a) * rr - y);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  const local = e => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const angAt = (x, y) => { const g = geo(); return Math.atan2(y - g.cy, x - g.cx); };
  ring.addEventListener('pointerdown', e => {
    if (e.button > 0 || drag) return;                  // one finger turns it; a second is ignored
    const wasMoving = moving; stop();
    const [x, y] = local(e);
    drag = { id: e.pointerId, a: angAt(x, y), t: performance.now(), x, y, moved: 0, wasMoving };
    vel = 0;
    try { ring.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    input.blur();
  });
  ring.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const [x, y] = local(e), a = angAt(x, y), now = performance.now();
    drag.moved += Math.hypot(x - drag.x, y - drag.y);
    const dv = norm(a - drag.a) / STEP_ANG * step, dt = Math.max(1, now - drag.t);
    vel = 0.75 * vel + 0.25 * (dv / dt);               // value per ms, smoothed
    drag.a = a; drag.t = now; drag.x = x; drag.y = y;
    if (drag.moved >= 6) setV(v + dv); else v += dv;   // under 6px it may still be a tap: don't touch the field
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    const turned = d.moved >= 6;
    // A cancelled touch (system gesture, a call) is never a tap; a cancelled turn just settles.
    if (e.type === 'pointercancel') return turned || d.wasMoving ? snap() : draw();
    if (!turned) {
      const w = numberAt(...local(e));
      if (w != null) return animateTo(w);
      if (d.wasMoving) return snap();                  // a tap that stopped a spin: settle where it stopped
      v = fieldValue(); return draw();                 // a stray tap leaves the field exactly as it was
    }
    if (RM) return snap();
    let t0 = performance.now();
    const spin = now => {                              // inertia: the spin decays, then it snaps
      if (!wrap.isConnected) return stop();
      const dt = now - t0; t0 = now;
      vel *= Math.pow(0.992, dt);
      if (Math.abs(vel) < 0.004) return snap();
      setV(v + vel * dt); raf = requestAnimationFrame(spin);
    };
    moving = true; raf = requestAnimationFrame(spin);
  }
  ring.addEventListener('pointerup', release);
  ring.addEventListener('pointercancel', release);
  // Up/Down arrow keys in the readout step the weight.
  input.addEventListener('keydown', e => {
    const k = { ArrowUp: 1, ArrowDown: -1 }[e.key];
    if (!k) return;
    e.preventDefault(); animateTo(Math.round(v / step) * step + k * step);
  });

  new ResizeObserver(size).observe(wrap);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => wrap.isConnected && draw());
  size();

  return {
    /** The readout was typed into: turn the wheel to it (the field keeps exactly what was typed). */
    fromInput() { stop(); v = fieldValue(); lastStep = Math.round(v / step); draw(); },
    /** Logging a set mid-spin: stop where it is and settle on that step first, so what's saved is what shows. */
    settle() { if (moving || drag) { drag = null; stop(); setV(Math.round(v / step) * step); } },
    /** The theme changed: re-read the colours. */
    recolour() { colours(); draw(); },
    get value() { return v; }
  };
}
