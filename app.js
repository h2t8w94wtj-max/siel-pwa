const defaultState = {
  profile: { weight: 72, height: 170, age: 30, sex: 'male', activity: 'medium', goal: 'cut' },
  foodLog: [],
  weightLog: [{ date: isoDate(new Date()), weight: 72 }],
  pending: null
};

const state = loadState();
const views = [...document.querySelectorAll('.view')];
const navButtons = [...document.querySelectorAll('[data-nav]')];
const storeKey = 'siel-pwa-state-v1';

navButtons.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.nav)));
document.querySelectorAll('[data-open="food"]').forEach(btn => btn.addEventListener('click', () => showView('food')));

document.getElementById('installHintBtn').addEventListener('click', () => toggleInstall(true));
document.getElementById('closeInstallModal').addEventListener('click', () => toggleInstall(false));
document.getElementById('analyzeFoodBtn').addEventListener('click', analyzeFood);
document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
document.getElementById('saveWeightBtn').addEventListener('click', saveWeight);
document.getElementById('photoInput').addEventListener('change', handlePhoto);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

fillProfileForm();
renderAll();

function showView(name) {
  views.forEach(v => v.classList.toggle('active', v.dataset.view === name));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  if (name === 'analysis') renderAnalysis();
  if (name === 'week') renderWeek();
  if (name === 'day') renderDay();
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(storeKey)) || structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storeKey, JSON.stringify(state));
}

function isoDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10);
}

function fillProfileForm() {
  document.getElementById('profileWeight').value = state.profile.weight;
  document.getElementById('profileHeight').value = state.profile.height;
  document.getElementById('profileAge').value = state.profile.age;
  document.getElementById('profileSex').value = state.profile.sex;
  document.getElementById('profileActivity').value = state.profile.activity;
  document.getElementById('profileGoal').value = state.profile.goal;
}

function saveProfile() {
  state.profile = {
    weight: Number(document.getElementById('profileWeight').value || 72),
    height: Number(document.getElementById('profileHeight').value || 170),
    age: Number(document.getElementById('profileAge').value || 30),
    sex: document.getElementById('profileSex').value,
    activity: document.getElementById('profileActivity').value,
    goal: document.getElementById('profileGoal').value
  };
  saveState();
  renderAll();
  document.getElementById('profileSummary').textContent = summaryProfile();
}

function saveWeight() {
  const value = Number(document.getElementById('newWeightInput').value);
  if (!value) return;
  const today = isoDate(new Date());
  const existing = state.weightLog.find(x => x.date === today);
  if (existing) existing.weight = value;
  else state.weightLog.push({ date: today, weight: value });
  state.profile.weight = value;
  saveState();
  renderAll();
  const fb = document.getElementById('weightFeedback');
  fb.classList.remove('hidden');
  fb.innerHTML = `<strong>${weightFeedback()}</strong>`;
  document.getElementById('newWeightInput').value = '';
}

function handlePhoto(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const box = document.getElementById('foodResult');
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="card-title-row"><h3>Результат по фото</h3></div>
    <p class="muted">Это тестовая PWA-версия. Фото можно выбрать, но для точного распознавания его нужно будет подключить к твоему n8n API. Сейчас приложение показывает UX и сценарий, а не боевой vision-анализ.</p>
    <div class="row gap"><button class="primary-btn" onclick="showView('home')">Ок</button></div>
  `;
}

function analyzeFood() {
  const text = document.getElementById('foodInput').value.trim();
  if (!text) return;
  const result = estimateMeal(text);
  state.pending = { ...result, sourceText: text };
  saveState();
  renderPendingResult();
}

function estimateMeal(text) {
  const t = text.toLowerCase();
  const items = [];
  const patterns = [
    { key: 'яйц', type: 'pcs', name: 'Яйца', per: { kcal: 78, protein: 6.3, fat: 5.3, carbs: 0.6 }, defaultAmount: 2 },
    { key: 'тост', type: 'pcs', name: 'Тост', per: { kcal: 80, protein: 2.6, fat: 1.0, carbs: 14 }, defaultAmount: 1 },
    { key: 'бургер', type: 'pcs', name: 'Бургер', per: { kcal: 295, protein: 15, fat: 14, carbs: 30 }, defaultAmount: 1 },
    { key: 'кола', type: 'ml100', name: 'Кола', per: { kcal: 42, protein: 0, fat: 0, carbs: 10.6 }, defaultAmount: 500 },
    { key: 'рис', type: 'g100', name: 'Рис', per: { kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 }, defaultAmount: 200 },
    { key: 'куриц', type: 'g100', name: 'Курица', per: { kcal: 165, protein: 31, fat: 3.6, carbs: 0 }, defaultAmount: 150 },
    { key: 'сметан', type: 'g100', name: 'Сметана', per: { kcal: 206, protein: 2.8, fat: 20, carbs: 3.2 }, defaultAmount: 30 },
    { key: 'лосос', type: 'pcs', name: 'Стейк из лосося', per: { kcal: 312, protein: 34, fat: 20, carbs: 0 }, defaultAmount: 1 },
    { key: 'стейк', type: 'pcs', name: 'Стейк', per: { kcal: 280, protein: 26, fat: 18, carbs: 0 }, defaultAmount: 1 }
  ];

  patterns.forEach(p => {
    if (t.includes(p.key)) {
      let amount = p.defaultAmount;
      let unitText = p.type === 'pcs' ? 'шт' : p.type === 'ml100' ? 'мл' : 'г';
      const re = new RegExp('(\\d+[\\.,]?\\d*)\\s*(шт|штуки|г|гр|мл)?[^\\n,;]*' + p.key);
      const rev = new RegExp(p.key + '[^\\n,;]*(\\d+[\\.,]?\\d*)\\s*(шт|штуки|г|гр|мл)?');
      const m = t.match(re) || t.match(rev);
      if (m) {
        amount = Number(String(m[1]).replace(',', '.'));
        const u = m[2] || '';
        if (p.type === 'pcs') unitText = 'шт';
        else if (u.includes('мл')) unitText = 'мл';
        else unitText = 'г';
      }
      const mult = p.type === 'pcs' ? amount : amount / 100;
      items.push({
        name: p.name,
        amount,
        unitText,
        kcal: round1(p.per.kcal * mult),
        protein: round1(p.per.protein * mult),
        fat: round1(p.per.fat * mult),
        carbs: round1(p.per.carbs * mult)
      });
    }
  });

  if (!items.length) {
    items.push({ name: 'Приём пищи', amount: 1, unitText: 'порция', kcal: 450, protein: 20, fat: 18, carbs: 40 });
  }

  const totals = items.reduce((a, x) => ({
    kcal: a.kcal + x.kcal,
    protein: a.protein + x.protein,
    fat: a.fat + x.fat,
    carbs: a.carbs + x.carbs
  }), { kcal: 0, protein: 0, fat: 0, carbs: 0 });

  return {
    items,
    totals: mapValues(totals, round1),
    recommendation: buildMealRecommendation(totals)
  };
}

function renderPendingResult() {
  const box = document.getElementById('foodResult');
  const p = state.pending;
  if (!p) return;
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="card-title-row"><h3>Результат</h3></div>
    <div class="entries">
      ${p.items.map(i => `<div class="entry"><div class="entry-title">${i.name} — ${i.amount} ${i.unitText}</div><div class="entry-meta">${i.kcal} ккал · Б ${i.protein} · Ж ${i.fat} · У ${i.carbs}</div></div>`).join('')}
    </div>
    <div class="card inline-card"><strong>Итого</strong><span>${p.totals.kcal} ккал · Б ${p.totals.protein} · Ж ${p.totals.fat} · У ${p.totals.carbs}</span></div>
    <div class="analysis-box">${p.recommendation}</div>
    <div class="row gap" style="margin-top:12px;">
      <button class="primary-btn" id="confirmSaveBtn">✅ Сохранить</button>
      <button class="secondary-btn" id="cancelSaveBtn">✖️ Отмена</button>
    </div>
  `;
  document.getElementById('confirmSaveBtn').onclick = confirmSave;
  document.getElementById('cancelSaveBtn').onclick = cancelPending;
}

function confirmSave() {
  if (!state.pending) return;
  state.foodLog.push({ date: isoDate(new Date()), createdAt: Date.now(), ...state.pending });
  state.pending = null;
  saveState();
  document.getElementById('foodInput').value = '';
  renderAll();
  showView('day');
}

function cancelPending() {
  state.pending = null;
  saveState();
  document.getElementById('foodResult').classList.add('hidden');
}

function renderAll() {
  saveState();
  renderHome();
  renderDay();
  renderWeek();
  renderProfile();
  renderAnalysis();
}

function todayEntries() {
  const today = isoDate(new Date());
  return state.foodLog.filter(x => x.date === today);
}

function dayTotals(entries = todayEntries()) {
  return mapValues(entries.reduce((a, x) => ({
    kcal: a.kcal + x.totals.kcal,
    protein: a.protein + x.totals.protein,
    fat: a.fat + x.totals.fat,
    carbs: a.carbs + x.totals.carbs
  }), { kcal: 0, protein: 0, fat: 0, carbs: 0 }), round1);
}

function targetCalories() {
  const p = state.profile;
  const s = p.sex === 'male' ? 5 : -161;
  const activityMap = { low: 1.2, medium: 1.4, high: 1.6 };
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + s;
  const maintain = bmr * (activityMap[p.activity] || 1.4);
  const target = p.goal === 'cut' ? maintain - 350 : p.goal === 'gain' ? maintain + 250 : maintain;
  return Math.round(target);
}

function renderHome() {
  const totals = dayTotals();
  const target = targetCalories();
  const remain = Math.max(target - totals.kcal, 0);
  document.getElementById('todayCalories').textContent = Math.round(totals.kcal);
  document.getElementById('targetCalories').textContent = target;
  document.getElementById('todayProgress').style.width = Math.min((totals.kcal / target) * 100, 100) + '%';
  document.getElementById('todayRemaining').textContent = `Осталось ${Math.round(remain)} ккал`;
  const current = latestWeight();
  document.getElementById('currentWeight').textContent = current.toFixed(1);
  document.getElementById('weightTrend').textContent = weightFeedback();
}

function renderDay() {
  const entries = todayEntries();
  const totals = dayTotals(entries);
  const target = targetCalories();
  document.getElementById('dayCalories').textContent = Math.round(totals.kcal);
  document.getElementById('dayProtein').textContent = Math.round(totals.protein);
  document.getElementById('dayFat').textContent = Math.round(totals.fat);
  document.getElementById('dayCarbs').textContent = Math.round(totals.carbs);
  document.getElementById('dayRemaining').textContent = `${Math.max(Math.round(target - totals.kcal), 0)} ккал`;
  document.getElementById('dayWeight').textContent = `${latestWeight().toFixed(1)} кг`;
  const box = document.getElementById('dayEntries');
  box.innerHTML = entries.length ? entries.map(x => `
    <div class="entry">
      <div class="entry-title">${x.items.map(i => i.name).join(', ')}</div>
      <div class="entry-meta">${Math.round(x.totals.kcal)} ккал · Б ${Math.round(x.totals.protein)} · Ж ${Math.round(x.totals.fat)} · У ${Math.round(x.totals.carbs)}</div>
    </div>
  `).join('') : '<div class="muted">Пока нет записей. Добавь первый приём пищи.</div>';
}

function renderWeek() {
  const week = last7Days();
  const bars = document.getElementById('weekBars');
  const weightList = document.getElementById('weightList');
  const target = targetCalories();
  const totals = week.map(day => ({
    date: day,
    kcal: Math.round(dayTotals(state.foodLog.filter(x => x.date === day)).kcal)
  }));
  const max = Math.max(target, ...totals.map(t => t.kcal), 1);
  bars.innerHTML = totals.map(t => {
    const h = Math.max(8, Math.round((t.kcal / max) * 140));
    return `<div class="bar"><div class="bar-value">${t.kcal}</div><div class="bar-fill" style="height:${h}px"></div><div class="bar-label">${labelDay(t.date)}</div></div>`;
  }).join('');

  const weights = week.map(d => ({ date: d, weight: getWeightForDate(d) })).filter(x => x.weight != null);
  weightList.innerHTML = weights.length ? weights.map(w => `<div class="weight-row"><span>${labelDay(w.date)}</span><strong>${w.weight.toFixed(1)} кг</strong></div>`).join('') : '<div class="muted">Пока мало данных по весу</div>';

  const avg = Math.round(totals.reduce((a,b) => a+b.kcal, 0) / 7);
  const weekDelta = weightDeltaWeek();
  document.getElementById('weekSummary').textContent = `Средний калораж: ${avg} ккал в день. Изменение веса за неделю: ${weekDelta > 0 ? '+' : ''}${weekDelta.toFixed(1)} кг.`;
}

function renderProfile() {
  document.getElementById('profileSummary').textContent = summaryProfile();
}

function renderAnalysis() {
  document.getElementById('analysisText').innerHTML = buildAnalysis();
}

function summaryProfile() {
  return `Цель на день: ${targetCalories()} ккал. Вес ${state.profile.weight} кг, рост ${state.profile.height} см, возраст ${state.profile.age}.`;
}

function buildAnalysis() {
  const goalMap = { cut: 'снижение веса', maintain: 'поддержание веса', gain: 'набор массы' };
  const delta = weightDeltaWeek();
  const t = targetCalories();
  let trend = 'Вес пока относительно стабилен.';
  if (delta < -0.3) trend = `За неделю уже есть снижение: ${delta.toFixed(1)} кг. Темп выглядит нормальным.`;
  if (delta > 0.3) trend = `Вес подрос на ${delta.toFixed(1)} кг. Возможно, стоит внимательнее смотреть на калории и динамику.`;
  return `
    <strong>Сейчас логичнее держать фокус на цели: ${goalMap[state.profile.goal]}.</strong><br><br>
    Твой ориентир сейчас — около <strong>${t} ккал</strong> в день.<br>
    ${trend}<br><br>
    Базовый совет: держи регулярный учёт, не пропускай приёмы пищи и следи за белком.
  `;
}

function buildMealRecommendation(totals) {
  const target = targetCalories();
  const remain = Math.max(target - dayTotals().kcal - totals.kcal, 0);
  if (state.profile.goal === 'cut') {
    return `Для цели "снижение веса" это нормальный приём пищи. После него останется примерно ${Math.round(remain)} ккал. Держи фокус на белке и не перебирай с жирными соусами.`;
  }
  if (state.profile.goal === 'gain') {
    return `Для набора массы приём пищи выглядит рабочим. После него останется примерно ${Math.round(remain)} ккал. Старайся добирать калории и белок равномерно.`;
  }
  return `Для поддержания веса приём пищи выглядит сбалансированно. После него останется примерно ${Math.round(remain)} ккал.`;
}

function latestWeight() {
  return [...state.weightLog].sort((a,b) => a.date.localeCompare(b.date)).at(-1)?.weight || state.profile.weight;
}

function getWeightForDate(date) {
  return state.weightLog.find(x => x.date === date)?.weight ?? null;
}

function weightDeltaWeek() {
  const week = last7Days();
  const vals = week.map(d => getWeightForDate(d)).filter(v => v != null);
  if (vals.length < 2) return 0;
  return round1(vals.at(-1) - vals[0]);
}

function weightFeedback() {
  const delta = weightDeltaWeek();
  if (delta <= -0.3) return `${delta.toFixed(1)} кг за неделю — хороший темп 👍`;
  if (delta >= 0.3) return `+${delta.toFixed(1)} кг за неделю — возможно, это вода или избыток калорий.`;
  return 'Динамика веса пока спокойная.';
}

function last7Days() {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(isoDate(d));
  }
  return arr;
}

function labelDay(date) {
  const today = isoDate(new Date());
  if (date === today) return 'Сегодня';
  const d = new Date(date);
  return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
}

function toggleInstall(show) {
  document.getElementById('installModal').classList.toggle('hidden', !show);
}

function round1(n) { return Math.round(n * 10) / 10; }
function mapValues(obj, fn) { return Object.fromEntries(Object.entries(obj).map(([k,v]) => [k, fn(v)])); }
window.showView = showView;
