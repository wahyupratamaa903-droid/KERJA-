// sw.js - Sistem Anti-Cache Otomatis (Network-First)
const CACHE_NAME = 'sarana-cache-v23';
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
  './js/plugins/devis-jarvis.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Langsung aktifkan versi baru tanpa tunggu tutup tab
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k); // Hapus total cache lama
        })
      );
    })
  );
  self.clients.claim();
});

// STRATEGI NETWORK-FIRST: Selalu ambil versi terbaru dari server Vercel jika online
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firebaseio.com') || e.request.url.includes('api.groq.com')) {
    return e.respondWith(fetch(e.request));
  }

  e.respondWith(
    fetch(e.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkRes;
      })
      .catch(() => caches.match(e.request)) // Cadangan offline jika tidak ada sinyal
  );
});
