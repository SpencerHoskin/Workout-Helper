import { MACHINE_TYPES } from '../catalog.js';
import { getMachines, saveMachine, deleteMachine, findMachineByCode, machineIdFor, allExercises, exById, addCustomExercise, getLog } from '../store.js';
import { esc, guessName, isUrl, uid, shortDate, safeUrl } from '../util.js';
import { $, $$, openSheet, closeSheet, toast } from '../ui.js';
import { go, rerender } from '../router.js';
import { openWeighin } from './progress.js';
import { icon } from '../icons.js';

const typeById = id => MACHINE_TYPES.find(t => t.id === id) || MACHINE_TYPES[MACHINE_TYPES.length - 1];

/** Where a known machine should open. */
export function openMachine(m) {
  if (m.type === 'scale') { go('progress/body'); openWeighin(); return; }
  if (!m.exIds.length) { editMachine(m.id); return; }
  go(`log/${m.exIds[0]}?m=${m.id}`);
}

/** Called by the scanner with the raw QR text. */
export function handleScanned(code) {
  const m = findMachineByCode(code);
  if (m) { toast(m.name); openMachine(m); }
  else openNewMachine(code);
}

export function render() {
  const machines = Object.values(getMachines()).sort((a, b) => a.name.localeCompare(b.name));
  const log = getLog();
  const lastUsed = {};
  for (const e of log) if (e.machineId && (!lastUsed[e.machineId] || e.date > lastUsed[e.machineId])) lastUsed[e.machineId] = e.date;
  const exs = Object.values(allExercises());
  const groups = {};
  for (const x of exs) (groups[x.kind === 'cardio' ? 'Cardio' : x.group] ||= []).push(x);

  let h = `<div class="search"><input type="search" placeholder="Search machines & exercises" data-input="search" aria-label="Search"></div>
  <section class="card">
    <div class="row-between"><h2>My machines <span class="count">${machines.length}</span></h2>
      <button class="btn small" data-act="newMachine">${icon('plus', 16)} Add</button></div>`;
  if (!machines.length) {
    h += `<p class="muted">No machines yet. Tap <b>Scan</b> and point at the QR sticker on any machine at Crunch — the app remembers it from then on.</p>`;
  }
  h += `<ul class="mlist">${machines.map(m => {
    const t = typeById(m.type);
    return `<li data-search="${esc((m.name + ' ' + m.zone + ' ' + t.name).toLowerCase())}">
      <button class="mrow" data-act="openMachine" data-id="${esc(m.id)}">
        <span class="micon">${icon(t.icon, 22)}</span>
        <span class="mmain"><b>${esc(m.name)}</b><small>${esc([m.zone, m.exIds.length > 1 ? m.exIds.length + ' exercises' : '', lastUsed[m.id] ? 'last ' + shortDate(lastUsed[m.id]) : 'not used yet'].filter(Boolean).join(' · '))}</small></span>
        <span class="chev">${icon('chevron', 18)}</span></button></li>`;
  }).join('')}</ul></section>`;

  h += `<section class="card"><h2>Exercise library</h2><p class="muted small">No QR code? Log straight from here.</p>`;
  for (const [g, list] of Object.entries(groups).sort()) {
    h += `<h3 data-group>${esc(g)}</h3><ul class="xlist">${list.map(x =>
      `<li data-search="${esc(x.name.toLowerCase())}"><a href="#/log/${x.id}">${esc(x.name)}<span class="chev">${icon('chevron', 18)}</span></a></li>`).join('')}</ul>`;
  }
  h += `<button class="btn ghost wide" data-act="newExercise">${icon('plus', 16)} Create an exercise</button></section>`;
  return h;
}

function typeGrid(selected) {
  return `<div class="type-grid" role="radiogroup" aria-label="Machine type">${MACHINE_TYPES.map(t =>
    `<button type="button" class="type ${t.id === selected ? 'on' : ''}" data-act="pickType" data-type="${t.id}" role="radio" aria-checked="${t.id === selected}">
      ${icon(t.icon, 22)}${esc(t.name)}</button>`).join('')}</div>`;
}

export function openNewMachine(code) {
  const manual = !code;
  const raw = code || 'manual:' + uid();
  const guess = guessName(raw);
  const pre = MACHINE_TYPES.find(t => guess && guess.toLowerCase().includes(t.name.toLowerCase().split(' ')[0].toLowerCase()));
  openSheet(`<div class="sheet-head"><span class="badge-new">${icon(manual ? 'plus' : 'scan', 14, { stroke: 2.5 })} ${manual ? 'New machine' : 'New code scanned'}</span>
      <h2>What machine is this?</h2>
      ${!manual ? `<p class="muted small code">${esc(raw.length > 90 ? raw.slice(0, 90) + '…' : raw)}</p>` : ''}</div>
    <form id="newMachine" data-raw="${esc(raw)}">
      <label>Name</label><input name="name" value="${esc(guess)}" placeholder="e.g. Leg Press #2 (by the windows)" required autofocus>
      <label>Type</label>${typeGrid(pre ? pre.id : '')}
      <input type="hidden" name="type" value="${pre ? pre.id : ''}">
      <div class="custom-kind" ${pre && pre.id === 'other' ? '' : 'hidden'}>
        <label>Logged as</label><select name="kind"><option value="strength">Weight × reps</option><option value="cardio">Minutes (cardio)</option><option value="bodyweight">Reps only</option></select></div>
      <label>Where is it? <span class="muted">(optional)</span></label><input name="zone" placeholder="e.g. Cable zone, back wall">
      ${isUrl(raw) ? `<label class="check-line"><input type="checkbox" name="video" checked> This code opens a training video — keep a Training video button for it</label>` : ''}
      <button class="btn primary wide" type="submit">Save machine</button>
    </form>`);
}

export function editMachine(id) {
  const m = getMachines()[id];
  if (!m) return;
  const exs = Object.values(allExercises());
  openSheet(`<div class="sheet-head"><h2>Edit machine</h2></div>
    <form id="editMachine" data-id="${esc(id)}">
      <label>Name</label><input name="name" value="${esc(m.name)}" required>
      <label>Where is it?</label><input name="zone" value="${esc(m.zone || '')}">
      <label>Training video link</label><input name="video" value="${esc(m.video || '')}" placeholder="https://…">
      <label>Exercises on this machine</label>
      <div class="ex-checks">${exs.map(x => `<label class="check-line"><input type="checkbox" name="ex" value="${x.id}" ${m.exIds.includes(x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')}</div>
      <button class="btn primary wide" type="submit">Save</button>
      <button class="btn danger wide" type="button" data-act="deleteMachine" data-id="${esc(id)}">Forget this machine</button>
    </form>`);
}

export const actions = {
  newMachine: () => openNewMachine(null),
  openMachine: el => { const m = getMachines()[el.dataset.id]; if (m) openMachine(m); },
  editMachine: el => editMachine(el.dataset.id),
  pickType(el) {
    const f = el.closest('form');
    $$('.type', f).forEach(b => { b.classList.toggle('on', b === el); b.setAttribute('aria-checked', b === el); });
    f.elements.type.value = el.dataset.type;
    $('.custom-kind', f).hidden = el.dataset.type !== 'other';
    if (!f.elements.name.value.trim() && el.dataset.type !== 'other') f.elements.name.value = typeById(el.dataset.type).name;
  },
  deleteMachine(el) {
    if (!confirm('Forget this machine? Your logged sets stay in history.')) return;
    deleteMachine(el.dataset.id);
    closeSheet(); go('machines');
  },
  newExercise() {
    openSheet(`<div class="sheet-head"><h2>New exercise</h2><p class="muted small">For anything not in the library.</p></div>
      <form id="newExercise"><label class="lbl">Name</label><input name="name" placeholder="e.g. Cable lateral raise" required autofocus>
      <label class="lbl">Logged as</label><select name="kind"><option value="strength">Weight × reps</option><option value="cardio">Minutes (cardio)</option><option value="bodyweight">Reps only</option></select>
      <button class="btn primary wide" type="submit">Create &amp; log it</button></form>`);
  }
};

export const inputs = {
  search(el) {
    const q = el.value.trim().toLowerCase();
    $$('[data-search]').forEach(li => { li.hidden = q && !li.dataset.search.includes(q); });
  }
};

export const submits = {
  newExercise(form) {
    const name = form.elements.name.value.trim();
    if (!name) return;
    const id = addCustomExercise(name, form.elements.kind.value);
    closeSheet();
    go('log/' + id);
  },
  newMachine(form) {
    const f = form.elements;
    const name = f.name.value.trim();
    const typeId = f.type.value;
    if (!typeId) { toast('Pick a machine type', 'warn'); return; }
    const t = typeById(typeId);
    let exIds = t.ex.slice();
    if (t.custom) exIds = [addCustomExercise(name || 'Custom exercise', f.kind.value)];
    const raw = form.dataset.raw;
    const m = saveMachine({
      id: machineIdFor(raw), code: raw, name: name || t.name, type: t.id, exIds,
      video: f.video && f.video.checked ? safeUrl(raw) : '', zone: f.zone.value.trim(), created: Date.now()
    });
    closeSheet();
    toast(`Saved ${m.name}`);
    openMachine(m);
  },
  editMachine(form) {
    const f = form.elements;
    const video = f.video.value.trim();
    if (video && !safeUrl(video)) { toast('Video link must start with https://', 'warn'); return; }
    const old = getMachines()[form.dataset.id];
    if (!old) return;
    saveMachine({
      ...old,
      name: f.name.value.trim() || old.name,
      zone: f.zone.value.trim(),
      video: safeUrl(video),
      exIds: [...form.querySelectorAll('input[name=ex]:checked')].map(i => i.value).filter(id => exById(id))
    });
    closeSheet(); toast('Saved'); rerender();
  }
};
