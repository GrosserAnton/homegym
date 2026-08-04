import {
  state, loadNutrition, addNutrition, deleteNutrition, skipRecurringForDate,
  copyEntriesToDates, recentFoods,
  loadMeals, saveMeal, deleteMeal, loadRecurring, saveRecurring, deleteRecurring,
} from "../store.js";
import { searchFoods, lookupBarcode, scale, barcodeSupported, runScanner, MICRO_SPEC } from "../food.js";
import { rdaFor } from "../tdee.js";
import { esc, toast, openModal, closeModal } from "../ui.js";

const MEALS = [
  { id: "breakfast", label: "Breakfast", icon: "🍳" },
  { id: "lunch", label: "Lunch", icon: "🥗" },
  { id: "dinner", label: "Dinner", icon: "🍝" },
  { id: "snack", label: "Snacks", icon: "🍎" },
];
const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

let current = new Date();
const expanded = new Set(); // meal ids the user expanded; meals start collapsed (summary only)

const ds = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const same = (a, b) => ds(a) === ds(b);
function human(d) {
  const t = new Date();
  if (same(d, t)) return "Today";
  if (same(d, addDays(t, -1))) return "Yesterday";
  if (same(d, addDays(t, 1))) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}
function weekOf(d) { const wd = (d.getDay() + 6) % 7; const mon = addDays(d, -wd); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); }
const mealLabel = (id) => (MEALS.find((m) => m.id === id) || MEALS[0]).label;

function totals(entries) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, micros: {} };
  for (const e of entries) {
    t.kcal += +e.kcal; t.protein += +e.protein; t.carbs += +e.carbs; t.fat += +e.fat;
    for (const [k, v] of Object.entries(e.micros || {})) t.micros[k] = (t.micros[k] || 0) + +v;
  }
  return t;
}
function bar(val, goal) {
  const pct = goal > 0 ? Math.min(100, Math.round((val / goal) * 100)) : 0;
  const over = goal > 0 && val > goal;
  return `<div class="pbar"><span style="width:${pct}%${over ? ";background:var(--danger)" : ""}"></span></div>`;
}
// Reconstruct a "food" (per-100g) object from a stored/saved entry so amounts can be re-edited.
function foodFromEntry(e) {
  const amt = e.amount_g || 100; const f = 100 / amt;
  const micros = {};
  for (const [k, v] of Object.entries(e.micros || {})) micros[k] = v * f;
  return { code: e.code || null, name: e.name, brand: e.brand || null, serving_g: e.amount_g || null,
    per100: { kcal: (e.kcal || 0) * f, protein: (e.protein || 0) * f, carbs: (e.carbs || 0) * f, fat: (e.fat || 0) * f, micros } };
}

export async function render(el, ctx) {
  el.innerHTML = `<div class="topbar"><div class="grow"><h1 style="margin:0">Nutrition</h1><div class="sub" id="dlabel"></div></div>
      <button class="btn icon ghost" id="daymenu" title="More">⋯</button></div>
    <div id="week"></div>
    <div id="body"><div class="spinner"></div></div>`;
  el.querySelector("#daymenu").onclick = () => openDayMenu(draw);

  function drawWeek() {
    const days = weekOf(current);
    el.querySelector("#week").innerHTML = `<div class="weekstrip">
      <button class="btn icon ghost" id="pw">‹</button>
      <div class="wdays">${days.map((d) => `<button class="wday ${same(d, current) ? "on" : ""} ${same(d, new Date()) ? "today" : ""}" data-d="${ds(d)}">
        <span class="wn">${WD[(d.getDay() + 6) % 7]}</span><span class="wnum">${d.getDate()}</span></button>`).join("")}</div>
      <button class="btn icon ghost" id="nw">›</button></div>`;
    el.querySelector("#pw").onclick = () => { current = addDays(current, -7); drawWeek(); draw(); };
    el.querySelector("#nw").onclick = () => { current = addDays(current, 7); drawWeek(); draw(); };
    el.querySelectorAll(".wday").forEach((b) => { b.onclick = () => { current = new Date(b.dataset.d + "T00:00:00"); drawWeek(); draw(); }; });
  }

  async function draw() {
    el.querySelector("#dlabel").textContent = human(current);
    drawWeek();
    const body = el.querySelector("#body");
    body.innerHTML = `<div class="spinner"></div>`;
    let entries = [];
    try { entries = await loadNutrition(ds(current)); }
    catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    body.innerHTML = overviewHtml(entries) + mealsHtml(entries) + microsHtml(entries);
    wireBody(body, entries, draw);
  }

  drawWeek();
  await draw();
}

function overviewHtml(entries) {
  const t = totals(entries); const p = state.profile || {};
  const kcalGoal = p.kcal_goal || 0;
  const kcal = Math.round(t.kcal);
  const rem = kcalGoal ? kcalGoal - kcal : null;
  return `<div class="card">
    <div class="row between" style="align-items:flex-end">
      <div><div class="muted small">Calories</div>
        <div style="font-size:32px;font-weight:800;font-family:var(--font-display)">${kcal}${kcalGoal ? ` <span class="muted" style="font-size:15px">/ ${kcalGoal}</span>` : ""}</div></div>
      ${rem !== null
        ? `<div class="center"><div style="font-size:20px;font-weight:800" class="${rem < 0 ? "over" : ""}">${rem < 0 ? "+" + (-rem) : rem}</div><div class="muted tiny">${rem < 0 ? "over" : "left"}</div></div>`
        : `<div class="muted small">kcal</div>`}
    </div>
    ${kcalGoal ? bar(kcal, kcalGoal) : ""}
    <div class="macro-row" style="margin-top:16px">
      ${macroCol("Protein", t.protein, p.protein_goal || 0)}
      ${macroCol("Carbs", t.carbs, p.carb_goal || 0)}
      ${macroCol("Fat", t.fat, p.fat_goal || 0)}
    </div>
    ${!kcalGoal ? `<div class="tiny muted center" style="margin-top:12px">Set your goal in Profile → to see targets & what's left.</div>` : ""}
  </div>`;
}
function macroCol(label, val, goal) {
  const v = Math.round(val * 10) / 10;
  const rem = goal ? Math.round((goal - v) * 10) / 10 : null;
  return `<div class="macro">
    <div class="mv">${v}${goal ? `<span class="muted" style="font-size:11px">/${goal}g</span>` : "g"}</div>
    <div class="ml">${label}${rem !== null ? ` · ${rem < 0 ? "+" + (-rem) : rem} left` : ""}</div>
    ${goal ? bar(v, goal) : ""}</div>`;
}

function mealTotals(items) {
  return items.reduce(
    (a, e) => ({ kcal: a.kcal + +e.kcal, protein: a.protein + +e.protein, carbs: a.carbs + +e.carbs, fat: a.fat + +e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
function mealsHtml(entries) {
  return MEALS.map((m) => {
    const items = entries.filter((e) => (e.meal || "breakfast") === m.id);
    const t = mealTotals(items);
    const collapsed = items.length && !expanded.has(m.id);
    const summary = items.length
      ? `<div class="meal-macros">${Math.round(t.kcal)} kcal · P${Math.round(t.protein)} · C${Math.round(t.carbs)} · F${Math.round(t.fat)}</div>`
      : "";
    return `<div class="card tap meal${collapsed ? " collapsed" : ""}" data-mealcard="${m.id}">
      <div class="row between">
        <div class="grow" style="min-width:0">
          <div class="row" style="gap:8px"><span>${m.icon}</span><b>${m.label}</b></div>
          ${summary}
        </div>
        <div class="row" style="gap:6px">
          ${items.length ? `<button class="btn icon ghost sm" data-mealmenu="${m.id}" title="Meal actions">⋯</button>` : ""}
          <button class="btn icon sm" data-addmeal="${m.id}" title="Add food">+</button>
          ${items.length ? `<button class="btn icon ghost sm meal-toggle" data-mealtoggle="${m.id}" title="${collapsed ? "Show items" : "Hide items"}">${collapsed ? "▸" : "▾"}</button>` : ""}
        </div>
      </div>
      ${items.length ? `<div class="meal-items">${items.map(entryRow).join("")}</div>` : ""}
    </div>`;
  }).join("");
}
function entryRow(e) {
  return `<div class="food-row">
    <div class="grow"><div class="name">${e.recurring_id ? '<span title="Recurring">↻ </span>' : ""}${esc(e.name)}</div>
      <div class="tags">${e.amount_g ? Math.round(e.amount_g) + " g · " : ""}${Math.round(e.kcal)} kcal · P${Math.round(e.protein)} C${Math.round(e.carbs)} F${Math.round(e.fat)}</div></div>
    <button class="btn icon danger sm" data-del="${esc(e.id)}" data-rec="${e.recurring_id || ""}">✕</button>
  </div>`;
}

function microsHtml(entries) {
  const t = totals(entries);
  const rda = rdaFor((state.profile || {}).sex);
  const rows = MICRO_SPEC.map((m) => {
    const val = t.micros[m.key];
    if (val === undefined) return `<div class="micro-row"><span>${m.label}</span><span class="muted tiny">no data</span></div>`;
    const v = Math.round(val * 10) / 10; const goal = rda[m.key];
    return `<div class="micro-row"><span>${m.label}${m.limit ? ' <span class="tiny muted">(limit)</span>' : ""}</span>
      <span>${v} ${m.unit}${goal ? ` <span class="muted tiny">/ ${goal}</span>` : ""}</span></div>${goal ? bar(v, goal) : ""}`;
  }).join("");
  return `<div class="card"><details><summary style="cursor:pointer;font-weight:700">Micronutrients</summary>
    <div class="tiny muted" style="margin:6px 0 10px">Best effort — many products don't list every value.</div>
    ${rows}</details></div>`;
}

function wireBody(body, entries, draw) {
  // The whole meal card opens the add-food dialog (not just the + button) —
  // except when tapping the per-item delete (✕) or the meal actions (⋯) button.
  body.querySelectorAll("[data-mealcard]").forEach((c) => {
    c.onclick = (e) => {
      if (e.target.closest("[data-del], [data-mealmenu], [data-mealtoggle]")) return;
      openAdd(c.dataset.mealcard, draw);
    };
  });
  // Collapse / expand a meal's item list (default collapsed → summary only).
  body.querySelectorAll("[data-mealtoggle]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.mealtoggle;
      const card = b.closest("[data-mealcard]");
      const nowCollapsed = card.classList.toggle("collapsed");
      if (nowCollapsed) expanded.delete(id); else expanded.add(id);
      b.textContent = nowCollapsed ? "▸" : "▾";
      b.title = nowCollapsed ? "Show items" : "Hide items";
    };
  });
  body.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = async () => {
      if (b.dataset.rec) { try { await skipRecurringForDate(b.dataset.rec, ds(current)); } catch (e) {} }
      try { await deleteNutrition(b.dataset.del); toast("Removed"); draw(); } catch (e) { toast(e.message || "Error", "error"); }
    };
  });
  body.querySelectorAll("[data-mealmenu]").forEach((b) => {
    b.onclick = () => openMealMenu(b.dataset.mealmenu, entries.filter((e) => (e.meal || "breakfast") === b.dataset.mealmenu), draw);
  });
}

// ---- Add food (search / recent / saved meals / barcode) ----
async function openAdd(meal, onDone) {
  let tab = "search";
  const wrap = openModal(`<div class="grabber"></div>
    <div class="row between"><h2 style="margin:0 0 8px">Add to ${esc(mealLabel(meal))}</h2><button class="btn sm ghost" data-close>Cancel</button></div>
    <div class="chips" id="atabs">
      <div class="chip on" data-t="search">Search</div><div class="chip" data-t="recent">Recent</div><div class="chip" data-t="saved">Saved meals</div>
    </div>
    <div id="arow" class="row" style="gap:8px">
      <input id="aq" placeholder="Search food…" autocomplete="off" style="flex:1" />
      ${barcodeSupported() ? `<button class="btn icon" id="ascan" title="Scan barcode">▣</button>` : ""}
    </div>
    <div id="ahint" class="muted small" style="margin:8px 2px"></div>
    <div id="alist"></div>`);
  const box = wrap.querySelector(".modal");
  const list = box.querySelector("#alist"), hint = box.querySelector("#ahint"), arow = box.querySelector("#arow");

  box.querySelector("#atabs").addEventListener("click", (e) => {
    const c = e.target.closest("[data-t]"); if (!c) return;
    tab = c.dataset.t;
    box.querySelectorAll("#atabs .chip").forEach((x) => x.classList.toggle("on", x.dataset.t === tab));
    arow.style.display = tab === "search" ? "flex" : "none";
    if (tab === "recent") showRecent();
    else if (tab === "saved") showSaved();
    else { hint.textContent = ""; list.innerHTML = ""; box.querySelector("#aq").focus(); }
  });

  let timer = null;
  box.querySelector("#aq").addEventListener("input", (e) => {
    const q = e.target.value; clearTimeout(timer);
    if (q.trim().length < 2) { hint.textContent = ""; list.innerHTML = ""; return; }
    hint.textContent = "Searching…";
    timer = setTimeout(async () => {
      try {
        const foods = await searchFoods(q);
        hint.textContent = foods.length ? `${foods.length} results` : "No results";
        list.innerHTML = foods.map((f, i) => foodRow(f, i)).join("");
        list.querySelectorAll("[data-food]").forEach((elm) => { elm.onclick = () => openPortion(foods[+elm.dataset.food], meal, onDone); });
      } catch (err) { hint.textContent = "Search failed — try again"; }
    }, 350);
  });

  const scanBtn = box.querySelector("#ascan");
  if (scanBtn) scanBtn.onclick = () => openScanner(async (code) => {
    hint.textContent = "Looking up…";
    try { const f = await lookupBarcode(code); if (f) openPortion(f, meal, onDone); else toast("Product not found", "error"); }
    catch (e) { toast("Lookup failed", "error"); }
  });

  async function showRecent() {
    hint.textContent = "Recent";
    let rec = [];
    try { rec = await recentFoods(); } catch (e) {}
    list.innerHTML = rec.length ? rec.map((r, i) => quickRow(r, i)).join("") : `<div class="empty">Nothing yet.</div>`;
    list.querySelectorAll("[data-q]").forEach((elm) => { elm.onclick = () => openPortion(foodFromEntry(rec[+elm.dataset.q]), meal, onDone); });
  }
  async function showSaved() {
    hint.textContent = "Saved meals";
    let meals = [];
    try { meals = await loadMeals(); } catch (e) {}
    list.innerHTML = meals.length
      ? meals.map((m) => {
          const t = totals(m.items || []);
          return `<div class="food-row" data-meal="${m.id}" style="cursor:pointer">
            <div class="grow"><div class="name">${esc(m.name)}</div><div class="tags">${(m.items || []).length} items · ${Math.round(t.kcal)} kcal</div></div>
            <button class="btn icon danger sm" data-delmeal="${m.id}">✕</button></div>`;
        }).join("")
      : `<div class="empty">No saved meals yet.<div class="tiny muted" style="margin-top:6px">Log a meal, then ⋯ → “Save as meal”.</div></div>`;
    list.querySelectorAll("[data-meal]").forEach((elm) => {
      elm.onclick = async (ev) => {
        if (ev.target.closest("[data-delmeal]")) return;
        const m = meals.find((x) => x.id === elm.dataset.meal);
        try { await copyEntriesToDates(m.items || [], [ds(current)], meal); closeModal(); toast("Meal added 🍽️", "ok"); onDone(); }
        catch (e) { toast(e.message || "Error", "error"); }
      };
    });
    list.querySelectorAll("[data-delmeal]").forEach((b) => { b.onclick = async () => { await deleteMeal(b.dataset.delmeal); showSaved(); }; });
  }
}

function foodRow(f, i) {
  return `<div class="food-row" data-food="${i}" style="cursor:pointer">
    <div class="grow"><div class="name">${esc(f.name)}</div>
      <div class="tags">${Math.round(f.per100.kcal)} kcal/100g · P${f.per100.protein} C${f.per100.carbs} F${f.per100.fat}${f.brand ? " · " + esc(f.brand) : ""}</div></div></div>`;
}
function quickRow(r, i) {
  return `<div class="food-row" data-q="${i}" style="cursor:pointer">
    <div class="grow"><div class="name">${esc(r.name)}</div>
      <div class="tags">${r.amount_g ? Math.round(r.amount_g) + " g · " : ""}${Math.round(r.kcal)} kcal${r.brand ? " · " + esc(r.brand) : ""}</div></div>
    <span class="pill">+ add</span></div>`;
}

function openPortion(food, meal, onDone) {
  const def = food.serving_g && food.serving_g > 0 ? food.serving_g : 100;
  const wrap = openModal(`<div class="grabber"></div>
    <h2 style="margin:0 0 4px">${esc(food.name)}</h2>
    <div class="muted small" style="margin-bottom:12px">${food.brand ? esc(food.brand) + " · " : ""}${Math.round(food.per100.kcal)} kcal / 100 g</div>
    <div class="row" style="gap:10px">
      <label class="field grow"><span class="lab">Amount (g)</span><input id="amt" inputmode="decimal" value="${def}" /></label>
      <label class="field grow"><span class="lab">Meal</span><select id="meal">${MEALS.map((m) => `<option value="${m.id}" ${m.id === meal ? "selected" : ""}>${m.label}</option>`).join("")}</select></label>
    </div>
    <div class="card" id="prev"></div>
    <button class="btn primary" id="addb" style="margin-top:8px">Add</button>
    <button class="btn ghost" data-close style="margin-top:10px">Cancel</button>`);
  const box = wrap.querySelector(".modal");
  const amt = box.querySelector("#amt");
  const upd = () => {
    const s = scale(food.per100, Number(amt.value) || 0);
    box.querySelector("#prev").innerHTML = `<div class="macro-row">
      <div class="macro"><div class="mv">${s.kcal}</div><div class="ml">kcal</div></div>
      <div class="macro"><div class="mv">${s.protein}g</div><div class="ml">Protein</div></div>
      <div class="macro"><div class="mv">${s.carbs}g</div><div class="ml">Carbs</div></div>
      <div class="macro"><div class="mv">${s.fat}g</div><div class="ml">Fat</div></div></div>`;
  };
  amt.addEventListener("input", upd); upd();
  box.querySelector("#addb").onclick = async () => {
    const g = Number(amt.value) || 0;
    if (g <= 0) { toast("Enter an amount", "error"); return; }
    const s = scale(food.per100, g);
    try {
      await addNutrition({ log_date: ds(current), meal: box.querySelector("#meal").value, name: food.name, brand: food.brand || null, code: food.code || null, amount_g: g, kcal: s.kcal, protein: s.protein, carbs: s.carbs, fat: s.fat, micros: s.micros });
      closeModal(); toast("Added 🍽️", "ok"); onDone();
    } catch (err) { toast(err.message || "Could not add", "error"); }
  };
}

// ---- meal actions (save as meal / make recurring / clear) ----
function openMealMenu(mealId, items, onDone) {
  const wrap = openModal(`<div class="grabber"></div>
    <h2 style="margin:0 0 12px">${esc(mealLabel(mealId))} actions</h2>
    <button class="btn" id="save">💾 Save as meal</button>
    <button class="btn" id="recur" style="margin-top:10px">↻ Make recurring…</button>
    <button class="btn danger" id="clear" style="margin-top:10px">Clear this meal</button>
    <button class="btn ghost" data-close style="margin-top:10px">Cancel</button>`);
  const box = wrap.querySelector(".modal");
  const strip = (e) => ({ name: e.name, brand: e.brand, code: e.code, amount_g: e.amount_g, meal: mealId, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, micros: e.micros || {} });
  box.querySelector("#save").onclick = async () => {
    const name = prompt("Name this meal:", mealLabel(mealId));
    if (!name) return;
    try { await saveMeal(name.trim(), items.map(strip)); closeModal(); toast("Meal saved 💾", "ok"); }
    catch (e) { toast(e.message || "Error", "error"); }
  };
  box.querySelector("#recur").onclick = () => openRecurringCreate(mealId, items.map(strip), onDone);
  box.querySelector("#clear").onclick = async () => {
    if (!confirm("Remove all foods from this meal for this day?")) return;
    try {
      for (const e of items) {
        if (e.recurring_id) { try { await skipRecurringForDate(e.recurring_id, ds(current)); } catch (x) {} }
        await deleteNutrition(e.id);
      }
      closeModal(); toast("Cleared"); onDone();
    } catch (e) { toast(e.message || "Error", "error"); }
  };
}

function openRecurringCreate(mealId, items, onDone) {
  const wrap = openModal(`<div class="grabber"></div>
    <h2 style="margin:0 0 12px">Recurring meal</h2>
    <label class="field"><span class="lab">Name</span><input id="rname" value="${esc(mealLabel(mealId))}" /></label>
    <label class="field"><span class="lab">Repeat</span>
      <select id="rfreq"><option value="daily">Every day</option><option value="weekly">Weekly (this weekday)</option></select></label>
    <div class="muted small" style="margin-bottom:10px">These ${items.length} item(s) will auto-appear on each matching day from tomorrow on (today is already logged). You can edit or remove them per day.</div>
    <button class="btn primary" id="rsave">Create recurring</button>
    <button class="btn ghost" data-close style="margin-top:10px">Cancel</button>`);
  const box = wrap.querySelector(".modal");
  box.querySelector("#rsave").onclick = async () => {
    const freq = box.querySelector("#rfreq").value;
    try {
      await saveRecurring({ name: box.querySelector("#rname").value.trim(), meal: mealId, items, freq, weekday: freq === "weekly" ? current.getDay() : null, start_date: ds(addDays(current, 1)) });
      closeModal(); toast("Recurring created ↻", "ok"); onDone();
    } catch (e) { toast(e.message || "Error", "error"); }
  };
}

// ---- day-level menu (copy day / manage saved / manage recurring) ----
function openDayMenu(onDone) {
  const wrap = openModal(`<div class="grabber"></div>
    <h2 style="margin:0 0 12px">${esc(human(current))}</h2>
    <button class="btn" id="copy">📋 Copy this day to…</button>
    <button class="btn" id="recurring" style="margin-top:10px">↻ Recurring meals</button>
    <button class="btn ghost" data-close style="margin-top:10px">Close</button>`);
  const box = wrap.querySelector(".modal");
  box.querySelector("#copy").onclick = () => openCopyDay(onDone);
  box.querySelector("#recurring").onclick = () => openRecurringManage(onDone);
}

async function openCopyDay(onDone) {
  const entries = (await loadNutrition(ds(current))).map((e) => ({ name: e.name, brand: e.brand, code: e.code, amount_g: e.amount_g, meal: e.meal, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, micros: e.micros || {} }));
  if (!entries.length) { toast("This day is empty", "error"); return; }
  const wrap = openModal(`<div class="grabber"></div>
    <h2 style="margin:0 0 12px">Copy ${entries.length} item(s) to…</h2>
    <button class="btn" id="tom">Tomorrow</button>
    <button class="btn" id="next7" style="margin-top:10px">Next 7 days</button>
    <label class="field" style="margin-top:14px"><span class="lab">Or a specific date</span><input id="date" type="date" value="${ds(addDays(current, 1))}" /></label>
    <button class="btn primary" id="godate">Copy to date</button>
    <button class="btn ghost" data-close style="margin-top:10px">Cancel</button>`);
  const box = wrap.querySelector(".modal");
  const doCopy = async (dates) => {
    try { await copyEntriesToDates(entries, dates); closeModal(); toast(`Copied to ${dates.length} day(s)`, "ok"); onDone(); }
    catch (e) { toast(e.message || "Error", "error"); }
  };
  box.querySelector("#tom").onclick = () => doCopy([ds(addDays(current, 1))]);
  box.querySelector("#next7").onclick = () => doCopy(Array.from({ length: 7 }, (_, i) => ds(addDays(current, i + 1))));
  box.querySelector("#godate").onclick = () => { const v = box.querySelector("#date").value; if (v) doCopy([v]); };
}

async function openRecurringManage(onDone) {
  const rules = await loadRecurring();
  const wrap = openModal(`<div class="grabber"></div>
    <div class="row between"><h2 style="margin:0 0 10px">Recurring meals</h2><button class="btn sm ghost" data-close>Close</button></div>
    <div id="rlist">${rules.length ? rules.map((r) => `<div class="food-row">
      <div class="grow"><div class="name">${r.active ? "" : "⏸ "}${esc(r.name || mealLabel(r.meal))}</div>
        <div class="tags">${mealLabel(r.meal)} · ${r.freq === "daily" ? "daily" : "weekly"} · ${(r.items || []).length} item(s)</div></div>
      <button class="btn icon ghost sm" data-toggle="${r.id}" title="Pause/resume">${r.active ? "⏸" : "▶"}</button>
      <button class="btn icon danger sm" data-delr="${r.id}">✕</button></div>`).join("")
      : `<div class="empty">No recurring meals.<div class="tiny muted" style="margin-top:6px">Log a meal, then ⋯ → “Make recurring”.</div></div>`}</div>`);
  const box = wrap.querySelector(".modal");
  box.querySelectorAll("[data-toggle]").forEach((b) => {
    b.onclick = async () => { const r = rules.find((x) => x.id === b.dataset.toggle); await saveRecurring({ ...r, active: !r.active }); closeModal(); openRecurringManage(onDone); onDone(); };
  });
  box.querySelectorAll("[data-delr]").forEach((b) => {
    b.onclick = async () => { await deleteRecurring(b.dataset.delr); closeModal(); openRecurringManage(onDone); onDone(); };
  });
}

async function openScanner(onCode) {
  const wrap = openModal(`<div class="grabber"></div>
    <div class="row between"><h2 style="margin:0 0 10px">Scan barcode</h2><button class="btn sm ghost" data-close>Cancel</button></div>
    <video id="scanvid" playsinline muted style="width:100%;border-radius:12px;background:#000;aspect-ratio:3/4;object-fit:cover"></video>
    <div class="muted small center" style="margin-top:10px">Point the camera at the product barcode</div>`);
  const box = wrap.querySelector(".modal");
  let stop = null;
  try { stop = await runScanner(box.querySelector("#scanvid"), (code) => { closeModal(); onCode(code); }); }
  catch (e) { closeModal(); toast("Camera not available — use search instead", "error"); return; }
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close]")) { if (stop) stop(); } });
}
