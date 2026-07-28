'use client';

import { useEffect, useState } from 'react';
import {
  Download, FileText, Eye, Plus, Minus, ArrowRight, Trash2, Printer, RotateCcw,
  Clock, CheckCircle2, Truck, Ban, Undo2, AlertTriangle, ScanLine, Camera, Search,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import type { Order, Client, Product, OrderStatus } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { useLanguage } from '@/context/LanguageContext';
import { isWithinPeriod } from '@/lib/period';

// Les 3 étapes normales d'une commande. "cancelled" est un état à part —
// une annulation n'est pas une "étape" du parcours, elle en sort.
const STEPS: OrderStatus[] = ['pending', 'confirmed', 'delivered'];
const STEP_ICONS = [Clock, CheckCircle2, Truck] as const;

// Une seule action possible pour avancer une commande : l'étape suivante.
// Pas de menu à lire — un tenant analphabète tape une icône, jamais un texte.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'delivered',
};

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

function formatDateShort(isoString: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(isoString));
}

function formatDateFull(isoString: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoString));
}

/**
 * Suivi visuel de commande — icônes + couleur, pas de texte à lire pour
 * comprendre où en est la commande. Réutilisé en carte (compact) et dans
 * le détail (avec libellés, pour ceux qui savent lire un peu).
 */
function StatusTracker({
  status,
  labels,
  showLabels = false,
}: {
  status: OrderStatus;
  labels: { cancelled: string; steps: string[] };
  showLabels?: boolean;
}) {
  if (status === 'cancelled') {
    return (
      <div className="tracker tracker--cancelled">
        <Ban size={showLabels ? 20 : 15} />
        <span>{labels.cancelled}</span>
      </div>
    );
  }

  const currentIndex = STEPS.indexOf(status);

  return (
    <div className={`tracker ${showLabels ? 'tracker--labeled' : ''}`}>
      {STEPS.map((step, i) => {
        const Icon = STEP_ICONS[i];
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step} className="tracker-step-wrap">
            <div className="tracker-step-col">
              <div className={`tracker-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                <Icon size={showLabels ? 18 : 14} />
              </div>
              {showLabels && <span className="tracker-step-label">{labels.steps[i]}</span>}
            </div>
            {i < STEPS.length - 1 && <div className={`tracker-line ${i < currentIndex ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<{
    client_id: string;
    items: { product_id: string; quantity: number }[];
    notes: string;
  }>({
    client_id: '', items: [{ product_id: '', quantity: 1 }], notes: '',
  });

  const [isDebt, setIsDebt] = useState(false);
  const [debtAmount, setDebtAmount] = useState(0);
  const [debtDescription, setDebtDescription] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');

  // View / actions modal
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Receipt modal
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [shopName, setShopName] = useState('BoutikFlow');
  const [sellerName, setSellerName] = useState('');

  useEffect(() => {
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenant_name) setShopName(payload.tenant_name);
        if (payload.email) {
          const namePart = payload.email.split('@')[0];
          setSellerName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        } else if (payload.sub) {
          const namePart = payload.sub.split('@')[0];
          setSellerName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Return product modal
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnItems, setReturnItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Scanner code-barres / SKU pour ajouter un produit sans avoir à le lire
  // dans une liste : on scanne, le produit s'ajoute tout seul.
  const [scannerInput, setScannerInput] = useState('');
  const [isCameraScanOpen, setIsCameraScanOpen] = useState(false);

  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // silent=true pour les rafraîchissements en arrière-plan après une action
  // (changement de statut, création, retour, sync hors-ligne) : sans ça,
  // setIsLoading(true) vidait toute la liste au profit d'un gros spinner
  // plein écran à chaque petite action, donnant l'impression d'un
  // rechargement de page complet alors qu'il ne s'agit que d'un
  // rafraîchissement de données.
  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      // Charge TOUTES les commandes (pas seulement les 100 premières) :
      // sans cette boucle, la page perdait silencieusement les commandes
      // les plus anciennes dès qu'une boutique dépassait 100 commandes —
      // export CSV incomplet et filtres donnant des résultats tronqués.
      const first = await api.getOrders(1, undefined, 100);
      let all = first.items;
      const totalPages = Math.min(first.pages || 1, 50); // garde-fou anti-boucle infinie
      for (let page = 2; page <= totalPages; page++) {
        const next = await api.getOrders(page, undefined, 100);
        all = all.concat(next.items);
      }
      setOrders(all);
    } catch (error) {
      toast.error(language === 'fr' ? 'Erreur lors de la récupération des commandes' : 'Error loading orders');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    api.getClients(1, 100).then(res => setClients(res.items)).catch(() => {});
    api.getProducts(1, 100).then(res => setProducts(res.items)).catch(() => {});
  }, []);

  // Une commande créée hors connexion n'existe nulle part côté serveur tant
  // qu'elle n'a pas été synchronisée : sans ce rafraîchissement, la liste
  // restait affichée avec des commandes à identifiant local jusqu'à un
  // rechargement manuel de la page.
  useEffect(() => {
    const onSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as { succeeded: number } | undefined;
      if (detail?.succeeded) fetchOrders(true);
    };
    window.addEventListener('boutikflow:sync-complete', onSyncComplete);
    return () => window.removeEventListener('boutikflow:sync-complete', onSyncComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multi-product handlers
  const handleAddItem = () => {
    setCreateForm(prev => ({ ...prev, items: [...prev.items, { product_id: '', quantity: 1 }] }));
  };

  const handleRemoveItem = (index: number) => {
    setCreateForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...createForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateForm(prev => ({ ...prev, items: newItems }));
  };

  const handleQtyStep = (index: number, delta: number) => {
    const current = createForm.items[index].quantity;
    handleItemChange(index, 'quantity', Math.max(1, current + delta));
  };

  // Ajoute (ou incrémente) un produit reconnu par code-barres / SKU,
  // que la saisie vienne du champ texte (douchette USB) ou de la caméra.
  const addProductByCode = (rawCode: string) => {
    const query = rawCode.trim();
    if (!query) return;

    const matched = products.find(
      p => (p.barcode && p.barcode === query) || (p.sku && p.sku.toLowerCase() === query.toLowerCase())
    );

    if (!matched) {
      toast.error(language === 'fr' ? `Aucun produit trouvé pour "${query}"` : `No product found for "${query}"`);
      return;
    }

    if (!matched.is_available || matched.stock <= 0) {
      toast.error(
        language === 'fr'
          ? `${matched.name} est indisponible ou en rupture de stock.`
          : `${matched.name} is unavailable or out of stock.`
      );
      return;
    }

    const existingIndex = createForm.items.findIndex(i => i.product_id === matched.id);
    if (existingIndex >= 0) {
      const newItems = [...createForm.items];
      newItems[existingIndex] = { ...newItems[existingIndex], quantity: newItems[existingIndex].quantity + 1 };
      setCreateForm(prev => ({ ...prev, items: newItems }));
    } else {
      const emptyIndex = createForm.items.findIndex(i => !i.product_id);
      if (emptyIndex >= 0) {
        const newItems = [...createForm.items];
        newItems[emptyIndex] = { product_id: matched.id, quantity: 1 };
        setCreateForm(prev => ({ ...prev, items: newItems }));
      } else {
        setCreateForm(prev => ({ ...prev, items: [...prev.items, { product_id: matched.id, quantity: 1 }] }));
      }
    }

    toast.success(language === 'fr' ? `${matched.name} ajouté` : `${matched.name} added`);
  };

  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addProductByCode(scannerInput);
    setScannerInput('');
  };

  const handleCameraScan = (decodedText: string) => {
    addProductByCode(decodedText);
    setIsCameraScanOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    // Garde contre une double soumission (touche Entrée + clic quasi
    // simultanés, ou double-tap avant que le bouton ne se désactive) :
    // le disabled du bouton seul ne bloque pas une soumission via Entrée.
    if (isSubmitting) return;
    if (!createForm.client_id || createForm.items.length === 0 || createForm.items.some(i => !i.product_id)) {
      toast.error(language === 'fr' ? 'Veuillez remplir tous les champs obligatoires' : 'Please fill in all required fields');
      return;
    }

    let finalDebtAmount = debtAmount;
    if (isDebt && finalDebtAmount <= 0) {
      const total = createForm.items.reduce((acc, item) => {
        const product = products.find(p => p.id === item.product_id);
        return acc + (product ? product.price * item.quantity : 0);
      }, 0);
      finalDebtAmount = total;
    }

    setIsSubmitting(true);
    try {
      const order = await api.createOrder({
        client_id: createForm.client_id,
        items: createForm.items,
        notes: createForm.notes || undefined,
      });

      if (isDebt && finalDebtAmount > 0) {
        await api.createDebt({
          client_id: createForm.client_id,
          order_id: order.id,
          original_amount: finalDebtAmount,
          description: debtDescription || undefined,
          due_date: debtDueDate ? new Date(debtDueDate).toISOString() : undefined,
        });
        toast.success(language === 'fr' ? 'Commande et dette créées avec succès' : 'Order and debt created successfully');
      } else {
        toast.success(language === 'fr' ? 'Commande créée avec succès' : 'Order created successfully');
      }

      setIsCreateOpen(false);
      setCreateForm({ client_id: '', items: [{ product_id: '', quantity: 1 }], notes: '' });
      setIsDebt(false);
      setDebtAmount(0);
      setDebtDescription('');
      setDebtDueDate('');
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? 'Erreur lors de la création' : 'Error creating order'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    setIsUpdatingStatus(true);
    try {
      await api.updateOrderStatus(orderId, status);
      toast.success(language === 'fr' ? 'Statut mis à jour' : 'Status updated');
      setViewOrder(null);
      setConfirmingCancel(false);
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? 'Erreur lors de la mise à jour' : 'Error updating status'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAdvance = (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (next) handleStatusUpdate(order.id, next);
  };

  const handleReactivate = (order: Order) => handleStatusUpdate(order.id, 'pending');

  const openReturnModal = (order: Order) => {
    setReturnOrder(order);
    setReturnItems(order.items?.map(i => ({ product_id: i.product_id, quantity: 0 })) || []);
    setReturnReason('');
    setRestockInventory(true);
  };

  const handleSubmitReturn = async () => {
    if (!returnOrder) return;
    const itemsToReturn = returnItems.filter(i => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error(language === 'fr' ? 'Sélectionnez au moins un article à retourner' : 'Select at least one item to return');
      return;
    }
    if (!returnReason.trim()) {
      toast.error(language === 'fr' ? 'Veuillez indiquer le motif du retour' : 'Please indicate the return reason');
      return;
    }
    setIsSubmittingReturn(true);
    try {
      await api.returnOrderItems(returnOrder.id, itemsToReturn, returnReason, restockInventory);
      toast.success(language === 'fr' ? 'Retour enregistré avec succès' : 'Return recorded successfully');
      setReturnOrder(null);
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? 'Erreur lors du retour' : 'Error processing return'));
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (orders.length === 0) {
      toast.error(language === 'fr' ? 'Aucune commande à exporter' : 'No orders to export');
      return;
    }
    const headers = ['ID', 'Client', 'Statut', 'Montant', 'Articles', 'Notes', 'Date'];
    const rows = orders.map(o => [
      o.id.slice(0, 8),
      getClientName(o.client_id),
      t(`ord.${o.status}`),
      String(o.total || 0),
      String(o.items?.length || 0),
      o.notes || '',
      new Date(o.created_at).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commandes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'Client';
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'Produit';

  const dateRange = { period: 'custom' as const, start_date: filterDateFrom || undefined, end_date: filterDateTo || undefined };

  const filteredOrders = orders.filter(o => {
    if (filterStatus === 'active') {
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
    } else if (filterStatus !== 'all' && o.status !== filterStatus) {
      return false;
    }
    if (!isWithinPeriod(o.created_at, dateRange)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientName = getClientName(o.client_id).toLowerCase();
      if (!o.id.toLowerCase().includes(q) && !clientName.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totalFiltered = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / perPage));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * perPage, currentPage * perPage);

  const trackerLabels = {
    cancelled: t('ord.cancelled'),
    steps: [t('ord.step_pending'), t('ord.step_confirmed'), t('ord.step_delivered')],
  };

  const STATUS_PILLS: { id: string; label: string; Icon?: any; color: string }[] = [
    { id: 'active', label: t('ord.filter_active'), color: 'var(--color-brand-500)' },
    { id: 'all', label: t('ord.filter_all'), color: 'var(--text-muted)' },
    { id: 'pending', label: t('ord.pending'), Icon: Clock, color: '#f59e0b' },
    { id: 'confirmed', label: t('ord.confirmed'), Icon: CheckCircle2, color: '#3b82f6' },
    { id: 'delivered', label: t('ord.delivered'), Icon: Truck, color: 'var(--color-brand-500)' },
    { id: 'cancelled', label: t('ord.cancelled'), Icon: Ban, color: '#f43f5e' },
  ];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('ord.title')}</h1>
          <p className="page-subtitle">{t('ord.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleExport}>
            <Download size={16} /> {t('ord.export')}
          </button>
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> {t('ord.new')}
          </button>
        </div>
      </div>

      {/* Filtre par statut — pastilles icône + couleur, rien à lire pour reconnaître un statut */}
      <div className="status-pills">
        {STATUS_PILLS.map(p => (
          <button
            key={p.id}
            className={`status-pill ${filterStatus === p.id ? 'active' : ''}`}
            style={{ ['--pill-color' as any]: p.color }}
            onClick={() => { setFilterStatus(p.id); setCurrentPage(1); }}
          >
            {p.Icon && <p.Icon size={15} />}
            {p.label}
          </button>
        ))}
      </div>

      <div className="filters-bar card">
        <div className="date-filter">
          <input type="date" className="input" value={filterDateFrom} max={filterDateTo || undefined} onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }} />
          <span className="date-sep">{language === 'fr' ? 'à' : 'to'}</span>
          <input type="date" className="input" value={filterDateTo} min={filterDateFrom || undefined} onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }} />
        </div>
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="input search-input"
            placeholder={t('ord.search_placeholder')}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <span className="results-count">{totalFiltered} {t('ord.results')}</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
      ) : paginatedOrders.length === 0 ? (
        <div className="empty-state card">
          <FileText size={40} opacity={0.2} />
          <p>{totalFiltered === 0 && orders.length > 0 ? t('ord.no_results') : t('ord.no_orders')}</p>
        </div>
      ) : (
        <div className="orders-list">
          {paginatedOrders.map(order => {
            const nextStatus = NEXT_STATUS[order.status];
            const NextIcon = nextStatus ? STEP_ICONS[STEPS.indexOf(nextStatus)] : null;
            return (
              <div key={order.id} className="order-card" onClick={() => setViewOrder(order)}>
                <div className="oc-top">
                  <span className="oc-id">#{order.id.slice(0, 6)}</span>
                  <span className="oc-date">{formatDateShort(order.created_at)}</span>
                </div>
                <div className="oc-main">
                  <div className="oc-client">
                    <div className="oc-avatar">{getClientName(order.client_id).charAt(0).toUpperCase()}</div>
                    <div className="oc-client-info">
                      <span className="oc-client-name">{getClientName(order.client_id)}</span>
                      <span className="oc-items">{order.items?.length || 0} {t('ord.articles')}</span>
                    </div>
                  </div>
                  <span className="oc-amount">{formatGNF(Number(order.total) || 0)}</span>
                </div>

                <div className="oc-tracker-row">
                  <StatusTracker status={order.status} labels={trackerLabels} />
                </div>

                <div className="oc-actions" onClick={e => e.stopPropagation()}>
                  <button className="oc-btn" onClick={() => setViewOrder(order)} title={t('ord.view')}>
                    <Eye size={18} />
                  </button>
                  <button className="oc-btn" onClick={() => setReceiptOrder(order)} title={t('common.print')}>
                    <Printer size={18} />
                  </button>
                  {order.status === 'delivered' && (
                    <button className="oc-btn" onClick={() => openReturnModal(order)} title={t('ord.return_items')}>
                      <RotateCcw size={18} />
                    </button>
                  )}
                  {nextStatus && NextIcon && (
                    <button className="oc-btn oc-btn--primary" onClick={() => handleAdvance(order)} title={t('ord.next_step')}>
                      <NextIcon size={18} />
                    </button>
                  )}
                  {order.status === 'cancelled' && (
                    <button className="oc-btn oc-btn--primary" onClick={() => handleReactivate(order)} title={t('ord.reactivate')}>
                      <Undo2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-bar">
          <div className="per-page-wrap">
            <span className="per-page-label">{t('ord.per_page')} :</span>
            <select className="input" style={{ width: '80px' }} value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="page-nav">
            <button className="btn btn-ghost btn-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>{language === 'fr' ? 'Précédent' : 'Previous'}</button>
            <span className="page-indicator">{t('ord.page_of')} {currentPage} {t('ord.of')} {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>{language === 'fr' ? 'Suivant' : 'Next'}</button>
          </div>
        </div>
      )}

      {/* Modal Créer Commande */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={`+ ${t('ord.new')}`}>
        <form onSubmit={handleCreate} className="modal-form">
          <div className="form-group">
            <label className="form-label">{t('ord.client')}</label>
            <select className="input" required value={createForm.client_id} onChange={e => setCreateForm({ ...createForm, client_id: e.target.value })}>
              <option value="">{t('ord.select_client')}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
            </select>
          </div>

          <div className="scanner-row">
            <form onSubmit={handleScannerSubmit} className="scanner-input-wrap">
              <ScanLine size={16} className="scanner-icon" />
              <input
                type="text"
                className="scanner-input"
                placeholder={t('ord.scan_placeholder')}
                value={scannerInput}
                onChange={e => setScannerInput(e.target.value)}
                autoComplete="off"
              />
            </form>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setIsCameraScanOpen(true)} title={t('ord.scan_camera')}>
              <Camera size={18} />
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">{t('ord.items')}</label>
          </div>

          <div className="items-list">
            {createForm.items.map((item, index) => (
              <div key={index} className="item-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <select className="input" required value={item.product_id} onChange={e => handleItemChange(index, 'product_id', e.target.value)}>
                    <option value="">{language === 'fr' ? 'Choisir un produit' : 'Choose a product'}</option>
                    {products.filter(p => p.is_available && p.stock > 0).map(p => <option key={p.id} value={p.id}>{p.name} - {formatGNF(p.price)}</option>)}
                  </select>
                </div>
                <div className="qty-stepper">
                  <button type="button" className="qty-btn" onClick={() => handleQtyStep(index, -1)}><Minus size={16} /></button>
                  <span className="qty-value">{item.quantity}</span>
                  <button type="button" className="qty-btn" onClick={() => handleQtyStep(index, 1)}><Plus size={16} /></button>
                </div>
                {createForm.items.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-icon btn-danger-icon" onClick={() => handleRemoveItem(index)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddItem} style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            <Plus size={14} /> {t('ord.add_product')}
          </button>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">{t('ord.notes')}</label>
            <textarea className="input" rows={2} value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} />
          </div>

          {createForm.client_id && (
            <div className="form-group" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: isDebt ? '1rem' : 0 }}>
                <input type="checkbox" id="debt-check" checked={isDebt} onChange={e => setIsDebt(e.target.checked)} />
                <label htmlFor="debt-check" style={{ fontWeight: 600 }}>
                  {language === 'fr' ? 'Enregistrer comme dette client (Vente à crédit)' : 'Record as customer debt (Credit sale)'}
                </label>
              </div>

              {isDebt && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">{language === 'fr' ? 'Montant de la dette (GNF)' : 'Debt amount (GNF)'}</label>
                    <input
                      type="number"
                      className="input"
                      placeholder={language === 'fr' ? 'Laissez vide pour le total' : 'Leave empty for the full total'}
                      value={debtAmount || ''}
                      onChange={e => setDebtAmount(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="form-label">{language === 'fr' ? 'Description / Motif' : 'Description / Reason'}</label>
                    <input
                      type="text"
                      className="input"
                      placeholder={language === 'fr' ? 'Ex: Reste à payer' : 'Ex: Remaining balance'}
                      value={debtDescription}
                      onChange={e => setDebtDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">{language === 'fr' ? "Date d'échéance (optionnelle)" : 'Due date (optional)'}</label>
                    <input
                      type="date"
                      className="input"
                      value={debtDueDate}
                      onChange={e => setDebtDueDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsCreateOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? t('ord.creating') : t('ord.create')}
            </button>
          </div>
        </form>
      </Modal>

      <BarcodeScannerModal
        isOpen={isCameraScanOpen}
        onClose={() => setIsCameraScanOpen(false)}
        onScanSuccess={handleCameraScan}
        title={t('ord.scan_add')}
      />

      {/* Modal Détail + actions de suivi */}
      <Modal isOpen={!!viewOrder} onClose={() => { setViewOrder(null); setConfirmingCancel(false); }} title={t('ord.details')}>
        {viewOrder && (
          <div className="detail-grid">
            <div className="tracker-big">
              <StatusTracker status={viewOrder.status} labels={trackerLabels} showLabels />
            </div>

            <div className="detail-row"><span className="detail-label">{t('ord.client')}</span><span className="detail-value">{getClientName(viewOrder.client_id)}</span></div>
            <div className="detail-row"><span className="detail-label">{t('ord.total')}</span><span className="detail-value order-amount">{formatGNF(Number(viewOrder.total) || 0)}</span></div>
            <div className="detail-row"><span className="detail-label">{t('ord.items')}</span><span className="detail-value">{viewOrder.items?.length || 0}</span></div>
            {viewOrder.items?.map((item, i) => (
              <div key={i} className="detail-row" style={{ paddingLeft: '1rem' }}>
                <span className="detail-label">— {getProductName(item.product_id)}</span>
                <span className="detail-value">x{item.quantity} · {formatGNF(item.unit_price)}</span>
              </div>
            ))}
            <div className="detail-row"><span className="detail-label">{t('ord.notes')}</span><span className="detail-value">{viewOrder.notes || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">{t('ord.created_at')}</span><span className="detail-value">{formatDateFull(viewOrder.created_at)}</span></div>

            {!confirmingCancel ? (
              <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={() => { setViewOrder(null); setConfirmingCancel(false); }}>{t('common.close')}</button>

                {viewOrder.status === 'cancelled' && (
                  <button className="btn btn-primary" disabled={isUpdatingStatus} onClick={() => handleReactivate(viewOrder)}>
                    <Undo2 size={16} /> {t('ord.reactivate')}
                  </button>
                )}

                {viewOrder.status !== 'cancelled' && viewOrder.status !== 'delivered' && (
                  <button className="btn btn-danger-outline" disabled={isUpdatingStatus} onClick={() => setConfirmingCancel(true)}>
                    <Ban size={16} /> {t('ord.cancel_order')}
                  </button>
                )}

                {NEXT_STATUS[viewOrder.status] && (
                  <button className="btn btn-primary" disabled={isUpdatingStatus} onClick={() => handleAdvance(viewOrder)}>
                    <ArrowRight size={16} /> {t('ord.next_step')}
                  </button>
                )}

                {viewOrder.status === 'delivered' && (
                  <button className="btn btn-danger-outline" disabled={isUpdatingStatus} onClick={() => setConfirmingCancel(true)}>
                    <Ban size={16} /> {t('ord.cancel_order')}
                  </button>
                )}
              </div>
            ) : (
              <div className="cancel-confirm">
                <AlertTriangle size={22} color="#f43f5e" />
                <span>{t('ord.confirm_cancel')}</span>
                <div className="cancel-confirm-actions">
                  <button className="btn btn-ghost" onClick={() => setConfirmingCancel(false)}>{t('common.no')}</button>
                  <button className="btn btn-danger" disabled={isUpdatingStatus} onClick={() => handleStatusUpdate(viewOrder.id, 'cancelled')}>
                    {t('ord.yes_cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {receiptOrder && (
        <ReceiptModal
          isOpen={!!receiptOrder}
          onClose={() => setReceiptOrder(null)}
          order={receiptOrder}
          shopName={shopName}
          sellerName={sellerName}
        />
      )}

      {/* Modal Retour Produit */}
      {returnOrder && (
        <Modal isOpen={!!returnOrder} onClose={() => setReturnOrder(null)} title={`${t('ord.return_items')} - #${returnOrder.id.slice(0, 8)}`}>
          <div className="modal-form">
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {language === 'fr' ? 'Sélectionnez les articles à retourner et indiquez les quantités.' : 'Select the items to return and enter the quantities.'}
            </p>
            {returnOrder.items?.map((item, idx) => {
              const prodName = getProductName(item.product_id);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{prodName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {language === 'fr' ? 'Acheté' : 'Purchased'} : {item.quantity} × {formatGNF(item.unit_price)}
                    </div>
                  </div>
                  <div className="qty-stepper">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => {
                        const val = Math.max(0, (returnItems[idx]?.quantity || 0) - 1);
                        setReturnItems(prev => prev.map((ri, i) => i === idx ? { ...ri, quantity: val } : ri));
                      }}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="qty-value">{returnItems[idx]?.quantity || 0}</span>
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => {
                        const val = Math.min(item.quantity, (returnItems[idx]?.quantity || 0) + 1);
                        setReturnItems(prev => prev.map((ri, i) => i === idx ? { ...ri, quantity: val } : ri));
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">{language === 'fr' ? 'Motif du retour *' : 'Return reason *'}</label>
              <textarea className="input" rows={2} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder={language === 'fr' ? 'Ex: Produit défectueux, erreur de commande...' : 'Ex: Defective product, order error...'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input type="checkbox" id="restock-check" checked={restockInventory} onChange={e => setRestockInventory(e.target.checked)} />
              <label htmlFor="restock-check" style={{ fontSize: '0.85rem' }}>{language === 'fr' ? 'Réintégrer les articles en stock' : 'Restock the items'}</label>
            </div>
            {returnItems.filter(i => i.quantity > 0).length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{language === 'fr' ? 'Récapitulatif du remboursement' : 'Refund summary'}</div>
                {returnItems.filter(i => i.quantity > 0).map((ri, idx) => {
                  const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                  if (!origItem) return null;
                  return <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ri.quantity}× {getProductName(ri.product_id)} = {formatGNF(ri.quantity * origItem.unit_price)}</div>;
                })}
                <div style={{ fontWeight: 700, marginTop: '0.5rem', color: 'var(--color-brand-500)' }}>
                  {language === 'fr' ? 'Total remboursement' : 'Total refund'} : {formatGNF(returnItems.reduce((acc, ri) => {
                    const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                    return acc + (origItem ? ri.quantity * origItem.unit_price : 0);
                  }, 0))}
                </div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setReturnOrder(null)}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitReturn} disabled={isSubmittingReturn}>
                {isSubmittingReturn ? (language === 'fr' ? 'Traitement...' : 'Processing...') : (language === 'fr' ? 'Valider le retour' : 'Confirm return')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.25rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.75rem; margin-bottom: 0.25rem; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; }
        .header-actions { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }

        /* Pastilles de filtre statut — grandes, icône + couleur, pas de lecture requise */
        .status-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .status-pill {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.55rem 1rem; min-height: 40px;
          border-radius: 999px; border: 1.5px solid var(--border-default);
          background: var(--surface-1); color: var(--text-secondary);
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          transition: all 0.15s ease;
        }
        .status-pill:hover { border-color: var(--pill-color, var(--color-brand-500)); }
        .status-pill.active {
          background: var(--pill-color, var(--color-brand-500));
          border-color: var(--pill-color, var(--color-brand-500));
          color: #fff;
        }

        /* Filtres date + recherche */
        .filters-bar {
          display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
          padding: 1rem; margin: 0;
        }
        .date-filter { display: flex; align-items: center; gap: 0.5rem; }
        .date-filter .input { width: 150px; min-height: 42px; }
        .date-sep { color: var(--text-muted); font-size: 0.85rem; }
        .search-wrap { position: relative; flex: 1; min-width: 200px; }
        .search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .search-input { width: 100%; min-height: 42px; padding-left: 2.25rem; }
        .results-count { color: var(--text-muted); font-size: 0.85rem; white-space: nowrap; }

        .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.75rem; padding: 3.5rem 1rem; color: var(--text-muted); font-size: 0.9rem;
        }

        /* ── Liste de commandes en cartes ── */
        .orders-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .order-card {
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 1rem 1.25rem;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex; flex-direction: column; gap: 0.75rem;
        }
        .order-card:hover { border-color: var(--color-brand-500); box-shadow: 0 4px 14px rgba(0,0,0,0.08); }

        .oc-top { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); }
        .oc-id { font-family: monospace; }

        .oc-main { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .oc-client { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
        .oc-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700));
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 1rem;
        }
        .oc-client-info { display: flex; flex-direction: column; min-width: 0; }
        .oc-client-name { font-weight: 700; font-size: 1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .oc-items { font-size: 0.78rem; color: var(--text-muted); }
        .oc-amount { font-weight: 800; font-size: 1.15rem; color: var(--color-brand-400); font-family: var(--font-display); white-space: nowrap; }

        .oc-tracker-row { padding-top: 0.25rem; border-top: 1px solid var(--border-subtle); }

        .oc-actions { display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; }
        .oc-btn {
          width: 42px; height: 42px; border-radius: 10px;
          background: var(--surface-2); border: 1px solid var(--border-default);
          color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s ease; flex-shrink: 0;
        }
        .oc-btn:hover { border-color: var(--color-brand-500); color: var(--color-brand-400); }
        .oc-btn--primary { background: var(--color-brand-500); border-color: var(--color-brand-600); color: #fff; }
        .oc-btn--primary:hover { background: var(--color-brand-400); color: #fff; }

        /* ── Suivi visuel (tracker) ── */
        .tracker { display: flex; align-items: center; }
        .tracker--cancelled {
          display: flex; align-items: center; gap: 0.5rem;
          color: #f43f5e; font-weight: 700; font-size: 0.85rem;
        }
        .tracker-step-wrap { display: flex; align-items: center; flex: 1; }
        .tracker-step-col { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
        .tracker-step {
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--surface-3); color: var(--text-disabled);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s ease;
        }
        .tracker-step.done { background: var(--color-brand-500); color: #fff; }
        .tracker-step.current { box-shadow: 0 0 0 3px var(--brand-alpha-20, rgba(109,213,196,0.2)); }
        .tracker-line { flex: 1; height: 3px; background: var(--surface-3); margin: 0 4px; border-radius: 2px; }
        .tracker-line.done { background: var(--color-brand-500); }
        .tracker-step-label { font-size: 0.68rem; color: var(--text-muted); text-align: center; white-space: nowrap; }
        .tracker--labeled .tracker-step { width: 36px; height: 36px; }
        .tracker-big { padding: 0.5rem 0 1rem; }

        /* Pagination */
        .pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; gap: 1rem; flex-wrap: wrap; }
        .per-page-wrap { display: flex; align-items: center; gap: 0.5rem; }
        .per-page-label { font-size: 0.85rem; color: var(--text-muted); }
        .page-nav { display: flex; align-items: center; gap: 0.75rem; }
        .page-indicator { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; }

        /* Form Styles */
        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .items-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .item-row { display: flex; gap: 0.5rem; align-items: center; }
        .btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }

        .btn-danger-outline {
          display: inline-flex; align-items: center; gap: 0.4rem;
          min-height: 44px; padding: 0 1.125rem; border-radius: var(--radius-md);
          background: transparent; border: 1.5px solid #f43f5e; color: #f43f5e;
          font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: all 0.15s ease;
        }
        .btn-danger-outline:hover { background: rgba(244,63,94,0.08); }
        .btn-danger {
          display: inline-flex; align-items: center; gap: 0.4rem;
          min-height: 44px; padding: 0 1.125rem; border-radius: var(--radius-md);
          background: #f43f5e; border: 1.5px solid #f43f5e; color: #fff;
          font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.15s ease;
        }
        .btn-danger:hover { background: #e11d48; }

        .cancel-confirm {
          display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
          margin-top: 1.5rem; padding: 1.25rem; text-align: center;
          background: rgba(244,63,94,0.06); border: 1.5px solid rgba(244,63,94,0.25);
          border-radius: var(--radius-lg); font-weight: 600; color: var(--text-primary);
        }
        .cancel-confirm-actions { display: flex; gap: 0.75rem; }

        /* Stepper de quantité — mêmes proportions que le panier POS, pas de saisie clavier */
        .qty-stepper { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .qty-btn {
          width: 36px; height: 36px; background: var(--surface-2);
          border: 1px solid var(--border-default); border-radius: 8px;
          color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.1s ease; padding: 0;
        }
        .qty-btn:hover { background: var(--color-brand-500); border-color: var(--color-brand-600); color: #fff; }
        .qty-value { min-width: 28px; text-align: center; font-weight: 700; font-size: 0.95rem; }

        /* Detail grid */
        .detail-grid { display: flex; flex-direction: column; gap: 0.5rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); }
        .detail-row:last-of-type { border-bottom: none; }
        .detail-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .detail-value { font-size: 0.9rem; color: var(--text-primary); font-weight: 500; }
        .order-amount { font-weight: 700; color: var(--color-brand-400); font-family: var(--font-display); }

        /* Scanner */
        .scanner-row {
          display: flex; gap: 0.5rem; align-items: center;
          background: var(--overlay-subtle); border: 1px dashed var(--border-default);
          border-radius: 8px; padding: 0.5rem 0.75rem;
        }
        .scanner-input-wrap { display: flex; align-items: center; gap: 0.5rem; flex: 1; }
        .scanner-icon { color: var(--color-brand-500); flex-shrink: 0; }
        .scanner-input { border: none; background: transparent; font-size: 0.85rem; padding: 0.35rem 0; width: 100%; }
        .scanner-input:focus { box-shadow: none; border: none; }

        @media (max-width: 640px) {
          .oc-client-name { font-size: 0.92rem; }
          .status-pill { font-size: 0.8rem; padding: 0.5rem 0.85rem; }
          .date-filter .input { width: 130px; }
        }
      `}</style>
    </div>
  );
}
