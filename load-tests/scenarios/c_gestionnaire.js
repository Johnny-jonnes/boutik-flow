// Scénario C — GESTIONNAIRE
// Connexion → dashboard → produits → clients → finances → historique ventes.
// Trafic plus "analytique" que le scénario A : dashboard/analytics et
// finance agrègent davantage côté serveur (GROUP BY, sommes) — c'est ce
// scénario qui sollicite le plus les requêtes coûteuses identifiées dans
// l'audit (Phases 1-2 : KPIs, analytics, répartition clients).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { randomTenant, randomUser, authHeaders, thinkTime } from '../lib/helpers.js';
import { buildReport, textReport } from '../lib/report.js';

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '10', 10);
const RAMP_UP = __ENV.RAMP_UP || '20s';
const STEADY = __ENV.STEADY || '40s';
const RAMP_DOWN = __ENV.RAMP_DOWN || '10s';

export const options = {
  scenarios: {
    c_gestionnaire: {
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
    'http_req_duration{scenario:c_gestionnaire}': ['p(95)<1500', 'p(99)<3000'],
  },
};

const PERIODS = ['24h', '7j', '30j', '90j'];

export default function () {
  const tenant = randomTenant();
  const user = randomUser(tenant); // owner/manager/seller mélangés — réaliste
  const opts = authHeaders(user);
  const period = PERIODS[Math.floor(Math.random() * PERIODS.length)];

  let res = http.get(`${BASE_URL}/dashboard/kpis?period=${period}`, opts);
  check(res, { 'dashboard kpis 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  res = http.get(`${BASE_URL}/dashboard/analytics?period=${period}`, opts);
  check(res, { 'dashboard analytics 200': (r) => r.status === 200 });
  sleep(thinkTime(2, 3));

  res = http.get(`${BASE_URL}/products?page=1&per_page=50`, opts);
  check(res, { 'products 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  res = http.get(`${BASE_URL}/clients?page=1&per_page=50`, opts);
  check(res, { 'clients 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  res = http.get(`${BASE_URL}/finance?period=${period}&page=1&per_page=50`, opts);
  check(res, { 'finance 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  res = http.get(`${BASE_URL}/orders?period=${period}&page=1&per_page=50&sort_by=created_at&sort_dir=desc`, opts);
  check(res, { 'historique ventes 200': (r) => r.status === 200 });
  sleep(thinkTime(2, 4));
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'C_gestionnaire', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/C_gestionnaire-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
