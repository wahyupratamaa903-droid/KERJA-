// js/kill-cache.js - Memaksa browser menghapus semua cache PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (let registration of registrations) {
      registration.unregister(); // Bunuh service worker lama
    }
  });
  caches.keys().then(keys => {
    keys.forEach(key => caches.delete(key)); // Hapus memori cache
  });
}
