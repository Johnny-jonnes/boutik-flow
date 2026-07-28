// Service Worker pour BoutikFlow (PWA installable)
//
// L'ancienne version n'interceptait AUCUNE requête (fetch handler vide) :
// chaque navigation entre pages (clic sur "Vendre", etc.) dépendait donc
// d'un aller-retour réseau réussi, même si l'app avait déjà été chargée
// avec succès juste avant. Au moindre à-coup de connexion pendant cette
// navigation, le navigateur affichait son erreur native ("Cette page n'a
// pas pu s'ouvrir") au lieu de rester utilisable — exactement le genre
// d'instabilité que l'app doit éliminer.
//
// Stratégie :
// - Fichiers statiques Next.js hashés (/_next/static/...) : cache-first.
//   Le contenu d'une URL donnée ne change JAMAIS (le hash change sinon),
//   donc aucun risque de servir une version périmée.
// - Pages / navigation (tout le reste, même origine) : réseau en
//   priorité pour rester à jour, repli sur le cache si le réseau échoue.
//   Une page déjà visitée avec succès reste donc utilisable hors-ligne ou
//   sur une connexion instable, au lieu d'échouer purement et simplement.
// - Appels API (autre origine, onrender.com) : jamais interceptés ici —
//   déjà gérés par la file de synchronisation dans lib/api/client.ts.
// - Écritures (POST/PUT/PATCH/DELETE) : jamais interceptées, quelle que
//   soit l'origine.

const CACHE_VERSION = 'v2';
const RUNTIME_CACHE = `boutikflow-runtime-${CACHE_VERSION}`;
const OFFLINE_FALLBACK_URL = '/offline.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) => cache.add(OFFLINE_FALLBACK_URL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  // Ne purge que les caches d'anciennes VERSIONS — pas le cache courant,
  // qui contient les pages déjà visitées avec succès.
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith('boutikflow-runtime-') && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Seules les lectures (GET) sont interceptées : jamais une écriture, ni
  // un appel vers l'API (autre origine), déjà pris en charge côté client.ts.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStaticAsset = url.pathname.startsWith('/_next/static/');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Seules les réponses réussies sont mises en cache — une erreur
        // 4xx/5xx ne doit jamais écraser une bonne version précédente.
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_FALLBACK_URL);
          }
          return Response.error();
        })
      )
  );
});
