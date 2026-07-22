'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  User, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Eye, 
  Activity,
  FileText,
  Database,
  Filter
} from 'lucide-react';
import { api } from '@/lib/api/client';
import type { AuditLog } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

const ACTION_CONFIG: Record<string, { label: string; badgeClass: string; color: string; bg: string }> = {
  login: { 
    label: 'Connexion', 
    badgeClass: 'badge-blue',
    color: '#3b82f6', 
    bg: 'rgba(59, 130, 246, 0.12)' 
  },
  create_sale: { 
    label: 'Vente créée', 
    badgeClass: 'badge-green',
    color: '#10b981', 
    bg: 'rgba(16, 185, 129, 0.12)' 
  },
  create_order: { 
    label: 'Commande créée', 
    badgeClass: 'badge-green',
    color: '#10b981', 
    bg: 'rgba(16, 185, 129, 0.12)' 
  },
  update_stock: { 
    label: 'Stock modifié', 
    badgeClass: 'badge-orange',
    color: '#f59e0b', 
    bg: 'rgba(245, 158, 11, 0.12)' 
  },
  return_order_items: { 
    label: 'Retour produit', 
    badgeClass: 'badge-red',
    color: '#ef4444', 
    bg: 'rgba(239, 68, 68, 0.12)' 
  },
  create_financial_transaction: { 
    label: 'Transaction finance', 
    badgeClass: 'badge-green',
    color: '#10b981', 
    bg: 'rgba(16, 185, 129, 0.12)' 
  },
  delete_product: { 
    label: 'Produit supprimé', 
    badgeClass: 'badge-red',
    color: '#ef4444', 
    bg: 'rgba(239, 68, 68, 0.12)' 
  },
  update_user: { 
    label: 'Utilisateur modifié', 
    badgeClass: 'badge-orange',
    color: '#f59e0b', 
    bg: 'rgba(245, 158, 11, 0.12)' 
  },
};

function getActionInfo(action: string) {
  if (ACTION_CONFIG[action]) {
    return ACTION_CONFIG[action];
  }
  // Dynamic fallback mapping
  if (action.startsWith('create_') || action.includes('add') || action.includes('create')) {
    return { label: formatActionLabel(action), badgeClass: 'badge-green', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
  }
  if (action.startsWith('update_') || action.includes('edit') || action.includes('update')) {
    return { label: formatActionLabel(action), badgeClass: 'badge-orange', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
  }
  if (action.startsWith('delete_') || action.startsWith('return_') || action.includes('remove') || action.includes('delete')) {
    return { label: formatActionLabel(action), badgeClass: 'badge-red', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' };
  }
  if (action.includes('login') || action.includes('auth')) {
    return { label: formatActionLabel(action), badgeClass: 'badge-blue', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' };
  }
  return { label: formatActionLabel(action), badgeClass: 'badge-neutral', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' };
}

function formatActionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(isoString: string) {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function AuditPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [userEmailSearch, setUserEmailSearch] = useState<string>('');
  
  // Pagination
  const [page, setPage] = useState<number>(1);
  const [perPage] = useState<number>(50);
  const [total, setTotal] = useState<number>(0);
  const [pages, setPages] = useState<number>(1);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getAuditLogs(
        page,
        perPage,
        selectedAction || undefined,
        userEmailSearch.trim() || undefined
      );
      setLogs(response.items || []);
      setTotal(response.total || 0);
      setPages(response.pages || (response.per_page > 0 ? Math.ceil((response.total || 0) / response.per_page) : 1));
    } catch (error: any) {
      console.error('Fetch audit logs error:', error);
      toast.error(error?.message || 'Erreur lors de la récupération du journal d\'audit');
      setLogs([]);
      setTotal(0);
      setPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, selectedAction, userEmailSearch]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAction(e.target.value);
    setPage(1);
  };

  const handleEmailSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserEmailSearch(e.target.value);
    setPage(1);
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="title-with-icon">
            <ShieldCheck className="header-icon" size={28} />
            <h1 className="page-title">Journal d'Audit</h1>
          </div>
          <p className="page-subtitle">
            Historique d'activité et traçabilité détaillée des actions effectuées sur votre boutique.
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-ghost btn-refresh"
            onClick={fetchAuditLogs}
            disabled={isLoading}
            title="Rafraîchir les données"
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="filters card">
        <div className="filter-grid">
          {/* Action Type Dropdown */}
          <div className="filter-item">
            <label className="filter-label">
              <Filter size={14} /> Type d'action
            </label>
            <select
              className="input select-input"
              value={selectedAction}
              onChange={handleActionChange}
            >
              <option value="">Toutes les actions</option>
              <option value="login">Connexion</option>
              <option value="create_sale">Vente créée</option>
              <option value="create_order">Commande créée</option>
              <option value="update_stock">Stock modifié</option>
              <option value="return_order_items">Retour produit</option>
              <option value="create_financial_transaction">Transaction finance</option>
              <option value="delete_product">Produit supprimé</option>
              <option value="update_user">Utilisateur modifié</option>
            </select>
          </div>

          {/* User Email Search Input */}
          <div className="filter-item search-filter">
            <label className="filter-label">
              <User size={14} /> Rechercher par email
            </label>
            <div className="search-box">
              <span className="search-icon"><Search size={16} /></span>
              <input
                type="text"
                className="input search-input"
                placeholder="Ex: admin@boutik.com..."
                value={userEmailSearch}
                onChange={handleEmailSearchChange}
              />
              {userEmailSearch && (
                <button 
                  className="clear-search" 
                  onClick={() => { setUserEmailSearch(''); setPage(1); }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table Card */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date / Heure</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Entité</th>
              <th>Détails</th>
              <th className="text-right">Aperçu</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const actionInfo = getActionInfo(log.action);
              const userInitial = log.user_email ? log.user_email.charAt(0).toUpperCase() : 'S';
              return (
                <tr key={log.id} onClick={() => setSelectedLog(log)} className="clickable-row">
                  <td>
                    <div className="date-cell">
                      <Clock size={14} className="text-muted" />
                      <span>{formatDate(log.created_at)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">{userInitial}</div>
                      <span className="user-email">{log.user_email || 'Système'}</span>
                    </div>
                  </td>
                  <td>
                    <span 
                      className="action-badge" 
                      style={{ 
                        color: actionInfo.color, 
                        backgroundColor: actionInfo.bg,
                        borderColor: `${actionInfo.color}33`
                      }}
                    >
                      {actionInfo.label}
                    </span>
                  </td>
                  <td>
                    {log.target_entity ? (
                      <div className="entity-cell">
                        <Database size={13} className="text-muted" />
                        <span className="entity-name">{log.target_entity}</span>
                        {log.target_id && (
                          <span className="entity-id" title={log.target_id}>
                            #{log.target_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="details-cell">
                    <span className="details-text" title={log.details || ''}>
                      {log.details || '—'}
                    </span>
                  </td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="btn btn-ghost btn-icon" 
                      title="Voir les détails complets"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="spinner-container">
                    <div className="spinner"></div>
                    <span className="text-muted mt-2">Chargement du journal d'audit...</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="empty-state">
                    <Activity size={40} className="empty-icon" />
                    <p className="empty-title">Aucune activité enregistrée</p>
                    <p className="empty-subtitle">
                      {selectedAction || userEmailSearch 
                        ? 'Aucun journal d\'audit ne correspond aux filtres appliqués.' 
                        : 'Le journal d\'audit est actuellement vide.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {!isLoading && total > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              Affichage de <span className="font-semibold">{logs.length}</span> sur <span className="font-semibold">{total}</span> entrée{total > 1 ? 's' : ''} (Page {page} sur {pages || 1})
            </div>
            <div className="pagination-controls">
              <button 
                className="btn btn-ghost btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              >
                <ChevronLeft size={16} /> Précédent
              </button>
              
              <div className="page-numbers">
                {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                  let pNum = i + 1;
                  if (pages > 5 && page > 3) {
                    pNum = page - 3 + i;
                    if (pNum > pages) pNum = pages - (4 - i);
                  }
                  return (
                    <button
                      key={pNum}
                      className={`page-num ${page === pNum ? 'active' : ''}`}
                      onClick={() => setPage(pNum)}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button 
                className="btn btn-ghost btn-sm"
                disabled={page >= pages}
                onClick={() => setPage(prev => Math.min(prev + 1, pages))}
              >
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      <Modal 
        isOpen={!!selectedLog} 
        onClose={() => setSelectedLog(null)} 
        title="Détails du journal d'audit"
      >
        {selectedLog && (
          <div className="modal-log-details">
            <div className="detail-header-card">
              <div className="detail-action-wrapper">
                <span 
                  className="action-badge large" 
                  style={{ 
                    color: getActionInfo(selectedLog.action).color, 
                    backgroundColor: getActionInfo(selectedLog.action).bg,
                    borderColor: `${getActionInfo(selectedLog.action).color}44`
                  }}
                >
                  {getActionInfo(selectedLog.action).label}
                </span>
                <span className="log-action-code">{selectedLog.action}</span>
              </div>
              <div className="log-timestamp">
                <Clock size={14} /> {formatDate(selectedLog.created_at)}
              </div>
            </div>

            <div className="detail-rows">
              <div className="detail-row">
                <span className="detail-label">ID Événement</span>
                <span className="detail-value mono">{selectedLog.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Utilisateur</span>
                <span className="detail-value">{selectedLog.user_email || 'Système'}</span>
              </div>
              {selectedLog.user_id && (
                <div className="detail-row">
                  <span className="detail-label">ID Utilisateur</span>
                  <span className="detail-value mono">{selectedLog.user_id}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Entité ciblée</span>
                <span className="detail-value">{selectedLog.target_entity || '—'}</span>
              </div>
              {selectedLog.target_id && (
                <div className="detail-row">
                  <span className="detail-label">ID Cible</span>
                  <span className="detail-value mono">{selectedLog.target_id}</span>
                </div>
              )}
              <div className="detail-row full-width-row">
                <span className="detail-label">Description / Détails</span>
                <div className="details-box">
                  {selectedLog.details || 'Aucun détail supplémentaire renseigné.'}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSelectedLog(null)}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      <style jsx>{`
        .page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .title-with-icon {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-icon {
          color: var(--color-brand-500, #10b981);
        }

        .page-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .page-subtitle {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-top: 0.25rem;
        }

        .btn-refresh {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: var(--surface-1);
          color: var(--text-primary);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        /* Filters Card */
        .filters {
          padding: 1.25rem;
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
        }

        .filter-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 1.25rem;
        }

        @media (max-width: 768px) {
          .filter-grid {
            grid-template-columns: 1fr;
          }
        }

        .filter-item {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .filter-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .search-box {
          position: relative;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .search-input {
          padding-left: 2.5rem;
          padding-right: 2.25rem;
          width: 100%;
        }

        .clear-search {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 1.2rem;
          cursor: pointer;
          line-height: 1;
        }

        .select-input {
          width: 100%;
          cursor: pointer;
        }

        /* Table Card */
        .table-container {
          padding: 0;
          overflow-x: auto;
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .data-table th, .data-table td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        .data-table th {
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: rgba(255, 255, 255, 0.02);
        }

        .clickable-row {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .clickable-row:hover td {
          background: var(--surface-hover, rgba(255, 255, 255, 0.04));
        }

        .data-table tr:last-child td {
          border-bottom: none;
        }

        /* Date cell */
        .date-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-primary);
          white-space: nowrap;
        }

        /* User cell */
        .user-cell {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .user-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.8rem;
          flex-shrink: 0;
        }

        .user-email {
          font-weight: 500;
          font-size: 0.875rem;
          color: var(--text-primary);
        }

        /* Action Badge */
        .action-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.625rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .action-badge.large {
          font-size: 0.85rem;
          padding: 0.375rem 0.875rem;
        }

        /* Entity cell */
        .entity-cell {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.85rem;
        }

        .entity-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .entity-id {
          font-family: monospace;
          font-size: 0.75rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
        }

        /* Details cell */
        .details-cell {
          max-width: 320px;
        }

        .details-text {
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        /* Utilities */
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); }
        .py-12 { padding: 3rem 0; }
        .mt-2 { margin-top: 0.5rem; }
        .font-semibold { font-weight: 600; }

        /* Spinner & Empty State */
        .spinner-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: var(--color-brand-500, #10b981);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-muted);
        }

        .empty-icon {
          opacity: 0.4;
          margin-bottom: 0.5rem;
        }

        .empty-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .empty-subtitle {
          font-size: 0.875rem;
          margin: 0;
        }

        /* Pagination Bar */
        .pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border-subtle);
          background: rgba(0, 0, 0, 0.1);
          flex-wrap: wrap;
          gap: 1rem;
        }

        .pagination-info {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .page-numbers {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .page-num {
          min-width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid var(--border-subtle);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .page-num:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
        }

        .page-num.active {
          background: var(--color-brand-500, #10b981);
          color: white;
          border-color: var(--color-brand-500, #10b981);
          font-weight: 700;
        }

        .btn-sm {
          padding: 0.35rem 0.75rem;
          font-size: 0.85rem;
        }

        /* Modal content */
        .modal-log-details {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .detail-header-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
        }

        .detail-action-wrapper {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .log-action-code {
          font-family: monospace;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .log-timestamp {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .detail-rows {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        .detail-row.full-width-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
          border-bottom: none;
          padding-bottom: 0;
        }

        .detail-label {
          font-size: 0.8rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .detail-value {
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .detail-value.mono {
          font-family: monospace;
          font-size: 0.825rem;
          color: var(--color-brand-400, #34d399);
        }

        .details-box {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 1rem;
          font-size: 0.875rem;
          color: var(--text-primary);
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          overflow-y: auto;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
}
