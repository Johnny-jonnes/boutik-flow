import * as Sentry from '@sentry/nextjs';

// Inerte tant que NEXT_PUBLIC_SENTRY_DSN n'est pas configuré — aucun SDK
// initialisé côté navigateur, comportement inchangé. Variable NEXT_PUBLIC_*
// car exposée au bundle client (nécessaire pour que le SDK s'exécute dans
// le navigateur), contrairement à SENTRY_DSN (serveur uniquement).
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
