import { KEYS, load, save, getLog, getGoal, getWeighins, setWeighins, allExercises, exById, getChecklist } from '../store.js';
import { exerciseHistory, forecast, weightPoints, movingAverage } from '../analytics.js';
import { lineChart } from '../charts.js';
import { askCoach, lastCoach, promptText } from '../coach.js';
import { healthOn, sendWeight } from '../health.js';
import { esc, todayStr, shortDate, fromDayNum, dayNum, num, fmtNum, uid } from '../util.js';
import { $, openSheet, closeSheet, toast } from '../ui.js';
import { go, rerender } from '../router.js';

const C1 = 'var(--c1)', C2 = 'var(--c2)';
const xFmt = x => shortDate(fromDayNum(x));

export function render(ctx) {
  const seg = ['strength', 'body', 'coach'].includes(ctx.arg) ? ctx.arg : 'strength';
  const tabs = `<nav class="seg" aria-label="Progress sections">${[['strength', '💪 Strength'], ['body', '⚖️ Body'], ['coach', '✨ Coach']].map(([id, label]) =>
    `<a href="#/progress/${id}" class="${seg === id ? 'on' : ''}" ${seg === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  return tabs + (seg === 'strength' ? strength(ctx) : seg === 'body' ? body() : coach());
}

/* ---------- Strength ---------- */
function strengthState(ctx) {
  const log = getLog();
  const exs = allExercises();
  const used = [...new Set(log.slice().reverse().map(e => e.exId))].filter(id => exs[id] && exs[id].kind !== 'cardio');
  const exId = used.includes(ctx.query.ex) ? ctx.query.ex : used[0];
  return { log, used, ex: exId ? exs[exId] : null, exs };
}

function strength(ctx) {
  const { log, used, ex, exs } = strengthState(ctx);
  if (!ex) return `<div class="card empty"><div class="empty-ic">📈</div><b>No lifts logged yet</b><p class="muted">Scan a machine and log a few sets — your strength curve shows up here.</p>
    <a class="btn primary" href="#/scan">📷 Scan a machine</a></div>`;
  const hist = exerciseHistory(log, ex);
  const metric = ex.assisted ? 'assist' : ex.kind === 'bodyweight' ? 'reps' : 'e1rm';
  const pts = hist.map(h => ({ x: h.x, y: h[metric] })).filter(p => Number.isFinite(p.y));
  const goal = getGoal();
  const target = goal.strengthEx === ex.id && num(goal.strengthTarget) ? num(goal.strengthTarget) : null;
  const fc = forecast(pts, { target });
  const label = { e1rm: 'Estimated 1-rep max', assist: 'Assistance needed (lower = stronger)', reps: 'Total reps' }[metric];
  const unit = metric === 'reps' ? 'reps' : 'lb';

  let h = `<section class="card"><label class="lbl">Exercise</label>
    <select data-change="pickEx">${used.map(id => `<option value="${id}" ${id === ex.id ? 'selected' : ''}>${esc(exs[id].name)}</option>`).join('')}</select></section>
  <div class="tiles">
    <div class="tile t-orange"><b>${pts.length ? fmtNum(metric === 'assist' ? Math.min(...pts.map(p => p.y)) : Math.max(...pts.map(p => p.y)), 0) : '–'}</b><span>best ${metric === 'e1rm' ? 'e1RM' : metric}</span></div>
    <div class="tile t-violet"><b>${hist.length ? Math.max(...hist.map(x => x.topW)) || '–' : '–'}</b><span>heaviest lb</span></div>
    <div class="tile t-teal"><b>${fc ? (fc.perWeek > 0 ? '+' : '') + fmtNum(fc.perWeek, 1) : '–'}</b><span>${unit}/week trend</span></div>
  </div>
  <section class="card"><h2>${esc(label)}</h2><p class="muted small">${esc(ex.name)} · dashed = forecast</p>
    <div class="chart" data-chart="strength"></div>
    <p class="forecast">${forecastText(fc, metric, unit, target, pts)}</p></section>
  <section class="card"><h2>Sessions</h2><table class="hist"><thead><tr><th>Date</th><th>Sets</th>${metric === 'e1rm' ? '<th class="num">e1RM</th>' : ''}</tr></thead><tbody>
    ${hist.slice().reverse().map(x => `<tr><td>${shortDate(x.date)}</td><td>${x.sets.map(s => `${s.w ?? ''}${s.w != null ? '×' : ''}${s.r}${s.rpe ? '@' + s.rpe : ''}`).join(', ')}</td>
      ${metric === 'e1rm' ? `<td class="num">${fmtNum(x.e1rm, 0)}</td>` : ''}</tr>`).join('')}</tbody></table></section>`;
  return h;
}

function forecastText(fc, metric, unit, target, pts) {
  if (!fc) return `🔮 Log ${Math.max(1, 3 - pts.length)} more session${3 - pts.length === 1 ? '' : 's'} (over a week or more) to unlock the forecast.`;
  const better = metric === 'assist' ? fc.perWeek < 0 : fc.perWeek > 0;
  let t = `🔮 Trend: <b>${fc.perWeek > 0 ? '+' : ''}${fmtNum(fc.perWeek, 1)} ${unit}/week</b> ${better ? '— moving the right way.' : '— flat or slipping; check sleep, food and consistency.'}`;
  t += ` In 8 weeks: ~<b>${fmtNum(fc.to.y, 0)} ${unit}</b>.`;
  if (target) t += fc.etaDate ? ` Goal ${target} ${unit}: around <b>${shortDate(fc.etaDate)}</b>.` : ` Goal ${target} ${unit}: not reachable on the current trend yet.`;
  if (fc.r2 < 0.3) t += ' <span class="muted">(noisy data — low confidence)</span>';
  return t;
}

/* ---------- Body ---------- */
function bodyState() {
  const goal = getGoal();
  const wins = getWeighins();
  const pts = weightPoints(wins);
  const avg = movingAverage(pts);
  const fc = forecast(avg, { target: goal.targetWeight || null, windowDays: 42 });
  return { goal, wins, pts, avg, fc };
}

function body() {
  const { goal, wins, pts, avg, fc } = bodyState();
  const cur = avg.length ? avg[avg.length - 1].y : null;
  const monthAgo = avg.filter(p => p.x <= dayNum(todayStr()) - 30).pop();
  const pctWeek = fc && cur ? Math.abs(fc.perWeek) / cur * 100 : 0;
  const lastBf = [...wins].reverse().find(w => w.bodyFat);
  let h = `<button class="cta" data-act="weighin"><span class="cta-ic">⚖️</span><span><b>Log a weigh-in</b><small>Step on the Crunch scale, punch in the number</small></span></button>
  <div class="tiles">
    <div class="tile t-violet"><b>${cur ? fmtNum(cur, 1) : '–'}</b><span>lb (7-day avg)</span></div>
    <div class="tile t-orange"><b>${cur && monthAgo ? (cur - monthAgo.y > 0 ? '+' : '') + fmtNum(cur - monthAgo.y, 1) : '–'}</b><span>lb vs 30 days ago</span></div>
    <div class="tile t-teal"><b>${lastBf ? fmtNum(lastBf.bodyFat, 1) + '%' : '–'}</b><span>body fat (last)</span></div>
  </div>`;
  if (!pts.length) {
    return h + `<div class="card empty"><div class="empty-ic">⚖️</div><b>No weigh-ins yet</b><p class="muted">Weigh in 2–3× a week, same time of day (e.g. right when you get to the gym). The 7-day average smooths out water-weight noise.</p></div>`;
  }
  h += `<section class="card"><h2>Bodyweight</h2><p class="muted small">Dots = each weigh-in · line = 7-day average · dashed = forecast</p>
    <div class="chart" data-chart="body"></div>
    <p class="forecast">${bodyForecastText(fc, goal, cur)}</p>
    ${pctWeek > 1 ? `<div class="flag">⚠ Changing ${fmtNum(pctWeek, 1)}% of bodyweight per week — faster than the ~1%/week safe ceiling. Mention it to your doctor.</div>` : ''}
  </section>
  <section class="card"><div class="row-between"><h2>Weigh-ins</h2>${healthOn() && wins.length ? '<button class="btn small" data-act="healthWeight">❤️ Send latest to Health</button>' : ''}</div>
  <table class="hist"><tbody>${wins.slice(-20).reverse().map(w => `<tr><td>${shortDate(w.date)}</td><td><b>${fmtNum(w.weight, 1)} lb</b>
    ${w.bodyFat ? ` · ${fmtNum(w.bodyFat, 1)}% fat` : ''}${w.muscle ? ` · ${fmtNum(w.muscle, 1)} lb muscle` : ''}<div class="muted small">${esc(sourceLabel(w.source))}${w.note ? ' · ' + esc(w.note) : ''}</div></td>
    <td><button class="icon-btn danger" data-act="delWeighin" data-id="${esc(w.id)}" aria-label="Delete weigh-in">✕</button></td></tr>`).join('')}</tbody></table></section>`;
  return h;
}

const sourceLabel = s => ({ gym: 'Crunch scale', home: 'Home scale', daily: 'Daily check', health: 'Apple Health' }[s] || s || '');

function bodyForecastText(fc, goal, cur) {
  if (!fc) return '🔮 A few more weigh-ins across 1–2 weeks unlock the forecast.';
  let t = `🔮 Trend: <b>${fc.perWeek > 0 ? '+' : ''}${fmtNum(fc.perWeek, 2)} lb/week</b>.`;
  if (goal.targetWeight && cur) {
    const diff = goal.targetWeight - cur;
    if (Math.abs(diff) < 1) t += ` You’re at your ${goal.targetWeight} lb goal — now it’s about recomposition. 💪`;
    else if (fc.etaDate) t += ` At this pace you reach <b>${goal.targetWeight} lb around ${shortDate(fc.etaDate)}</b>.`;
    else t += ` Trend isn’t heading toward ${goal.targetWeight} lb yet${goal.type === 'recomp' ? ' — fine for a recomp if lifts are climbing' : ''}.`;
  }
  return t;
}

export function openWeighin() {
  openSheet(`<div class="sheet-head"><span class="badge-new">⚖️ Weigh-in</span><h2>What does the scale say?</h2></div>
    <form id="weighin" autocomplete="off">
      <div class="row"><div><label class="lbl">Weight</label><input name="weight" inputmode="decimal" placeholder="e.g. 182.4" required autofocus></div>
        <div style="flex:0 0 110px"><label class="lbl">Unit</label><select name="unit"><option value="lb">lb</option><option value="kg">kg</option></select></div></div>
      <div class="row"><div><label class="lbl">Body fat % <span class="muted">(opt.)</span></label><input name="bodyFat" inputmode="decimal" placeholder="—"></div>
        <div><label class="lbl">Muscle mass <span class="muted">(opt.)</span></label><input name="muscle" inputmode="decimal" placeholder="same unit"></div></div>
      <label class="lbl">Scale</label><select name="source"><option value="gym">Crunch scale</option><option value="home">Home scale</option></select>
      <label class="lbl">Note</label><input name="note" placeholder="Before workout, shoes on…">
      <button class="btn primary wide" type="submit">Save weigh-in</button>
    </form>`);
}

/* ---------- Coach ---------- */
function coach() {
  const c = lastCoach();
  let h = `<section class="card g-aurora coach-ask">
    <div class="eyebrow">✨ Coach Claude</div>
    <h2>Analyze &amp; forecast</h2>
    <p>Claude reads your machine log, scale weigh-ins and goal, then maps the best path forward — within your cardiologist-safe limits.</p>
    <form id="coach"><textarea name="q" rows="2" placeholder="Optional: ask something (“Should I add a 4th day?”)"></textarea>
    <button class="btn white wide" type="submit" id="coachBtn">✨ Analyze my training</button></form>
    <button class="btn glass wide" data-act="copyPrompt">📋 Copy for the Claude app instead</button>
  </section>`;
  if (c) h += reportHtml(c);
  else h += `<p class="muted small center">No report yet. The more sessions and weigh-ins you log, the sharper the forecast.</p>`;
  return h;
}

function reportHtml(c) {
  const r = c.report;
  const conf = { low: '🟡 low', medium: '🟢 medium', high: '💚 high' }[r.goal_forecast.confidence] || r.goal_forecast.confidence;
  const open = new Set(getChecklist().map(x => x.text));
  return `<section class="card report">
    <div class="eyebrow">${new Date(c.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${c.question ? ' · “' + esc(c.question) + '”' : ''}</div>
    <h2 class="big grad-text">${esc(r.headline)}</h2>
    <p>${esc(r.assessment)}</p>
    <div class="forecast-box"><b>🔮 Forecast</b><p>${esc(r.goal_forecast.summary)}</p>
      <small>${r.goal_forecast.projected_date ? 'Target date: <b>' + esc(r.goal_forecast.projected_date) + '</b> · ' : ''}confidence ${conf}</small></div>
  </section>
  ${r.safety_flags.length ? `<section class="card caution-card"><h2>⚠️ Safety</h2><ul>${r.safety_flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
  <section class="card"><h2>🎯 Next session</h2><ul class="targets">${r.next_session.map(t => `<li>
    <a href="${exById(t.exercise_id) ? '#/log/' + esc(t.exercise_id) : '#/machines'}"><b>${esc(t.exercise)}</b>
    <span class="tgt">${t.sets} × ${esc(t.reps)}${t.weight_lb ? ' @ ' + t.weight_lb + ' lb' : ''}</span></a>
    <small class="muted">${esc(t.note)}</small></li>`).join('')}</ul></section>
  <section class="card"><h2>🗓️ Next 4 weeks</h2><ol class="weeks">${r.four_week_plan.map(w => `<li><b>Week ${w.week}: ${esc(w.focus)}</b><p class="muted small">${esc(w.details)}</p></li>`).join('')}</ol></section>
  <section class="card"><h2>🌱 Habits</h2><ul>${r.habits.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
  ${r.questions_for_doctor.length ? `<section class="card"><h2>🩺 Ask your doctor</h2><ul class="qlist">${r.questions_for_doctor.map(q => `<li>${esc(q)}
    ${open.has(q) ? '<span class="pill ok">on checklist</span>' : `<button class="btn small" data-act="addDocQ" data-q="${esc(q)}">＋ Checklist</button>`}</li>`).join('')}</ul></section>` : ''}
  <p class="muted small center">Model: ${esc(c.model || '')} · Coaching, not medical advice.</p>`;
}

/* ---------- Charts ---------- */
export function mount(root, ctx) {
  const el = root.querySelector('[data-chart]');
  if (!el) return;
  if (el.dataset.chart === 'strength') {
    const { log, ex } = strengthState(ctx);
    const hist = exerciseHistory(log, ex);
    const metric = ex.assisted ? 'assist' : ex.kind === 'bodyweight' ? 'reps' : 'e1rm';
    const pts = hist.map(h => ({ x: h.x, y: h[metric] })).filter(p => Number.isFinite(p.y));
    const goal = getGoal();
    const target = goal.strengthEx === ex.id && num(goal.strengthTarget) ? num(goal.strengthTarget) : null;
    const fc = forecast(pts, { target });
    lineChart(el, {
      label: ex.name,
      series: [
        { name: metric === 'e1rm' ? 'e1RM' : metric, color: C2, type: 'line', points: pts },
        ...(fc ? [{ name: 'Forecast', color: C2, type: 'dash', points: [fc.from, fc.to].map(p => ({ x: p.x, y: Math.round(p.y) })) }] : [])
      ],
      refs: target ? [{ y: target, label: 'Goal ' + target }] : [],
      xFmt, yFmt: v => fmtNum(v, 0), unit: metric === 'reps' ? 'reps' : 'lb', endLabel: 0
    });
  } else {
    const { goal, pts, avg, fc } = bodyState();
    lineChart(el, {
      label: 'Bodyweight',
      series: [
        { name: 'Weigh-in', color: C2, type: 'dots', points: pts },
        { name: '7-day avg', color: C1, type: 'line', points: avg.map(p => ({ x: p.x, y: Math.round(p.y * 10) / 10 })) },
        ...(fc ? [{ name: 'Forecast', color: C1, type: 'dash', points: [fc.from, fc.to].map(p => ({ x: p.x, y: Math.round(p.y * 10) / 10 })) }] : [])
      ],
      refs: goal.targetWeight ? [{ y: goal.targetWeight, label: 'Goal ' + goal.targetWeight }] : [],
      xFmt, yFmt: v => fmtNum(v, 1), unit: 'lb', endLabel: 1
    });
  }
}

/* ---------- Events ---------- */
export const changes = {
  pickEx(el) { go('progress/strength?ex=' + el.value, { replace: true }); }
};

export const actions = {
  weighin: () => openWeighin(),
  delWeighin(el) {
    if (!confirm('Delete this weigh-in?')) return;
    setWeighins(getWeighins().filter(w => w.id !== el.dataset.id));
    rerender({ keepScroll: true });
  },
  healthWeight() {
    const w = getWeighins().pop();
    if (w) sendWeight(w.weight);
  },
  async copyPrompt() {
    try { await navigator.clipboard.writeText(promptText()); toast('Copied — paste it into the Claude app 📋'); }
    catch { toast('Copy failed — your browser blocked the clipboard', 'warn'); }
  },
  addDocQ(el) {
    const cl = getChecklist();
    cl.push({ id: 'c' + Date.now(), text: el.dataset.q, done: false, note: '' });
    save(KEYS.checklist, cl);
    toast('Added to the doctor checklist 🩺');
    rerender({ keepScroll: true });
  }
};

export const submits = {
  weighin(form) {
    const f = form.elements;
    const k = f.unit.value === 'kg' ? 2.20462 : 1;
    const weight = num(f.weight.value);
    if (!(weight > 0)) return toast('Enter your weight', 'warn');
    const lb = Math.round(weight * k * 10) / 10;
    const muscle = num(f.muscle.value);
    const w = { id: uid('w'), date: todayStr(), ts: Date.now(), weight: lb, bodyFat: num(f.bodyFat.value),
      muscle: muscle ? Math.round(muscle * k * 10) / 10 : null, source: f.source.value, note: f.note.value.trim() };
    setWeighins(getWeighins().concat(w));
    closeSheet();
    if (location.hash.indexOf('progress/body') < 0) go('progress/body'); else rerender();
    if (healthOn()) {
      openSheet(`<div class="sheet-head"><h2>Saved ${lb} lb ✅</h2><p class="muted">Send it to Apple Health too?</p></div>
        <button class="btn primary wide" data-act="healthWeight">❤️ Send to Apple Health</button>
        <button class="btn ghost wide" data-act="closeSheet">Not now</button>`);
    } else toast(`Saved ${lb} lb ⚖️`);
  },
  async coach(form) {
    const btn = $('#coachBtn');
    const q = form.elements.q.value.trim();
    btn.disabled = true;
    const lines = ['Reading your logbook…', 'Crunching the trend lines…', 'Checking your safety limits…', 'Mapping your next 4 weeks…'];
    let i = 0;
    btn.textContent = '✨ ' + lines[0];
    const spin = setInterval(() => { btn.textContent = '✨ ' + lines[++i % lines.length]; }, 2500);
    try {
      await askCoach(q);
      toast('Coach report ready ✨');
      rerender();
    } catch (e) {
      toast(e.message, 'warn');
      btn.disabled = false;
      btn.textContent = '✨ Analyze my training';
    } finally {
      clearInterval(spin);
    }
  }
};
