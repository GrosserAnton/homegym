// Tiny DOM / UI helpers.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

let toastTimer = null;
export function toast(msg, type = "info") {
  let el = $("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = ""), 2600);
}

export function openModal(html) {
  closeModal();
  const wrap = document.createElement("div");
  wrap.id = "modal";
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest("[data-close]")) closeModal();
  });
  document.body.appendChild(wrap);
  document.body.classList.add("no-scroll");
  attachSwipeToClose(wrap.querySelector(".modal"));
  return wrap;
}

// Drag the bottom sheet down to dismiss it (in addition to Cancel / backdrop tap).
const DEAD_ZONE = 12; // px of finger travel before the sheet starts following
function attachSwipeToClose(sheet) {
  if (!sheet) return;
  let startY = 0, dy = 0, t0 = 0, dragging = false;
  const start = (e) => {
    if (sheet.scrollTop > 0) return; // let inner content scroll first
    if (e.target.closest("input, select, textarea, button, a, [contenteditable]")) return;
    dragging = true; dy = 0; t0 = Date.now();
    startY = e.touches[0].clientY;
    sheet.style.transition = "none";
  };
  const move = (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    sheet.style.transform = dy > DEAD_ZONE ? `translateY(${dy - DEAD_ZONE}px)` : "translateY(0)";
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    const v = dy / Math.max(1, Date.now() - t0); // px per ms (downward speed)
    sheet.style.transition = "transform .22s ease";
    // Dismiss only on a clearly deliberate gesture: a long drag OR a quick flick.
    if (dy > 150 || (dy > 60 && v > 0.6)) closeModal();
    else sheet.style.transform = "translateY(0)";
  };
  sheet.addEventListener("touchstart", start, { passive: true });
  sheet.addEventListener("touchmove", move, { passive: true });
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
}

export function closeModal() {
  const m = $("#modal");
  if (m) m.remove();
  document.body.classList.remove("no-scroll");
}

// Cross-fading 2-frame animation of an exercise's start/end images.
export function exerciseFigure(ex, imageUrl, cls = "") {
  if (!ex || !ex.images || ex.images.length === 0) {
    return `<div class="exfig placeholder ${cls}"><span>${esc(ex ? ex.name[0] : "?")}</span></div>`;
  }
  const a = imageUrl(ex.images[0]);
  const b = ex.images[1] ? imageUrl(ex.images[1]) : null;
  return `<div class="exfig ${cls}">
    <img src="${esc(a)}" alt="${esc(ex.name)}" loading="lazy">
    ${b ? `<img class="frame-b" src="${esc(b)}" alt="" loading="lazy">` : ""}
  </div>`;
}
