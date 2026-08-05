// Offline cache for the app shell + exercise data.
// Strategy: network-first for the app shell (HTML/JS/CSS) so code updates show up
// immediately; cache is only the offline fallback. The big, rarely-changing
// exercise DB stays cache-first for speed. Cross-origin requests (Supabase API,
// esm.sh modules, exercise images) always go straight to the network.
const CACHE = "maxbody-v21";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./data/exercises.json",
  "./js/app.js", "./js/config.js", "./js/supabase.js", "./js/data.js",
  "./js/generator.js", "./js/ui.js", "./js/store.js", "./js/exui.js", "./js/food.js", "./js/tdee.js", "./js/body.js",
  "./js/views/auth.js", "./js/views/home.js", "./js/views/library.js",
  "./js/views/plans.js", "./js/views/workout.js", "./js/views/nutrition.js",
  "./js/views/history.js", "./js/views/profile.js", "./js/views/weight.js",
  "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, res) {
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(request, copy));
  return res;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // network handles the rest

  // Big, rarely-changing exercise DB: cache-first for speed.
  if (url.pathname.endsWith("/data/exercises.json")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => putInCache(e.request, res))));
    return;
  }

  // App shell: network-first with forced revalidation ("no-cache"), so a stale
  // long-lived HTTP-cache entry can never mask a fresh deploy. Cache is only the
  // offline fallback.
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache" })
      .then((res) => putInCache(e.request, res))
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
