// Service Worker pour BoutikFlow (PWA installable)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through simple pour le bon fonctionnement des requêtes réseau
  event.respondWith(fetch(event.request));
});
