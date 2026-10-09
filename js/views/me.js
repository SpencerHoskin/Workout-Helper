import { SESSIONS, DAYS, SUPPS, AVOID, PENDING } from '../catalog.js';
import { KEYS, save, getGoal, setGoal, getSettings, setSettings, getChecklist, getLog, getDaily, getLimits, getSupps, allExercises, exportAll, importAll, setTodaySession, markBackedUp, myHealth } from '../store.js';
import { HEALTH_STEPS, sendWeight, sendWorkout } from '../health.js';
import { esc, todayStr, csvCell } from '../util.js';
import { toast, download, PLATFORM } from '../ui.js';
import { go, rerender, current } from '../router.js';
import { applyTheme, applyProfile } from '../theme.js';
import { icon } from '../icons.js';

function suppStatus() {
  const st = getSupps();
  return Object.fromEntries(SUPPS.map(s => [s.id, st[s.id] || s.def]));
}
const statusPill = v => v === 'ok' ? '<span class="pill ok">cleared</span>' : v === 'no' ? '<span class="pill no">not approved</span>' : `<span class="pill pend">${PENDING}</span>`;

export function render(ctx) {
  const goal = getGoal();
  const set = getSettings();
  const mine = myHealth();
  const exs = Object.values(allExercises()).filter(x => x.kind === 'strength');
  const open = ctx.arg || 'goal';
  const sec = (id, ic, title, body) => `<details class="card sec" ${open === id ? 'open' : ''}><summary><h2>${icon(ic, 20)}${title}</h2></summary>${body}</details>`;

  const goalHtml = `
    <label class="lbl">Main goal</label>
    <select data-change="goal" name="type">${[['lose', 'Lose weight'], ['recomp', 'Recomp — lose fat, keep/add muscle'], ['strength', 'Get stronger'], ['general', 'General fitness']]
      .map(([v, l]) => `<option value="${v}" ${goal.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <div class="row"><div><label class="lbl">Target weight (lb)</label><input data-change="goal" name="targetWeight" inputmode="decimal" value="${esc(goal.targetWeight ?? '')}"></div>
      <div><label class="lbl">By (optional)</label><input data-change="goal" name="targetDate" type="date" value="${esc(goal.targetDate)}"></div></div>
    <label class="lbl">Workouts per week</label>
    <select data-change="goal" name="sessionsPerWeek">${[2, 3, 4, 5].map(n => `<option ${+goal.sessionsPerWeek === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div class="row"><div><label class="lbl">Strength goal lift</label><select data-change="goal" name="strengthEx">${exs.map(x => `<option value="${x.id}" ${goal.strengthEx === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <div style="flex:0 0 120px"><label class="lbl">e1RM target</label><input data-change="goal" name="strengthTarget" inputmode="decimal" placeholder="lb" value="${esc(goal.strengthTarget)}"></div></div>
    <label class="lbl">Your why (Claude reads this)</label><textarea data-change="goal" name="why">${esc(goal.why)}</textarea>`;

  const daily = getDaily();
  const d = daily[todayStr()] || { supps: {}, note: '' };
  const st = suppStatus();
  const dailyHtml = (mine ? SUPPS : []).map(s => `<div class="check"><input type="checkbox" data-supp="${s.id}" ${d.supps && d.supps[s.id] && st[s.id] === 'ok' ? 'checked' : ''} ${st[s.id] === 'ok' ? '' : 'disabled'} aria-label="${esc(s.name)} taken">
      <div class="body"><b>${esc(s.name)}</b>${statusPill(st[s.id])}<div class="muted small">${esc(s.note)}</div></div></div>`).join('') +
    `<label class="lbl">Note</label><textarea id="dNote" placeholder="Sleep, energy, anything odd…">${esc(d.note || '')}</textarea>
    <button class="btn primary wide" data-act="saveDaily">Save today</button>
    <button class="btn ghost wide" data-act="weighin">${icon('scale', 18)} Log bodyweight</button>`;

  const cl = getChecklist();
  const lim = getLimits();
  const doctorHtml = `<h3>Questions for the cardiologist</h3>${cl.map(c => `<div class="check"><input type="checkbox" data-change="clDone" data-id="${esc(c.id)}" ${c.done ? 'checked' : ''} aria-label="Answered">
      <div class="body"><div ${c.done ? 'class="struck"' : ''}>${esc(c.text)}</div>
      <input type="text" data-input="clNote" data-id="${esc(c.id)}" value="${esc(c.note)}" placeholder="Answer / notes"></div>
      <button class="icon-btn danger" data-act="delCl" data-id="${esc(c.id)}" aria-label="Remove question">${icon('close', 15, { stroke: 2.5 })}</button></div>`).join('')}
    <div class="row"><input id="newCl" placeholder="Add a question"><button class="btn fit" data-act="addCl">Add</button></div>
    <h3>Cleared limits</h3><p class="muted small">Fill in only what the cardiologist actually tells you. Blank = ${PENDING}.</p>
    ${[['load', 'Lifting load limit'], ['intensity', 'Intensity / heart-rate guidance'], ['other', 'Other instructions']].map(([k, l]) =>
      `<label class="lbl">${l}</label><input data-input="lim" data-k="${k}" value="${esc(lim[k] || '')}" placeholder="${PENDING}">`).join('')}
    <h3>Supplement clearance</h3>${SUPPS.map(s => `<label class="lbl">${esc(s.name)}</label><select data-change="suppSt" data-id="${s.id}">
      ${['pending', 'ok', 'no'].map(v => `<option value="${v}" ${st[s.id] === v ? 'selected' : ''}>${v === 'pending' ? PENDING : v === 'ok' ? 'Cleared' : 'Not approved'}</option>`).join('')}</select>`).join('')}
    <h3>Avoid / dropped</h3><ul class="muted small">${AVOID.map(a => `<li>${esc(a)}</li>`).join('')}</ul>`;

  const ex = allExercises();
  const planHtml = `<p class="muted small">3 full-body sessions, ~45 min, machine &amp; cable heavy. Effort by <b>RPE</b>, not heart rate: aim for 5–7 — the last reps feel like work, but you could do 2–3 more and still talk in short sentences.</p>` +
    Object.entries(SESSIONS).map(([id, s]) => `<h3>${DAYS[s.day]} — ${esc(s.name)}</h3><ul>${s.ex.map(e => `<li>${esc(ex[e].name)} <span class="muted small">— ${ex[e].kind === 'cardio' ? esc(ex[e].target) : ex[e].sets + ' × ' + esc(ex[e].reps)}</span></li>`).join('')}</ul>
      <button class="btn small" data-act="startSession" data-sid="${id}">Do this session today</button>`).join('') +
    `<h3>Not in this plan (on purpose)</h3><ul class="muted small"><li>Box jumps / plyometrics — fall &amp; impact risk</li><li>Heavy overhead dumbbells without a spotter</li><li>Max-effort lifts or anything that makes you strain/hold your breath</li></ul>`;

  const healthHtml = HEALTH_STEPS + `
    <label class="switch"><input type="checkbox" data-change="healthOn" ${set.health.enabled ? 'checked' : ''}><span></span> Apple Health buttons on</label>
    <div class="row"><div><label class="lbl">Weight shortcut</label><input data-change="healthName" data-k="weightShortcut" value="${esc(set.health.weightShortcut)}"></div>
      <div><label class="lbl">Workout shortcut</label><input data-change="healthName" data-k="workoutShortcut" value="${esc(set.health.workoutShortcut)}"></div></div>
    <div class="row btn-row"><button class="btn small" data-act="testHealthW">Test weight</button><button class="btn small" data-act="testHealthWo">Test workout</button></div>`;

  const coachHtml = `<p class="muted small">Coach Claude runs on your own Vercel deployment. Your Anthropic API key lives in Vercel, never on this phone.</p>
    <label class="lbl">Coach passcode</label><input type="password" data-change="setting" data-k="coachPass" value="${esc(set.coachPass)}" placeholder="Same as COACH_PASSCODE in Vercel" autocomplete="off">
    <label class="lbl">Coach URL</label><input data-change="setting" data-k="coachUrl" value="${esc(set.coachUrl)}">`;

  const appHtml = `
    <label class="lbl">Gym</label><input data-change="setting" data-k="gymName" value="${esc(set.gymName)}">
    <label class="lbl">Rest timer (seconds)</label><select data-change="setting" data-k="restSec">${[60, 75, 90, 120, 150, 180].map(n => `<option ${+set.restSec === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label class="switch"><input type="checkbox" data-change="myHealth" ${mine ? 'checked' : ''}><span></span> My health profile</label>
    <p class="muted small">Adds the cardiologist plan, supplement clearance, bleeding-risk safety notes and the “Brother” voice. Leave it off if you’re a friend trying Kiln.</p>
    <label class="lbl">Theme</label><select data-change="setting" data-k="theme">${[['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}" ${set.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <h3>Your data</h3><p class="muted small">Everything is stored on this phone. Back it up now and then${PLATFORM === 'ios' ? ' (save it to Files or iCloud Drive)' : PLATFORM === 'android' ? ' (it lands in Downloads; keep a copy in Google Drive)' : ''}. Backups never include your coach passcode.</p>
    <div class="row btn-row"><button class="btn small" data-act="exportJson">${icon('download', 16)} Backup</button>
      <label class="btn small">${icon('upload', 16)} Restore<input type="file" accept="application/json,.json" data-change="importJson" hidden></label>
      <button class="btn small" data-act="exportCsv">${icon('file', 16)} CSV</button></div>`;

  return `<section class="card me-hero"><div class="eyebrow">You</div><h2 class="big">Goal: ${esc({ lose: 'lose weight', recomp: 'recomp', strength: 'get stronger', general: 'general fitness' }[goal.type])}${goal.targetWeight ? ' · ' + esc(goal.targetWeight) + ' lb' : ''}</h2>
      ${goal.why ? `<p class="hero-sub">${esc(goal.why)}</p>` : ''}</section>` +
    sec('goal', 'target', 'Goal', goalHtml) +
    sec('daily', 'check', 'Daily check', dailyHtml) +
    (mine ? sec('doctor', 'doctor', 'Doctor', doctorHtml) : '') +
    sec('plan', 'calendar', 'Weekly plan', planHtml) +
    // Apple Health works through the Shortcuts app, which only exists on iPhone.
    (PLATFORM === 'ios' ? sec('health', 'heart', 'Apple Health', healthHtml) : '') +
    sec('coach', 'sparkle', 'Coach Claude setup', coachHtml) +
    sec('settings', 'gear', 'Settings &amp; data', appHtml);
}

export const changes = {
  goal(el) {
    const g = getGoal();
    g[el.name] = ['targetWeight', 'sessionsPerWeek'].includes(el.name) ? (el.value === '' ? '' : Number(el.value)) : el.value;
    setGoal(g);
    toast('Goal saved');
  },
  clDone(el) {
    const cl = getChecklist();
    const c = cl.find(x => x.id === el.dataset.id);
    if (c) c.done = el.checked;
    save(KEYS.checklist, cl);
    rerender({ keepScroll: true });
  },
  suppSt(el) {
    save(KEYS.supps, { ...getSupps(), [el.dataset.id]: el.value });
    toast('Saved');
  },
  setting(el) {
    const s = getSettings();
    s[el.dataset.k] = el.dataset.k === 'restSec' ? Number(el.value) : el.value.trim();
    setSettings(s);
    if (el.dataset.k === 'theme') applyTheme();
    toast('Saved');
  },
  myHealth(el) {
    setSettings({ ...getSettings(), myHealth: el.checked });
    applyProfile();
    toast(el.checked ? 'My health profile on' : 'My health profile off');
    rerender({ keepScroll: true });
  },
  healthOn(el) {
    const s = getSettings();
    s.health.enabled = el.checked;
    setSettings(s);
    toast(el.checked ? 'Apple Health buttons on' : 'Apple Health buttons off');
  },
  healthName(el) {
    const s = getSettings();
    s.health[el.dataset.k] = el.value.trim();
    setSettings(s);
  },
  async importJson(el) {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!confirm('Replace data on this phone with the backup?')) return;
      importAll(obj);
      applyTheme();
      applyProfile();
      toast('Restored');
      go('today');
    } catch (e) {
      alert('Restore failed: ' + e.message);
    } finally { el.value = ''; }
  }
};

export const inputs = {
  clNote(el) {
    const cl = getChecklist();
    const c = cl.find(x => x.id === el.dataset.id);
    if (c) c.note = el.value;
    save(KEYS.checklist, cl);
  },
  lim(el) {
    const lim = getLimits();
    lim[el.dataset.k] = el.value.trim();
    save(KEYS.limits, lim);
  }
};

export const actions = {
  saveDaily() {
    const all = { ...getDaily() };
    const prev = all[todayStr()] || {};
    const boxes = document.querySelectorAll('[data-supp]');
    const supps = boxes.length ? {} : { ...(prev.supps || {}) }; // no boxes shown (profile off) → keep today's ticks
    boxes.forEach(c => { supps[c.dataset.supp] = c.checked; });
    all[todayStr()] = { ...prev, supps, note: document.getElementById('dNote').value.trim() };
    save(KEYS.daily, all);
    toast('Saved');
  },
  addCl() {
    const inp = document.getElementById('newCl');
    const txt = inp.value.trim();
    if (!txt) return;
    const cl = getChecklist();
    cl.push({ id: 'c' + Date.now(), text: txt, done: false, note: '' });
    save(KEYS.checklist, cl);
    rerender({ keepScroll: true });
  },
  delCl(el) {
    if (!confirm('Remove this question?')) return;
    save(KEYS.checklist, getChecklist().filter(c => c.id !== el.dataset.id));
    rerender({ keepScroll: true });
  },
  startSession(el) { setTodaySession(el.dataset.sid); go('today'); },
  testHealthW: () => sendWeight(180),
  testHealthWo: () => sendWorkout(1),
  exportJson() {
    download(`kiln-backup-${todayStr()}.json`, JSON.stringify(exportAll(), null, 1));
    markBackedUp();
    if (current().name === 'today') rerender({ keepScroll: true }); // drop the reminder card
  },
  exportCsv() {
    const ex = allExercises();
    const rows = [['date', 'exercise', 'set', 'weight_lb', 'reps', 'rpe', 'minutes', 'machine', 'note']];
    for (const e of getLog()) e.sets.forEach((s, i) => rows.push([e.date, ex[e.exId] ? ex[e.exId].name : e.exId, i + 1, s.w ?? '', s.r ?? '', s.rpe ?? '', s.min ?? '', e.machineId || '', i === 0 ? e.note || '' : '']));
    download(`kiln-log-${todayStr()}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  }
};
