import { BREATH, SESSIONS, MACHINE_TYPES } from '../catalog.js';
import { getLog, getLimits, getMachines, getSettings, exById, addSet, removeSet, setEntryNote, getSetup, setSetup } from '../store.js';
import { exerciseHistory, suggestNext, isPR, e1rm } from '../analytics.js';
import { esc, todayStr, shortDate, num, fmtNum, safeUrl } from '../util.js';
import { $, $$, toast, confetti } from '../ui.js';
import { startRest } from '../timer.js';
import { rerender } from '../router.js';
import { activeSession } from './today.js';
import { lastCoach } from '../coach.js';
import { icon } from '../icons.js';

// Plain text — callers escape once.
// Non-breaking spaces keep "120 lb × 12" from splitting across lines.
const fmtSet = (ex, s) => ex.kind === 'cardio'
  ? `${s.min}\u00a0min${s.lvl ? ' · ' + s.lvl : ''}${s.rpe ? ' · RPE\u00a0' + s.rpe : ''}`
  : `${ex.kind === 'bodyweight' ? '' : (s.w ?? '–') + '\u00a0lb\u00a0×\u00a0'}${s.r ?? '–'}${s.rpe ? ' · RPE\u00a0' + s.rpe : ''}`;
// Compact form for history tables (same as Progress → Sessions): 120×12@6
const shortSet = (ex, s) => ex.kind === 'cardio' ? fmtSet(ex, s)
  : `${ex.kind === 'bodyweight' ? '' : (s.w ?? '–') + '×'}${s.r ?? '–'}${s.rpe ? '@' + s.rpe : ''}`;

/** Coach Claude's target for this exercise, if a report from the last 14 days has one. */
function coachTarget(exId) {
  const c = lastCoach();
  if (!c || Date.now() - c.ts > 14 * 864e5) return null;
  return (c.report.next_session || []).find(t => t.exercise_id === exId) || null;
}

let ctxNow = null;

export function render(ctx) {
  ctxNow = ctx;
  const ex = exById(ctx.arg);
  if (!ex) return `<div class="card">Unknown exercise. <a href="#/machines">Back to machines</a></div>`;
  const m = ctx.query.m ? getMachines()[ctx.query.m] : null;
  const type = m && MACHINE_TYPES.find(t => t.id === m.type);
  const log = getLog();
  const today = todayStr();
  const hist = exerciseHistory(log, ex);
  const prior = hist.filter(h => h.date !== today);
  const entry = log.find(e => e.date === today && e.exId === ex.id);
  const sets = entry ? entry.sets : [];
  const sug = suggestNext(ex, prior);
  const last = prior[prior.length - 1];
  const limits = getLimits();
  const coach = coachTarget(ex.id);
  const best = prior.length && ex.kind === 'strength' ? Math.max(...prior.map(h => h.e1rm)) : null;
  const lastSet = sets[sets.length - 1];
  const sid = activeSession();
  const plan = sid ? SESSIONS[sid].ex : [];
  const nextId = plan.includes(ex.id) ? plan[plan.indexOf(ex.id) + 1] : null;
  const next = nextId && exById(nextId);

  const defW = lastSet ? lastSet.w : (sug.w ?? (last ? last.topW : ''));
  const defR = lastSet ? lastSet.r : (sug.r ?? '');
  const inc = ex.inc || 5;

  let h = `<section class="card">
    <div class="lh-top"><a href="#/${m ? 'machines' : 'today'}" class="back" aria-label="Back">${icon('back', 22)}</a>
      ${m ? `<span class="lh-machine">${icon(type ? type.icon : 'dumbbell', 16)} ${esc(m.name)}${m.zone ? ' · ' + esc(m.zone) : ''}</span>` : '<span></span>'}
      ${m ? `<button class="icon-btn" data-act="editMachine" data-id="${esc(m.id)}" aria-label="Edit machine">${icon('edit', 16)}</button>` : '<span></span>'}</div>
    <h2 class="big">${esc(ex.name)}</h2>
    ${m && m.exIds.length > 1 ? `<div class="chips">${m.exIds.map(id => {
      const x = exById(id);
      return x ? `<a class="chip ${id === ex.id ? 'on' : ''}" href="#/log/${id}?m=${m.id}">${esc(x.name.replace(/\s*\(.*\)/, ''))}</a>` : '';
    }).join('')}</div>` : ''}
    <div class="lh-meta">${ex.kind === 'cardio' ? esc(ex.target || '') : `<span class="target">${ex.sets} × ${esc(ex.reps)}</span><span class="target">RPE 5–7</span>`}
      ${best ? `<span class="target">Best e1RM ${Math.round(best)} lb</span>` : ''}</div>
    ${m && safeUrl(m.video) ? `<a class="btn ghost small" href="${esc(safeUrl(m.video))}" target="_blank" rel="noopener">${icon('play', 14)} Training video</a>` : ''}
  </section>`;

  h += `<section class="card sug ${sug.caution ? 'caution' : sug.up ? 'up' : ''}">
    <div class="eyebrow">${sug.up ? icon('up', 14, { stroke: 2.5 }) + ' Level up' : sug.caution ? icon('alert', 14, { stroke: 2.5 }) + ' Ease off' : icon('target', 14, { stroke: 2.5 }) + ' Today’s target'}</div>
    <b>${esc(sug.text)}</b>${sug.why ? `<p class="muted small">${esc(sug.why)}</p>` : ''}
    ${coach ? `<div class="coach-tgt">${icon('sparkle', 16)}<span><b>Coach Claude</b> ${coach.sets} × ${esc(coach.reps)}${coach.weight_lb ? ' @ ' + coach.weight_lb + ' lb' : ''}${coach.note ? `<span class="muted small"> — ${esc(coach.note)}</span>` : ''}</span></div>` : ''}
    ${last ? `<p class="small">Last time (${shortDate(last.date)}): ${last.sets.map(s => esc(fmtSet(ex, s))).join(', ')}</p>` : ''}
    ${ex.flag ? `<div class="flag">${icon('alert', 16)}<span>${esc(ex.flag)}</span></div>` : ''}
    ${limits.load && ex.kind === 'strength' ? `<div class="flag">${icon('doctor', 16)}<span>Cardiologist load limit: ${esc(limits.load)}</span></div>` : ''}
    ${ex.kind !== 'cardio' ? `<div class="cue">${icon('breath', 16)}<span>${BREATH}</span></div>` : ''}
  </section>`;

  h += `<section class="card"><div class="row-between"><h2>Sets today</h2><span class="count">${sets.length}${ex.kind !== 'cardio' ? '/' + ex.sets : ''}</span></div>
    ${sets.length ? `<ol class="setlist">${sets.map((s, i) => `<li><span class="sn">${i + 1}</span><b>${esc(fmtSet(ex, s))}</b>
      <button class="icon-btn danger" data-act="delSet" data-entry="${esc(entry.id)}" data-i="${i}" aria-label="Delete set ${i + 1}">${icon('close', 15, { stroke: 2.5 })}</button></li>`).join('')}</ol>`
      : '<p class="muted small">No sets yet — you’ve got this.</p>'}
    <form id="logSet" class="entry" autocomplete="off">`;

  if (ex.kind === 'cardio') {
    h += stepper('min', 'Minutes', lastSet ? lastSet.min : 10, 1, 'numeric')
      + `<label class="lbl">Level / speed <span class="muted">(optional)</span></label><input name="lvl" placeholder="e.g. level 6, 3.2 mph" value="${esc(lastSet ? lastSet.lvl || '' : '')}">`;
  } else {
    if (ex.kind === 'strength') h += stepper('w', ex.assisted ? 'Assist (lb)' : 'Weight (lb)', defW, inc, 'decimal');
    h += stepper('r', 'Reps', defR, 1, 'numeric');
  }
  const rpe = lastSet && lastSet.rpe ? lastSet.rpe : '';  // carried forward so every set keeps its effort rating
  h += `<label class="lbl">How hard? (RPE) <span class="muted">— 5 moderate · 7 hard, 3 left · 9+ too much</span></label>
    <div class="rpe" role="radiogroup" aria-label="RPE">${[4, 5, 6, 7, 8, 9].map(v =>
      `<button type="button" class="rpe-chip r${v}" data-act="rpe" data-v="${v}" role="radio" aria-checked="${v === rpe}">${v}</button>`).join('')}</div>
    <input type="hidden" name="rpe" value="${rpe}">
    <button class="btn primary wide big-btn" type="submit">${icon('check', 20, { stroke: 2.6 })} Log set ${sets.length + 1}</button>
  </form></section>`;

  h += `<section class="card">
    <label class="lbl">Machine setup <span class="muted">(remembered)</span></label>
    <input data-input="setupNote" data-ex="${ex.id}" value="${esc(getSetup(ex.id))}" placeholder="Seat 4, back pad 2, pin 3…">
    <label class="lbl">Note for today</label>
    <input data-input="entryNote" data-ex="${ex.id}" value="${esc(entry ? entry.note : '')}" placeholder="How it felt…" ${entry ? '' : 'disabled title="Log a set first"'}>
  </section>`;

  if (next) h += `<a class="btn ghost wide" href="#/log/${nextId}">Next: ${esc(next.name)} ${icon('chevron', 16)}</a>`;
  else h += `<a class="btn ghost wide" href="#/today">Done — back to today</a>`;

  if (prior.length) {
    h += `<section class="card"><div class="row-between"><h2>History</h2><a class="link" href="#/progress/strength?ex=${ex.id}">Chart ${icon('chevron', 16)}</a></div>
      <table class="hist"><thead><tr><th>Date</th><th>Sets</th>${ex.kind === 'strength' ? '<th class="num">e1RM</th>' : ''}</tr></thead>
      <tbody>${prior.slice(-6).reverse().map(p => `<tr><td>${shortDate(p.date)}</td><td>${p.sets.map(s => esc(shortSet(ex, s))).join(', ')}</td>
      ${ex.kind === 'strength' ? `<td class="num">${fmtNum(p.e1rm, 0)}</td>` : ''}</tr>`).join('')}</tbody></table></section>`;
  }
  return h;
}

function stepper(name, label, value, step, mode) {
  return `<label class="lbl" for="f_${name}">${label}</label>
    <div class="stepper"><button type="button" data-act="step" data-f="${name}" data-d="-${step}" aria-label="Decrease ${label}">−</button>
    <input id="f_${name}" name="${name}" inputmode="${mode}" value="${esc(value ?? '')}" placeholder="0">
    <button type="button" data-act="step" data-f="${name}" data-d="${step}" aria-label="Increase ${label}">+</button></div>`;
}

export const actions = {
  step(el) {
    const input = el.closest('form').elements[el.dataset.f];
    const v = num(input.value) || 0;
    input.value = Math.max(0, Math.round((v + Number(el.dataset.d)) * 10) / 10);
  },
  rpe(el) {
    const f = el.closest('form');
    const on = el.getAttribute('aria-checked') !== 'true';
    $$('.rpe-chip', f).forEach(b => b.setAttribute('aria-checked', b === el && on));
    f.elements.rpe.value = on ? el.dataset.v : '';
  },
  delSet(el) {
    if (!confirm('Delete this set?')) return;
    removeSet(el.dataset.entry, +el.dataset.i);
    rerender({ keepScroll: true });
  }
};

export const submits = {
  logSet(form) {
    const ex = exById(ctxNow.arg);
    const f = form.elements;
    const set = { rpe: num(f.rpe.value) };
    if (ex.kind === 'cardio') {
      set.min = num(f.min.value);
      set.lvl = f.lvl.value.trim() || undefined;
      if (!(set.min > 0)) return toast('Enter minutes', 'warn');
    } else {
      set.r = num(f.r.value);
      set.w = ex.kind === 'strength' ? num(f.w.value) : null;
      if (!(set.r > 0)) return toast('Enter reps', 'warn');
      if (ex.kind === 'strength' && set.w == null) return toast('Enter the weight', 'warn');
    }
    const hist = exerciseHistory(getLog(), ex);
    const pr = isPR(ex, hist, set);
    const sid = activeSession();
    addSet({ exId: ex.id, machineId: ctxNow.query.m || null, sessionId: sid && SESSIONS[sid].ex.includes(ex.id) ? sid : null, set });

    if (set.rpe >= 9) {
      alert('Heads up, Brother: RPE 9+ is near max effort.\nTake a longer rest, drop the weight a bit next set, and stay around RPE 6–7.');
    } else if (pr) {
      confetti();
      toast(`${pr}! ${set.w} lb × ${set.r} · e1RM ${Math.round(e1rm(set.w, set.r))}`);
    } else {
      toast('Set logged');
    }
    if (ex.kind !== 'cardio') startRest(getSettings().restSec);
    rerender({ keepScroll: true });
  }
};

export const inputs = {
  setupNote(el) { setSetup(el.dataset.ex, el.value.trim()); },
  entryNote(el) { setEntryNote(el.dataset.ex, el.value.trim()); }
};
