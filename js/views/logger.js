import { BREATH } from '../catalog.js';
import { getSessions, isCustomExercise, updateCustomExercise, getLog, getLimits, getMachines, getSettings, exById, addSet, updateSet, removeSet, setEntryNote, getSetup, setSetup, myHealth } from '../store.js';
import { exerciseHistory, suggestNext, isPR, e1rm } from '../analytics.js';
import { esc, todayStr, shortDate, num, fmtNum, safeUrl, parseRepRange } from '../util.js';
import { $, $$, toast, confetti, openSheet, closeSheet } from '../ui.js';
import { startRest, restLeft, clock } from '../timer.js';
import { rerender } from '../router.js';
import { activeSession } from './today.js';
import { lastCoach } from '../coach.js';
import { icon } from '../icons.js';
import { arcDial } from '../dial.js';

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
let editing = null;   // { entryId, i }: a logged set being fixed; the console loads its numbers

/*
 * The set console: everything one set needs (target, dial, reps, effort, Log set) on one screen above the tab bar,
 * so you never scroll between turning the weight and logging it. Notes, setup and history sit below it.
 */
export function render(ctx) {
  ctxNow = ctx;
  const ex = exById(ctx.arg);
  if (!ex) return `<div class="card">Unknown exercise. <a href="#/machines">Back to machines</a></div>`;
  const m = ctx.query.m ? getMachines()[ctx.query.m] : null;
  const log = getLog();
  const today = todayStr();
  const hist = exerciseHistory(log, ex);
  const prior = hist.filter(h => h.date !== today);
  const entry = log.find(e => e.date === today && e.exId === ex.id);
  const sets = entry ? entry.sets : [];
  if (editing && (!entry || entry.id !== editing.entryId || !sets[editing.i])) editing = null;
  const fix = editing ? sets[editing.i] : null;
  const sug = suggestNext(ex, prior);
  const last = prior[prior.length - 1];
  const limits = getLimits();
  const coach = coachTarget(ex.id);
  const best = prior.length && ex.kind === 'strength' ? Math.max(...prior.map(h => h.e1rm)) : null;
  const lastSet = sets[sets.length - 1];
  const sid = activeSession();
  const plan = sid ? getSessions()[sid].ex : [];
  const nextId = plan.includes(ex.id) ? plan[plan.indexOf(ex.id) + 1] : null;
  const next = nextId && exById(nextId);

  const src = fix || lastSet;   // the next set starts from the last one; fixing a set starts from that set
  const defW = src ? src.w : (sug.w ?? (last ? last.topW : ''));
  const defR = src ? src.r : (sug.r ?? '');
  const inc = ex.inc || 5;
  const setNo = fix ? editing.i + 1 : sets.length + 1;
  const left = restLeft();

  let h = `<form id="logSet" class="console ${ex.kind === 'strength' ? 'has-dial' : ''}" autocomplete="off">
    <div class="con-head"><a href="#/${m ? 'machines' : 'today'}" class="back" aria-label="Back">${icon('back', 22)}</a>
      <h2 class="big con-title">${esc(ex.name)}</h2>
      <span class="con-rest" data-rest ${left == null ? 'hidden' : ''}>Rest <b data-rest-time>${left == null ? '' : clock(left)}</b>
        <button type="button" data-act="restAdd" aria-label="Add 30 seconds">+30s</button>
        <button type="button" data-act="restStop" aria-label="Stop rest timer">${icon('close', 13, { stroke: 2.5 })}</button></span></div>
    ${m && m.exIds.length > 1 ? `<div class="chips">${m.exIds.map(id => {
      const x = exById(id);
      return x ? `<a class="chip ${id === ex.id ? 'on' : ''}" href="#/log/${id}?m=${m.id}">${esc(x.name.replace(/\s*\(.*\)/, ''))}</a>` : '';
    }).join('')}</div>` : ''}
    <div class="con-target ${fix ? 'fixing' : sug.caution ? 'caution' : sug.up ? 'up' : ''}">
      <p class="con-sug"><span class="con-set">${fix ? `Fixing set ${setNo}` : `Set ${setNo}${ex.kind !== 'cardio' ? ' of ' + ex.sets : ''}`}</span>
        <b>${fix ? `Was ${esc(fmtSet(ex, fix))}: set it right and save`
          : esc(sug.text)}</b></p>
      ${!fix && coach ? `<span class="con-coach">${icon('sparkle', 13)} Coach ${coach.sets} × ${esc(coach.reps)}${coach.weight_lb ? ' @ ' + coach.weight_lb + ' lb' : ''}</span>` : ''}
      ${myHealth() && limits.load && ex.kind === 'strength' ? `<span class="con-limit">${icon('doctor', 13)} Cardiologist limit: ${esc(limits.load)}</span>` : ''}
    </div>`;

  if (ex.kind === 'cardio') {
    const cs = fix || lastSet;
    h += stepper('min', 'Minutes', cs ? cs.min : 10, 1, 'numeric')
      + `<label class="lbl">Level / speed <span class="muted">(optional)</span></label><input name="lvl" placeholder="e.g. level 6, 3.2 mph" value="${esc(cs ? cs.lvl || '' : '')}">`;
  } else {
    if (ex.kind === 'strength') h += weightSwipe(ex.assisted, defW, inc, Math.min(1, sets.length / (ex.sets || 3)), setNo);
    h += repRow(ex, defR);
  }
  const rpe = src && src.rpe ? src.rpe : '';  // carried forward so every set keeps its effort rating
  h += `<div class="con-field"><span class="con-lbl" id="rpeLbl">Effort · RPE <span>aim 5–7 · 9+ too much</span></span>
    <div class="rpe" role="radiogroup" aria-labelledby="rpeLbl">${[4, 5, 6, 7, 8, 9].map(v =>
      `<button type="button" class="rpe-chip r${v}" data-act="rpe" data-v="${v}" role="radio" aria-checked="${v === rpe}">${v}</button>`).join('')}</div></div>
    <input type="hidden" name="rpe" value="${rpe}">
    <div class="con-actions">${fix ? `<button type="button" class="btn ghost con-cancel" data-act="cancelFix">Cancel</button>` : ''}
      <button class="btn primary con-log" type="submit">${icon('check', 20, { stroke: 2.6 })} ${fix ? `Save set ${setNo}` : `Log set ${setNo}`}</button></div>
  </form>`;

  // Sets so far: tap one to fix it in the console above, or × to delete it.
  if (sets.length) {
    h += `<section class="card"><div class="row-between"><h2>Sets today</h2><span class="count">${sets.length}${ex.kind !== 'cardio' ? '/' + ex.sets : ''}</span></div>
      <ol class="setlist">${sets.map((s, i) => `<li class="${fix && editing.i === i ? 'on' : ''}">
        <button type="button" class="set-fix" data-act="editSet" data-entry="${esc(entry.id)}" data-i="${i}" aria-label="Fix set ${i + 1}: ${esc(fmtSet(ex, s))}">
          <span class="sn">${i + 1}</span><b>${esc(fmtSet(ex, s))}</b><span class="set-edit">${icon('edit', 15)}</span></button>
        <button class="icon-btn danger" data-act="delSet" data-entry="${esc(entry.id)}" data-i="${i}" aria-label="Delete set ${i + 1}">${icon('close', 15, { stroke: 2.5 })}</button></li>`).join('')}</ol>
      <p class="muted small">Tap a set to fix it.</p></section>`;
  }

  if (next) h += `<a class="btn ghost wide" href="#/log/${nextId}">Next: ${esc(next.name)} ${icon('chevron', 16)}</a>`;
  else h += `<a class="btn ghost wide" href="#/today">Done — back to today</a>`;
  if (m || isCustomExercise(ex.id)) {
    h += `<div class="con-edits">${m ? `<button type="button" class="link small" data-act="editMachine" data-id="${esc(m.id)}">${icon('edit', 14)} Edit machine</button>` : ''}
      ${isCustomExercise(ex.id) ? `<button type="button" class="link small" data-act="editExercise">${icon('edit', 14)} Edit exercise${ex.assisted ? ' · assisted' : ''}</button>` : ''}</div>`;
  }

  // Why today's target, Coach Claude's note, the breathing cue and last time: notes under the form.
  const why = [sug.why && esc(sug.why), coach && coach.note && `<b>Coach Claude:</b> ${esc(coach.note)}`].filter(Boolean);
  if (why.length || last || ex.kind !== 'cardio' || ex.flag) {
    h += `<section class="card notes">
      ${ex.flag ? `<div class="flag">${icon('alert', 16)}<span>${esc(ex.flag)}</span></div>` : ''}
      ${why.length ? `<div class="eyebrow">${sug.up ? 'Why level up' : sug.caution ? 'Why ease off' : 'Why this target'}</div>${why.map(t => `<p class="muted small">${t}</p>`).join('')}` : ''}
      ${ex.kind !== 'cardio' ? `<div class="cue">${icon('breath', 16)}<span>${BREATH}</span></div>` : ''}
      ${last ? `<div class="eyebrow">Last time · ${shortDate(last.date)}${best ? ` · best e1RM ${Math.round(best)} lb` : ''}</div><p class="small">${last.sets.map(s => esc(fmtSet(ex, s))).join(', ')}</p>` : ''}
      ${m && safeUrl(m.video) ? `<a class="btn ghost small" href="${esc(safeUrl(m.video))}" target="_blank" rel="noopener">${icon('play', 14)} Training video</a>` : ''}
    </section>`;
  }

  h += `<section class="card">
    <label class="lbl">Machine setup <span class="muted">(remembered)</span></label>
    <input data-input="setupNote" data-ex="${ex.id}" value="${esc(getSetup(ex.id))}" placeholder="Seat 4, back pad 2, pin 3…">
    <label class="lbl">Note for today</label>
    <input data-input="entryNote" data-ex="${ex.id}" value="${esc(entry ? entry.note : '')}" placeholder="${entry ? 'How it felt…' : 'Log a set first'}" ${entry ? '' : 'disabled'}>
  </section>`;

  if (prior.length) {
    h += `<section class="card"><div class="row-between"><h2>History</h2><a class="link" href="#/progress/strength?ex=${ex.id}">Chart ${icon('chevron', 16)}</a></div>
      <table class="hist"><thead><tr><th>Date</th><th>Sets</th>${ex.kind === 'strength' ? '<th class="num">e1RM</th>' : ''}</tr></thead>
      <tbody>${prior.slice(-6).reverse().map(p => `<tr><td>${shortDate(p.date)}</td><td>${p.sets.map(s => esc(shortSet(ex, s))).join(', ')}</td>
      ${ex.kind === 'strength' ? `<td class="num">${fmtNum(p.e1rm, 0)}</td>` : ''}</tr>`).join('')}</tbody></table></section>`;
  }
  return h;
}

/** Weight dial: the corner arc wheel (js/dial.js) on a full-bleed band, with the readout in its lower right.
    Turn it, tap a number on its rim, tap −/+ for one step, or type into the readout. The rim band fills with today's sets. */
function weightSwipe(assisted, value, inc, done, setNo) {
  // The field's label is for screen readers; on screen the caption says it ("lb · 5 step", "assist lb · 5 step").
  const unit = assisted ? 'lb of assist' : 'lb';
  return `<label class="sr-only" for="f_w">${assisted ? 'Assist (lb)' : 'Weight (lb)'}</label>
    <div class="wswipe" data-inc="${inc}" data-done="${done}">
      <canvas aria-hidden="true"></canvas><div class="wring" aria-hidden="true"></div>
      <div class="wstep"><button type="button" data-act="wStep" data-d="-1" aria-label="${inc} ${unit} less">−${inc}</button><button type="button" data-act="wStep" data-d="1" aria-label="${inc} ${unit} more">+${inc}</button></div>
      <small class="wcap" aria-hidden="true">${assisted ? 'assist ' : ''}lb · ${inc} step · set ${setNo}</small>
      <input id="f_w" name="w" class="wbig" inputmode="decimal" data-input="wtype" value="${esc(value ?? '')}" placeholder="0">
    </div>`;
}

/** Reps: five one-tap cells around the target range, with −/+ at the ends for anything outside it. */
function repCells(ex, value) {
  const [lo] = parseRepRange(ex.reps);
  const v = num(value);
  let a = Math.max(1, lo - 1);                       // the window slides to keep the current count in view
  if (v != null && v < a) a = Math.max(1, v);
  if (v != null && v > a + 4) a = v - 4;
  return Array.from({ length: 5 }, (_, i) => a + i).map(r =>
    `<button type="button" class="repchip" data-act="repChip" data-v="${r}" aria-pressed="${v === r}">${r}</button>`).join('');
}
function repRow(ex, value) {
  return `<div class="con-field"><span class="con-lbl" id="repsLbl">Reps <span>${esc(ex.reps || '')}</span></span>
    <div class="repchips" role="group" aria-labelledby="repsLbl">
      <button type="button" class="repstep" data-act="repStep" data-d="-1" aria-label="One rep fewer">−</button>
      <span class="repwin">${repCells(ex, value)}</span>
      <button type="button" class="repstep" data-act="repStep" data-d="1" aria-label="One rep more">+</button></div>
    <input type="hidden" name="r" value="${esc(value ?? '')}"></div>`;
}
function setReps(form, r) {
  form.elements.r.value = r;
  $('.repwin', form).innerHTML = repCells(exById(ctxNow.arg), r);
}

let dial = null;
// The console fills the screen between the header and the tab bar, so the dial gets whatever height is left.
function fit() {
  const form = $('#logSet.has-dial');
  if (!form || document.activeElement?.matches('input, textarea')) return;   // a phone keyboard resizes the window: hold still
  const top = $('.top'), tabs = $('#tabs');
  const avail = innerHeight - (top ? top.offsetHeight : 0) - (tabs ? tabs.offsetHeight : 0) - 34;   // the Scan tab's notch rises above the bar
  form.classList.remove('tight', 'tighter');
  form.style.height = Math.max(400, avail) + 'px';
  // A short screen: first slimmer rows and gaps; only if that still doesn't fit, the row labels go too.
  const over = () => form.scrollHeight > form.clientHeight + 1;
  if (over()) form.classList.add('tight');
  if (over()) form.classList.add('tighter');
}
export function mount(root, ctx) {
  if (editing && ctx && ctx.arg !== editing.exId) editing = null;
  fit();
  const wrap = root.querySelector('.wswipe');
  dial = wrap ? arcDial(wrap) : null;
  addEventListener('resize', fit);
}
export function unmount() { dial = null; editing = null; removeEventListener('resize', fit); }

function stepper(name, label, value, step, mode) {
  return `<label class="lbl" for="f_${name}">${label}</label>
    <div class="stepper"><button type="button" data-act="step" data-f="${name}" data-d="-${step}" aria-label="Decrease ${label}">−</button>
    <input id="f_${name}" name="${name}" inputmode="${mode}" value="${esc(value ?? '')}" placeholder="0"${name === 'r' ? ' data-input="rtype"' : ''}>
    <button type="button" data-act="step" data-f="${name}" data-d="${step}" aria-label="Increase ${label}">+</button></div>`;
}

export const actions = {
  step(el) {
    const input = el.closest('form').elements[el.dataset.f];
    const v = num(input.value) || 0;
    input.value = Math.max(0, Math.round((v + Number(el.dataset.d)) * 10) / 10);
    if (el.dataset.f === 'r') syncRepChips(el.closest('form'));
  },
  repChip(el) { setReps(el.closest('form'), Number(el.dataset.v)); },
  repStep(el) {
    const f = el.closest('form');
    const [lo] = parseRepRange(exById(ctxNow.arg).reps);
    setReps(f, Math.min(100, Math.max(1, (num(f.elements.r.value) ?? lo) + Number(el.dataset.d))));
  },
  wStep(el) { if (dial) dial.nudge(Number(el.dataset.d)); },
  // Tap a logged set: the console loads it, and Log set becomes Save set N.
  editSet(el) {
    editing = { entryId: el.dataset.entry, i: Number(el.dataset.i), exId: ctxNow.arg };
    rerender();
  },
  cancelFix() { editing = null; rerender(); },
  rpe(el) {
    const f = el.closest('form');
    const on = el.getAttribute('aria-checked') !== 'true';
    $$('.rpe-chip', f).forEach(b => b.setAttribute('aria-checked', b === el && on));
    f.elements.rpe.value = on ? el.dataset.v : '';
  },
  delSet(el) {
    if (!confirm('Delete this set?')) return;
    removeSet(el.dataset.entry, +el.dataset.i);
    if (editing) editing = editing.i === +el.dataset.i ? null : { ...editing, i: editing.i - (editing.i > +el.dataset.i ? 1 : 0) };
    rerender({ keepScroll: true });
  },
  // Exercises you created: rename, set the rep range, or mark an assist machine (less weight = harder).
  editExercise() {
    const ex = exById(ctxNow.arg);
    if (!ex || !isCustomExercise(ex.id)) return;
    openSheet(`<div class="sheet-head"><h2>Edit exercise</h2><p class="muted small">Your logged sets stay as they are.</p></div>
      <form id="editExercise" data-id="${esc(ex.id)}">
        <label class="lbl">Name</label><input name="name" value="${esc(ex.name)}" required>
        ${ex.kind !== 'cardio' ? `<label class="lbl">Rep range</label><input name="reps" value="${esc(ex.reps || '')}" placeholder="10–12" inputmode="numeric">` : ''}
        ${ex.kind === 'strength' ? `<label class="check-line"><input type="checkbox" name="assisted" ${ex.assisted ? 'checked' : ''}> Assisted machine: the weight helps me, so less weight is harder (assisted pull-up, chin-up or dip)</label>` : ''}
        <button class="btn primary wide" type="submit">Save</button>
      </form>`);
  }
};

export const submits = {
  editExercise(form) {
    const f = form.elements;
    const reps = f.reps ? f.reps.value.trim().replace(/\s*-\s*/, '–') : '';
    if (reps && !/^\d{1,3}(–\d{1,3})?$/.test(reps)) return toast('Rep range like 8–10 or 12', 'warn');
    updateCustomExercise(form.dataset.id, { name: f.name.value, reps, ...(f.assisted ? { assisted: f.assisted.checked } : {}) });
    closeSheet();
    toast('Exercise saved');
    rerender({ keepScroll: true });
  },
  logSet(form) {
    if (dial) dial.settle();
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
    if (editing) {
      const n = editing.i + 1;
      if (!updateSet(editing.entryId, editing.i, set)) return toast('That set is gone', 'warn');
      editing = null;
      toast(`Set ${n} fixed`);
      return rerender();
    }
    const hist = exerciseHistory(getLog(), ex);
    const pr = isPR(ex, hist, set);
    const sid = activeSession();
    addSet({ exId: ex.id, machineId: ctxNow.query.m || null, sessionId: sid && getSessions()[sid].ex.includes(ex.id) ? sid : null, set });

    if (set.rpe >= 9) {
      alert(`Heads up${myHealth() ? ', Brother' : ''}: RPE 9+ is near max effort.\nTake a longer rest, drop the weight a bit next set, and stay around RPE 6–7.`);
    } else if (pr) {
      confetti();
      toast(`${pr}! ${set.w} lb × ${set.r} · e1RM ${Math.round(e1rm(set.w, set.r))}`);
    } else {
      toast('Set logged');
    }
    if (ex.kind !== 'cardio') startRest(getSettings().restSec);
    rerender();   // back to the top: the console is ready for the next set
  }
};

export const inputs = {
  wtype() { if (dial) dial.fromInput(); },
  setupNote(el) { setSetup(el.dataset.ex, el.value.trim()); },
  entryNote(el) { setEntryNote(el.dataset.ex, el.value.trim()); }
};
