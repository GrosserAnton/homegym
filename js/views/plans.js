import { state, loadPlans, savePlan, deletePlan, getExercise, saveProfile } from "../store.js";
import { allowedDbEquipment, imageUrl } from "../data.js";
import { generatePlan } from "../generator.js";
import { openPicker } from "../exui.js";
import { esc, toast, exerciseFigure } from "../ui.js";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // 0 = Monday

export async function render(el, ctx) {
  const { query } = ctx;
  if (query.new === "auto") return renderAutoGenerate(el, ctx);
  if (query.id || query.new === "empty") return renderBuilder(el, ctx, query.id || null, query.day != null ? +query.day : null);
  return renderList(el, ctx);
}

async function renderList(el, ctx) {
  const plans = await loadPlans();
  const activeId = (state.profile || {}).active_plan_id;
  const multi = plans.length > 1;
  el.innerHTML = `
    <div class="topbar"><div><h1>Plans</h1></div></div>
    ${multi ? `<div class="muted small" style="margin:0 2px 12px">Pick the plan you're currently training — the dashboard uses it for today's workout.</div>` : ""}
    <div class="btn-row" style="margin-bottom:14px">
      <button class="btn primary" id="gen">⚡ Auto-generate</button>
      <button class="btn" id="empty">+ New plan</button>
    </div>
    <div id="list">${
      plans.length ? plans.map((p) => card(p, activeId, multi)).join("") : `<div class="empty"><div class="big">📋</div><div>No plans yet.</div></div>`
    }</div>`;
  el.querySelector("#gen").addEventListener("click", () => ctx.go("plans?new=auto"));
  el.querySelector("#empty").addEventListener("click", () => ctx.go("plans?new=empty"));
  el.querySelector("#list").addEventListener("click", async (e) => {
    const sa = e.target.closest("[data-setactive]");
    if (sa) {
      e.stopPropagation();
      try { await saveProfile({ active_plan_id: sa.dataset.setactive }); toast("Active plan set", "ok"); renderList(el, ctx); }
      catch (err) { toast(err.message || "Could not set active", "error"); }
      return;
    }
    const c = e.target.closest("[data-plan]");
    if (c) ctx.go("plans?id=" + c.dataset.plan);
  });
}

function card(p, activeId, multi) {
  const days = (p.days || []).length;
  const isActive = multi && p.id === activeId;
  const setBtn = multi && p.id !== activeId ? `<button class="btn sm" data-setactive="${esc(p.id)}">Set active</button>` : "";
  return `<div class="card tap" data-plan="${esc(p.id)}"><div class="row between">
    <div class="grow"><div style="font-weight:700;font-size:16px">${esc(p.name)} ${isActive ? '<span class="pill gold">Active</span>' : ""}</div>
      <div class="muted small">${days} day${days !== 1 ? "s" : ""} · ${p.source === "auto" ? "auto" : "custom"}</div></div>
    <div class="row" style="gap:8px">${setBtn}<span class="pill">Open</span></div></div></div>`;
}

async function renderAutoGenerate(el, ctx) {
  const p = state.profile || {};
  const days = +p.days_per_week || 3;
  el.innerHTML = `
    <div class="topbar"><div class="row" style="gap:10px"><button class="btn icon ghost" id="back">‹</button>
      <div><h1 style="margin:0">Auto-generate</h1><div class="sub">Muscle building · your equipment</div></div></div></div>
    <div class="card">
      <label class="field"><span class="lab">Training days per week</span>
        <select id="days">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === days ? "selected" : ""}>${n} days</option>`).join("")}</select></label>
      <div class="muted small">Builds a split from your equipment profile. You can edit everything afterwards.</div>
    </div>
    <button class="btn primary" id="go">⚡ Generate plan</button>`;
  el.querySelector("#back").addEventListener("click", () => ctx.go("plans"));
  el.querySelector("#go").addEventListener("click", async () => {
    const d = +el.querySelector("#days").value;
    const equip = allowedDbEquipment(p.equipment || []);
    const plan = generatePlan(state.exercises, equip, d);
    try {
      const saved = await savePlan(plan);
      toast("Plan generated", "ok");
      ctx.go("plans?id=" + saved.id);
    } catch (err) {
      toast(err.message || "Could not save", "error");
    }
  });
}

async function renderBuilder(el, ctx, idParam, initialDay) {
  await loadPlans();
  let id = idParam;
  let plan;
  if (id) {
    const src = state.plans.find((p) => p.id === id);
    if (!src) { el.innerHTML = `<div class="empty"><div class="big">🤔</div><div>Plan not found.</div></div>`; return; }
    plan = JSON.parse(JSON.stringify(src));
  } else {
    plan = { name: "My Plan", source: "manual", days: [] };
  }

  // Two in-place screens (no route change) so the in-memory draft survives.
  let screen = Number.isInteger(initialDay) && plan.days[initialDay] ? "day" : "overview";
  let activeDay = Number.isInteger(initialDay) ? initialDay : 0;

  async function save() {
    try {
      const saved = await savePlan(plan);
      if (saved) { plan.id = saved.id; id = saved.id; }
      toast("Saved", "ok");
    } catch (err) { toast(err.message || "Could not save", "error"); }
  }

  const draw = () => (screen === "day" ? drawDay() : drawOverview());

  // ---------- plan overview ----------
  function drawOverview() {
    el.innerHTML = `
      <div class="topbar"><div class="row" style="gap:10px"><button class="btn icon ghost" id="back">‹</button><h1 style="margin:0">Edit plan</h1></div>
        <button class="btn sm primary" id="save" style="width:auto">Save</button></div>
      <label class="field"><span class="lab">Plan name</span><input id="pname" value="${esc(plan.name)}" /></label>
      <h2 class="section">Days</h2>
      <div id="days">${
        plan.days.length ? plan.days.map((d, di) => dayRow(d, di)).join("") : `<div class="muted small" style="margin:0 2px 12px">No days yet — add one below.</div>`
      }</div>
      <button class="btn ghost" id="addday" style="margin-top:6px">+ Add day</button>
      ${id ? `<div class="divider"></div><button class="btn danger" id="del">Delete plan</button>` : ""}`;

    el.querySelector("#back").onclick = () => ctx.go("plans");
    el.querySelector("#save").onclick = save;
    el.querySelector("#pname").oninput = (e) => { plan.name = e.target.value; };
    el.querySelector("#addday").onclick = () => { plan.days.push({ name: "Day " + (plan.days.length + 1), exercises: [] }); drawOverview(); };
    el.querySelector("#days").addEventListener("click", (e) => {
      const del = e.target.closest("[data-delday]");
      if (del) {
        e.stopPropagation();
        if (!confirm("Remove this day?")) return;
        plan.days.splice(+del.dataset.delday, 1); drawOverview(); return;
      }
      const row = e.target.closest("[data-openday]");
      if (row) { activeDay = +row.dataset.openday; screen = "day"; drawDay(); }
    });
    const del = el.querySelector("#del");
    if (del) del.onclick = async () => { if (!confirm("Delete this plan?")) return; await deletePlan(id); toast("Deleted", "ok"); ctx.go("plans"); };
  }

  function dayRow(d, di) {
    const wd = Number.isInteger(d.weekday) ? WD[d.weekday] : "Any day";
    const n = (d.exercises || []).length;
    return `<div class="card tap" data-openday="${di}"><div class="row between">
      <div class="grow"><div style="font-weight:700;font-size:16px">${esc(d.name)}</div>
        <div class="muted small">${wd} · ${n} exercise${n !== 1 ? "s" : ""}</div></div>
      <div class="row" style="gap:8px"><button class="btn icon danger sm" data-delday="${di}" title="Remove day">✕</button><span class="pill">Edit</span></div>
    </div></div>`;
  }

  // ---------- single day editor ----------
  function drawDay() {
    const d = plan.days[activeDay];
    el.innerHTML = `
      <div class="topbar"><div class="row" style="gap:10px"><button class="btn icon ghost" id="backday">‹</button><h1 style="margin:0">Edit day</h1></div>
        <button class="btn sm primary" id="save" style="width:auto">Save</button></div>
      <label class="field"><span class="lab">Day name</span><input id="dname" value="${esc(d.name)}" /></label>
      <label class="field"><span class="lab">Weekday</span>
        <select id="dweekday"><option value="">Any day</option>${WD.map((w, i) => `<option value="${i}" ${d.weekday === i ? "selected" : ""}>${w}</option>`).join("")}</select></label>
      <h2 class="section">Exercises</h2>
      <div id="exs">${
        d.exercises.map((ex, xi) => exRow(ex, xi)).join("") || `<div class="muted small" style="margin:0 2px 12px">No exercises yet.</div>`
      }</div>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn" id="addex">+ Add exercise</button>
        ${d.exercises.length ? `<button class="btn primary" id="startw">Start workout</button>` : ""}
      </div>`;

    el.querySelector("#backday").onclick = () => { screen = "overview"; drawOverview(); };
    el.querySelector("#save").onclick = save;
    el.querySelector("#dname").oninput = (e) => { d.name = e.target.value; };
    el.querySelector("#dweekday").onchange = (e) => { d.weekday = e.target.value === "" ? null : Number(e.target.value); };
    el.querySelector("#addex").onclick = () => {
      openPicker((exId) => {
        const full = getExercise(exId); if (!full) return;
        const compound = full.mechanic === "compound";
        d.exercises.push({ exerciseId: exId, exerciseName: full.name, sets: compound ? 4 : 3, reps: compound ? "6-10" : "10-12" });
        drawDay();
      });
    };
    el.querySelectorAll("[data-delex]").forEach((b) => { b.onclick = () => { d.exercises.splice(+b.dataset.delex, 1); drawDay(); }; });
    const sw = el.querySelector("#startw");
    if (sw) sw.onclick = () => startWorkout(plan, activeDay, ctx);
  }

  function exRow(ex, xi) {
    const full = getExercise(ex.exerciseId);
    return `<div class="ex-item" style="cursor:default">
      ${exerciseFigure(full, imageUrl, "thumb")}
      <div class="meta grow"><div class="name">${esc(ex.exerciseName)}</div><div class="tags">${ex.sets} × ${esc(ex.reps)}</div></div>
      <button class="btn icon danger" data-delex="${xi}">✕</button>
    </div>`;
  }

  draw();
}

export function startWorkout(plan, dayIndex, ctx) {
  const day = plan.days[dayIndex];
  state.currentWorkout = {
    planId: plan.id || null,
    planName: plan.name,
    dayName: day.name,
    entries: day.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      targetSets: ex.sets,
      targetReps: ex.reps,
      sets: [],
    })),
  };
  ctx.go("workout");
}
