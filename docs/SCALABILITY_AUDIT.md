# Audit de performance et de montée en charge — BoutikFlow

Document de synthèse final de l'audit de performance/scalabilité mené sur BoutikFlow
(Next.js 16 + FastAPI + Postgres/Supabase, backend Render, frontend Vercel).
Méthode appliquée tout du long : chaque optimisation additive, testée (souvent via un
serveur local + une base réelle, avec nettoyage systématique des données de test),
commitée et poussée avant la suivante — priorité stricte intégrité des données →
stabilité → offline → sécurité → performance → fonctionnalité → UX.

## 1. Optimisations réalisées

| # | Sujet | Ce qui a été fait | Commit |
|---|---|---|---|
| 1 | Index DB | Migration additive (index manquants sur `client_debts.order_id/.status`, `orders.created_by`, `admin_notifications.tenant_id/.is_read`, `audit_logs.action`, `suppliers.*`, `clients.tags` GIN) + `index=True` sur les colonnes de modèle déjà indexées en base mais absentes de l'ORM (drift modèle/migration corrigé) | `99a1796` |
| 2 | N+1 | `admin/router.py` (owners/tenants batchés), `dashboard/router.py::get_kpis` (4 `.count()` → 1 agrégat conditionnel), `get_analytics` (fetch complet → `GROUP BY`) | `ae83666`, `636cacb` |
| 3 | Fiabilité backend | Handler d'exception global (log contexte + réponse JSON cohérente, jamais de fuite de détail hors DEBUG), `/health` fait un vrai `SELECT 1`, `except` silencieux remplacés par du logging, pool `BypassSessionLocal`/`AppSessionLocal` rééquilibré (10/50 au lieu de 30/30) | `177a37b` |
| 4 | Idempotence | `store_response_atomic()` : la clé d'idempotence est désormais insérée dans LA MÊME transaction que l'écriture métier (`orders.create`, `debts.pay`) — fenêtre de course fermée, prouvée par un test de concurrence réel (requêtes simultanées, 9/9 puis 5/5) | `70d5d4f` |
| 5 | Frontend — mémoisation | `useMemo` sur filtres/tri (`products`, `dashboard`), Maps mémoïsées au lieu de `.find()` en boucle, `analytics/page.tsx` migré vers `useAnalyticsQuery` (cache partagé au lieu d'un fetch dédié) | `439c241` |
| 6 | Commandes — cache | `orders/page.tsx` migré vers les hooks de cache partagés (`useClientsQuery`/`useProductsQuery`), dédoublonnage des fetchs, `filteredOrders`/`paginatedOrders` mémoïsés | `04ba2cf` |
| 7 | Bundle | `next/dynamic` (`ssr:false`) pour Recharts (Dashboard + Analytics, ~366 Ko sortis du bundle initial) et `qrcode` (Produits) | `b2d070e` |
| 9 | Twilio non-bloquant | Appel synchrone `client.messages.create()` dans une route `async` bloquait la boucle d'événements — enveloppé dans `run_in_threadpool`, testé (event loop libre pendant l'appel, prouvé par un test avec un ticker concurrent) | `278a522` |
| 10 | Rate limiting | `slowapi` sur `/auth/login` (10/min) et `/auth/register` (5/min), par IP, mémoire | `60580c8` |
| 11 | Monitoring | Sentry backend + frontend, strictement gated par `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` — inactif sans clé, branché sur le handler d'exception global existant | `95b376a` |
| 12 | **Bug critique de concurrence sur le stock** | Découvert en construisant le test de charge : `with_for_update()` sur les 6 endroits qui lisent-puis-écrivent `Product.stock` — voir section 3 | `2576972` |
| 12 | Suite de tests de charge k6 | `/load-tests` — voir section 3 | `b758430` |

### Décisions documentées, pas exécutées (arbitrages assumés)

- **RLS Postgres** : scaffoldée (migration `a546853c47ae`), mais `APP_DATABASE_URL` n'est pas
  configurée en production → `AppSessionLocal` retombe sur `DATABASE_URL` (même rôle que le
  contournement). Isolation tenant assurée aujourd'hui par le filtrage applicatif
  (`tenant_id` sur chaque requête + `TenantMiddleware`), vérifiée sous charge par
  `load-tests/scenarios/tenant_isolation.js` (passe, zéro fuite constatée). Activer RLS en
  profondeur reste une défense en profondeur recommandée, pas un correctif d'urgence.
- **File hors-ligne (`OfflineQueue.getAll()`)** : scanne tout le store IndexedDB au lieu
  d'utiliser l'index `status` déjà déclaré. Non modifié : aux volumes réalistes (centaines
  d'entrées, pas milliers), le scan complet reste de l'ordre de la milliseconde, et c'est le
  code le plus sensible à l'intégrité des données de toute l'app — le risque de casser la
  synchronisation dépassait le gain mesurable. Fix déjà conçu, à faire si la taille de la
  file grossit réellement en usage réel.
- **`crm/router.py::list_segments`** : N+1 par segment non corrigé — territoire adjacent aux
  anciens modules WhatsApp/segments explicitement protégés, non touché par prudence.
- **Pagination serveur complète de `orders/page.tsx`** : la page charge son historique par
  boucle de pages (jusqu'à 500/page) plutôt qu'une vraie pagination serveur comme
  `sales/page.tsx` — le dédoublonnage de cache (Phase 6) réduit déjà le coût réseau répété ;
  la migration complète est plus invasive (modale de création/retour/statut à adapter) et a
  été explicitement mise de côté comme recommandation, pas comme correctif.
- **Vraie file de tâches (Celery+Redis/arq)** : Celery est une dépendance installée mais
  jamais réellement câblée. Le seul appel bloquant réel identifié (Twilio) a été corrigé
  ponctuellement (Phase 9). Introduire une vraie file reste recommandé le jour où l'envoi de
  campagnes WhatsApp sera construit pour de vrai — prématuré aujourd'hui.

## 2. Bug critique découvert et corrigé : survente sous concurrence

**Trouvé en construisant le scénario de test de charge `stock_concurrency.js`**, pas par
relecture de code : 20 acheteurs simultanés sur un produit à `stock=10` obtenaient TOUS un
`201` (20 commandes réelles créées en base), alors que le stock ne diminuait au final que
d'**une seule unité** (perte de mise à jour classique — chaque requête lisait le stock par un
`SELECT` non verrouillé, le décrémentait en Python, puis écrivait une valeur *absolue* au
commit ; la dernière transaction à valider écrasait silencieusement le décrément de toutes
les autres).

Corrigé par `with_for_update()` sur les 6 endroits qui lisent puis écrivent `Product.stock`
dans la même transaction (création de commande, restockage sur annulation/retour, redébit
sur réactivation, réassort fournisseur en masse), avec un tri déterministe des lignes par
`product_id` pour éliminer tout risque de deadlock entre deux commandes concurrentes
partageant les mêmes produits dans un ordre différent.

**Vérifié** : le même scénario (20 acheteurs, stock=10) donne maintenant exactement
`stock_final=0`, 10 commandes réelles créées, 10 rejets propres "stock insuffisant" — aucune
survente, aucune perte de mise à jour. Non-régression testée sur les 5 chemins touchés
(création, retour avec réassort, réassort fournisseur, annulation, réactivation).

C'est la trouvaille la plus importante de tout l'audit : un bug d'intégrité des données réel
et reproductible, invisible en usage normal, qui n'était détectable QUE par un test de charge
concurrent — exactement la justification de la section 19 de la demande initiale
("concurrence sur le stock").

## 3. Tests de charge (k6) — `/load-tests`

Voir `load-tests/README.md` pour l'utilisation complète. Résumé des choix structurants :
- 6 scénarios réalistes (Consultation, Vendeur, Gestionnaire, Synchronisation hors-ligne,
  Consultation intensive, Connexion sous charge) + 2 tests critiques (concurrence sur le
  stock, isolation multi-tenant).
- Données 100% synthétiques, multi-boutiques (jamais 100 000 VUs → 1 seule boutique),
  jamais de vraies données ni de vrais mots de passe.
- Tokens JWT pré-générés pour la majorité des scénarios (pas de vrai `/auth/login` par VU
  simulé) — voir README pour la justification (réalisme + le rate limit de la Phase 10
  bloquerait de toute façon des milliers de logins depuis une seule IP).

### Réalité de l'infrastructure disponible

Aucun environnement de staging Render/Supabase, aucune infrastructure de génération de
charge distribuée (pas de Grafana Cloud k6, pas de cluster dédié) — une seule machine locale,
contre la même base Supabase utilisée pendant tout l'audit. **Générer réellement 100 000 VUs
n'était pas possible dans ces conditions**, et tester en charge lourde contre la vraie
production Render aurait violé la règle explicite "ne pas toucher à la production au début".
Les chiffres ci-dessous sont donc des mesures locales, pas une mesure de la capacité réelle
de production — voir "Ce qu'il manque pour une vraie réponse" plus bas.

### Ce qui a été mesuré

Scénario **E (consultation intensive, lecture pure, sans temps de réflexion)** contre le
serveur local (1 worker uvicorn, pool DB max 50 connexions) :

| VUs | Débit | p50 | p95 | Taux d'erreur | Observation |
|---|---|---|---|---|---|
| 10 | 4.67 req/s | 1.50s | 2.96s | 7.14% | Fonctionnel mais latence déjà élevée (voir note réseau) |
| 50 | 5.52 req/s | 4.13s | 17.97s | 9.50% | Débit qui stagne (n'augmente presque pas malgré 5x plus de VUs) — signe de saturation |
| 100 | 1.40 req/s | 2.78s | 6.70s | 48.21% | **Effondrement** : débit RETOMBE sous le niveau à 10 VUs, 0 itération complète |

À 100 VUs, le test a déclenché un **effondrement en cascade** : le pool de connexions vers
le pooler Supabase a saturé, provoquant **185 fermetures forcées de connexions SSL**
(`psycopg2.OperationalError: SSL connection has been closed unexpectedly`) côté base de
données, qui a fini par faire planter le processus backend local lui-même (arrêt net, sans
message de fermeture propre dans les logs).

Le scénario **B (Vendeur, écritures réelles)** lancé juste après (20 VUs) a immédiatement
échoué à 100% — le serveur local ne s'était pas encore relevé de l'effondrement précédent.

### Premier goulot d'étranglement identifié

**La couche connexion Postgres/Supabase, pas le code applicatif FastAPI ni le CPU.** Le
débit stagne dès 50 VUs (signe de contention), puis s'effondre catégoriquement à 100 VUs
quand le pooler Supabase commence à fermer des connexions de force. C'est cohérent avec un
risque déjà documenté en Phase 3 de cet audit (calibrage des pools `BypassSessionLocal`/
`AppSessionLocal`) — mais c'est la première fois qu'il est **prouvé empiriquement**, avec un
mécanisme de rupture précis (fermeture SSL forcée par le pooler), plutôt que théorisé.

### Ce qui a été confirmé correct sous charge

- **Isolation multi-tenant** (`tenant_isolation.js`) : aucune fuite cross-tenant détectée,
  même avec des boutiques mélangées à chaque itération.
- **Idempotence sur rejeu offline** (`d_synchronisation.js`) : le rejeu d'une vente en file
  hors-ligne avec la même `Idempotency-Key` (simulant un appareil qui retente après une
  coupure) ne crée jamais de doublon — la commande retournée est identique à l'originale.

### Ce qui n'a PAS pu être honnêtement mesuré

**Aucun chiffre de "capacité réelle en production" n'est avancé ici** — ce serait inventer
une précision que les données ne permettent pas, ce que la demande initiale interdit
explicitement. Deux raisons concrètes :
1. **La latence de base mesurée ici est probablement très supérieure à celle de Render** :
   chaque requête simple (`SELECT 1`) prenait déjà 400-900ms depuis cette machine vers le
   pooler Supabase (`aws-eu-west-1`) — une latence réseau de développeur-vers-cloud, pas
   celle d'un service Render hébergé probablement plus proche de Supabase. Tout p50/p95
   mesuré ici est donc gonflé par un facteur inconnu.
2. **Un seul worker uvicorn local** ne représente pas la configuration réelle de Render (le
   nombre de workers/instances utilisé en production n'est pas documenté dans le dépôt — à
   vérifier dans la configuration Render elle-même).

### Ce qu'il faudrait pour une vraie réponse

- Un environnement de **staging** Render + projet Supabase séparé (pas la base de
  production), pour mesurer sans risque et sans latence artificielle de développeur.
- Une **génération de charge distribuée** (Grafana Cloud k6, ou plusieurs machines
  `k6 run --out ...` coordonnées) pour dépasser la capacité d'une seule machine bien au-delà
  de quelques milliers de VUs.
- Vérifier/augmenter le **plan Supabase** (connexions pooler max) et le nombre de
  **workers/instances Render**, puis rejouer exactement les mêmes scénarios
  (`load-tests/scripts/run-progressive.ps1|.sh`) depuis cette nouvelle infrastructure.

## 4. Risques connus restants (non corrigés, à surveiller)

- **RLS non activée en profondeur en production** (voir section 1).
- **Pool de connexions vs plan Supabase réel** : le ceiling applicatif (50) n'a de sens que
  s'il reste sous la limite réelle du pooler Supabase — non vérifiable sans accès au
  dashboard Supabase. Recommandation : vérifier le nombre de connexions pooler max du plan
  actuel et aligner `pool_size`/`max_overflow` en conséquence, avec une marge de sécurité.
- **Nombre de workers Render non documenté dans le dépôt** — à vérifier/documenter
  explicitement dans la configuration de déploiement.
- **Pas de vraie file de tâches** (Celery/arq+Redis) — acceptable tant que WhatsApp reste au
  stade actuel (chat simple), à revoir si des campagnes de masse sont construites.
- **`crm/segments` N+1** non corrigé (territoire adjacent aux modules protégés).
- **Pagination complète de `orders/page.tsx`** déférée (dédoublonnage de cache appliqué,
  vraie pagination serveur non migrée).
- **File hors-ligne (`OfflineQueue`)** : lecture non indexée, fix déjà conçu, non appliqué
  (risque/valeur défavorable aux volumes actuels).

## 5. Recommandations moyen terme

1. Vérifier le plan Supabase (connexions pooler max, CPU/RAM alloués) et documenter
   explicitement le nombre de workers Render en service.
2. Rejouer `load-tests/` depuis un environnement de staging réel une fois disponible, pour
   obtenir un chiffre de capacité fiable (voir section 3).
3. Ajouter un backend de stockage partagé (Redis, déjà une dépendance) au rate limiting
   (Phase 10) si le service passe un jour en plusieurs instances — le stockage en mémoire
   actuel donnerait sinon une limite multipliée par le nombre d'instances.
4. Surveiller Sentry (Phase 11, une fois `SENTRY_DSN` configuré côté Render/Vercel) pour
   détecter en production les mêmes erreurs `SSL connection has been closed unexpectedly`
   observées localement sous charge — si elles apparaissent en usage réel, c'est le signal
   que le pool applicatif ou le plan Supabase doit être ajusté.
5. Envisager `.with_for_update(skip_locked=...)` ou une file d'attente applicative si le
   verrouillage de ligne (Phase 12) devient un point de contention mesurable sur des produits
   à très forte rotation (actuellement non mesuré à cette échelle).

## 6. Évolutions long terme (dizaines/centaines de milliers de boutiques)

- **Réplicas de lecture** Postgres pour séparer le trafic dashboard/analytics (lecture
  lourde) du trafic transactionnel (ventes).
- **Vues matérialisées** pour les agrégats dashboard/analytics les plus coûteux, rafraîchies
  périodiquement plutôt que calculées à chaque requête.
- **Sharding par tenant** si un jour une seule instance Postgres ne suffit plus — prématuré
  aujourd'hui, à ne considérer qu'après avoir épuisé les options plus simples (réplicas,
  vues matérialisées, plan Supabase supérieur).
- **CDN** pour les assets statiques/images produits si le volume d'images grossit
  significativement.
- **Recherche dédiée** (Meilisearch/Typesense) si la recherche produit texte devient un point
  chaud à très large catalogue — `search` reste un simple `ILIKE` aujourd'hui, suffisant aux
  volumes actuels.

## 7. Réponse à la question posée

> Combien d'utilisateurs BoutikFlow supporte-t-il actuellement, où se situe le premier
> goulot, et quelle marge de sécurité existe ?

**CAPACITÉ ACTUELLE (environnement local testé)** : dégradation nette dès ~50 requêtes
concurrentes, effondrement à ~100 (pooler Supabase saturé, 185 connexions SSL fermées de
force, processus backend local mort). **Ce chiffre n'est PAS une mesure fiable de la
capacité de production réelle** — la latence réseau locale vers Supabase et l'usage d'un
seul worker uvicorn le biaisent fortement à la baisse (voir section 3).

**PREMIER GOULOT IDENTIFIÉ** : la couche connexion Postgres/Supabase (pool applicatif +
pooler côté Supabase), pas le CPU ni le code FastAPI lui-même — confirmé empiriquement, pas
seulement théorisé.

**CAPACITÉ APRÈS OPTIMISATION** : non mesurable depuis cet environnement — nécessite un
staging réel (section 3, "Ce qu'il faudrait pour une vraie réponse").

**CAPACITÉ CIBLE (100 000+)** : hors de portée d'une seule instance Postgres/Render sans les
évolutions de la section 6 (réplicas, vues matérialisées, éventuellement sharding) — mais
aucune de ces optimisations n'est justifiée aujourd'hui sans une mesure réelle préalable
depuis un staging représentatif.

**MARGE DE SÉCURITÉ** : non chiffrable honnêtement sans cette mesure réelle. Ce que l'audit
peut affirmer avec certitude : le bug de survente (section 2) aurait rendu tout chiffre de
capacité trompeur de toute façon — un système qui vend plus qu'il n'a en stock sous charge
n'a pas de "capacité" au sens propre, il a un risque d'intégrité des données qui s'aggrave
avec le trafic. Ce risque est désormais fermé.

## 8. Déploiement et vérification

Tous les commits de cet audit (Phases 1-12, y compris le correctif critique de concurrence
sur le stock) ont été poussés sur `main`. Comme observé à plusieurs reprises pendant cette
session, le déploiement automatique Render peut être lent ou nécessiter un redéploiement
manuel — **confirmer que `https://boutik-flow.onrender.com/openapi.json` reflète bien le
code de HEAD avant de considérer cet audit comme "déployé"**, avec la même méthode de
vérification utilisée tout au long de cette session (comparaison de schéma/paramètres
attendus). Le frontend suit le même principe via Vercel.
