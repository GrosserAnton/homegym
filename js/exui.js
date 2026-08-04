// Shared exercise UI: list items, detail sheet, filtering, and the picker modal.
import { imageUrl, prettyMuscle, MUSCLE_FILTERS, allowedDbEquipment } from "./data.js";
import { state } from "./store.js";
import { esc, exerciseFigure, openModal, closeModal } from "./ui.js";

export function exItemHtml(ex) {
  const eq = ex.equipment && ex.equipment !== "body only" ? ex.equipment : "bodyweight";
  const prim = (ex.primaryMuscles || []).map(prettyMuscle).join(", ");
  return `<div class="ex-item" data-ex="${esc(ex.id)}">
    ${exerciseFigure(ex, imageUrl, "thumb")}
    <div class="meta grow">
      <div class="name">${esc(ex.name)}</div>
      <div class="tags">${esc(prim)} · <span class="badge">${esc(eq)}</span></div>
    </div>
  </div>`;
}

export function detailHtml(ex) {
  const instr = (ex.instructions || []).map((s) => `<li>${esc(s)}</li>`).join("");
  const prim = (ex.primaryMuscles || []).map(prettyMuscle).join(", ");
  const sec = (ex.secondaryMuscles || []).map(prettyMuscle).join(", ");
  return `<div class="grabber"></div>
    ${exerciseFigure(ex, imageUrl)}
    <h2 style="margin:14px 0 4px">${esc(ex.name)}</h2>
    <div class="small" style="margin-bottom:12px">
      <span class="badge">${esc(ex.equipment || "—")}</span>
      <span class="badge">${esc(ex.level || "")}</span>
      <span class="badge">${esc(ex.mechanic || "")}</span>
    </div>
    <div class="small"><b>Primary:</b> ${esc(prim || "—")}</div>
    ${sec ? `<div class="small"><b>Secondary:</b> ${esc(sec)}</div>` : ""}
    <div class="divider"></div>
    <ol class="small" style="padding-left:18px;line-height:1.7">${instr || "<li>No instructions available.</li>"}</ol>
    <button class="btn ghost" data-close style="margin-top:16px">Close</button>`;
}

export function openDetail(ex) {
  openModal(detailHtml(ex));
}

export function filterExercises(list, { q = "", muscles = null, equipSet = null } = {}) {
  const qq = q.trim().toLowerCase();
  return list.filter((e) => {
    if (equipSet && !(equipSet.has(e.equipment) || e.equipment === "body only")) return false;
    if (muscles && !e.primaryMuscles.some((m) => muscles.includes(m))) return false;
    if (qq && !e.name.toLowerCase().includes(qq)) return false;
    return true;
  });
}

// Exercise picker for the plan builder. Calls onPick(exerciseId).
export function openPicker(onPick) {
  const equipSet = allowedDbEquipment(state.profile?.equipment || []);
  let q = "", muscleId = "all", showAll = false;

  const wrap = openModal(`<div class="grabber"></div>
    <div class="row between"><h2 style="margin:0 0 10px">Add exercise</h2><button class="btn sm ghost" data-close>Cancel</button></div>
    <input id="pk-q" placeholder="Search exercises…" autocomplete="off" />
    <div class="chips" id="pk-chips">${MUSCLE_FILTERS.map((f) => `<div class="chip ${f.id === muscleId ? "on" : ""}" data-m="${f.id}">${f.label}</div>`).join("")}</div>
    <label class="row small muted" style="gap:8px;margin:2px 0 10px"><input type="checkbox" id="pk-all" style="width:auto" /> Include gear I don't have</label>
    <div id="pk-list"></div>`);
  const box = wrap.querySelector(".modal");

  function render() {
    const muscles = (MUSCLE_FILTERS.find((f) => f.id === muscleId) || {}).muscles;
    const res = filterExercises(state.exercises, { q, muscles, equipSet: showAll ? null : equipSet });
    const shown = res.slice(0, 80);
    box.querySelector("#pk-list").innerHTML =
      (shown.map(exItemHtml).join("") || `<div class="empty">No matches.</div>`) +
      (res.length > shown.length ? `<div class="center muted small" style="padding:8px">Showing 80 of ${res.length} — refine your search.</div>` : "");
  }
  box.querySelector("#pk-q").addEventListener("input", (e) => { q = e.target.value; render(); });
  box.querySelector("#pk-all").addEventListener("change", (e) => { showAll = e.target.checked; render(); });
  box.querySelector("#pk-chips").addEventListener("click", (e) => {
    const c = e.target.closest("[data-m]"); if (!c) return;
    muscleId = c.dataset.m;
    box.querySelectorAll("#pk-chips .chip").forEach((x) => x.classList.toggle("on", x.dataset.m === muscleId));
    render();
  });
  box.querySelector("#pk-list").addEventListener("click", (e) => {
    const it = e.target.closest("[data-ex]"); if (!it) return;
    closeModal();
    onPick(it.dataset.ex);
  });
  render();
}
