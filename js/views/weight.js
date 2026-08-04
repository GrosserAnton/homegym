import { state, loadWeights, addWeight, deleteWeight } from "../store.js";
import { esc, toast } from "../ui.js";

const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (n) => Math.round(n * 10) / 10;

export async function render(el, ctx) {
  el.innerHTML = `<div class="topbar"><div class="row" style="gap:10px"><button class="btn icon ghost" id="back">‹</button><h1 style="margin:0">Weight</h1></div></div>
    <div class="card">
      <div class="row" style="gap:8px;align-items:flex-end">
        <label class="field grow" style="margin:0"><span class="lab">Date</span><input id="wd" type="date" value="${ds(new Date())}" /></label>
        <label class="field grow" style="margin:0"><span class="lab">Weight (kg)</span><input id="wkg" inputmode="decimal" placeholder="${state.profile?.weight_kg ?? "80"}" /></label>
        <button class="btn primary" id="wlog" style="width:auto">Log</button>
      </div>
    </div>
    <div id="body"><div class="spinner"></div></div>`;

  el.querySelector("#back").onclick = () => ctx.go("home");
  el.querySelector("#wlog").onclick = async () => {
    const dv = el.querySelector("#wd").value;
    const kg = parseFloat(el.querySelector("#wkg").value);
    if (!dv || !(kg > 0)) { toast("Enter a weight", "error"); return; }
    try { await addWeight(dv, kg); el.querySelector("#wkg").value = ""; toast("Logged ⚖️", "ok"); draw(); }
    catch (e) { toast(e.message || "Error", "error"); }
  };

  async function draw() {
    const body = el.querySelector("#body");
    body.innerHTML = `<div class="spinner"></div>`;
    let entries = [];
    try { entries = await loadWeights(); }
    catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    body.innerHTML = statsHtml(entries) + chartCard(entries) + historyHtml(entries);
    body.querySelectorAll("[data-del]").forEach((b) => { b.onclick = async () => { await deleteWeight(b.dataset.del); draw(); }; });
  }
  await draw();
}

function changeSince(entries, days) {
  const cur = +entries[entries.length - 1].weight_kg;
  const cutD = new Date(); cutD.setDate(cutD.getDate() - days);
  const cut = ds(cutD);
  let base = entries[0];
  for (const e of entries) { if (e.log_date <= cut) base = e; }
  return cur - +base.weight_kg;
}

function statsHtml(entries) {
  if (!entries.length) return `<div class="empty"><div class="big">⚖️</div><div>No weight logged yet.</div><div class="tiny muted" style="margin-top:6px">Log your first entry above.</div></div>`;
  const cur = +entries[entries.length - 1].weight_kg;
  const tot = cur - +entries[0].weight_kg;
  const chip = (label, val) => `<div class="stat"><div class="n">${val > 0 ? "+" : ""}${fmt(val)}</div><div class="l">${label}</div></div>`;
  return `<div class="stat-row" style="margin-bottom:12px">
    <div class="stat"><div class="n">${fmt(cur)}</div><div class="l">Current kg</div></div>
    ${chip("7 days", changeSince(entries, 7))}${chip("30 days", changeSince(entries, 30))}${chip("Total", tot)}
  </div>`;
}

function chartCard(entries) {
  if (entries.length < 2) return `<div class="card"><div class="muted small center" style="padding:16px">Log at least 2 days to see your trend.</div></div>`;
  const W = 320, H = 150, pad = 14;
  const ws = entries.map((e) => +e.weight_kg);
  const min = Math.min(...ws), max = Math.max(...ws), range = (max - min) || 1;
  const lo = min - range * 0.2, hi = max + range * 0.2, n = entries.length;
  const X = (i) => pad + (i / (n - 1)) * (W - 2 * pad);
  const Y = (w) => pad + (1 - (w - lo) / (hi - lo)) * (H - 2 * pad);
  const line = entries.map((e, i) => `${X(i).toFixed(1)},${Y(+e.weight_kg).toFixed(1)}`).join(" ");
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`;
  const last = entries[n - 1];
  return `<div class="card">
    <div class="row between small" style="margin-bottom:6px"><b>Trend</b><span class="muted">${fmt(min)}–${fmt(max)} kg</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="wchart" preserveAspectRatio="none">
      <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.28" /><stop offset="1" stop-color="var(--accent)" stop-opacity="0" /></linearGradient></defs>
      <polygon points="${area}" fill="url(#wg)" />
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
      <circle cx="${X(n - 1).toFixed(1)}" cy="${Y(+last.weight_kg).toFixed(1)}" r="3.5" fill="var(--accent)" />
    </svg>
    <div class="row between tiny muted" style="margin-top:4px"><span>${entries[0].log_date}</span><span>${last.log_date}</span></div>
  </div>`;
}

function historyHtml(entries) {
  if (!entries.length) return "";
  return `<h2 class="section">History</h2>` + [...entries].reverse().map((e) => `<div class="food-row">
    <div class="grow"><div class="name">${fmt(+e.weight_kg)} kg</div>
      <div class="tags">${new Date(e.log_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div></div>
    <button class="btn icon danger sm" data-del="${esc(e.id)}">✕</button></div>`).join("");
}
