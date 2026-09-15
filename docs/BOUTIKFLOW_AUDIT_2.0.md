# BoutikFlow — Audit 2.0 (Phase 0)

**Objectif** : préparer l'évolution vers une vitrine publique, partage, intégration Facebook, commandes publiques, CRM auto-capture, analytics, relances.
**Méthode** : rien de ce document n'est supposé — chaque affirmation est vérifiée dans le code réel, citée `fichier:ligne`. Basé sur (a) la connaissance déjà acquise cette session (chantiers scalabilité, offline/sync, sécurité/conformité, idempotence — tous testés empiriquement), (b) un audit ciblé complémentaire sur les points spécifiques à ce nouveau chantier (stockage image, IA, jobs async, marketing/segments, routes publiques).

**Correction importante sur l'énoncé de la tâche** : la stack listée mentionne "Authentification : Supabase Auth". C'est inexact — BoutikFlow utilise un JWT maison (`app/core/security.py::create_access_token`/`decode_token`, bibliothèque `python-jose`), pas le service Supabase Auth. Supabase ne sert que de Postgres managé. Cette correction a déjà été faite dans un audit précédent (chantier conformité) et est reconfirmée ici.

---

## 1. Architecture actuelle

- **Frontend** : Next.js 16 (App Router, Turbopack), déployé Vercel. Deux groupes de routes : `(auth)` (login/register) et `(dashboard)` (tout le reste, protégé). `/privacy` et `/terms` existent déjà en dehors de ces groupes, au même niveau que `app/`.
- **Aucun `middleware.ts`** — pas de protection de route côté Edge/serveur Next.js. La protection est **entièrement côté client** : `(dashboard)/layout.tsx` vérifie le JWT décodé et redirige, `lib/permissions.ts` (`hasPermission`, `ROUTE_PERMISSIONS`) filtre la navigation et bloque l'accès aux pages non autorisées — mais l'autorité réelle reste toujours le backend (chaque endpoint revérifie via `require_permission`/`get_current_user`).
- **Backend** : FastAPI, tous les routers montés sous le préfixe `/api/v1` (`app/main.py`).
- **Base** : Postgres Supabase, isolation par colonne `tenant_id` (jamais RLS active en production — scaffoldée, migration `a546853c47ae`, inactive tant que `APP_DATABASE_URL` n'est pas configurée séparément de `DATABASE_URL`).
- **Redis** : `REDIS_URL` existe dans `config.py:62` mais **n'est utilisé nulle part** — zéro `import redis`/`redis.Redis(` dans tout le backend.
- **Celery** : dépendance listée (`requirements.txt`) mais **jamais importée nulle part** — zéro `from celery`, zéro tâche, zéro worker.
- **Tâches asynchrones réelles** : une seule utilisation de `BackgroundTasks` (FastAPI) dans tout le projet — `auth/router.py:171-174`, l'email de notification admin à l'inscription d'une nouvelle boutique (best-effort, n'échoue jamais bruyamment si SMTP non configuré).

## 2. Modules existants

Produits, Catégories, Clients (+ **Segments**, voir §3 — actif, pas supprimé), Commandes/Ventes, Retours, Dettes clients, Finances, Équipe/Rôles, Fournisseurs, Audit, Dashboard/Analytics, WhatsApp (Twilio), Marketing/Campagnes (CRUD seul, voir §3), IA (Groq, 2 endpoints, voir §3), Admin (super-admin, cross-tenant par conception), Billing.

## 3. Trouvailles critiques pour ce chantier

### 3.1 — Images produits : bloquant réel pour Facebook/Open Graph

`Product.images` (`ARRAY(String)`) et `Product.thumbnail` stockent des **data-URI base64 bruts**, jamais des URLs. Confirmé par le docstring de `app/core/thumbnails.py` lui-même : *"aucun stockage objet externe n'est configuré"*. Le frontend lit le fichier via `FileReader.readAsDataURL()` et envoie directement le base64.

**Conséquence** : un crawler Facebook/WhatsApp a besoin d'une vraie URL `https://...` récupérable indépendamment pour `og:image` — impossible avec un data-URI embarqué dans le HTML. **Il n'existe aujourd'hui aucun endpoint qui serve une image produit comme une vraie ressource HTTP.**

→ Bloquant pour Phase 2 (page produit publique) et Phase 3 (partage Facebook). Solution minimale sans réécrire l'archi : soit (a) un endpoint `GET /products/{id}/image` qui décode le base64 stocké et le retourne en `Response(content=..., media_type="image/jpeg")`, soit (b) un vrai stockage objet (Supabase Storage, déjà dans l'écosystème existant). Option (a) est la plus proche de l'existant et suffit pour débloquer Open Graph sans migration de données ni nouvelle dépendance.

### 3.2 — Aucune infrastructure de jobs asynchrones réelle

Ni Redis ni Celery ne sont branchés (voir §1). Le plan demande explicitement `Frontend → API → job → Redis/queue → worker → Meta API` pour la publication Facebook et les campagnes — **cette infrastructure n'existe pas encore et doit être construite**, pas juste réutilisée. C'est le plus gros écart entre l'état réel du projet et l'énoncé de la tâche (qui suppose "Redis : cache/traitements asynchrones selon l'existant" — il n'y a rien d'existant à ce sujet).

### 3.3 — Module Marketing/Campagnes : CRUD seul, aucun envoi réel

`Campaign` (modèle complet : `segment_id`, `channel` whatsapp/sms/email, `message`, `status` brouillon/programmee/envoyee/echouee) existe avec CRUD complet, mais **passer `status` à `"envoyee"` dans le body de la requête suffit à marquer une campagne "envoyée"** — aucun appel Twilio, aucun SMS, aucun email n'est réellement déclenché. Twilio est câblé ailleurs (module WhatsApp) mais jamais appelé depuis Marketing.

→ Pertinent pour la Phase 7 (relances/campagnes) : la structure de données existe déjà, mais le mécanisme d'envoi réel est entièrement à construire — et la queue pour le faire proprement (§3.2) aussi.

### 3.4 — ⚠️ Segments n'est PAS supprimé — contradiction avec une règle absolue répétée cette session

Tout au long de cette session (chantiers précédents), la règle **"NE JAMAIIS réintroduire Segments — module supprimé"** a été répétée comme absolue. L'audit de ce jour confirme que **`Segment` (segments clients dynamiques, filtres JSON, CRUD complet) est actuellement pleinement présent et fonctionnel** dans `crm/router.py` (`/clients/segments/*`), avec une vraie table `segments`, et `Campaign.segment_id` y fait référence par clé étrangère active.

**Je ne modifie rien à ce sujet sans confirmation explicite** — deux hypothèses possibles : (a) l'instruction "ne pas réintroduire Segments" visait un **autre** module (ex. "Segments WhatsApp", une fonctionnalité distincte mentionnée par son nom complet dans les règles précédentes) et ne concerne pas le CRM Segments actuel, qui est légitime et doit rester ; ou (b) une suppression prévue n'a en réalité jamais été appliquée. **Je traite le CRM Segments actuel comme faisant partie de l'existant à préserver**, sauf indication contraire explicite de ta part — je ne le supprime pas de mon propre chef, et je ne le développe pas non plus sans le confirmer avec toi.

### 3.5 — IA (Groq) : ne fait pas ce que la Phase 3/10 du plan suppose

Deux endpoints existent (`ai/router.py`), tous deux authentifiés :
- `POST /ai/suggest-reply` — suggère une réponse WhatsApp au client (pas de la promotion).
- `POST /ai/analyze-product-image` — extrait nom/catégorie/description/marque d'une photo produit (utile pour préremplir une fiche produit, pas pour rédiger un post).

**Aucun endpoint ne génère un texte promotionnel.** La Phase 3 du plan ("l'IA peut préremplir le texte de publication") est une fonctionnalité à construire, pas à réutiliser telle quelle — même si le pattern d'appel Groq (`httpx.AsyncClient` vers l'API chat completions) est déjà établi et réutilisable.

Note technique mineure trouvée au passage : `ai/router.py` lit `GROQ_API_KEY` via `os.getenv()` direct au lieu de `settings.GROQ_API_KEY`, et hardcode ses propres noms de modèle Groq au lieu d'utiliser `settings.GROQ_MODEL` — incohérence pré-existante, sans impact sur ce chantier, mentionnée pour mémoire.

### 3.6 — Routes déjà publiques (sans authentification)

`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /health`, `POST /whatsapp/webhook`, `GET /version` (mineure fuite d'info : expose la liste des routes internes).

**Trouvaille inattendue, sans lien avec ce chantier mais à signaler** : `POST /api/v1/migrate` (`main.py:184-199`) n'a **aucune protection d'authentification**. Il appelle `Base.metadata.create_all()` (idempotent, ne supprime/modifie rien) mais reste un endpoint d'écriture-schéma ouvert à quiconque sur Internet, sans rate limiting. Recommandation séparée : le protéger (admin-only) dans un correctif dédié, hors périmètre immédiat de ce chantier vitrine.

### 3.7 — Ce qui est prêt à réutiliser tel quel

- `Tenant.slug` : déjà unique, indexé, non-nullable — utilisable directement pour `/boutique/{slug}` sans migration.
- Isolation par `tenant_id` : le pattern est mécanique et bien rodé (filtrer chaque requête) — à répliquer identiquement pour les nouvelles routes publiques, en gardant à l'esprit qu'une route publique ne peut jamais dépendre du JWT (il n'y en a pas) : le `tenant_id` doit toujours venir du **slug résolu côté serveur**, jamais d'un paramètre envoyé par le client.
- `has_permission()`/`require_permission()` : système de permissions mature, à ne pas dupliquer — les nouvelles routes internes (ex. "publier sur Facebook" déclenché par le commerçant) doivent passer par ce même mécanisme.
- `Idempotency-Key` + `store_response_atomic()` : pattern déjà prouvé (et durci deux fois cette session même) — à réutiliser telle quelle pour "commande publique" (un visiteur qui double-clique sur "commander" ne doit jamais créer deux commandes).
- Rate limiting (`slowapi`, `app/core/rate_limit.py`) : déjà en place sur `/auth/login`/`/auth/register` — le même mécanisme (`@limiter.limit(...)`) doit protéger la nouvelle route de commande publique contre le spam.
- Sentry (backend + frontend, gated par variable d'env) : déjà en place, capturera automatiquement les erreurs des nouvelles routes sans configuration supplémentaire.
- Verrouillage de ligne stock (`with_for_update()`) : le endpoint de commande publique devra impérativement réutiliser ce pattern (déjà appliqué à `create_order`) — une commande publique décrémente du stock réel, donc soumise à la même classe de bug de concurrence déjà trouvée et corrigée cette session.

## 4. Schéma de données pertinent

```
tenants (slug unique, déjà prêt pour URL publique)
  └─ products (tenant_id, images[] base64, PAS de is_public, PAS de slug)
  └─ clients (tenant_id) ── segments (tenant_id, filters JSON) ── campaigns (tenant_id, segment_id, PAS d'envoi réel)
  └─ orders (tenant_id, client_id) — création déjà idempotente, stock déjà verrouillé
```

Champs à ajouter (migrations à prévoir, pas encore faites) :
- `products.is_public: bool default false` — visibilité publique explicite, opt-in (jamais public par défaut).
- `products.slug: str, unique par tenant` — URL propre `/boutique/{tenant_slug}/produit/{product_slug}` (avec repli sur `id` si absent, pour ne rien casser sur les produits existants).
- Nouvelle table pour la connexion Facebook (page_id, token chiffré, tenant_id, jamais exposé au frontend) — Phase 3 seulement.
- Nouvelle table `public_orders` ou extension d'`orders` pour distinguer une commande créée par un visiteur anonyme (pas de `created_by` interne) — à trancher en Phase 4, probablement une simple extension (client "visiteur" rattaché, similaire au client "Passant" déjà existant et dont la concurrence a été durcie cette session).

## 5. Mécanismes de sécurité (déjà en place, à répliquer pour le public)

RLS documentée non active, isolation applicative stricte (vérifiée par tests croisés A→B, 0 fuite), permissions par rôle, rate limiting auth, JWT à durée de vie courte (30 min + refresh), audit log étendu, Sentry.

## 6. Mécanismes offline (à ne pas toucher)

Backoff exponentiel plafonné, erreurs 4xx jamais rejouées, réconciliation id-local→id-serveur. **Sans lien direct avec la vitrine publique** (un visiteur non connecté n'a pas de file offline) — le risque est uniquement de ne pas dégrader accidentellement ce mécanisme en touchant des fichiers partagés (`lib/api/client.ts`). Les nouvelles routes publiques doivent vivre dans un client HTTP séparé ou clairement isolé de `handleOfflineRequest`.

## 7. Points fragiles

1. Aucune infrastructure async réelle (§3.2) — le plus gros chantier caché derrière "Phase 3 Facebook" et "Phase 7 relances".
2. Images base64 (§3.1) — bloquant direct pour l'aperçu de partage social.
3. `/migrate` ouvert (§3.6) — sans lien avec ce chantier mais à corriger un jour.
4. Segments : à clarifier avec toi avant d'y toucher (§3.4).
5. Aucun middleware Next.js — toute nouvelle route publique doit être positionnée avec soin pour ne jamais hériter par accident d'une logique de protection pensée pour `(dashboard)`.

## 8. Dépendances réutilisables (résumé)

Voir §3.7 — isolation, permissions, idempotence, rate limiting, Sentry, verrouillage stock : tout est prêt et mature, rien à réinventer.

## 9. Risques de régression

- Toucher `products/router.py` (déjà dense, déjà corrigé plusieurs fois cette session pour la concurrence stock) pour ajouter `is_public`/visibilité — modification chirurgicale requise, ne jamais toucher la logique de vente existante.
- Toucher `main.py` pour monter de nouveaux routers publics — risque faible si les nouveaux routers sont dans des fichiers séparés (`app/modules/storefront/`).
- Le futur worker/job Facebook ne doit jamais pouvoir bloquer une vente ou une synchronisation (déjà une exigence explicite du plan, cohérente avec l'esprit du projet).

## 10. Fichiers concernés par le futur chantier (prévisionnel, sujet à ajustement en Phase 1)

**Nouveaux (backend)** : `app/modules/storefront/router.py`, `app/modules/storefront/schemas.py`, migration Alembic (`products.is_public`, `products.slug`).
**Nouveaux (frontend)** : `src/app/boutique/[slug]/page.tsx` (vitrine), en dehors de `(auth)`/`(dashboard)`.
**Modifiés (minimal)** : `app/modules/products/router.py` (exposer `is_public` dans les schémas existants, sans toucher à la logique de vente), `app/main.py` (montage du nouveau router).
**Non touchés** : tout le reste — ventes, stock, finances, offline/sync, CRM, permissions.

---

## Prochaine étape

Ce document clôt la Phase 0. **Je m'arrête ici, comme demandé.** Avant de coder la Phase 1 (vitrine publique), je dois clarifier un point avec toi (§3.4 — Segments) et te proposer le plan technique concret de la Phase 1 pour validation.
