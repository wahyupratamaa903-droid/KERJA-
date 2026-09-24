// sw.js - Service Worker Cache v3
const CACHE_NAME = 'sarana-cache-v3';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
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
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
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
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
