// Service Worker pour BoutikFlow (PWA installable) - Version stable

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // NE PAS intercepter les requêtes API, d'authentification ou les requêtes externes.
  // Cela évite les erreurs "impossible de charger les données" à cause du service worker.
  const url = event.request.url;
  if (
    url.includes('/api/') || 
    url.includes('onrender.com') ||
    url.includes('/auth/') ||
    !url.startsWith(self.location.origin)
  ) {
    return; // Laisse le navigateur gérer nativement sans interférence
  }

  // Stratégie Réseau en premier pour les fichiers statiques de l'application (HTML/JS/CSS)
  event.respondWith(
    fetch(event.request).catch(() => {
      // Laisse le navigateur retourner l'erreur ou cherche dans le cache si disponible
      return caches.match(event.request);
    })
  );
});
