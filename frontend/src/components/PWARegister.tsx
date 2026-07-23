'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. Désenregistrer activement TOUS les Service Workers actifs pour réparer le cache mobile bloqué
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log('Successfully unregistered active Service Worker to clear local cache.');
                // Recharger la page pour s'assurer que les requêtes repassent immédiatement par le réseau natif
                window.location.reload();
              }
            });
          }
        }).catch((err) => {
          console.error('Error unregistering service worker:', err);
        });
      }

      // 2. Vider tous les caches de stockage locaux (CacheStorage) pour purger les fichiers périmés
      if ('caches' in window) {
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              return caches.delete(cacheName);
            })
          );
        }).catch((err) => {
          console.error('Error clearing CacheStorage:', err);
        });
      }
    }
  }, []);

  return null;
}
