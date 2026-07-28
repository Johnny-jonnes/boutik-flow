/**
 * Client API BoutikFlow
 * ────────────────────────────────────────────────────────────────────────
 * Client HTTP typé pour l'API FastAPI (voir backend/app/modules/*).
 * - Base URL configurable via NEXT_PUBLIC_API_URL (fallback: localhost:8000)
 * - Injection automatique du Bearer token (localStorage)
 * - Rafraîchissement automatique du token sur 401 (une seule tentative)
 * - Extraction du message d'erreur FastAPI (`detail`)
 */
import type {
  LoginRequest,
  RegisterRequest,
  Client as CrmClient,
  ClientCreate,
  ClientUpdate,
  ClientStatus,
  Segment,
  SegmentCreate,
  SegmentUpdate,
  Category,
  CategoryCreate,
  CategoryUpdate,
  Product,
  ProductCreate,
  Order,
  OrderCreate,
  OrderStatus,
  DashboardKPIs,
  AnalyticsData,
  Campaign,
  CampaignCreate,
  CampaignUpdate,
  CampaignChannel,
  AdminStats,
  AdminTenantListItem,
  AdminTenantDetail,
  AdminNotification,
  PaginatedAdminTenants,
  TenantStatus,
  TenantPlan,
  Supplier,
  SupplierCreate,
  SupplierUpdate,
  TeamMember,
  InviteUserRequest,
  AuditLog,
  FinancialTransaction,
  FinanceSummary,
  TransactionListResponse,
  TransactionCreatePayload,
  ClientDebt,
} from '@/types';

// ─── Configuration ──────────────────────────────────────────────────────────

let rawApiUrl = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '') || 'https://boutik-flow.onrender.com/api/v1';
rawApiUrl = rawApiUrl.replace(/\/$/, '');
if (!rawApiUrl.endsWith('/api/v1')) {
  rawApiUrl = `${rawApiUrl}/api/v1`;
}
const API_BASE_URL = rawApiUrl;

const ACCESS_TOKEN_KEY = 'boutikflow_access_token';
const REFRESH_TOKEN_KEY = 'boutikflow_refresh_token';

// ─── Gestion des tokens ─────────────────────────────────────────────────────

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Erreur API ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ─── Rafraîchissement de token (dédupliqué) ────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

// ─── Idempotence des écritures critiques ───────────────────────────────────
//
// Sur une connexion INSTABLE (pas seulement coupée), une requête peut très
// bien atteindre le serveur et être traitée avec succès, mais sa réponse se
// perdre (timeout, coupure pendant la réponse). Le client ne sait alors pas
// si l'action a réellement eu lieu — et la retente, créant une vente, une
// transaction ou une dette EN DOUBLE côté serveur si aucune protection
// n'existe. generateIdempotencyKey() est appelée UNE SEULE FOIS par action
// utilisateur (voir chaque appel createOrder/createFinanceTransaction/
// createDebt/recordDebtPayment) ; la même clé est ensuite réutilisée pour
// toute nouvelle tentative — y compris un rejeu ultérieur depuis la file de
// synchronisation hors-ligne — pour que le serveur puisse reconnaître un
// doublon et renvoyer la réponse déjà traitée au lieu de recréer la
// ressource.
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function withIdempotencyKey(key: string): HeadersInit {
  return { 'Idempotency-Key': key };
}

// ─── IDs UUID v4 stables pour les données offline par défaut ───────────────
// (générés une fois — ne jamais utiliser de chaînes courtes type 'p1' qui
// sont rejetées par le backend FastAPI avec "Input should be a valid UUID")

const DEFAULT_PRODUCTS: any[] = [];
const DEFAULT_CLIENTS: any[] = [];

const DEFAULT_CATEGORIES = [
  { id: 'cccc0001-0000-4000-a000-000000000001', name: 'Vêtements',    slug: 'vetements',    created_at: new Date().toISOString() },
  { id: 'cccc0002-0000-4000-a000-000000000002', name: 'Chaussures',   slug: 'chaussures',   created_at: new Date().toISOString() },
  { id: 'cccc0003-0000-4000-a000-000000000003', name: 'Cosmétiques',  slug: 'cosmetiques',  created_at: new Date().toISOString() },
  { id: 'cccc0004-0000-4000-a000-000000000004', name: 'Électronique', slug: 'electronique', created_at: new Date().toISOString() },
];

const OfflineDB = {
  getProducts(): any[] {
    if (typeof window === 'undefined') return [];
    let p = localStorage.getItem('offline_products');
    if (p) {
      try {
        const parsed = JSON.parse(p);
        if (parsed.length > 0 && String(parsed[0].id).length < 30) {
          localStorage.removeItem('offline_products');
          p = null;
        }
      } catch { p = null; }
    }
    if (!p) {
      localStorage.setItem('offline_products', JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    return JSON.parse(p);
  },
  saveProducts(products: any[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('offline_products', JSON.stringify(products));
  },
  getClients(): any[] {
    if (typeof window === 'undefined') return [];
    let c = localStorage.getItem('offline_clients');
    if (c) {
      try {
        const parsed = JSON.parse(c);
        if (parsed.length > 0 && String(parsed[0].id).length < 30) {
          localStorage.removeItem('offline_clients');
          c = null;
        }
      } catch { c = null; }
    }
    if (!c) {
      localStorage.setItem('offline_clients', JSON.stringify(DEFAULT_CLIENTS));
      return DEFAULT_CLIENTS;
    }
    return JSON.parse(c);
  },
  saveClients(clients: any[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('offline_clients', JSON.stringify(clients));
  },
  getCategories(): any[] {
    if (typeof window === 'undefined') return [];
    let c = localStorage.getItem('offline_categories');
    if (c) {
      try {
        const parsed = JSON.parse(c);
        if (parsed.length > 0 && String(parsed[0].id).length < 30) {
          localStorage.removeItem('offline_categories');
          c = null;
        }
      } catch { c = null; }
    }
    if (!c) {
      localStorage.setItem('offline_categories', JSON.stringify(DEFAULT_CATEGORIES));
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(c);
  },
  saveCategories(categories: any[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('offline_categories', JSON.stringify(categories));
  },
  getOrders(): any[] {
    if (typeof window === 'undefined') return [];
    const o = localStorage.getItem('offline_orders');
    return o ? JSON.parse(o) : [];
  },
  saveOrders(orders: any[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('offline_orders', JSON.stringify(orders));
  },
  getDebts(): any[] {
    if (typeof window === 'undefined') return [];
    const d = localStorage.getItem('offline_debts');
    return d ? JSON.parse(d) : [];
  },
  saveDebts(debts: any[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('offline_debts', JSON.stringify(debts));
  },
  getTransactions(): any[] {
    if (typeof window === 'undefined') return [];
    const t = localStorage.getItem('offline_transactions');
    return t ? JSON.parse(t) : [];
  },
  saveTransactions(transactions: any[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('offline_transactions', JSON.stringify(transactions));
  }
};

// ─── File d'attente de synchronisation hors-ligne ──────────────────────────
//
// Une vente (ou toute autre écriture) tentée hors connexion était jusqu'ici
// seulement SIMULÉE localement (voir handleOfflineRequest ci-dessous) : un
// identifiant local était généré, la donnée écrite dans le cache du
// navigateur, et l'interface affichait un succès — mais RIEN n'était
// jamais envoyé au serveur. Au retour de connexion, aucun mécanisme
// n'existait pour rejouer ces opérations : la vente restait une donnée
// locale invisible du Tableau de bord, des Finances, ou de tout autre
// appareil. Le bandeau "Synchronisé" affiché au retour de connexion était
// une façade — un minuteur de 1,5 s, sans aucune synchronisation réelle
// derrière (`boutikflow:sync-request` n'était écouté nulle part).
//
// Cette file corrige ça : chaque écriture tentée hors-ligne est enregistrée
// ici, dans l'ordre de création, puis rejouée séquentiellement contre le
// vrai serveur dès que la connexion revient.

const SYNC_QUEUE_KEY = 'boutikflow_sync_queue';

interface QueuedOperation {
  id: string;
  method: string;
  path: string;
  body: string | undefined;
  createdAt: number;
  status: 'pending' | 'failed';
  errorMessage?: string;
  attempts: number;
  /** ID local généré par handleOfflineRequest pour une création (POST) —
   *  sert à réécrire les opérations suivantes de la file qui y font
   *  référence (ex: une dette liée à une commande créée hors-ligne) une
   *  fois que le serveur a attribué le véritable ID. */
  localId?: string;
  /** Même clé que la tentative en ligne d'origine (voir generateIdempotencyKey) —
   *  rejouée telle quelle pour que le serveur reconnaisse un doublon si la
   *  requête d'origine avait en réalité déjà été traitée. */
  idempotencyKey?: string;
}

function readSyncQueue(): QueuedOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeSyncQueue(queue: QueuedOperation[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Quota localStorage dépassé ou navigateur privé restrictif : la file
    // en mémoire reste valide pour cette session, seule la persistance
    // entre rechargements est perdue.
  }
  window.dispatchEvent(new CustomEvent('boutikflow:queue-changed', {
    detail: {
      pending: queue.filter(q => q.status === 'pending').length,
      failed: queue.filter(q => q.status === 'failed').length,
    },
  }));
}

function enqueueOperation(method: string, path: string, body: string | undefined, localId?: string, idempotencyKey?: string) {
  if (method === 'GET' || typeof window === 'undefined') return;
  const queue = readSyncQueue();
  queue.push({
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method,
    path,
    body,
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
    localId,
    idempotencyKey,
  });
  writeSyncQueue(queue);
}

/** Remplace toute occurrence de `localId` par `realId` dans le chemin et le
 *  corps des opérations encore en attente — pour qu'une opération qui
 *  référence une entité créée hors-ligne (ex: dette → commande) cible bien
 *  la ressource réelle une fois que celle-ci existe côté serveur. */
function reconcileQueueIds(localId: string, realId: string) {
  const queue = readSyncQueue();
  let changed = false;
  for (const op of queue) {
    if (op.path.includes(localId)) {
      op.path = op.path.split(localId).join(realId);
      changed = true;
    }
    if (op.body && op.body.includes(localId)) {
      op.body = op.body.split(localId).join(realId);
      changed = true;
    }
  }
  if (changed) writeSyncQueue(queue);
}

export function getSyncQueueStatus() {
  const queue = readSyncQueue();
  return {
    pendingCount: queue.filter(q => q.status === 'pending').length,
    failed: queue.filter(q => q.status === 'failed'),
  };
}

/** Remet une opération en échec dans la file, pour qu'elle soit rejouée au
 *  prochain sync (déclenché manuellement par l'utilisateur depuis l'UI). */
export function retryFailedOperation(id: string) {
  const queue = readSyncQueue();
  const op = queue.find(q => q.id === id);
  if (op) { op.status = 'pending'; op.errorMessage = undefined; }
  writeSyncQueue(queue);
}

/** Abandonne définitivement une opération en échec (ex: vente devenue
 *  invalide car le stock a été épuisé entre-temps sur un autre appareil). */
export function discardFailedOperation(id: string) {
  writeSyncQueue(readSyncQueue().filter(q => q.id !== id));
}

let isSyncingQueue = false;

/**
 * Rejoue la file d'attente contre le vrai serveur, dans l'ordre de création,
 * SÉQUENTIELLEMENT (jamais en parallèle) : une opération peut dépendre
 * d'une opération précédente pas encore confirmée par le serveur (ex: un
 * paiement de dette suppose que la commande liée existe déjà côté serveur).
 */
export async function syncOfflineQueue(): Promise<{ succeeded: number; failed: number }> {
  if (typeof window === 'undefined' || !window.navigator.onLine) return { succeeded: 0, failed: 0 };
  if (isSyncingQueue) return { succeeded: 0, failed: 0 };

  const pending = readSyncQueue().filter(q => q.status === 'pending').sort((a, b) => a.createdAt - b.createdAt);
  if (pending.length === 0) return { succeeded: 0, failed: 0 };

  isSyncingQueue = true;
  window.dispatchEvent(new CustomEvent('boutikflow:sync-start', { detail: { count: pending.length } }));

  let succeeded = 0;
  let failed = 0;
  let stoppedEarly = false;

  for (const op of pending) {
    try {
      const token = getAccessToken();
      const headers = new Headers();
      if (op.body) headers.set('Content-Type', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      // Même clé que la tentative d'origine : si celle-ci avait en réalité
      // déjà atteint le serveur (réponse perdue à cause d'une connexion
      // instable), le serveur renvoie la réponse déjà traitée au lieu de
      // recréer la ressource.
      if (op.idempotencyKey) headers.set('Idempotency-Key', op.idempotencyKey);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_BASE_URL}${op.path}`, {
        method: op.method,
        headers,
        body: op.body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        succeeded++;
        writeSyncQueue(readSyncQueue().filter(q => q.id !== op.id));

        if (op.localId) {
          const created = await res.clone().json().catch(() => null);
          if (created?.id) reconcileQueueIds(op.localId, String(created.id));
        }
      } else if (res.status >= 400 && res.status < 500) {
        // Erreur définitive (validation, stock insuffisant, conflit...) :
        // insister indéfiniment ne changerait rien. On marque l'opération
        // en échec, on la garde VISIBLE pour que le commerçant la traite,
        // et on continue avec la suite de la file plutôt que de tout
        // bloquer derrière une seule vente problématique.
        const body = await res.json().catch(() => null);
        const message = body?.detail
          ? (Array.isArray(body.detail) ? body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ') : body.detail)
          : `Erreur ${res.status}`;
        failed++;
        const queue = readSyncQueue();
        const item = queue.find(q => q.id === op.id);
        if (item) { item.status = 'failed'; item.errorMessage = message; item.attempts += 1; }
        writeSyncQueue(queue);
      } else {
        // Erreur serveur (5xx) : transitoire, on retentera au prochain
        // retour de connexion plutôt que d'abandonner l'opération.
        stoppedEarly = true;
        break;
      }
    } catch {
      // Le réseau a coupé pendant la synchronisation elle-même : on
      // s'arrête net, la file reprendra au prochain événement "online".
      stoppedEarly = true;
      break;
    }
  }

  isSyncingQueue = false;

  // Les indicateurs (Tableau de bord, Finances, marge produits...) sont
  // TOUJOURS calculés côté serveur (voir app.core.metrics) : re-télécharger
  // les données après synchronisation EST le recalcul, il n'y a rien à
  // reconstruire côté client.
  if (succeeded > 0) {
    await Promise.allSettled([
      request('/products?page=1&per_page=200').catch(() => null),
      request('/clients?page=1&per_page=200').catch(() => null),
      request('/finance?page=1&per_page=200').catch(() => null),
      request('/orders?page=1&per_page=200').catch(() => null),
    ]);
  }

  window.dispatchEvent(new CustomEvent('boutikflow:sync-complete', {
    detail: { succeeded, failed, stoppedEarly },
  }));
  return { succeeded, failed };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { syncOfflineQueue(); });
  // Cas de l'onglet rouvert déjà en ligne alors qu'une file s'était
  // constituée pendant une session précédente hors-ligne : l'événement
  // "online" ne se redéclenche pas dans ce cas, il faut vérifier au chargement.
  if (window.navigator.onLine) {
    setTimeout(() => { syncOfflineQueue(); }, 1500);
  }
}

function handleOfflineRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  if (path.startsWith('/products')) {
    const products = OfflineDB.getProducts();
    if (method === 'GET') {
      return Promise.resolve({
        items: products,
        total: products.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T);
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newProduct = {
        id: uuid(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stock: Number(data.stock) || 0,
        price: Number(data.price) || 0,
        ...data
      };
      products.push(newProduct);
      OfflineDB.saveProducts(products);
      return Promise.resolve(newProduct as any as T);
    }
  }

  if (path.startsWith('/clients')) {
    const clients = OfflineDB.getClients();
    if (method === 'GET') {
      return Promise.resolve({
        items: clients,
        total: clients.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T);
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newClient = {
        id: uuid(),
        created_at: new Date().toISOString(),
        ...data
      };
      clients.push(newClient);
      OfflineDB.saveClients(clients);
      return Promise.resolve(newClient as any as T);
    }
  }

  if (path.startsWith('/orders')) {
    const orders = OfflineDB.getOrders();
    if (method === 'GET') {
      return Promise.resolve({
        items: orders,
        total: orders.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T);
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const items = data.items || [];
      
      const products = OfflineDB.getProducts();
      let orderTotal = 0;
      items.forEach((item: any) => {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          orderTotal += prod.price * item.quantity;
          prod.stock = Math.max(0, prod.stock - item.quantity);
        }
      });
      OfflineDB.saveProducts(products);

      const newOrder = {
        id: uuid(),
        status: data.status || 'delivered',
        items,
        total: orderTotal,
        notes: data.notes || '',
        client_id: data.client_id || null,
        created_at: new Date().toISOString(),
      };
      orders.unshift(newOrder);
      OfflineDB.saveOrders(orders);

      return Promise.resolve(newOrder as any as T);
    }
  }

  if (path.startsWith('/crm/debts')) {
    const debts = OfflineDB.getDebts();
    if (method === 'GET') {
      return Promise.resolve(debts as any as T);
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newDebt = {
        id: uuid(),
        client_id: data.client_id,
        order_id: data.order_id || null,
        original_amount: Number(data.original_amount),
        remaining_amount: Number(data.original_amount),
        description: data.description || 'Achat à crédit',
        due_date: data.due_date || null,
        status: 'unpaid',
        created_at: new Date().toISOString(),
      };
      debts.unshift(newDebt);
      OfflineDB.saveDebts(debts);
      return Promise.resolve(newDebt as any as T);
    }
    if (method === 'POST' && path.includes('/pay')) {
      const parts = path.split('/');
      const debtId = parts[3];
      const data = JSON.parse(options.body as string);
      const amountPaid = Number(data.amount);
      
      const debt = debts.find(d => d.id === debtId);
      if (debt) {
        debt.remaining_amount = Math.max(0, debt.remaining_amount - amountPaid);
        if (debt.remaining_amount <= 0) {
          debt.status = 'paid';
        }
        OfflineDB.saveDebts(debts);

        // Record a paid debt as an INCOME transaction in finance
        const transactions = OfflineDB.getTransactions();
        const clients = OfflineDB.getClients();
        const clientName = clients.find(c => c.id === debt.client_id)?.name || 'Client';
        
        const newTx = {
          id: uuid(),
          type: 'income',
          category: 'sale',
          amount: amountPaid,
          description: `Paiement dette client — ${clientName} (${debt.description})`,
          payment_method: data.payment_method || 'cash',
          reference: debt.id,
          created_at: new Date().toISOString(),
        };
        transactions.unshift(newTx);
        OfflineDB.saveTransactions(transactions);

        return Promise.resolve({
          message: 'Paiement de dette enregistré',
          remaining_amount: debt.remaining_amount,
          status: debt.status
        } as any as T);
      }
    }
  }

  if (path.startsWith('/finance')) {
    const urlObj = new URL(path, 'http://localhost');
    const startDate = urlObj.searchParams.get('start_date');
    const endDate = urlObj.searchParams.get('end_date');
    const type = urlObj.searchParams.get('type');

    let transactions = OfflineDB.getTransactions();
    if (startDate || endDate) {
      const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
      const endMs = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : Infinity;
      transactions = transactions.filter(t => {
        const tMs = new Date(t.created_at || 0).getTime();
        return tMs >= startMs && tMs <= endMs;
      });
    }
    if (type && type !== 'all') {
      transactions = transactions.filter(t => t.type === type);
    }
    if (method === 'GET') {
      const total_income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const total_expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const summary = {
        total_income,
        total_expense,
        net_balance: total_income - total_expense,
        transactions_count: transactions.length
      };
      return Promise.resolve({
        items: transactions,
        total: transactions.length,
        page: 1,
        per_page: 50,
        pages: 1,
        summary
      } as any as T);
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newTx = {
        id: uuid(),
        type: data.type,
        category: data.category,
        amount: Number(data.amount),
        description: data.description,
        payment_method: data.payment_method,
        reference: data.reference || null,
        created_at: new Date().toISOString(),
      };
      transactions.unshift(newTx);
      OfflineDB.saveTransactions(transactions);
      return Promise.resolve(newTx as any as T);
    }
  }

  if (path.startsWith('/dashboard/kpis')) {
    const urlObj = new URL(path, 'http://localhost');
    const startDate = urlObj.searchParams.get('start_date');
    const endDate = urlObj.searchParams.get('end_date');

    let transactions = OfflineDB.getTransactions();
    let orders = OfflineDB.getOrders();
    const clients = OfflineDB.getClients();

    if (startDate || endDate) {
      const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
      const endMs = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : Infinity;
      transactions = transactions.filter(t => {
        const tMs = new Date(t.created_at || 0).getTime();
        return tMs >= startMs && tMs <= endMs;
      });
      orders = orders.filter(o => {
        const oMs = new Date(o.created_at || 0).getTime();
        return oMs >= startMs && oMs <= endMs;
      });
    }

    const total_revenue = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const total_expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net_balance = total_revenue - total_expenses;
    const pending_orders = orders.filter(o => o.status === 'pending').length;

    return Promise.resolve({
      total_revenue,
      total_expenses,
      net_balance,
      total_orders: orders.length,
      total_clients: clients.length,
      pending_orders
    } as any as T);
  }

  if (path.startsWith('/dashboard/analytics')) {
    const urlObj = new URL(path, 'http://localhost');
    const startDate = urlObj.searchParams.get('start_date');
    const endDate = urlObj.searchParams.get('end_date');

    let transactions = OfflineDB.getTransactions();
    if (startDate || endDate) {
      const startMs = startDate ? new Date(startDate + 'T00:00:00').getTime() : 0;
      const endMs = endDate ? new Date(endDate + 'T23:59:59.999').getTime() : Infinity;
      transactions = transactions.filter(t => {
        const tMs = new Date(t.created_at || 0).getTime();
        return tMs >= startMs && tMs <= endMs;
      });
    }

    // Le graphique couvre la même fenêtre que les KPI (mode hors ligne) :
    // sans cela, la sélection de période n'affichait toujours que 7 jours.
    const rangeEnd = endDate ? new Date(endDate + 'T00:00:00') : new Date();
    const rangeStart = startDate ? new Date(startDate + 'T00:00:00') : new Date(rangeEnd.getTime() - 6 * 86400000);
    const dayCount = Math.max(1, Math.min(90, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1));

    const revenue_data = [] as any[];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(rangeStart.getTime() + i * 86400000);
      const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      const dateKey = d.toISOString().split('T')[0];

      const dayTotal = transactions
        .filter(t => t.type === 'income' && t.created_at.startsWith(dateKey))
        .reduce((sum, t) => sum + t.amount, 0);

      revenue_data.push({ name: dateStr, value: dayTotal });
    }
    return Promise.resolve({ revenue_data } as any as T);
  }

  if (path.startsWith('/categories')) {
    const categories = OfflineDB.getCategories();
    if (method === 'GET') {
      return Promise.resolve({
        items: categories,
        total: categories.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T);
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newCat = {
        id: uuid(),
        created_at: new Date().toISOString(),
        slug: (data.name || '').toLowerCase().replace(/\s+/g, '-'),
        ...data
      };
      categories.push(newCat);
      OfflineDB.saveCategories(categories);
      return Promise.resolve(newCat as any as T);
    }
    if (method === 'PUT') {
      const catId = path.split('/')[2];
      const data = JSON.parse(options.body as string);
      const cat = categories.find(c => c.id === catId);
      if (cat) {
        Object.assign(cat, data);
        OfflineDB.saveCategories(categories);
        return Promise.resolve(cat as any as T);
      }
    }
    if (method === 'DELETE') {
      const catId = path.split('/')[2];
      const idx = categories.findIndex(c => c.id === catId);
      if (idx >= 0) {
        categories.splice(idx, 1);
        OfflineDB.saveCategories(categories);
        return Promise.resolve(undefined as any as T);
      }
    }
  }

  if (path.startsWith('/suppliers')) {
    if (method === 'GET') {
      return Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        per_page: 200,
        pages: 0
      } as any as T);
    }
  }

  if (path.startsWith('/auth/team')) {
    if (method === 'GET') {
      return Promise.resolve([] as any as T);
    }
  }

  if (path.startsWith('/audit')) {
    if (method === 'GET') {
      return Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        per_page: 50,
        pages: 0
      } as any as T);
    }
  }

  if (path.startsWith('/segments') || path.startsWith('/crm/segments')) {
    if (method === 'GET') {
      return Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        per_page: 50,
        pages: 0
      } as any as T);
    }
  }

  // ── Catch-all : retourner des données vides au lieu d'une erreur ──
  // Un commerçant ne doit JAMAIS voir "Erreur de chargement" hors-ligne.
  console.warn('[Offline] Route non mappée:', path, '→ retour données vides');
  if (method === 'GET') {
    return Promise.resolve({
      items: [],
      total: 0,
      page: 1,
      per_page: 50,
      pages: 0
    } as any as T);
  }
  return Promise.resolve({} as any as T);
}

function extractHeader(headers: HeadersInit | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) || undefined;
  if (Array.isArray(headers)) return headers.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  return (headers as Record<string, string>)[name];
}

/**
 * Simule la réponse hors-ligne ET, pour toute écriture, l'enregistre dans
 * la file de synchronisation pour un rejeu ultérieur contre le vrai
 * serveur — le simple fallback local ne suffit pas à garantir qu'une vente
 * hors-ligne finisse un jour par exister côté serveur.
 */
async function handleOfflineRequestAndQueue<T>(path: string, options: RequestInit): Promise<T> {
  const result = await handleOfflineRequest<T>(path, options);
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    const localId = (result as { id?: string } | null)?.id;
    const idempotencyKey = extractHeader(options.headers, 'Idempotency-Key');
    enqueueOperation(method, path, options.body as string | undefined, localId, idempotencyKey);
  }
  return result;
}

// ─── Helper requête générique ───────────────────────────────────────────────
//
// navigator.onLine ne reflète que l'état de la carte réseau (WiFi/données
// connecté ou non) — PAS la capacité réelle à joindre le serveur. Sur une
// connexion instable (signal faible, portail captif, congestion), il reste
// à `true` alors que chaque requête échoue en pratique : sans adaptation,
// l'utilisateur attendrait le plein timeout (pensé pour tolérer un cold
// start Render) à CHAQUE action, ce qui se ressent comme une app figée.
// consecutiveNetworkFailures raccourcit ce délai dès le deuxième échec
// d'affilée, et revient au délai généreux dès qu'une requête aboutit.
let consecutiveNetworkFailures = 0;

function currentTimeoutMs(): number {
  return consecutiveNetworkFailures > 0 ? 3500 : 8000;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    return handleOfflineRequestAndQueue<T>(path, options);
  }

  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), currentTimeoutMs());
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    // La requête a abouti (quel que soit le status) : le réseau fonctionne,
    // on redonne sa chance au délai généreux pour la prochaine tentative.
    consecutiveNetworkFailures = 0;

    // Pour TOUT GET échouant (offline, timeout, 5xx, 404, 422) → fallback offline immédiat
    if (method === 'GET' && !res.ok) {
      return handleOfflineRequestAndQueue<T>(path, options);
    }
  } catch {
    // fetch a levé (réseau coupé en cours de requête, timeout...) : une
    // écriture ici doit aussi rejoindre la file de synchronisation, pas
    // seulement recevoir une réponse simulée.
    consecutiveNetworkFailures++;
    return handleOfflineRequestAndQueue<T>(path, options);
  }

  if (res.ok) {
    try {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const bodyClone = await res.clone().json().catch(() => null);
        if (bodyClone) {
          if (path.startsWith('/products') && method === 'GET') {
            const items = Array.isArray(bodyClone) ? bodyClone : bodyClone.items;
            if (items) OfflineDB.saveProducts(items);
          } else if (path.startsWith('/clients') && method === 'GET') {
            const items = Array.isArray(bodyClone) ? bodyClone : bodyClone.items;
            if (items) OfflineDB.saveClients(items);
          } else if (path.startsWith('/finance') && method === 'GET') {
            const items = Array.isArray(bodyClone) ? bodyClone : bodyClone.items;
            if (items) OfflineDB.saveTransactions(items);
          } else if (path.startsWith('/orders') && method === 'GET') {
            // Important après une synchronisation réussie : remplace les
            // commandes à identifiant local fabriqué par les vraies
            // commandes serveur, pour qu'une future coupure de connexion
            // reparte d'un cache exact plutôt que de doublons obsolètes.
            const items = Array.isArray(bodyClone) ? bodyClone : bodyClone.items;
            if (items) OfflineDB.saveOrders(items);
          }
        }
      }
    } catch (e) {
      console.warn('Offline caching error', e);
    }
  }

  // Tentative de rafraîchissement automatique en cas de 401
  if (res.status === 401) {
    if (allowRetry && getRefreshToken()) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return request<T>(path, options, false);
      }
    }
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && path !== '/auth/login') {
      window.location.href = '/login?expired=true';
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ')
      : detail || res.statusText || 'Une erreur est survenue';
    throw new ApiError(message, res.status);
  }

  return body as T;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function withPages<T>(raw: { items: T[]; total: number; page: number; per_page: number }) {
  return { ...raw, pages: raw.per_page > 0 ? Math.ceil(raw.total / raw.per_page) : 0 };
}

// ─── Types locaux (non couverts par src/types/index.ts) ────────────────────

interface UserInfo {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserInfo;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  created_at: string;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  expires_at: string | null;
}

interface CheckoutPayload {
  plan_id: string;
  phone_number: string;
}

interface CheckoutResult {
  transaction_id: string;
  status: string;
  message: string;
}

type ProductUpdate = Partial<ProductCreate>;

interface OrderStatusUpdatePayload {
  status: OrderStatus;
  note?: string;
}

interface WhatsAppChat {
  id: string;
  client: string;
  lastMessage: string;
  time: string;
  unread: number;
  aiSuggestion: string | null;
}

interface WhatsAppSendPayload {
  to: string;
  message: string;
}

interface AISuggestReplyPayload {
  message: string;
  context?: string;
}

interface AISuggestReplyResult {
  suggestion: string;
}

// ─── Client API ─────────────────────────────────────────────────────────────

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setTokens(res.access_token, res.refresh_token);
    return res;
  },

  async register(data: RegisterRequest): Promise<{ message: string; boutique_slug: string; status: string }> {
    return request<{ message: string; boutique_slug: string; status: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout(): void {
    clearTokens();
  },

  getMe(): Promise<UserInfo> {
    return request('/auth/me');
  },

  updateMe(data: { full_name?: string; email?: string; phone?: string }): Promise<UserInfo> {
    return request('/auth/me', { method: 'PUT', body: JSON.stringify(data) });
  },

  changeMyPassword(data: { current_password: string; new_password: string }): Promise<{ message: string }> {
    return request('/auth/me/password', { method: 'PUT', body: JSON.stringify(data) });
  },

  updateTenant(data: { name: string }): Promise<TenantInfo> {
    return request('/auth/tenant', { method: 'PUT', body: JSON.stringify(data) });
  },

  forgotPassword(data: { boutique_slug: string; email: string }): Promise<{ message: string }> {
    return request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) });
  },

  resetPassword(data: { token: string; new_password: string }): Promise<{ message: string }> {
    return request('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) });
  },

  getTenant(): Promise<TenantInfo> {
    return request('/auth/tenant');
  },

  // ── Dashboard ─────────────────────────────────────────────────────────
  getDashboardKPIs(period?: string, startDate?: string, endDate?: string): Promise<DashboardKPIs> {
    return request(`/dashboard/kpis${buildQuery({ period, start_date: startDate, end_date: endDate })}`);
  },

  getAnalyticsData(period: string = '7j', startDate?: string, endDate?: string): Promise<AnalyticsData> {
    return request(`/dashboard/analytics${buildQuery({ period, start_date: startDate, end_date: endDate })}`);
  },

  // ── CRM — Clients ─────────────────────────────────────────────────────
  async getClients(page = 1, perPage = 20, search?: string, status?: ClientStatus) {
    const raw = await request<{ items: CrmClient[]; total: number; page: number; per_page: number }>(
      `/clients${buildQuery({ page, per_page: perPage, search, status })}`
    );
    return withPages(raw);
  },

  getClient(id: string): Promise<CrmClient> {
    return request(`/clients/${id}`);
  },

  createClient(data: ClientCreate): Promise<CrmClient> {
    return request('/clients', { method: 'POST', body: JSON.stringify(data) });
  },

  updateClient(id: string, data: ClientUpdate): Promise<CrmClient> {
    return request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteClient(id: string): Promise<void> {
    return request(`/clients/${id}`, { method: 'DELETE' });
  },

  // ── CRM — Debts ───────────────────────────────────────────────────────
  async createDebt(data: { client_id: string; order_id?: string; original_amount: number; description?: string; due_date?: string }): Promise<{ id: string; message: string; remaining_amount: number }> {
    return request('/crm/debts', { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },
  async getDebts(clientId?: string, statusFilter?: string): Promise<ClientDebt[]> {
    const params = new URLSearchParams();
    if (clientId) params.set('client_id', clientId);
    if (statusFilter) params.set('status_filter', statusFilter);
    return request(`/crm/debts?${params.toString()}`);
  },
  async recordDebtPayment(debtId: string, data: { amount: number; payment_method: string; notes?: string }): Promise<{ message: string; remaining_amount: number; status: string }> {
    return request(`/crm/debts/${debtId}/pay`, { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  // ── CRM — Segments ────────────────────────────────────────────────────
  async getSegments(page = 1, perPage = 20) {
    const raw = await request<{ items: Segment[]; total: number; page: number; per_page: number }>(
      `/clients/segments${buildQuery({ page, per_page: perPage })}`
    );
    return withPages(raw);
  },

  createSegment(data: SegmentCreate): Promise<Segment> {
    return request('/clients/segments', { method: 'POST', body: JSON.stringify(data) });
  },

  updateSegment(id: string, data: SegmentUpdate): Promise<Segment> {
    return request(`/clients/segments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteSegment(id: string): Promise<void> {
    return request(`/clients/segments/${id}`, { method: 'DELETE' });
  },

  // ── Catalogue — Catégories ────────────────────────────────────────────
  async getCategories(page = 1, perPage = 20) {
    const raw = await request<{ items: Category[]; total: number; page: number; per_page: number }>(
      `/products/categories${buildQuery({ page, per_page: perPage })}`
    );
    return withPages(raw);
  },

  createCategory(data: CategoryCreate): Promise<Category> {
    return request('/products/categories', { method: 'POST', body: JSON.stringify(data) });
  },

  updateCategory(id: string, data: CategoryUpdate): Promise<Category> {
    return request(`/products/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteCategory(id: string): Promise<void> {
    return request(`/products/categories/${id}`, { method: 'DELETE' });
  },

  // ── Catalogue — Produits ──────────────────────────────────────────────
  async getProducts(page = 1, perPage = 20, search?: string, categoryId?: string, inStock?: boolean) {
    const raw = await request<{ items: Product[]; total: number; page: number; per_page: number }>(
      `/products${buildQuery({
        page,
        per_page: perPage,
        search,
        category_id: categoryId,
        in_stock: inStock,
      })}`
    );
    return withPages(raw);
  },

  getProduct(id: string): Promise<Product> {
    return request(`/products/${id}`);
  },

  createProduct(data: ProductCreate): Promise<Product> {
    return request('/products', { method: 'POST', body: JSON.stringify(data) });
  },

  createProductsBulk(products: ProductCreate[]): Promise<{ created: Product[]; errors: { index: number; name: string; error: string }[] }> {
    return request('/products/bulk', { method: 'POST', body: JSON.stringify({ products }) });
  },

  updateProduct(id: string, data: ProductUpdate): Promise<Product> {
    return request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteProduct(id: string): Promise<void> {
    return request(`/products/${id}`, { method: 'DELETE' });
  },

  // ── Commandes ─────────────────────────────────────────────────────────
  async getOrders(page = 1, status?: OrderStatus, perPage = 100, clientId?: string) {
    const raw = await request<{ items: Order[]; total: number; page: number; per_page: number }>(
      `/orders${buildQuery({ page, per_page: perPage, status, client_id: clientId })}`
    );
    return withPages(raw);
  },

  getOrder(id: string): Promise<Order> {
    return request(`/orders/${id}`);
  },

  createOrder(data: OrderCreate): Promise<Order> {
    return request('/orders', { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  updateOrderStatus(orderId: string, status: OrderStatus | string, note?: string): Promise<Order> {
    const payload: OrderStatusUpdatePayload = { status: status as OrderStatus, note };
    return request(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  returnOrderItems(orderId: string, items: { product_id: string; quantity: number }[], reason: string, restockInventory = true): Promise<any> {
    return request(`/orders/${orderId}/return`, {
      method: 'POST',
      body: JSON.stringify({ items, reason, restock_inventory: restockInventory }),
    });
  },

  // ── Billing ───────────────────────────────────────────────────────────
  getSubscription(): Promise<SubscriptionInfo> {
    return request('/billing/subscription');
  },

  checkout(data: CheckoutPayload): Promise<CheckoutResult> {
    return request('/billing/checkout', { method: 'POST', body: JSON.stringify(data) });
  },

  // ── Marketing — Campagnes ─────────────────────────────────────────────
  async getCampaigns(page = 1, perPage = 20) {
    const raw = await request<{ items: Campaign[]; total: number; page: number; per_page: number }>(
      `/campaigns${buildQuery({ page, per_page: perPage })}`
    );
    return withPages(raw);
  },

  createCampaign(data: CampaignCreate): Promise<Campaign> {
    return request('/campaigns', { method: 'POST', body: JSON.stringify(data) });
  },

  updateCampaign(id: string, data: CampaignUpdate): Promise<Campaign> {
    return request(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteCampaign(id: string): Promise<void> {
    return request(`/campaigns/${id}`, { method: 'DELETE' });
  },

  // ── WhatsApp ──────────────────────────────────────────────────────────
  getWhatsAppChats(): Promise<WhatsAppChat[]> {
    return request('/whatsapp/chats');
  },

  sendWhatsAppMessage(data: WhatsAppSendPayload): Promise<{ status: string; message_id: string }> {
    return request('/whatsapp/send', { method: 'POST', body: JSON.stringify(data) });
  },

  suggestReply(data: AISuggestReplyPayload): Promise<AISuggestReplyResult> {
    return request('/ai/suggest-reply', { method: 'POST', body: JSON.stringify(data) });
  },

  analyzeProductImage(imageData: string): Promise<{
    name?: string;
    category?: string;
    description?: string;
    brand?: string;
    attributes?: Record<string, any>;
  }> {
    return request('/ai/analyze-product-image', {
      method: 'POST',
      body: JSON.stringify({ image_data: imageData }),
    });
  },

  // ── Admin — Stats ──────────────────────────────────────────────────────
  getAdminStats(): Promise<AdminStats> {
    return request('/admin/stats');
  },

  // ── Admin — Tenants (boutiques) ────────────────────────────────────────
  async getAdminTenants(
    page = 1,
    perPage = 20,
    search?: string,
    status?: TenantStatus,
    plan?: TenantPlan,
  ): Promise<PaginatedAdminTenants> {
    return request(
      `/admin/tenants${buildQuery({ page, per_page: perPage, search, status, plan })}`
    );
  },

  getAdminTenant(id: string): Promise<AdminTenantDetail> {
    return request(`/admin/tenants/${id}`);
  },

  updateTenantStatus(
    id: string,
    data: { status: TenantStatus; note?: string }
  ): Promise<AdminTenantDetail> {
    return request(`/admin/tenants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  updateTenantPlan(id: string, plan: TenantPlan): Promise<AdminTenantDetail> {
    return request(`/admin/tenants/${id}/plan`, {
      method: 'PATCH',
      body: JSON.stringify({ plan }),
    });
  },

  deleteAdminTenant(id: string): Promise<void> {
    return request(`/admin/tenants/${id}`, { method: 'DELETE' });
  },

  // ── Admin — Notifications ──────────────────────────────────────────────
  getAdminNotifications(unreadOnly = false): Promise<AdminNotification[]> {
    return request(`/admin/notifications${buildQuery({ unread_only: unreadOnly })}`);
  },

  markNotificationRead(id: string): Promise<void> {
    return request(`/admin/notifications/${id}/read`, { method: 'PATCH' });
  },

  // ─── Suppliers ────────────────────────────────────────────────────────
  getSuppliers: (page = 1, perPage = 50, search?: string) =>
    request<{ items: Supplier[]; total: number; page: number; per_page: number }>(
      `/suppliers?page=${page}&per_page=${perPage}${search ? `&search=${encodeURIComponent(search)}` : ''}`
    ),
  getSupplier: (id: string) => request<Supplier>(`/suppliers/${id}`),
  createSupplier: (data: SupplierCreate) => request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: SupplierUpdate) => request<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => request<void>(`/suppliers/${id}`, { method: 'DELETE' }),

  // ─── Team Management ─────────────────────────────────────────────────
  getTeamMembers: () => request<TeamMember[]>('/auth/team'),
  inviteTeamMember: (data: InviteUserRequest) => request<TeamMember>('/auth/team/invite', { method: 'POST', body: JSON.stringify(data) }),
  changeTeamMemberPassword: async (userId: string, newPassword: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/auth/team/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ new_password: newPassword }),
    });
  },
  updateTeamMemberRole: (userId: string, role: string) => request<TeamMember>(`/auth/team/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateTeamMemberStatus: (userId: string, isActive: boolean) => request<TeamMember>(`/auth/team/${userId}/status`, { method: 'PUT', body: JSON.stringify({ is_active: isActive }) }),
  deleteTeamMember: (userId: string) => request<void>(`/auth/team/${userId}`, { method: 'DELETE' }),

  // ─── Audit Log ────────────────────────────────────────────────────────
  async getAuditLogs(page = 1, perPage = 50, action?: string, userEmail?: string) {
    const raw = await request<{ items: AuditLog[]; total: number; page: number; per_page: number }>(
      `/audit${buildQuery({ page, per_page: perPage, action, user_email: userEmail })}`
    );
    return withPages(raw);
  },

  // ─── Finance & Trésorerie ────────────────────────────────────────────
  async getFinanceTransactions(
    page = 1,
    perPage = 50,
    type?: string,
    category?: string,
    period?: string,
    startDate?: string,
    endDate?: string
  ): Promise<TransactionListResponse> {
    const raw = await request<{
      items: FinancialTransaction[];
      total: number;
      page: number;
      per_page: number;
      summary: FinanceSummary;
    }>(`/finance${buildQuery({ page, per_page: perPage, type, category, period, start_date: startDate, end_date: endDate })}`);
    return {
      ...withPages(raw),
      summary: raw.summary,
    };
  },

  createFinanceTransaction(data: TransactionCreatePayload): Promise<FinancialTransaction> {
    return request('/finance', { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },
};

export type { CampaignChannel };
