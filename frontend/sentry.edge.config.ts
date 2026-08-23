import * as Sentry from '@sentry/nextjs';

// Inerte tant que SENTRY_DSN n'est pas configuré côté serveur (Vercel) —
// aucun SDK initialisé, comportement inchangé.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
