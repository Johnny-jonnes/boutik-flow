'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Clés de requête partagées — Dashboard, Vendre, Produits et Clients
 * appellent toutes ces mêmes hooks avec les mêmes paramètres (page 1,
 * 500 par page), donc ils pointent vers la même entrée de cache : la
 * première page visitée charge les données, les suivantes les trouvent
 * déjà en mémoire.
 *
 * 500 = le plafond serveur (voir products/router.py, crm/router.py —
 * per_page le=500). Un plafond plus bas ici (100 auparavant) faisait
 * silencieusement disparaître tout produit/client au-delà du 100e : la
 * liste ne contenait jamais qu'une seule page serveur, jamais rechargée
 * au-delà. Un catalogue ou fichier client dépassant 500 se heurtera au
 * même plafond — la recherche (voir POS/Produits) interroge alors le
 * serveur directement plutôt que de filtrer cette liste en mémoire.
 */
export const queryKeys = {
  products: (page = 1, perPage = 500) => ['products', page, perPage] as const,
  clients: (page = 1, perPage = 500) => ['clients', page, perPage] as const,
  categories: (page = 1, perPage = 100) => ['categories', page, perPage] as const,
  // Une seule entrée de cache pour tout l'historique des commandes — Dashboard,
  // Ventes et Commandes filtrent ensuite en mémoire (par période, par statut),
  // exactement comme Produits/Vendre partagent déjà products().
  orders: () => ['orders'] as const,
  team: () => ['team'] as const,
  dashboardKpis: (period: string, start?: string, end?: string) => ['dashboard-kpis', period, start, end] as const,
  analytics: (period: string, start?: string, end?: string) => ['analytics', period, start, end] as const,
  financeTransactions: (
    page: number, perPage: number, type?: string, category?: string,
    period?: string, start?: string, end?: string,
  ) => ['finance-transactions', page, perPage, type, category, period, start, end] as const,
};

export function useProductsQuery(page = 1, perPage = 500) {
  return useQuery({
    queryKey: queryKeys.products(page, perPage),
    queryFn: ({ signal }) => api.getProducts(page, perPage, undefined, undefined, undefined, signal),
  });
}

export function useClientsQuery(page = 1, perPage = 500) {
  return useQuery({
    queryKey: queryKeys.clients(page, perPage),
    queryFn: ({ signal }) => api.getClients(page, perPage, undefined, undefined, signal),
  });
}

export function useCategoriesQuery(page = 1, perPage = 100) {
  return useQuery({
    queryKey: queryKeys.categories(page, perPage),
    queryFn: ({ signal }) => api.getCategories(page, perPage, signal),
  });
}

// Agrégats catalogue (valeur totale du stock, unités totales, nombre de
// produits) — calculés en base sur TOUT le catalogue, jamais en additionnant
// une page de 100 produits côté client (faux dès que le catalogue dépasse
// cette taille).
export function useProductStatsQuery() {
  return useQuery({
    queryKey: ['product-stats'],
    queryFn: ({ signal }) => api.getProductStats(signal),
  });
}

// Tout l'historique des commandes, en une seule entrée de cache partagée
// par Dashboard et Ventes (comme products()/clients() le sont par
// Dashboard/Vendre/Produits/Clients). Boucle sur toutes les pages serveur
// (500 par page, le plafond actuel) : sans ça, une boutique dépassant 500
// commandes perdrait silencieusement ses ventes les plus anciennes de son
// historique — même piège déjà corrigé une fois pour Produits/Clients.
export function useOrdersQuery() {
  return useQuery({
    queryKey: queryKeys.orders(),
    queryFn: async () => {
      const first = await api.getOrders(1, undefined, 500);
      let items = first.items;
      const totalPages = Math.min(first.pages || 1, 50); // garde-fou anti-boucle infinie
      for (let page = 2; page <= totalPages; page++) {
        const next = await api.getOrders(page, undefined, 500);
        items = items.concat(next.items);
      }
      return { items, total: first.total };
    },
  });
}

export function useTeamQuery() {
  return useQuery({
    queryKey: queryKeys.team(),
    queryFn: () => api.getTeamMembers(),
  });
}

export function useDashboardKpisQuery(period: string, startDate?: string, endDate?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.dashboardKpis(period, startDate, endDate),
    queryFn: () => api.getDashboardKPIs(period, startDate, endDate),
    enabled,
  });
}

export function useAnalyticsQuery(period: string, startDate?: string, endDate?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analytics(period, startDate, endDate),
    queryFn: () => api.getAnalyticsData(period, startDate, endDate),
    enabled,
  });
}

export function useFinanceTransactionsQuery(
  page: number, perPage: number, type: string | undefined, category: string | undefined,
  period: string | undefined, startDate: string | undefined, endDate: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.financeTransactions(page, perPage, type, category, period, startDate, endDate),
    queryFn: () => api.getFinanceTransactions(page, perPage, type, category, period, startDate, endDate),
    enabled,
  });
}
