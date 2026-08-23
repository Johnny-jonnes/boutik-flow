// TEST CRITIQUE — Concurrence sur le stock
// stock=10 sur un produit dédié (tenant[0].stock_test_product_id), N
// acheteurs tentent d'acheter 1 unité chacun EXACTEMENT en même temps.
// L'audit backend (Phase 12a) a confirmé qu'il n'existe ni verrou
// (`with_for_update`) ni contrainte CHECK stock>=0 : la vérification
// "stock suffisant ?" lit une valeur Python potentiellement obsolète avant
// que Postgres ne sérialise le UPDATE final. Ce test vérifie si ça se
// traduit réellement par une survente.
//
// N'utilise PAS un ramping-vus : per-vu-iterations démarre tous les VUs
// aussi simultanément que possible (une seule itération chacun).
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { tenants } from '../lib/data.js';
import { buildReport, textReport } from '../lib/report.js';

const CONCURRENT_BUYERS = parseInt(__ENV.STOCK_TEST_VUS || '20', 10);
const tenant = tenants[0];
const user = tenant.users[0];
const productId = tenant.stock_test_product_id;
const authOpts = { headers: { Authorization: `Bearer ${user.token}` } };

export const options = {
  scenarios: {
    stock_race: {
      executor: 'per-vu-iterations',
      vus: CONCURRENT_BUYERS,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  // Pas de seuil http_req_failed classique : une partie des 400 "stock
  // insuffisant" est le comportement CORRECT attendu (stock=10 < N
  // acheteurs). Le vrai critère est vérifié en teardown().
};

export function setup() {
  const res = http.get(`${BASE_URL}/products/${productId}`, authOpts);
  return { initialStock: res.json('stock'), productId };
}

export default function () {
  const payload = JSON.stringify({
    client_id: tenant.client_ids[0],
    items: [{ product_id: productId, quantity: 1 }],
    payment_method: 'cash',
  });
  const headers = {
    headers: {
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `stocktest-${__VU}-${Date.now()}`,
    },
  };
  const res = http.post(`${BASE_URL}/orders`, payload, headers);
  check(res, {
    'réponse propre (201 vendu, ou 400 stock insuffisant)': (r) => r.status === 201 || r.status === 400,
  });
}

export function teardown(data) {
  const res = http.get(`${BASE_URL}/products/${data.productId}`, authOpts);
  const finalStock = res.json('stock');
  const oversold = finalStock < 0;
  check(true, {
    'stock final jamais négatif (pas de survente)': () => !oversold,
    'stock final cohérent avec le stock initial': () => finalStock <= data.initialStock,
  });
  console.log(
    `[STOCK-TEST] produit=${data.productId} stock_initial=${data.initialStock} ` +
    `stock_final=${finalStock} acheteurs=${CONCURRENT_BUYERS} oversold=${oversold}`
  );
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'stock_concurrency', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/stock_concurrency-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
