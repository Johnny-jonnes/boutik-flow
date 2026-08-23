'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Filet de sécurité pour les erreurs de rendu React non rattrapées par une
// error.tsx locale. Sentry.captureException est un no-op sans
// NEXT_PUBLIC_SENTRY_DSN configuré (voir src/instrumentation-client.ts).
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Une erreur est survenue</h1>
          <p style={{ color: '#666' }}>Veuillez recharger la page. Si le problème persiste, contactez le support.</p>
        </div>
      </body>
    </html>
  );
}
