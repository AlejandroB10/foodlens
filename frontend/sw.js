const CACHE_VERSION = 'foodlens-pwa-v3';

const STATIC_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.webmanifest',
  './css/style.css',
  './css/onboarding.css',
  './css/history.css',
  './css/settings.css',
  './css/tooltips.css',
  './css/personas.css',
  './css/print.css',
  './css/favourites.css',
  './js/app.js',
  './js/api.js',
  './js/xai.js',
  './js/views/onboarding.js',
  './js/views/history.js',
  './js/views/settings.js',
  './js/views/tooltips.js',
  './js/views/favourites.js',
  './data/sample_products.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      });
    }),
  );
});
