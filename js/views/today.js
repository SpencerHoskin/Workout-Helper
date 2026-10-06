import { SESSIONS, DAYS } from '../catalog.js';
import { getLog, getGoal, getSettings, getWeighins, exById, todaySession, setTodaySession, getMeta } from '../store.js';
import { exerciseHistory, suggestNext, weekStats, weekStreak } from '../analytics.js';
import { ringsSvg } from '../charts.js';
import { lastCoach } from '../coach.js';
import { healthOn, sendWorkout, workoutMinutesToday } from '../health.js';
import { esc, todayStr, fmtNum } from '../util.js';
import { rerender } from '../router.js';

export function suggestedSession() {
  const dow = new Date().getDay();
  for (const [id, s] of Object.entries(SESSIONS)) if (s.day === dow) return id;
  return null;
}
export function activeSession() {
  const picked = todaySession();
  return picked === undefined ? suggestedSession() : picked;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 7) return '5am club, Brother 🌅';
  if (h < 12) return 'Morning, Brother ☀️';
  if (h < 17) return 'Afternoon, Brother 💥';
  return 'Evening, Brother 🌙';
}

export function render() {
  const date = todayStr();
  const goal = getGoal();
  const log = getLog();
  const sid = activeSession();
  const s = sid && SESSIONS[sid];
  const todayLog = log.filter(e => e.date === date);
  const ws = weekStats(log, getWeighins(), date);
  const streak = weekStreak(log, date, goal.sessionsPerWeek);
  const planned = s ? s.ex.map(exById).filter(x => x && x.kind !== 'cardio') : [];
  const plannedSets = planned.reduce((t, x) => t + (x.sets || 0), 0);
  const setsToday = todayLog.reduce((t, e) => t + e.sets.length, 0);

  const ringData = [
    { value: setsToday, goal: plannedSets || 12, grad: ['#ff8a3d', '#ff3d7f'], label: 'Sets today' },
    { value: ws.sessions, goal: goal.sessionsPerWeek, grad: ['#b6f03c', '#10b981'], label: 'Workouts this week' },
    { value: ws.weighins, goal: 2, grad: ['#22d3ee', '#6d4aff'], label: 'Weigh-ins this week' }
  ];

  let h = `<section class="card hero sig">
    <div class="hero-top"><div>
      <div class="eyebrow">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }))} · ${esc(getSettings().gymName)}</div>
      <h2 class="big">${greeting()}</h2>
      <div class="hero-sub">${s ? `${esc(s.name)} today · ${planned.length} lifts` : 'Rest day — or pick a session'}</div>
    </div></div>
    <div class="ring-row">${ringsSvg(ringData)}
      <ul class="ring-legend">${ringData.map(r => `<li><i style="background:linear-gradient(135deg,${r.grad[0]},${r.grad[1]})"></i><b>${r.value}/${r.goal}</b> ${esc(r.label)}</li>`).join('')}</ul>
    </div>
  </section>

  <button class="cta" data-act="go" data-to="scan"><span class="cta-ic">📷</span><span><b>Scan a machine</b><small>Point at the QR code to log sets</small></span></button>

  <div class="tiles">
    <div class="tile t-orange"><b>${streak}</b><span>week streak 🔥</span></div>
    <div class="tile t-violet"><b>${ws.sessions}/${goal.sessionsPerWeek}</b><span>workouts this week</span></div>
    <div class="tile t-teal"><b>${fmtNum(ws.volume / 1000, 1)}k</b><span>lb moved this week</span></div>
  </div>

  <section class="card">
    <div class="row-between"><h2>Today's plan</h2>
      <select class="pill-select" data-change="pickSession" aria-label="Session">
        <option value="" ${!sid ? 'selected' : ''}>Rest day</option>
        ${Object.entries(SESSIONS).map(([id, x]) => `<option value="${id}" ${id === sid ? 'selected' : ''}>${DAYS[x.day]} · ${esc(x.name)}</option>`).join('')}
      </select></div>`;

  if (s) {
    let n = 0;
    h += '<ul class="plan">';
    for (const exId of s.ex) {
      const ex = exById(exId);
      if (!ex) continue;
      const done = todayLog.find(e => e.exId === exId);
      const nSets = done ? done.sets.length : 0;
      if (ex.kind === 'cardio') {
        h += `<li><a href="#/log/${exId}" class="plan-row cardio ${nSets ? 'done' : ''}"><span class="num">${nSets ? '✓' : esc(ex.icon || '🏃')}</span>
          <span class="plan-main"><b>${esc(ex.name)}</b><small>${esc(ex.target || '')}</small></span><span class="chev">›</span></a></li>`;
        continue;
      }
      n++;
      const sug = suggestNext(ex, exerciseHistory(log, ex));
      h += `<li><a href="#/log/${exId}" class="plan-row ${nSets >= ex.sets ? 'done' : nSets ? 'partial' : ''}">
        <span class="num">${nSets >= ex.sets ? '✓' : n}</span>
        <span class="plan-main"><b>${esc(ex.name)}</b><small>${nSets ? `${nSets}/${ex.sets} sets logged` : esc(sug.text)}</small></span>
        <span class="chev">›</span></a></li>`;
    }
    h += '</ul>';
  } else {
    h += `<p class="muted">Recovery matters as much as the work. A walk is always fair game.</p>`;
  }
  const extra = todayLog.filter(e => !s || !s.ex.includes(e.exId));
  if (extra.length) {
    h += `<h3>Also today</h3><ul class="plan">${extra.map(e => {
      const ex = exById(e.exId);
      return `<li><a href="#/log/${e.exId}${e.machineId ? '?m=' + e.machineId : ''}" class="plan-row done"><span class="num">✓</span>
        <span class="plan-main"><b>${esc(ex ? ex.name : e.exId)}</b><small>${e.sets.length} sets</small></span><span class="chev">›</span></a></li>`;
    }).join('')}</ul>`;
  }
  h += '</section>';

  if (healthOn() && setsToday) {
    h += `<button class="btn ghost wide" data-act="healthWorkout">❤️ Send today's workout to Apple Health</button>`;
  }

  // Data lives only on this phone — nudge a backup every 2 weeks once there's something worth keeping.
  const lastBackup = getMeta().lastBackup || 0;
  if (new Set(log.map(e => e.date)).size >= 6 && Date.now() - lastBackup > 14 * 864e5) {
    h += `<section class="card backup-card"><b>💾 Back up your logbook</b>
      <p class="muted small">Everything lives on this phone. ${lastBackup ? 'Last backup ' + Math.floor((Date.now() - lastBackup) / 864e5) + ' days ago.' : 'No backup yet.'} Save a copy to Files or iCloud Drive.</p>
      <button class="btn small" data-act="exportJson">⬇️ Back up now</button></section>`;
  }

  const c = lastCoach();
  h += `<a class="card coach-card" href="#/progress/coach">
    <div class="eyebrow">Coach Claude</div>
    ${c ? `<b>${esc(c.report.headline)}</b><p class="muted">${esc(c.report.goal_forecast.summary)}</p>`
        : `<b>Get your forecast</b><p class="muted">Claude reads your log + scale weigh-ins and maps the best path to your goal.</p>`}
    <span class="link">Open coach ›</span></a>`;
  return h;
}

export const changes = {
  pickSession(el) {
    setTodaySession(el.value || null);
    rerender();
  }
};

export const actions = {
  healthWorkout() {
    sendWorkout(workoutMinutesToday(getLog()));
  }
};
