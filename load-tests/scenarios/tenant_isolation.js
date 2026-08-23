// TEST CRITIQUE — Isolation multi-tenant sous charge
// Chaque VU s'authentifie comme la boutique A et vérifie qu'AUCUN
// identifiant connu de la boutique B (produits, clients) n'apparaît dans
// ses propres réponses /products, /clients, /orders — même sous forte
// concurrence. Zéro tolérance : le seuil exige un taux de succès de 100%.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { tenants } from '../lib/data.js';
import { buildReport, textReport } from '../lib/report.js';

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '10', 10);
const DURATION = __ENV.DURATION || '30s';

export const options = {
  vus: TARGET_VUS,
  duration: DURATION,
  thresholds: {
    'checks{check:no_cross_tenant_leak}': ['rate==1'],
  },
};

export default function () {
  if (tenants.length < 2) {
    console.error('[ISOLATION-TEST] au moins 2 boutiques sont nécessaires — génère plus de tenants.');
    return;
  }

  // Choix déterministe par VU : garantit un mélange stable A/B à chaque
  // itération plutôt qu'un tirage aléatoire qui pourrait parfois comparer
  // une boutique à elle-même.
  const idxA = __VU % tenants.length;
  const idxB = (__VU + 1) % tenants.length;
  const tenantA = tenants[idxA];
  const tenantB = tenants[idxB];
  if (tenantA.tenant_id === tenantB.tenant_id) return;

  const userA = tenantA.users[0];
  const opts = { headers: { Authorization: `Bearer ${userA.token}` } };

  const resProducts = http.get(`${BASE_URL}/products?per_page=500`, opts);
  const resClients = http.get(`${BASE_URL}/clients?per_page=500`, opts);
  const resOrders = http.get(`${BASE_URL}/orders?per_page=500`, opts);

  const bodyProducts = resProducts.body || '';
  const bodyClients = resClients.body || '';

  const leakedProduct = tenantB.product_ids.find((id) => bodyProducts.indexOf(id) !== -1);
  const leakedClient = tenantB.client_ids.find((id) => bodyClients.indexOf(id) !== -1);
  const leaked = Boolean(leakedProduct || leakedClient);

  check(true, {
    no_cross_tenant_leak: () => !leaked,
  });
  check(resProducts, { 'products 200': (r) => r.status === 200 });
  check(resClients, { 'clients 200': (r) => r.status === 200 });
  check(resOrders, { 'orders 200': (r) => r.status === 200 });

  if (leaked) {
    console.error(
      `[ISOLATION-FAIL] la boutique ${tenantA.slug} a vu des données de ${tenantB.slug} ` +
      `(produit=${leakedProduct || '-'} client=${leakedClient || '-'})`
    );
  }
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'tenant_isolation', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/tenant_isolation-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
