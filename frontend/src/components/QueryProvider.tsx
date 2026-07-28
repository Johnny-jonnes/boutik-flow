'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

  // Invalidation ciblée après une synchronisation offline→online : seules
  // les listes concernées sont revalidées (jamais un vidage complet du
  // cache), le reste de l'app affiché reste intact.
  useEffect(() => {
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    };
    const onSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as { succeeded: number } | undefined;
      if (detail?.succeeded) invalidateAll();
    };
    window.addEventListener('boutikflow:sync-complete', onSyncComplete);
    return () => window.removeEventListener('boutikflow:sync-complete', onSyncComplete);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
