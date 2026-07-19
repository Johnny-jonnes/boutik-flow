'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Store, Clock, CheckCircle, XCircle, AlertCircle,
  Bell, Users, TrendingUp, ChevronRight, RefreshCcw
} from 'lucide-react';
import { api } from '@/lib/api/client';
import type { AdminStats, AdminNotification } from '@/types';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending:  { label: 'En attente',  cls: 'status-pending',  icon: Clock },
  active:   { label: 'Active',      cls: 'status-active',   icon: CheckCircle },
  blocked:  { label: 'Bloquée',     cls: 'status-blocked',  icon: AlertCircle },
  rejected: { label: 'Rejetée',     cls: 'status-rejected', icon: XCircle },
} as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statsData, notifsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminNotifications(false),
      ]);
      setStats(statsData);
      setNotifications(notifsData.slice(0, 8));
    } catch {
      toast.error('Impossible de charger les données admin');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      toast.error('Erreur lors du marquage');
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
      </div>
    );
  }

  const kpiCards = [
    {
      id: 'kpi-total',
      label: 'Boutiques totales',
      value: stats.total_tenants,
      icon: Store,
      color: 'rgba(16, 185, 129, 0.15)',
      iconColor: '#10b981',
      href: '/admin/tenants',
    },
    {
      id: 'kpi-pending',
      label: 'En attente',
      value: stats.pending_tenants,
      icon: Clock,
      color: 'rgba(245, 158, 11, 0.15)',
      iconColor: '#f59e0b',
      href: '/admin/tenants?status=pending',
    },
    {
      id: 'kpi-active',
      label: 'Actives',
      value: stats.active_tenants,
      icon: CheckCircle,
      color: 'rgba(16, 185, 129, 0.12)',
      iconColor: '#34d399',
      href: '/admin/tenants?status=active',
    },
    {
      id: 'kpi-blocked',
      label: 'Bloquées / Rejetées',
      value: stats.blocked_tenants + stats.rejected_tenants,
      icon: XCircle,
      color: 'rgba(239, 68, 68, 0.12)',
      iconColor: '#f87171',
      href: '/admin/tenants?status=blocked',
    },
    {
      id: 'kpi-users',
      label: 'Utilisateurs total',
      value: stats.total_users,
      icon: Users,
      color: 'rgba(59, 130, 246, 0.12)',
      iconColor: '#60a5fa',
      href: '/admin/tenants',
    },
    {
      id: 'kpi-notifs',
      label: 'Notifications non lues',
      value: stats.unread_notifications,
      icon: Bell,
      color: 'rgba(168, 85, 247, 0.12)',
      iconColor: '#c084fc',
      href: '/admin/tenants?status=pending',
    },
  ];

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-header">
        <div>
          <div className="admin-header-badge">
            <span className="admin-badge-dot" />
            <span>Espace Administration</span>
          </div>
          <h1 className="admin-title">Vue d&apos;ensemble</h1>
          <p className="admin-subtitle">Gestion globale de la plateforme BoutikFlow</p>
        </div>
        <div className="admin-header-actions">
          <button id="btn-admin-refresh" className="btn btn-ghost btn-sm" onClick={fetchData}>
            <RefreshCcw size={15} />
            Actualiser
          </button>
          <Link href="/admin/tenants" id="btn-admin-tenants" className="btn btn-primary btn-sm">
            <Store size={15} />
            Gérer les boutiques
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="admin-kpi-grid">
        {kpiCards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.id} href={card.href} id={card.id} className="admin-kpi-card card">
              <div className="admin-kpi-top">
                <div className="admin-kpi-icon" style={{ background: card.color }}>
                  <Icon size={18} style={{ color: card.iconColor }} />
                </div>
                <ChevronRight size={14} className="admin-kpi-arrow" />
              </div>
              <div className="admin-kpi-value">{card.value}</div>
              <div className="admin-kpi-label">{card.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Notifications + Quick actions */}
      <div className="admin-main-row">
        {/* Notifications récentes */}
        <div className="card admin-notifs-card">
          <div className="admin-card-header">
            <div className="admin-card-title-row">
              <Bell size={16} />
              <h2>Notifications récentes</h2>
              {stats.unread_notifications > 0 && (
                <span className="admin-notif-badge">{stats.unread_notifications}</span>
              )}
            </div>
            <Link href="/admin/tenants?status=pending" className="card-action" id="link-admin-pending">
              Voir tout →
            </Link>
          </div>

          <div className="admin-notifs-list">
            {notifications.length === 0 ? (
              <div className="admin-empty">
                <Bell size={32} opacity={0.3} />
                <p>Aucune notification</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`admin-notif-item ${!notif.is_read ? 'admin-notif-item--unread' : ''}`}
                >
                  <div className="admin-notif-dot-wrap">
                    {!notif.is_read && <span className="admin-notif-dot" />}
                  </div>
                  <div className="admin-notif-content">
                    <div className="admin-notif-title">{notif.title}</div>
                    {notif.tenant_name && (
                      <div className="admin-notif-sub">
                        <Store size={11} />
                        {notif.tenant_name}
                        {notif.tenant_slug && <span className="admin-notif-slug">@{notif.tenant_slug}</span>}
                      </div>
                    )}
                  </div>
                  <div className="admin-notif-meta">
                    <span className="admin-notif-time">{timeAgo(notif.created_at)}</span>
                    {!notif.is_read && (
                      <button
                        className="admin-notif-read-btn"
                        onClick={() => handleMarkRead(notif.id)}
                        title="Marquer comme lu"
                      >
                        ✓
                      </button>
                    )}
                    {notif.tenant_id && (
                      <Link
                        href={`/admin/tenants/${notif.tenant_id}`}
                        className="admin-notif-link"
                        title="Voir la boutique"
                      >
                        <ChevronRight size={13} />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel Stats rapides */}
        <div className="admin-quick-panel">
          {/* Répartition statuts */}
          <div className="card admin-dist-card">
            <div className="admin-card-header">
              <div className="admin-card-title-row">
                <TrendingUp size={16} />
                <h2>Répartition boutiques</h2>
              </div>
            </div>
            <div className="admin-dist-list">
              {[
                { label: 'Actives', value: stats.active_tenants, pct: stats.total_tenants ? Math.round(stats.active_tenants / stats.total_tenants * 100) : 0, color: '#10b981' },
                { label: 'En attente', value: stats.pending_tenants, pct: stats.total_tenants ? Math.round(stats.pending_tenants / stats.total_tenants * 100) : 0, color: '#f59e0b' },
                { label: 'Bloquées', value: stats.blocked_tenants, pct: stats.total_tenants ? Math.round(stats.blocked_tenants / stats.total_tenants * 100) : 0, color: '#ef4444' },
                { label: 'Rejetées', value: stats.rejected_tenants, pct: stats.total_tenants ? Math.round(stats.rejected_tenants / stats.total_tenants * 100) : 0, color: '#6b7280' },
              ].map(item => (
                <div key={item.label} className="admin-dist-row">
                  <div className="admin-dist-row-info">
                    <span className="admin-dist-dot" style={{ background: item.color }} />
                    <span className="admin-dist-label">{item.label}</span>
                    <span className="admin-dist-count">{item.value}</span>
                  </div>
                  <div className="admin-dist-bar-wrap">
                    <div
                      className="admin-dist-bar-fill"
                      style={{ width: `${item.pct}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action rapide : Voir les boutiques en attente */}
          <Link href="/admin/tenants?status=pending" id="link-admin-validate" className="card admin-action-card">
            <div className="admin-action-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <Clock size={20} style={{ color: '#f59e0b' }} />
            </div>
            <div className="admin-action-content">
              <span className="admin-action-title">
                {stats.pending_tenants} boutique{stats.pending_tenants !== 1 ? 's' : ''} à valider
              </span>
              <span className="admin-action-sub">Cliquez pour les traiter</span>
            </div>
            <ChevronRight size={16} className="admin-action-arrow" />
          </Link>
        </div>
      </div>

      <style jsx>{`
        .admin-loading {
          display: flex; align-items: center; justify-content: center;
          min-height: 300px;
        }

        /* ─── Page Layout ─── */
        .admin-page {
          display: flex; flex-direction: column; gap: 1.75rem;
        }

        /* ─── Header ─── */
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .admin-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-brand-400);
          background: var(--brand-alpha-10);
          border: 1px solid var(--brand-alpha-20);
          border-radius: 100px;
          padding: 0.25rem 0.75rem;
          margin-bottom: 0.75rem;
        }
        .admin-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--color-brand-400);
          animation: pulse-brand 2s infinite;
        }
        .admin-title {
          font-size: 1.75rem;
          margin-bottom: 0.375rem;
        }
        .admin-subtitle {
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .admin-header-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        .btn-sm {
          padding: 0.45rem 0.875rem;
          font-size: 0.8rem;
          gap: 0.4rem;
        }

        /* ─── KPI Grid ─── */
        .admin-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
        }
        .admin-kpi-card {
          padding: 1rem;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .admin-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .admin-kpi-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .admin-kpi-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .admin-kpi-arrow {
          color: var(--text-disabled);
          transition: transform 0.2s;
        }
        .admin-kpi-card:hover .admin-kpi-arrow {
          transform: translateX(3px);
          color: var(--text-muted);
        }
        .admin-kpi-value {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }
        .admin-kpi-label {
          font-size: 0.78rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* ─── Main Row ─── */
        .admin-main-row {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 1.25rem;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .admin-main-row { grid-template-columns: 1fr; }
        }

        /* ─── Card Header ─── */
        .admin-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        .admin-card-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-muted);
        }
        .admin-card-title-row h2 {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .admin-notif-badge {
          font-size: 0.65rem;
          font-weight: 700;
          background: #ef4444;
          color: white;
          border-radius: 100px;
          padding: 0.1rem 0.4rem;
          min-width: 18px;
          text-align: center;
        }

        /* ─── Notifications Card ─── */
        .admin-notifs-card {
          padding: 1.5rem;
        }
        .admin-notifs-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .admin-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 2rem 0;
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        .admin-notif-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.875rem 0;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s;
        }
        .admin-notif-item:last-child { border-bottom: none; }
        .admin-notif-item--unread .admin-notif-title {
          color: var(--text-primary);
          font-weight: 600;
        }
        .admin-notif-dot-wrap {
          width: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .admin-notif-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--color-brand-400);
          flex-shrink: 0;
        }
        .admin-notif-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .admin-notif-title {
          font-size: 0.85rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .admin-notif-sub {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .admin-notif-slug {
          color: var(--color-brand-500);
        }
        .admin-notif-meta {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-shrink: 0;
        }
        .admin-notif-time {
          font-size: 0.7rem;
          color: var(--text-disabled);
          white-space: nowrap;
        }
        .admin-notif-read-btn {
          background: var(--overlay-light);
          border: 1px solid var(--overlay-border);
          color: var(--color-brand-400);
          border-radius: 4px;
          font-size: 0.7rem;
          padding: 0.1rem 0.35rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .admin-notif-read-btn:hover {
          background: var(--brand-alpha-10);
        }
        .admin-notif-link {
          display: flex;
          align-items: center;
          color: var(--text-muted);
          transition: color 0.15s;
        }
        .admin-notif-link:hover { color: var(--color-brand-400); }

        /* ─── Quick Panel ─── */
        .admin-quick-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .admin-dist-card {
          padding: 1.25rem;
        }
        .admin-dist-list {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }
        .admin-dist-row {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .admin-dist-row-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .admin-dist-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .admin-dist-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          flex: 1;
        }
        .admin-dist-count {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .admin-dist-bar-wrap {
          height: 4px;
          background: var(--overlay-medium);
          border-radius: 2px;
          overflow: hidden;
        }
        .admin-dist-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.6s ease;
          min-width: 2px;
        }

        /* ─── Action rapide ─── */
        .admin-action-card {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 1rem;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .admin-action-card:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }
        .admin-action-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .admin-action-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .admin-action-title {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .admin-action-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .admin-action-arrow {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
