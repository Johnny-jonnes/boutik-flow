// Scénario B — VENDEUR
// Connexion (token) → recherche produit → sélection → validation vente
// (panier = items[] dans un seul POST /orders, il n'existe pas d'endpoint
// panier séparé dans le module actuel — voir audit endpoints) → paiement →
// récupération du résultat. Écrit réellement des commandes (comme un vrai
// point de vente), donc c'est aussi ce scénario qui produit l'essentiel de
// la charge d'écriture (DB, idempotence, décrément de stock).
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from '../config/environment.js';
import { randomTenant, randomUser, randomItem, authHeaders, thinkTime } from '../lib/helpers.js';
import { buildReport, textReport } from '../lib/report.js';

const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '15', 10);
const RAMP_UP = __ENV.RAMP_UP || '20s';
const STEADY = __ENV.STEADY || '40s';
const RAMP_DOWN = __ENV.RAMP_DOWN || '10s';

export const options = {
  scenarios: {
    b_vendeur: {
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
    http_req_failed: ['rate<0.02'],
    'http_req_duration{scenario:b_vendeur}': ['p(95)<1500', 'p(99)<3000'],
  },
};

const SEARCH_TERMS = ['riz', 'huile', 'savon', 'lait', 'sucre', 'eau', 'café', 'thé'];

export default function () {
  const tenant = randomTenant();
  const user = randomUser(tenant);
  const opts = authHeaders(user);

  // Recherche produit
  const term = randomItem(SEARCH_TERMS);
  let res = http.get(`${BASE_URL}/products?search=${term}&per_page=10`, opts);
  check(res, { 'recherche produit 200': (r) => r.status === 200 });
  sleep(thinkTime(1, 2));

  // Sélection produit — si la recherche ne donne rien, on retombe sur le
  // catalogue connu du tenant (un vrai vendeur retenterait une autre
  // recherche ; on simplifie ici pour rester déterministe).
  let productId;
  try {
    const items = res.json('items');
    productId = items && items.length > 0 ? randomItem(items).id : randomItem(tenant.product_ids);
  } catch (e) {
    productId = randomItem(tenant.product_ids);
  }

  // Panier (1 à 3 lignes)
  const lineCount = 1 + Math.floor(Math.random() * 3);
  const items = [];
  const seen = new Set([productId]);
  items.push({ product_id: productId, quantity: 1 + Math.floor(Math.random() * 3) });
  for (let i = 1; i < lineCount; i++) {
    const pid = randomItem(tenant.product_ids);
    if (seen.has(pid)) continue;
    seen.add(pid);
    items.push({ product_id: pid, quantity: 1 + Math.floor(Math.random() * 2) });
  }
  sleep(thinkTime(1, 2));

  // Validation vente + paiement — 85% comptant, 15% vente à crédit
  // (paiement partiel, exerce la création de dette dans la même transaction).
  const isCredit = Math.random() < 0.15;
  const payload = {
    client_id: randomItem(tenant.client_ids),
    items,
    payment_method: randomItem(['cash', 'orange_money', 'card']),
  };
  if (isCredit) {
    payload.amount_paid_now = 0; // simplifié : différé total pour ce scénario
  }

  const headers = authHeaders(user, { 'Idempotency-Key': `b-${__VU}-${__ITER}-${Date.now()}` });
  res = http.post(`${BASE_URL}/orders`, JSON.stringify(payload), headers);
  check(res, {
    'vente créée (201)': (r) => r.status === 201,
    'réponse contient un total': (r) => {
      try { return r.json('total') !== undefined; } catch (e) { return false; }
    },
  });

  sleep(thinkTime(2, 4));
}

export function handleSummary(data) {
  const report = buildReport(data, { test: 'B_vendeur', environment: BASE_URL });
  const stamp = Date.now();
  return {
    [`reports/B_vendeur-${stamp}.json`]: JSON.stringify(report, null, 2),
    stdout: textReport(report),
  };
}
