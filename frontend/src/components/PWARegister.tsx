'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // `sw.js` ne fait aucune interception réseau (le mode hors ligne de
    // l'app repose sur localStorage, pas sur le Cache API) : son seul rôle
    // est de rendre l'app installable et de purger, à chaque activation,
    // les caches laissés par d'anciennes versions du Service Worker.
    // L'enregistrer normalement suffit ; register() est un no-op si la même
    // version est déjà active, et déclenche une mise à jour sinon.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
  }, []);

  return null;
}
