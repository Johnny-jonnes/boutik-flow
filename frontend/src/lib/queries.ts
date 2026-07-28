'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Clés de requête partagées — Dashboard, Vendre, Produits et Clients
 * appellent toutes ces mêmes hooks avec les mêmes paramètres (page 1,
 * 100 par page), donc ils pointent vers la même entrée de cache : la
 * première page visitée charge les données, les suivantes les trouvent
 * déjà en mémoire.
 */
export const queryKeys = {
  products: (page = 1, perPage = 100) => ['products', page, perPage] as const,
  clients: (page = 1, perPage = 100) => ['clients', page, perPage] as const,
  categories: (page = 1, perPage = 100) => ['categories', page, perPage] as const,
};

export function useProductsQuery(page = 1, perPage = 100) {
  return useQuery({
    queryKey: queryKeys.products(page, perPage),
    queryFn: ({ signal }) => api.getProducts(page, perPage, undefined, undefined, undefined, signal),
  });
}

export function useClientsQuery(page = 1, perPage = 100) {
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
