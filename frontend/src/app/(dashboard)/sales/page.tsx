'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Eye, Printer, RotateCcw, Calendar, CreditCard as CardIcon, ArrowUp, ArrowDown, ArrowUpDown, Filter } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import type { Order } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { useLanguage } from '@/context/LanguageContext';
import { extractPaymentMethod } from '@/lib/saleNotes';
import { toDateInput, today } from '@/lib/period';
import {
  useSalesListQuery, useClientsQuery, useProductsQuery, useCategoriesQuery, useTeamQuery,
  queryKeys, type SalesFilters,
} from '@/lib/queries';

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

function formatDate(isoString: string, language: string) {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString));
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom' | '';

/** Calcule les bornes YYYY-MM-DD d'un preset calendaire en date LOCALE
 *  (jamais toISOString(), qui décale d'un jour selon le fuseau — voir
 *  lib/period.ts). Envoyées ensuite comme start_date/end_date explicites,
 *  déjà supportés par resolve_period() côté serveur : aucun changement
 *  backend nécessaire pour ces presets. */
function presetToRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  const to = toDateInput(now);
  switch (preset) {
    case 'today':
      return { from: to, to };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: toDateInput(y), to: toDateInput(y) };
    }
    case 'week': {
      const day = now.getDay() === 0 ? 7 : now.getDay(); // lundi = 1 .. dimanche = 7
      const monday = new Date(now); monday.setDate(now.getDate() - (day - 1));
      return { from: toDateInput(monday), to };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateInput(first), to };
    }
    case 'year': {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: toDateInput(first), to };
    }
    default:
      return null;
  }
}

export default function SalesHistoryPage() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  // Données de référence pour les filtres et la résolution des noms —
  // cache partagé avec Produits/Vendre/Clients/Équipe, comme partout
  // ailleurs (voir lib/queries.ts).
  const { data: clientsData } = useClientsQuery();
  const { data: productsData } = useProductsQuery();
  const { data: categoriesData } = useCategoriesQuery();
  const { data: teamData } = useTeamQuery();
  const clients = clientsData?.items ?? [];
  const products = productsData?.items ?? [];
  const categories = categoriesData?.items ?? [];
  const team = teamData ?? [];

  // Modals state
  const [selectedSale, setSelectedSale] = useState<Order | null>(null);
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

  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnItems, setReturnItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filtres — tous combinables, envoyés au serveur (voir useSalesListQuery).
  // Plus aucun chargement de tout l'historique en mémoire : reste rapide
  // même à plusieurs milliers de ventes (demande 1).
  const [datePreset, setDatePreset] = useState<DatePreset>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSellerId, setFilterSellerId] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterSaleType, setFilterSaleType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    setCurrentPage(1);
    const range = presetToRange(preset);
    if (range) {
      setFilterDateFrom(range.from);
      setFilterDateTo(range.to);
    } else if (preset !== 'custom') {
      setFilterDateFrom('');
      setFilterDateTo('');
    }
  };

  type SortField = 'created_at' | 'total';
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: SortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="sort-icon sort-icon--inactive" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="sort-icon" /> : <ArrowDown size={12} className="sort-icon" />;
  };

  const filters: SalesFilters = useMemo(() => ({
    clientId: filterClientId || undefined,
    productId: filterProductId || undefined,
    categoryId: filterCategoryId || undefined,
    sellerId: filterSellerId || undefined,
    paymentMethod: filterPayment !== 'all' ? filterPayment : undefined,
    saleType: filterSaleType !== 'all' ? filterSaleType : undefined,
    startDate: filterDateFrom || undefined,
    endDate: filterDateTo || undefined,
    sortBy: sortField,
    sortDir,
  }), [filterClientId, filterProductId, filterCategoryId, filterSellerId, filterPayment, filterSaleType, filterDateFrom, filterDateTo, sortField, sortDir]);

  const { data: salesData, isLoading } = useSalesListQuery(filters, currentPage, perPage);
  const sales = salesData?.items ?? [];
  const totalFiltered = salesData?.total ?? 0;
  const totalPages = salesData?.pages ?? 1;

  // Changer un filtre invalide la page courante — sans ce reset, un
  // filtre plus restrictif pouvait laisser l'utilisateur sur une page
  // vide au lieu de revenir à la première.
  useEffect(() => { setCurrentPage(1); }, [filterClientId, filterProductId, filterCategoryId, filterSellerId, filterPayment, filterSaleType, filterDateFrom, filterDateTo]);

  // Le backend résout désormais client_name/created_by_name/product_name
  // directement (voir OrderResponse) — le repli sur les listes clients/
  // produits chargées à part ne sert plus qu'aux ventes plus anciennes
  // encore en cache sans ces champs (offline non synchronisé, etc.).
  const getClientName = (order: Order) => {
    if (order.client_name) return order.client_name;
    const client = clients.find(c => c.id === order.client_id);
    if (client) return client.name;
    return language === 'fr' ? 'Passant' : 'Walk-in';
  };

  const getSellerName = (order: Order) => order.created_by_name || '—';

  const getProductName = (item: { product_id: string; product_name?: string | null }) =>
    item.product_name || products.find(p => p.id === item.product_id)?.name || 'Produit...';

  const getItemsSummary = (order: Order) => {
    const items = order.items || [];
    if (items.length === 0) return '—';
    const firstName = getProductName(items[0]);
    if (items.length === 1) return firstName;
    const extra = items.length - 1;
    return `${firstName} +${extra} ${language === 'fr' ? (extra > 1 ? 'autres' : 'autre') : (extra > 1 ? 'others' : 'other')}`;
  };

  // payment_method (colonne structurée, Phase 4) prioritaire ; repli sur
  // l'ancien texte libre dans notes pour les ventes antérieures à cette
  // colonne (jamais rétro-deviné côté serveur, voir OrderResponse).
  const getPaymentMethod = (order: Order) => order.payment_method || extractPaymentMethod(order.notes);

  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: language === 'fr' ? 'Espèces' : 'Cash',
      orange_money: 'Orange Money',
      card: language === 'fr' ? 'Carte' : 'Card',
      transfer: language === 'fr' ? 'Virement' : 'Transfer',
    };
    return labels[method] || method;
  };

  const getSaleTypeBadge = (order: Order) => {
    if (order.is_returned) return { label: language === 'fr' ? 'Retournée' : 'Returned', cls: 'returned' };
    if (order.is_partially_returned) return { label: language === 'fr' ? 'Retour partiel' : 'Partial return', cls: 'partial-return' };
    if (order.status === 'pending') return { label: language === 'fr' ? 'À crédit' : 'Credit', cls: 'credit' };
    return null;
  };

  // Export CSV — refait une requête dédiée avec les mêmes filtres (jusqu'au
  // plafond serveur de 500) plutôt que d'exporter seulement la page
  // actuellement affichée : l'export doit couvrir tout ce qui correspond
  // aux filtres, pas seulement ce qui est visible à l'écran.
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await api.getOrdersFiltered({ ...filters, page: 1, perPage: 500 });
      if (res.items.length === 0) {
        toast.error(language === 'fr' ? 'Aucune vente à exporter' : 'No sales to export');
        return;
      }
      const headers = [
        language === 'fr' ? 'ID Vente' : 'Sale ID',
        language === 'fr' ? 'Client' : 'Customer',
        language === 'fr' ? 'Vendeur' : 'Seller',
        language === 'fr' ? 'Produits' : 'Products',
        language === 'fr' ? 'Montant' : 'Amount',
        language === 'fr' ? 'Articles' : 'Items',
        language === 'fr' ? 'Paiement' : 'Payment',
        language === 'fr' ? 'Notes' : 'Notes',
        'Date'
      ];
      const rows = res.items.map(o => [
        `BF-${o.id.slice(0, 8).toUpperCase()}`,
        getClientName(o),
        getSellerName(o),
        (o.items || []).map(i => `${i.quantity}x ${getProductName(i)}`).join(' + '),
        String(o.total || 0),
        String(o.items?.length || 0),
        getPaymentLabel(getPaymentMethod(o)),
        o.notes || '',
        new Date(o.created_at).toLocaleDateString('fr-FR'),
      ]);
      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ventes_caisse_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? "Erreur lors de l'export" : 'Export error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Return modal handler
  const openReturnModal = (order: Order) => {
    setReturnOrder(order);
    setReturnReason('');
    setRestockInventory(true);
    setReturnItems(order.items?.map(item => ({ product_id: item.product_id, quantity: 0 })) || []);
  };

  const handleSubmitReturn = async () => {
    if (!returnOrder) return;
    const itemsToReturn = returnItems.filter(ri => ri.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error(language === 'fr' ? 'Sélectionnez au moins un produit à retourner' : 'Select at least one product to return');
      return;
    }
    if (!returnReason.trim()) {
      toast.error(language === 'fr' ? 'Indiquez le motif du retour' : 'Please provide a return reason');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await api.returnOrderItems(returnOrder.id, itemsToReturn, returnReason, restockInventory);
      const debtReduced = (res as any)?.debt_reduced_amount || 0;
      toast.success(
        debtReduced > 0
          ? (language === 'fr' ? `Retour validé — dette réduite de ${formatGNF(debtReduced)}` : `Return processed — debt reduced by ${formatGNF(debtReduced)}`)
          : (language === 'fr' ? 'Retour validé avec succès' : 'Return processed successfully')
      );
      setReturnOrder(null);
      queryClient.invalidateQueries({ queryKey: ['sales-list'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? 'Erreur lors du retour' : 'Error processing return'));
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('sales.title') || 'Historique des Ventes'}</h1>
          <p className="page-subtitle">{t('sales.subtitle') || 'Consultez et gérez les ventes de votre boutique.'}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleExport} disabled={isExporting}>
            <Download size={16} /> {isExporting ? (language === 'fr' ? 'Export...' : 'Exporting...') : (language === 'fr' ? 'Exporter CSV' : 'Export CSV')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar card">
        <div className="filters-row">
          <div className="filter-group">
            <Calendar size={14} className="filter-icon" />
            <select className="input" value={datePreset} onChange={e => applyPreset(e.target.value as DatePreset)}>
              <option value="">{language === 'fr' ? 'Toute période' : 'All time'}</option>
              <option value="today">{language === 'fr' ? "Aujourd'hui" : 'Today'}</option>
              <option value="yesterday">{language === 'fr' ? 'Hier' : 'Yesterday'}</option>
              <option value="week">{language === 'fr' ? 'Cette semaine' : 'This week'}</option>
              <option value="month">{language === 'fr' ? 'Ce mois' : 'This month'}</option>
              <option value="year">{language === 'fr' ? 'Cette année' : 'This year'}</option>
              <option value="custom">{language === 'fr' ? 'Personnalisée' : 'Custom'}</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <div className="filter-group">
              <input type="date" className="input" value={filterDateFrom} max={filterDateTo || today()} onChange={e => setFilterDateFrom(e.target.value)} />
              <span className="filter-separator">{language === 'fr' ? 'à' : 'to'}</span>
              <input type="date" className="input" value={filterDateTo} min={filterDateFrom} max={today()} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
          )}

          <div className="filter-group">
            <select className="input" value={filterClientId} onChange={e => setFilterClientId(e.target.value)}>
              <option value="">{language === 'fr' ? 'Tous les clients' : 'All clients'}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <select className="input" value={filterProductId} onChange={e => setFilterProductId(e.target.value)}>
              <option value="">{language === 'fr' ? 'Tous les produits' : 'All products'}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <select className="input" value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)}>
              <option value="">{language === 'fr' ? 'Toutes catégories' : 'All categories'}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <select className="input" value={filterSellerId} onChange={e => setFilterSellerId(e.target.value)}>
              <option value="">{language === 'fr' ? 'Tous les vendeurs' : 'All sellers'}</option>
              {team.map((m: any) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <CardIcon size={14} className="filter-icon" />
            <select className="input" value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
              <option value="all">{language === 'fr' ? 'Tous les paiements' : 'All payments'}</option>
              <option value="cash">{language === 'fr' ? 'Espèces' : 'Cash'}</option>
              <option value="orange_money">Orange Money</option>
              <option value="card">{language === 'fr' ? 'Carte bancaire' : 'Credit Card'}</option>
              <option value="transfer">{language === 'fr' ? 'Virement' : 'Transfer'}</option>
            </select>
          </div>

          <div className="filter-group">
            <Filter size={14} className="filter-icon" />
            <select className="input" value={filterSaleType} onChange={e => setFilterSaleType(e.target.value)}>
              <option value="all">{language === 'fr' ? 'Tous types' : 'All types'}</option>
              <option value="normal">{language === 'fr' ? 'Vente normale' : 'Normal sale'}</option>
              <option value="credit">{language === 'fr' ? 'Vente à crédit' : 'Credit sale'}</option>
              <option value="returned">{language === 'fr' ? 'Vente retournée' : 'Returned sale'}</option>
              <option value="partial_return">{language === 'fr' ? 'Retour partiel' : 'Partial return'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="table-container card">
        {isLoading && sales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
        ) : sales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {t('sales.no_sales') || 'Aucune vente trouvée.'}
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('sales.receipt_no') || 'N° Reçu'}</th>
                  <th>Client</th>
                  <th>{language === 'fr' ? 'Vendeur' : 'Seller'}</th>
                  <th>{language === 'fr' ? 'Produits' : 'Products'}</th>
                  <th className="sortable-th" onClick={() => toggleSort('created_at')}>Date / Heure {sortIcon('created_at')}</th>
                  <th className="text-right sortable-th" onClick={() => toggleSort('total')}>Montant {sortIcon('total')}</th>
                  <th>{t('sales.payment_method') || 'Paiement'}</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(order => {
                  const paymentMethod = getPaymentMethod(order);
                  const badge = getSaleTypeBadge(order);
                  return (
                    <tr key={order.id}>
                      <td>
                        <span className="receipt-badge" onClick={() => setSelectedSale(order)}>
                          BF-{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        {badge && <span className={`type-badge ${badge.cls}`}>{badge.label}</span>}
                      </td>
                      <td>
                        <span className="client-name">{getClientName(order)}</span>
                      </td>
                      <td className="text-muted">{getSellerName(order)}</td>
                      <td className="text-muted items-summary" title={order.items?.map(i => `${i.quantity} × ${getProductName(i)}`).join(', ')}>
                        {getItemsSummary(order)}
                      </td>
                      <td className="text-muted">{formatDate(order.created_at, language)}</td>
                      <td className="text-right font-bold text-emerald">
                        {formatGNF(Number(order.total) || 0)}
                      </td>
                      <td>
                        <span className={`payment-pill ${paymentMethod}`}>
                          {getPaymentLabel(paymentMethod)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="actions-flex">
                          <button
                            className="btn btn-ghost btn-icon"
                            title={language === 'fr' ? 'Voir détails' : 'View details'}
                            onClick={() => setSelectedSale(order)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon"
                            title={t('sales.view_receipt') || 'Imprimer reçu'}
                            onClick={() => setReceiptOrder(order)}
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-danger-icon"
                            title={t('sales.refund') || 'Retourner'}
                            onClick={() => openReturnModal(order)}
                          >
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination — pilotée par le serveur (total/pages), plus de
                découpage d'un tableau déjà entièrement chargé en mémoire. */}
            <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {language === 'fr' ? `Affichage de ${(currentPage - 1) * perPage + 1} à ${Math.min(currentPage * perPage, totalFiltered)} sur ${totalFiltered} ventes` : `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(currentPage * perPage, totalFiltered)} of ${totalFiltered} sales`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <select
                  className="input"
                  style={{ width: '80px' }}
                  value={perPage}
                  onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <button className="btn btn-ghost btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                  {language === 'fr' ? 'Précédent' : 'Previous'}
                </button>
                <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                  {language === 'fr' ? 'Suivant' : 'Next'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal Detail Sale */}
      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title={language === 'fr' ? 'Détails de la Vente' : 'Sale Details'}>
        {selectedSale && (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">{language === 'fr' ? 'Article(s)' : 'Item(s)'}</span><span className="detail-value">{getItemsSummary(selectedSale)}</span></div>
            <div className="detail-row"><span className="detail-label">Client</span><span className="detail-value">{getClientName(selectedSale)}</span></div>
            <div className="detail-row"><span className="detail-label">{language === 'fr' ? 'Vendu par' : 'Sold by'}</span><span className="detail-value">{getSellerName(selectedSale)}</span></div>
            <div className="detail-row"><span className="detail-label">{language === 'fr' ? 'Mode de Paiement' : 'Payment Method'}</span><span className="detail-value">{getPaymentLabel(getPaymentMethod(selectedSale))}</span></div>
            <div className="detail-row"><span className="detail-label">Total</span><span className="detail-value order-amount text-emerald">{formatGNF(Number(selectedSale.total) || 0)}</span></div>
            {(selectedSale.returned_amount || 0) > 0 && (
              <div className="detail-row"><span className="detail-label">{language === 'fr' ? 'Retourné' : 'Returned'}</span><span className="detail-value" style={{ color: '#ef4444' }}>{formatGNF(selectedSale.returned_amount || 0)}</span></div>
            )}
            <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{formatDate(selectedSale.created_at, language)}</span></div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{language === 'fr' ? 'Articles achetés' : 'Purchased items'}</div>
              {selectedSale.items?.map((item, i) => (
                <div key={i} className="detail-row" style={{ paddingLeft: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="detail-label">{item.quantity} × {getProductName(item)}</span>
                  <span className="detail-value">{formatGNF(Number(item.unit_price) * item.quantity)}</span>
                </div>
              ))}
            </div>

            {selectedSale.notes && (
              <div className="detail-row" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                <span className="detail-label">Notes</span>
                <span className="detail-value">{selectedSale.notes}</span>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setSelectedSale(null)}>{language === 'fr' ? 'Fermer' : 'Close'}</button>
              <button className="btn btn-primary" onClick={() => { const s = selectedSale; setSelectedSale(null); setReceiptOrder(s); }}>
                <Printer size={14} /> {language === 'fr' ? 'Reçu de caisse' : 'Print receipt'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Reçu */}
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
        <Modal isOpen={!!returnOrder} onClose={() => setReturnOrder(null)} title={language === 'fr' ? `Retour Produit - Vente #${returnOrder.id.slice(0, 8).toUpperCase()}` : `Product Return - Sale #${returnOrder.id.slice(0, 8).toUpperCase()}`}>
          <div className="modal-form">
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {language === 'fr' ? 'Sélectionnez les articles à retourner et indiquez les quantités.' : 'Select the items to return and specify the quantities.'}
            </p>
            {returnOrder.status === 'pending' && (
              <p style={{ color: 'var(--color-brand-500)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {language === 'fr' ? '⚠️ Vente à crédit : le retour réduira directement la dette liée plutôt que de rembourser en espèces.' : '⚠️ Credit sale: the return will reduce the linked debt directly instead of a cash refund.'}
              </p>
            )}
            {returnOrder.items?.map((item, idx) => {
              const prodName = getProductName(item);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{prodName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'fr' ? `Acheté : ${item.quantity} × ${formatGNF(item.unit_price)}` : `Bought: ${item.quantity} × ${formatGNF(item.unit_price)}`}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'fr' ? 'Retour :' : 'Return:'}</label>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={returnItems[idx]?.quantity || 0}
                      onChange={e => {
                        const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                        setReturnItems(prev => prev.map((ri, i) => i === idx ? { ...ri, quantity: val } : ri));
                      }}
                      className="input"
                      style={{ width: '70px', textAlign: 'center' }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">{language === 'fr' ? 'Motif du retour *' : 'Return Reason *'}</label>
              <textarea className="input" rows={2} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder={language === 'fr' ? "Ex: Erreur de commande, produit défectueux..." : "Ex: Order error, defective product..."} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input type="checkbox" id="restock-check-sales" checked={restockInventory} onChange={e => setRestockInventory(e.target.checked)} />
              <label htmlFor="restock-check-sales" style={{ fontSize: '0.85rem' }}>{language === 'fr' ? 'Réintégrer les articles en stock' : 'Restock returned items'}</label>
            </div>
            {returnItems.filter(i => i.quantity > 0).length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{language === 'fr' ? 'Récapitulatif du remboursement' : 'Refund summary'}</div>
                {returnItems.filter(i => i.quantity > 0).map((ri, idx) => {
                  const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                  if (!origItem) return null;
                  return <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ri.quantity} × {getProductName(origItem)} = {formatGNF(ri.quantity * origItem.unit_price)}</div>;
                })}
                <div style={{ fontWeight: 700, marginTop: '0.5rem', color: 'var(--color-brand-500)' }}>
                  {language === 'fr' ? 'Total remboursement : ' : 'Total refund: '} {formatGNF(returnItems.reduce((acc, ri) => {
                    const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                    return acc + (origItem ? ri.quantity * origItem.unit_price : 0);
                  }, 0))}
                </div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setReturnOrder(null)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitReturn} disabled={isSubmittingReturn}>
                {isSubmittingReturn ? (language === 'fr' ? 'Traitement...' : 'Processing...') : (language === 'fr' ? 'Valider le retour' : 'Submit Return')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin: 0; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem; }
        .header-actions { display: flex; gap: 0.75rem; }

        .filters-bar { padding: 1.25rem; }
        .filters-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; max-width: 100%; }
        /* min-width:0 est essentiel : un item flex refuse par défaut de
           rétrécir sous la taille "naturelle" de son contenu (ici, un
           <select> dont une option — un long nom de client/produit —
           dépasse le viewport d'un téléphone), même avec flex-wrap sur le
           parent. Sans ça, un seul filtre avec un nom long forçait toute
           la barre (et donc la page) à défiler horizontalement. */
        .filter-group { display: flex; align-items: center; gap: 0.5rem; background: var(--surface-0); border: 1px solid var(--border-subtle); padding: 0.25rem 0.75rem; border-radius: 8px; min-width: 0; max-width: 100%; }
        .filter-icon { color: var(--text-muted); flex-shrink: 0; }
        .filter-separator { color: var(--text-muted); font-size: 0.85rem; flex-shrink: 0; }
        .filter-group .input { border: none; padding: 0.25rem 0; background: transparent; color: var(--text-primary); outline: none; font-size: 0.9rem; max-width: 180px; min-width: 0; }

        .receipt-badge { background: rgba(59, 130, 246, 0.1); color: #3b82f6; font-family: monospace; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .receipt-badge:hover { background: rgba(59, 130, 246, 0.2); }
        .type-badge { display: inline-block; margin-left: 0.4rem; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 999px; vertical-align: middle; }
        .type-badge.credit { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
        .type-badge.returned { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .type-badge.partial-return { background: rgba(249, 115, 22, 0.15); color: #f97316; }

        .sortable-th { cursor: pointer; user-select: none; white-space: nowrap; }
        .sortable-th:hover { color: var(--text-primary); }
        .sort-icon { vertical-align: middle; margin-left: 2px; opacity: 0.85; }
        .sort-icon--inactive { opacity: 0.35; }
        .items-summary { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .client-name { font-weight: 500; color: var(--text-primary); }
        .text-emerald { color: #10b981 !important; }
        .font-bold { font-weight: 700; }

        .payment-pill { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 999px; text-transform: uppercase; }
        .payment-pill.cash { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .payment-pill.orange_money { background: rgba(249, 115, 22, 0.15); color: #f97316; }
        .payment-pill.card { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .payment-pill.transfer { background: rgba(168, 85, 247, 0.15); color: #a855f7; }

        .actions-flex { display: flex; justify-content: center; gap: 0.5rem; }

        /* Modal details styling */
        .detail-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px dashed var(--border-subtle); }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: var(--text-muted); font-size: 0.9rem; }
        .detail-value { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
        .order-amount { font-size: 1.1rem; font-weight: 700; }

        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
        .form-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
      `}</style>
    </div>
  );
}
