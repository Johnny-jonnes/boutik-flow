'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Store, Search, ChevronLeft, ChevronRight, CheckCircle,
  Clock, XCircle, AlertCircle, Filter, Eye, CheckCheck,
  PauseCircle, Trash2, RefreshCcw
} from 'lucide-react';
import { api } from '@/lib/api/client';
import type { AdminTenantListItem, TenantStatus, TenantPlan } from '@/types';
import { toast } from 'sonner';

// ─── Configuration Statuts ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TenantStatus, { label: string; cls: string; icon: React.FC<{ size?: number }> }> = {
  pending:  { label: 'En attente', cls: 'badge-status-pending',  icon: Clock },
  active:   { label: 'Active',     cls: 'badge-status-active',   icon: CheckCircle },
  blocked:  { label: 'Bloquée',    cls: 'badge-status-blocked',  icon: AlertCircle },
  rejected: { label: 'Rejetée',    cls: 'badge-status-rejected', icon: XCircle },
};

const PLAN_CONFIG: Record<TenantPlan, { label: string; cls: string }> = {
  freemium: { label: 'Freemium', cls: 'plan-freemium' },
  starter:  { label: 'Starter',  cls: 'plan-starter' },
  pro:      { label: 'Pro',      cls: 'plan-pro' },
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title, message, confirmLabel, danger,
  onConfirm, onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTenantsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tenants, setTenants] = useState<AdminTenantListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>(
    (searchParams.get('status') as TenantStatus) || ''
  );
  const [planFilter, setPlanFilter] = useState<TenantPlan | ''>(
    (searchParams.get('plan') as TenantPlan) || ''
  );
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));

  const [confirmAction, setConfirmAction] = useState<{
    type: 'validate' | 'block' | 'reject' | 'delete';
    tenant: AdminTenantListItem;
  } | null>(null);

  const PER_PAGE = 20;

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAdminTenants(
        page,
        PER_PAGE,
        search || undefined,
        statusFilter || undefined,
        planFilter || undefined,
      );
      setTenants(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      toast.error('Impossible de charger les boutiques');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const executeAction = async (
    type: 'validate' | 'block' | 'reject' | 'delete',
    tenant: AdminTenantListItem,
  ) => {
    setActionLoading(tenant.id);
    setConfirmAction(null);
    try {
      if (type === 'delete') {
        await api.deleteAdminTenant(tenant.id);
        setTenants(prev => prev.filter(t => t.id !== tenant.id));
        toast.success(`Boutique "${tenant.name}" supprimée`);
      } else {
        const newStatus: TenantStatus =
          type === 'validate' ? 'active' : type === 'block' ? 'blocked' : 'rejected';
        const updated = await api.updateTenantStatus(tenant.id, { status: newStatus });
        setTenants(prev => prev.map(t =>
          t.id === tenant.id ? { ...t, status: updated.status, is_active: updated.is_active } : t
        ));
        const labels = { active: 'validée ✓', blocked: 'bloquée', rejected: 'rejetée' };
        toast.success(`Boutique "${tenant.name}" ${labels[newStatus]}`);
      }
    } catch {
      toast.error('Erreur lors de l\'action');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTenants();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  return (
    <div className="at-page">
      {/* Header */}
      <div className="at-header">
        <div>
          <Link href="/admin" className="at-back-link">
            <ChevronLeft size={14} /> Tableau de bord admin
          </Link>
          <h1 className="at-title">Gestion des boutiques</h1>
          <p className="at-subtitle">{total} boutique{total !== 1 ? 's' : ''} au total</p>
        </div>
        <button id="btn-tenants-refresh" className="btn btn-ghost btn-sm" onClick={fetchTenants}>
          <RefreshCcw size={15} />
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="card at-filters">
        <form className="at-search-row" onSubmit={handleSearch}>
          <div className="at-search-wrap">
            <Search size={15} className="at-search-icon" />
            <input
              id="input-tenant-search"
              type="text"
              className="at-search-input"
              placeholder="Rechercher par nom ou slug..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button id="btn-tenant-search" type="submit" className="btn btn-primary btn-sm">
            Rechercher
          </button>
        </form>

        <div className="at-filter-row">
          <Filter size={13} className="at-filter-icon" />
          {/* Statut */}
          <div className="at-filter-group">
            {(['', 'pending', 'active', 'blocked', 'rejected'] as const).map(s => (
              <button
                key={s}
                id={`filter-status-${s || 'all'}`}
                className={`at-filter-btn ${statusFilter === s ? 'at-filter-btn--active' : ''}`}
                onClick={() => { setStatusFilter(s); setPage(1); }}
              >
                {s === '' ? 'Tous les statuts' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          <div className="at-filter-sep" />

          {/* Plan */}
          <div className="at-filter-group">
            {(['', 'freemium', 'starter', 'pro'] as const).map(p => (
              <button
                key={p}
                id={`filter-plan-${p || 'all'}`}
                className={`at-filter-btn ${planFilter === p ? 'at-filter-btn--active' : ''}`}
                onClick={() => { setPlanFilter(p); setPage(1); }}
              >
                {p === '' ? 'Tous les plans' : PLAN_CONFIG[p].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card at-table-card">
        {isLoading ? (
          <div className="at-loader"><div className="spinner" /></div>
        ) : tenants.length === 0 ? (
          <div className="at-empty">
            <Store size={36} opacity={0.2} />
            <p>Aucune boutique trouvée</p>
          </div>
        ) : (
          <div className="at-table-wrap">
            <table className="at-table">
              <thead>
                <tr>
                  <th>Boutique</th>
                  <th>Propriétaire</th>
                  <th>Plan</th>
                  <th>Statut</th>
                  <th>Créée le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map(tenant => {
                  const sc = STATUS_CONFIG[tenant.status as TenantStatus] || STATUS_CONFIG.pending;
                  const pc = PLAN_CONFIG[tenant.plan as TenantPlan] || PLAN_CONFIG.freemium;
                  const StatusIcon = sc.icon;
                  const isActing = actionLoading === tenant.id;
                  return (
                    <tr key={tenant.id} className={isActing ? 'at-row--loading' : ''}>
                      <td>
                        <div className="at-boutique-cell">
                          <div className="at-boutique-icon">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="at-boutique-info">
                            <span className="at-boutique-name">{tenant.name}</span>
                            <span className="at-boutique-slug">@{tenant.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="at-owner-cell">
                          <span className="at-owner-email">{tenant.owner_email || '—'}</span>
                          {tenant.owner_name && (
                            <span className="at-owner-name">{tenant.owner_name}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`at-plan-badge ${pc.cls}`}>{pc.label}</span>
                      </td>
                      <td>
                        <span className={`at-status-badge ${sc.cls}`}>
                          <StatusIcon size={11} />
                          {sc.label}
                        </span>
                      </td>
                      <td>
                        <span className="at-date">{formatDate(tenant.created_at)}</span>
                      </td>
                      <td>
                        <div className="at-actions">
                          <Link
                            href={`/admin/tenants/${tenant.id}`}
                            id={`btn-view-${tenant.id.slice(0, 8)}`}
                            className="at-action-btn at-action-btn--view"
                            title="Voir le détail"
                          >
                            <Eye size={14} />
                          </Link>

                          {tenant.status !== 'active' && (
                            <button
                              id={`btn-validate-${tenant.id.slice(0, 8)}`}
                              className="at-action-btn at-action-btn--validate"
                              title="Valider"
                              disabled={isActing}
                              onClick={() => setConfirmAction({ type: 'validate', tenant })}
                            >
                              <CheckCheck size={14} />
                            </button>
                          )}

                          {tenant.status === 'active' && (
                            <button
                              id={`btn-block-${tenant.id.slice(0, 8)}`}
                              className="at-action-btn at-action-btn--block"
                              title="Bloquer"
                              disabled={isActing}
                              onClick={() => setConfirmAction({ type: 'block', tenant })}
                            >
                              <PauseCircle size={14} />
                            </button>
                          )}

                          {tenant.status === 'pending' && (
                            <button
                              id={`btn-reject-${tenant.id.slice(0, 8)}`}
                              className="at-action-btn at-action-btn--reject"
                              title="Rejeter"
                              disabled={isActing}
                              onClick={() => setConfirmAction({ type: 'reject', tenant })}
                            >
                              <XCircle size={14} />
                            </button>
                          )}

                          <button
                            id={`btn-delete-${tenant.id.slice(0, 8)}`}
                            className="at-action-btn at-action-btn--delete"
                            title="Supprimer"
                            disabled={isActing}
                            onClick={() => setConfirmAction({ type: 'delete', tenant })}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && pages > 1 && (
          <div className="at-pagination">
            <span className="at-pagination-info">
              Page {page} sur {pages} — {total} résultat{total !== 1 ? 's' : ''}
            </span>
            <div className="at-pagination-btns">
              <button
                id="btn-prev-page"
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={15} />
                Précédent
              </button>
              <button
                id="btn-next-page"
                className="btn btn-ghost btn-sm"
                disabled={page >= pages}
                onClick={() => setPage(p => p + 1)}
              >
                Suivant
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmation */}
      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'validate' ? 'Valider la boutique' :
            confirmAction.type === 'block' ? 'Bloquer la boutique' :
            confirmAction.type === 'reject' ? 'Rejeter la boutique' :
            'Supprimer la boutique'
          }
          message={
            confirmAction.type === 'validate'
              ? `La boutique "${confirmAction.tenant.name}" sera activée. Le propriétaire pourra se connecter.`
              : confirmAction.type === 'block'
              ? `La boutique "${confirmAction.tenant.name}" sera bloquée et son accès suspendu.`
              : confirmAction.type === 'reject'
              ? `La demande de "${confirmAction.tenant.name}" sera rejetée.`
              : `La boutique "${confirmAction.tenant.name}" sera définitivement supprimée (données conservées).`
          }
          confirmLabel={
            confirmAction.type === 'validate' ? 'Valider' :
            confirmAction.type === 'block' ? 'Bloquer' :
            confirmAction.type === 'reject' ? 'Rejeter' :
            'Supprimer'
          }
          danger={confirmAction.type === 'delete' || confirmAction.type === 'reject'}
          onConfirm={() => executeAction(confirmAction.type, confirmAction.tenant)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <style jsx>{`
        /* ─── Page ─── */
        .at-page { display: flex; flex-direction: column; gap: 1.5rem; }

        /* ─── Header ─── */
        .at-back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.78rem;
          color: var(--text-muted);
          text-decoration: none;
          margin-bottom: 0.5rem;
          transition: color 0.15s;
        }
        .at-back-link:hover { color: var(--color-brand-400); }
        .at-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .at-title { font-size: 1.75rem; margin-bottom: 0.375rem; }
        .at-subtitle { font-size: 0.9rem; color: var(--text-muted); }
        .btn-sm { padding: 0.45rem 0.875rem; font-size: 0.8rem; gap: 0.4rem; }

        /* ─── Filtres ─── */
        .at-filters {
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }
        .at-search-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        .at-search-wrap {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }
        .at-search-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--text-muted);
          pointer-events: none;
        }
        .at-search-input {
          width: 100%;
          background: var(--overlay-subtle);
          border: 1px solid var(--overlay-border);
          border-radius: 8px;
          padding: 0.5rem 0.75rem 0.5rem 2.25rem;
          font-size: 0.85rem;
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.2s;
        }
        .at-search-input:focus {
          border-color: var(--color-brand-500);
          background: var(--overlay-light);
        }
        .at-search-input::placeholder { color: var(--text-muted); }
        .at-filter-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .at-filter-icon { color: var(--text-muted); flex-shrink: 0; }
        .at-filter-group {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .at-filter-sep {
          width: 1px;
          height: 20px;
          background: var(--overlay-medium);
        }
        .at-filter-btn {
          padding: 0.3rem 0.7rem;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 6px;
          border: 1px solid var(--overlay-border);
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
        }
        .at-filter-btn:hover {
          background: var(--overlay-light);
          color: var(--text-primary);
        }
        .at-filter-btn--active {
          background: var(--brand-alpha-10);
          border-color: var(--color-brand-500);
          color: var(--color-brand-400);
        }

        /* ─── Table Card ─── */
        .at-table-card { overflow: hidden; }
        .at-loader, .at-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .at-table-wrap { overflow-x: auto; }
        .at-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .at-table thead th {
          text-align: left;
          padding: 0.875rem 1.25rem;
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-subtle);
          white-space: nowrap;
        }
        .at-table tbody tr {
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s;
        }
        .at-table tbody tr:last-child { border-bottom: none; }
        .at-table tbody tr:hover { background: var(--surface-hover); }
        .at-table tbody tr.at-row--loading { opacity: 0.5; pointer-events: none; }
        .at-table td {
          padding: 0.875rem 1.25rem;
          vertical-align: middle;
        }

        /* Boutique cell */
        .at-boutique-cell { display: flex; align-items: center; gap: 0.625rem; }
        .at-boutique-icon {
          width: 34px; height: 34px;
          border-radius: 8px;
          background: var(--brand-alpha-10);
          color: var(--color-brand-400);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.9rem;
          flex-shrink: 0;
        }
        .at-boutique-info { display: flex; flex-direction: column; gap: 0.1rem; }
        .at-boutique-name { font-weight: 600; color: var(--text-primary); }
        .at-boutique-slug { font-size: 0.72rem; color: var(--text-muted); }

        /* Owner cell */
        .at-owner-cell { display: flex; flex-direction: column; gap: 0.1rem; }
        .at-owner-email { color: var(--text-secondary); font-size: 0.82rem; }
        .at-owner-name { font-size: 0.72rem; color: var(--text-muted); }

        /* Date */
        .at-date { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }

        /* Status badges */
        .at-status-badge {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-size: 0.72rem; font-weight: 600;
          padding: 0.25rem 0.6rem;
          border-radius: 100px;
          white-space: nowrap;
        }
        .badge-status-pending  { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .badge-status-active   { background: rgba(16,185,129,0.15); color: #10b981; }
        .badge-status-blocked  { background: rgba(239,68,68,0.15);  color: #ef4444; }
        .badge-status-rejected { background: rgba(107,114,128,0.15); color: #9ca3af; }

        /* Plan badges */
        .at-plan-badge {
          display: inline-block;
          font-size: 0.7rem; font-weight: 600;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
        }
        .plan-freemium { background: var(--overlay-medium); color: var(--text-muted); }
        .plan-starter  { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .plan-pro      { background: rgba(168,85,247,0.15); color: #c084fc; }

        /* Actions */
        .at-actions { display: flex; gap: 0.35rem; align-items: center; }
        .at-action-btn {
          width: 30px; height: 30px;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
        }
        .at-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .at-action-btn--view {
          background: var(--overlay-subtle); border-color: var(--overlay-border);
          color: var(--text-muted); text-decoration: none;
        }
        .at-action-btn--view:hover { background: var(--overlay-light); color: var(--color-brand-400); }
        .at-action-btn--validate { background: rgba(16,185,129,0.1); color: #10b981; }
        .at-action-btn--validate:hover { background: rgba(16,185,129,0.2); }
        .at-action-btn--block { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .at-action-btn--block:hover { background: rgba(245,158,11,0.2); }
        .at-action-btn--reject { background: rgba(107,114,128,0.1); color: #9ca3af; }
        .at-action-btn--reject:hover { background: rgba(107,114,128,0.2); }
        .at-action-btn--delete { background: rgba(239,68,68,0.1); color: #f87171; }
        .at-action-btn--delete:hover { background: rgba(239,68,68,0.2); color: #ef4444; }

        /* Pagination */
        .at-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border-subtle);
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .at-pagination-info { font-size: 0.8rem; color: var(--text-muted); }
        .at-pagination-btns { display: flex; gap: 0.5rem; }

        /* Modal */
        .modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 200;
          padding: 1rem;
          animation: fadeIn 0.15s ease;
        }
        .modal-box {
          background: var(--surface-1);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          max-width: 420px;
          width: 100%;
          box-shadow: var(--shadow-lg);
          animation: slideUp 0.2s ease;
        }
        .modal-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
        }
        .modal-message {
          font-size: 0.875rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        .btn-danger {
          background: rgba(239,68,68,0.15);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.25);
        }
        .btn-danger:hover {
          background: rgba(239,68,68,0.25);
          color: #ef4444;
        }

        @keyframes slideUp {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
