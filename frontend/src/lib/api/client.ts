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
import { OfflineDB, OfflineQueue, SyncJournal, describeOperation, clearOfflineDatabase, type QueuedOp } from '@/lib/offlineDb';

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

/** Identité de l'utilisateur courant décodée depuis le JWT — utilisée pour
 *  que l'aperçu local d'une vente créée hors-ligne (avant toute synchronisation)
 *  affiche déjà le bon vendeur, au lieu d'attendre le retour du serveur. */
function getCurrentUserFromToken(): { id: string; email: string; displayName: string } | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const email = payload.email || payload.sub || '';
    const namePart = email.includes('@') ? email.split('@')[0] : email;
    const displayName = namePart ? namePart.charAt(0).toUpperCase() + namePart.slice(1) : '';
    return { id: payload.sub || '', email, displayName };
  } catch {
    return null;
  }
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

// ─── Catégories par défaut (première utilisation, hors-ligne) ──────────────
// (UUID v4 fixes — jamais de chaînes courtes type 'p1', rejetées par le
// backend FastAPI avec "Input should be a valid UUID")

const DEFAULT_CATEGORIES = [
  { id: 'cccc0001-0000-4000-a000-000000000001', name: 'Vêtements',    slug: 'vetements',    created_at: new Date().toISOString() },
  { id: 'cccc0002-0000-4000-a000-000000000002', name: 'Chaussures',   slug: 'chaussures',   created_at: new Date().toISOString() },
  { id: 'cccc0003-0000-4000-a000-000000000003', name: 'Cosmétiques',  slug: 'cosmetiques',  created_at: new Date().toISOString() },
  { id: 'cccc0004-0000-4000-a000-000000000004', name: 'Électronique', slug: 'electronique', created_at: new Date().toISOString() },
];

async function ensureSeedCategories(): Promise<any[]> {
  const existing = await OfflineDB.getCategories();
  if (existing.length > 0) return existing;
  await OfflineDB.saveCategories(DEFAULT_CATEGORIES);
  return DEFAULT_CATEGORIES;
}

// ─── File d'attente de synchronisation hors-ligne ──────────────────────────
//
// Chaque écriture tentée hors connexion (vente, produit, client, dette...)
// est enregistrée ici — sur IndexedDB, PAS localStorage (voir lib/offlineDb
// pour le pourquoi : une file de plusieurs dizaines d'opérations, certaines
// avec une photo produit en base64, peut largement dépasser le quota
// localStorage, laissant des ventes silencieusement non synchronisées).
// La file est rejouée séquentiellement, dans l'ordre de création, dès que
// la connexion revient — avec backoff exponentiel par opération pour ne
// pas marteler le serveur sur une connexion qui reste instable.

function dispatchQueueChanged(pending: number, failed: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('boutikflow:queue-changed', { detail: { pending, failed } }));
}

async function notifyQueueChanged() {
  const all = await OfflineQueue.getAll();
  dispatchQueueChanged(
    all.filter(q => q.status === 'pending').length,
    all.filter(q => q.status === 'failed').length,
  );
}

async function enqueueOperation(method: string, path: string, body: string | undefined, localId?: string, idempotencyKey?: string) {
  if (method === 'GET' || typeof window === 'undefined') return;
  const op: QueuedOp = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method,
    path,
    body,
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
    localId,
    idempotencyKey,
  };
  await OfflineQueue.put(op);
  await SyncJournal.append({
    opId: op.id,
    method,
    path,
    description: describeOperation(method, path),
    status: 'pending',
    createdAt: op.createdAt,
  });
  await notifyQueueChanged();
}

export async function getSyncQueueStatus() {
  const all = await OfflineQueue.getAll();
  return {
    pendingCount: all.filter(q => q.status === 'pending').length,
    failed: all.filter(q => q.status === 'failed'),
    lastSyncAt: await OfflineDB.getLastSyncAt(),
  };
}

/** Historique complet des opérations de synchronisation (jusqu'à 500 plus
 *  récentes), y compris déjà confirmées — outil de diagnostic pour une
 *  vente/action signalée comme manquante. */
export async function getSyncJournal() {
  return SyncJournal.getAll();
}

/** Remet une opération en échec dans la file, pour qu'elle soit rejouée au
 *  prochain sync (déclenché manuellement par l'utilisateur depuis l'UI). */
export async function retryFailedOperation(id: string) {
  const all = await OfflineQueue.getAll();
  const op = all.find(q => q.id === id);
  if (op) {
    op.status = 'pending';
    op.errorMessage = undefined;
    op.nextAttemptAt = undefined;
    await OfflineQueue.put(op);
    await SyncJournal.updateStatus(op.id, 'pending');
  }
  await notifyQueueChanged();
}

/** Abandonne définitivement une opération en échec (ex: vente devenue
 *  invalide car le stock a été épuisé entre-temps sur un autre appareil). */
export async function discardFailedOperation(id: string) {
  await SyncJournal.updateStatus(id, 'error', 'Abandonnée manuellement par le commerçant');
  await OfflineQueue.remove(id);
  await notifyQueueChanged();
}

let isSyncingQueue = false;

// Backoff exponentiel par opération : 5s, 15s, 45s, 2min, 5min (plafond) —
// laisse une connexion instable respirer entre deux tentatives au lieu de
// marteler le serveur, tout en restant réactif dès qu'elle se stabilise.
const BACKOFF_STEPS_MS = [5_000, 15_000, 45_000, 120_000, 300_000];
function backoffDelay(attempts: number): number {
  return BACKOFF_STEPS_MS[Math.min(attempts, BACKOFF_STEPS_MS.length - 1)];
}

/**
 * Récupère uniquement ce qui a changé pour une collection depuis son
 * dernier curseur de synchronisation (date de la dernière ligne vue — pas
 * l'heure locale, qui peut diverger de l'horloge serveur), fusionne le
 * résultat dans IndexedDB (jamais un remplacement complet), avance le
 * curseur, et retourne le delta pour que la couche mémoire (TanStack
 * Query) puisse se mettre à jour de la même façon sans re-télécharger la
 * collection entière. Un curseur absent (première synchronisation sur cet
 * appareil) déclenche un premier appel sans filtre — son résultat reste
 * borné à per_page, la vraie mise à niveau complète du cache mémoire est
 * déjà assurée par le chargement normal des pages (useProductsQuery, etc.).
 */
async function incrementalSyncCollection(
  collection: string,
  basePath: string,
  dateField: 'updated_at' | 'created_at',
  mergeFn: (items: any[]) => Promise<void>,
): Promise<any[]> {
  const cursor = await OfflineDB.getSyncCursor(collection);
  const sep = basePath.includes('?') ? '&' : '?';
  const query = cursor
    ? `${basePath}${sep}per_page=500&updated_since=${encodeURIComponent(cursor)}`
    : `${basePath}${sep}per_page=500`;
  try {
    const res = await request<{ items: any[] }>(query);
    const items = res.items || [];
    if (items.length > 0) {
      await mergeFn(items);
      let latest = cursor;
      for (const item of items) {
        const v = item[dateField];
        if (v && (!latest || v > latest)) latest = v;
      }
      if (latest) await OfflineDB.setSyncCursor(collection, latest);
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Rejoue la file d'attente contre le vrai serveur, dans l'ordre de création,
 * SÉQUENTIELLEMENT (jamais en parallèle) : une opération peut dépendre
 * d'une opération précédente pas encore confirmée par le serveur (ex: un
 * paiement de dette suppose que la commande liée existe déjà côté serveur).
 */
export async function syncOfflineQueue(): Promise<{ succeeded: number; failed: number }> {
  if (typeof window === 'undefined' || !window.navigator.onLine) return { succeeded: 0, failed: 0 };
  if (isSyncingQueue) return { succeeded: 0, failed: 0 };

  const pending = await OfflineQueue.getPending();
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

      await SyncJournal.updateStatus(op.id, 'sent');

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
        await OfflineQueue.remove(op.id);
        await SyncJournal.updateStatus(op.id, 'confirmed');

        if (op.localId) {
          const created = await res.clone().json().catch(() => null);
          if (created?.id) await OfflineQueue.replaceMatching(op.localId, String(created.id));
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
        op.status = 'failed';
        op.errorMessage = message;
        op.attempts += 1;
        await OfflineQueue.put(op);
        await SyncJournal.updateStatus(op.id, 'error', message);
      } else {
        // Erreur serveur (5xx), transitoire : backoff sur CETTE opération
        // et on continue avec la suite de la file plutôt que de tout
        // bloquer derrière elle (les autres peuvent très bien réussir).
        op.attempts += 1;
        op.nextAttemptAt = Date.now() + backoffDelay(op.attempts);
        await OfflineQueue.put(op);
        await SyncJournal.updateStatus(op.id, 'pending', `Erreur serveur ${res.status} — nouvelle tentative programmée`);
        stoppedEarly = true;
      }
    } catch {
      // Le réseau a coupé pendant la synchronisation elle-même : backoff
      // sur cette opération, et on s'arrête net (les suivantes échoueraient
      // très probablement pour la même raison) — le battement périodique
      // plus bas reprendra la file de lui-même, sans attendre un nouvel
      // événement "online" qui ne se redéclenche pas forcément.
      op.attempts += 1;
      op.nextAttemptAt = Date.now() + backoffDelay(op.attempts);
      await OfflineQueue.put(op);
      await SyncJournal.updateStatus(op.id, 'pending', 'Connexion interrompue — nouvelle tentative programmée');
      stoppedEarly = true;
      break;
    }
  }

  isSyncingQueue = false;

  // Les indicateurs (Tableau de bord, Finances, marge produits...) sont
  // TOUJOURS calculés côté serveur (voir app.core.metrics) : re-télécharger
  // les données après synchronisation EST le recalcul, il n'y a rien à
  // reconstruire côté client.
  //
  // Synchronisation VRAIMENT incrémentale : chaque collection garde son
  // propre curseur, seule la différence depuis ce curseur est redemandée
  // au serveur — jamais toute la base. Le delta est fusionné dans
  // IndexedDB ET renvoyé dans l'événement sync-complete pour que la
  // couche mémoire (TanStack Query) se mette à jour pareillement.
  let deltas: { products: any[]; clients: any[]; orders: any[]; transactions: any[] } = {
    products: [], clients: [], orders: [], transactions: [],
  };
  if (succeeded > 0) {
    await OfflineDB.setLastSyncAt(Date.now());
    const [products, clients, transactions, orders] = await Promise.all([
      incrementalSyncCollection('products', '/products', 'updated_at', OfflineDB.mergeProducts),
      incrementalSyncCollection('clients', '/clients', 'updated_at', OfflineDB.mergeClients),
      incrementalSyncCollection('finance', '/finance?period=all', 'created_at', OfflineDB.mergeTransactions),
      incrementalSyncCollection('orders', '/orders', 'updated_at', OfflineDB.mergeOrders),
    ]);
    deltas = { products, clients, orders, transactions };
  }

  await notifyQueueChanged();
  window.dispatchEvent(new CustomEvent('boutikflow:sync-complete', {
    detail: { succeeded, failed, stoppedEarly, deltas },
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
  // navigator.onLine ne reflète que l'état de la carte réseau, pas la
  // capacité réelle à joindre le serveur — une connexion physiquement
  // active mais qui ne joint jamais le backend ne redéclenche JAMAIS
  // l'événement "online". Ce battement reprend la file dès que le backoff
  // d'une opération arrive à échéance, sans dépendre de cet événement.
  setInterval(() => {
    if (window.navigator.onLine) syncOfflineQueue();
  }, 20_000);
}

async function handleOfflineRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // Agrégats catalogue : même remarque d'ordre que les deux blocs suivants —
  // doit être vérifié avant le bloc générique `/products`. Hors-ligne, ces
  // totaux ne peuvent refléter que ce qui est déjà en cache local (aussi
  // complet que les GET/écritures déjà effectués sur cet appareil).
  if (path.startsWith('/products/stats') && method === 'GET') {
    const products = await OfflineDB.getProducts();
    const total_stock_value = products.reduce((sum: number, p: any) => sum + (p.price || 0) * (p.stock || 0), 0);
    const total_stock_units = products.reduce((sum: number, p: any) => sum + (p.stock || 0), 0);
    return { total_products: products.length, total_stock_value, total_stock_units } as any as T;
  }

  // Création groupée : même remarque que l'entrée de stock groupée ci-dessous
  // — doit être vérifié AVANT le bloc générique `/products`, sinon son POST
  // ({products: [...]}) serait traité comme un seul produit à créer.
  if (path.startsWith('/products/bulk') && method === 'POST') {
    const data = JSON.parse(options.body as string) as { products: Record<string, any>[] };
    const created: any[] = [];
    const errors: { index: number; name: string; error: string }[] = [];
    for (let i = 0; i < data.products.length; i++) {
      const item = data.products[i];
      if (!item?.name || item.price === undefined || item.price === null) {
        errors.push({ index: i, name: item?.name || '', error: 'Nom et prix requis' });
        continue;
      }
      const newProduct = {
        id: uuid(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
        stock: Number(item.stock) || 0,
        price: Number(item.price) || 0,
      };
      await OfflineDB.upsertProduct(newProduct);
      created.push(newProduct);
    }
    return { created, errors } as any as T;
  }

  // Entrée de stock groupée : doit être vérifié AVANT le bloc générique
  // `/products` ci-dessous, sinon son POST est intercepté par le handler de
  // création de produit — le corps ({items, reason}) n'a pas la forme d'un
  // produit et donnerait un produit fantôme avec stock NaN.
  if (path.startsWith('/products/stock/bulk-in') && method === 'POST') {
    const products = await OfflineDB.getProducts();
    const data = JSON.parse(options.body as string) as {
      items: { product_id: string; quantity: number }[];
      reason?: string;
    };
    const updated: typeof products = [];
    const errors: { index: number; product_id: string; error: string }[] = [];
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const existing = products.find(p => p.id === item.product_id);
      if (!existing) {
        errors.push({ index: i, product_id: item.product_id, error: 'Produit introuvable hors-ligne' });
        continue;
      }
      const updatedProduct = {
        ...existing,
        stock: existing.stock + item.quantity,
        updated_at: new Date().toISOString(),
      };
      await OfflineDB.upsertProduct(updatedProduct);
      updated.push(updatedProduct);
    }
    return { updated, errors } as any as T;
  }

  if (path.startsWith('/products')) {
    const products = await OfflineDB.getProducts();
    if (method === 'GET') {
      return {
        items: products,
        total: products.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T;
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
      await OfflineDB.upsertProduct(newProduct);
      return newProduct as any as T;
    }
    if (method === 'PUT') {
      const prodId = path.split('/')[2];
      const data = JSON.parse(options.body as string);
      const existing = products.find(p => p.id === prodId);
      if (existing) {
        const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
        await OfflineDB.upsertProduct(updated);
        return updated as any as T;
      }
    }
    if (method === 'DELETE') {
      const prodId = path.split('/')[2];
      await OfflineDB.removeProduct(prodId);
      return undefined as any as T;
    }
  }

  if (path.startsWith('/clients')) {
    const clients = await OfflineDB.getClients();
    if (method === 'GET') {
      return {
        items: clients,
        total: clients.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T;
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newClient = {
        id: uuid(),
        created_at: new Date().toISOString(),
        ...data
      };
      await OfflineDB.upsertClient(newClient);
      return newClient as any as T;
    }
    if (method === 'PUT') {
      const clientId = path.split('/')[2];
      const data = JSON.parse(options.body as string);
      const existing = clients.find(c => c.id === clientId);
      if (existing) {
        const updated = { ...existing, ...data };
        await OfflineDB.upsertClient(updated);
        return updated as any as T;
      }
    }
    if (method === 'DELETE') {
      const clientId = path.split('/')[2];
      await OfflineDB.removeClient(clientId);
      return undefined as any as T;
    }
  }

  if (path.startsWith('/orders')) {
    const orders = await OfflineDB.getOrders();
    if (method === 'GET') {
      return {
        items: orders,
        total: orders.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T;
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const rawItems = data.items || [];

      const products = await OfflineDB.getProducts();
      let orderTotal = 0;
      const items = [];
      for (const item of rawItems) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          orderTotal += prod.price * item.quantity;
          prod.stock = Math.max(0, prod.stock - item.quantity);
          await OfflineDB.upsertProduct(prod);
        }
        items.push({ ...item, unit_price: prod?.price ?? 0, product_name: prod?.name ?? null });
      }

      const clients = await OfflineDB.getClients();
      const client = data.client_id ? clients.find(c => c.id === data.client_id) : null;
      const currentUser = getCurrentUserFromToken();

      const newOrder = {
        id: uuid(),
        status: data.status || 'delivered',
        items,
        total: orderTotal,
        notes: data.notes || '',
        client_id: data.client_id || null,
        client_name: client?.name || 'Passant',
        created_by: currentUser?.id || null,
        created_by_name: currentUser?.displayName || null,
        created_at: new Date().toISOString(),
      };
      await OfflineDB.upsertOrder(newOrder);

      return newOrder as any as T;
    }
  }

  // Le paiement d'une dette (POST /crm/debts/{id}/pay) doit être vérifié
  // AVANT la création générique (POST /crm/debts) : les deux commencent
  // par le même préfixe, et l'ordre inverse traitait auparavant tout
  // paiement hors-ligne comme la création d'une dette supplémentaire.
  if (path.startsWith('/crm/debts') && path.includes('/pay') && method === 'POST') {
    const debts = await OfflineDB.getDebts();
    const parts = path.split('/');
    const debtId = parts[3];
    const data = JSON.parse(options.body as string);
    const amountPaid = Number(data.amount);

    const debt = debts.find(d => d.id === debtId);
    if (debt) {
      debt.remaining_amount = Math.max(0, debt.remaining_amount - amountPaid);
      debt.status = debt.remaining_amount <= 0 ? 'paid' : 'partial';
      await OfflineDB.upsertDebt(debt);

      const clients = await OfflineDB.getClients();
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
      await OfflineDB.upsertTransaction(newTx);

      return {
        message: 'Paiement de dette enregistré',
        remaining_amount: debt.remaining_amount,
        status: debt.status
      } as any as T;
    }
  }

  if (path.startsWith('/crm/debts')) {
    const debts = await OfflineDB.getDebts();
    if (method === 'GET') {
      return debts as any as T;
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
      await OfflineDB.upsertDebt(newDebt);
      return newDebt as any as T;
    }
  }

  if (path.startsWith('/finance')) {
    const urlObj = new URL(path, 'http://localhost');
    const startDate = urlObj.searchParams.get('start_date');
    const endDate = urlObj.searchParams.get('end_date');
    const type = urlObj.searchParams.get('type');

    let transactions = await OfflineDB.getTransactions();
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
      return {
        items: transactions,
        total: transactions.length,
        page: 1,
        per_page: 50,
        pages: 1,
        summary
      } as any as T;
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
      await OfflineDB.upsertTransaction(newTx);
      return newTx as any as T;
    }
  }

  if (path.startsWith('/dashboard/kpis')) {
    const urlObj = new URL(path, 'http://localhost');
    const startDate = urlObj.searchParams.get('start_date');
    const endDate = urlObj.searchParams.get('end_date');

    let transactions = await OfflineDB.getTransactions();
    let orders = await OfflineDB.getOrders();
    const clients = await OfflineDB.getClients();

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

    return {
      total_revenue,
      total_expenses,
      net_balance,
      total_orders: orders.length,
      total_clients: clients.length,
      pending_orders
    } as any as T;
  }

  if (path.startsWith('/dashboard/analytics')) {
    const urlObj = new URL(path, 'http://localhost');
    const startDate = urlObj.searchParams.get('start_date');
    const endDate = urlObj.searchParams.get('end_date');

    let transactions = await OfflineDB.getTransactions();
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
    return { revenue_data } as any as T;
  }

  if (path.startsWith('/categories')) {
    const categories = await ensureSeedCategories();
    if (method === 'GET') {
      return {
        items: categories,
        total: categories.length,
        page: 1,
        per_page: 200,
        pages: 1
      } as any as T;
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newCat = {
        id: uuid(),
        created_at: new Date().toISOString(),
        slug: (data.name || '').toLowerCase().replace(/\s+/g, '-'),
        ...data
      };
      await OfflineDB.upsertCategory(newCat);
      return newCat as any as T;
    }
    if (method === 'PUT') {
      const catId = path.split('/')[2];
      const data = JSON.parse(options.body as string);
      const cat = categories.find(c => c.id === catId);
      if (cat) {
        const updated = { ...cat, ...data };
        await OfflineDB.upsertCategory(updated);
        return updated as any as T;
      }
    }
    if (method === 'DELETE') {
      const catId = path.split('/')[2];
      await OfflineDB.removeCategory(catId);
      return undefined as any as T;
    }
  }

  if (path.startsWith('/suppliers')) {
    const suppliers = await OfflineDB.getSuppliers();
    if (method === 'GET') {
      return {
        items: suppliers,
        total: suppliers.length,
        page: 1,
        per_page: 200,
        pages: suppliers.length > 0 ? 1 : 0
      } as any as T;
    }
    if (method === 'POST') {
      const data = JSON.parse(options.body as string);
      const newSupplier = {
        id: uuid(),
        created_at: new Date().toISOString(),
        ...data
      };
      await OfflineDB.upsertSupplier(newSupplier);
      return newSupplier as any as T;
    }
    if (method === 'PUT') {
      const supplierId = path.split('/')[2];
      const data = JSON.parse(options.body as string);
      const existing = suppliers.find(s => s.id === supplierId);
      if (existing) {
        const updated = { ...existing, ...data };
        await OfflineDB.upsertSupplier(updated);
        return updated as any as T;
      }
    }
    if (method === 'DELETE') {
      const supplierId = path.split('/')[2];
      await OfflineDB.removeSupplier(supplierId);
      return undefined as any as T;
    }
  }

  if (path.startsWith('/auth/team')) {
    if (method === 'GET') {
      return [] as any as T;
    }
  }

  if (path.startsWith('/audit')) {
    if (method === 'GET') {
      return {
        items: [],
        total: 0,
        page: 1,
        per_page: 50,
        pages: 0
      } as any as T;
    }
  }

  if (path.startsWith('/segments') || path.startsWith('/crm/segments')) {
    if (method === 'GET') {
      return {
        items: [],
        total: 0,
        page: 1,
        per_page: 50,
        pages: 0
      } as any as T;
    }
  }

  // ── Catch-all : retourner des données vides au lieu d'une erreur ──
  // Un commerçant ne doit JAMAIS voir "Erreur de chargement" hors-ligne.
  console.warn('[Offline] Route non mappée:', path, '→ retour données vides');
  if (method === 'GET') {
    return {
      items: [],
      total: 0,
      page: 1,
      per_page: 50,
      pages: 0
    } as any as T;
  }
  return {} as any as T;
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
    let bodyToQueue = options.body as string | undefined;
    // La vente a déjà été annoncée au client (reçu imprimé) au moment de la
    // créer localement : son rejeu contre le vrai serveur ne doit jamais
    // pouvoir échouer pour un désaccord de stock — voir allow_stock_shortage
    // côté backend (app/modules/orders/schemas.py).
    if (path.startsWith('/orders') && method === 'POST' && bodyToQueue) {
      try {
        const parsed = JSON.parse(bodyToQueue);
        parsed.allow_stock_shortage = true;
        bodyToQueue = JSON.stringify(parsed);
      } catch {}
    }
    await enqueueOperation(method, path, bodyToQueue, localId, idempotencyKey);
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
    // Un composant qui se démonte (navigation vers une autre page pendant
    // qu'une requête est encore en vol) peut annuler immédiatement plutôt
    // que de laisser la requête occuper une connexion jusqu'au timeout —
    // sur une connexion lente, plusieurs requêtes abandonnées qui
    // s'accumulent ainsi lors de navigations rapprochées peuvent épuiser
    // le nombre de connexions simultanées autorisées vers le serveur et
    // faire échouer la requête de navigation suivante.
    const externalSignal = options.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
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
          const items = Array.isArray(bodyClone) ? bodyClone : bodyClone.items;
          if (method === 'GET' && items) {
            // /products/categories commence par /products : doit être
            // vérifié EN PREMIER, sinon la réponse (des catégories) est
            // absorbée par le cache produits et écrase tout le catalogue
            // local avec des catégories — un stock-in ou une vente hors
            // ligne suivante ne retrouve alors plus aucun vrai produit.
            if (path.startsWith('/products/categories')) await OfflineDB.saveCategories(items);
            else if (path.startsWith('/products')) await OfflineDB.saveProducts(items);
            else if (path.startsWith('/clients')) await OfflineDB.saveClients(items);
            else if (path.startsWith('/finance')) await OfflineDB.saveTransactions(items);
            else if (path.startsWith('/categories')) await OfflineDB.saveCategories(items);
            else if (path.startsWith('/suppliers')) await OfflineDB.saveSuppliers(items);
            else if (path.startsWith('/crm/debts')) await OfflineDB.saveDebts(items);
            else if (path.startsWith('/orders')) {
              // Important après une synchronisation réussie : remplace les
              // commandes à identifiant local fabriqué par les vraies
              // commandes serveur, pour qu'une future coupure de connexion
              // reparte d'un cache exact plutôt que de doublons obsolètes.
              await OfflineDB.saveOrders(items);
            }
          }

          // Écriture produit réussie EN LIGNE : répercutée immédiatement
          // dans le cache offline, sans attendre le prochain GET — sinon un
          // produit tout juste créé/modifié en ligne (ou par un import/
          // entrée de stock groupée) reste invisible d'IndexedDB, et la
          // première action hors-ligne qui le référence échoue à tort avec
          // "produit introuvable hors-ligne" alors qu'il existe bien côté
          // serveur.
          if (method !== 'GET' && path.startsWith('/products') && !path.startsWith('/products/categories')) {
            if (path === '/products/bulk' && Array.isArray(bodyClone.created)) {
              for (const p of bodyClone.created) await OfflineDB.upsertProduct(p);
            } else if (path === '/products/stock/bulk-in' && Array.isArray(bodyClone.updated)) {
              for (const p of bodyClone.updated) await OfflineDB.upsertProduct(p);
            } else if (bodyClone.id) {
              await OfflineDB.upsertProduct(bodyClone);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Offline caching error', e);
    }

    // DELETE ne renvoie aucun corps JSON (204) : le retrait du cache local
    // doit être géré ici, hors du bloc content-type ci-dessus.
    if (method === 'DELETE' && path.startsWith('/products/') && !path.startsWith('/products/categories/')) {
      await OfflineDB.removeProduct(path.split('/')[2]).catch(() => {});
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
      // Même précaution qu'à la déconnexion volontaire : un appareil partagé
      // ne doit pas garder le cache hors-ligne de la session expirée pour
      // la prochaine boutique/utilisateur qui se connecte dessus.
      await clearOfflineDatabase();
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
  async getClients(page = 1, perPage = 20, search?: string, status?: ClientStatus, signal?: AbortSignal) {
    const raw = await request<{ items: CrmClient[]; total: number; page: number; per_page: number }>(
      `/clients${buildQuery({ page, per_page: perPage, search, status })}`,
      { signal }
    );
    return withPages(raw);
  },

  getClient(id: string): Promise<CrmClient> {
    return request(`/clients/${id}`);
  },

  createClient(data: ClientCreate): Promise<CrmClient> {
    return request('/clients', { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  updateClient(id: string, data: ClientUpdate): Promise<CrmClient> {
    return request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  deleteClient(id: string): Promise<void> {
    return request(`/clients/${id}`, { method: 'DELETE', headers: withIdempotencyKey(generateIdempotencyKey()) });
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
  async getCategories(page = 1, perPage = 20, signal?: AbortSignal) {
    const raw = await request<{ items: Category[]; total: number; page: number; per_page: number }>(
      `/products/categories${buildQuery({ page, per_page: perPage })}`,
      { signal }
    );
    return withPages(raw);
  },

  createCategory(data: CategoryCreate): Promise<Category> {
    return request('/products/categories', { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  updateCategory(id: string, data: CategoryUpdate): Promise<Category> {
    return request(`/products/categories/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  deleteCategory(id: string): Promise<void> {
    return request(`/products/categories/${id}`, { method: 'DELETE', headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  // ── Catalogue — Produits ──────────────────────────────────────────────
  async getProducts(page = 1, perPage = 20, search?: string, categoryId?: string, inStock?: boolean, signal?: AbortSignal) {
    const raw = await request<{ items: Product[]; total: number; page: number; per_page: number }>(
      `/products${buildQuery({
        page,
        per_page: perPage,
        search,
        category_id: categoryId,
        in_stock: inStock,
      })}`,
      { signal }
    );
    return withPages(raw);
  },

  getProduct(id: string): Promise<Product> {
    return request(`/products/${id}`);
  },

  // Agrégats calculés en base sur TOUT le catalogue (pas seulement la page
  // courante) — ne jamais recalculer ces valeurs en additionnant une liste
  // paginée côté client, ce serait faux dès que le catalogue dépasse une page.
  getProductStats(signal?: AbortSignal): Promise<{ total_products: number; total_stock_value: number; total_stock_units: number }> {
    return request('/products/stats', { signal });
  },

  createProduct(data: ProductCreate): Promise<Product> {
    return request('/products', { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  createProductsBulk(products: ProductCreate[]): Promise<{ created: Product[]; errors: { index: number; name: string; error: string }[] }> {
    return request('/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ products }),
      headers: withIdempotencyKey(generateIdempotencyKey()),
    });
  },

  bulkStockIn(items: { product_id: string; quantity: number }[], reason?: string): Promise<{ updated: Product[]; errors: { index: number; product_id: string; error: string }[] }> {
    return request('/products/stock/bulk-in', {
      method: 'POST',
      body: JSON.stringify({ items, reason: reason || undefined }),
      headers: withIdempotencyKey(generateIdempotencyKey()),
    });
  },

  updateProduct(id: string, data: ProductUpdate): Promise<Product> {
    return request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) });
  },

  deleteProduct(id: string): Promise<void> {
    return request(`/products/${id}`, { method: 'DELETE', headers: withIdempotencyKey(generateIdempotencyKey()) });
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
      headers: withIdempotencyKey(generateIdempotencyKey()),
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
  createSupplier: (data: SupplierCreate) => request<Supplier>('/suppliers', { method: 'POST', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) }),
  updateSupplier: (id: string, data: SupplierUpdate) => request<Supplier>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: withIdempotencyKey(generateIdempotencyKey()) }),
  deleteSupplier: (id: string) => request<void>(`/suppliers/${id}`, { method: 'DELETE', headers: withIdempotencyKey(generateIdempotencyKey()) }),

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
