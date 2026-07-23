'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleRegister = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          console.log('PWA Service Worker registered with scope:', reg.scope);
        } catch (error) {
          console.error('PWA Service Worker registration failed:', error);
        }
      };

      // Enregistre après le chargement de la page pour ne pas bloquer les performances
      if (document.readyState === 'complete') {
        handleRegister();
      } else {
        window.addEventListener('load', handleRegister);
        return () => window.removeEventListener('load', handleRegister);
      }
    }
  }, []);

  return null;
}
