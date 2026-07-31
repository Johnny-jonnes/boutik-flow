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
// v2 : ajout du store 'sync_journal' — historique persistant des opérations
// de synchronisation (contrairement à 'sync_queue', une entrée n'est jamais
// supprimée à la confirmation, elle passe juste au statut "confirmed" ;
// c'est l'outil de diagnostic en cas de vente signalée comme perdue.
const DB_VERSION = 2;

const STORES = [
  'products', 'clients', 'categories', 'orders',
  'debts', 'transactions', 'suppliers', 'sync_queue', 'sync_journal', 'meta',
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
        if (store === 'sync_journal') {
          os.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/**
 * Vide entièrement le cache hors-ligne (IndexedDB) — appelé à la
 * déconnexion et sur toute expiration de session forcée. Sur un appareil
 * partagé entre boutiques (poste de caisse commun, tablette prêtée...),
 * sans cet appel les produits/clients/commandes de la boutique précédente
 * resteraient en cache local et pourraient s'afficher pour la boutique
 * suivante tant qu'aucune synchronisation n'a eu lieu — la couche mémoire
 * (TanStack Query) n'a pas ce risque : `handleLogout` navigue vers /login
 * par un rechargement complet de page, ce qui réinitialise déjà tout le
 * tas JS et son cache en mémoire.
 */
export async function clearOfflineDatabase(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    if (dbPromise) {
      const db = await dbPromise.catch(() => null);
      db?.close();
    }
  } finally {
    dbPromise = null;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    // Une autre invite/onglet a encore une connexion ouverte : ne bloque
    // jamais la déconnexion en cours pour autant, la base sera de toute
    // façon écrasée dès la prochaine connexion (voir OfflineDB.saveXxx).
    req.onblocked = () => resolve();
  });
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

/**
 * Écrit plusieurs objets dans plusieurs stores en UNE seule transaction
 * IndexedDB — tout ou rien. Utilisée pour les écritures où une perte
 * partielle serait grave (ex: une vente créée en local mais jamais mise
 * en file si l'app est tuée entre les deux écritures, auparavant deux
 * transactions séparées — voir createOrderAtomic dans client.ts). Ne pas
 * appeler await entre les writes.put() de l'appelant : IndexedDB referme
 * une transaction dès que la pile d'appels synchrone se vide, un await
 * intercalé la ferme prématurément et fait échouer les writes suivants.
 */
async function atomicWrite(writes: { store: StoreName; item: any }[]): Promise<void> {
  if (writes.length === 0) return;
  const db = await openDb();
  const stores = Array.from(new Set(writes.map((w) => w.store)));
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    for (const w of writes) t.objectStore(w.store).put(w.item);
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

/**
 * Fusionne un lot d'éléments dans un store SANS toucher aux lignes
 * absentes du lot — contrairement à replaceAll(), qui vide tout le store
 * avant de réinsérer : correct pour un chargement complet (page 1 = toute
 * la vérité), mais destructeur pour un delta de synchronisation
 * incrémentale (le lot ne contient QUE ce qui a changé). Un élément portant
 * deleted_at est retiré du cache local au lieu d'être mis à jour — c'est
 * ainsi que les suppressions distantes se propagent hors-ligne.
 */
async function mergeBatch(store: StoreName, items: any[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    for (const item of items) {
      if (!item || item.id == null) continue;
      if (item.deleted_at) os.delete(item.id);
      else os.put(item);
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
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

export const OfflineStore = { getAll, replaceAll, upsert, remove, getOne, getMeta, setMeta, atomicWrite };

// ─── Interface par entité — mêmes noms que l'ancien OfflineDB (localStorage)
// pour limiter la surface de changement côté client.ts, désormais async. ──

export const OfflineDB = {
  getProducts: () => getAll<any>('products'),
  saveProducts: (items: any[]) => replaceAll('products', items),
  mergeProducts: (items: any[]) => mergeBatch('products', items),
  upsertProduct: (item: any) => upsert('products', item),
  removeProduct: (id: string) => remove('products', id),

  getClients: () => getAll<any>('clients'),
  saveClients: (items: any[]) => replaceAll('clients', items),
  mergeClients: (items: any[]) => mergeBatch('clients', items),
  upsertClient: (item: any) => upsert('clients', item),
  removeClient: (id: string) => remove('clients', id),

  getCategories: () => getAll<any>('categories'),
  saveCategories: (items: any[]) => replaceAll('categories', items),
  upsertCategory: (item: any) => upsert('categories', item),
  removeCategory: (id: string) => remove('categories', id),

  getOrders: () => getAll<any>('orders'),
  saveOrders: (items: any[]) => replaceAll('orders', items),
  mergeOrders: (items: any[]) => mergeBatch('orders', items),
  upsertOrder: (item: any) => upsert('orders', item),

  getDebts: () => getAll<any>('debts'),
  saveDebts: (items: any[]) => replaceAll('debts', items),
  upsertDebt: (item: any) => upsert('debts', item),

  getTransactions: () => getAll<any>('transactions'),
  saveTransactions: (items: any[]) => replaceAll('transactions', items),
  mergeTransactions: (items: any[]) => mergeBatch('transactions', items),
  upsertTransaction: (item: any) => upsert('transactions', item),

  getSuppliers: () => getAll<any>('suppliers'),
  saveSuppliers: (items: any[]) => replaceAll('suppliers', items),
  upsertSupplier: (item: any) => upsert('suppliers', item),
  removeSupplier: (id: string) => remove('suppliers', id),

  getLastSyncAt: () => getMeta<number>('lastSyncAt'),
  setLastSyncAt: (ts: number) => setMeta('lastSyncAt', ts),

  // Curseur de synchronisation incrémentale — un par collection, distinct
  // de lastSyncAt (horodatage global juste informatif) : celui-ci doit
  // être précisément la date de la dernière ligne effectivement vue dans
  // les réponses, jamais l'heure locale au moment de la requête (qui peut
  // diverger de l'horloge serveur et faire manquer des lignes).
  getSyncCursor: (collection: string) => getMeta<string>(`syncCursor:${collection}`),
  setSyncCursor: (collection: string, iso: string) => setMeta(`syncCursor:${collection}`, iso),
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

// ─── Journal de synchronisation ─────────────────────────────────────────
//
// Contrairement à 'sync_queue' (qui ne contient QUE les opérations encore
// en attente ou en échec — une opération réussie en est retirée), ce
// journal garde une trace de CHAQUE opération, y compris une fois
// confirmée par le serveur : c'est l'outil de diagnostic quand un
// commerçant signale "cette vente n'apparaît nulle part" — on peut
// retrouver ici si elle a bien été mise en file, envoyée, confirmée, ou
// si elle est restée bloquée en erreur, avec l'horodatage de chaque étape.

export type SyncJournalStatus = 'pending' | 'sent' | 'confirmed' | 'error';

export interface SyncJournalEntry {
  id: string;
  opId: string;
  method: string;
  path: string;
  description: string;
  status: SyncJournalStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

// Borne la taille du journal — un appareil resté hors-ligne très longtemps
// avec une activité intense ne doit pas faire grossir IndexedDB sans limite.
const JOURNAL_MAX_ENTRIES = 500;

/** "POST /orders" → "Vente" — partagée entre le journal (client.ts) et
 *  l'indicateur hors-ligne (OfflineStatusBar.tsx) pour ne décrire chaque
 *  route qu'à un seul endroit. */
export function describeOperation(method: string, path: string): string {
  const p = path.split('?')[0];
  if (p.startsWith('/orders')) return 'Vente';
  if (p.startsWith('/products/stock/bulk-in')) return 'Entrée de stock groupée';
  if (p.startsWith('/products/bulk')) return 'Création de produits groupée';
  if (p.startsWith('/products')) return method === 'DELETE' ? 'Suppression produit' : 'Produit';
  if (p.startsWith('/clients')) return 'Client';
  if (p.startsWith('/suppliers')) return 'Fournisseur';
  if (p.includes('/pay')) return 'Paiement de dette';
  if (p.startsWith('/crm/debts')) return 'Dette';
  if (p.startsWith('/finance')) return 'Mouvement de caisse';
  if (p.startsWith('/categories')) return 'Catégorie';
  return p;
}

export const SyncJournal = {
  async getAll(): Promise<SyncJournalEntry[]> {
    const items = await getAll<SyncJournalEntry>('sync_journal');
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async append(entry: Omit<SyncJournalEntry, 'id' | 'updatedAt'>): Promise<string> {
    const id = `j-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await upsert('sync_journal', { ...entry, id, updatedAt: Date.now() });
    await SyncJournal.prune();
    return id;
  },
  async updateStatus(opId: string, status: SyncJournalStatus, errorMessage?: string): Promise<void> {
    const items = await getAll<SyncJournalEntry>('sync_journal');
    const entry = items.find((e) => e.opId === opId);
    if (!entry) return;
    entry.status = status;
    entry.errorMessage = errorMessage;
    entry.updatedAt = Date.now();
    await upsert('sync_journal', entry);
  },
  async prune(maxEntries: number = JOURNAL_MAX_ENTRIES): Promise<void> {
    const items = await SyncJournal.getAll();
    if (items.length <= maxEntries) return;
    const toRemove = items.slice(maxEntries);
    for (const entry of toRemove) await remove('sync_journal', entry.id);
  },
};
