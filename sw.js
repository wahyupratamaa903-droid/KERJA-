// sw.js - Bypass Total (Jembatan Langsung ke Internet)
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  // SELALU ambil dari internet, jangan pernah baca cache
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
