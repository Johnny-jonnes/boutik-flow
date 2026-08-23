# Tests de charge BoutikFlow (k6)

Suite de tests de charge pour BoutikFlow (POS SaaS multi-boutiques —
Next.js/FastAPI/Supabase-Postgres). Simule un trafic réaliste, pas une
boucle `GET /products` répétée : plusieurs profils d'utilisateurs, une
distribution multi-boutiques, des vérifications d'intégrité (pas seulement
des codes HTTP 200).

## Réalité de l'infrastructure disponible (à lire avant tout)

Cette suite a été construite et testée dans un environnement où :
- il n'existe **aucun environnement de staging** dédié (Render/Supabase) —
  seule la base Supabase déjà utilisée pendant tout l'audit de performance
  est disponible ;
- il n'existe **aucune infrastructure de génération de charge distribuée**
  (pas de compte Grafana Cloud k6, pas de cluster Kubernetes dédié) — une
  seule machine locale génère la charge.

**Conséquence directe : atteindre réellement 100 000 VUs n'est pas possible
depuis cette configuration.** k6 documente lui-même qu'un seul générateur
sur une machine de bureau tient de façon fiable de l'ordre de quelques
centaines à quelques milliers de VUs selon la complexité du script — pas
100 000. Voir `docs/SCALABILITY_AUDIT.md` à la racine du dépôt pour :
- les niveaux de charge réellement mesurés localement ;
- le premier goulot d'étranglement identifié ;
- ce qu'il faudrait mettre en place (k6 Cloud/Grafana Cloud k6, ou
  plusieurs générateurs `k6 run --out ...` coordonnés, ou l'opérateur k6 sur
  Kubernetes) pour tester honnêtement au-delà de la capacité d'une machine,
  **et** un vrai environnement de staging avant de tester au-delà de la
  capacité de la base actuelle.

Ne jamais lancer un test à forte charge contre l'URL de production Render
sans validation explicite — voir section "Sécurité" plus bas.

## Structure

```
load-tests/
  config/environment.js        BASE_URL (variable d'env, jamais en dur)
  lib/
    data.js                    Charge data/tenants.json (SharedArray)
    helpers.js                 Sélection aléatoire tenant/user, think-time
    report.js                  Génère le rapport automatique par test
  data/
    generate_synthetic_data.py Génère N boutiques/users/produits/clients fictifs
    cleanup_synthetic_data.py  Supprime tout ce qui a été généré
    tenants.json                (généré, jamais commité — voir .gitignore)
  scenarios/
    a_consultation.js          Scénario A — consultation
    b_vendeur.js                Scénario B — vendeur (écrit de vraies ventes)
    c_gestionnaire.js           Scénario C — gestionnaire
    d_synchronisation.js        Scénario D — sync hors-ligne
    e_consultation_intensive.js Scénario E — lecture intensive, sans think-time
    f_login_capacity.js         Scénario F — connexion sous charge
    stock_concurrency.js        TEST CRITIQUE — survente possible ?
    tenant_isolation.js         TEST CRITIQUE — fuite cross-tenant ?
  scripts/
    generate-data.ps1 / .sh
    cleanup-data.ps1 / .sh
    run-progressive.ps1 / .sh   Monte la charge palier par palier
    run-soak.ps1                Test longue durée
  reports/                      Rapports JSON + texte, un par exécution
```

## Prérequis

- [k6](https://k6.io) installé (`winget install k6` sous Windows, `apt install k6` / voir doc officielle ailleurs).
- Un serveur backend **local** démarré (jamais la production) :
  ```
  cd backend
  uvicorn app.main:app --port 8159
  ```
- Python + les dépendances du backend déjà installées (pour les scripts de génération/nettoyage de données, qui utilisent directement les modèles SQLAlchemy — pas d'appel HTTP).

## Sécurité

- **Aucune donnée réelle** n'est jamais utilisée : tous les tenants générés
  ont un slug préfixé `lt-<id>` et des utilisateurs `user*@lt-*.loadtest`.
- **Aucun mot de passe réel** : tous les comptes de test partagent le même
  mot de passe fictif (`LoadTest123!`), généré par le script, jamais un
  mot de passe d'un compte existant.
- **Aucun secret en dur** dans les scripts k6 : tout passe par variables
  d'environnement (`BASE_URL`, `TARGET_VUS`, etc.) — voir `config/environment.js`.
- `data/tenants.json` (contient des JWT, même pour des comptes fictifs)
  n'est **jamais commité** (`.gitignore`).
- Le workflow CI (`.github/workflows/load-test-smoke.yml`) est
  **déclenchement manuel uniquement**, jamais sur push/PR, et exige de
  fournir `base_url` explicitement à chaque lancement — aucune valeur par
  défaut qui pourrait accidentellement viser la production.

## Pourquoi des tokens JWT pré-générés (pas de vrai login par VU)

`generate_synthetic_data.py` crée directement les utilisateurs en base et
appelle la même fonction `create_access_token()` que le backend utilise
après un vrai `/auth/login` — chaque utilisateur virtuel a donc un JWT
valide sans jamais appeler `/auth/login`. Deux raisons :
1. **Réalisme** : un vrai utilisateur ne se reconnecte pas à chaque page vue,
   son token vit en mémoire jusqu'à expiration — la charge réelle contre
   `/auth/login` en production est bien plus faible que la charge contre
   les endpoints métier.
2. **Le rate limit de la Phase 10 de l'audit backend** (`slowapi`,
   10 requêtes/minute par IP sur `/auth/login`) bloquerait de toute façon
   toute tentative de faire passer des milliers de VUs par un vrai login
   depuis une seule machine (une seule IP source) — voir `f_login_capacity.js`,
   qui teste spécifiquement CE comportement à petite échelle, avec un pool
   dédié et restreint de comptes (jamais des milliers de comptes créés).

## Utilisation

### 1. Générer les données synthétiques

```powershell
.\scripts\generate-data.ps1 -TenantCount 25 -UsersPerTenant 3 -ProductsPerTenant 30 -ClientsPerTenant 15
```
```bash
./scripts/generate-data.sh
```

### 2. Lancer un scénario, à un seul niveau de charge

```powershell
$env:BASE_URL = "http://127.0.0.1:8159/api/v1"
$env:TARGET_VUS = 100
k6 run scenarios/a_consultation.js
```

### 3. Monter la charge palier par palier (recommandé — sections 6/7/8 du cahier des charges)

```powershell
.\scripts\run-progressive.ps1 -Scenario a_consultation -Levels 10,50,100,250,500,1000
```
```bash
./scripts/run-progressive.sh a_consultation "10,50,100,250,500,1000"
```
S'arrête automatiquement au premier palier où un seuil (`thresholds`)
échoue — c'est à la fois la "montée progressive" et le "test de
breakpoint" : le palier en échec EST le point de rupture mesuré.

### 4. Tests critiques (à lancer isolément, pas en même temps que d'autres scénarios)

```powershell
k6 run scenarios/stock_concurrency.js -e STOCK_TEST_VUS=20
k6 run scenarios/tenant_isolation.js -e TARGET_VUS=20 -e DURATION=30s
```

### 5. Test longue durée (soak)

```powershell
.\scripts\run-soak.ps1 -Vus 50 -Duration 2h
```
Par défaut le script tourne 10 minutes (démonstration) — un vrai soak test
(plusieurs heures, charge plus élevée) doit être lancé explicitement en
arrière-plan, avec surveillance externe (mémoire/CPU du process backend,
nombre de connexions Postgres actives côté Supabase) en parallèle.

### 6. Nettoyer les données synthétiques

```powershell
.\scripts\cleanup-data.ps1
```
Supprime aussi les commandes/dettes/transactions créées **pendant**
l'exécution des scénarios (pas seulement les données de seed initiales).

## Scénarios

| Scénario | Fichier | Ce qu'il simule |
|---|---|---|
| A — Consultation | `a_consultation.js` | Connexion → dashboard → produits → clients → ventes → commandes, avec temps de réflexion |
| B — Vendeur | `b_vendeur.js` | Recherche produit → panier → `POST /orders` (vraie vente, paiement, 15% à crédit) |
| C — Gestionnaire | `c_gestionnaire.js` | Dashboard + analytics + finance + historique — le plus coûteux côté agrégations SQL |
| D — Synchronisation | `d_synchronisation.js` | Pull `updated_since` + rejeu d'une file de ventes accumulées hors-ligne, **avec retry sur la même Idempotency-Key** pour vérifier l'absence de doublon |
| E — Consultation intensive | `e_consultation_intensive.js` | Comme A mais sans temps de réflexion — cherche la limite de débit brute en lecture |
| F — Connexion sous charge | `f_login_capacity.js` | `POST /auth/login` réel, pool de comptes restreint, mesure explicitement l'effet du rate limit par IP |
| Stock (critique) | `stock_concurrency.js` | N acheteurs simultanés sur un produit à stock=10 — vérifie l'absence de survente |
| Isolation (critique) | `tenant_isolation.js` | La boutique A ne doit JAMAIS voir un produit/client de la boutique B, même sous charge |

## Seuils (thresholds)

Valeurs de départ (à ajuster après analyse des objectifs réels de
BoutikFlow — voir cahier des charges section 10) :
- `http_req_failed` : < 1% (< 2% pour le scénario B, qui inclut des refus
  légitimes comme "stock insuffisant")
- `http_req_duration` p95 < 1000ms, p99 < 2000ms (1500/3000ms pour
  B/C, plus coûteux)
- `checks{check:no_cross_tenant_leak}` : 100% (zéro tolérance)
- `checks{check:no_duplicate_on_retry}` : 100% (zéro tolérance)

Un test qui retourne uniquement des 200 mais dépasse ces seuils est un
test en **échec** (k6 sort avec un code non-zéro) — voir cahier des
charges section 10 : ne jamais déclarer un test réussi sur la seule base
des codes HTTP.

## Rapports

Chaque scénario écrit deux sorties via `handleSummary()` (`lib/report.js`) :
un fichier `reports/<scénario>-<timestamp>.json` et un résumé texte affiché
dans le terminal (VUs, durée, req/s, p50/p90/p95/p99, taux d'erreur, taux
de checks, PASS/FAIL, seuils en échec le cas échéant).

## Limites connues de cette suite

- Génération de charge locale mono-machine : pas de vue réelle sur le
  comportement de Render (plusieurs instances/workers) ni sur les limites
  réelles du plan Supabase utilisé en production — voir
  `docs/SCALABILITY_AUDIT.md`.
- Les scénarios A/C/E utilisent des tokens pré-générés (voir plus haut) :
  ils ne mesurent PAS la capacité de `/auth/login` — c'est le rôle dédié
  du scénario F, volontairement limité en échelle.
- Le soak test par défaut est court (10 min, démonstration) — un vrai test
  de plusieurs heures doit être lancé explicitement.
- CI (`load-test-smoke.yml`) suppose que `data/tenants.json` existe déjà
  pour l'environnement ciblé : ce workflow ne génère pas lui-même les
  données (nécessiterait un secret `DATABASE_URL` de staging non
  configuré) — c'est documenté comme limite, pas silencieusement contourné.
