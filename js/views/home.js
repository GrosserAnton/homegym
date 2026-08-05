import { state, loadPlans, loadWeights, loadHistory, loadNutrition, loadSteps, saveSteps, getExercise } from "../store.js";
import { startWorkout } from "./plans.js";
import { muscleFigures } from "../body.js";
import { esc, toast, openModal, closeModal } from "../ui.js";

// Rough step rates (steps per minute) for the no-watch estimate.
const STEP_ACTIVITIES = [
  { label: "Walking / commute", spm: 110 },
  { label: "Shopping / errands", spm: 65 },
  { label: "Stroll", spm: 95 },
];

const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (n) => Math.round(n * 10) / 10;
const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;
const WD_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const todayWd = () => (new Date().getDay() + 6) % 7; // Monday = 0

export async function render(el, ctx) {
  const profile = state.profile || {};
  const today = new Date();
  const [plans, weights, sessions, food, steps] = await Promise.all([
    loadPlans(),
    loadWeights(),
    loadHistory(),
    loadNutrition(ds(today)).catch(() => []),
    loadSteps(ds(today)).catch(() => 0),
  ]);

  const plan = plans.find((p) => p.id === profile.active_plan_id) || plans[0] || null;
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
      ${stepsCard(steps, profile.steps_goal || 0)}
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

  const sc = el.querySelector("#stepscard");
  if (sc) sc.addEventListener("click", () => openStepsDialog(ds(today), steps, profile.steps_goal || 0, () => ctx.refresh()));

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
  const scheduled = days.some((d) => Number.isInteger(d.weekday));
  // Only today's workout: the day pinned to today's weekday. If days are pinned
  // but none is today, it's a rest day. If nothing is pinned yet, fall back to
  // the rotation's next day so there's still something to start.
  const dayIndex = scheduled ? days.findIndex((d) => d.weekday === todayWd()) : orderedDayIndexes(plan)[0];
  if (dayIndex < 0) {
    return `<div class="wslide wempty">
      <div class="wslide-info">
        <div class="wday-label">Today</div>
        <div class="wtitle">Rest day</div>
        <div class="wmeta">Nothing scheduled — recover and refuel 💪</div>
      </div>
    </div>`;
  }
  return `<div class="wcarousel">${workoutSlide(plan, dayIndex)}</div>`;
}

function workoutSlide(plan, dayIndex) {
  const day = plan.days[dayIndex];
  const { primary, secondary } = musclesForDay(day);
  const n = day.exercises.length;
  const wd = day.weekday;
  const label = Number.isInteger(wd) ? (wd === todayWd() ? "Today" : WD_LONG[wd]) : "";
  return `<div class="wslide" data-day="${dayIndex}">
    <div class="wslide-info">
      ${label ? `<div class="wday-label">${label}</div>` : ""}
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
  const days = plan.days;
  const idx = days.map((_, i) => i);
  // If days are pinned to weekdays, order them from today onward (today first).
  if (days.some((d) => Number.isInteger(d.weekday))) {
    const today = todayWd();
    const off = (wd) => (Number.isInteger(wd) ? (wd - today + 7) % 7 : 99); // unassigned last
    return idx.slice().sort((a, b) => off(days[a].weekday) - off(days[b].weekday));
  }
  // Otherwise fall back to rotating after the most recently trained day.
  return rotate(idx, startIndex(plan, days.map((d) => d.name)));
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

function stepsCard(steps, goal) {
  const pct = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0;
  return `<div class="hcard tap steps" id="stepscard">
    <div class="row between"><div><div class="htitle">Steps</div><div class="hsub">Today</div></div><span class="harrow">›</span></div>
    <div class="stepnum">${steps.toLocaleString()}${goal ? `<small> / ${goal.toLocaleString()}</small>` : ""}</div>
    <div class="hbar" style="margin-top:auto"><span style="width:${pct}%"></span></div>
    <div class="hfoot"><b>${goal ? pct + "%" : steps.toLocaleString()}</b> <span class="muted">${goal ? "of goal" : "steps"}</span></div>
  </div>`;
}

function openStepsDialog(dateStr, current, goal, onDone) {
  const wrap = openModal(`<div class="grabber"></div>
    <h2 style="margin:0 0 4px">Steps</h2>
    <div class="muted small" style="margin-bottom:12px">Today${goal ? ` · goal ${goal.toLocaleString()}` : ""}</div>
    <label class="field"><span class="lab">Exact steps (from your watch)</span>
      <input id="exact" inputmode="numeric" value="${current || ""}" placeholder="e.g. 8000" /></label>
    <div class="lab" style="margin:2px 2px 8px">No watch? Estimate from minutes:</div>
    ${STEP_ACTIVITIES.map((a) => `<label class="field"><span class="lab">${a.label} <span class="muted">(min)</span></span>
      <input class="actmin" data-spm="${a.spm}" inputmode="numeric" placeholder="0" /></label>`).join("")}
    <div class="card" id="steptotal"></div>
    <button class="btn primary" id="savesteps" style="margin-top:8px">Save</button>
    <button class="btn ghost" data-close style="margin-top:10px">Cancel</button>`);
  const box = wrap.querySelector(".modal");
  const exact = box.querySelector("#exact");
  const mins = [...box.querySelectorAll(".actmin")];
  const calc = () => {
    const est = mins.reduce((s, m) => s + (Number(m.value) || 0) * Number(m.dataset.spm), 0);
    const total = Math.round((Number(exact.value) || 0) + est);
    box.querySelector("#steptotal").innerHTML = `<div class="row between small"><span class="muted">Estimated from activity</span><b>${Math.round(est).toLocaleString()}</b></div>
      <div class="row between" style="margin-top:6px"><span>Total steps</span><b style="font-size:20px;font-family:var(--font-display)">${total.toLocaleString()}</b></div>`;
    return total;
  };
  [exact, ...mins].forEach((el) => el.addEventListener("input", calc));
  calc();
  box.querySelector("#savesteps").onclick = async () => {
    try { await saveSteps(dateStr, calc()); closeModal(); toast("Steps saved 👟", "ok"); onDone(); }
    catch (e) { toast(e.message || "Could not save", "error"); }
  };
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
