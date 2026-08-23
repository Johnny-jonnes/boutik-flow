// Scénario F — CAPACITÉ DE CONNEXION (auth sous charge)
// Ne crée PAS 100 000 comptes : réutilise un petit pool contrôlé de comptes
// de test dédiés (voir generate_synthetic_data.py, login_test_accounts).
//
// IMPORTANT : dans une exécution locale, tous les VUs partagent la MÊME
// adresse IP source (une seule machine) — la limitation de débit
// (Phase 10 de l'audit backend : slowapi, 10/minute PAR IP sur
// /auth/login) va donc plafonner artificiellement TOUT ce scénario dès
// qu'on dépasse ~10 connexions/minute, quel que soit le nombre de VUs.
// C'est un résultat attendu et informatif : en production, des milliers
// d'utilisateurs réels derrière des IP différentes ne seraient pas
// affectés de la même façon — mais des utilisateurs légitimes partageant
// une même IP (bureau, réseau mobile opérateur avec NAT) le seraient
// EUX AUSSI. Voir docs/SCALABILITY_AUDIT.md pour la discussion complète.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { loginTestAccounts } from '../lib/data.js';
import { buildReport, textReport } from '../lib/report.js';

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '5', 10);

export const options = {
  scenarios: {
    f_login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_UP || '10s', target: TARGET_VUS },
        { duration: __ENV.STEADY || '30s', target: TARGET_VUS },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  // Pas de seuil strict sur http_req_failed : des 429 sont un résultat
  // ATTENDU et informatif au-delà d'environ 10 requêtes/minute — c'est
  // justement ce qu'on mesure, pas un échec du test.
};

export default function () {
  const account = loginTestAccounts[Math.floor(Math.random() * loginTestAccounts.length)];
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      boutique_slug: account.boutique_slug,
      email: account.email,
      password: account.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, {
    'login 200 ou 429 (rate limit attendu au-delà de 10/min)': (r) => r.status === 200 || r.status === 429,
  });
  sleep(1 + Math.random());
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'F_login_capacity', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/F_login_capacity-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
