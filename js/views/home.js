import { state, loadPlans, loadWeights, loadHistory, loadNutrition, getExercise } from "../store.js";
import { startWorkout } from "./plans.js";
import { muscleFigures } from "../body.js";
import { esc } from "../ui.js";

const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (n) => Math.round(n * 10) / 10;
const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

export async function render(el, ctx) {
  const profile = state.profile || {};
  const today = new Date();
  const [plans, weights, sessions, food] = await Promise.all([
    loadPlans(),
    loadWeights(),
    loadHistory(),
    loadNutrition(ds(today)).catch(() => []),
  ]);

  const plan = plans[0] || null; // most recently updated
  const workoutDays = workoutDateSet(sessions);
  const weightDays = new Set((weights || []).map((w) => w.log_date));
  const streak = currentStreak(workoutDays);

  const kcal = Math.round((food || []).reduce((s, e) => s + (+e.kcal || 0), 0));
  const kcalGoal = profile.kcal_goal || 0;

  const trainTarget = +profile.days_per_week || 4;
  const trainWeek = countThisWeek(workoutDays);
  const weightWeek = countThisWeek(weightDays);
  const curW = weights.length ? fmt(+weights[weights.length - 1].weight_kg) : null;

  el.innerHTML = `
    <div class="dashhead">
      <h1>Dashboard</h1>
      <div class="dashhead-actions">
        <span class="streak" title="Training day streak">🔥 <b>${streak}</b></span>
        <button class="btn icon ghost" id="settings" aria-label="Settings">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
          </svg>
        </button>
      </div>
    </div>

    <h2 class="section">Welcome back!</h2>
    ${workoutCarousel(plan)}

    <h2 class="section">Habits</h2>
    <div class="habitgrid">
      ${stepsCard(profile.steps_goal || 0)}
      ${caloriesCard(kcal, kcalGoal)}
      ${weightCard(weightDays, weightWeek, curW)}
      ${trainingsCard(workoutDays, trainWeek, trainTarget)}
    </div>`;

  // --- events ---
  el.querySelector("#settings").addEventListener("click", () => ctx.go("profile"));

  const gen = el.querySelector("#gen");
  if (gen) gen.addEventListener("click", () => ctx.go("plans?new=auto"));

  el.querySelectorAll("[data-go]").forEach((c) =>
    c.addEventListener("click", () => ctx.go(c.dataset.go))
  );

  if (plan) {
    el.querySelectorAll("[data-start]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        startWorkout(plan, +b.dataset.start, ctx);
      })
    );
    wireCarousel(el);
  }
}

/* ---------------- workout carousel ---------------- */

function workoutCarousel(plan) {
  if (!plan || !(plan.days || []).length) {
    return `<div class="wslide wempty">
      <div class="wslide-info">
        <div class="wtitle">No plan yet</div>
        <div class="wmeta">Generate a workout plan to get started.</div>
        <button class="btn primary" id="gen" style="width:auto;margin-top:14px">⚡ Auto-generate</button>
      </div>
    </div>`;
  }
  const days = plan.days;
  const order = orderedDayIndexes(plan);
  const slides = order.map((i) => workoutSlide(plan, i)).join("");
  const dots =
    days.length > 1
      ? `<div class="wdots">${order.map((_, i) => `<span class="wdot ${i === 0 ? "on" : ""}"></span>`).join("")}</div>`
      : "";
  return `<div class="wcarousel"><div class="wtrack" id="wtrack">${slides}</div>${dots}</div>`;
}

function workoutSlide(plan, dayIndex) {
  const day = plan.days[dayIndex];
  const { primary, secondary } = musclesForDay(day);
  const n = day.exercises.length;
  return `<div class="wslide" data-day="${dayIndex}">
    <div class="wslide-info">
      <div class="wtitle">${esc(day.name)}</div>
      <div class="wmeta">${fmtDuration(estimateMinutes(day))} · ${n} exercise${n !== 1 ? "s" : ""}</div>
      <button class="btn wstart" data-start="${dayIndex}">START</button>
    </div>
    <div class="wslide-body">${muscleFigures(primary, secondary)}</div>
  </div>`;
}

function musclesForDay(day) {
  const primary = new Set();
  const secondary = new Set();
  for (const ex of day.exercises || []) {
    const full = getExercise(ex.exerciseId);
    if (!full) continue;
    (full.primaryMuscles || []).forEach((m) => primary.add(m));
    (full.secondaryMuscles || []).forEach((m) => secondary.add(m));
  }
  for (const m of primary) secondary.delete(m);
  return { primary, secondary };
}

function estimateMinutes(day) {
  let sets = 0;
  for (const ex of day.exercises || []) sets += Number(ex.sets) || 3;
  return Math.round(sets * 2.5 + 6);
}
function fmtDuration(min) {
  if (min >= 60) return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")} h`;
  return `${min} min`;
}

// Recommend the next day in the split: the one after the most recently logged day.
function orderedDayIndexes(plan) {
  const names = plan.days.map((d) => d.name);
  return rotate(
    plan.days.map((_, i) => i),
    startIndex(plan, names)
  );
}
function startIndex(plan, names) {
  const sessions = state.__lastSessions || [];
  for (const s of sessions) {
    const idx = names.indexOf(s.day_name);
    if (idx >= 0) return (idx + 1) % names.length;
  }
  return 0;
}
function rotate(arr, start) {
  return arr.map((_, i) => arr[(start + i) % arr.length]);
}

function wireCarousel(el) {
  const track = el.querySelector("#wtrack");
  const dots = [...el.querySelectorAll(".wdot")];
  if (!track || dots.length < 2) return;
  track.addEventListener("scroll", () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d, di) => d.classList.toggle("on", di === i));
  });
}

/* ---------------- habit cards ---------------- */

function stepsCard(goal) {
  const bars = [40, 62, 100, 78, 90, 55, 70];
  return `<div class="hcard steps">
    <div><div class="htitle">Steps</div><div class="hsub">Today</div></div>
    <div class="stepbars">${bars.map((h) => `<i style="height:${h}%"></i>`).join("")}</div>
    <div class="hfoot center">${
      goal ? `<b>0</b> <span class="muted">/ ${goal.toLocaleString()}</span>` : `<span class="muted">Not tracked yet</span>`
    }</div>
  </div>`;
}

function caloriesCard(kcal, goal) {
  const pct = goal > 0 ? Math.min(1, kcal / goal) : 0;
  const off = RING_C * (1 - pct);
  return `<div class="hcard tap" data-go="food">
    <div class="row between">
      <div><div class="htitle">Calories</div><div class="hsub">Today</div></div>
      <span class="harrow">›</span>
    </div>
    <div class="ring-wrap">
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="${RING_R}" fill="none" stroke="var(--surface-2)" stroke-width="9"/>
        <circle cx="50" cy="50" r="${RING_R}" fill="none" stroke="var(--gold)" stroke-width="9"
          stroke-linecap="round" stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <div class="ring-center">
        <div class="rv">${kcal.toLocaleString()}</div>
        <div class="rg">${goal ? "/ " + goal.toLocaleString() : "kcal"}</div>
      </div>
    </div>
  </div>`;
}

function weightCard(weightDays, week, cur) {
  return `<div class="hcard tap" data-go="weight">
    <div class="row between">
      <div><div class="htitle">Weight</div><div class="hsub">Last 30 days</div></div>
      ${cur !== null ? `<span class="hnum">${cur}<small>kg</small></span>` : ""}
    </div>
    ${dotGrid(weightDays)}
    <div class="hbar"><span style="width:${pctWidth(week, 7)}%"></span></div>
    <div class="hfoot"><b>${week}/7</b> <span class="muted">this week</span></div>
  </div>`;
}

function trainingsCard(workoutDays, week, target) {
  return `<div class="hcard tap" data-go="history">
    <div><div class="htitle">Trainings</div><div class="hsub">Last 30 days</div></div>
    ${dotGrid(workoutDays)}
    <div class="hbar"><span style="width:${pctWidth(week, target)}%"></span></div>
    <div class="hfoot"><b>${week}/${target}</b> <span class="muted">this week</span></div>
  </div>`;
}

function dotGrid(daySet) {
  const cells = [];
  const d = new Date();
  d.setDate(d.getDate() - 29);
  for (let i = 0; i < 30; i++) {
    cells.push(`<i class="dot ${daySet.has(ds(d)) ? "on" : ""}"></i>`);
    d.setDate(d.getDate() + 1);
  }
  return `<div class="dotgrid">${cells.join("")}</div>`;
}
function pctWidth(v, target) {
  return target > 0 ? Math.min(100, Math.round((v / target) * 100)) : 0;
}

/* ---------------- metrics ---------------- */

function workoutDateSet(sessions) {
  state.__lastSessions = sessions; // reused by the carousel's "next day" logic
  const set = new Set();
  for (const s of sessions || []) set.add(ds(new Date(s.performed_at)));
  return set;
}

function currentStreak(daySet) {
  let streak = 0;
  const d = new Date();
  if (!daySet.has(ds(d))) d.setDate(d.getDate() - 1); // today not trained yet is fine
  while (daySet.has(ds(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function startOfWeek() {
  const d = new Date();
  const wd = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - wd);
  d.setHours(0, 0, 0, 0);
  return d;
}
function countThisWeek(daySet) {
  const d = startOfWeek();
  let c = 0;
  for (let i = 0; i < 7; i++) {
    if (daySet.has(ds(d))) c++;
    d.setDate(d.getDate() + 1);
  }
  return c;
}
