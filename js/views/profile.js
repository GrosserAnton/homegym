import { state, saveProfile, signOut } from "../store.js";
import { EQUIPMENT_OPTIONS } from "../data.js";
import { ACTIVITY, WEIGHT_GOALS, computeTargets } from "../tdee.js";
import { esc, toast } from "../ui.js";

export async function render(el, ctx) {
  const p = state.profile || {};
  const equip = new Set(p.equipment || []);
  const opt = (arr, sel) => arr.map((a) => `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${esc(a.label)}</option>`).join("");

  el.innerHTML = `
    <div class="topbar"><div><h1>Profile</h1><div class="sub">${esc(state.user?.email || "")}</div></div></div>
    <label class="field"><span class="lab">Username</span><input id="username" value="${esc(p.username || "")}" /></label>
    <label class="field"><span class="lab">Training days per week</span>
      <select id="days">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${+p.days_per_week === n ? "selected" : ""}>${n} days</option>`).join("")}</select></label>

    <h2 class="section">Body &amp; calorie needs</h2>
    <div class="row" style="gap:10px">
      <label class="field grow"><span class="lab">Weight (kg)</span><input id="weight_kg" inputmode="decimal" value="${p.weight_kg ?? ""}" placeholder="80" /></label>
      <label class="field grow"><span class="lab">Height (cm)</span><input id="height_cm" inputmode="numeric" value="${p.height_cm ?? ""}" placeholder="180" /></label>
    </div>
    <div class="row" style="gap:10px">
      <label class="field grow"><span class="lab">Age</span><input id="age" inputmode="numeric" value="${p.age ?? ""}" placeholder="28" /></label>
      <label class="field grow"><span class="lab">Sex</span><select id="sex"><option value="male" ${p.sex === "male" ? "selected" : ""}>Male</option><option value="female" ${p.sex === "female" ? "selected" : ""}>Female</option></select></label>
    </div>
    <label class="field"><span class="lab">Activity level</span><select id="activity">${opt(ACTIVITY, p.activity || "moderate")}</select></label>
    <label class="field"><span class="lab">Goal</span><select id="weight_goal">${opt(WEIGHT_GOALS, p.weight_goal || "recompose")}</select></label>
    <button class="btn" id="calc">📊 Calculate my needs</button>
    <div id="calcout" class="tiny muted center" style="margin:8px 2px 0"></div>

    <h2 class="section">Daily targets</h2>
    <div class="row" style="gap:10px">
      <label class="field grow"><span class="lab">Calories (kcal)</span><input id="kcal_goal" inputmode="numeric" value="${p.kcal_goal ?? ""}" placeholder="2500" /></label>
      <label class="field grow"><span class="lab">Protein (g)</span><input id="protein_goal" inputmode="numeric" value="${p.protein_goal ?? ""}" placeholder="160" /></label>
    </div>
    <div class="row" style="gap:10px">
      <label class="field grow"><span class="lab">Carbs (g)</span><input id="carb_goal" inputmode="numeric" value="${p.carb_goal ?? ""}" placeholder="280" /></label>
      <label class="field grow"><span class="lab">Fat (g)</span><input id="fat_goal" inputmode="numeric" value="${p.fat_goal ?? ""}" placeholder="70" /></label>
    </div>
    <label class="field"><span class="lab">Steps per day</span><input id="steps_goal" inputmode="numeric" value="${p.steps_goal ?? ""}" placeholder="8000" /></label>

    <h2 class="section">My equipment</h2>
    <div class="small muted" style="margin:0 2px 10px">Bodyweight is always available.</div>
    <div class="toggle-grid" id="equip">
      <div class="toggle locked on"><span class="dot"></span>Bodyweight</div>
      ${EQUIPMENT_OPTIONS.map((o) => `<div class="toggle ${equip.has(o.id) ? "on" : ""}" data-eq="${o.id}"><span class="dot"></span>${esc(o.label)}</div>`).join("")}
    </div>
    <button class="btn primary" id="save" style="margin-top:8px">Save profile</button>
    <div class="divider"></div>
    <button class="btn danger" id="logout">Log out</button>`;

  const val = (id) => el.querySelector("#" + id).value;
  const setVal = (id, v) => { el.querySelector("#" + id).value = v; };

  el.querySelector("#calc").addEventListener("click", () => {
    const t = computeTargets({
      weight_kg: val("weight_kg"), height_cm: val("height_cm"), age: val("age"),
      sex: val("sex"), activity: val("activity"), weight_goal: val("weight_goal"),
    });
    if (!t) { toast("Enter weight, height and age first", "error"); return; }
    setVal("kcal_goal", t.kcal_goal); setVal("protein_goal", t.protein_goal);
    setVal("carb_goal", t.carb_goal); setVal("fat_goal", t.fat_goal);
    el.querySelector("#calcout").textContent = `Maintenance ≈ ${t.tdee} kcal → target ${t.kcal_goal} kcal · ${t.protein_goal}P / ${t.carb_goal}C / ${t.fat_goal}F. Adjust if you like, then Save.`;
  });

  el.querySelector("#equip").addEventListener("click", (e) => {
    const t = e.target.closest("[data-eq]");
    if (t) t.classList.toggle("on");
  });

  el.querySelector("#save").addEventListener("click", async () => {
    const equipment = [...el.querySelectorAll("#equip .toggle.on[data-eq]")].map((t) => t.dataset.eq);
    const intOrNull = (id) => { const n = parseInt(val(id), 10); return Number.isFinite(n) && n > 0 ? n : null; };
    const numOrNull = (id) => { const n = parseFloat(val(id)); return Number.isFinite(n) && n > 0 ? n : null; };
    try {
      await saveProfile({
        username: val("username").trim(),
        days_per_week: +val("days"),
        goal: "muscle",
        equipment,
        weight_kg: numOrNull("weight_kg"), height_cm: numOrNull("height_cm"), age: intOrNull("age"),
        sex: val("sex"), activity: val("activity"), weight_goal: val("weight_goal"),
        kcal_goal: intOrNull("kcal_goal"), protein_goal: intOrNull("protein_goal"),
        carb_goal: intOrNull("carb_goal"), fat_goal: intOrNull("fat_goal"),
        steps_goal: intOrNull("steps_goal"),
      });
      toast("Profile saved", "ok");
    } catch (err) {
      toast(err.message || "Could not save", "error");
    }
  });

  el.querySelector("#logout").addEventListener("click", async () => {
    await signOut();
    location.hash = "";
  });
}
