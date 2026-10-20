// Food: swipe left from Today. Snap a meal (Claude estimates calories and macros from the photo), check and
// save it, see the day against your targets and the last 7 days, and ask Coach Claude about your eating.
import { getMeals, addMeal, updateMeal, deleteMeal, getGoal, setGoalField, getSettings, myHealth } from '../store.js';
import { dayTotals, mealsOn, mealTotals, lastDays, average, recentMeals } from '../nutrition.js';
import { preparePhoto, estimateMeal } from '../photo.js';
import { askCoach, lastCoach } from '../coach.js';
import { esc, num, todayStr, dayNum, fromDayNum, shortDate, fmtNum } from '../util.js';
import { $, $$, toast, openSheet, closeSheet, sheetOpen } from '../ui.js';
import { go, rerender } from '../router.js';
import { icon } from '../icons.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COACH_Q = 'Look at my food log next to my training and weigh-ins: am I eating right for my goal? Give me specific calorie and protein guidance.';
const k = v => (v >= 10000 ? fmtNum(v / 1000, 1) + 'k' : Math.round(v).toLocaleString());
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

let viewDate = todayStr();
let pending = null;    // the photo being estimated: {preview, thumb, upload, estimate, token}

function dayLabel(d) {
  const t = todayStr();
  if (d === t) return 'Today';
  if (dayNum(d) === dayNum(t) - 1) return 'Yesterday';
  return `${DOW[new Date(dayNum(d) * 864e5).getUTCDay()]} ${shortDate(d)}`;
}

export function render(ctx) {
  const t = todayStr();
  viewDate = isDate(ctx.query.d) && ctx.query.d <= t ? ctx.query.d : t;
  const meals = getMeals();
  const day = dayTotals(meals, viewDate);
  const goal = getGoal();
  const kT = num(goal.kcalTarget), pT = num(goal.proteinTarget);
  const mine = myHealth();
  const list = mealsOn(meals, viewDate);

  let h = `<section class="card food-hero">
    <div class="food-day">
      <button type="button" class="day-btn" data-act="foodDay" data-d="-1" aria-label="Previous day">${icon('back', 20)}</button>
      <span class="eyebrow">${icon('flame', 14)} Food · ${esc(dayLabel(viewDate))}</span>
      <button type="button" class="day-btn" data-act="foodDay" data-d="1" aria-label="Next day" ${viewDate === t ? 'disabled' : ''}>${icon('chevron', 20)}</button>
    </div>
    <div class="food-kcal-row"><b class="food-kcal">${k(day.kcal)}</b><span>${kT ? `of ${k(kT)} kcal` : 'kcal'}</span></div>
    ${kT ? `<div class="kbar" role="img" aria-label="${Math.round(day.kcal / kT * 100)}% of your calorie target"><i style="--p:${Math.min(1, day.kcal / kT)}"></i>${day.kcal > kT ? '<em>over</em>' : ''}</div>` : ''}
    <ul class="macros">
      <li><b>${k(day.protein_g)}</b><span>g protein${pT ? ' / ' + k(pT) : ''}</span></li>
      <li><b>${k(day.carbs_g)}</b><span>g carbs</span></li>
      <li><b>${k(day.fat_g)}</b><span>g fat</span></li>
      ${mine ? `<li><b>${k(day.sodium_mg)}</b><span>mg sodium</span></li>` : ''}
    </ul>
    <button type="button" class="hero-pill" data-act="foodTargets">${kT || pT ? 'Daily targets' : 'Set daily targets'} ${icon('edit', 13)}</button>
  </section>

  <label class="cta" for="mealCam"><span class="cta-ic">${icon('camera', 24)}</span><span><b>Snap a meal</b><small>Photo of a plate, snack or label</small></span></label>
  <input type="file" id="mealCam" class="file-hidden" accept="image/*" capture="environment" data-change="mealPhoto" tabindex="-1" aria-hidden="true">
  <input type="file" id="mealLib" class="file-hidden" accept="image/*" data-change="mealPhoto" tabindex="-1" aria-hidden="true">
  <div class="food-more">
    <label class="btn ghost small" for="mealLib">${icon('upload', 16)} From photos</label>
    <button type="button" class="btn ghost small" data-act="foodHand">${icon('keyboard', 16)} Add by hand</button>
  </div>`;

  const again = recentMeals(meals).filter(m => !list.some(x => x.name === m.name));
  if (again.length) {
    h += `<div class="again"><span class="lbl">Again</span><div class="again-chips">${again.map(m =>
      `<button type="button" class="again-chip" data-act="foodAgain" data-id="${esc(m.id)}">${esc(m.name)} <small>${k(mealTotals(m).kcal)}</small></button>`).join('')}</div></div>`;
  }

  h += `<section class="card"><div class="row-between"><h2>${viewDate === t ? 'Today’s food' : esc(dayLabel(viewDate))}</h2><span class="count">${list.length}</span></div>`;
  if (list.length) {
    h += `<ul class="meals">${list.map(m => {
      const mt = mealTotals(m);
      const time = new Date(m.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `<li><button type="button" class="meal-row" data-act="foodEdit" data-id="${esc(m.id)}">
        <span class="mthumb">${m.thumb ? `<img src="${esc(m.thumb)}" alt="">` : icon(m.source === 'photo' ? 'camera' : 'flame', 20)}</span>
        <span class="plan-main"><b>${esc(m.name || 'Meal')}</b><small>${esc(time)} · ${k(mt.protein_g)} g protein${mine && mt.sodium_mg >= 1000 ? ` · ${k(mt.sodium_mg)} mg sodium` : ''}</small></span>
        <span class="mkcal">${k(mt.kcal)}<small>kcal</small></span></button></li>`;
    }).join('')}</ul>`;
  } else {
    h += `<p class="muted">${viewDate === t ? 'Nothing logged yet. Snap your first meal — Claude does the counting.' : 'Nothing logged this day.'}</p>`;
  }
  h += '</section>';

  const days = lastDays(meals, t, 7);
  const avg = average(days);
  const top = Math.max(kT || 0, ...days.map(d => d.kcal), 1);
  h += `<section class="card"><h2>Last 7 days</h2>
    <div class="weekbars" ${kT ? `style="--t:${kT / top}"` : ''}>${days.map(d => `<button type="button" class="wb ${d.date === viewDate ? 'on' : ''} ${kT && d.kcal > kT ? 'over' : ''}" data-act="foodGo" data-d="${d.date}" aria-label="${esc(dayLabel(d.date))}: ${d.kcal} kcal">
      <span class="wb-bar"><i style="--h:${d.kcal / top}"></i></span><small>${DOW[new Date(dayNum(d.date) * 864e5).getUTCDay()].slice(0, 1)}</small></button>`).join('')}
      ${kT ? '<span class="wb-target" aria-hidden="true"></span>' : ''}</div>
    <p class="muted small">${avg ? `Average ${k(avg.kcal)} kcal · ${k(avg.protein_g)} g protein over ${avg.days} logged day${avg.days > 1 ? 's' : ''}.` : 'Log a few days to see your averages.'}${kT ? ' The line is your target.' : ''}</p>
  </section>`;

  const c = lastCoach();
  const n = c && c.report.nutrition && typeof c.report.nutrition.summary === 'string' ? c.report.nutrition : null;
  h += `<section class="card food-coach">
    <div class="eyebrow">${icon('sparkle', 14)} Coach Claude · Food</div>
    ${n ? `<b>${esc(n.summary.split(/(?<=[.!?])\s/)[0])}</b>
      <p>${esc(n.summary.split(/(?<=[.!?])\s/).slice(1).join(' '))}</p>
      ${n.calorie_range || n.protein_g_per_day ? `<div class="food-coach-tgt">${n.calorie_range ? `<span><small>Calories</small>${esc(n.calorie_range)}</span>` : ''}${n.protein_g_per_day ? `<span><small>Protein</small>${esc(String(n.protein_g_per_day))} g / day</span>` : ''}</div>` : ''}
      ${Array.isArray(n.tips) && n.tips.length ? `<ul>${n.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <small class="muted">${esc(new Date(c.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</small>`
    : `<b>How’s your fuel?</b><p>Coach reads your food log next to your training and weigh-ins, and tells you what to eat more or less of for your goal.</p>`}
    <button type="button" class="btn wide" id="foodCoachBtn" data-act="foodCoach">${icon('sparkle', 18)} ${n ? 'Ask again' : 'Ask Coach about my food'}</button>
    ${c ? `<a class="link" href="#/progress/coach">Full coach report ${icon('chevron', 16)}</a>` : ''}
  </section>
  <p class="muted small center">Photo estimates are approximate — often within about 25%. Labels are the most accurate. Everything stays on this phone.</p>`;
  return h;
}

/* ---------- Meal form (review an estimate, add by hand, edit) ---------- */
function itemRow(it = {}) {
  const kc = num(it.kcal);
  return `<div class="item-row" data-k0="${kc ?? ''}" data-carbs="${num(it.carbs_g) ?? 0}" data-fat="${num(it.fat_g) ?? 0}" data-sodium="${num(it.sodium_mg) ?? 0}" data-conf="${esc(it.confidence || '')}" data-portion="${esc(it.portion || '')}">
    <span class="item-name"><input name="iname" value="${esc(it.name || '')}" placeholder="Food" aria-label="Food" data-input="foodItem">
      ${it.portion ? `<small>${esc(it.portion)}${it.confidence === 'low' ? ' · rough guess' : ''}</small>` : ''}</span>
    <label class="item-num"><input name="ikcal" inputmode="decimal" value="${kc ?? ''}" placeholder="0" data-input="foodItem" aria-label="Calories"><small>kcal</small></label>
    <label class="item-num"><input name="iprot" inputmode="decimal" value="${num(it.protein_g) ?? ''}" placeholder="0" data-input="foodItem" aria-label="Protein grams"><small>g prot</small></label>
    <button type="button" class="icon-btn" data-act="foodDelItem" aria-label="Remove ${esc(it.name || 'item')}">${icon('close', 15, { stroke: 2.5 })}</button>
  </div>`;
}

function sumText(t, est) {
  const range = est && est.kcal_high > est.kcal_low ? ` <span class="muted">(likely ${k(est.kcal_low)}–${k(est.kcal_high)})</span>` : '';
  return `<b>${k(t.kcal)} kcal</b> · ${k(t.protein_g)} g protein${range}`;
}

function mealForm(meal, { isNew, photo, est } = {}) {
  const items = meal.items && meal.items.length ? meal.items : [{}];
  const pic = photo || meal.thumb;
  return `<div class="sheet-head"><h2>${isNew ? (photo ? 'Check it' : 'Add food') : 'Edit meal'}</h2>
      ${est && est.comment ? `<p class="meal-comment">${icon('sparkle', 15)} ${esc(est.comment)}</p>` : ''}
      ${est && est.label_read ? '<p class="muted small">Read from the nutrition label.</p>' : ''}</div>
    ${pic ? `<img class="meal-photo" src="${esc(pic)}" alt="Your meal">` : ''}
    <form id="foodMeal" data-id="${esc(meal.id || '')}" autocomplete="off">
      <label class="lbl" for="f_mname">Name</label>
      <input id="f_mname" name="mname" value="${esc(meal.name || '')}" placeholder="Breakfast, protein bar…" ${isNew && !photo ? 'autofocus' : ''}>
      <div class="lbl items-head"><span>Items</span><span>kcal</span><span>protein</span><span></span></div>
      <div class="items" id="mealItems">${items.map(itemRow).join('')}</div>
      <button type="button" class="btn ghost small" data-act="foodAddItem">${icon('plus', 15)} Add item</button>
      <p class="meal-sum" id="mealSum" aria-live="polite">${sumText(mealTotals(meal), est)}</p>
      ${photo ? '<p class="muted small">Fix anything that looks off — change calories and the carbs, fat and sodium follow.</p>' : ''}
      <button class="btn primary wide" type="submit">${icon('check', 18, { stroke: 2.6 })} Save</button>
    </form>
    ${isNew ? '' : `<button type="button" class="btn ghost wide danger" data-act="foodDel" data-id="${esc(meal.id)}">${icon('close', 16)} Delete meal</button>`}`;
}

/** Read the form's item rows back. Editing an estimated item's calories scales its carbs, fat and sodium with it. */
function readItems(form) {
  return $$('.item-row', form).map(r => {
    const name = r.querySelector('[name=iname]').value.trim();
    const kcal = num(r.querySelector('[name=ikcal]').value) ?? 0;
    const protein = num(r.querySelector('[name=iprot]').value) ?? 0;
    const k0 = num(r.dataset.k0);
    const f = k0 > 0 ? kcal / k0 : 1;
    const it = { name: name || 'Food', kcal: Math.max(0, Math.round(kcal)), protein_g: Math.max(0, Math.round(protein)),
      carbs_g: Math.round((num(r.dataset.carbs) || 0) * f), fat_g: Math.round((num(r.dataset.fat) || 0) * f),
      sodium_mg: Math.round((num(r.dataset.sodium) || 0) * f) };
    if (r.dataset.portion) it.portion = r.dataset.portion;
    if (r.dataset.conf) it.confidence = r.dataset.conf;
    return it;
  }).filter(it => it.kcal > 0 || it.name !== 'Food');
}

/* ---------- Photo → estimate ---------- */
function photoSheet(err = '') {
  return `<div class="sheet-head"><h2>Snap a meal</h2><p class="muted">Add a note if the photo can’t show it — “half of it”, “no sauce”, “2 scoops”.</p></div>
    <img class="meal-photo" src="${esc(pending.preview)}" alt="Your photo">
    <label class="lbl" for="f_mnote">Note <span class="muted">(optional)</span></label>
    <input id="f_mnote" placeholder="e.g. large bowl, oat milk" maxlength="200">
    ${err ? `<p class="flag" role="alert">${icon('alert', 16)}<span>${esc(err)}</span></p>` : ''}
    <button type="button" class="btn primary wide" id="estimateBtn" data-act="foodEstimate">${icon('sparkle', 18)} Estimate calories</button>
    <button type="button" class="btn ghost wide" data-act="foodHand">${icon('keyboard', 18)} Add by hand instead</button>`;
}

async function handlePhoto(file) {
  if (!getSettings().coachPass) {
    openSheet(`<div class="sheet-head"><h2>Photo estimates</h2>
      <p class="muted">Claude counts the calories from your photo through Coach Claude, which needs the coach passcode (Me → Coach Claude setup). Until then you can add meals by hand.</p></div>
      <button type="button" class="btn primary wide" data-act="foodHand">${icon('keyboard', 18)} Add by hand</button>
      <button type="button" class="btn ghost wide" data-act="go" data-to="me/settings">${icon('gear', 18)} Coach Claude setup</button>`);
    return;
  }
  try {
    pending = { ...(await preparePhoto(file)), token: Date.now() };
  } catch (e) {
    toast(e.message, 'warn');
    return;
  }
  openSheet(photoSheet(), { onClose: () => { pending = null; } });
}

/* ---------- Events ---------- */
export const changes = {
  mealPhoto(el) {
    const file = el.files && el.files[0];
    el.value = ''; // so the same photo can be picked again
    if (file) handlePhoto(file);
  }
};

export const actions = {
  foodDay(el) {
    const d = fromDayNum(dayNum(viewDate) + Number(el.dataset.d));
    if (d > todayStr()) return;
    go('food' + (d === todayStr() ? '' : '?d=' + d), { replace: true });
  },
  foodGo(el) { go('food' + (el.dataset.d === todayStr() ? '' : '?d=' + el.dataset.d), { replace: true }); },
  foodHand() {
    pending = null;
    openSheet(mealForm({ items: [{}] }, { isNew: true }));
  },
  foodEdit(el) {
    const m = getMeals().find(x => x.id === el.dataset.id);
    if (m) openSheet(mealForm(m));
  },
  foodAgain(el) {
    const m = getMeals().find(x => x.id === el.dataset.id);
    if (!m) return;
    const { id, ts, date, thumb, ...rest } = m;
    if (addMeal({ ...rest, date: viewDate, ts: viewDate === todayStr() ? Date.now() : dayNum(viewDate) * 864e5 + 12 * 36e5, source: 'again' })) {
      toast(`Logged ${m.name} again`);
      rerender({ keepScroll: true });
    }
  },
  foodAddItem() {
    const box = $('#mealItems');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', itemRow({}));
    box.lastElementChild.querySelector('input').focus();
  },
  foodDelItem(el) {
    const row = el.closest('.item-row'), form = el.closest('form');
    if (!row || !form) return;
    if ($$('.item-row', form).length === 1) { row.querySelectorAll('input').forEach(i => { i.value = ''; }); row.dataset.k0 = ''; }
    else row.remove();
    inputs.foodItem(form.querySelector('input'));
  },
  foodDel(el) {
    if (!confirm('Delete this meal?')) return;
    deleteMeal(el.dataset.id);
    closeSheet();
    rerender({ keepScroll: true });
  },
  foodTargets() {
    const g = getGoal();
    openSheet(`<div class="sheet-head"><h2>Daily targets</h2>
      <p class="muted">Not sure? Leave them blank and ask Coach Claude — it suggests a range from your goal, training and weigh-ins.</p></div>
      <form id="foodTargets">
        <label class="lbl" for="f_kt">Calories per day</label><input id="f_kt" name="kcal" inputmode="numeric" value="${esc(g.kcalTarget)}" placeholder="e.g. 2200">
        <label class="lbl" for="f_pt">Protein per day (g)</label><input id="f_pt" name="protein" inputmode="numeric" value="${esc(g.proteinTarget)}" placeholder="e.g. 140">
        <button class="btn primary wide" type="submit">Save targets</button>
      </form>`);
  },
  async foodEstimate() {
    if (!pending) return;
    const btn = $('#estimateBtn');
    const note = ($('#f_mnote') || {}).value || '';
    const me = pending, token = me.token;
    btn.disabled = true;
    const lines = ['Looking at your plate…', 'Sizing up the portions…', 'Counting the hidden oil…', 'Adding it up…'];
    let i = 0;
    btn.textContent = lines[0];
    const spin = setInterval(() => { btn.textContent = lines[++i % lines.length]; }, 2200);
    try {
      const est = await estimateMeal(me.upload, note.trim());
      if (!pending || pending.token !== token || !sheetOpen()) return; // closed or replaced meanwhile
      me.estimate = est;
      if (!est.is_food || !est.items.length) {
        openSheet(photoSheet(est.comment || 'No food in that photo — try another angle.'), { onClose: () => { pending = null; } });
        return;
      }
      openSheet(mealForm({ name: est.name, items: est.items }, { isNew: true, photo: me.preview, est }), { onClose: () => { pending = null; } });
    } catch (e) {
      if (!pending || pending.token !== token || !sheetOpen()) return;
      openSheet(photoSheet(e.message), { onClose: () => { pending = null; } });
    } finally {
      clearInterval(spin);
    }
  },
  async foodCoach() {
    const btn = $('#foodCoachBtn');
    if (!getSettings().coachPass) {
      toast('Coach Claude needs the passcode — Me → Coach Claude setup', 'warn');
      return;
    }
    btn.disabled = true;
    const lines = ['Reading your food log…', 'Lining it up with your training…', 'Checking your weigh-ins…', 'Working out your targets…'];
    let i = 0;
    btn.textContent = lines[0];
    const spin = setInterval(() => { btn.textContent = lines[++i % lines.length]; }, 2500);
    try {
      await askCoach(COACH_Q);
      toast('Coach looked at your food');
      if (location.hash.startsWith('#/food')) rerender({ keepScroll: true });
    } catch (e) {
      toast(e.message, 'warn');
      if (btn.isConnected) { btn.disabled = false; btn.innerHTML = icon('sparkle', 18) + ' Ask Coach about my food'; }
    } finally {
      clearInterval(spin);
    }
  }
};

export const inputs = {
  foodItem(el) {
    const form = el && el.closest('form');
    const sum = $('#mealSum');
    if (!form || !sum) return;
    sum.innerHTML = sumText(mealTotals({ items: readItems(form) }));   // the photo's range no longer applies once edited
  }
};

export const submits = {
  foodMeal(form) {
    const items = readItems(form);
    const kcal = items.reduce((t, it) => t + it.kcal, 0);
    if (!items.length || !(kcal > 0)) return toast('Enter the calories', 'warn');
    const name = form.elements.mname.value.trim() || (items.length === 1 ? items[0].name : 'Meal');
    const id = form.dataset.id;
    if (id) {
      updateMeal(id, { name, items });
      toast('Meal updated');
    } else {
      const est = pending && pending.estimate;
      const ts = viewDate === todayStr() ? Date.now() : dayNum(viewDate) * 864e5 + 12 * 36e5;
      const saved = addMeal({
        date: viewDate, ts, name, items,
        source: est ? 'photo' : 'hand',
        thumb: est ? pending.thumb : null,
        ...(est ? { kcal_low: est.kcal_low, kcal_high: est.kcal_high, label_read: !!est.label_read, comment: est.comment } : {})
      });
      if (!saved) return;
      toast(`Saved ${Math.round(kcal)} kcal`);
    }
    pending = null;
    closeSheet();
    rerender({ keepScroll: true });
  },
  foodTargets(form) {
    const kc = num(form.elements.kcal.value), pr = num(form.elements.protein.value);
    setGoalField('kcalTarget', kc > 0 ? Math.round(kc) : '');
    setGoalField('proteinTarget', pr > 0 ? Math.round(pr) : '');
    closeSheet();
    toast('Targets saved');
    rerender({ keepScroll: true });
  }
};
