import { state, getExercise } from "../store.js";
import { MUSCLE_FILTERS, allowedDbEquipment } from "../data.js";
import { exItemHtml, filterExercises, openDetail } from "../exui.js";
import { esc } from "../ui.js";

let q = "", muscleId = "all", showAll = false;

export async function render(el, ctx) {
  const equipSet = allowedDbEquipment(state.profile?.equipment || []);
  el.innerHTML = `
    <div class="topbar"><div><h1>Exercises</h1><div class="sub" id="count"></div></div></div>
    <input id="q" placeholder="Search exercises…" value="${esc(q)}" autocomplete="off" />
    <div class="chips" id="chips">${MUSCLE_FILTERS.map((f) => `<div class="chip ${f.id === muscleId ? "on" : ""}" data-m="${f.id}">${f.label}</div>`).join("")}</div>
    <label class="row small muted" style="gap:8px;margin:0 2px 8px"><input type="checkbox" id="all" style="width:auto" ${showAll ? "checked" : ""} /> Include gear I don't have</label>
    <div id="list"></div>`;

  function draw() {
    const muscles = (MUSCLE_FILTERS.find((f) => f.id === muscleId) || {}).muscles;
    const res = filterExercises(state.exercises, { q, muscles, equipSet: showAll ? null : equipSet });
    const shown = res.slice(0, 80);
    el.querySelector("#count").textContent = `${res.length} exercises`;
    el.querySelector("#list").innerHTML =
      (shown.map(exItemHtml).join("") || `<div class="empty">No matches.</div>`) +
      (res.length > shown.length ? `<div class="center muted small" style="padding:10px">Showing 80 of ${res.length} — refine your search.</div>` : "");
  }

  el.querySelector("#q").addEventListener("input", (e) => { q = e.target.value; draw(); });
  el.querySelector("#all").addEventListener("change", (e) => { showAll = e.target.checked; draw(); });
  el.querySelector("#chips").addEventListener("click", (e) => {
    const c = e.target.closest("[data-m]"); if (!c) return;
    muscleId = c.dataset.m;
    el.querySelectorAll("#chips .chip").forEach((x) => x.classList.toggle("on", x.dataset.m === muscleId));
    draw();
  });
  el.querySelector("#list").addEventListener("click", (e) => {
    const it = e.target.closest("[data-ex]"); if (!it) return;
    const ex = getExercise(it.dataset.ex);
    if (ex) openDetail(ex);
  });
  draw();
}
