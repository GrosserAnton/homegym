import { state, loadPlans, savePlan, deletePlan, getExercise } from "../store.js";
import { allowedDbEquipment, imageUrl } from "../data.js";
import { generatePlan } from "../generator.js";
import { openPicker } from "../exui.js";
import { esc, toast, exerciseFigure } from "../ui.js";

export async function render(el, ctx) {
  const { query } = ctx;
  if (query.new === "auto") return renderAutoGenerate(el, ctx);
  if (query.id || query.new === "empty") return renderBuilder(el, ctx, query.id);
  return renderList(el, ctx);
}

async function renderList(el, ctx) {
  const plans = await loadPlans();
  el.innerHTML = `
    <div class="topbar"><div><h1>Plans</h1></div></div>
    <div class="btn-row" style="margin-bottom:14px">
      <button class="btn primary" id="gen">⚡ Auto-generate</button>
      <button class="btn" id="empty">+ New plan</button>
    </div>
    <div id="list">${
      plans.length ? plans.map(card).join("") : `<div class="empty"><div class="big">📋</div><div>No plans yet.</div></div>`
    }</div>`;
  el.querySelector("#gen").addEventListener("click", () => ctx.go("plans?new=auto"));
  el.querySelector("#empty").addEventListener("click", () => ctx.go("plans?new=empty"));
  el.querySelector("#list").addEventListener("click", (e) => {
    const c = e.target.closest("[data-plan]");
    if (c) ctx.go("plans?id=" + c.dataset.plan);
  });
}

function card(p) {
  const days = (p.days || []).length;
  return `<div class="card tap" data-plan="${esc(p.id)}"><div class="row between">
    <div class="grow"><div style="font-weight:700;font-size:16px">${esc(p.name)}</div>
      <div class="muted small">${days} day${days !== 1 ? "s" : ""} · ${p.source === "auto" ? "auto" : "custom"}</div></div>
    <span class="pill">Open</span></div></div>`;
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

async function renderBuilder(el, ctx, id) {
  await loadPlans();
  let plan;
  if (id) {
    const src = state.plans.find((p) => p.id === id);
    if (!src) { el.innerHTML = `<div class="empty"><div class="big">🤔</div><div>Plan not found.</div></div>`; return; }
    plan = JSON.parse(JSON.stringify(src));
  } else {
    plan = { name: "My Plan", source: "manual", days: [{ name: "Day 1", exercises: [] }] };
  }

  function draw() {
    el.innerHTML = `
      <div class="topbar"><div class="row" style="gap:10px"><button class="btn icon ghost" id="back">‹</button><h1 style="margin:0">Edit plan</h1></div></div>
      <label class="field"><span class="lab">Plan name</span><input id="pname" value="${esc(plan.name)}" /></label>
      <div id="days">${plan.days.map((d, di) => dayBlock(d, di)).join("")}</div>
      <button class="btn ghost" id="addday" style="margin-top:6px">+ Add day</button>
      <div class="divider"></div>
      <button class="btn primary" id="save">Save plan</button>
      ${id ? `<button class="btn danger" id="del" style="margin-top:10px">Delete plan</button>` : ""}`;
    bind();
  }

  function dayBlock(d, di) {
    return `<div class="card" data-day="${di}">
      <div class="row between" style="margin-bottom:10px">
        <input class="dayname" data-di="${di}" value="${esc(d.name)}" style="font-weight:700" />
        <button class="btn icon danger" data-delday="${di}" title="Remove day">✕</button>
      </div>
      ${d.exercises.map((ex, xi) => exRow(ex, di, xi)).join("") || `<div class="muted small" style="margin:4px 2px 10px">No exercises yet.</div>`}
      <div class="btn-row">
        <button class="btn sm" data-addex="${di}">+ Add exercise</button>
        ${d.exercises.length ? `<button class="btn sm primary" data-start="${di}">Start workout</button>` : ""}
      </div>
    </div>`;
  }

  function exRow(ex, di, xi) {
    const full = getExercise(ex.exerciseId);
    return `<div class="ex-item" style="cursor:default">
      ${exerciseFigure(full, imageUrl, "thumb")}
      <div class="meta grow"><div class="name">${esc(ex.exerciseName)}</div><div class="tags">${ex.sets} × ${esc(ex.reps)}</div></div>
      <button class="btn icon danger" data-delex="${di}_${xi}">✕</button>
    </div>`;
  }

  function bind() {
    el.querySelector("#back").onclick = () => ctx.go("plans");
    el.querySelector("#pname").oninput = (e) => { plan.name = e.target.value; };
    el.querySelectorAll(".dayname").forEach((inp) => {
      inp.oninput = () => { plan.days[+inp.dataset.di].name = inp.value; };
    });
    el.querySelector("#addday").onclick = () => { plan.days.push({ name: "Day " + (plan.days.length + 1), exercises: [] }); draw(); };
    el.querySelectorAll("[data-delday]").forEach((b) => { b.onclick = () => { plan.days.splice(+b.dataset.delday, 1); draw(); }; });
    el.querySelectorAll("[data-addex]").forEach((b) => {
      b.onclick = () => {
        const di = +b.dataset.addex;
        openPicker((exId) => {
          const full = getExercise(exId); if (!full) return;
          const compound = full.mechanic === "compound";
          plan.days[di].exercises.push({ exerciseId: exId, exerciseName: full.name, sets: compound ? 4 : 3, reps: compound ? "6-10" : "10-12" });
          draw();
        });
      };
    });
    el.querySelectorAll("[data-delex]").forEach((b) => {
      b.onclick = () => { const [di, xi] = b.dataset.delex.split("_").map(Number); plan.days[di].exercises.splice(xi, 1); draw(); };
    });
    el.querySelectorAll("[data-start]").forEach((b) => { b.onclick = () => startWorkout(plan, +b.dataset.start, ctx); });
    el.querySelector("#save").onclick = async () => {
      try { await savePlan(plan); toast("Saved", "ok"); ctx.go("plans"); }
      catch (err) { toast(err.message || "Could not save", "error"); }
    };
    const del = el.querySelector("#del");
    if (del) del.onclick = async () => { if (!confirm("Delete this plan?")) return; await deletePlan(id); toast("Deleted", "ok"); ctx.go("plans"); };
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
