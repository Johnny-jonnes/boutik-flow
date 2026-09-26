'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus, Pencil, Trash2, Shield, AlertTriangle, Eye, EyeOff, KeyRound, UsersRound, UserCheck, UserX, Crown, Mail, Phone } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { useTeamQuery } from '@/lib/queries';
import type { TeamMember } from '@/types';
import { PageHeader, StatTile, type StatTone } from '@/components/ui/PageHeader';
import { hueFromString, initials } from '@/lib/format';

export default function TeamPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  // Couche mémoire partagée, comme Produits/Vendre/Clients : revalidée
  // silencieusement en arrière-plan après chaque action (invitation,
  // changement de rôle, activation/désactivation, suppression), jamais un
  // rechargement complet de la page.
  const { data: members = [], isLoading, error } = useTeamQuery();
  const fetchError = error ? (error as any)?.message || 'Erreur de connexion au serveur' : null;

  // Invite modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    full_name: '', email: '', password: '', phone: '', role: 'staff' as TeamMember['role']
  });

  // Edit role modal
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<TeamMember['role']>('staff');
  const [isEditing, setIsEditing] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      await api.inviteTeamMember({
        full_name: inviteForm.full_name,
        email: inviteForm.email,
        password: inviteForm.password,
        phone: inviteForm.phone || undefined,
        role: inviteForm.role
      });
      toast.success(t('team.invite_success'));
      setIsInviteOpen(false);
      setInviteForm({ full_name: '', email: '', password: '', phone: '', role: 'staff' });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch (err: any) {
      toast.error(err.message || t('team.error_invite'));
    } finally {
      setIsInviting(false);
    }
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    setIsEditing(true);
    try {
      await api.updateTeamMemberRole(editMember.id, editRole);
      toast.success(t('common.saving'));
      setEditMember(null);
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setIsEditing(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    try {
      await api.updateTeamMemberStatus(member.id, !member.is_active);
      toast.success(t('team.status_updated'));
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteTeamMember(deleteTarget.id);
      toast.success(t('common.deleting'));
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['team'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordTarget) return;
    // Client-side validation
    if (newPassword.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      toast.error('Le mot de passe doit contenir au moins une majuscule.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('Le mot de passe doit contenir au moins un chiffre.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await api.changeTeamMemberPassword(passwordTarget.id, newPassword);
      toast.success(`Mot de passe de ${passwordTarget.full_name || passwordTarget.email} mis à jour.`);
      setShowPasswordModal(false);
      setNewPassword('');
      setPasswordTarget(null);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe';
      toast.error(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return t('team.role_owner');
      case 'manager': return t('team.role_manager');
      case 'cashier': return t('team.role_cashier');
      case 'stock_manager': return t('team.role_stock');
      case 'seller_stock_manager': return t('team.role_seller_stock');
      default: return t('team.role_staff');
    }
  };

  const ROLE_TONES: Record<string, StatTone> = {
    owner: 'emerald', manager: 'sky', cashier: 'amber', stock_manager: 'violet', seller_stock_manager: 'teal', staff: 'slate',
  };
  const activeCount = members.filter(m => m.is_active).length;
  const managerCount = members.filter(m => m.role === 'owner' || m.role === 'manager').length;

  return (
    <div className="bf-page">
      <PageHeader
        icon={UsersRound}
        title={t('team.title')}
        subtitle={t('team.subtitle')}
        actions={
          <button className="btn btn-primary" onClick={() => setIsInviteOpen(true)}>
            <UserPlus size={16} /> {t('team.invite')}
          </button>
        }
      />

      <section className="bf-stats">
        <StatTile tone="teal" icon={UsersRound} label="Membres" value={members.length} hint="Comptes de la boutique" />
        <StatTile tone="emerald" icon={UserCheck} label={t('team.active')} value={activeCount}
          hint={<><strong>{members.length ? Math.round((activeCount / members.length) * 100) : 0} %</strong> de l&apos;équipe</>} />
        <StatTile tone="slate" icon={UserX} label={t('team.inactive')} value={members.length - activeCount} hint="Accès suspendu" />
        <StatTile tone="sky" icon={Shield} label="Encadrement" value={managerCount} hint="Propriétaire et gérants" />
      </section>

      {isLoading && members.length === 0 ? (
        <div className="bf-grid">
          {[1, 2, 3].map(i => <div key={i} className="bf-skeleton" style={{ height: 200, borderRadius: 20 }} />)}
        </div>
      ) : members.length === 0 ? (
        <div className="bf-panel">
          <div className="bf-empty">
            <span className="bf-empty__icon"><UsersRound size={24} /></span>
            <strong>{fetchError ? `⚠️ ${fetchError}` : (t('team.no_members') || 'Aucun membre trouvé.')}</strong>
          </div>
        </div>
      ) : (
        <div className="bf-grid">
          {members.map(member => {
            const name = member.full_name || member.email;
            const isOwner = member.role === 'owner';
            return (
              <article key={member.id} className={`bf-tile team-tile ${!member.is_active ? 'team-tile--off' : ''}`}>
                <div className="team-top">
                  <span className="bf-avatar team-avatar" style={{ '--hue': hueFromString(name) } as React.CSSProperties}>
                    {initials(name)}
                  </span>
                  <div className="team-id">
                    <span className="team-name">{member.full_name || '—'}</span>
                    <span className="bf-badge" data-tone={ROLE_TONES[member.role] ?? 'slate'}>
                      {isOwner ? <Crown size={12} /> : <span className="bf-badge__dot" />}
                      {getRoleLabel(member.role)}
                    </span>
                  </div>
                </div>

                <div className="team-contact">
                  <span><Mail size={14} /> {member.email}</span>
                  <span><Phone size={14} /> {member.phone || '—'}</span>
                </div>

                <div className="team-foot">
                  <label className="team-status">
                    <span className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={member.is_active}
                        onChange={() => handleToggleStatus(member)}
                        disabled={isOwner}
                      />
                      <span className="slider"></span>
                    </span>
                    <span className={member.is_active ? 'status-on' : 'status-off'}>
                      {member.is_active ? t('team.active') : t('team.inactive')}
                    </span>
                  </label>
                  <div className="bf-row-actions">
                    <button type="button" className="bf-icon-btn" title={t('team.edit_role')} aria-label={t('team.edit_role')}
                      onClick={() => { setEditMember(member); setEditRole(member.role); }} disabled={isOwner}>
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="bf-icon-btn" title="Changer le MDP" aria-label="Changer le mot de passe"
                      onClick={() => { setPasswordTarget(member); setShowPasswordModal(true); }} disabled={isOwner}>
                      <KeyRound size={15} />
                    </button>
                    {!isOwner && (
                      <button type="button" className="bf-icon-btn bf-icon-btn--danger" title={t('common.delete')} aria-label={t('common.delete')}
                        onClick={() => setDeleteTarget(member)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Invite Modal */}
      <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title={t('team.invite')}>
        <form onSubmit={handleInvite} className="modal-form">
          <div className="form-group">
            <label className="form-label">{t('team.name')} *</label>
            <input type="text" className="input" required value={inviteForm.full_name}
              onChange={e => setInviteForm({ ...inviteForm, full_name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('team.email')} *</label>
            <input type="email" className="input" required value={inviteForm.email}
              onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('team.password')} *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showInvitePassword ? 'text' : 'password'} 
                className="input" 
                required 
                minLength={6} 
                value={inviteForm.password}
                onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })} 
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowInvitePassword(!showInvitePassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.25rem'
                }}
                title={showInvitePassword ? 'Masquer' : 'Afficher'}
              >
                {showInvitePassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('team.phone')}</label>
            <input type="tel" className="input" value={inviteForm.phone}
              onChange={e => setInviteForm({ ...inviteForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('team.role')}</label>
            <select className="input" value={inviteForm.role}
              onChange={e => setInviteForm({ ...inviteForm, role: e.target.value as TeamMember['role'] })}>
              <option value="staff">{t('team.role_staff')}</option>
              <option value="manager">{t('team.role_manager')}</option>
              <option value="cashier">{t('team.role_cashier')}</option>
              <option value="stock_manager">{t('team.role_stock')}</option>
              <option value="seller_stock_manager">{t('team.role_seller_stock')}</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsInviteOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={isInviting}>
              {isInviting ? t('common.saving') : t('common.add')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      <Modal isOpen={!!editMember} onClose={() => setEditMember(null)} title={t('team.edit_role')}>
        <form onSubmit={handleEditRole} className="modal-form">
          <div className="form-group">
            <label className="form-label">{t('team.role')}</label>
            <select className="input" value={editRole}
              onChange={e => setEditRole(e.target.value as TeamMember['role'])}>
              <option value="staff">{t('team.role_staff')}</option>
              <option value="manager">{t('team.role_manager')}</option>
              <option value="cashier">{t('team.role_cashier')}</option>
              <option value="stock_manager">{t('team.role_stock')}</option>
              <option value="seller_stock_manager">{t('team.role_seller_stock')}</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditMember(null)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={isEditing}>
              {isEditing ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('team.confirm_delete')}>
        <div className="warning-box">
          <AlertTriangle size={24} className="warning-icon" />
          <p>{t('team.delete_msg')}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? t('common.deleting') : t('common.delete')}
          </button>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal 
        isOpen={showPasswordModal} 
        onClose={() => { setShowPasswordModal(false); setNewPassword(''); setPasswordTarget(null); }} 
        title={`Changer le mot de passe — ${passwordTarget?.full_name || passwordTarget?.email || ''}`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Définissez un nouveau mot de passe pour ce membre. Il devra le changer lors de sa prochaine connexion.
          </p>
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                className="input"
                placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{ position: 'absolute', right: '0.75rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Min. 8 caractères, 1 majuscule, 1 chiffre</span>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setShowPasswordModal(false); setNewPassword(''); setPasswordTarget(null); }}>Annuler</button>
            <button type="button" className="btn btn-primary" onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>

      <style jsx>{`
        .team-tile--off { opacity: 0.62; }
        .team-top { display: flex; align-items: center; gap: 0.85rem; min-width: 0; }
        .team-avatar { width: 54px; height: 54px; border-radius: 17px; font-size: 1rem; }
        .team-id { display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; min-width: 0; }
        .team-name {
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .team-contact {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding: 0.7rem 0.85rem;
          border-radius: 13px;
          background: var(--surface-2);
          border: 1px solid var(--border-subtle);
          font-size: 0.82rem;
          color: var(--text-secondary);
          min-width: 0;
        }
        .team-contact span { display: flex; align-items: center; gap: 0.5rem; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .team-contact :global(svg) { flex-shrink: 0; color: var(--text-muted); }
        .team-foot { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: auto; }
        .team-status { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .status-on { color: var(--color-success); }
        .status-off { color: var(--text-muted); }

        /* Toggle Switch */
        .toggle-switch { position: relative; display: inline-block; width: 36px; height: 20px; margin-right: 8px; vertical-align: middle; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--surface-3); transition: .4s; border-radius: 20px; border: 1px solid var(--border-default); }
        .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #10b981; border-color: #10b981; }
        input:checked + .slider:before { transform: translateX(16px); }
        input:disabled + .slider { opacity: 0.5; cursor: not-allowed; }
        
        .status-text { vertical-align: middle; font-size: 0.8rem; }

        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
        
        .warning-box { display: flex; gap: 1rem; align-items: flex-start; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); color: var(--text-primary); margin-bottom: 1.5rem; }
        .warning-icon { color: var(--color-error); flex-shrink: 0; }

      `}</style>
    </div>
  );
}
