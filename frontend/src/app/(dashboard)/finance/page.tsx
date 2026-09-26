'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import {
  Plus,
  Search,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  EyeOff,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { buildPeriodParams, type PeriodKey } from '@/lib/period';
import { useFinanceTransactionsQuery } from '@/lib/queries';
import type {
  TransactionType,
  TransactionCategory,
  PaymentMethod,
} from '@/types';

import { PageHeader, StatTile } from '@/components/ui/PageHeader';
import { formatGNF, formatNumber, formatCompact, formatRelativeDay, paymentColor } from '@/lib/format';

// Recharts hors du bundle initial (voir DashboardCharts) — un seul chunk.
const chartSkeleton = (height: number) => function ChartSkeleton() {
  return <div className="bf-skeleton" style={{ height }} />;
};
const CashflowChart = dynamic(() => import('@/components/charts/FinanceCharts').then((m) => m.CashflowChart), {
  ssr: false, loading: chartSkeleton(290),
});
const PaymentDonut = dynamic(() => import('@/components/charts/DashboardCharts').then((m) => m.PaymentDonut), {
  ssr: false, loading: chartSkeleton(200),
});

const EXPENSE_COLORS = ['#f43f5e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#14b8a6', '#64748b'];


export default function FinancePage() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const CATEGORY_LABELS: Record<string, string> = {
    sale: language === 'fr' ? 'Vente' : 'Sale',
    supplier_purchase: language === 'fr' ? 'Achat fournisseur' : 'Supplier purchase',
    salary: language === 'fr' ? 'Salaire / Rémunération' : 'Salary / Remuneration',
    rent: language === 'fr' ? 'Loyer & Charges' : 'Rent & Charges',
    utilities: language === 'fr' ? 'Factures (Eau/Élec/Net)' : 'Bills (Water/Elec/Net)',
    refund: language === 'fr' ? 'Remboursement' : 'Refund',
    other_income: language === 'fr' ? 'Autre revenu' : 'Other income',
    other_expense: language === 'fr' ? 'Autre dépense' : 'Other expense',
  };

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    cash: language === 'fr' ? 'Espèces' : 'Cash',
    orange_money: 'Orange Money',
    card: language === 'fr' ? 'Carte bancaire' : 'Credit Card',
    transfer: language === 'fr' ? 'Virement bancaire' : 'Bank Transfer',
  };

  const INCOME_CATEGORIES: { value: TransactionCategory; label: string }[] = [
    { value: 'sale', label: language === 'fr' ? 'Vente' : 'Sale' },
    { value: 'other_income', label: language === 'fr' ? 'Autre revenu' : 'Other income' },
  ];

  const EXPENSE_CATEGORIES: { value: TransactionCategory; label: string }[] = [
    { value: 'supplier_purchase', label: language === 'fr' ? 'Achat fournisseur' : 'Supplier purchase' },
    { value: 'salary', label: language === 'fr' ? 'Salaire / Rémunération' : 'Salary / Remuneration' },
    { value: 'rent', label: language === 'fr' ? 'Loyer & Charges' : 'Rent & Charges' },
    { value: 'utilities', label: language === 'fr' ? 'Factures (Eau, Électricité, Internet)' : 'Bills (Water, Electricity, Internet)' },
    { value: 'refund', label: language === 'fr' ? 'Remboursement' : 'Refund' },
    { value: 'other_expense', label: language === 'fr' ? 'Autre dépense' : 'Other expense' },
  ];

  // Pagination states
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Filter states
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30j');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    type: TransactionType;
    category: string;
    amount: string;
    description: string;
    payment_method: PaymentMethod;
    reference: string;
  }>({
    type: 'income',
    category: 'sale',
    amount: '',
    description: '',
    payment_method: 'cash',
    reference: '',
  });

  // Même fonction que le Tableau de bord : une sélection identique y
  // produit exactement les mêmes bornes de dates. Tant que les deux dates
  // d'une période personnalisée ne sont pas choisies, la requête reste
  // désactivée (`enabled`) plutôt que d'envoyer "aucune contrainte" et
  // afficher un instant les totaux globaux à la place de la période choisie.
  const range = buildPeriodParams(selectedPeriod as PeriodKey, filterDateFrom, filterDateTo);
  const hasValidRange = !(selectedPeriod === 'custom' && (!filterDateFrom || !filterDateTo));
  const typeParam = selectedType !== 'all' ? selectedType : undefined;
  const categoryParam = selectedCategory !== 'all' ? selectedCategory : undefined;

  // Couche mémoire partagée, comme Produits/Vendre : une combinaison de
  // filtres déjà consultée reste en cache, revalidée silencieusement en
  // arrière-plan (synchronisation, nouvelle vente ailleurs — voir
  // QueryProvider) sans jamais vider la liste affichée.
  const { data: transactionsData, isLoading, error: financeError } = useFinanceTransactionsQuery(
    page, perPage, typeParam, categoryParam, range.period, range.start_date, range.end_date, hasValidRange
  );
  // Le propriétaire peut masquer le module Finance en bloc pour certains
  // rôles (voir paramètres boutique) — le backend renvoie alors un 403,
  // distinct d'une simple absence de transactions.
  const financeHidden = (financeError as any)?.status === 403;

  const transactions = useMemo(() => {
    return (transactionsData?.items || [])
      .slice()
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [transactionsData]);
  const summary = transactionsData?.summary ?? null;
  const total = transactionsData?.total ?? 0;
  const totalPages = transactionsData?.pages ?? 1;

  // Handle Type toggle in Modal Form
  const handleTypeChange = (newType: TransactionType) => {
    const defaultCategory = newType === 'income' ? 'sale' : 'supplier_purchase';
    setFormData((prev) => ({
      ...prev,
      type: newType,
      category: defaultCategory,
    }));
  };

  const handleOpenModal = () => {
    setFormData({
      type: 'income',
      category: 'sale',
      amount: '',
      description: '',
      payment_method: 'cash',
      reference: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const numericAmount = parseFloat(formData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Veuillez saisir un montant valide supérieur à 0');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('La description est requise');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createFinanceTransaction({
        type: formData.type,
        category: formData.category,
        amount: numericAmount,
        description: formData.description.trim(),
        payment_method: formData.payment_method,
        reference: formData.reference.trim() || undefined,
      });

      toast.success(
        formData.type === 'income'
          ? (language === 'fr' ? "Entrée d'argent enregistrée avec succès !" : "Income transaction recorded successfully!")
          : (language === 'fr' ? "Dépense enregistrée avec succès !" : "Expense transaction recorded successfully!")
      );
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    } catch (err: any) {
      console.error('Create transaction error:', err);
      toast.error(err?.message || (language === 'fr' ? 'Erreur lors de la création de la transaction' : 'Error creating transaction'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Local search filtering on description or reference
  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      (t.reference && t.reference.toLowerCase().includes(q)) ||
      (CATEGORY_LABELS[t.category] || t.category).toLowerCase().includes(q)
    );
  });

  const fr = language === 'fr';

  // Transactions de toute la période (jusqu'à 10 pages de 200) pour les
  // graphiques — clé préfixée 'finance-transactions' : invalidée avec la
  // liste après chaque nouvelle transaction, vente ou versement.
  const { data: chartTx } = useQuery({
    queryKey: ['finance-transactions', 'chart', range.period, range.start_date, range.end_date],
    enabled: hasValidRange,
    queryFn: async () => {
      const first = await api.getFinanceTransactions(1, 200, undefined, undefined, range.period, range.start_date, range.end_date);
      let items = first.items ?? [];
      const pages = Math.min(first.pages || 1, 10);
      for (let p = 2; p <= pages; p++) {
        const next = await api.getFinanceTransactions(p, 200, undefined, undefined, range.period, range.start_date, range.end_date);
        items = items.concat(next.items ?? []);
      }
      return items;
    },
  });

  const { cashflow, expenseByCategory, expenseTotal } = useMemo(() => {
    const txs = chartTx ?? [];
    if (txs.length === 0) return { cashflow: [], expenseByCategory: [], expenseTotal: 0 };
    const times = txs.map(t => new Date(t.created_at).getTime());
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    const spanDays = (max.getTime() - min.getTime()) / 86_400_000;
    const unit: 'day' | 'week' | 'month' = spanDays <= 45 ? 'day' : spanDays <= 200 ? 'week' : 'month';
    const locale = fr ? 'fr-FR' : 'en-US';
    const startOf = (d: Date) => {
      const x = new Date(d.getFullYear(), d.getMonth(), unit === 'month' ? 1 : d.getDate());
      if (unit === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x;
    };
    const step = (d: Date) => {
      const x = new Date(d);
      if (unit === 'day') x.setDate(x.getDate() + 1);
      else if (unit === 'week') x.setDate(x.getDate() + 7);
      else x.setMonth(x.getMonth() + 1);
      return x;
    };
    const label = (d: Date) => unit === 'month'
      ? d.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
      : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });

    const buckets = new Map<number, { income: number; expense: number }>();
    for (let d = startOf(min); d <= max; d = step(d)) buckets.set(d.getTime(), { income: 0, expense: 0 });
    const byCat = new Map<string, number>();
    let expenses = 0;
    for (const tx of txs) {
      const key = startOf(new Date(tx.created_at)).getTime();
      const b = buckets.get(key) ?? { income: 0, expense: 0 };
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') b.income += amount;
      else {
        b.expense += amount;
        expenses += amount;
        byCat.set(tx.category, (byCat.get(tx.category) ?? 0) + amount);
      }
      buckets.set(key, b);
    }
    let balance = 0;
    const points = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([key, v]) => {
      balance += v.income - v.expense;
      return { name: label(new Date(key)), income: v.income, expense: v.expense, balance };
    });
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1])
      .map(([key, value], i) => ({ key, value, color: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }));
    return { cashflow: points, expenseByCategory: cats, expenseTotal: expenses };
  }, [chartTx, fr]);

  if (financeHidden) {
    return (
      <div className="bf-page fade-in">
        <div className="bf-panel bf-empty" style={{ maxWidth: 480, margin: '3rem auto' }}>
          <span className="bf-empty__icon"><EyeOff size={24} /></span>
          <strong>{language === 'fr' ? 'Module Finance masqué' : 'Finance module hidden'}</strong>
          <p className="text-muted">
            {language === 'fr'
              ? 'Le propriétaire de la boutique a désactivé l\'accès à ce module pour votre rôle.'
              : 'The shop owner has disabled access to this module for your role.'}
          </p>
        </div>
      </div>
    );
  }


  const income = summary?.total_income ?? 0;
  const expense = summary?.total_expense ?? 0;
  const net = summary?.net_balance ?? 0;

  const txIcon = (isIncome: boolean) => (
    <span className="bf-avatar" style={{
      background: isIncome ? 'rgba(16,185,129,0.14)' : 'rgba(244,63,94,0.12)',
      color: isIncome ? '#10b981' : '#f43f5e', boxShadow: 'none',
    }}>
      {isIncome ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
    </span>
  );
  const payPill = (method: string) => (
    <span className="bf-badge" style={{ '--tone': paymentColor(method), '--tone-soft': `color-mix(in srgb, ${paymentColor(method)} 13%, transparent)` } as React.CSSProperties}>
      <span className="bf-badge__dot" />{PAYMENT_METHOD_LABELS[method] || method}
    </span>
  );
  const amountText = (isIncome: boolean, amount: number) => (
    <span className="bf-money" style={{ color: isIncome ? 'var(--color-success)' : 'var(--color-error)' }}>
      {isIncome ? '+' : '−'} {formatGNF(amount)}
    </span>
  );

  return (
    <div className="bf-page fade-in">
      <PageHeader
        icon={Wallet}
        title={t('fin.title') || 'Finance & Trésorerie'}
        subtitle={t('fin.subtitle') || 'Suivez vos entrées, dépenses et le solde net de votre boutique.'}
        actions={
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={17} /> {t('fin.new_transaction') || 'Nouvelle Transaction'}
          </button>
        }
      />

      <div className="bf-chips" role="tablist" aria-label={fr ? 'Période' : 'Period'}>
        {[
          { id: '7j', label: fr ? '7 jours' : '7 days' },
          { id: '30j', label: fr ? '30 jours' : '30 days' },
          { id: '90j', label: fr ? '90 jours' : '90 days' },
          { id: 'all', label: fr ? 'Tout' : 'All' },
          { id: 'custom', label: fr ? 'Personnalisé' : 'Custom' },
        ].map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={selectedPeriod === p.id}
            className={`bf-chip ${selectedPeriod === p.id ? 'bf-chip--active' : ''}`}
            onClick={() => { setSelectedPeriod(p.id); setPage(1); }}>
            {p.label}
          </button>
        ))}
        {selectedPeriod === 'custom' && (
          <span className="fin-dates">
            <input type="date" className="input" value={filterDateFrom} max={filterDateTo || undefined}
              onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }} aria-label={fr ? 'Date de début' : 'Start date'} />
            <span>{fr ? 'à' : 'to'}</span>
            <input type="date" className="input" value={filterDateTo} min={filterDateFrom || undefined}
              onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }} aria-label={fr ? 'Date de fin' : 'End date'} />
          </span>
        )}
      </div>

      <section className="bf-stats">
        <StatTile tone="emerald" icon={ArrowDownLeft} label={t('fin.total_income') || 'Total Revenus'} value={formatNumber(income)} suffix="GNF"
          hint={fr ? 'Entrées brutes enregistrées' : 'Total gross income'} />
        <StatTile tone="rose" icon={ArrowUpRight} label={t('fin.total_expense') || 'Total Dépenses'} value={formatNumber(expense)} suffix="GNF"
          hint={<><strong>{income > 0 ? Math.round((expense / income) * 100) : 0} %</strong> {fr ? 'des entrées' : 'of income'}</>} />
        <StatTile tone={net >= 0 ? 'sky' : 'rose'} icon={Wallet} label={t('fin.net_balance') || 'Solde Net'} value={formatNumber(net)} suffix="GNF"
          hint={<><strong>{formatNumber(summary?.transactions_count ?? 0)}</strong> {fr ? 'transaction(s)' : 'transaction(s)'}</>} />
        {/* Marge Produits — calculée seulement sur les articles avec prix
            d'achat connu (facultatif), jamais estimée pour le reste. */}
        <StatTile tone="violet" icon={TrendingUp} label={fr ? 'Marge produits' : 'Product margin'} value={formatNumber(summary?.product_margin ?? 0)} suffix="GNF"
          hint={<><strong>{(summary?.product_margin_coverage ?? 0).toFixed(0)} %</strong> {fr ? 'du CA couvert' : 'of revenue covered'}</>} />
      </section>

      <section className="fin-charts">
        <article className="bf-panel">
          <div className="bf-panel__head">
            <span className="bf-panel__title">
              <span className="bf-panel__title-icon"><BarChart3 size={17} /></span>
              <span>{fr ? 'Flux de trésorerie' : 'Cash flow'}<span className="bf-panel__sub" style={{ display: 'block' }}>{fr ? 'Entrées, sorties et solde cumulé' : 'Income, expenses and running balance'}</span></span>
            </span>
            <span className="fin-legend">
              <span><i style={{ background: '#10b981' }} />{fr ? 'Entrées' : 'Income'}</span>
              <span><i style={{ background: '#f43f5e' }} />{fr ? 'Sorties' : 'Expenses'}</span>
              <span><i style={{ background: 'var(--color-brand-400)' }} />{fr ? 'Solde' : 'Balance'}</span>
            </span>
          </div>
          <div className="fin-chart-body">
            {cashflow.length > 0
              ? <CashflowChart data={cashflow} language={language} />
              : <div className="bf-empty"><span className="bf-empty__icon"><BarChart3 size={22} /></span>{fr ? 'Aucun mouvement sur cette période.' : 'No movement in this period.'}</div>}
          </div>
        </article>

        <article className="bf-panel">
          <div className="bf-panel__head">
            <span className="bf-panel__title">
              <span className="bf-panel__title-icon"><PieIcon size={17} /></span>
              <span>{fr ? 'Répartition des dépenses' : 'Expense breakdown'}<span className="bf-panel__sub" style={{ display: 'block' }}>{fr ? 'Par catégorie' : 'By category'}</span></span>
            </span>
          </div>
          <div className="fin-chart-body">
            {expenseByCategory.length === 0 ? (
              <div className="bf-empty"><span className="bf-empty__icon"><PieIcon size={22} /></span>{fr ? 'Aucune dépense sur cette période.' : 'No expense in this period.'}</div>
            ) : (
              <>
                <div className="fin-donut">
                  <PaymentDonut data={expenseByCategory} />
                  <div className="fin-donut-center"><strong>{formatCompact(expenseTotal)}</strong><span>GNF</span></div>
                </div>
                <div className="fin-cat-list">
                  {expenseByCategory.map(c => (
                    <div key={c.key} className="fin-cat-row">
                      <i style={{ background: c.color }} />
                      <span className="fin-cat-name">{CATEGORY_LABELS[c.key] || c.key}</span>
                      <span className="fin-cat-value">{formatGNF(c.value)}<small>{Math.round((c.value / (expenseTotal || 1)) * 100)} %</small></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </article>
      </section>

      <section className="bf-toolbar">
        <div className="bf-search">
          <Search size={18} />
          <input type="text" placeholder={fr ? 'Rechercher par description, réf...' : 'Search by description, ref...'}
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="bf-select-wrap">
          <select className={`bf-select ${selectedType !== 'all' ? 'bf-select--active' : ''}`} value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setPage(1); }} aria-label="Type">
            <option value="all">{fr ? 'Tous les types' : 'All types'}</option>
            <option value="income">{fr ? 'Entrées (+)' : 'Income (+)'}</option>
            <option value="expense">{fr ? 'Sorties (−)' : 'Expenses (−)'}</option>
          </select>
          <Filter size={15} />
        </div>
        <div className="bf-select-wrap">
          <select className={`bf-select ${selectedCategory !== 'all' ? 'bf-select--active' : ''}`} value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }} aria-label={fr ? 'Catégorie' : 'Category'}>
            <option value="all">{fr ? 'Toutes les catégories' : 'All categories'}</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Layers size={15} />
        </div>
      </section>

      <section className="bf-panel">
        <div className="bf-panel__head">
          <span className="bf-panel__title">{fr ? 'Mouvements' : 'Transactions'} <span className="bf-count">{formatNumber(total)}</span></span>
        </div>

        {isLoading ? (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="bf-skeleton" style={{ height: 56 }} />)}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bf-empty">
            <span className="bf-empty__icon"><Wallet size={24} /></span>
            <strong>{fr ? 'Aucune transaction trouvée pour cette période.' : 'No transactions found for this period.'}</strong>
          </div>
        ) : (
          <>
            <div className="bf-table-wrap bf-desktop-only">
              <table className="bf-table">
                <thead>
                  <tr>
                    <th>{fr ? 'Date' : 'Date'}</th>
                    <th>{fr ? 'Description' : 'Description'}</th>
                    <th>{fr ? 'Catégorie' : 'Category'}</th>
                    <th>{fr ? 'Paiement' : 'Payment'}</th>
                    <th className="bf-right">{fr ? 'Montant' : 'Amount'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <tr key={tx.id}>
                        <td>
                          <span className="bf-cell__text">
                            <span style={{ fontWeight: 600 }}>{new Date(tx.created_at).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="bf-sub">{new Date(tx.created_at).toLocaleTimeString(fr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        </td>
                        <td>
                          <div className="bf-cell">
                            {txIcon(isIncome)}
                            <span className="bf-cell__text">
                              <span className="bf-name">{tx.description}</span>
                              {tx.reference && <span className="bf-sub bf-mono">{fr ? 'Réf :' : 'Ref:'} {tx.reference.slice(0, 13)}</span>}
                            </span>
                          </div>
                        </td>
                        <td><span className="bf-badge">{CATEGORY_LABELS[tx.category] || tx.category}</span></td>
                        <td>{payPill(tx.payment_method)}</td>
                        <td className="bf-right">{amountText(isIncome, Number(tx.amount))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bf-mlist">
              {filteredTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                return (
                  <article key={tx.id} className="bf-mcard">
                    {txIcon(isIncome)}
                    <div className="bf-mcard__main">
                      <span className="bf-name">{tx.description}</span>
                      <span className="bf-sub">{CATEGORY_LABELS[tx.category] || tx.category}</span>
                    </div>
                    <div className="bf-mcard__side">{amountText(isIncome, Number(tx.amount))}</div>
                    <div className="bf-mcard__foot">
                      <div className="bf-mcard__meta">
                        {payPill(tx.payment_method)}
                        <span>{formatRelativeDay(tx.created_at, language)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="bf-pager">
              <span className="bf-pager__info">
                <strong>{formatNumber(filteredTransactions.length)}</strong> {fr ? 'affichée(s) sur' : 'shown of'} <strong>{formatNumber(total)}</strong>
              </span>
              <div className="bf-pager__controls">
                <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} aria-label={fr ? 'Transactions par page' : 'Transactions per page'}>
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <button type="button" className="bf-icon-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label={fr ? 'Page précédente' : 'Previous page'}>
                  <ChevronLeft size={16} />
                </button>
                <span className="bf-pager__page">{page} / {Math.max(totalPages, 1)}</span>
                <button type="button" className="bf-icon-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label={fr ? 'Page suivante' : 'Next page'}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal - Add New Transaction */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={language === 'fr' ? '+ Mouvement' : '+ Transaction'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Type Toggle Selector */}
          <div className="type-toggle-container">
            <button
              type="button"
              className={`type-toggle-btn type-income ${
                formData.type === 'income' ? 'active' : ''
              }`}
              onClick={() => handleTypeChange('income')}
            >
              <ArrowDownLeft size={18} />
              <span>{language === 'fr' ? 'Argent reçu' : 'Income'}</span>
            </button>
            <button
              type="button"
              className={`type-toggle-btn type-expense ${
                formData.type === 'expense' ? 'active' : ''
              }`}
              onClick={() => handleTypeChange('expense')}
            >
              <ArrowUpRight size={18} />
              <span>{language === 'fr' ? 'Argent sorti' : 'Expense'}</span>
            </button>
          </div>

          <div className="form-grid">
            {/* Category Select */}
            <div className="form-group">
              <label className="form-label">{language === 'fr' ? 'Type' : 'Type'}</label>
              <select
                className="input"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {formData.type === 'income'
                  ? INCOME_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))
                  : EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
              </select>
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label">{language === 'fr' ? 'Montant' : 'Amount'}</label>
              <input
                type="number"
                min="1"
                step="any"
                className="input"
                placeholder="Ex : 150 000"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label">{language === 'fr' ? 'Paiement' : 'Payment'}</label>
              <select
                className="input"
                required
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_method: e.target.value as PaymentMethod,
                  })
                }
              >
                <option value="cash">{language === 'fr' ? 'Espèces' : 'Cash'}</option>
                <option value="orange_money">Orange Money</option>
                <option value="card">{language === 'fr' ? 'Carte bancaire' : 'Credit Card'}</option>
                <option value="transfer">{language === 'fr' ? 'Virement bancaire' : 'Bank Transfer'}</option>
              </select>
            </div>

            {/* Reference */}
            <div className="form-group">
              <label className="form-label">{language === 'fr' ? 'Référence (optionnel)' : 'Ref (optional)'}</label>
              <input
                type="text"
                className="input"
                placeholder="Ex : REC-00921"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="form-group full-width">
              <label className="form-label">{language === 'fr' ? 'Description' : 'Description'}</label>
              <textarea
                className="input"
                rows={2}
                placeholder={language === 'fr' ? 'Ex : Vente en caisse, achat stock...' : 'Ex: POS sale, stock purchase...'}
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsModalOpen(false)}
            >
              {t('common.cancel') || 'Annuler'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? t('common.saving') || 'Enregistrement...'
                : (language === 'fr' ? 'Enregistrer la transaction' : 'Record Transaction')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Styled Component CSS */}
      <style jsx>{`
        .fin-charts { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 1rem; }
        .fin-chart-body { padding: 1rem 1.2rem 1.2rem; }
        .fin-legend { display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.74rem; font-weight: 600; color: var(--text-secondary); }
        .fin-legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
        .fin-legend i, .fin-cat-row i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .fin-donut { position: relative; }
        .fin-donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
        .fin-donut-center strong { font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--text-primary); }
        .fin-donut-center span { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; color: var(--text-muted); }
        .fin-cat-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
        .fin-cat-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.55rem; font-size: 0.8rem; }
        .fin-cat-name { color: var(--text-secondary); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fin-cat-value { font-weight: 700; color: var(--text-primary); white-space: nowrap; }
        .fin-cat-value small { color: var(--text-muted); font-weight: 600; margin-left: 0.35rem; }
        .fin-dates { display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
        .fin-dates input { width: auto; min-height: 36px; padding: 0.3rem 0.6rem; }
        .fin-dates span { color: var(--text-muted); font-size: 0.82rem; }
        @media (max-width: 1100px) {
          .fin-charts { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 768px) {
          .fin-chart-body { padding: 0.8rem; }
          .fin-dates input { font-size: 16px; }
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .type-toggle-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .type-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-1);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .type-toggle-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-default);
        }

        .type-income.active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border-color: #10b981;
        }

        .type-expense.active {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border-color: #ef4444;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .full-width {
          grid-column: span 2;
        }

        .form-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .text-right {
          text-align: right;
        }

        .text-center {
          text-align: center;
        }

        .py-12 {
          padding: 3rem 0;
        }

        @media (max-width: 640px) {
          .filters-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .filters-left,
          .filters-right {
            width: 100%;
          }

          .search-box {
            width: 100%;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}
