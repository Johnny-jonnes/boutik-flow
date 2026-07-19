'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { BarChart3, TrendingUp, Users, ShoppingBag, ArrowUpRight, ArrowDownRight, DollarSign, Target } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import type { AnalyticsData } from '@/types';

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const [period, setPeriod] = useState('7j');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Couleurs des graphiques adaptées au thème actif
  const chartColors = useMemo(() => ({
    grid:      theme === 'light' ? 'rgba(0,0,0,0.06)'      : 'rgba(255,255,255,0.06)',
    barFill0:  theme === 'light' ? '#25D366'               : '#10b981',
    barFill1:  theme === 'light' ? '#128C7E'               : '#059669',
    areaOrders: theme === 'light' ? '#3b82f6'              : '#3b82f6',
    areaDelivered: theme === 'light' ? '#25D366'           : '#10b981',
    areaOrdersFill: theme === 'light' ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.10)',
    areaDeliveredFill: theme === 'light' ? 'rgba(37,211,102,0.08)' : 'rgba(16,185,129,0.10)',
    rankBg:    theme === 'light' ? 'rgba(37,211,102,0.10)' : 'rgba(16,185,129,0.10)',
    rankColor: theme === 'light' ? '#128C7E'               : '#10b981',
    revenueColor: theme === 'light' ? '#128C7E'            : '#10b981',
    trendUp:   theme === 'light' ? '#1da960'               : '#10b981',
    trendDown: theme === 'light' ? '#ef4444'               : '#f43f5e',
    activeTab: theme === 'light' ? '#128C7E'               : '#10b981',
    activeTabBg: theme === 'light' ? 'rgba(37,211,102,0.12)' : 'rgba(16,185,129,0.15)',
  }), [theme]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const res = await api.getAnalyticsData(period);
        setData(res);
      } catch (err) {
        toast.error('Erreur lors du chargement des analyses');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  if (isLoading || !data) {
    return (
      <div className="page flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(16,185,129,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement des analyses...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const { kpis, revenue_data, orders_data, top_products, client_segments } = data;

  const isRevenueUp = !kpis.revenue_change.startsWith('-');
  const isOrdersUp = !kpis.orders_change.startsWith('-');
  const isAovUp = !kpis.aov_change.startsWith('-');
  const isConversionUp = !kpis.conversion_change.startsWith('-');

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Analytique</h1>
          <p className="page-header__desc">Performances de votre boutique à Conakry et au-delà.</p>
        </div>
        <div className="page-header__actions">
          <div className="period-tabs">
            {['24h', '7j', '30j', '90j'].map(p => (
              <button key={p} className={`period-tab ${period === p ? 'period-tab--active' : ''}`} onClick={() => setPeriod(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="analytics-kpis">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Revenu Total</span>
            <div className="kpi-icon kpi-icon--green"><TrendingUp size={18} /></div>
          </div>
          <div className="kpi-value">{Number(kpis.total_revenue).toLocaleString('fr-GN')} <span className="kpi-currency">GNF</span></div>
          <div className={`kpi-trend ${isRevenueUp ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
            {isRevenueUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {kpis.revenue_change} vs période passée
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Commandes</span>
            <div className="kpi-icon kpi-icon--blue"><ShoppingBag size={18} /></div>
          </div>
          <div className="kpi-value">{kpis.total_orders}</div>
          <div className={`kpi-trend ${isOrdersUp ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
            {isOrdersUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {kpis.orders_change} vs période passée
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Panier Moyen</span>
            <div className="kpi-icon kpi-icon--purple"><DollarSign size={18} /></div>
          </div>
          <div className="kpi-value">{Math.round(Number(kpis.average_order_value)).toLocaleString('fr-GN')} <span className="kpi-currency">GNF</span></div>
          <div className={`kpi-trend ${isAovUp ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
            {isAovUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {kpis.aov_change} vs période passée
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Taux de livraison</span>
            <div className="kpi-icon kpi-icon--orange"><Target size={18} /></div>
          </div>
          <div className="kpi-value">{kpis.conversion_rate.toFixed(1)}<span className="kpi-currency">%</span></div>
          <div className={`kpi-trend ${isConversionUp ? 'kpi-trend--up' : 'kpi-trend--down'}`}>
            {isConversionUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {kpis.conversion_change} vs période passée
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="analytics-charts">
        <div className="card analytics-chart-card">
          <h3 className="chart-title">Revenus ({period})</h3>
          <div className="chart-container">
            {revenue_data.length === 0 ? (
              <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucune donnée de vente pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenue_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val.toLocaleString('fr-GN')}`} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                    formatter={(value: any) => [`${Number(value).toLocaleString('fr-GN')} GNF`, 'Revenus']}
                  />
                  <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.barFill0} />
                      <stop offset="100%" stopColor={chartColors.barFill1} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card analytics-chart-card">
          <h3 className="chart-title">Commandes & Livraisons</h3>
          <div className="chart-container">
            {orders_data.length === 0 ? (
              <div style={{ display: 'flex', height: '300px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucune commande pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={orders_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="commandes" stroke={chartColors.areaOrders} fill={chartColors.areaOrdersFill} strokeWidth={2} />
                  <Area type="monotone" dataKey="livrees" stroke={chartColors.areaDelivered} fill={chartColors.areaDeliveredFill} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {orders_data.length > 0 && (
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: chartColors.areaOrders }} /> Commandes</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: chartColors.areaDelivered }} /> Livrées</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="analytics-bottom">
        <div className="card analytics-chart-card">
          <h3 className="chart-title">Top 5 Produits</h3>
          <div className="top-products">
            {top_products.length === 0 ? (
              <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucun produit vendu sur cette période.
              </div>
            ) : (
              top_products.map((product, i) => (
                <div key={i} className="top-product-row">
                  <div className="top-product-rank">#{i + 1}</div>
                  <div className="top-product-info">
                    <span className="top-product-name">{product.name}</span>
                    <span className="top-product-sales">{product.ventes} vente{product.ventes > 1 ? 's' : ''}</span>
                  </div>
                  <div className="top-product-revenue">{Number(product.revenue).toLocaleString('fr-GN')} GNF</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card analytics-chart-card">
          <h3 className="chart-title">Répartition Clients</h3>
          <div className="chart-container">
            {client_segments.every(s => s.value === 0) ? (
              <div style={{ display: 'flex', height: '200px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucun client dans la base de données.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={client_segments} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {client_segments.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    formatter={(value: any) => [`${value}%`, 'Part']}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {!client_segments.every(s => s.value === 0) && (
            <div className="chart-legend chart-legend--wrap">
              {client_segments.map((s, i) => (
                <span key={i} className="legend-item"><span className="legend-dot" style={{ background: s.color }} /> {s.name} ({s.value}%)</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .analytics-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
          margin-bottom: 1.5rem;
        }
        .kpi-card {
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 1.25rem;
          transition: all 0.2s ease;
        }
        .kpi-card:hover {
          border-color: var(--border-default);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .kpi-label { color: var(--text-secondary); font-size: 0.85rem; font-weight: 500; }
        .kpi-icon { padding: 0.5rem; border-radius: 10px; display: flex; }
        .kpi-icon--green  { background: rgba(37, 211, 102, 0.10); color: var(--color-brand-500); }
        .kpi-icon--blue   { background: rgba(59, 130, 246, 0.10);  color: #3b82f6; }
        .kpi-icon--purple { background: rgba(139, 92, 246, 0.10);  color: #8b5cf6; }
        .kpi-icon--orange { background: rgba(245, 158, 11, 0.10);  color: #f59e0b; }
        .kpi-value { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); }
        .kpi-currency { font-size: 0.85rem; font-weight: 500; color: var(--text-muted); }
        .kpi-trend { font-size: 0.75rem; margin-top: 0.5rem; display: flex; align-items: center; gap: 0.25rem; }
        .kpi-trend--up   { color: var(--color-success); }
        .kpi-trend--down { color: var(--color-error); }

        .period-tabs {
          display: flex;
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 0.25rem;
          gap: 0.25rem;
        }
        .period-tab {
          padding: 0.4rem 0.75rem;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
          transition: all 0.15s ease;
        }
        .period-tab:hover { color: var(--text-primary); }
        .period-tab--active {
          background: var(--border-default);
          color: var(--color-brand-600);
          font-weight: 600;
        }

        .analytics-charts {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .analytics-bottom {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
          gap: 1.5rem;
        }
        .analytics-chart-card { padding: 1.5rem; }
        .chart-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 1.25rem;
        }
        .chart-container {
          width: 100%;
          min-height: 250px;
        }
        .chart-legend {
          display: flex;
          gap: 1.25rem;
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-subtle);
        }
        .chart-legend--wrap { flex-wrap: wrap; }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .top-products {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .top-product-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--overlay-subtle);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          transition: all 0.15s ease;
        }
        .top-product-row:hover {
          border-color: var(--border-default);
          background: var(--surface-hover);
        }
        .top-product-rank {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(37, 211, 102, 0.10);
          color: var(--color-brand-500);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .top-product-info {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        .top-product-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .top-product-sales {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .top-product-revenue {
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--color-brand-500);
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .analytics-charts, .analytics-bottom {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
