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
  return wrap;
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
