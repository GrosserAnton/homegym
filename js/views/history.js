import { loadHistory } from "../store.js";
import { esc } from "../ui.js";

export async function render(el, ctx) {
  el.innerHTML = `<div class="topbar"><div><h1>History</h1></div></div><div id="body"><div class="spinner"></div></div>`;
  const sessions = await loadHistory();
  el.querySelector("#body").innerHTML = sessions.length
    ? sessions.map(card).join("")
    : `<div class="empty"><div class="big">📈</div><div>No workouts logged yet.</div></div>`;
}

function card(s) {
  const d = new Date(s.performed_at);
  const date = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `<div class="card">
    <div class="row between" style="margin-bottom:6px">
      <div style="font-weight:700">${esc(s.day_name || "Workout")}</div>
      <div class="muted small">${date} · ${time}</div>
    </div>
    ${s.items.map((it) => `<div class="small" style="padding:6px 0;border-top:1px solid var(--border)">
      <b>${esc(it.exercise_name || it.exercise_id)}</b><br>
      <span class="muted">${(it.sets || []).map((x) => `${x.weight || 0}kg×${x.reps || 0}`).join("  ·  ")}</span>
    </div>`).join("")}
  </div>`;
}
