'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // `sw.js` met en cache les fichiers statiques Next.js ET les pages/
    // navigations, avec une clé de cache normalisée pour les secondes
    // (voir le commentaire en tête de sw.js — l'en-tête Vary de Next.js
    // dépend de la page de provenance, d'où cette normalisation). Les
    // données métier passent par la file de synchronisation hors-ligne de
    // lib/api/client.ts, indépendante de ce Service Worker. register()
    // est un no-op si la même version est déjà active.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
  }, []);

  return null;
}
