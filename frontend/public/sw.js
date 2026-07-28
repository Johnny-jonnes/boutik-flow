// Service Worker pour BoutikFlow (PWA installable)
//
// IMPORTANT — historique : une version antérieure interceptait aussi les
// pages/navigations (réseau en priorité, repli sur un cache local) pour
// tolérer une connexion instable. Vérification faite sur la réponse réelle
// du serveur : Next.js sert /pos (et toutes les pages de l'app) avec
// l'en-tête `Vary: rsc, next-router-state-tree, next-router-prefetch,
// next-router-segment-prefetch` — la MÊME URL renvoie un contenu différent
// selon la page de provenance de la navigation. La Cache API respecte ce
// Vary : une entrée mise en cache lors d'une première visite (venant d'une
// page A) ne correspond plus à la requête faite en y revenant depuis une
// page B. Résultat : "This page couldn't load" de façon reproductible dès
// le deuxième passage sur une page, INDÉPENDAMMENT de la qualité réseau —
// un bug introduit par cette tentative de cache, pas corrigé par elle.
//
// Repli sur une stratégie volontairement plus modeste mais sûre :
// - Fichiers statiques Next.js hashés (/_next/static/...) : cache-first.
//   Le contenu d'une URL donnée ne change JAMAIS (le hash change sinon),
//   et ces réponses ne portent pas ce Vary sensible au contexte de
//   navigation — aucun risque de servir une version incorrecte.
// - Pages / navigation : PAS interceptées, gérées nativement par le
//   navigateur (comme un site sans Service Worker). La résilience hors
//   ligne pour les DONNÉES (ventes, produits, etc.) reste entièrement
//   assurée par la file de synchronisation dans lib/api/client.ts, qui ne
//   dépend pas de ce Service Worker.
// - Appels API (autre origine, onrender.com) et toute écriture (POST/PUT/
//   PATCH/DELETE) : jamais interceptés ici.

const CACHE_VERSION = 'v3';
const RUNTIME_CACHE = `boutikflow-runtime-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge toutes les anciennes versions de cache, y compris celles créées
  // par la tentative de cache de navigation (v2) — ces entrées ne
  // correspondront plus jamais correctement à une requête réelle et ne
  // servent plus à rien.
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/_next/static/')) return;

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
});
