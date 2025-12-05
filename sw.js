// sw.js
// Service worker for AHA Chat – offline + cache av app-shell + emne-filer

// ⚠️ Husk å bump'e versjonen når du endrer ASSETS
const CACHE_NAME = "aha-chat-v1.0.0.111";

// Justér stier hvis nettstedet ligger i en undermappe
const ASSETS = [
  "/",                 // forsiden (på GitHub Pages user-site)
  "/index.html",
  "/aha-chat.css",

  // Motorer
  "/insightsChamber.js",
  "/metaInsightsEngine.js",

  // Emne-motor
  "/emnerLoader.js",
  "/ahaEmneMatcher.js",

  // Felt-profiler
  "/ahaFieldProfiles.js",

  // UI / glue
  "/ahaChat.js",

  // Emne-JSON (for offline emner per fag)
  "/emner/emner_historie.json",
  "/emner/emner_by.json",
  "/emner/emner_kunst.json",
  "/emner/emner_musikk.json",
  "/emner/emner_natur.json",
  "/emner/emner_vitenskap.json",
  "/emner/emner_litteratur.json",
  "/emner/emner_popkultur.json",
  "/emner/emner_naeringsliv.json"
];

// Install – cache grunnfilene
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate – rydde bort gamle cache-versjoner
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Fetch – prøv cache først, deretter nettverk + legg i cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });

          return response;
        })
        .catch(() => {
          return new Response(
            "Du er offline, og denne ressursen finnes ikke i cachen ennå.",
            { status: 503, statusText: "Offline" }
          );
        });
    })
  );
});
