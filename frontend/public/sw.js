// Service Worker pour BoutikFlow (PWA installable)
//
// IMPORTANT — historique de ce fichier, pour ne pas répéter les mêmes
// erreurs :
// 1ʳᵉ tentative : cache de navigation utilisant la Request brute comme clé.
// Cassée car Next.js sert chaque page avec `Vary: rsc,
// next-router-state-tree, next-router-prefetch, next-router-segment-
// prefetch` — la MÊME URL renvoie un contenu différent selon la page de
// provenance, et la Cache API respecte ce Vary : une entrée mise en cache
// en venant de la page A ne correspondait plus à la requête faite en
// revenant depuis la page B. Résultat : "This page couldn't load"
// reproductible dès le 2ᵉ passage sur une page.
// 2ᵉ tentative : retrait total du cache de navigation (repli natif du
// navigateur). Stable mais aucune résilience face à une vraie coupure
// pendant une navigation.
// 3ᵉ tentative (celle-ci) : cache de navigation avec une clé de cache
// NORMALISÉE — juste `pathname + search`, sans aucun des en-têtes
// Next.js ci-dessus. Une requête "propre" (sans ces en-têtes) et une
// réponse avec Vary sur des en-têtes tous deux absents/égaux se
// correspondent toujours, quelle que soit la page de provenance.
//
// Stratégie :
// - Fichiers statiques Next.js hashés (/_next/static/...) : cache-first,
//   clé = Request brute (contenu immuable par URL, aucun souci de Vary).
// - Pages / navigation (même origine) : réseau en priorité (reste à jour
//   quand ça fonctionne), repli sur le cache normalisé si le réseau
//   échoue — une page déjà visitée au moins une fois reste ouvrable en
//   y revenant depuis n'importe quelle autre page.
// - Appels API (autre origine, onrender.com) et toute écriture (POST/PUT/
//   PATCH/DELETE) : jamais interceptés ici — déjà gérés par la file de
//   synchronisation hors-ligne dans lib/api/client.ts.

const CACHE_VERSION = 'v4';
const RUNTIME_CACHE = `boutikflow-runtime-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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

  // Clé de cache normalisée : volontairement PAS la Request d'origine
  // (elle porte les en-têtes next-router-state-tree/rsc/prefetch qui
  // varient à chaque navigation et cassent toute correspondance future —
  // voir le commentaire d'en-tête). Juste l'URL, sans en-têtes annexes.
  const cacheKey = url.pathname + url.search;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Seules les réponses réussies sont mises en cache — une erreur
        // 4xx/5xx ne doit jamais écraser une bonne version précédente.
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(cacheKey, clone));
        }
        return response;
      })
      .catch(() => caches.match(cacheKey))
  );
});
