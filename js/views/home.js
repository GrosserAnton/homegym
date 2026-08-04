import { state, loadPlans, loadWeights } from "../store.js";
import { esc } from "../ui.js";

const fmt = (n) => Math.round(n * 10) / 10;

export async function render(el, ctx) {
  const [plans, weights] = await Promise.all([loadPlans(), loadWeights()]);
  const name = state.profile?.username || "athlete";
  el.innerHTML = `
    <div class="topbar"><div><h1>Hey ${esc(name)} 👋</h1><div class="sub">Ready to train?</div></div></div>
    <div class="hero">
      <div class="k">Home gym · Muscle building</div>
      <h2>${plans.length ? "Pick a plan and go" : "Let's build your first plan"}</h2>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn primary" id="gen">⚡ Auto-generate</button>
        <button class="btn" id="browse">Browse exercises</button>
      </div>
    </div>
    ${weightCard(weights)}
    <h2 class="section">Your plans</h2>
    <div id="plans">${
      plans.length
        ? plans.map(planCard).join("")
        : `<div class="empty"><div class="big">🏋️</div><div>No plans yet. Generate one to get started.</div></div>`
    }</div>`;

  el.querySelector("#gen").addEventListener("click", () => ctx.go("plans?new=auto"));
  el.querySelector("#browse").addEventListener("click", () => ctx.go("library"));
  el.querySelector("#weightcard").addEventListener("click", () => ctx.go("weight"));
  el.querySelector("#plans").addEventListener("click", (e) => {
    const c = e.target.closest("[data-plan]");
    if (c) ctx.go("plans?id=" + c.dataset.plan);
  });
}

function weightCard(weights) {
  const cur = weights.length ? fmt(+weights[weights.length - 1].weight_kg) : null;
  let change = "";
  if (weights.length >= 2) {
    const d = +weights[weights.length - 1].weight_kg - +weights[0].weight_kg;
    change = `<span class="pill">${d > 0 ? "+" : ""}${fmt(d)} kg total</span>`;
  }
  return `<div class="card tap" id="weightcard">
    <div class="row between">
      <div><div class="muted small">⚖️ Weight</div>
        <div style="font-weight:800;font-size:20px;font-family:var(--font-display)">${cur !== null ? cur + " kg" : "Not tracked yet"}</div></div>
      <div class="row" style="gap:8px;align-items:center">${change}<span class="pill">Log →</span></div>
    </div></div>`;
}

function planCard(p) {
  const days = (p.days || []).length;
  return `<div class="card tap" data-plan="${esc(p.id)}">
    <div class="row between">
      <div class="grow"><div style="font-weight:700;font-size:16px">${esc(p.name)}</div>
        <div class="muted small">${days} day${days !== 1 ? "s" : ""} · ${p.source === "auto" ? "auto" : "custom"}</div></div>
      <span class="pill">Open</span>
    </div></div>`;
}
