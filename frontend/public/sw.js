// Service Worker vacío para evitar errores 404
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  // Limpiar cachés antiguas
  caches.keys().then(cacheNames => {
    return Promise.all(
      cacheNames.map(cache => caches.delete(cache))
    );
  });
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
