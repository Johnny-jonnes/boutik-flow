'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Banknote, ShoppingBag, ShoppingBasket, ReceiptText, Users, Clock, Crown, CheckCircle, MessageCircle, ArrowDownRight,
  Wallet, Package, TrendingUp, CalendarDays, Plus, BarChart3, PieChart as PieIcon,
  Trophy, Flame, ChevronLeft, ChevronRight, ArrowRight, AlertTriangle, PackageCheck, UserPlus, Activity,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { buildPeriodParams, isWithinPeriod, periodLabel, type PeriodKey } from '@/lib/period';
import { useProductsQuery, useClientsQuery, useOrdersQuery, useDashboardKpisQuery, useAnalyticsQuery } from '@/lib/queries';
import { extractPaymentMethod } from '@/lib/saleNotes';
import {
  formatNumber, formatGNF, formatCompact, initials, hueFromString, formatRelativeDay,
  paymentLabel, paymentColor, LOW_STOCK_THRESHOLD,
} from '@/lib/format';
import s from './dashboard.module.css';

// Recharts (+ D3 en dépendance) sorti du bundle initial du Dashboard — la
// toute première page vue après connexion — chargé seulement une fois le
// composant monté côté client, avec un squelette de chargement léger
// pendant l'import. ssr:false car Recharts mesure le DOM (ResponsiveContainer).
// Les 4 graphiques viennent du même module : un seul chunk séparé.
const chartSkeleton = (height: number) => function ChartSkeleton() {
  return <div className={s.chartSkeleton} style={{ height }} />;
};
const Sparkline = dynamic(() => import('@/components/charts/DashboardCharts').then((m) => m.Sparkline), {
  ssr: false, loading: () => <div style={{ height: 56 }} />,
});
const SalesPerformanceChart = dynamic(() => import('@/components/charts/DashboardCharts').then((m) => m.SalesPerformanceChart), {
  ssr: false, loading: chartSkeleton(280),
});
const PaymentDonut = dynamic(() => import('@/components/charts/DashboardCharts').then((m) => m.PaymentDonut), {
  ssr: false, loading: chartSkeleton(200),
});
const PeakHoursChart = dynamic(() => import('@/components/charts/DashboardCharts').then((m) => m.PeakHoursChart), {
  ssr: false, loading: chartSkeleton(220),
});

const STATUS_CONFIG = {
  pending: { label_fr: 'En attente', label_en: 'Pending', color: '#f59e0b' },
  confirmed: { label_fr: 'Confirmée', label_en: 'Confirmed', color: '#3b82f6' },
  delivered: { label_fr: 'Livrée', label_en: 'Delivered', color: '#10b981' },
  cancelled: { label_fr: 'Annulée', label_en: 'Cancelled', color: '#f43f5e' },
} as const;

const PERIODS: { key: PeriodKey; fr: string; en: string }[] = [
  { key: '7j', fr: '7 j', en: '7 d' },
  { key: '30j', fr: '30 j', en: '30 d' },
  { key: '90j', fr: '90 j', en: '90 d' },
  { key: 'all', fr: 'Tout', en: 'All' },
  { key: 'custom', fr: 'Perso', en: 'Custom' },
];

type Tone = 'emerald' | 'rose' | 'violet' | 'amber' | 'sky' | 'teal' | 'slate';

function AnimatedNumber({ value }: { value: number }) {
  const safeValue = isNaN(value) || value == null ? 0 : Number(value);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const end = safeValue;
    const duration = 900;
    const startTime = performance.now();
    let animationFrameId: number;

    const updateNumber = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easeProgress = progress * (2 - progress);
      setDisplayValue(progress < 1 ? Math.floor(easeProgress * end) : end);
      if (progress < 1) animationFrameId = requestAnimationFrame(updateNumber);
    };

    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [safeValue]);

  return <>{formatNumber(displayValue)}</>;
}

function MaskedValue({ language }: { language: string }) {
  return (
    <span title={language === 'fr' ? 'Masqué par le propriétaire pour votre rôle' : 'Hidden by the owner for your role'}>
      {language === 'fr' ? 'Masqué' : 'Hidden'}
    </span>
  );
}

function StatCard({
  title, value, icon, tone, isCurrency = false, masked = false, ratio, ratioLabel, language,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: Tone;
  isCurrency?: boolean;
  masked?: boolean;
  /** Part (0-100) affichée en jauge sous la valeur — ex : dépenses en % du CA. */
  ratio?: number | null;
  ratioLabel?: string;
  language: string;
}) {
  const pct = ratio == null || !isFinite(ratio) ? null : Math.max(0, Math.min(100, ratio));
  return (
    <article className={s.statCard} data-tone={tone}>
      <div className={s.statHead}>
        <span className={s.statLabel}>{title}</span>
        <span className={s.statIcon}>{icon}</span>
      </div>
      <div className={s.statValue}>
        {masked ? <MaskedValue language={language} /> : <><AnimatedNumber value={value} />{isCurrency && <small>GNF</small>}</>}
      </div>
      {!masked && pct !== null && (
        <div className={s.statGauge}>
          <div className={s.statFoot}>
            <span className={s.tonePill}>{Math.round(ratio ?? 0)} %</span>
            {ratioLabel && <span>{ratioLabel}</span>}
          </div>
          <div className={s.gaugeTrack}><div className={s.gaugeBar} style={{ width: `${pct}%` }} /></div>
        </div>
      )}
    </article>
  );
}

function MiniStat({
  label, value, icon, tone, hint, isCurrency = false, masked = false, language,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: Tone;
  hint?: string;
  isCurrency?: boolean;
  masked?: boolean;
  language: string;
}) {
  return (
    <article className={s.miniStat} data-tone={tone}>
      <span className={s.miniIcon}>{icon}</span>
      <div className={s.miniBody}>
        <span className={s.miniValueRow}>
          <span className={s.miniValue}>
            {masked ? <MaskedValue language={language} /> : <><AnimatedNumber value={value} />{isCurrency && <small>GNF</small>}</>}
          </span>
          {hint && <span className={s.miniHint}>{hint}</span>}
        </span>
        <span className={s.miniLabel}>{label}</span>
      </div>
    </article>
  );
}

function PanelHeader({
  icon, title, subtitle, children,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={s.panelHeader}>
      <div className={s.panelTitleWrap}>
        <span className={s.panelIcon}>{icon}</span>
        <div>
          <h2 className={s.panelTitle}>{title}</h2>
          {subtitle && <p className={s.panelSubtitle}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [orderPage, setOrderPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(5);
  const [periodFilter, setPeriodFilter] = useState<PeriodKey>('30j');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  // Cache partagé avec Produits, Vendre, Clients et Ventes — visiter le
  // Dashboard en premier préchauffe leur cache ; les revisiter ensuite est
  // instantané, et réciproquement.
  const { data: productsData } = useProductsQuery();
  const { data: clientsData } = useClientsQuery();
  const { data: ordersData } = useOrdersQuery();
  const clients = useMemo(() => clientsData?.items ?? [], [clientsData]);
  const products = useMemo(() => productsData?.items ?? [], [productsData]);
  // Map construite une seule fois par changement de données, réutilisée
  // par chaque ligne de "Dernières ventes" — sans ça, un .find() par
  // ligne balayait jusqu'à 500 clients/produits (tout le cache partagé,
  // voir useClientsQuery/useProductsQuery) À CHAQUE rendu, y compris pour
  // un changement d'état sans rapport (page de pagination, etc.).
  const clientsById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const productsById = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const { t, language } = useLanguage();
  const fr = language === 'fr';
  // Calculé au rendu (heure de l'appareil) — suppressHydrationWarning sur le
  // titre couvre l'écart éventuel avec le rendu serveur.
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'dash.welcome_morning' : hour < 18 ? 'dash.welcome_afternoon' : 'dash.welcome_evening');

  // Mêmes paramètres que le module Finance : c'est ce qui garantit que les
  // deux écrans affichent les mêmes chiffres pour une même période. Tant
  // que les deux dates d'une période personnalisée ne sont pas choisies, il
  // n'y a rien de sensé à demander au serveur — les requêtes restent
  // désactivées (`enabled`) plutôt que d'envoyer "aucune contrainte" et
  // afficher un instant les totaux globaux à la place de la période choisie.
  const range = buildPeriodParams(periodFilter, customStartDate, customEndDate);
  const hasValidRange = !(periodFilter === 'custom' && (!customStartDate || !customEndDate));

  const { data: kpis, isLoading } = useDashboardKpisQuery(range.period, range.start_date, range.end_date, hasValidRange);
  const { data: analytics } = useAnalyticsQuery(range.period, range.start_date, range.end_date, hasValidRange);

  // Ensemble trié et filtré par période, dérivé du cache partagé des
  // commandes (jamais une seconde requête serveur) — la pagination, la
  // répartition par paiement et les heures d'affluence en dérivent.
  const filteredOrders = useMemo(() => {
    return (ordersData?.items || [])
      .filter((o) => isWithinPeriod(o.created_at, range))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersData, range.period, range.start_date, range.end_date]);

  // Changer de période invalide la page courante : sans ce reset, rester
  // sur la page 3 après un nouveau filtre pouvait afficher une page vide.
  const changePeriod = (p: PeriodKey) => { setPeriodFilter(p); setOrderPage(1); };
  const changeStart = (v: string) => { setCustomStartDate(v); setOrderPage(1); };
  const changeEnd = (v: string) => { setCustomEndDate(v); setOrderPage(1); };

  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / ordersPerPage));
  const recentOrders = useMemo(
    () => filteredOrders.slice((orderPage - 1) * ordersPerPage, orderPage * ordersPerPage),
    [filteredOrders, orderPage, ordersPerPage]
  );

  // Répartition par moyen de paiement (ventes non annulées de la période).
  const payments = useMemo(() => {
    const byMethod = new Map<string, { count: number; amount: number }>();
    for (const o of filteredOrders) {
      if (o.status === 'cancelled') continue;
      const method = o.payment_method || extractPaymentMethod(o.notes);
      const cur = byMethod.get(method) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(o.total) || 0;
      byMethod.set(method, cur);
    }
    return [...byMethod.entries()]
      .map(([key, v]) => ({ key, ...v, color: paymentColor(key) }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredOrders]);

  // Nombre de ventes par heure de la journée (heure locale de l'appareil).
  const peakHours = useMemo(() => {
    const counts = new Array(24).fill(0);
    for (const o of filteredOrders) {
      if (o.status !== 'cancelled') counts[new Date(o.created_at).getHours()] += 1;
    }
    const used = counts.map((c, h) => (c > 0 ? h : -1)).filter((h) => h >= 0);
    const from = Math.min(8, ...used);
    const to = Math.max(20, ...used);
    return counts.slice(from, to + 1).map((count, i) => ({ hour: from + i, count }));
  }, [filteredOrders]);

  const lowStock = useMemo(
    () => products
      .filter((p) => (p.stock ?? 0) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
      .slice(0, 5),
    [products]
  );

  const header = (
    <header className={s.header}>
      <div className={s.headerText}>
        <span className={s.eyebrow} suppressHydrationWarning>
          <CalendarDays size={14} />
          {new Date().toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <h1 className={s.title} suppressHydrationWarning>{greeting}</h1>
        <p className={s.subtitle}>
          {fr ? "Voici l'activité et les performances de votre boutique" : 'Here is your shop activity and performance'}
        </p>
      </div>
      <div className={s.headerActions}>
        <div className={s.segmented} role="tablist" aria-label={fr ? 'Période analysée' : 'Analysed period'}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={periodFilter === p.key}
              title={periodLabel(p.key, language)}
              className={`${s.segment} ${periodFilter === p.key ? s.segmentActive : ''}`}
              onClick={() => changePeriod(p.key)}
            >
              {fr ? p.fr : p.en}
            </button>
          ))}
        </div>
        <Link id="btn-new-order" href="/orders" className="btn btn-primary">
          <Plus size={16} /> {fr ? 'Nouvelle commande' : 'New order'}
        </Link>
      </div>
      {periodFilter === 'custom' && (
        <div className={s.customRange}>
          <input
            type="date" className="input" value={customStartDate} max={customEndDate || undefined}
            onChange={(e) => changeStart(e.target.value)}
            aria-label={fr ? 'Date de début' : 'Start date'}
          />
          <span>{fr ? 'à' : 'to'}</span>
          <input
            type="date" className="input" value={customEndDate} min={customStartDate || undefined}
            onChange={(e) => changeEnd(e.target.value)}
            aria-label={fr ? 'Date de fin' : 'End date'}
          />
        </div>
      )}
    </header>
  );

  // Période "Personnalisée" choisie mais les deux dates pas encore
  // renseignées : la requête reste volontairement désactivée (voir
  // hasValidRange ci-dessus, aucune requête "sans contrainte" envoyée à
  // la place). Sans cette branche dédiée, `!kpis` restait vrai pour
  // toujours (une requête désactivée ne se termine jamais) et tombait
  // dans le même squelette de chargement que pour une vraie requête en
  // cours — indiscernable d'un chargement bloqué pour l'utilisateur, qui
  // ne voit jamais qu'il lui suffit de choisir la date de fin.
  if (periodFilter === 'custom' && !hasValidRange) {
    return (
      <div className={s.page}>
        {header}
        <div className={s.customHint}>
          {fr ? 'Choisissez une date de début et une date de fin pour afficher les statistiques de cette période.' : 'Pick a start date and an end date to display statistics for that period.'}
        </div>
      </div>
    );
  }

  if (isLoading || !kpis) {
    return (
      <div className={s.page} style={{ opacity: 0.75 }}>
        {header}
        <div className={s.kpiTop}>
          <div className={`${s.chartSkeleton} ${s.heroCard}`} style={{ height: 190 }} />
          {[1, 2, 3].map((i) => <div key={i} className={s.chartSkeleton} style={{ height: 190, borderRadius: 20 }} />)}
        </div>
        <div className={s.kpiMini}>
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className={s.chartSkeleton} style={{ height: 70, borderRadius: 16 }} />)}
        </div>
        <div className={s.chartSkeleton} style={{ height: 360, borderRadius: 22 }} />
      </div>
    );
  }

  // total_revenue est null (jamais 0) quand le propriétaire a masqué les
  // chiffres financiers pour ce rôle (voir Tenant.hidden_financial_roles,
  // app.core.visibility côté backend) — signal fiable pour toutes les
  // valeurs monétaires, qui sont toujours masquées ensemble. Les graphiques
  // basculent alors sur des quantités (nombre de ventes, unités vendues).
  const financialsMasked = kpis.total_revenue === null || kpis.total_revenue === undefined;

  // Le backend renvoie déjà les points du plus ancien au plus récent :
  // les réordonner ici affichait la courbe à l'envers.
  const revenuePoints = analytics?.revenue_data ?? [];
  const orderPoints = analytics?.orders_data ?? [];
  const perfData = (revenuePoints.length ? revenuePoints : orderPoints).map((pt, i) => ({
    name: pt.name,
    revenue: Number(revenuePoints[i]?.value) || 0,
    orders: orderPoints.find((o) => o.name === pt.name)?.commandes ?? orderPoints[i]?.commandes ?? 0,
  }));
  const hasPerfData = perfData.some((d) => d.orders > 0 || (!financialsMasked && d.revenue > 0));
  const sparkData = revenuePoints.map((pt) => ({ name: pt.name, value: Number(pt.value) || 0 }));

  const revenue = kpis.total_revenue || 0;
  const averageBasket = analytics?.kpis?.average_order_value
    ?? (kpis.total_orders ? (kpis.total_revenue || 0) / kpis.total_orders : 0);
  const paymentTotal = payments.reduce((acc, p) => acc + (financialsMasked ? p.count : p.amount), 0);
  const topProducts = (analytics?.top_products ?? []).slice(0, 5);
  const topMax = Math.max(...topProducts.map((p) => (financialsMasked ? Number(p.ventes) : Number(p.revenue)) || 0), 1);
  const peak = peakHours.reduce((best, h) => (h.count > best.count ? h : best), { hour: -1, count: 0 });
  const currentPeriodLabel = periodLabel(periodFilter, language);

  return (
    <div className={s.page}>
      {header}

      {/* ── KPI principaux ── */}
      <section className={s.kpiTop}>
        <article className={s.heroCard}>
          <div className={s.heroHead}>
            <span className={s.heroLabel}>{fr ? "Chiffre d'affaires" : 'Revenue'}</span>
            <span className={s.heroIcon}><Banknote size={20} /></span>
          </div>
          <div className={s.heroValue}>
            {financialsMasked
              ? <MaskedValue language={language} />
              : <><AnimatedNumber value={kpis.total_revenue || 0} /><small>GNF</small></>}
          </div>
          <div className={s.heroFoot}>
            {analytics?.kpis?.revenue_change && <span className={s.heroBadge}>{analytics.kpis.revenue_change}</span>}
            <span>{currentPeriodLabel}</span>
          </div>
          {!financialsMasked && sparkData.length > 1
            ? <div className={s.heroSpark}><Sparkline data={sparkData} /></div>
            : <div className={s.heroSparkEmpty} />}
        </article>
        <StatCard
          language={language} tone="emerald" icon={<Wallet size={18} />}
          title={fr ? 'Bénéfice net' : 'Net profit'} value={kpis.net_balance || 0} isCurrency masked={financialsMasked}
          ratio={revenue > 0 ? ((kpis.net_balance || 0) / revenue) * 100 : null}
          ratioLabel={fr ? 'du CA conservé' : 'of revenue kept'}
        />
        <StatCard
          language={language} tone="rose" icon={<ArrowDownRight size={18} />}
          title={fr ? 'Dépenses' : 'Expenses'} value={kpis.total_expenses || 0} isCurrency masked={financialsMasked}
          ratio={revenue > 0 ? ((kpis.total_expenses || 0) / revenue) * 100 : null}
          ratioLabel={fr ? 'du CA en charges' : 'of revenue spent'}
        />
        {/* Marge réelle (vente − achat), calculée uniquement sur les articles
            dont le prix d'achat est connu (facultatif) — jamais estimée pour
            le reste. Le % couvert est affiché pour ne jamais faire croire à
            un chiffre complet quand il ne l'est pas. */}
        <StatCard
          language={language} tone="violet" icon={<TrendingUp size={18} />}
          title={fr ? 'Marge produits' : 'Product margin'} value={kpis.product_margin || 0} isCurrency masked={financialsMasked}
          ratio={kpis.product_margin_coverage ?? 0}
          ratioLabel={fr ? 'du CA couvert' : 'of revenue covered'}
        />
      </section>

      {/* ── KPI secondaires ── */}
      <section className={s.kpiMini}>
        <MiniStat language={language} tone="amber" icon={<ShoppingBag size={18} />}
          label={t('dash.orders')} value={kpis.total_orders || 0} hint={analytics?.kpis?.orders_change || undefined} />
        <MiniStat language={language} tone="violet" icon={<Package size={18} />}
          label={fr ? 'Articles vendus' : 'Items sold'} value={kpis.items_sold || 0} />
        <MiniStat language={language} tone="sky" icon={<ShoppingBasket size={18} />}
          label={fr ? 'Panier moyen' : 'Average basket'} value={Math.round(averageBasket || 0)} isCurrency masked={financialsMasked} />
        <MiniStat language={language} tone="teal" icon={<Users size={18} />}
          label={t('dash.clients')} value={kpis.total_clients || 0} hint={`+${kpis.new_clients ?? 0}`} />
        <MiniStat language={language} tone="slate" icon={<Clock size={18} />}
          label={fr ? 'En attente' : 'Pending'} value={kpis.pending_orders || 0} />
      </section>

      {/* ── Performance + paiements ── */}
      <section className={s.grid2to1}>
        <article className={s.panel}>
          <PanelHeader
            icon={<BarChart3 size={18} />}
            title={fr ? 'Performance des ventes' : 'Sales performance'}
            subtitle={currentPeriodLabel}
          >
            <div className={s.legend}>
              {!financialsMasked && (
                <span className={s.legendChip}><span className={s.dot} style={{ background: 'var(--color-brand-400)' }} />{fr ? "Chiffre d'affaires" : 'Revenue'}</span>
              )}
              <span className={s.legendChip}><span className={s.dot} style={{ background: '#f59e0b' }} />{fr ? 'Ventes' : 'Sales'}</span>
            </div>
          </PanelHeader>
          {hasPerfData
            ? <div className={s.chartBox}><SalesPerformanceChart data={perfData} showRevenue={!financialsMasked} language={language} /></div>
            : <EmptyState icon={<Activity size={20} />} text={fr ? 'Aucune vente sur cette période.' : 'No sales in this period.'} />}
        </article>

        <article className={s.panel}>
          <PanelHeader
            icon={<PieIcon size={18} />}
            title={fr ? 'Moyens de paiement' : 'Payment methods'}
            subtitle={fr ? 'Répartition des encaissements' : 'How customers pay'}
          />
          {payments.length === 0 ? (
            <EmptyState icon={<Wallet size={20} />} text={fr ? 'Aucun encaissement sur cette période.' : 'No payments in this period.'} />
          ) : (
            <>
              <div className={s.donutWrap}>
                <PaymentDonut data={payments.map((p) => ({ key: p.key, color: p.color, value: financialsMasked ? p.count : p.amount }))} />
                <div className={s.donutCenter}>
                  <strong>{financialsMasked ? formatNumber(paymentTotal) : formatCompact(paymentTotal)}</strong>
                  <span>{financialsMasked ? (fr ? 'ventes' : 'sales') : 'GNF'}</span>
                </div>
              </div>
              <div className={s.payList}>
                {payments.map((p) => {
                  const part = financialsMasked ? p.count : p.amount;
                  return (
                    <div key={p.key} className={s.payRow}>
                      <span className={s.dot} style={{ background: p.color }} />
                      <span className={s.payName}>{paymentLabel(p.key, language)}</span>
                      <span className={s.payValue}>
                        {financialsMasked ? `${formatNumber(p.count)} ${fr ? 'ventes' : 'sales'}` : formatGNF(p.amount)}
                        <span>{Math.round((part / (paymentTotal || 1)) * 100)} %</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </article>
      </section>

      {/* ── Top produits + heures d'affluence ── */}
      <section className={s.grid1to1}>
        <article className={s.panel}>
          <PanelHeader
            icon={<Trophy size={18} />}
            title={fr ? 'Meilleures ventes' : 'Best sellers'}
            subtitle={fr ? 'Top 5 des produits sur la période' : 'Top 5 products in this period'}
          >
            <Link href="/products" className={s.panelLink}>{fr ? 'Produits' : 'Products'} <ArrowRight size={14} /></Link>
          </PanelHeader>
          {topProducts.length === 0 ? (
            <EmptyState icon={<Package size={20} />} text={fr ? 'Aucun produit vendu sur cette période.' : 'No product sold in this period.'} />
          ) : (
            <div className={s.topList}>
              {topProducts.map((p, i) => {
                const metric = financialsMasked ? Number(p.ventes) : Number(p.revenue);
                return (
                  <div key={p.name + i} className={s.topRow}>
                    <span className={s.topRank}>{i + 1}</span>
                    <span className={s.topName}>
                      {p.name}
                      <span className={s.topMeta}>{formatNumber(p.ventes)} {fr ? 'vendus' : 'sold'}</span>
                    </span>
                    <span className={s.topAmount}>{financialsMasked ? formatNumber(p.ventes) : formatGNF(p.revenue)}</span>
                    <div className={s.topBarTrack}>
                      <div className={s.topBar} style={{ width: `${Math.max(4, (metric / topMax) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className={s.panel}>
          <PanelHeader
            icon={<Flame size={18} />}
            title={fr ? "Heures d'affluence" : 'Peak hours'}
            subtitle={fr ? 'Nombre de ventes par heure' : 'Number of sales per hour'}
          >
            {peak.count > 0 && (
              <span className={s.peakNote}><Flame size={13} />{fr ? `Pic vers ${peak.hour}h` : `Peak around ${peak.hour}h`}</span>
            )}
          </PanelHeader>
          {peak.count > 0
            ? <div className={s.chartBox}><PeakHoursChart data={peakHours} language={language} /></div>
            : <EmptyState icon={<Clock size={20} />} text={fr ? 'Pas encore assez de ventes.' : 'Not enough sales yet.'} />}
        </article>
      </section>

      {/* ── Dernières ventes + colonne latérale ── */}
      <section className={s.grid2to1}>
        <article className={s.panel}>
          <PanelHeader
            icon={<ReceiptText size={18} />}
            title={<>{fr ? 'Dernières ventes' : 'Latest sales'}<span className={s.countChip}>{formatNumber(totalOrders)}</span></>}
            subtitle={currentPeriodLabel}
          >
            <Link href="/sales" id="link-all-orders" className={s.panelLink}>
              {fr ? 'Voir tout' : 'View all'} <ArrowRight size={14} />
            </Link>
          </PanelHeader>

          {recentOrders.length === 0 ? (
            <EmptyState icon={<ShoppingBag size={20} />} text={fr ? 'Aucune vente pour le moment.' : 'No sales yet.'} />
          ) : (
            <div className={s.saleList}>
              {recentOrders.map((order) => {
                const clientName = order.client_name || clientsById.get(order.client_id)?.name || null;
                const isWalkin = !clientName || clientName === 'Passant';
                const firstItem = order.items?.[0];
                const firstName = firstItem ? (firstItem.product_name || productsById.get(firstItem.product_id)?.name) : null;
                const extra = (order.items?.length || 0) - 1;
                const status = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                const method = order.payment_method || extractPaymentMethod(order.notes);
                return (
                  <div key={order.id} className={s.saleRow}>
                    <span
                      className={`${s.avatar} ${isWalkin ? s.avatarWalkin : ''}`}
                      style={{ '--hue': hueFromString(clientName || '') } as React.CSSProperties}
                    >
                      {isWalkin ? <Users size={16} /> : initials(clientName)}
                    </span>
                    <div className={s.saleMain}>
                      <span className={s.saleClient}>{isWalkin ? (fr ? 'Client de passage' : 'Walk-in customer') : clientName}</span>
                      <span className={s.saleItems}>
                        {firstName || (fr ? 'Vente' : 'Sale')}
                        {extra > 0 && ` +${extra} ${fr ? (extra > 1 ? 'autres' : 'autre') : (extra > 1 ? 'others' : 'other')}`}
                      </span>
                    </div>
                    <span className={s.saleAmount}>{financialsMasked ? '—' : formatGNF(order.total)}</span>
                    <span className={s.saleMeta}>
                      <span className={s.payChip} style={{ '--c': paymentColor(method) } as React.CSSProperties}>{paymentLabel(method, language)}</span>
                      {status && <span className={s.statusDot} style={{ background: status.color }} title={fr ? status.label_fr : status.label_en} />}
                      <span suppressHydrationWarning>{formatRelativeDay(order.created_at, language)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {totalOrders > 0 && (
            <div className={s.pager}>
              <span className={s.pagerInfo}>
                {fr
                  ? `${(orderPage - 1) * ordersPerPage + 1}–${Math.min(orderPage * ordersPerPage, totalOrders)} sur ${formatNumber(totalOrders)} ventes`
                  : `${(orderPage - 1) * ordersPerPage + 1}–${Math.min(orderPage * ordersPerPage, totalOrders)} of ${formatNumber(totalOrders)} sales`}
              </span>
              <div className={s.pagerControls}>
                <div className={s.pagerSizes} role="group" aria-label={fr ? 'Ventes par page' : 'Sales per page'}>
                  {[5, 10, 20].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${s.pagerSize} ${ordersPerPage === n ? s.pagerSizeActive : ''}`}
                      onClick={() => { setOrdersPerPage(n); setOrderPage(1); }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button type="button" className={s.pagerBtn} disabled={orderPage <= 1}
                  onClick={() => setOrderPage((p) => p - 1)} aria-label={fr ? 'Page précédente' : 'Previous page'}>
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className={s.pagerBtn} disabled={orderPage >= totalPages}
                  onClick={() => setOrderPage((p) => p + 1)} aria-label={fr ? 'Page suivante' : 'Next page'}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </article>

        <aside className={s.sideCol}>
          <article className={s.panel}>
            <PanelHeader icon={<Users size={18} />} title={fr ? 'Vos clients' : 'Your customers'}>
              <Link href="/crm" className={s.panelLink}>{fr ? 'Clients' : 'Clients'} <ArrowRight size={14} /></Link>
            </PanelHeader>
            <div className={s.clientGrid}>
              <div className={s.clientTile}>
                <strong><AnimatedNumber value={kpis.vip_clients} /></strong>
                <span><Crown size={12} /> {t('dash.vip_clients')}</span>
              </div>
              <div className={s.clientTile}>
                <strong><AnimatedNumber value={kpis.active_clients} /></strong>
                <span><CheckCircle size={12} /> {t('dash.active_clients')}</span>
              </div>
              <div className={s.clientTile}>
                <strong><AnimatedNumber value={kpis.total_clients} /></strong>
                <span><Users size={12} /> {t('dash.total_clients')}</span>
              </div>
              <div className={s.clientTile}>
                <strong><AnimatedNumber value={kpis.new_clients ?? 0} /></strong>
                <span><UserPlus size={12} /> {fr ? 'Nouveaux' : 'New'}</span>
              </div>
            </div>
          </article>

          <article className={s.panel}>
            <PanelHeader
              icon={<AlertTriangle size={18} />}
              title={fr ? 'Alertes stock' : 'Stock alerts'}
              subtitle={fr ? `${LOW_STOCK_THRESHOLD} unités ou moins` : `${LOW_STOCK_THRESHOLD} units or less`}
            />
            {lowStock.length === 0 ? (
              <div className={s.allGood}><PackageCheck size={18} /> {fr ? 'Tous vos produits sont bien approvisionnés.' : 'All products are well stocked.'}</div>
            ) : (
              <div className={s.stockList}>
                {lowStock.map((p) => (
                  <div key={p.id} className={s.stockRow}>
                    <span className={s.stockName}>{p.name}</span>
                    <span className={`${s.stockBadge} ${(p.stock ?? 0) <= 0 ? s.stockBadgeOut : ''}`}>
                      {(p.stock ?? 0) <= 0 ? (fr ? 'Rupture' : 'Out') : `${p.stock} ${fr ? 'restant(s)' : 'left'}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <div className={s.waRow}>
            <span className={s.waIcon}><MessageCircle size={20} /></span>
            <div className={s.waBody}>
              <span className={s.waTitle}>{t('dash.whatsapp_active')}</span>
              <span className={s.waSub}>{fr ? 'Connecté et opérationnel' : 'Connected and active'}</span>
            </div>
            <span className={s.waDot} />
          </div>
        </aside>
      </section>
    </div>
  );
}
