const CACHE_NAME = "cahier-conjugaison-v3";
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

  const url = new URL(event.request.url);

  // Fichiers de l'application : réseau d'abord (les mises à jour arrivent seules),
  // et le cache prend le relais quand il n'y a pas de connexion.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then((response) => {
          if (response && response.ok) {
            const copie = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Polices Google : cache d'abord pour garder le style hors connexion
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
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
