/**
 * Stockage hors-ligne — IndexedDB.
 *
 * Remplace l'ancien stockage localStorage : celui-ci partage un quota
 * unique d'environ 5-10 Mo entre TOUTES ses clés (catalogue produits,
 * clients, catégories, commandes, dettes, transactions ET la file de
 * synchronisation) — déjà vu dépassé en pratique avec un simple
 * catalogue produits (QuotaExceededError, écriture silencieusement
 * perdue). Pour "une journée entière hors ligne, des centaines
 * d'opérations, parfois avec photo", ce plafond est structurellement
 * insuffisant. IndexedDB n'a pas cette limite pratique (typiquement des
 * centaines de Mo, un pourcentage de l'espace disque) et gère nativement
 * de gros volumes sans bloquer le thread principal (contrairement à
 * JSON.stringify/parse sur un gros blob localStorage).
 */

const DB_NAME = 'boutikflow_offline';
const DB_VERSION = 1;

const STORES = [
  'products', 'clients', 'categories', 'orders',
  'debts', 'transactions', 'suppliers', 'sync_queue', 'meta',
] as const;
export type StoreName = typeof STORES[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB indisponible dans ce contexte'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (db.objectStoreNames.contains(store)) continue;
        const os = db.createObjectStore(store, { keyPath: 'id' });
        if (store === 'sync_queue') {
          os.createIndex('status', 'status', { unique: false });
          os.createIndex('createdAt', 'createdAt', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (os: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function getAll<T>(store: StoreName): Promise<T[]> {
  try {
    return await tx<T[]>(store, 'readonly', (os) => os.getAll());
  } catch {
    return [];
  }
}

async function replaceAll(store: StoreName, items: any[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    os.clear();
    for (const item of items) if (item && item.id != null) os.put(item);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

async function upsert(store: StoreName, item: any): Promise<void> {
  if (!item || item.id == null) return;
  await tx(store, 'readwrite', (os) => os.put(item));
}

async function remove(store: StoreName, id: string): Promise<void> {
  await tx(store, 'readwrite', (os) => os.delete(id));
}

async function getOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  try {
    return await tx<T | undefined>(store, 'readonly', (os) => os.get(id));
  } catch {
    return undefined;
  }
}

/** Petites valeurs isolées (dernière sync réussie, etc.) — stockées à part
 *  des données métier pour ne jamais être écrasées par un replaceAll(). */
async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await getOne<{ id: string; value: T }>('meta', key);
  return row?.value;
}
async function setMeta<T>(key: string, value: T): Promise<void> {
  await upsert('meta', { id: key, value });
}

export const OfflineStore = { getAll, replaceAll, upsert, remove, getOne, getMeta, setMeta };

// ─── Interface par entité — mêmes noms que l'ancien OfflineDB (localStorage)
// pour limiter la surface de changement côté client.ts, désormais async. ──

export const OfflineDB = {
  getProducts: () => getAll<any>('products'),
  saveProducts: (items: any[]) => replaceAll('products', items),
  upsertProduct: (item: any) => upsert('products', item),
  removeProduct: (id: string) => remove('products', id),

  getClients: () => getAll<any>('clients'),
  saveClients: (items: any[]) => replaceAll('clients', items),
  upsertClient: (item: any) => upsert('clients', item),
  removeClient: (id: string) => remove('clients', id),

  getCategories: () => getAll<any>('categories'),
  saveCategories: (items: any[]) => replaceAll('categories', items),
  upsertCategory: (item: any) => upsert('categories', item),
  removeCategory: (id: string) => remove('categories', id),

  getOrders: () => getAll<any>('orders'),
  saveOrders: (items: any[]) => replaceAll('orders', items),
  upsertOrder: (item: any) => upsert('orders', item),

  getDebts: () => getAll<any>('debts'),
  saveDebts: (items: any[]) => replaceAll('debts', items),
  upsertDebt: (item: any) => upsert('debts', item),

  getTransactions: () => getAll<any>('transactions'),
  saveTransactions: (items: any[]) => replaceAll('transactions', items),
  upsertTransaction: (item: any) => upsert('transactions', item),

  getSuppliers: () => getAll<any>('suppliers'),
  saveSuppliers: (items: any[]) => replaceAll('suppliers', items),
  upsertSupplier: (item: any) => upsert('suppliers', item),
  removeSupplier: (id: string) => remove('suppliers', id),

  getLastSyncAt: () => getMeta<number>('lastSyncAt'),
  setLastSyncAt: (ts: number) => setMeta('lastSyncAt', ts),
};

// ─── File de synchronisation ────────────────────────────────────────────
// Stockée dans le même IndexedDB (store 'sync_queue') — un lot de photos
// en attente ne fait plus courir de risque de dépassement de quota au
// reste des données mises en cache.

export interface QueuedOp {
  id: string;
  method: string;
  path: string;
  body: string | undefined;
  createdAt: number;
  status: 'pending' | 'failed';
  errorMessage?: string;
  attempts: number;
  /** Prochaine tentative au plus tôt (backoff exponentiel) — epoch ms. */
  nextAttemptAt?: number;
  localId?: string;
  idempotencyKey?: string;
}

export const OfflineQueue = {
  async getAll(): Promise<QueuedOp[]> {
    const items = await getAll<QueuedOp>('sync_queue');
    return items.sort((a, b) => a.createdAt - b.createdAt);
  },
  async getPending(): Promise<QueuedOp[]> {
    const items = await OfflineQueue.getAll();
    const now = Date.now();
    return items.filter((q) => q.status === 'pending' && (!q.nextAttemptAt || q.nextAttemptAt <= now));
  },
  async put(op: QueuedOp): Promise<void> {
    await upsert('sync_queue', op);
  },
  async remove(id: string): Promise<void> {
    await OfflineStore.remove('sync_queue', id);
  },
  async replaceMatching(localId: string, realId: string): Promise<void> {
    const items = await OfflineQueue.getAll();
    for (const op of items) {
      let changed = false;
      if (op.path.includes(localId)) { op.path = op.path.split(localId).join(realId); changed = true; }
      if (op.body && op.body.includes(localId)) { op.body = op.body.split(localId).join(realId); changed = true; }
      if (changed) await OfflineQueue.put(op);
    }
  },
};
