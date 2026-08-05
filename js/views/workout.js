import { state, getExercise, lastLog, saveWorkout } from "../store.js";
import { imageUrl } from "../data.js";
import { openDetail } from "../exui.js";
import { esc, toast, exerciseFigure } from "../ui.js";

export async function render(el, ctx) {
  const w = state.currentWorkout;
  if (!w) {
    el.innerHTML = `<div class="topbar"><div><h1>Workout</h1></div></div>
      <div class="empty"><div class="big">💪</div><div>No active workout.</div>
      <button class="btn primary" style="margin-top:14px;max-width:220px" id="toplans">Go to plans</button></div>`;
    el.querySelector("#toplans").onclick = () => ctx.go("plans");
    return;
  }

  el.innerHTML = `<div class="topbar"><div><h1>${esc(w.dayName || "Workout")}</h1><div class="sub">${esc(w.planName || "")}</div></div></div><div id="body"><div class="spinner"></div></div>`;

  // Prefill sets from the last logged session for each exercise.
  await Promise.all(
    w.entries.map(async (en) => {
      if (en.sets.length) return;
      const target = en.targetSets || 3;
      const prev = await lastLog(en.exerciseId);
      en.prev = prev;
      // Start empty — last time's values show as a greyed placeholder. Tapping ✓
      // without typing logs the set with the previous value; typing overwrites it.
      en.sets = Array.from({ length: target }, () => ({ weight: "", reps: "", done: false }));
    })
  );

  drawBody();

  function drawBody() {
    el.querySelector("#body").innerHTML =
      w.entries.map(entryBlock).join("") +
      `<button class="btn primary" id="finish" style="margin-top:8px">Finish workout</button>
       <button class="btn ghost" id="cancel" style="margin:10px 0 6px">Discard</button>`;

    el.querySelector("#finish").onclick = finish;
    el.querySelector("#cancel").onclick = () => {
      if (confirm("Discard this workout?")) { state.currentWorkout = null; ctx.go("plans"); }
    };
    el.querySelectorAll("[data-set]").forEach((inp) => {
      inp.addEventListener("input", () => {
        const [ei, si, field] = inp.dataset.set.split("_");
        w.entries[+ei].sets[+si][field] = inp.value;
      });
    });
    el.querySelectorAll("[data-done]").forEach((b) => {
      b.addEventListener("click", () => {
        const [ei, si] = b.dataset.done.split("_").map(Number);
        w.entries[ei].sets[si].done = !w.entries[ei].sets[si].done;
        b.classList.toggle("on", w.entries[ei].sets[si].done);
      });
    });
    el.querySelectorAll("[data-addset]").forEach((b) => {
      b.addEventListener("click", () => { w.entries[+b.dataset.addset].sets.push({ weight: "", reps: "", done: false }); drawBody(); });
    });
    el.querySelectorAll("[data-info]").forEach((f) => {
      f.addEventListener("click", () => { const ex = getExercise(f.dataset.info); if (ex) openDetail(ex); });
    });
  }

  function entryBlock(en, ei) {
    return `<div class="card">
      <div class="row" style="gap:12px;margin-bottom:10px">
        <div data-info="${esc(en.exerciseId)}" style="cursor:pointer">${exerciseFigure(getExercise(en.exerciseId), imageUrl, "thumb")}</div>
        <div class="grow"><div style="font-weight:700">${esc(en.exerciseName)}</div>
          <div class="muted small">Target: ${en.targetSets} × ${esc(en.targetReps || "")}</div></div>
      </div>
      <div class="set-line muted tiny"><div class="idx">Set</div><div>Weight (kg)</div><div>Reps</div><div>✓</div></div>
      ${en.sets.map((s, si) => `<div class="set-line">
        <div class="idx">${si + 1}</div>
        <input class="mini" inputmode="decimal" data-set="${ei}_${si}_weight" value="${esc(s.weight)}" placeholder="${en.prev && en.prev[si] ? esc(en.prev[si].weight) : "–"}" />
        <input class="mini" inputmode="numeric" data-set="${ei}_${si}_reps" value="${esc(s.reps)}" placeholder="${en.prev && en.prev[si] ? esc(en.prev[si].reps) : esc(en.targetReps || "–")}" />
        <div class="done ${s.done ? "on" : ""}" data-done="${ei}_${si}">✓</div>
      </div>`).join("")}
      <button class="btn sm ghost" data-addset="${ei}" style="margin-top:4px">+ Add set</button>
    </div>`;
  }

  async function finish() {
    // Resolve each set: typed value wins; an empty but ✓-checked set falls back
    // to last time's value; untouched, unchecked sets are dropped.
    const entries = w.entries.map((en) => ({
      exerciseId: en.exerciseId,
      exerciseName: en.exerciseName,
      sets: en.sets.map((s, si) => {
        const typedW = s.weight !== "" && s.weight != null;
        const typedR = s.reps !== "" && s.reps != null;
        if (!s.done && !typedW && !typedR) return null;
        const prev = en.prev && en.prev[si];
        return {
          weight: typedW ? s.weight : prev ? prev.weight : "",
          reps: typedR ? s.reps : prev ? prev.reps : "",
        };
      }).filter(Boolean),
    }));
    try {
      const res = await saveWorkout({ planId: w.planId, dayName: w.dayName, entries });
      if (res.count === 0) { toast("Log at least one set first", "error"); return; }
      state.currentWorkout = null;
      toast("Workout saved 💪", "ok");
      ctx.go("history");
    } catch (err) {
      toast(err.message || "Could not save", "error");
    }
  }
}
