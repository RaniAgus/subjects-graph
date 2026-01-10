const CACHE_NAME = 'subjects-graph-cache-{{COMMIT_SHA}}';
const INDEX_PATH = './index.html';
const OFFLINE_PATH = './offline.html';
const ASSETS_TO_CACHE = [
  INDEX_PATH,
  './styles.css',
  './app.js',
  './graph.js',
  'https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs',
  './lib/lucide.min.js',
  './data.json',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  OFFLINE_PATH,
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // For navigation requests, respond with index.html for SPA support
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If response is ok, clone it and put in cache
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          // If fetch fails, try the cached navigation route (index.html) - allows SPA to work offline
          const cachedIndex = await caches.match(INDEX_PATH);
          if (cachedIndex) return cachedIndex;
          // If index.html is not cached for some reason, fall back to offline.html fallback
          return caches.match(OFFLINE_PATH);
        })
    );
    return;
  }

  // For other requests, try cache first then network
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            // Optionally cache the fetched responses for GET requests
            if (request.method === 'GET' && response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => caches.match(OFFLINE_PATH));
      })
    )
  );
});
