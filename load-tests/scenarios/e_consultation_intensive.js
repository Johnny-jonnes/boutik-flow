// Scénario E — CONSULTATION INTENSIVE
// Beaucoup d'utilisateurs qui consultent en même temps (dashboard, produits,
// clients, ventes), sans temps de réflexion entre les appels — sert à
// trouver le point où le trafic de LECTURE pur commence à dégrader le
// service (avant même de mélanger des écritures), donc à isoler si le
// premier goulot d'étranglement vient des lectures (pool DB / requêtes
// coûteuses) ou des écritures (Phase 4 idempotence, verrous).
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { randomTenant, randomUser, authHeaders } from '../lib/helpers.js';
import { buildReport, textReport } from '../lib/report.js';

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '50', 10);
const RAMP_UP = __ENV.RAMP_UP || '15s';
const STEADY = __ENV.STEADY || '30s';
const RAMP_DOWN = __ENV.RAMP_DOWN || '10s';

export const options = {
  scenarios: {
    e_consultation_intensive: {
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
    'http_req_duration{scenario:e_consultation_intensive}': ['p(95)<1000', 'p(99)<2000'],
  },
};

export default function () {
  const tenant = randomTenant();
  const user = randomUser(tenant);
  const opts = authHeaders(user);

  const res1 = http.get(`${BASE_URL}/dashboard/kpis`, opts);
  const res2 = http.get(`${BASE_URL}/products?page=1&per_page=20`, opts);
  const res3 = http.get(`${BASE_URL}/clients?page=1&per_page=20`, opts);
  const res4 = http.get(`${BASE_URL}/orders?page=1&per_page=20`, opts);

  check(res1, { 'dashboard 200': (r) => r.status === 200 });
  check(res2, { 'products 200': (r) => r.status === 200 });
  check(res3, { 'clients 200': (r) => r.status === 200 });
  check(res4, { 'orders 200': (r) => r.status === 200 });
  // Pas de sleep() volontairement : c'est le point qui distingue ce
  // scénario du "A_consultation" (utilisateur réaliste avec temps de
  // réflexion) — ici on cherche la limite de débit brute.
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'E_consultation_intensive', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/E_consultation_intensive-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
