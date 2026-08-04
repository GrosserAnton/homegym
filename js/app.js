// App controller: auth gate, hash routing, bottom nav.
import { supa } from "./supabase.js";
import { state, refreshUser, ensureProfile, initExercises } from "./store.js";
import { $, esc } from "./ui.js";
import * as Auth from "./views/auth.js";
import * as Home from "./views/home.js";
import * as Library from "./views/library.js";
import * as Plans from "./views/plans.js";
import * as Workout from "./views/workout.js";
import * as History from "./views/history.js";
import * as Nutrition from "./views/nutrition.js";
import * as Weight from "./views/weight.js";
import * as Profile from "./views/profile.js";

const appEl = document.getElementById("app");

const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  library: '<circle cx="5" cy="12" r="2.4"/><circle cx="19" cy="12" r="2.4"/><line x1="7.4" y1="12" x2="16.6" y2="12"/>',
  plans: '<rect x="5" y="4" width="14" height="17" rx="2"/><line x1="8.5" y1="9" x2="15.5" y2="9"/><line x1="8.5" y1="13" x2="15.5" y2="13"/><line x1="8.5" y1="17" x2="12.5" y2="17"/>',
  food: '<path d="M12 8.2c2-2.2 6-1.4 6 2.3 0 3.3-2.7 7-4.3 7-.8 0-1-.4-1.7-.4s-.9.4-1.7.4C8.7 17.5 6 13.8 6 10.5c0-3.7 4-4.5 6-2.3z"/><path d="M12 8.2V6c0-1.1.9-2 2-2"/>',
  history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  profile: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs = ""] = raw.split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}
function go(path) { location.hash = "#/" + path; }

const ROUTES = {
  "": ["home", Home], home: ["home", Home], library: ["library", Library],
  plans: ["plans", Plans], workout: ["plans", Workout], food: ["food", Nutrition],
  history: ["history", History], profile: ["profile", Profile], weight: ["home", Weight],
};

function navHtml(active) {
  const tab = (id, label) =>
    `<a href="#/${id}" data-tab="${id}" class="${id === active ? "active" : ""}">
      <svg class="ic" viewBox="0 0 24 24">${ICON[id]}</svg><span>${label}</span></a>`;
  return `<nav class="tabbar"><div class="inner">
    ${tab("home", "Home")}${tab("library", "Exercises")}${tab("plans", "Plans")}${tab("food", "Food")}${tab("history", "History")}${tab("profile", "Profile")}
  </div></nav>`;
}

async function render() {
  if (!state.user) {
    appEl.innerHTML = `<main id="view"></main>`;
    await Auth.render($("#view"), { go, refresh: render });
    return;
  }
  const { path, query } = parseHash();
  const [tab, view] = ROUTES[path] || ROUTES["home"];
  appEl.innerHTML = `<main id="view"><div class="spinner"></div></main>${navHtml(tab)}`;
  const viewEl = $("#view");
  try {
    await view.render(viewEl, { query, go, refresh: render });
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="empty"><div class="big">⚠️</div><div>${esc(err.message || "Something went wrong")}</div></div>`;
  }
}

async function bootstrapUser() {
  try { await Promise.all([initExercises(), ensureProfile()]); }
  catch (e) { console.error("bootstrap", e); }
}

async function main() {
  await refreshUser();
  if (state.user) await bootstrapUser();
  await render();
  window.addEventListener("hashchange", render);

  supa.auth.onAuthStateChange(async (_event, session) => {
    const nextUser = session?.user ?? null;
    const changed = (nextUser?.id || null) !== (state.user?.id || null);
    state.user = nextUser;
    if (nextUser && changed) await bootstrapUser();
    if (changed) render();
  });

  if ("serviceWorker" in navigator) {
    // Versioned URL so a CDN that stubbornly caches /sw.js can't pin an old
    // worker — bump ?v= together with the CACHE name in sw.js on each release.
    navigator.serviceWorker.register("./sw.js?v=15").catch(() => {});
  }
}

main();
