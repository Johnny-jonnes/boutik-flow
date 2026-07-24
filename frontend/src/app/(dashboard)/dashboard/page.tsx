'use client';

import { useEffect, useState } from 'react';
import { CircleDollarSign, ShoppingBag, Users, Clock, Crown, CheckCircle, BarChart3, MessageCircle, ArrowDownRight, Wallet } from 'lucide-react';
import type { DashboardKPIs, Order, AnalyticsData } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { useLanguage } from '@/context/LanguageContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_CONFIG = {
  pending: { label_fr: 'En attente', label_en: 'Pending', cls: 'badge-warning' },
  confirmed: { label_fr: 'Confirmée', label_en: 'Confirmed', cls: 'badge-info' },
  delivered: { label_fr: 'Livrée', label_en: 'Delivered', cls: 'badge-success' },
  cancelled: { label_fr: 'Annulée', label_en: 'Cancelled', cls: 'badge-error' },
} as const;

function AnimatedNumber({ value, isCurrency = false, suffix = '' }: { value: number; isCurrency?: boolean; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const duration = 1000; // milliseconds
    const startTime = performance.now();
    let animationFrameId: number;

    const updateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (easeOutQuad)
      const easeProgress = progress * (2 - progress);
      const current = Math.floor(easeProgress * end);
      
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(end);
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  const formatted = new Intl.NumberFormat('fr-FR').format(displayValue);
  return <span>{formatted}{isCurrency ? ' GNF' : ''}{suffix}</span>;
}

function KPICard({
  title,
  value,
  change,
  icon,
  color,
  isCurrency = false,
}: {
  title: string;
  value: number;
  change: string;
  icon: React.ReactNode;
  color: string;
  isCurrency?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <div className="kpi-card card anim-slide-up">
      <div className="kpi-body">
        <div className="kpi-info">
          <span className="kpi-label">{title}</span>
          <div className="kpi-value">
            <AnimatedNumber value={value} isCurrency={isCurrency} />
          </div>
          <div className="kpi-change">
            <span className="kpi-change-badge">{change}</span>
            <span className="kpi-change-label">{language === 'fr' ? 'sur la période' : 'in period'}</span>
          </div>
        </div>
        <div className="kpi-icon-box" style={{ background: color }}>
          {icon}
        </div>
      </div>

      <style jsx>{`
        .kpi-card { 
          padding: 1.25rem 1.5rem;
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-xl);
          cursor: default; 
          transition: transform 200ms var(--ease-out), box-shadow 200ms ease, border-color 150ms ease;
          will-change: transform;
        }
        .kpi-card:hover {
          transform: translateY(-3px);
          border-color: var(--border-default);
          box-shadow: var(--shadow-md);
        }
        .kpi-body {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }
        .kpi-info {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .kpi-label {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .kpi-icon-box {
          width: 46px;
          height: 46px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kpi-value {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
          line-height: 1.15;
        }
        .kpi-change {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 0.2rem;
        }
        .kpi-change-badge {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-brand-400);
          background: var(--brand-alpha-10);
          padding: 0.1rem 0.45rem;
          border-radius: 99px;
          border: 1px solid var(--brand-alpha-15);
        }
        .kpi-change-label {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [orderPage, setOrderPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(10);
  const [periodFilter, setPeriodFilter] = useState<'7j' | '30j' | '90j' | 'custom'>('7j');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [greeting, setGreeting] = useState('Bonjour');
  const [isLoading, setIsLoading] = useState(true);
  const { t, language } = useLanguage();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting(t('dash.welcome_morning'));
    else if (hour < 18) setGreeting(t('dash.welcome_afternoon'));
    else setGreeting(t('dash.welcome_evening'));
  }, [language, t]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [kpiData, ordersData, clientsData, productsData, analyticsData] = await Promise.all([
        api.getDashboardKPIs(),
        api.getOrders(orderPage, undefined),
        api.getClients(1, 100),
        api.getProducts(1, 100),
        api.getAnalyticsData(periodFilter).catch(() => null)
      ]);
      setKpis(kpiData);
      setRecentOrders(ordersData.items.slice(0, ordersPerPage));
      setTotalOrders(ordersData.total);
      setClients(clientsData.items);
      setProducts(productsData.items);
      setAnalytics(analyticsData);
    } catch (error) {
      toast.error(language === 'fr' ? 'Erreur lors du chargement des données' : 'Error loading dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [language, orderPage, ordersPerPage, periodFilter]);

  if (isLoading || !kpis) {
    return <div className="p-8 flex justify-center"><div className="spinner"></div></div>;
  }

  // Reverse data points for chronological ordering
  const chartData = analytics?.revenue_data 
    ? [...analytics.revenue_data].reverse().map(pt => ({
        ...pt,
        value: Number(pt.value)
      }))
    : [];

  const kpiCards = [
    {
      title: language === 'fr' ? 'Chiffre d\'Affaires' : 'Revenue',
      value: kpis.total_revenue || 0,
      change: language === 'fr' ? 'Revenu total' : 'Total income',
      icon: <CircleDollarSign size={20} style={{ color: '#10b981' }} />,
      color: 'rgba(16,185,129,0.12)',
      isCurrency: true,
    },
    {
      title: language === 'fr' ? 'Dépenses' : 'Expenses',
      value: kpis.total_expenses || 0,
      change: language === 'fr' ? 'Charges boutique' : 'Shop charges',
      icon: <ArrowDownRight size={20} style={{ color: '#f43f5e' }} />,
      color: 'rgba(244,63,94,0.12)',
      isCurrency: true,
    },
    {
      title: language === 'fr' ? 'Bénéfice Net' : 'Net Profit',
      value: kpis.net_balance || 0,
      change: language === 'fr' ? 'Solde net' : 'Net balance',
      icon: <Wallet size={20} style={{ color: '#818cf8' }} />,
      color: 'rgba(99,102,241,0.12)',
      isCurrency: true,
    },
    {
      title: t('dash.orders'),
      value: kpis.total_orders || 0,
      change: '+8.1%',
      icon: <ShoppingBag size={20} style={{ color: '#f59e0b' }} />,
      color: 'rgba(245,158,11,0.12)',
    },
    {
      title: t('dash.clients'),
      value: kpis.total_clients || 0,
      change: '+14.2%',
      icon: <Users size={20} style={{ color: '#a78bfa' }} />,
      color: 'rgba(167,139,250,0.12)',
    },
    {
      title: t('dash.pending_orders'),
      value: kpis.pending_orders || 0,
      change: language === 'fr' ? 'à traiter' : 'pending',
      icon: <Clock size={20} style={{ color: '#71717a' }} />,
      color: 'rgba(113,113,122,0.12)',
    },
  ];

  return (
    <div className="page">
      {/* Header avec filtre de période */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}</h1>
          <p className="page-subtitle">
            {language === 'fr' ? "Voici l'activité globale et les statistiques de votre boutique" : "Here is your overall shop activity and performance"}
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            className="input" 
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            style={{ width: 'auto', fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
          >
            <option value="7j">{language === 'fr' ? '7 derniers jours' : 'Last 7 days'}</option>
            <option value="30j">{language === 'fr' ? '30 derniers jours' : 'Last 30 days'}</option>
            <option value="90j">{language === 'fr' ? '90 derniers jours' : 'Last 90 days'}</option>
            <option value="custom">{language === 'fr' ? 'Période personnalisée' : 'Custom range'}</option>
          </select>

          {periodFilter === 'custom' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="date"
                className="input"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                placeholder="Début"
              />
              <span style={{ color: 'var(--text-muted)' }}>à</span>
              <input
                type="date"
                className="input"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                placeholder="Fin"
              />
            </div>
          )}

          <button id="btn-new-order" className="btn btn-primary" onClick={() => window.location.href = '/orders'}>
            + {language === 'fr' ? 'Nouvelle commande' : 'New Order'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpiCards.map(kpi => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Chart Section */}
      {chartData.length > 0 && (
        <div className="card chart-card anim-fade-in">
          <div className="card-header">
            <h2 className="card-title">
              {language === 'fr' ? 'Tendance du Chiffre d\'Affaires' : 'Revenue Trend'}
            </h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val / 1000}k`}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => [`${new Intl.NumberFormat('fr-FR').format(value)} GNF`, language === 'fr' ? 'Chiffre d\'affaires' : 'Revenue']}
                  contentStyle={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-lg)',
                    fontSize: '0.85rem',
                  }}
                  cursor={{ stroke: 'var(--color-brand-400)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#818cf8', stroke: '#6366f1', strokeWidth: 2 }}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary row */}
      <div className="summary-row">
        {/* Recent Orders avec pagination */}
        <div className="card recent-orders">
          <div className="card-header">
            <h2 className="card-title">{t('dash.recent_orders')} ({totalOrders})</h2>
            <a href="/orders" className="card-action" id="link-all-orders">
              {language === 'fr' ? 'Voir tout →' : 'View all →'}
            </a>
          </div>
          <div className="orders-list">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">
                {language === 'fr' ? 'Aucune commande pour le moment.' : 'No orders yet.'}
              </p>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="order-row">
                  <div className="order-client">
                    <div className="client-avatar">
                      {order.client_id ? 'C' : '?'}
                    </div>
                    <div className="order-info">
                      <span className="order-client-name">
                        {clients.find(c => c.id === order.client_id)?.name || `Client ${order.client_id?.slice(0, 5) || 'Comptoir'}`}
                      </span>
                      <span className="order-product">
                        {products.find(p => p.id === order.items?.[0]?.product_id)?.name || (language === 'fr' ? 'Produit / Vente' : 'Product / Sale')}
                      </span>
                    </div>
                  </div>
                  <div className="order-meta">
                    <span className="order-amount">
                      {new Intl.NumberFormat('fr-FR').format(order.total)} GNF
                    </span>
                    <span className={`badge ${STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.cls || 'badge-neutral'}`}>
                      {language === 'fr' 
                        ? (STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.label_fr || order.status)
                        : (STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.label_en || order.status)}
                    </span>
                  </div>
                  <span className="order-time">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>

          {/* Pagination bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Page {orderPage} sur {Math.max(1, Math.ceil(totalOrders / ordersPerPage))} ({totalOrders} commandes)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select 
                value={ordersPerPage} 
                onChange={(e) => { setOrdersPerPage(Number(e.target.value)); setOrderPage(1); }}
                className="input"
                style={{ width: 'auto', fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button 
                disabled={orderPage <= 1} 
                onClick={() => setOrderPage(p => p - 1)} 
                className="btn btn-ghost" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                &larr; {language === 'fr' ? 'Précédent' : 'Prev'}
              </button>
              <button 
                disabled={orderPage * ordersPerPage >= totalOrders} 
                onClick={() => setOrderPage(p => p + 1)} 
                className="btn btn-ghost" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              >
                {language === 'fr' ? 'Suivant' : 'Next'} &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="stats-panel">
          <div className="card stat-item">
            <div className="stat-icon"><Crown size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">
                <AnimatedNumber value={kpis.vip_clients} />
              </span>
              <span className="stat-label">{t('dash.vip_clients')}</span>
            </div>
          </div>
          <div className="card stat-item">
            <div className="stat-icon"><CheckCircle size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">
                <AnimatedNumber value={kpis.active_clients} />
              </span>
              <span className="stat-label">{t('dash.active_clients')}</span>
            </div>
          </div>
          <div className="card stat-item">
            <div className="stat-icon"><BarChart3 size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">
                <AnimatedNumber value={kpis.total_orders} />
              </span>
              <span className="stat-label">{t('dash.total_orders')}</span>
            </div>
          </div>
          <div className="card stat-item">
            <div className="stat-icon"><Users size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">
                <AnimatedNumber value={kpis.total_clients} />
              </span>
              <span className="stat-label">{t('dash.total_clients')}</span>
            </div>
          </div>

          {/* WhatsApp quick action */}
          <div className="whatsapp-quick card" style={{ borderColor: 'rgba(37,211,102,0.2)', background: 'rgba(37,211,102,0.05)' }}>
            <div className="wa-icon"><MessageCircle size={24} style={{ color: 'var(--color-brand-500)' }} /></div>
            <div className="wa-content">
              <span className="wa-title">{t('dash.whatsapp_active')}</span>
              <span className="wa-sub">
                {language === 'fr' ? 'Connecté et opérationnel' : 'Connected and active'}
              </span>
            </div>
            <div className="wa-dot" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.75rem; }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .page-title {
          font-size: 1.75rem;
          margin-bottom: 0.375rem;
        }

        .page-subtitle {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        .chart-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          border: 1px solid var(--border-subtle);
        }

        .chart-container {
          width: 100%;
          height: 240px;
        }

        .summary-row {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 1.25rem;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .summary-row { grid-template-columns: 1fr; }
        }

        /* Recent Orders */
        .recent-orders { padding: 1.5rem; }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        .card-title {
          font-size: 1rem;
          font-weight: 700;
        }
        .card-action {
          font-size: 0.8rem;
          color: var(--color-brand-400);
          text-decoration: none;
          font-weight: 500;
          transition: var(--transition-fast);
        }
        .card-action:hover { color: var(--color-brand-300); }

        .orders-list { display: flex; flex-direction: column; gap: 0; }

        .order-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 0;
          border-bottom: 1px solid var(--border-subtle);
          transition: var(--transition-fast);
        }
        .order-row:last-child { border-bottom: none; }
        .order-row:hover { background: var(--surface-hover); margin: 0 -1.5rem; padding: 0.875rem 1.5rem; border-radius: 8px; }

        .order-client {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          flex: 1;
          min-width: 0;
        }

        .client-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
        }

        .order-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .order-client-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .order-product {
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .order-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.3rem;
          flex-shrink: 0;
        }

        .order-amount {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
        }

        .order-time {
          font-size: 0.72rem;
          color: var(--text-disabled);
          flex-shrink: 0;
          white-space: nowrap;
        }

        /* Stats panel */
        .stats-panel {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          transition: transform 0.2s ease;
        }
        .stat-item:hover {
          transform: translateX(4px);
        }

        .stat-icon {
          font-size: 1.25rem;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-3);
          border-radius: 10px;
          flex-shrink: 0;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .stat-value {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .whatsapp-quick {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          position: relative;
        }

        .wa-icon { font-size: 1.5rem; }

        .wa-content {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          flex: 1;
        }

        .wa-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .wa-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .wa-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--color-brand-500);
          animation: pulse-brand 2s infinite;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
