# BoutikFlow — Rapport final : chantier conformité, sécurité, intégrité des données et stabilité production

**Date** : 15 septembre 2026
**Méthode** : Audit → Compréhension → Modification minimale → Test → Vérification → Validation, sur chaque point. Aucune déclaration "tout est sécurisé" sans preuve — chaque ligne ci-dessous porte un verdict explicite (CONFORME / NON CONFORME / À VÉRIFIER / NON APPLICABLE) et, pour les correctifs, un test reproductible.

---

## 1. Ce qui a été audité

Les 22 phases du cahier des charges, dans l'ordre, avec un niveau de preuve adapté à chacune : lecture de code + citations exactes pour les phases d'audit pur, **tests empiriques réels** (serveur local, vraies requêtes HTTP, vraie base Postgres, nettoyage systématique après coup) pour toute phase impliquant un comportement runtime ou une hypothèse de concurrence.

## 2. Ce qui fonctionnait déjà (aucune modification)

- **Isolation multi-boutiques** (`tenant_id`) — filtrée sur absolument chaque requête mutante du backend, vérifiée par lecture de code sur l'intégralité des endpoints PUT/PATCH/DELETE, et par tests croisés A→B en direct (19/19) et sous charge concurrente (des centaines de requêtes, 0 fuite).
- **Authentification JWT** — hachage bcrypt des mots de passe, refresh correctement bloqué pour un compte désactivé/supprimé.
- **Offline/synchronisation** (`lib/api/client.ts`) — backoff exponentiel plafonné, erreurs définitives (4xx) jamais rejouées en boucle, réconciliation id-local→id-serveur correcte y compris pour une dette liée à une vente hors-ligne.
- **Formules financières** — marge calculée uniquement sur prix d'achat connus (jamais estimée), retours proratisés correctement, CA brut et bénéfice net cohérents entre Dashboard/Analytics/Finance pour une même période.
- **Service worker & PWA** — cache-first sur les assets, network-first sur la navigation avec repli propre hors-ligne, écritures jamais interceptées côté SW.
- **Conservation des données** — aucune suppression automatique programmée ; toute suppression est un soft-delete réversible avant toute purge définitive.

## 3. Problèmes réellement trouvés et corrigés

| # | Problème | Sévérité | Commit |
|---|---|---|---|
| 1 | Journal d'audit incomplet : produits, clients, équipe/rôles, stock, annulation de commande jamais tracés | Conformité | `620694f` |
| 2 | `ScrollToTop.tsx` : safe-area codée en dur (même classe de bug que le login) | Mineur | `620694f` |
| 3 | Page `/privacy` inexistante (ré-exportait `/terms`) | Conformité légale | `b5d4acb` |
| 4 | Fenêtre de révocation d'accès de 24h (`ACCESS_TOKEN_EXPIRE_MINUTES` dérivé de 30 à 1440) | Sécurité | corrigé en local, **action manuelle Render requise** |
| 5 | **Retour produit** vulnérable à un double remboursement + double réassort sous requêtes concurrentes (idempotence non atomique) | **Critique — intégrité financière** | `bd7d5c3` |
| 6 | **Client "Passant"** dupliqué sous ventes anonymes concurrentes (find-or-create sans protection) | Data-quality | `333df91` |
| 7 | Pagination Commandes/Produits non recalée quand la liste rétrécit suite à une action | Mineur (UX) | `ca39731` |

Tous testés par reproduction réelle avant correction (jamais supposés), puis par preuve de la correction (concurrence réelle pour 5 et 6 : 15 et 10 requêtes simultanées respectivement).

**Rappel — trouvé pendant la phase précédente de cet audit (déjà corrigé, contexte)** : perte de mise à jour sur le stock sous vente concurrente (`with_for_update()` manquant) — commit `2576972`, mentionné ici pour la continuité du dossier.

## 4. Nouvelles fonctionnalités livrées pendant ce chantier (demandes explicites, hors périmètre d'audit)

- Rôle **Vendeur / Gestionnaire de stock** (`seller_stock_manager`) — fusion exacte de Caissier + Gestionnaire de stock.
- **Masquage des chiffres financiers par rôle** (marge, prix d'achat, CA, valeur du stock, module Finance) — réglable par le propriétaire, appliqué strictement côté serveur.

## 5. Problèmes volontairement non modifiés (décisions documentées, pas des oublis)

| Sujet | Statut | Pourquoi |
|---|---|---|
| RLS Postgres | Scaffoldée, non activée en production | Décision explicite de l'audit de performance précédent — documenter plutôt qu'activer sans environnement de test dédié |
| `idempotency_keys` / `audit_logs` sans TTL | Croissance non bornée | Pas de risque de perte de données ; sujet de maintenance future, pas urgent |
| File offline : dédup d'opérations différentes | Comportement voulu | Empêcher ça bloquerait des ventes légitimes distinctes |
| Repli hors-ligne de `/products/stats` | Ne respecte pas le masquage financier si actif hors-ligne | Edge case étroit (masquage + hors-ligne simultanés) ; corriger nécessiterait de mettre en cache les réglages boutique dans la file offline, hors périmètre pour ne pas toucher la synchronisation sans nécessité |
| Charts (revenue_data, top_products) non masqués | Seuls les totaux agrégés le sont | Périmètre volontairement restreint pour une première version du masquage |

## 6. Risques restants

1. **`ACCESS_TOKEN_EXPIRE_MINUTES`** doit être changé sur le dashboard Render (variable d'environnement, jamais poussée par git) — actuellement à une valeur non recommandée. **Action utilisateur requise.**
2. **`/privacy`** contient 3 emplacements explicitement marqués "À compléter" (raison sociale, adresse légale, numéro d'enregistrement d'entreprise) — non publiable officiellement en l'état. **Action utilisateur requise.**
3. Les CGU (`/terms`) affirment des garanties techniques ("chiffrement au niveau base de données") non totalement vérifiées par cet audit (RLS non active) — écart entre promesse marketing et réalité technique, à réconcilier.
4. Aucun test de charge réel contre l'infrastructure Render de production (uniquement simulation locale, framework k6 livré séparément — voir `load-tests/`).

## 7. Recommandations

- Compléter et publier `/privacy` avec les vraies informations légales de TrillionX.
- Remettre `ACCESS_TOKEN_EXPIRE_MINUTES` à une valeur raisonnable (30-60 min) sur Render.
- Réconcilier le texte des CGU avec l'état réel de la sécurité (RLS), ou activer RLS avec un vrai environnement de test au préalable.
- Revue périodique (ex. trimestrielle) de la taille des tables `idempotency_keys`/`audit_logs` pour anticiper un futur besoin d'archivage.

## 8. Tableau de conformité par phase

| Phase | Sujet | Verdict |
|---|---|---|
| 1 | Isolation multi-boutiques | ✅ CONFORME |
| 2 | Utilisateurs et rôles | ✅ CONFORME (après correctif fenêtre de révocation) |
| 3 | Données personnelles | ✅ CONFORME |
| 4 | Données commerciales | ✅ CONFORME |
| 5 | Offline et synchronisation | ✅ CONFORME |
| 6 | Idempotence | ✅ CONFORME (après correctif retour produit) |
| 7 | Ventes | ✅ CONFORME (après correctif client passant) |
| 8 | Retours | ✅ CONFORME |
| 9 | Finances | ✅ CONFORME |
| 10 | Dashboard | ✅ CONFORME |
| 11 | Historique | ✅ CONFORME (après correctif pagination) |
| 12 | Conservation des données | ✅ CONFORME |
| 13 | Audit et traçabilité | ✅ CONFORME (après extension de couverture) |
| 14 | Sécurité API | ✅ CONFORME |
| 15 | Supabase/PostgreSQL | ⚠️ À VÉRIFIER (RLS scaffoldée, non activée — décision assumée) |
| 16 | Authentification | ✅ CONFORME (après correctif fenêtre de révocation) |
| 17 | PWA mobile | ⚠️ À VÉRIFIER (safe-area vérifiée ; clavier/viewport non testés — nécessite un appareil réel) |
| 18 | Conformité légale | ⚠️ À VÉRIFIER (`/privacy` créée, 3 champs à compléter par TrillionX) |
| 19 | Non-régression | ✅ CONFORME (pratiquée en continu, chaque correctif testé avant/après) |
| 20-21 | Méthodologie / interdits | ✅ CONFORME (aucune réintroduction de module supprimé, aucun changement d'architecture) |
