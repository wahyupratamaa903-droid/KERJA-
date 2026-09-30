const CACHE_NAME = 'sarana-cache-v17';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/vault.js',
  './js/config-db.js',
  './js/cloud-sync.js',
  './js/token-calc.js',
  './js/gps.js',
  './js/filter.js',
  './js/image-handler.js',
  './js/export-wa.js',
  './js/patrol-route.js',
  './js/budget-calc.js',
  './js/pdf-report.js',
  './js/ocr.js',
  './js/map.js',
  './js/mission.js',
  './js/calendar-sync.js',
  './js/plugins/github-vault.js',
  './js/plugins/power-engine.js',
  './js/plugins/fuel-optimizer.js',
  './js/plugins/parallax-3d.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firebaseio.com')) {
    return e.respondWith(fetch(e.request));
  }
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
