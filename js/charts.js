// Dependency-free SVG charts: a line/dot chart with crosshair tooltip, and activity rings.
import { esc } from './util.js';

function niceStep(span, count) {
  const raw = (span || 1) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const e = raw / mag;
  return (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
}

/**
 * spec: { series:[{name, color, type:'line'|'dots'|'dash', points:[{x,y}]}], refs:[{y,label}],
 *         xFmt(x), yFmt(y), unit, height, endLabel: seriesIndex }
 */
export function lineChart(el, spec) {
  const { series, refs = [], xFmt, yFmt = v => Math.round(v), unit = '', height = 200 } = spec;
  const all = series.flatMap(s => s.points);
  if (!all.length) { el.innerHTML = '<div class="chart-empty">No data yet</div>'; return; }

  const W = Math.max(280, el.clientWidth || 340), H = height;
  const P = { l: 40, r: 14, t: 14, b: 26 };
  let x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x));
  if (x0 === x1) { x0 -= 3; x1 += 3; }
  const ys = all.map(p => p.y).concat(refs.map(r => r.y));
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  // A flat (or float-noise-flat, e.g. 180.6 vs 180.60000000000002) series gets a sensible band instead of a
  // near-zero step, which would never get from y0 to y1 in the grid loop below.
  const span = y1 - y0;
  const pad = span > 1e-6 * Math.max(1, Math.abs(y1)) ? span * 0.12 : Math.max(1, Math.abs(y1) * 0.05);
  y0 -= pad; y1 += pad;
  const step = niceStep(y1 - y0, 4);
  y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;

  const sx = x => P.l + ((x - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = y => P.t + (1 - (y - y0) / (y1 - y0)) * (H - P.t - P.b);

  let g = '';
  for (let i = 0, v = y0; v <= y1 + step / 2 && i <= 12; v = y0 + ++i * step) {
    g += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}"/>`;
    g += `<text class="tick" x="${P.l - 6}" y="${sy(v) + 4}" text-anchor="end">${esc(yFmt(v))}</text>`;
  }
  const nx = Math.min(4, Math.max(2, Math.round((x1 - x0) / 7)));
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    g += `<text class="tick" x="${sx(x)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === nx ? 'end' : 'middle'}">${esc(xFmt(Math.round(x)))}</text>`;
  }
  for (const r of refs) {
    g += `<line class="ref" x1="${P.l}" x2="${W - P.r}" y1="${sy(r.y)}" y2="${sy(r.y)}"/>`;
    g += `<text class="ref-label" x="${W - P.r}" y="${sy(r.y) - 5}" text-anchor="end">${esc(r.label)}</text>`;
  }
  for (const s of series) {
    const pts = s.points.slice().sort((a, b) => a.x - b.x);
    if (s.type === 'dots') {
      g += pts.map(p => `<circle class="dot" cx="${sx(p.x)}" cy="${sy(p.y)}" r="4" style="fill:${s.color}"/>`).join('');
    } else if (pts.length) {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
      g += `<path class="line ${s.type === 'dash' ? 'dash' : ''}" d="${d}" style="stroke:${s.color}"/>`;
      if (s.type === 'line') {
        const last = pts[pts.length - 1];
        g += `<circle class="dot" cx="${sx(last.x)}" cy="${sy(last.y)}" r="4.5" style="fill:${s.color}"/>`;
      }
    }
  }
  if (spec.endLabel != null && series[spec.endLabel] && series[spec.endLabel].points.length) {
    const pts = series[spec.endLabel].points;
    const last = pts[pts.length - 1];
    const lx = sx(last.x), ly = sy(last.y);
    g += `<text class="end-label" x="${Math.min(lx, W - P.r - 4)}" y="${ly - 10}" text-anchor="${lx > W - 60 ? 'end' : 'middle'}">${esc(yFmt(last.y))}${unit ? ' ' + esc(unit) : ''}</text>`;
  }

  const legend = series.length > 1
    ? `<div class="legend">${series.map(s => `<span><i class="key ${s.type}" style="--k:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';

  el.innerHTML = `${legend}<div class="plot"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" tabindex="0"
      aria-label="${esc(spec.label || series.map(s => s.name).join(', '))}">${g}
      <line class="cross" y1="${P.t}" y2="${H - P.b}" x1="0" x2="0" visibility="hidden"/>
      <rect class="hit" x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}"/></svg>
      <div class="tip" hidden></div></div>`;

  // Crosshair + tooltip: snap to the nearest x that has data.
  const svg = el.querySelector('svg'), cross = el.querySelector('.cross'), tip = el.querySelector('.tip');
  const xsSorted = [...new Set(all.map(p => p.x))].sort((a, b) => a - b);
  let idx = xsSorted.length - 1;
  const show = i => {
    idx = Math.max(0, Math.min(xsSorted.length - 1, i));
    const x = xsSorted[idx];
    cross.setAttribute('x1', sx(x)); cross.setAttribute('x2', sx(x)); cross.setAttribute('visibility', 'visible');
    tip.replaceChildren();
    const head = document.createElement('div'); head.className = 'tip-date'; head.textContent = xFmt(x);
    tip.appendChild(head);
    for (const s of series) {
      const p = s.points.find(q => q.x === x);
      if (!p) continue;
      const row = document.createElement('div'); row.className = 'tip-row';
      const k = document.createElement('i'); k.className = 'key ' + s.type; k.style.setProperty('--k', s.color);
      const b = document.createElement('b'); b.textContent = yFmt(p.y) + (unit ? ' ' + unit : '');
      const n = document.createElement('span'); n.textContent = s.name;
      row.append(k, b, n); tip.appendChild(row);
    }
    tip.hidden = false;
    const px = (sx(x) / W) * svg.getBoundingClientRect().width;
    tip.style.left = Math.max(4, Math.min(px - tip.offsetWidth / 2, el.clientWidth - tip.offsetWidth - 4)) + 'px';
  };
  const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
  const fromEvent = ev => {
    const r = svg.getBoundingClientRect();
    const x = x0 + (((ev.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r) * (x1 - x0);
    let best = 0;
    xsSorted.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xsSorted[best] - x)) best = i; });
    show(best);
  };
  svg.addEventListener('pointermove', fromEvent);
  svg.addEventListener('pointerdown', fromEvent);
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(idx));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); }
  });
}

/** Concentric progress rings in the theme's own colours. rings: [{value, goal, color, label}] (color may be a CSS var). */
export function ringsSvg(rings, size = 124) {
  const c = size / 2, sw = 12, gap = 4;
  let arcs = '';
  rings.forEach((r, i) => {
    const rad = c - sw / 2 - i * (sw + gap);
    const circ = 2 * Math.PI * rad;
    const frac = r.goal > 0 ? Math.min(1, r.value / r.goal) : 0;
    arcs += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" style="stroke:${r.color}" stroke-opacity=".18" stroke-width="${sw}"/>`;
    if (frac > 0) arcs += `<circle class="ring-arc" cx="${c}" cy="${c}" r="${rad}" fill="none" style="stroke:${r.color};--circ:${circ}" stroke-width="${sw}"
      stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - frac)}" transform="rotate(-90 ${c} ${c})"/>`;
  });
  return `<svg class="rings" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"
    aria-label="${esc(rings.map(r => `${r.label}: ${r.value} of ${r.goal}`).join('; '))}">${arcs}</svg>`;
}
