// Scénario A — CONSULTATION
// Utilisateur qui se contente de regarder : dashboard, produits, clients,
// ventes, commandes. Représente le trafic de lecture "de fond" (le plus
// fréquent dans un vrai usage POS multi-boutiques).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { randomTenant, randomUser, authHeaders, thinkTime } from '../lib/helpers.js';
import { buildReport, textReport } from '../lib/report.js';

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '20', 10);
const RAMP_UP = __ENV.RAMP_UP || '20s';
const STEADY = __ENV.STEADY || '40s';
const RAMP_DOWN = __ENV.RAMP_DOWN || '10s';

export const options = {
  scenarios: {
    a_consultation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: TARGET_VUS },
        { duration: STEADY, target: TARGET_VUS },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:a_consultation}': ['p(95)<1000', 'p(99)<2000'],
  },
};

export default function () {
  const tenant = randomTenant();
  const user = randomUser(tenant);
  const opts = authHeaders(user);

  // Connexion : on réutilise le JWT pré-généré (voir generate_synthetic_data.py)
  // — un utilisateur réel ne repasse pas par /auth/login à chaque requête,
  // le token vit en mémoire/localStorage côté frontend jusqu'à expiration.

  let res = http.get(`${BASE_URL}/dashboard/kpis`, opts);
  check(res, { 'dashboard kpis 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  res = http.get(`${BASE_URL}/products?page=1&per_page=20`, opts);
  check(res, { 'products 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 3));

  res = http.get(`${BASE_URL}/clients?page=1&per_page=20`, opts);
  check(res, { 'clients 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  res = http.get(`${BASE_URL}/orders?page=1&per_page=20&sort_by=created_at&sort_dir=desc`, opts);
  check(res, { 'orders (ventes) 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  res = http.get(`${BASE_URL}/orders?page=1&per_page=20&status=pending`, opts);
  check(res, { 'commandes en attente 200': (r) => r.status === 200 });
  sleep(thinkTime(2, 4));
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'A_consultation', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/A_consultation-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
