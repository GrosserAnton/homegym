import { state, getExercise, lastLog, saveWorkout } from "../store.js";
import { imageUrl } from "../data.js";
import { openDetail } from "../exui.js";
import { esc, toast, openModal, closeModal, exerciseFigure } from "../ui.js";
import { beep, vibrate, keepAwake, releaseAwake, countdown, mmss, unlockAudio } from "../timer.js";

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

  // Prefill working state per exercise type.
  await Promise.all(w.entries.map(async (en) => {
    if (en._init) return;
    en._init = true;
    en.type = en.type || "normal";
    en.prev = await lastLog(en.exerciseId);
    const n = Math.max(1, en.targetSets || 3);
    if (en.type === "dropset") {
      const drops = Math.max(2, en.drops || 3);
      en.sets = Array.from({ length: n }, () => ({ drops: Array.from({ length: drops }, () => ({ weight: "", reps: "" })), done: false }));
    } else if (en.type === "emom") {
      en.weight = ""; en.roundsDone = 0;
    } else if (en.type === "amrap") {
      en.weight = ""; en.rounds = 0;
    } else {
      en.sets = Array.from({ length: n }, () => ({ weight: "", reps: "", done: false }));
    }
  }));

  const blocks = buildBlocks(w.entries);
  drawBody();

  function drawBody() {
    el.querySelector("#body").innerHTML =
      blocks.map(blockHtml).join("") +
      `<button class="btn primary" id="finish" style="margin-top:8px">Finish workout</button>
       <button class="btn ghost" id="cancel" style="margin:10px 0 6px">Discard</button>`;
    bind();
  }

  function blockHtml(block) {
    if (block.kind === "superset") return supersetCard(block);
    const en = w.entries[block.idxs[0]], ei = block.idxs[0];
    if (en.type === "emom") return emomCard(en, ei);
    if (en.type === "amrap") return amrapCard(en, ei);
    if (en.type === "dropset") return dropsetCard(en, ei);
    return normalCard(en, ei);
  }

  // ---------- headers / shared ----------
  function exHead(en) {
    const badge = en.type !== "normal" ? `<span class="badge accent">${en.type.toUpperCase()}</span>` : "";
    return `<div class="row" style="gap:12px;margin-bottom:10px">
      <div data-info="${esc(en.exerciseId)}" style="cursor:pointer">${exerciseFigure(getExercise(en.exerciseId), imageUrl, "thumb")}</div>
      <div class="grow"><div style="font-weight:700">${esc(en.exerciseName)}</div>
        <div class="muted small">${badge}${targetText(en)}</div></div></div>`;
  }
  function targetText(en) {
    if (en.type === "emom") return `${en.rounds} min · ${esc(en.targetReps)} reps/min`;
    if (en.type === "amrap") return `${en.minutes} min AMRAP`;
    if (en.type === "dropset") return `${en.targetSets} × ${esc(en.targetReps)} · ${en.drops} drops`;
    return `Target: ${en.targetSets} × ${esc(en.targetReps || "")}`;
  }

  // ---------- normal ----------
  function normalCard(en, ei) {
    return `<div class="card">${exHead(en)}
      <div class="set-line muted tiny"><div class="idx">Set</div><div>Weight (kg)</div><div>Reps</div><div>✓</div></div>
      ${en.sets.map((s, si) => setLine(en, ei, si, s)).join("")}
      <button class="btn sm ghost" data-addset="${ei}" style="margin-top:4px">+ Add set</button></div>`;
  }
  function setLine(en, ei, si, s) {
    const prev = en.prev && en.prev[si];
    return `<div class="set-line">
      <div class="idx">${si + 1}</div>
      <input class="mini" inputmode="decimal" data-set="${ei}_${si}_weight" value="${esc(s.weight)}" placeholder="${prev ? esc(prev.weight) : "–"}" />
      <input class="mini" inputmode="numeric" data-set="${ei}_${si}_reps" value="${esc(s.reps)}" placeholder="${prev ? esc(prev.reps) : esc(en.targetReps || "–")}" />
      <div class="done ${s.done ? "on" : ""}" data-done="${ei}_${si}">✓</div></div>`;
  }

  // ---------- drop set ----------
  function dropsetCard(en, ei) {
    return `<div class="card">${exHead(en)}
      ${en.sets.map((s, si) => `<div class="dropset">
        <div class="row between" style="margin-bottom:4px"><div class="muted small">Set ${si + 1} — drops</div><div class="done ${s.done ? "on" : ""}" data-done="${ei}_${si}">✓</div></div>
        ${s.drops.map((dr, di) => `<div class="set-line" style="grid-template-columns:26px 1fr 1fr">
          <div class="idx">${di + 1}</div>
          <input class="mini" inputmode="decimal" data-drop="${ei}_${si}_${di}_weight" value="${esc(dr.weight)}" placeholder="kg" />
          <input class="mini" inputmode="numeric" data-drop="${ei}_${si}_${di}_reps" value="${esc(dr.reps)}" placeholder="${esc(en.targetReps || "reps")}" />
        </div>`).join("")}</div>`).join("")}
    </div>`;
  }

  // ---------- superset ----------
  function supersetCard(block) {
    const exs = block.idxs.map((i) => w.entries[i]);
    const rounds = exs[0].sets.length;
    return `<div class="card">
      <div class="row between" style="margin-bottom:10px"><b>Superset</b><span class="badge accent">${exs.length} exercises</span></div>
      ${Array.from({ length: rounds }, (_, r) => `<div class="ss-round">
        <div class="muted small" style="margin-bottom:4px">Round ${r + 1}</div>
        ${block.idxs.map((ei) => { const en = w.entries[ei], s = en.sets[r], prev = en.prev && en.prev[r]; return `<div class="set-line" style="grid-template-columns:1.3fr 1fr 1fr 40px">
          <div class="tiny" style="align-self:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(en.exerciseName)}</div>
          <input class="mini" inputmode="decimal" data-set="${ei}_${r}_weight" value="${esc(s.weight)}" placeholder="${prev ? esc(prev.weight) : "kg"}" />
          <input class="mini" inputmode="numeric" data-set="${ei}_${r}_reps" value="${esc(s.reps)}" placeholder="${prev ? esc(prev.reps) : esc(en.targetReps || "reps")}" />
          <div class="done ${s.done ? "on" : ""}" data-done="${ei}_${r}">✓</div></div>`; }).join("")}
      </div>`).join("")}
    </div>`;
  }

  // ---------- EMOM / AMRAP cards ----------
  function emomCard(en, ei) {
    return `<div class="card">${exHead(en)}
      <div class="row" style="gap:10px;align-items:flex-end">
        <label class="field grow" style="margin:0"><span class="lab">Weight (kg)</span><input inputmode="decimal" data-emomw="${ei}" value="${esc(en.weight || "")}" placeholder="${en.prev && en.prev[0] ? esc(en.prev[0].weight) : "–"}" /></label>
        <button class="btn primary" data-emom="${ei}" style="width:auto">▶ Start</button>
      </div>
      ${en.roundsDone ? `<div class="ok small" style="margin-top:8px">✓ ${en.roundsDone}/${en.rounds} rounds done</div>` : ""}</div>`;
  }
  function amrapCard(en, ei) {
    return `<div class="card">${exHead(en)}
      <div class="row" style="gap:10px;align-items:flex-end">
        <label class="field grow" style="margin:0"><span class="lab">Weight (kg)</span><input inputmode="decimal" data-amrapw="${ei}" value="${esc(en.weight || "")}" placeholder="${en.prev && en.prev[0] ? esc(en.prev[0].weight) : "–"}" /></label>
        <button class="btn primary" data-amrap="${ei}" style="width:auto">▶ Start</button>
      </div>
      ${en.rounds ? `<div class="ok small" style="margin-top:8px">✓ ${en.rounds} rounds</div>` : ""}</div>`;
  }

  // ---------- timers ----------
  function runEMOM(en) {
    unlockAudio();
    let lock; keepAwake().then((l) => (lock = l));
    const rounds = Math.max(1, en.rounds | 0);
    let curRound = 0, lastRound = 0;
    const wrap = openModal(`<div class="grabber"></div><div class="timer">
      <div class="timer-type">EMOM</div>
      <div class="timer-round" id="tr">Get ready…</div>
      <div class="timer-big" id="tb">${mmss(60)}</div>
      <div class="timer-sub muted small" id="ts">${esc(en.exerciseName)} · ${esc(en.targetReps)} reps/min</div>
      <div class="timer-tot muted tiny" id="tt"></div>
      <button class="btn primary" id="tstop" style="margin-top:18px">Stop</button></div>`, { className: "modal-timer" });
    const box = wrap.querySelector(".modal");
    const stop = countdown(rounds * 60, (remaining, elapsed) => {
      curRound = Math.min(rounds, Math.floor(elapsed / 60) + 1);
      if (curRound !== lastRound) { lastRound = curRound; beep(1046, 0.18); vibrate(200); box.querySelector("#tr").textContent = `Round ${curRound} / ${rounds}`; }
      box.querySelector("#tb").textContent = mmss(60 - (elapsed % 60));
      box.querySelector("#tt").textContent = `${mmss(remaining)} total left`;
    }, () => {
      beep(1318, 0.5); vibrate([300, 120, 300]);
      en.roundsDone = rounds;
      box.querySelector("#tb").textContent = "Done";
      box.querySelector("#tr").textContent = `${rounds}/${rounds} rounds ✓`;
      box.querySelector("#tstop").textContent = "Close";
    });
    box.querySelector("#tstop").onclick = () => {
      stop();
      if (!en.roundsDone) en.roundsDone = Math.max(0, curRound - 1);
      releaseAwake(lock); closeModal(); drawBody();
    };
  }
  function runAMRAP(en) {
    unlockAudio();
    let lock; keepAwake().then((l) => (lock = l));
    let count = en.rounds || 0, ended = false, lastWarn = -1;
    const total = Math.max(1, en.minutes | 0) * 60;
    const wrap = openModal(`<div class="grabber"></div><div class="timer">
      <div class="timer-type">AMRAP</div>
      <div class="timer-big" id="tb">${mmss(total)}</div>
      <div class="timer-sub muted small">${esc(en.exerciseName)}</div>
      <div class="timer-count" id="tc">${count}</div><div class="muted small">rounds</div>
      <button class="btn primary" id="tadd" style="margin-top:14px">+1 Round</button>
      <button class="btn ghost" id="tstop" style="margin-top:10px">Stop</button></div>`, { className: "modal-timer" });
    const box = wrap.querySelector(".modal");
    const finish = () => { stop(); en.rounds = count; releaseAwake(lock); closeModal(); drawBody(); };
    const stop = countdown(total, (remaining) => {
      box.querySelector("#tb").textContent = mmss(remaining);
      if (remaining <= 3 && remaining !== lastWarn) { lastWarn = remaining; beep(880, 0.1); }
    }, () => { ended = true; beep(1318, 0.6); vibrate([300, 120, 300, 120, 300]); box.querySelector("#tb").textContent = "Time!"; box.querySelector("#tadd").textContent = "Save"; });
    box.querySelector("#tadd").onclick = () => { if (ended) return finish(); count++; box.querySelector("#tc").textContent = count; beep(660, 0.07); vibrate(40); };
    box.querySelector("#tstop").onclick = finish;
  }

  // ---------- wiring ----------
  function bind() {
    el.querySelector("#finish").onclick = finish;
    el.querySelector("#cancel").onclick = () => { if (confirm("Discard this workout?")) { state.currentWorkout = null; ctx.go("plans"); } };
    el.querySelectorAll("[data-set]").forEach((inp) => inp.oninput = () => { const [ei, si, f] = inp.dataset.set.split("_"); w.entries[+ei].sets[+si][f] = inp.value; });
    el.querySelectorAll("[data-drop]").forEach((inp) => inp.oninput = () => { const [ei, si, di, f] = inp.dataset.drop.split("_"); w.entries[+ei].sets[+si].drops[+di][f] = inp.value; });
    el.querySelectorAll("[data-done]").forEach((b) => b.onclick = () => { const [ei, si] = b.dataset.done.split("_").map(Number); const s = w.entries[ei].sets[si]; s.done = !s.done; b.classList.toggle("on", s.done); });
    el.querySelectorAll("[data-addset]").forEach((b) => b.onclick = () => { w.entries[+b.dataset.addset].sets.push({ weight: "", reps: "", done: false }); drawBody(); });
    el.querySelectorAll("[data-emomw]").forEach((inp) => inp.oninput = () => { w.entries[+inp.dataset.emomw].weight = inp.value; });
    el.querySelectorAll("[data-amrapw]").forEach((inp) => inp.oninput = () => { w.entries[+inp.dataset.amrapw].weight = inp.value; });
    el.querySelectorAll("[data-emom]").forEach((b) => b.onclick = () => runEMOM(w.entries[+b.dataset.emom]));
    el.querySelectorAll("[data-amrap]").forEach((b) => b.onclick = () => runAMRAP(w.entries[+b.dataset.amrap]));
    el.querySelectorAll("[data-info]").forEach((f) => f.onclick = () => { const ex = getExercise(f.dataset.info); if (ex) openDetail(ex); });
  }

  async function finish() {
    const entries = w.entries.map((en) => {
      let sets = [];
      if (en.type === "emom") {
        const wt = en.weight || (en.prev && en.prev[0] ? en.prev[0].weight : "");
        sets = Array.from({ length: en.roundsDone || 0 }, () => ({ weight: wt, reps: en.targetReps || "" }));
      } else if (en.type === "amrap") {
        sets = en.rounds ? Array.from({ length: en.rounds }, () => ({ weight: en.weight, reps: en.targetReps || "1" })) : [];
      } else if (en.type === "dropset") {
        en.sets.forEach((s) => s.drops.forEach((d) => { if (d.weight || d.reps) sets.push({ weight: d.weight, reps: d.reps }); }));
      } else {
        en.sets.forEach((s, si) => {
          const typedW = s.weight !== "" && s.weight != null, typedR = s.reps !== "" && s.reps != null;
          if (!s.done && !typedW && !typedR) return;
          const prev = en.prev && en.prev[si];
          sets.push({ weight: typedW ? s.weight : prev ? prev.weight : "", reps: typedR ? s.reps : prev ? prev.reps : "" });
        });
      }
      return { exerciseId: en.exerciseId, exerciseName: en.exerciseName, sets };
    });
    try {
      const res = await saveWorkout({ planId: w.planId, dayName: w.dayName, entries });
      if (res.count === 0) { toast("Log at least one set first", "error"); return; }
      state.currentWorkout = null;
      toast("Workout saved 💪", "ok");
      ctx.go("history");
    } catch (err) { toast(err.message || "Could not save", "error"); }
  }
}

function buildBlocks(entries) {
  const blocks = [];
  let i = 0;
  while (i < entries.length) {
    const t = entries[i].type || "normal";
    if (t === "superset" && i + 1 < entries.length) {
      const idxs = [i]; let j = i + 1; idxs.push(j);
      while ((entries[j].type || "normal") === "superset" && j + 1 < entries.length) { j++; idxs.push(j); }
      blocks.push({ kind: "superset", idxs });
      i = j + 1;
    } else { blocks.push({ kind: t, idxs: [i] }); i++; }
  }
  return blocks;
}
