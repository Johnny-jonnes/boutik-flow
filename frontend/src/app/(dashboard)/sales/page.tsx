'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Download, Eye, Printer, RotateCcw, Calendar, CreditCard as CardIcon, ArrowUp, ArrowDown, ArrowUpDown, Filter,
  User, Package, FolderTree, UserCog, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X, ReceiptText,
  SearchX, WifiOff, Users, History,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import type { Order } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { useLanguage } from '@/context/LanguageContext';
import { extractPaymentMethod } from '@/lib/saleNotes';
import { toDateInput, today } from '@/lib/period';
import { formatGNF, formatNumber, initials, hueFromString, paymentLabel, paymentColor } from '@/lib/format';
import {
  useSalesListQuery, useClientsQuery, useProductsQuery, useCategoriesQuery, useTeamQuery,
  queryKeys, type SalesFilters,
} from '@/lib/queries';
import { PageHeader } from '@/components/ui/PageHeader';
import s from './sales.module.css';

function formatDay(isoString: string, language: string) {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(isoString));
}

function formatTime(isoString: string, language: string) {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoString));
}

function formatDate(isoString: string, language: string) {
  return `${formatDay(isoString, language)} · ${formatTime(isoString, language)}`;
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom' | '';

const DATE_PRESETS: { key: DatePreset; fr: string; en: string }[] = [
  { key: '', fr: 'Toute période', en: 'All time' },
  { key: 'today', fr: "Aujourd'hui", en: 'Today' },
  { key: 'yesterday', fr: 'Hier', en: 'Yesterday' },
  { key: 'week', fr: 'Cette semaine', en: 'This week' },
  { key: 'month', fr: 'Ce mois', en: 'This month' },
  { key: 'year', fr: 'Cette année', en: 'This year' },
  { key: 'custom', fr: 'Personnalisée', en: 'Custom' },
];

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

/** Liste déroulante de filtre : étiquette + icône + état "actif" mis en évidence. */
function FilterSelect({
  label, icon, value, active, onChange, children,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  active: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      <span className={`${s.selectWrap} ${active ? s.selectActive : ''}`}>
        {icon}
        <select className={s.select} value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
        <ChevronDown size={15} className={s.selectChevron} />
      </span>
    </label>
  );
}

export default function SalesHistoryPage() {
  const { t, language } = useLanguage();
  const fr = language === 'fr';
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Changer un filtre invalide la page courante — sans ce reset, un
  // filtre plus restrictif pouvait laisser l'utilisateur sur une page
  // vide au lieu de revenir à la première.
  const withPageReset = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
  };

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

  const activeFilterCount = [
    filterClientId, filterProductId, filterCategoryId, filterSellerId,
    filterPayment !== 'all' ? filterPayment : '', filterSaleType !== 'all' ? filterSaleType : '',
  ].filter(Boolean).length;

  const resetFilters = () => {
    applyPreset('');
    setFilterClientId('');
    setFilterProductId('');
    setFilterCategoryId('');
    setFilterSellerId('');
    setFilterPayment('all');
    setFilterSaleType('all');
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
    if (sortField !== field) return <ArrowUpDown size={12} className={s.sortIconIdle} />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
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

  const { data: salesData, isLoading, isError, refetch } = useSalesListQuery(filters, currentPage, perPage);
  const sales = salesData?.items ?? [];
  const totalFiltered = salesData?.total ?? 0;
  const totalPages = salesData?.pages ?? 1;

  // Le backend résout désormais client_name/created_by_name/product_name
  // directement (voir OrderResponse) — le repli sur les listes clients/
  // produits chargées à part ne sert plus qu'aux ventes plus anciennes
  // encore en cache sans ces champs (offline non synchronisé, etc.).
  const getClientName = (order: Order) => {
    if (order.client_name) return order.client_name;
    const client = clients.find(c => c.id === order.client_id);
    if (client) return client.name;
    return fr ? 'Passant' : 'Walk-in';
  };
  const isWalkin = (order: Order) => {
    const name = getClientName(order);
    return name === 'Passant' || name === 'Walk-in';
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
    return `${firstName} +${extra} ${fr ? (extra > 1 ? 'autres' : 'autre') : (extra > 1 ? 'others' : 'other')}`;
  };

  // payment_method (colonne structurée, Phase 4) prioritaire ; repli sur
  // l'ancien texte libre dans notes pour les ventes antérieures à cette
  // colonne (jamais rétro-deviné côté serveur, voir OrderResponse).
  const getPaymentMethod = (order: Order) => order.payment_method || extractPaymentMethod(order.notes);

  const getPaymentLabel = (method: string) => paymentLabel(method, language);

  const getSaleTypeBadge = (order: Order) => {
    if (order.is_returned) return { label: fr ? 'Retournée' : 'Returned', cls: s.typeReturned };
    if (order.is_partially_returned) return { label: fr ? 'Retour partiel' : 'Partial return', cls: s.typePartial };
    if (order.status === 'pending') return { label: fr ? 'À crédit' : 'Credit', cls: s.typeCredit };
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
        toast.error(fr ? 'Aucune vente à exporter' : 'No sales to export');
        return;
      }
      const headers = [
        fr ? 'ID Vente' : 'Sale ID',
        fr ? 'Client' : 'Customer',
        fr ? 'Vendeur' : 'Seller',
        fr ? 'Produits' : 'Products',
        fr ? 'Montant' : 'Amount',
        fr ? 'Articles' : 'Items',
        fr ? 'Paiement' : 'Payment',
        fr ? 'Notes' : 'Notes',
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
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : (fr ? "Erreur lors de l'export" : 'Export error'));
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
      toast.error(fr ? 'Sélectionnez au moins un produit à retourner' : 'Select at least one product to return');
      return;
    }
    if (!returnReason.trim()) {
      toast.error(fr ? 'Indiquez le motif du retour' : 'Please provide a return reason');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res: { debt_reduced_amount?: number } | null = await api.returnOrderItems(returnOrder.id, itemsToReturn, returnReason, restockInventory);
      const debtReduced = res?.debt_reduced_amount || 0;
      toast.success(
        debtReduced > 0
          ? (fr ? `Retour validé — dette réduite de ${formatGNF(debtReduced)}` : `Return processed — debt reduced by ${formatGNF(debtReduced)}`)
          : (fr ? 'Retour validé avec succès' : 'Return processed successfully')
      );
      setReturnOrder(null);
      queryClient.invalidateQueries({ queryKey: ['sales-list'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.products() });
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : (fr ? 'Erreur lors du retour' : 'Error processing return'));
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const avatarFor = (order: Order, className = '') => {
    const walkin = isWalkin(order);
    const name = getClientName(order);
    return (
      <span
        className={`${s.avatar} ${walkin ? s.avatarWalkin : ''} ${className}`}
        style={{ '--hue': hueFromString(name) } as React.CSSProperties}
      >
        {walkin ? <Users size={15} /> : initials(name)}
      </span>
    );
  };

  const payPill = (order: Order) => {
    const method = getPaymentMethod(order);
    return (
      <span className={s.payPill} style={{ '--c': paymentColor(method) } as React.CSSProperties}>
        <span className={s.payDot} />{getPaymentLabel(method)}
      </span>
    );
  };

  const actionButtons = (order: Order) => (
    <div className={s.actions}>
      <button type="button" className={s.iconBtn} title={fr ? 'Voir détails' : 'View details'} aria-label={fr ? 'Voir détails' : 'View details'} onClick={() => setSelectedSale(order)}>
        <Eye size={16} />
      </button>
      <button type="button" className={s.iconBtn} title={t('sales.view_receipt') || 'Imprimer reçu'} aria-label={t('sales.view_receipt') || 'Imprimer reçu'} onClick={() => setReceiptOrder(order)}>
        <Printer size={16} />
      </button>
      <button type="button" className={`${s.iconBtn} ${s.iconBtnDanger}`} title={t('sales.refund') || 'Retourner'} aria-label={t('sales.refund') || 'Retourner'} onClick={() => openReturnModal(order)}>
        <RotateCcw size={16} />
      </button>
    </div>
  );

  const amountBlock = (order: Order) => (
    <>
      <span className={s.amount}>{formatGNF(Number(order.total) || 0)}</span>
      {(order.returned_amount || 0) > 0 && (
        <span className={s.returned}>−{formatGNF(order.returned_amount || 0)} {fr ? 'retourné' : 'returned'}</span>
      )}
    </>
  );

  const sortValue = `${sortField}:${sortDir}`;
  const onMobileSort = (value: string) => {
    const [field, dir] = value.split(':') as [SortField, 'asc' | 'desc'];
    setSortField(field);
    setSortDir(dir);
    setCurrentPage(1);
  };

  return (
    <div className={`${s.page} fade-in`}>
      <PageHeader
        icon={History}
        title={t('sales.title') || 'Historique des Ventes'}
        subtitle={t('sales.subtitle') || 'Consultez et gérez les ventes de votre boutique.'}
        actions={
          <>
            <span className={s.totalChip}><ReceiptText size={15} />{formatNumber(totalFiltered)} {fr ? 'ventes' : 'sales'}</span>
            <button className="btn btn-secondary" onClick={handleExport} disabled={isExporting}>
              <Download size={16} /> {isExporting ? (fr ? 'Export...' : 'Exporting...') : (fr ? 'Exporter CSV' : 'Export CSV')}
            </button>
          </>
        }
      />

      {/* ── Filtres ── */}
      <section className={s.filterCard}>
        <div className={s.filterTop}>
          <div className={s.presetRow} role="tablist" aria-label={fr ? 'Période' : 'Period'}>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.key || 'all'}
                type="button"
                role="tab"
                aria-selected={datePreset === p.key}
                className={`${s.preset} ${datePreset === p.key ? s.presetActive : ''}`}
                onClick={() => applyPreset(p.key)}
              >
                {p.key === '' && <Calendar size={14} />}
                {fr ? p.fr : p.en}
              </button>
            ))}
          </div>
          {(activeFilterCount > 0 || datePreset !== '') && (
            <button type="button" className={s.resetBtn} onClick={resetFilters}>
              <X size={14} /> {fr ? 'Réinitialiser' : 'Reset'}
            </button>
          )}
        </div>

        {datePreset === 'custom' && (
          <div className={s.customRange}>
            <input type="date" className="input" value={filterDateFrom} max={filterDateTo || today()}
              onChange={e => withPageReset(setFilterDateFrom)(e.target.value)} aria-label={fr ? 'Date de début' : 'Start date'} />
            <span>{fr ? 'à' : 'to'}</span>
            <input type="date" className="input" value={filterDateTo} min={filterDateFrom} max={today()}
              onChange={e => withPageReset(setFilterDateTo)(e.target.value)} aria-label={fr ? 'Date de fin' : 'End date'} />
          </div>
        )}

        <button type="button" className={s.filterToggle} onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}>
          <span className={s.filterToggleLeft}>
            <SlidersHorizontal size={16} /> {fr ? 'Filtres avancés' : 'Advanced filters'}
            {activeFilterCount > 0 && <span className={s.filterCount}>{activeFilterCount}</span>}
          </span>
          <ChevronDown size={16} className={`${s.toggleChevron} ${filtersOpen ? s.toggleChevronOpen : ''}`} />
        </button>

        <div className={`${s.filterGrid} ${filtersOpen ? s.filterGridOpen : ''}`}>
          <FilterSelect label="Client" icon={<User size={15} />} value={filterClientId} active={!!filterClientId} onChange={withPageReset(setFilterClientId)}>
            <option value="">{fr ? 'Tous' : 'All'}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect label={fr ? 'Produit' : 'Product'} icon={<Package size={15} />} value={filterProductId} active={!!filterProductId} onChange={withPageReset(setFilterProductId)}>
            <option value="">{fr ? 'Tous' : 'All'}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </FilterSelect>
          <FilterSelect label={fr ? 'Catégorie' : 'Category'} icon={<FolderTree size={15} />} value={filterCategoryId} active={!!filterCategoryId} onChange={withPageReset(setFilterCategoryId)}>
            <option value="">{fr ? 'Toutes' : 'All'}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FilterSelect>
          <FilterSelect label={fr ? 'Vendeur' : 'Seller'} icon={<UserCog size={15} />} value={filterSellerId} active={!!filterSellerId} onChange={withPageReset(setFilterSellerId)}>
            <option value="">{fr ? 'Tous' : 'All'}</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </FilterSelect>
          <FilterSelect label={fr ? 'Paiement' : 'Payment'} icon={<CardIcon size={15} />} value={filterPayment} active={filterPayment !== 'all'} onChange={withPageReset(setFilterPayment)}>
            <option value="all">{fr ? 'Tous' : 'All'}</option>
            <option value="cash">{fr ? 'Espèces' : 'Cash'}</option>
            <option value="orange_money">Orange Money</option>
            <option value="card">{fr ? 'Carte bancaire' : 'Credit Card'}</option>
            <option value="transfer">{fr ? 'Virement' : 'Transfer'}</option>
          </FilterSelect>
          <FilterSelect label={fr ? 'Type de vente' : 'Sale type'} icon={<Filter size={15} />} value={filterSaleType} active={filterSaleType !== 'all'} onChange={withPageReset(setFilterSaleType)}>
            <option value="all">{fr ? 'Tous' : 'All'}</option>
            <option value="normal">{fr ? 'Vente normale' : 'Normal sale'}</option>
            <option value="credit">{fr ? 'Vente à crédit' : 'Credit sale'}</option>
            <option value="returned">{fr ? 'Vente retournée' : 'Returned sale'}</option>
            <option value="partial_return">{fr ? 'Retour partiel' : 'Partial return'}</option>
          </FilterSelect>
        </div>
      </section>

      {/* ── Liste des ventes ── */}
      <section className={s.listCard}>
        <div className={s.listHead}>
          <h2 className={s.listTitle}>
            {fr ? 'Ventes' : 'Sales'}
            <span className={s.listCount}>{formatNumber(totalFiltered)} {fr ? 'résultat(s)' : 'result(s)'}</span>
          </h2>
          <select className={s.sortSelect} value={sortValue} onChange={(e) => onMobileSort(e.target.value)} aria-label={fr ? 'Trier' : 'Sort'}>
            <option value="created_at:desc">{fr ? 'Plus récentes' : 'Newest first'}</option>
            <option value="created_at:asc">{fr ? 'Plus anciennes' : 'Oldest first'}</option>
            <option value="total:desc">{fr ? 'Montant décroissant' : 'Highest amount'}</option>
            <option value="total:asc">{fr ? 'Montant croissant' : 'Lowest amount'}</option>
          </select>
        </div>

        {isLoading && sales.length === 0 ? (
          <div>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className={`${s.skeleton} ${s.skeletonRow}`} />)}
          </div>
        ) : isError && sales.length === 0 ? (
          // Jamais un spinner infini : une requête en échec (réseau
          // instable) se distingue clairement du "aucune vente" — avec un
          // vrai bouton pour réessayer, sans recharger toute la page.
          <div className={s.state}>
            <span className={s.stateIcon}><WifiOff size={22} /></span>
            <p>{fr ? 'Impossible de charger les ventes.' : 'Unable to load sales.'}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>{fr ? 'Réessayer' : 'Retry'}</button>
          </div>
        ) : sales.length === 0 ? (
          <div className={s.state}>
            <span className={s.stateIcon}><SearchX size={22} /></span>
            <p>{t('sales.no_sales') || 'Aucune vente trouvée.'}</p>
            {(activeFilterCount > 0 || datePreset !== '') && (
              <button className="btn btn-secondary btn-sm" onClick={resetFilters}>{fr ? 'Effacer les filtres' : 'Clear filters'}</button>
            )}
          </div>
        ) : (
          <>
            {/* Ordinateur : tableau */}
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t('sales.receipt_no') || 'N° Reçu'}</th>
                    <th>Client</th>
                    <th>{fr ? 'Produits' : 'Products'}</th>
                    <th className={s.thSort} onClick={() => toggleSort('created_at')}>
                      <span className={s.thSortInner}>Date {sortIcon('created_at')}</span>
                    </th>
                    <th>{t('sales.payment_method') || 'Paiement'}</th>
                    <th className={`${s.thSort} ${s.right}`} onClick={() => toggleSort('total')}>
                      <span className={s.thSortInner}>{fr ? 'Montant' : 'Amount'} {sortIcon('total')}</span>
                    </th>
                    <th className={s.center}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(order => {
                    const badge = getSaleTypeBadge(order);
                    return (
                      <tr key={order.id}>
                        <td>
                          <div className={s.receiptCell}>
                            <button type="button" className={s.receipt} onClick={() => setSelectedSale(order)}>
                              BF-{order.id.slice(0, 8).toUpperCase()}
                            </button>
                            {badge && <span className={`${s.typeBadge} ${badge.cls}`}>{badge.label}</span>}
                          </div>
                        </td>
                        <td>
                          <div className={s.client}>
                            {avatarFor(order)}
                            <span className={s.clientText}>
                              <span className={s.clientName}>{getClientName(order)}</span>
                              {order.created_by_name && <small>{fr ? 'par' : 'by'} {order.created_by_name}</small>}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={s.items} title={order.items?.map(i => `${i.quantity} × ${getProductName(i)}`).join(', ')}>
                            {getItemsSummary(order)}
                          </div>
                        </td>
                        <td>
                          <span className={s.dateCell}>
                            {formatDay(order.created_at, language)}
                            <small>{formatTime(order.created_at, language)}</small>
                          </span>
                        </td>
                        <td>{payPill(order)}</td>
                        <td className={s.right}>{amountBlock(order)}</td>
                        <td className={s.center}>{actionButtons(order)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Téléphone / tablette : cartes */}
            <div className={s.cards}>
              {sales.map(order => {
                const badge = getSaleTypeBadge(order);
                return (
                  <article key={order.id} className={s.card}>
                    {avatarFor(order)}
                    <div className={s.cardMain}>
                      <span className={s.clientName}>{getClientName(order)}</span>
                      <button type="button" className={s.receipt} onClick={() => setSelectedSale(order)}>
                        BF-{order.id.slice(0, 8).toUpperCase()}
                      </button>
                    </div>
                    <div className={s.cardAmount}>{amountBlock(order)}</div>
                    <div className={s.cardItems} title={order.items?.map(i => `${i.quantity} × ${getProductName(i)}`).join(', ')}>
                      {getItemsSummary(order)}
                    </div>
                    <div className={s.cardMeta}>
                      {payPill(order)}
                      {badge && <span className={`${s.typeBadge} ${badge.cls}`}>{badge.label}</span>}
                      <span>{formatDate(order.created_at, language)}</span>
                    </div>
                    <div className={s.cardSeller}>
                      {order.created_by_name && <><UserCog size={13} /> {order.created_by_name}</>}
                    </div>
                    <div className={s.cardActions}>{actionButtons(order)}</div>
                  </article>
                );
              })}
            </div>

            {/* Pagination — pilotée par le serveur (total/pages), plus de
                découpage d'un tableau déjà entièrement chargé en mémoire. */}
            <div className={s.pager}>
              <span className={s.pagerInfo}>
                {fr ? 'Affichage de ' : 'Showing '}
                <strong>{(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, totalFiltered)}</strong>
                {fr ? ' sur ' : ' of '}<strong>{formatNumber(totalFiltered)}</strong>{fr ? ' ventes' : ' sales'}
              </span>
              <div className={s.pagerControls}>
                <select
                  className={s.perPage}
                  value={perPage}
                  onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  aria-label={fr ? 'Ventes par page' : 'Sales per page'}
                >
                  <option value={15}>15 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <button type="button" className={s.pagerBtn} disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} aria-label={fr ? 'Page précédente' : 'Previous page'}>
                  <ChevronLeft size={16} />
                </button>
                <span className={s.pageIndicator}>{currentPage} / {Math.max(totalPages, 1)}</span>
                <button type="button" className={s.pagerBtn} disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} aria-label={fr ? 'Page suivante' : 'Next page'}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal Detail Sale */}
      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title={fr ? 'Détails de la Vente' : 'Sale Details'}>
        {selectedSale && (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">{fr ? 'Article(s)' : 'Item(s)'}</span><span className="detail-value">{getItemsSummary(selectedSale)}</span></div>
            <div className="detail-row"><span className="detail-label">Client</span><span className="detail-value">{getClientName(selectedSale)}</span></div>
            <div className="detail-row"><span className="detail-label">{fr ? 'Vendu par' : 'Sold by'}</span><span className="detail-value">{getSellerName(selectedSale)}</span></div>
            <div className="detail-row"><span className="detail-label">{fr ? 'Mode de Paiement' : 'Payment Method'}</span><span className="detail-value">{getPaymentLabel(getPaymentMethod(selectedSale))}</span></div>
            <div className="detail-row"><span className="detail-label">Total</span><span className="detail-value order-amount text-emerald">{formatGNF(Number(selectedSale.total) || 0)}</span></div>
            {(selectedSale.returned_amount || 0) > 0 && (
              <div className="detail-row"><span className="detail-label">{fr ? 'Retourné' : 'Returned'}</span><span className="detail-value" style={{ color: '#ef4444' }}>{formatGNF(selectedSale.returned_amount || 0)}</span></div>
            )}
            <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{formatDate(selectedSale.created_at, language)}</span></div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{fr ? 'Articles achetés' : 'Purchased items'}</div>
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
              <button className="btn btn-ghost" onClick={() => setSelectedSale(null)}>{fr ? 'Fermer' : 'Close'}</button>
              <button className="btn btn-primary" onClick={() => { const sale = selectedSale; setSelectedSale(null); setReceiptOrder(sale); }}>
                <Printer size={14} /> {fr ? 'Reçu de caisse' : 'Print receipt'}
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
        <Modal isOpen={!!returnOrder} onClose={() => setReturnOrder(null)} title={fr ? `Retour Produit - Vente #${returnOrder.id.slice(0, 8).toUpperCase()}` : `Product Return - Sale #${returnOrder.id.slice(0, 8).toUpperCase()}`}>
          <div className="modal-form">
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {fr ? 'Sélectionnez les articles à retourner et indiquez les quantités.' : 'Select the items to return and specify the quantities.'}
            </p>
            {returnOrder.status === 'pending' && (
              <p style={{ color: 'var(--color-brand-500)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {fr ? '⚠️ Vente à crédit : le retour réduira directement la dette liée plutôt que de rembourser en espèces.' : '⚠️ Credit sale: the return will reduce the linked debt directly instead of a cash refund.'}
              </p>
            )}
            {returnOrder.items?.map((item, idx) => {
              const prodName = getProductName(item);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{prodName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fr ? `Acheté : ${item.quantity} × ${formatGNF(item.unit_price)}` : `Bought: ${item.quantity} × ${formatGNF(item.unit_price)}`}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fr ? 'Retour :' : 'Return:'}</label>
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
              <label className="form-label">{fr ? 'Motif du retour *' : 'Return Reason *'}</label>
              <textarea className="input" rows={2} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder={fr ? "Ex: Erreur de commande, produit défectueux..." : "Ex: Order error, defective product..."} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input type="checkbox" id="restock-check-sales" checked={restockInventory} onChange={e => setRestockInventory(e.target.checked)} />
              <label htmlFor="restock-check-sales" style={{ fontSize: '0.85rem' }}>{fr ? 'Réintégrer les articles en stock' : 'Restock returned items'}</label>
            </div>
            {returnItems.filter(i => i.quantity > 0).length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{fr ? 'Récapitulatif du remboursement' : 'Refund summary'}</div>
                {returnItems.filter(i => i.quantity > 0).map((ri, idx) => {
                  const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                  if (!origItem) return null;
                  return <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ri.quantity} × {getProductName(origItem)} = {formatGNF(ri.quantity * origItem.unit_price)}</div>;
                })}
                <div style={{ fontWeight: 700, marginTop: '0.5rem', color: 'var(--color-brand-500)' }}>
                  {fr ? 'Total remboursement : ' : 'Total refund: '} {formatGNF(returnItems.reduce((acc, ri) => {
                    const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                    return acc + (origItem ? ri.quantity * origItem.unit_price : 0);
                  }, 0))}
                </div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setReturnOrder(null)}>{fr ? 'Annuler' : 'Cancel'}</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitReturn} disabled={isSubmittingReturn}>
                {isSubmittingReturn ? (fr ? 'Traitement...' : 'Processing...') : (fr ? 'Valider le retour' : 'Submit Return')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Styles du contenu des modales (détail / retour) — inchangés. */}
      <style jsx>{`
        .text-emerald { color: #10b981 !important; }
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
