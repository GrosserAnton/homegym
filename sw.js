// Basic offline cache for the app shell + exercise data.
// Cross-origin requests (Supabase API, esm.sh modules, exercise images) always go to the network.
const CACHE = "homegym-v2";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./data/exercises.json",
  "./js/app.js", "./js/config.js", "./js/supabase.js", "./js/data.js",
  "./js/generator.js", "./js/ui.js", "./js/store.js", "./js/exui.js",
  "./js/views/auth.js", "./js/views/home.js", "./js/views/library.js",
  "./js/views/plans.js", "./js/views/workout.js", "./js/views/history.js", "./js/views/profile.js",
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

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // network handles the rest
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
