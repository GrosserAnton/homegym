import { state, saveProfile, signOut } from "../store.js";
import { EQUIPMENT_OPTIONS } from "../data.js";
import { esc, toast } from "../ui.js";

export async function render(el, ctx) {
  const p = state.profile || {};
  const equip = new Set(p.equipment || []);
  el.innerHTML = `
    <div class="topbar"><div><h1>Profile</h1><div class="sub">${esc(state.user?.email || "")}</div></div></div>
    <label class="field"><span class="lab">Username</span><input id="username" value="${esc(p.username || "")}" /></label>
    <label class="field"><span class="lab">Training days per week</span>
      <select id="days">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${+p.days_per_week === n ? "selected" : ""}>${n} days</option>`).join("")}</select></label>
    <label class="field"><span class="lab">Goal</span><select id="goal"><option value="muscle" selected>Muscle building</option></select></label>

    <h2 class="section">My equipment</h2>
    <div class="small muted" style="margin:0 2px 10px">Bodyweight is always available.</div>
    <div class="toggle-grid" id="equip">
      <div class="toggle locked on"><span class="dot"></span>Bodyweight</div>
      ${EQUIPMENT_OPTIONS.map((o) => `<div class="toggle ${equip.has(o.id) ? "on" : ""}" data-eq="${o.id}"><span class="dot"></span>${esc(o.label)}</div>`).join("")}
    </div>
    <button class="btn primary" id="save" style="margin-top:8px">Save profile</button>
    <div class="divider"></div>
    <button class="btn danger" id="logout">Log out</button>`;

  el.querySelector("#equip").addEventListener("click", (e) => {
    const t = e.target.closest("[data-eq]");
    if (t) t.classList.toggle("on");
  });
  el.querySelector("#save").addEventListener("click", async () => {
    const equipment = [...el.querySelectorAll("#equip .toggle.on[data-eq]")].map((t) => t.dataset.eq);
    try {
      await saveProfile({
        username: el.querySelector("#username").value.trim(),
        days_per_week: +el.querySelector("#days").value,
        goal: "muscle",
        equipment,
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
