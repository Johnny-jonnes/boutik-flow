'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queries';

/**
 * Applique un delta de synchronisation incrémentale (voir
 * incrementalSyncCollection dans lib/api/client.ts) directement sur une
 * entrée de cache liste — jamais un rechargement complet. Un élément
 * portant deleted_at est retiré ; sinon il remplace l'existant ou
 * s'ajoute. Si le cache n'est pas encore chargé (page jamais visitée sur
 * cet appareil), rien à faire : son premier chargement normal ramènera
 * déjà tout.
 */
function mergeDeltaIntoListCache(
  queryClient: QueryClient,
  key: readonly unknown[],
  delta: any[] | undefined,
) {
  if (!delta || delta.length === 0) return;
  queryClient.setQueryData(key, (old: { items: any[]; total: number } | undefined) => {
    if (!old) return old;
    let items = [...old.items];
    let total = old.total;
    for (const updated of delta) {
      const idx = items.findIndex((it) => it.id === updated.id);
      if (updated.deleted_at) {
        if (idx !== -1) { items.splice(idx, 1); total = Math.max(0, total - 1); }
      } else if (idx !== -1) {
        items[idx] = updated;
      } else {
        items = [updated, ...items];
        total += 1;
      }
    }
    return { ...old, items, total };
  });
}

/**
 * Couche mémoire globale (TanStack Query) : une fois une liste chargée
 * (produits, clients, catégories...), elle reste en mémoire et est
 * partagée par toutes les pages qui la consomment — Dashboard, Vendre,
 * Produits et Clients réutilisent la même clé de requête, donc la
 * première page visitée "préchauffe" le cache pour les autres.
 *
 * staleTime : au-delà d'une minute, les données déjà affichées sont
 * silencieusement revalidées en arrière-plan (stale-while-revalidate) —
 * l'utilisateur ne voit jamais d'écran de chargement au retour sur une
 * page déjà visitée.
 * gcTime : les données restent en mémoire 1h même sans écran actif dessus,
 * pour que revenir sur une page quittée depuis un moment reste instantané.
 */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 60 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  // Après une synchronisation offline→online : le delta (produits/clients
  // créés, modifiés ou supprimés depuis le dernier curseur) est appliqué
  // directement au cache mémoire — jamais un rechargement complet des
  // listes. Catégories et statistiques agrégées ne font pas partie de la
  // synchronisation incrémentale (petites listes / agrégat serveur
  // recalculé de toute façon) : elles restent en invalidation ciblée.
  useEffect(() => {
    const onSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        succeeded: number;
        deltas?: { products: any[]; clients: any[]; orders: any[]; transactions: any[]; debts: any[] };
      } | undefined;
      if (!detail?.succeeded) return;
      mergeDeltaIntoListCache(queryClient, queryKeys.products(), detail.deltas?.products);
      mergeDeltaIntoListCache(queryClient, queryKeys.clients(), detail.deltas?.clients);
      mergeDeltaIntoListCache(queryClient, queryKeys.orders(), detail.deltas?.orders);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      // Finance/Dashboard/Analytics varient par filtre (période, type...) —
      // trop de combinaisons possibles pour un merge de delta précis comme
      // products()/clients()/orders(). Invalidation ciblée par préfixe :
      // TanStack ne vide jamais l'écran, il ne fait que revalider en
      // arrière-plan ce qui est actuellement affiché, silencieusement.
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      // sales-list varie par combinaison de filtres (page Ventes) — même
      // logique que finance-transactions ci-dessus : invalidation par
      // préfixe, jamais un merge de delta précis.
      queryClient.invalidateQueries({ queryKey: ['sales-list'] });
      // Idem pour debts-list (module Dettes Clients) — une synchronisation
      // peut avoir créé une dette (vente à crédit hors-ligne) ou modifié
      // son solde (paiement hors-ligne).
      queryClient.invalidateQueries({ queryKey: ['debts-list'] });
    };
    window.addEventListener('boutikflow:sync-complete', onSyncComplete);
    return () => window.removeEventListener('boutikflow:sync-complete', onSyncComplete);
  }, [queryClient]);

  // Une vente vient d'être conclue (POS) — elle existe déjà en local
  // (IndexedDB) à cet instant : commandes, chiffre d'affaires et finances
  // se mettent à jour immédiatement partout, sans attendre une
  // synchronisation ni un rechargement de page.
  useEffect(() => {
    const onOrderCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sales-list'] });
      // Une vente à crédit (partielle ou différée) crée une dette dans la
      // même transaction côté serveur (voir create_order) — le module
      // Dettes Clients doit la voir apparaître immédiatement, sans
      // attendre une synchronisation.
      queryClient.invalidateQueries({ queryKey: ['debts-list'] });
    };
    window.addEventListener('boutikflow:order-created', onOrderCreated);
    return () => window.removeEventListener('boutikflow:order-created', onOrderCreated);
  }, [queryClient]);

  // Un versement de dette vient d'être enregistré (CRM ou module Dettes
  // Clients) — met à jour immédiatement Dettes/Finance/Dashboard, sans
  // attendre le staleTime de 60s ni un changement de fenêtre.
  useEffect(() => {
    const onDebtPaid = () => {
      queryClient.invalidateQueries({ queryKey: ['debts-list'] });
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['sales-list'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    };
    window.addEventListener('boutikflow:debt-paid', onDebtPaid);
    return () => window.removeEventListener('boutikflow:debt-paid', onDebtPaid);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
