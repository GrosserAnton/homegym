import { state, saveProfile } from "../store.js";
import { EQUIPMENT_OPTIONS } from "../data.js";
import { esc, toast } from "../ui.js";
import { EQUIP_ICON, GYM_ART } from "../equipicons.js";

export async function render(el, ctx) {
  function selected() {
    return new Set((state.profile && state.profile.equipment) || []);
  }

  async function persist(list) {
    try { await saveProfile({ equipment: list }); }
    catch (e) { toast(e.message || "Could not save", "error"); }
  }

  function draw() {
    const sel = selected();
    el.innerHTML = `
      <div class="topbar"><div class="row" style="gap:10px"><button class="btn icon ghost" id="back">‹</button><h1 style="margin:0">Equipment</h1></div></div>
      <div class="muted small" style="margin:0 2px 12px">Pick everything you can train with — the plan generator only uses these.</div>
      <button class="gymcard" id="fullgym">
        <div class="gymart">${GYM_ART}</div>
        <div><div class="gymtitle">Full gym</div><div class="muted small">Tap to select everything, then turn off what's missing</div></div>
      </button>
      <div class="equipgrid">
        <div class="equipcard on locked" title="Always available"><div class="equipicon">${EQUIP_ICON.bodyweight}</div><div class="equipname">Bodyweight</div></div>
        ${EQUIPMENT_OPTIONS.map((o) => `<button class="equipcard ${sel.has(o.id) ? "on" : ""}" data-eq="${o.id}">
          <div class="equipicon">${EQUIP_ICON[o.id] || EQUIP_ICON.other}</div><div class="equipname">${esc(o.label)}</div></button>`).join("")}
      </div>`;

    el.querySelector("#back").onclick = () => ctx.go("profile");
    el.querySelector("#fullgym").onclick = async () => {
      await persist(EQUIPMENT_OPTIONS.map((o) => o.id));
      draw();
    };
    el.querySelectorAll("[data-eq]").forEach((b) => {
      b.onclick = async () => {
        const cur = selected();
        if (cur.has(b.dataset.eq)) cur.delete(b.dataset.eq); else cur.add(b.dataset.eq);
        b.classList.toggle("on", cur.has(b.dataset.eq));
        await persist([...cur]);
      };
    });
  }

  draw();
}
