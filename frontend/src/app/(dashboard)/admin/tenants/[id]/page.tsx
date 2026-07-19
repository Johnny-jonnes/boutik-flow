'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store, Clock, CheckCircle, AlertCircle, XCircle, ChevronLeft,
  User, Mail, Phone, Calendar, Shield, Trash2, Edit3, Settings,
  AlertTriangle, CheckCheck, PauseCircle, Star, BadgeAlert
} from 'lucide-react';
import { api } from '@/lib/api/client';
import type { AdminTenantDetail, TenantStatus, TenantPlan } from '@/types';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<TenantStatus, { label: string; cls: string; icon: React.FC<{ size?: number }> }> = {
  pending:  { label: 'En attente de validation', cls: 'badge-status-pending',  icon: Clock },
  active:   { label: 'Boutique Active',     cls: 'badge-status-active',   icon: CheckCircle },
  blocked:  { label: 'Boutique Bloquée',    cls: 'badge-status-blocked',  icon: AlertCircle },
  rejected: { label: 'Inscription Rejetée', cls: 'badge-status-rejected', icon: XCircle },
};

const PLAN_CONFIG: Record<TenantPlan, { label: string; cls: string; price: string }> = {
  freemium: { label: 'Plan Freemium', cls: 'plan-freemium', price: '50 000 GNF/mois' },
  starter:  { label: 'Plan Starter',  cls: 'plan-starter', price: '800 000 GNF/mois' },
  pro:      { label: 'Plan Professionnel', cls: 'plan-pro', price: '1 500 000 GNF/mois' },
};

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [tenant, setTenant] = useState<AdminTenantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  
  // Modals status
  const [showStatusModal, setShowStatusModal] = useState<TenantStatus | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TenantPlan>('freemium');

  useEffect(() => {
    const loadTenant = async () => {
      try {
        const data = await api.getAdminTenant(id);
        setTenant(data);
        setSelectedPlan(data.plan);
      } catch {
        toast.error('Impossible de charger les informations de cette boutique');
        router.push('/admin/tenants');
      } finally {
        setIsLoading(false);
      }
    };
    loadTenant();
  }, [id, router]);

  const handleUpdateStatus = async (status: TenantStatus) => {
    setActionLoading(true);
    try {
      const updated = await api.updateTenantStatus(id, { status, note: statusNote || undefined });
      setTenant(updated);
      toast.success(`Le statut de la boutique a été mis à jour : ${STATUS_CONFIG[status].label}`);
      setShowStatusModal(null);
      setStatusNote('');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du changement de statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    setActionLoading(true);
    try {
      const updated = await api.updateTenantPlan(id, selectedPlan);
      setTenant(updated);
      toast.success(`Le plan d'abonnement a été mis à jour : ${PLAN_CONFIG[selectedPlan].label}`);
      setShowPlanModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour du plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTenant = async () => {
    setActionLoading(true);
    try {
      await api.deleteAdminTenant(id);
      toast.success('La boutique a été supprimée avec succès');
      router.push('/admin/tenants');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
      setShowDeleteModal(false);
      setActionLoading(false);
    }
  };

  if (isLoading || !tenant) {
    return (
      <div className="detail-loading">
        <div className="spinner" />
      </div>
    );
  }

  const sc = STATUS_CONFIG[tenant.status] || STATUS_CONFIG.pending;
  const pc = PLAN_CONFIG[tenant.plan] || PLAN_CONFIG.freemium;
  const StatusIcon = sc.icon;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="td-page">
      {/* Back navigation */}
      <Link href="/admin/tenants" className="td-back-link">
        <ChevronLeft size={16} /> Retour aux boutiques
      </Link>

      {/* Main header block */}
      <div className="td-header card">
        <div className="td-header-left">
          <div className="td-avatar">
            {tenant.name.charAt(0).toUpperCase()}
          </div>
          <div className="td-title-info">
            <div className="td-title-row">
              <h1 className="td-title">{tenant.name}</h1>
              <span className={`td-status-badge ${sc.cls}`}>
                <StatusIcon size={13} />
                {sc.label}
              </span>
            </div>
            <p className="td-slug">Identifiant : <strong>@{tenant.slug}</strong></p>
          </div>
        </div>

        <div className="td-header-actions">
          {tenant.status !== 'active' && (
            <button
              id="btn-detail-validate"
              className="btn btn-primary btn-sm"
              onClick={() => setShowStatusModal('active')}
              disabled={actionLoading}
            >
              <CheckCheck size={14} /> Valider la boutique
            </button>
          )}
          {tenant.status === 'active' && (
            <button
              id="btn-detail-block"
              className="btn btn-warning btn-sm"
              onClick={() => setShowStatusModal('blocked')}
              disabled={actionLoading}
            >
              <PauseCircle size={14} /> Bloquer
            </button>
          )}
          {tenant.status === 'pending' && (
            <button
              id="btn-detail-reject"
              className="btn btn-ghost btn-sm btn-reject-style"
              onClick={() => setShowStatusModal('rejected')}
              disabled={actionLoading}
            >
              <XCircle size={14} /> Rejeter
            </button>
          )}
        </div>
      </div>

      {/* Two columns content */}
      <div className="td-content-grid">
        {/* Left Column: Infos */}
        <div className="td-details-col">
          {/* Fiche Boutique */}
          <div className="card td-card">
            <div className="td-card-header">
              <Store size={16} />
              <h2>Informations sur la Boutique</h2>
            </div>
            <div className="td-info-list">
              <div className="td-info-item">
                <span className="td-info-label">Nom commercial</span>
                <span className="td-info-value">{tenant.name}</span>
              </div>
              <div className="td-info-item">
                <span className="td-info-label">Lien / Slug de connexion</span>
                <span className="td-info-value text-brand">@{tenant.slug}</span>
              </div>
              <div className="td-info-item">
                <span className="td-info-label">Identifiant unique (ID)</span>
                <span className="td-info-value code-font">{tenant.id}</span>
              </div>
              <div className="td-info-item">
                <span className="td-info-label">ID Téléphone WhatsApp</span>
                <span className="td-info-value">{tenant.whatsapp_phone_id || 'Non connecté'}</span>
              </div>
              <div className="td-info-item">
                <span className="td-info-label">Date de création</span>
                <span className="td-info-value">{formatDate(tenant.created_at)}</span>
              </div>
              <div className="td-info-item">
                <span className="td-info-label">Dernière mise à jour</span>
                <span className="td-info-value">{formatDate(tenant.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Fiche Propriétaire */}
          {tenant.owner ? (
            <div className="card td-card">
              <div className="td-card-header">
                <User size={16} />
                <h2>Propriétaire de la Boutique</h2>
              </div>
              <div className="td-info-list">
                <div className="td-info-item">
                  <span className="td-info-label"><User size={12} className="inline-icon" /> Nom complet</span>
                  <span className="td-info-value">{tenant.owner.full_name || 'Non spécifié'}</span>
                </div>
                <div className="td-info-item">
                  <span className="td-info-label"><Mail size={12} className="inline-icon" /> Adresse email</span>
                  <span className="td-info-value">{tenant.owner.email}</span>
                </div>
                <div className="td-info-item">
                  <span className="td-info-label"><Phone size={12} className="inline-icon" /> Téléphone</span>
                  <span className="td-info-value">{tenant.owner.phone || 'Non renseigné'}</span>
                </div>
                <div className="td-info-item">
                  <span className="td-info-label"><Calendar size={12} className="inline-icon" /> Date d&apos;inscription</span>
                  <span className="td-info-value">{formatDate(tenant.owner.created_at)}</span>
                </div>
                <div className="td-info-item">
                  <span className="td-info-label"><Shield size={12} className="inline-icon" /> Rôle</span>
                  <span className="td-info-value text-capitalize">Propriétaire (Owner)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card td-card text-center py-6 text-muted">
              <AlertTriangle size={24} className="mx-auto mb-2 text-warning" />
              <p>Aucun utilisateur associé à cette boutique.</p>
            </div>
          )}
        </div>

        {/* Right Column: Abonnement & Actions de Contrôle */}
        <div className="td-actions-col">
          {/* Bloc d'abonnement */}
          <div className="card td-card subscription-card">
            <div className="td-card-header">
              <Star size={16} />
              <h2>Forfait et Facturation</h2>
            </div>
            <div className="subscription-body">
              <div className={`td-plan-banner ${pc.cls}`}>
                <h3>{pc.label}</h3>
                <p className="plan-price">{pc.price}</p>
              </div>
              
              <button
                id="btn-change-plan"
                className="btn btn-ghost w-full mt-4 justify-center"
                onClick={() => setShowPlanModal(true)}
                disabled={actionLoading}
              >
                <Edit3 size={14} className="mr-2" /> Modifier le plan d&apos;abonnement
              </button>
            </div>
          </div>

          {/* Zone de danger / Actions Administrateur */}
          <div className="card td-card danger-zone-card">
            <div className="td-card-header text-error">
              <AlertTriangle size={16} />
              <h2>Zone de Danger</h2>
            </div>
            <div className="danger-zone-body">
              <p className="danger-desc">
                Ces actions affectent immédiatement l&apos;accès de la boutique et de ses employés à la plateforme.
              </p>
              
              <div className="danger-actions-list">
                {tenant.status !== 'blocked' && (
                  <button
                    id="btn-danger-block"
                    className="danger-action-btn"
                    onClick={() => setShowStatusModal('blocked')}
                    disabled={actionLoading}
                  >
                    <div className="danger-action-info">
                      <span className="danger-action-title">Bloquer la boutique</span>
                      <span className="danger-action-sub">Suspend l&apos;accès de tous les utilisateurs</span>
                    </div>
                    <PauseCircle size={18} />
                  </button>
                )}

                {tenant.status === 'blocked' && (
                  <button
                    id="btn-danger-unblock"
                    className="danger-action-btn success-variant"
                    onClick={() => setShowStatusModal('active')}
                    disabled={actionLoading}
                  >
                    <div className="danger-action-info">
                      <span className="danger-action-title text-success">Débloquer la boutique</span>
                      <span className="danger-action-sub">Restaurer l&apos;accès des utilisateurs</span>
                    </div>
                    <CheckCheck size={18} />
                  </button>
                )}

                <button
                  id="btn-danger-delete"
                  className="danger-action-btn delete-variant"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={actionLoading}
                >
                  <div className="danger-action-info">
                    <span className="danger-action-title text-error">Supprimer la boutique</span>
                    <span className="danger-action-sub">Soft delete de la boutique (données gardées en archive)</span>
                  </div>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Modal Changement Statut */}
      {showStatusModal && (
        <div className="modal-backdrop" onClick={() => setShowStatusModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">
              {showStatusModal === 'active' ? 'Valider et activer la boutique' :
               showStatusModal === 'blocked' ? 'Bloquer la boutique' :
               'Rejeter l\'inscription'}
            </h3>
            <p className="modal-message">
              {showStatusModal === 'active'
                ? 'Cette action permet au propriétaire et à son équipe de se connecter et d\'utiliser leur espace de vente.'
                : showStatusModal === 'blocked'
                ? 'Tous les utilisateurs de cette boutique seront immédiatement déconnectés et ne pourront plus accéder à leurs données.'
                : 'La demande d\'inscription sera rejetée. L\'utilisateur ne pourra pas accéder au service.'}
            </p>

            <div className="modal-form-group">
              <label className="modal-label">Note interne (optionnel)</label>
              <textarea
                className="modal-textarea"
                placeholder="Raison du changement, détails sur le paiement, etc..."
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowStatusModal(null)} disabled={actionLoading}>
                Annuler
              </button>
              <button
                className={`btn ${showStatusModal === 'active' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => handleUpdateStatus(showStatusModal)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Mise à jour...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Changement Plan */}
      {showPlanModal && (
        <div className="modal-backdrop" onClick={() => setShowPlanModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Modifier le plan d&apos;abonnement</h3>
            <p className="modal-message">
              Sélectionnez le nouveau plan d&apos;abonnement de la boutique. Les limites de clients et de fonctionnalités seront modifiées en conséquence.
            </p>

            <div className="plan-selection-list">
              {(['freemium', 'starter', 'pro'] as TenantPlan[]).map(planKey => {
                const p = PLAN_CONFIG[planKey];
                return (
                  <label
                    key={planKey}
                    className={`plan-select-item ${selectedPlan === planKey ? 'selected' : ''}`}
                    onClick={() => setSelectedPlan(planKey)}
                  >
                    <input
                      type="radio"
                      name="selected_plan"
                      checked={selectedPlan === planKey}
                      onChange={() => setSelectedPlan(planKey)}
                      className="hidden-radio"
                    />
                    <div className="plan-select-info">
                      <span className="plan-select-name">{p.label}</span>
                      <span className="plan-select-price">{p.price}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="modal-actions mt-6">
              <button className="btn btn-ghost" onClick={() => setShowPlanModal(false)} disabled={actionLoading}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleUpdatePlan} disabled={actionLoading}>
                {actionLoading ? 'Modification...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Suppression */}
      {showDeleteModal && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title text-error">Supprimer la boutique ?</h3>
            <p className="modal-message">
              Êtes-vous sûr de vouloir supprimer la boutique <strong>{tenant.name}</strong> ? Cette action effectuera un soft delete : l&apos;accès sera désactivé mais les données resteront stockées en base de données pour archivage.
            </p>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)} disabled={actionLoading}>
                Annuler
              </button>
              <button className="btn btn-danger" onClick={handleDeleteTenant} disabled={actionLoading}>
                {actionLoading ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .detail-loading {
          display: flex; align-items: center; justify-content: center;
          min-height: 400px;
        }

        /* Back Link */
        .td-back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          text-decoration: none;
          margin-bottom: 1.25rem;
          transition: color 0.15s;
        }
        .td-back-link:hover { color: var(--color-brand-400); }

        /* Page Layout */
        .td-page { display: flex; flex-direction: column; gap: 1.5rem; }

        /* Header Block */
        .td-header {
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.25rem;
        }
        .td-header-left { display: flex; align-items: center; gap: 1rem; }
        .td-avatar {
          width: 52px; height: 52px;
          border-radius: var(--radius-md);
          background: var(--brand-alpha-10);
          color: var(--color-brand-400);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display);
          font-size: 1.5rem; font-weight: 800;
          border: 1px solid var(--brand-alpha-20);
        }
        .td-title-info { display: flex; flex-direction: column; gap: 0.25rem; }
        .td-title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .td-title { font-size: 1.5rem; font-weight: 700; line-height: 1.2; }
        .td-slug { font-size: 0.82rem; color: var(--text-muted); }
        .text-brand { color: var(--color-brand-400); }
        .td-header-actions { display: flex; gap: 0.75rem; }
        .btn-reject-style {
          background: rgba(239, 68, 68, 0.08);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
        .btn-reject-style:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        /* Status badges */
        .td-status-badge {
          display: inline-flex; align-items: center; gap: 0.35rem;
          font-size: 0.75rem; font-weight: 600;
          padding: 0.25rem 0.75rem;
          border-radius: 100px;
        }
        .badge-status-pending  { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .badge-status-active   { background: rgba(16,185,129,0.15); color: #10b981; }
        .badge-status-blocked  { background: rgba(239,68,68,0.15);  color: #ef4444; }
        .badge-status-rejected { background: rgba(107,114,128,0.15); color: #9ca3af; }

        /* Two columns content layout */
        .td-content-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 1.25rem;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .td-content-grid { grid-template-columns: 1fr; }
        }

        .td-details-col { display: flex; flex-direction: column; gap: 1.25rem; }
        .td-actions-col { display: flex; flex-direction: column; gap: 1.25rem; }

        .td-card { padding: 1.5rem; }
        .td-card-header {
          display: flex; align-items: center; gap: 0.5rem;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 0.75rem;
          margin-bottom: 1rem;
        }
        .td-card-header h2 {
          font-size: 0.9rem; font-weight: 700;
          color: var(--text-primary);
        }
        .text-error { color: #f87171 !important; }
        .text-error h2 { color: #f87171 !important; }

        /* Info List */
        .td-info-list { display: flex; flex-direction: column; gap: 0.875rem; }
        .td-info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          font-size: 0.85rem;
        }
        .td-info-label { color: var(--text-muted); display: inline-flex; align-items: center; }
        .inline-icon { margin-right: 0.35rem; color: var(--text-disabled); }
        .td-info-value { color: var(--text-primary); font-weight: 500; text-align: right; }
        .code-font { font-family: monospace; font-size: 0.78rem; color: var(--text-secondary); }
        .text-capitalize { text-transform: capitalize; }

        /* Subscription card banner */
        .subscription-body { display: flex; flex-direction: column; }
        .td-plan-banner {
          border-radius: var(--radius-md);
          padding: 1.25rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .td-plan-banner h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; }
        .plan-price { font-size: 0.8rem; opacity: 0.8; font-weight: 500; }
        .plan-freemium { background: var(--overlay-medium); color: var(--text-primary); }
        .plan-starter  { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
        .plan-pro      { background: rgba(168,85,247,0.15); color: #c084fc; border: 1px solid rgba(168,85,247,0.25); }

        /* Danger zone card */
        .danger-zone-body { display: flex; flex-direction: column; gap: 0.875rem; }
        .danger-desc { font-size: 0.78rem; color: var(--text-muted); line-height: 1.5; }
        .danger-actions-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .danger-action-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.15);
          background: rgba(239, 68, 68, 0.05);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
        }
        .danger-action-btn:hover {
          border-color: rgba(239, 68, 68, 0.3);
          background: rgba(239, 68, 68, 0.08);
          color: var(--text-primary);
        }
        .danger-action-info { display: flex; flex-direction: column; gap: 0.15rem; }
        .danger-action-title { font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); }
        .danger-action-sub { font-size: 0.7rem; color: var(--text-muted); }
        
        .success-variant {
          border-color: rgba(16, 185, 129, 0.15) !important;
          background: rgba(16, 185, 129, 0.05) !important;
        }
        .success-variant:hover {
          border-color: rgba(16, 185, 129, 0.3) !important;
          background: rgba(16, 185, 129, 0.08) !important;
        }
        .text-success { color: var(--color-success) !important; }
        
        .delete-variant:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
        }

        /* Modal backdrop and layouts */
        .modal-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          z-index: 200;
          padding: 1rem;
        }
        .modal-box {
          background: var(--surface-1);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          max-width: 440px;
          width: 100%;
          box-shadow: var(--shadow-lg);
        }
        .modal-title { font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.75rem; }
        .modal-message { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.25rem; }
        
        .modal-form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.25rem; }
        .modal-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
        .modal-textarea {
          width: 100%;
          min-height: 80px;
          background: var(--overlay-subtle);
          border: 1px solid var(--overlay-border);
          border-radius: 8px;
          padding: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-primary);
          outline: none;
          resize: vertical;
        }
        .modal-textarea:focus { border-color: var(--color-brand-500); }
        
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

        /* Plan Selection */
        .plan-selection-list { display: flex; flex-direction: column; gap: 0.625rem; }
        .plan-select-item {
          display: flex; align-items: center;
          padding: 0.875rem 1rem;
          border-radius: 10px;
          border: 1px solid var(--overlay-border);
          background: var(--overlay-subtle);
          cursor: pointer;
          transition: all 0.15s;
        }
        .plan-select-item:hover { background: var(--overlay-light); }
        .plan-select-item.selected {
          border-color: var(--color-brand-500);
          background: var(--brand-alpha-08);
        }
        .hidden-radio { margin-right: 0.75rem; accent-color: var(--color-brand-500); }
        .plan-select-info { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .plan-select-name { font-size: 0.875rem; font-weight: 700; color: var(--text-primary); }
        .plan-select-price { font-size: 0.75rem; color: var(--text-muted); font-weight: 500; }
      `}</style>
    </div>
  );
}
