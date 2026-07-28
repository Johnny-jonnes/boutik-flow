'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // `sw.js` met en cache uniquement les fichiers statiques Next.js —
    // volontairement PAS les pages/navigations (voir le commentaire en
    // tête de sw.js : leur en-tête Vary dépend de la page de provenance,
    // ce qui rendait un cache de navigation incorrect). Les données
    // métier passent par la file de synchronisation hors-ligne de
    // lib/api/client.ts, indépendante de ce Service Worker. register()
    // est un no-op si la même version est déjà active.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
  }, []);

  return null;
}
