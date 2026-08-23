// Scénario D — SYNCHRONISATION HORS-LIGNE
// Simule des appareils qui travaillent, perdent Internet, accumulent des
// ventes en file locale, puis retrouvent Internet et synchronisent tout
// d'un coup. Deux mécanismes réels sont exercés (voir audit endpoints) :
//   1. Pull incrémental : GET .../{orders,products,clients}?updated_since=...
//   2. Push idempotent : POST /orders avec Idempotency-Key — la clé est
//      REJOUÉE une seconde fois pour chaque vente, exactement comme un
//      appareil qui retente après un timeout réseau, afin de vérifier
//      qu'aucun doublon n'est créé (Phase 4 de l'audit backend).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { randomTenant, randomUser, randomItem, authHeaders } from '../lib/helpers.js';
import { buildReport, textReport } from '../lib/report.js';

const TARGET_DEVICES = parseInt(__ENV.TARGET_VUS || '10', 10);
const RAMP_UP = __ENV.RAMP_UP || '10s';
const STEADY = __ENV.STEADY || '30s';
const RAMP_DOWN = __ENV.RAMP_DOWN || '5s';

export const options = {
  scenarios: {
    d_synchronisation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: TARGET_DEVICES },
        { duration: STEADY, target: TARGET_DEVICES },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    // Le vrai signal d'intégrité (pas de doublon) est vérifié dans la
    // boucle elle-même via le check "rejeu = même commande qu'à l'origine".
    'checks{check:no_duplicate_on_retry}': ['rate==1'],
  },
};

export default function () {
  const tenant = randomTenant();
  const user = randomUser(tenant);
  const opts = authHeaders(user);

  // 1. Pull incrémental — l'appareil se resynchronise avant de rejouer sa file.
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  let res = http.get(`${BASE_URL}/orders?updated_since=${since}`, opts);
  check(res, { 'pull orders 200': (r) => r.status === 200 });
  res = http.get(`${BASE_URL}/products?updated_since=${since}`, opts);
  check(res, { 'pull products 200': (r) => r.status === 200 });
  res = http.get(`${BASE_URL}/clients?updated_since=${since}`, opts);
  check(res, { 'pull clients 200': (r) => r.status === 200 });

  // 2. Rejeu de la file locale accumulée pendant la coupure (3 à 8 ventes).
  const queueSize = 3 + Math.floor(Math.random() * 6);
  for (let i = 0; i < queueSize; i++) {
    const key = `sync-${__VU}-${__ITER}-${i}-${Date.now()}`;
    const payload = JSON.stringify({
      client_id: randomItem(tenant.client_ids),
      items: [{ product_id: randomItem(tenant.product_ids), quantity: 1 }],
      payment_method: 'cash',
    });
    const headers = authHeaders(user, { 'Idempotency-Key': key });

    const first = http.post(`${BASE_URL}/orders`, payload, headers);
    check(first, { 'sync write initial 201': (r) => r.status === 201 });

    // Rejeu explicite avec LA MÊME clé — simule l'appareil qui n'a jamais vu
    // la réponse (coupure au retour) et retente aveuglément.
    const retry = http.post(`${BASE_URL}/orders`, payload, headers);
    let firstId = null;
    let retryId = null;
    try { firstId = first.json('id'); } catch (e) { /* noop */ }
    try { retryId = retry.json('id'); } catch (e) { /* noop */ }

    check(true, {
      no_duplicate_on_retry: () => firstId !== null && firstId === retryId,
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'D_synchronisation', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/D_synchronisation-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
