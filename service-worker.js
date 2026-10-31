const CACHE_NAME = "cahier-conjugaison-v2";
const FILES_TO_CACHE = [
  "./index.html",
  "./ameliorations.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Polices Google : on les garde pour que le texte garde son style hors connexion
        const url = new URL(event.request.url);
        const estPolice =
          url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
        if (estPolice && response && (response.ok || response.type === "opaque")) {
          const copie = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
        }
        return response;
      });
    })
  );
});
