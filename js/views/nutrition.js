import { state, loadNutrition, addNutrition, deleteNutrition, recentFoods } from "../store.js";
import { searchFoods, lookupBarcode, scale, barcodeSupported, runScanner } from "../food.js";
import { esc, toast, openModal, closeModal } from "../ui.js";

let current = new Date();

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function human(d) {
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (dateStr(d) === dateStr(today)) return "Today";
  if (dateStr(d) === dateStr(y)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export async function render(el, ctx) {
  el.innerHTML = `<div class="topbar"><div class="row between" style="width:100%">
      <button class="btn icon ghost" id="prev">‹</button>
      <div class="center"><h1 style="margin:0">Nutrition</h1><div class="sub" id="dlabel"></div></div>
      <button class="btn icon ghost" id="next">›</button>
    </div></div>
    <div id="body"><div class="spinner"></div></div>`;

  el.querySelector("#prev").onclick = () => { current.setDate(current.getDate() - 1); draw(); };
  el.querySelector("#next").onclick = () => { current.setDate(current.getDate() + 1); draw(); };

  async function draw() {
    el.querySelector("#dlabel").textContent = human(current);
    const body = el.querySelector("#body");
    body.innerHTML = `<div class="spinner"></div>`;
    let entries = [];
    try { entries = await loadNutrition(dateStr(current)); }
    catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }

    const tot = entries.reduce(
      (a, e) => ({ kcal: a.kcal + +e.kcal, protein: a.protein + +e.protein, carbs: a.carbs + +e.carbs, fat: a.fat + +e.fat }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const kcalGoal = state.profile?.kcal_goal || 0;
    const protGoal = state.profile?.protein_goal || 0;

    body.innerHTML =
      summaryHtml(tot, kcalGoal, protGoal) +
      entriesHtml(entries) +
      `<button class="btn primary" id="add" style="margin-top:8px">+ Add food</button>`;
    body.querySelector("#add").onclick = () => openAdd(draw);
    body.querySelectorAll("[data-del]").forEach((b) => {
      b.onclick = async () => { await deleteNutrition(b.dataset.del); toast("Removed"); draw(); };
    });
  }

  await draw();
}

function bar(val, goal) {
  const pct = goal > 0 ? Math.min(100, Math.round((val / goal) * 100)) : 0;
  return `<div class="pbar"><span style="width:${pct}%"></span></div>`;
}

function summaryHtml(tot, kcalGoal, protGoal) {
  const kcal = Math.round(tot.kcal);
  const remaining = kcalGoal ? kcalGoal - kcal : null;
  return `<div class="card">
    <div class="row between"><div class="muted small">Calories</div>${kcalGoal ? `<div class="muted small">Goal ${kcalGoal}</div>` : ""}</div>
    <div class="row between" style="align-items:flex-end;margin:2px 0 8px">
      <div style="font-size:32px;font-weight:800;font-family:var(--font-display)">${kcal}</div>
      ${remaining !== null
        ? `<div class="small ${remaining < 0 ? "over" : "muted"}">${remaining >= 0 ? remaining + " kcal left" : -remaining + " kcal over"}</div>`
        : `<div class="small muted">kcal</div>`}
    </div>
    ${kcalGoal ? bar(kcal, kcalGoal) : ""}
    <div class="macro-row" style="margin-top:16px">
      ${macroBox("Protein", tot.protein, protGoal)}
      ${macroBox("Carbs", tot.carbs, 0)}
      ${macroBox("Fat", tot.fat, 0)}
    </div>
  </div>`;
}
function macroBox(label, val, goal) {
  const v = Math.round(val * 10) / 10;
  return `<div class="macro">
    <div class="mv">${v}g</div>
    <div class="ml">${label}${goal ? ` / ${goal}` : ""}</div>
    ${goal ? bar(v, goal) : ""}
  </div>`;
}

function entriesHtml(entries) {
  if (!entries.length) return `<div class="empty" style="padding:26px"><div class="big">🍽️</div><div>Nothing logged yet.</div></div>`;
  return `<h2 class="section">Logged</h2>` + entries.map((e) => `<div class="ex-item" style="cursor:default">
    <div class="meta grow"><div class="name">${esc(e.name)}</div>
      <div class="tags">${e.amount_g ? Math.round(e.amount_g) + " g · " : ""}${Math.round(e.kcal)} kcal · P ${Math.round(e.protein)} · C ${Math.round(e.carbs)} · F ${Math.round(e.fat)}${e.brand ? " · " + esc(e.brand) : ""}</div></div>
    <button class="btn icon danger" data-del="${esc(e.id)}">✕</button>
  </div>`).join("");
}

// ---- Add-food flow ----
async function openAdd(onDone) {
  const wrap = openModal(`<div class="grabber"></div>
    <div class="row between"><h2 style="margin:0 0 10px">Add food</h2><button class="btn sm ghost" data-close>Cancel</button></div>
    <div class="row" style="gap:8px">
      <input id="fq" placeholder="Search food…" autocomplete="off" style="flex:1" />
      ${barcodeSupported() ? `<button class="btn icon" id="scan" title="Scan barcode">▣</button>` : ""}
    </div>
    <div id="fhint" class="muted small" style="margin:8px 2px"></div>
    <div id="fresults"></div>`);
  const box = wrap.querySelector(".modal");
  const results = box.querySelector("#fresults");
  const hint = box.querySelector("#fhint");

  // Show recent foods for one-tap re-adding.
  try {
    const rec = await recentFoods();
    if (rec.length) {
      hint.textContent = "Recent";
      results.innerHTML = rec.map((r, i) => `<div class="ex-item" data-recent="${i}" style="cursor:pointer">
        <div class="meta grow"><div class="name">${esc(r.name)}</div>
          <div class="tags">${r.amount_g ? Math.round(r.amount_g) + " g · " : ""}${Math.round(r.kcal)} kcal${r.brand ? " · " + esc(r.brand) : ""}</div></div>
        <span class="pill">+ add</span></div>`).join("");
      results.querySelectorAll("[data-recent]").forEach((elm) => {
        elm.onclick = async () => {
          const r = rec[+elm.dataset.recent];
          try {
            await addNutrition({ log_date: dateStr(current), name: r.name, brand: r.brand || null, code: r.code || null, amount_g: r.amount_g || null, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat });
            closeModal(); toast("Added 🍽️", "ok"); onDone();
          } catch (err) { toast(err.message || "Could not add", "error"); }
        };
      });
    }
  } catch (e) { /* ignore */ }

  let timer = null;
  box.querySelector("#fq").addEventListener("input", (e) => {
    const q = e.target.value;
    clearTimeout(timer);
    if (q.trim().length < 2) return;
    hint.textContent = "Searching…";
    timer = setTimeout(async () => {
      try {
        const foods = await searchFoods(q);
        hint.textContent = foods.length ? `${foods.length} results` : "No results";
        renderFoods(foods);
      } catch (err) { hint.textContent = "Search failed — try again"; }
    }, 350);
  });

  function renderFoods(foods) {
    results.innerHTML = foods.map((f, i) => `<div class="ex-item" data-food="${i}" style="cursor:pointer">
      <div class="meta grow"><div class="name">${esc(f.name)}</div>
        <div class="tags">${Math.round(f.per100.kcal)} kcal/100g · P ${f.per100.protein} · C ${f.per100.carbs} · F ${f.per100.fat}${f.brand ? " · " + esc(f.brand) : ""}</div></div></div>`).join("");
    results.querySelectorAll("[data-food]").forEach((elm) => {
      elm.onclick = () => openPortion(foods[+elm.dataset.food], onDone);
    });
  }

  const scanBtn = box.querySelector("#scan");
  if (scanBtn) {
    scanBtn.onclick = () => openScanner(async (code) => {
      hint.textContent = "Looking up…";
      try {
        const f = await lookupBarcode(code);
        if (f) openPortion(f, onDone);
        else toast("Product not found", "error");
      } catch (e) { toast("Lookup failed", "error"); }
    });
  }
}

function openPortion(food, onDone) {
  const def = food.serving_g && food.serving_g > 0 ? food.serving_g : 100;
  const wrap = openModal(`<div class="grabber"></div>
    <h2 style="margin:0 0 4px">${esc(food.name)}</h2>
    <div class="muted small" style="margin-bottom:12px">${food.brand ? esc(food.brand) + " · " : ""}${Math.round(food.per100.kcal)} kcal / 100 g</div>
    <label class="field"><span class="lab">Amount (grams)</span><input id="amt" inputmode="decimal" value="${def}" /></label>
    <div class="card" id="preview"></div>
    <button class="btn primary" id="addbtn" style="margin-top:8px">Add</button>
    <button class="btn ghost" data-close style="margin-top:10px">Cancel</button>`);
  const box = wrap.querySelector(".modal");
  const amt = box.querySelector("#amt");
  const upd = () => {
    const s = scale(food.per100, Number(amt.value) || 0);
    box.querySelector("#preview").innerHTML = `<div class="macro-row">
      <div class="macro"><div class="mv">${s.kcal}</div><div class="ml">kcal</div></div>
      <div class="macro"><div class="mv">${s.protein}g</div><div class="ml">Protein</div></div>
      <div class="macro"><div class="mv">${s.carbs}g</div><div class="ml">Carbs</div></div>
      <div class="macro"><div class="mv">${s.fat}g</div><div class="ml">Fat</div></div></div>`;
  };
  amt.addEventListener("input", upd);
  upd();
  box.querySelector("#addbtn").onclick = async () => {
    const g = Number(amt.value) || 0;
    if (g <= 0) { toast("Enter an amount", "error"); return; }
    const s = scale(food.per100, g);
    try {
      await addNutrition({ log_date: dateStr(current), name: food.name, brand: food.brand || null, code: food.code || null, amount_g: g, kcal: s.kcal, protein: s.protein, carbs: s.carbs, fat: s.fat });
      closeModal(); toast("Added 🍽️", "ok"); onDone();
    } catch (err) { toast(err.message || "Could not add", "error"); }
  };
}

async function openScanner(onCode) {
  const wrap = openModal(`<div class="grabber"></div>
    <div class="row between"><h2 style="margin:0 0 10px">Scan barcode</h2><button class="btn sm ghost" data-close>Cancel</button></div>
    <video id="scanvid" playsinline muted style="width:100%;border-radius:12px;background:#000;aspect-ratio:3/4;object-fit:cover"></video>
    <div class="muted small center" style="margin-top:10px">Point the camera at the product barcode</div>`);
  const box = wrap.querySelector(".modal");
  const video = box.querySelector("#scanvid");
  let stop = null;
  try {
    stop = await runScanner(video, (code) => { closeModal(); onCode(code); });
  } catch (e) {
    closeModal();
    toast("Camera not available — use search instead", "error");
    return;
  }
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-close]")) { if (stop) stop(); }
  });
}
