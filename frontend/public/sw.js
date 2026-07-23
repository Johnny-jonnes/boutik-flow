// Service Worker pour BoutikFlow (PWA installable) - Version ultra-stable sans interférence

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge complète de tous les anciens caches créés par les versions précédentes du Service Worker
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Cleaning old PWA cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Écouteur d'événement fetch vide pour satisfaire les critères d'installabilité de Chrome/Safari/Edge.
// Ne fait aucune interception (pas de event.respondWith) pour laisser le navigateur gérer 100%
// des requêtes dynamiques Next.js, cookies, sessions et API de manière native sans erreur de chargement.
self.addEventListener('fetch', (event) => {
  // Laisser passer toutes les requêtes nativement
});
