'use client';

import { useEffect, useState } from 'react';
import { CircleDollarSign, ShoppingBag, Users, Clock, Crown, CheckCircle, BarChart3, MessageCircle } from 'lucide-react';
import type { DashboardKPIs, Order } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: { label: 'En attente', cls: 'badge-warning' },
  confirmed: { label: 'Confirmée', cls: 'badge-info' },
  delivered: { label: 'Livrée', cls: 'badge-success' },
  cancelled: { label: 'Annulée', cls: 'badge-error' },
} as const;

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

function KPICard({
  title,
  value,
  change,
  icon,
  color,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="kpi-card card-kpi animate-fade-in">
      <div className="kpi-header">
        <span className="kpi-label">{title}</span>
        <div className="kpi-icon" style={{ background: color, color: color.replace('0.15)', '1)').replace('0.1)', '1)') }}>
          {icon}
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-change">
        <span className="kpi-change-badge">↑ {change}</span>
        <span className="kpi-change-label">ce mois</span>
      </div>

      <style jsx>{`
        .kpi-card { cursor: default; }
        .kpi-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }
        .kpi-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .kpi-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
        }
        .kpi-value {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          letter-spacing: -0.02em;
        }
        .kpi-change {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .kpi-change-badge {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-brand-400);
          background: rgba(16, 185, 129, 0.1);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }
        .kpi-change-label {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [greeting, setGreeting] = useState('Bonjour');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Bonjour');
    else if (hour < 18) setGreeting('Bon après-midi');
    else setGreeting('Bonsoir');

    const fetchData = async () => {
      try {
        const [kpiData, ordersData, clientsData, productsData] = await Promise.all([
          api.getDashboardKPIs(),
          api.getOrders(1, undefined),
          api.getClients(1, 100),
          api.getProducts(1, 100)
        ]);
        setKpis(kpiData);
        setRecentOrders(ordersData.items.slice(0, 5));
        setClients(clientsData.items);
        setProducts(productsData.items);
      } catch (error) {
        toast.error('Erreur lors du chargement des données');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading || !kpis) {
    return <div className="p-8 flex justify-center"><div className="spinner"></div></div>;
  }

  const kpiCards = [
    {
      title: 'Chiffre d\'affaires',
      value: formatGNF(kpis.total_revenue || 0),
      change: '+0%',
      icon: <CircleDollarSign size={20} />,
      color: 'rgba(16, 185, 129, 0.15)',
    },
    {
      title: 'Commandes',
      value: String(kpis.total_orders || 0),
      change: '+0%',
      icon: <ShoppingBag size={20} />,
      color: 'rgba(59, 130, 246, 0.15)',
    },
    {
      title: 'Clients',
      value: String(kpis.total_clients || 0),
      change: '+0%',
      icon: <Users size={20} />,
      color: 'rgba(245, 158, 11, 0.15)',
    },
    {
      title: 'Commandes en attente',
      value: String(kpis.pending_orders),
      change: 'à traiter',
      icon: <Clock size={20} />,
      color: 'rgba(239, 68, 68, 0.15)',
    },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}</h1>
          <p className="page-subtitle">
            Voici un aperçu de votre boutique aujourd&apos;hui
          </p>
        </div>
        <div className="header-actions">
          <button id="btn-new-order" className="btn btn-primary" onClick={() => window.location.href = '/orders'}>
            + Nouvelle commande
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpiCards.map(kpi => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Summary row */}
      <div className="summary-row">
        {/* Recent Orders */}
        <div className="card recent-orders">
          <div className="card-header">
            <h2 className="card-title">Commandes récentes</h2>
            <a href="/orders" className="card-action" id="link-all-orders">Voir tout →</a>
          </div>
          <div className="orders-list">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">Aucune commande pour le moment.</p>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} className="order-row">
                  <div className="order-client">
                    <div className="client-avatar">
                      {order.client_id ? 'C' : '?'}
                    </div>
                    <div className="order-info">
                      <span className="order-client-name">
                        {clients.find(c => c.id === order.client_id)?.name || `Client ${order.client_id.slice(0, 5)}`}
                      </span>
                      <span className="order-product">
                        {products.find(p => p.id === order.items?.[0]?.product_id)?.name || 'Produit inconnu'}
                      </span>
                    </div>
                  </div>
                  <div className="order-meta">
                    <span className="order-amount">{formatGNF(order.total)}</span>
                    <span className={`badge ${STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.cls || 'badge-neutral'}`}>
                      {STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG]?.label || order.status}
                    </span>
                  </div>
                  <span className="order-time">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="stats-panel">
          <div className="card stat-item">
            <div className="stat-icon"><Crown size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">{kpis.vip_clients}</span>
              <span className="stat-label">Clients VIP</span>
            </div>
          </div>
          <div className="card stat-item">
            <div className="stat-icon"><CheckCircle size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">{kpis.active_clients}</span>
              <span className="stat-label">Clients actifs</span>
            </div>
          </div>
          <div className="card stat-item">
            <div className="stat-icon"><BarChart3 size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">{kpis.total_orders}</span>
              <span className="stat-label">Commandes totales</span>
            </div>
          </div>
          <div className="card stat-item">
            <div className="stat-icon"><Users size={20} className="text-brand-500" /></div>
            <div className="stat-content">
              <span className="stat-value">{kpis.total_clients}</span>
              <span className="stat-label">Clients total</span>
            </div>
          </div>

          {/* WhatsApp quick action */}
          <div className="whatsapp-quick card" style={{ borderColor: 'rgba(37,211,102,0.2)', background: 'rgba(37,211,102,0.05)' }}>
            <div className="wa-icon"><MessageCircle size={24} color="#25d366" /></div>
            <div className="wa-content">
              <span className="wa-title">WhatsApp actif</span>
              <span className="wa-sub">Connecté et opérationnel</span>
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
          background: #25d366;
          animation: pulse-brand 2s infinite;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
