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
// revenant depuis la page B.
// 2ᵉ tentative : retrait total du cache de navigation. Stable mais aucune
// résilience face à une vraie coupure pendant une navigation.
// 3ᵉ tentative : clé de cache normalisée (pathname + search, sans les
// en-têtes ci-dessus) — corrige bien le problème de correspondance, MAIS
// le problème a persisté quand même. Cause trouvée après coup : les
// `cache.put(...)` n'étaient enveloppés dans AUCUN `event.waitUntil()`.
// Le navigateur peut arrêter un Service Worker dès que la réponse a été
// renvoyée à la page — sans waitUntil, l'écriture en cache (asynchrone,
// lancée en arrière-plan) pouvait donc être interrompue avant d'avoir
// fini, en particulier sur une connexion lente (le pire moment pour que
// ça arrive, puisque c'est justement quand le cache est censé servir).
// Le cache pouvait ainsi rester silencieusement vide malgré des pages
// chargées avec succès — aucune des tentatives précédentes n'avait donc
// jamais vraiment eu de filet de secours en place, quelle que soit la clé
// de cache utilisée.
// 4ᵉ tentative (celle-ci) : identique à la 3ᵉ, plus `event.waitUntil()`
// autour de CHAQUE écriture en cache pour garantir qu'elle se termine
// réellement avant que le Service Worker puisse être arrêté.
//
// Stratégie :
// - Fichiers statiques Next.js hashés (/_next/static/...) : cache-first,
//   clé = Request brute (contenu immuable par URL, aucun souci de Vary).
// - Pages / navigation (même origine) : réseau en priorité (reste à jour
//   quand ça fonctionne), repli sur le cache normalisé si le réseau
//   échoue.
// - Appels API (autre origine, onrender.com) et toute écriture (POST/PUT/
//   PATCH/DELETE) : jamais interceptés ici — déjà gérés par la file de
//   synchronisation hors-ligne dans lib/api/client.ts.

const CACHE_VERSION = 'v6';
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

function putInCache(event, key, response) {
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then((cache) => cache.put(key, response))
  );
}

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
          if (response.ok) putInCache(event, request, response.clone());
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
        if (response.ok) putInCache(event, cacheKey, response.clone());
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(cacheKey);
        if (cached) return cached;
        // CAUSE CONFIRMÉE (logs console) du "This page couldn't load" :
        // caches.match() qui ne trouve rien résout sur `undefined`, et
        // event.respondWith(undefined) lève "Failed to convert value to
        // 'Response'" — l'événement fetch entier échoue alors en erreur
        // réseau brutale plutôt qu'un simple échec de navigation classique.
        // Retourner explicitement une vraie Response élimine ce crash.
        return new Response(
          '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
          '<body style="font-family:system-ui,sans-serif;text-align:center;padding:3rem 1.5rem;background:#f4f8f7;color:#091312;">' +
          '<h1 style="font-size:1.1rem;">Connexion indisponible</h1>' +
          '<p style="opacity:.7;font-size:.9rem;">Cette page n’a pas encore été chargée sur cet appareil. Réessayez dès que la connexion revient.</p>' +
          '<button onclick="location.reload()" style="margin-top:1rem;padding:.6rem 1.2rem;border:none;border-radius:8px;background:#31a292;color:#fff;font-weight:700;">Réessayer</button>' +
          '</body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
  );
});
