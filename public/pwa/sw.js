const CACHE_NAME = 'subjects-graph-cache-{{COMMIT_SHA}}';
const ASSETS_TO_CACHE = [
  '../',
  '../index.html',
  '../styles.css',
  '../app.js',
  '../graph.js',
  '../lib/cytoscape.min.js',
  '../lib/lucide.min.js',
  '../data.json',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './offline.html'
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
    )
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
          const cachedIndex = await caches.match('../index.html');
          if (cachedIndex) return cachedIndex;
          // If index.html is not cached for some reason, fall back to offline.html fallback
          return caches.match('./offline.html');
        })
    );
    return;
  }

  // For other requests, try cache first then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Optionally cache the fetched responses for GET requests
          if (request.method === 'GET' && response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match('./offline.html'));
    })
  );
});
