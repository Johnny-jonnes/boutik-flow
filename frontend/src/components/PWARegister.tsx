'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // `sw.js` met en cache les pages déjà visitées et les fichiers statiques
    // Next.js, pour que la navigation entre pages reste possible sur une
    // connexion coupée ou instable (les données métier, elles, passent par
    // la file de synchronisation hors-ligne de lib/api/client.ts, pas par
    // ce cache). register() est un no-op si la même version est déjà
    // active, et déclenche une mise à jour sinon.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
  }, []);

  return null;
}
