'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Pencil, Trash2, Shield, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';

interface TeamMember {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: 'owner' | 'manager' | 'cashier' | 'stock_manager' | 'staff';
  is_active: boolean;
  created_at: string;
}

export default function TeamPage() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
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

  const fetchMembers = async () => {
    try {
      const response = await api.getTeamMembers();
      setMembers(Array.isArray(response) ? response : []);
    } catch (error) {
      toast.error('Erreur lors de la récupération de l\'équipe');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

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
      toast.success('Membre invité avec succès');
      setIsInviteOpen(false);
      setInviteForm({ full_name: '', email: '', password: '', phone: '', role: 'staff' });
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'invitation');
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
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setIsEditing(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    try {
      await api.updateTeamMemberStatus(member.id, !member.is_active);
      toast.success('Statut mis à jour');
      fetchMembers();
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
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner': return <span className="badge role-owner">{t('team.role_owner')}</span>;
      case 'manager': return <span className="badge role-manager">{t('team.role_manager')}</span>;
      case 'cashier': return <span className="badge role-cashier">{t('team.role_cashier')}</span>;
      case 'stock_manager': return <span className="badge role-stock">{t('team.role_stock')}</span>;
      default: return <span className="badge role-staff">{t('team.role_staff')}</span>;
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('team.title')}</h1>
          <p className="page-subtitle">{t('team.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setIsInviteOpen(true)}>
            <UserPlus size={16} /> {t('team.invite')}
          </button>
        </div>
      </div>

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('team.name')}</th>
              <th>{t('team.email')} / {t('team.phone')}</th>
              <th>{t('team.role')}</th>
              <th>{t('team.status')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className={!member.is_active ? 'row-inactive' : ''}>
                <td>
                  <div className="member-cell">
                    <div className="member-avatar">
                      {(member.full_name || member.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="member-info">
                      <span className="member-name">{member.full_name || '—'}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    <span>{member.email}</span>
                    {member.phone && <span className="text-muted">{member.phone}</span>}
                  </div>
                </td>
                <td>{getRoleBadge(member.role)}</td>
                <td>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={member.is_active} 
                      onChange={() => handleToggleStatus(member)} 
                      disabled={member.role === 'owner'}
                    />
                    <span className="slider"></span>
                  </label>
                  <span className="status-text text-muted">
                    {member.is_active ? t('team.active') : t('team.inactive')}
                  </span>
                </td>
                <td className="text-right">
                  <div className="actions-flex">
                    <button 
                      className="btn btn-ghost btn-icon" 
                      title={t('team.edit_role')} 
                      onClick={() => { setEditMember(member); setEditRole(member.role); }}
                      disabled={member.role === 'owner'}
                    >
                      <Pencil size={16} />
                    </button>
                    {member.role !== 'owner' && (
                      <button 
                        className="btn btn-ghost btn-icon btn-danger-icon" 
                        title={t('common.delete')} 
                        onClick={() => setDeleteTarget(member)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-8"><div className="spinner"></div></td></tr>
            )}
            {!isLoading && members.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-muted">Aucun membre trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
            <input type="password" className="input" required minLength={6} value={inviteForm.password}
              onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })} />
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

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.75rem; margin-bottom: 0.25rem; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; }

        .table-container { padding: 0; overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th, .data-table td { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }
        .data-table th { font-weight: 600; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table tr:hover td { background: var(--surface-hover); }
        .data-table tr:last-child td { border-bottom: none; }
        
        .row-inactive td { opacity: 0.7; }

        .member-cell { display: flex; align-items: center; gap: 0.75rem; }
        .member-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--surface-3); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.9rem; flex-shrink: 0; border: 1px solid var(--border-default); }
        .member-info { display: flex; flex-direction: column; }
        .member-name { font-weight: 600; }
        
        .contact-info { display: flex; flex-direction: column; gap: 0.125rem; font-size: 0.85rem; }

        .actions-flex { display: flex; gap: 0.25rem; justify-content: flex-end; }
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
        .btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); font-size: 0.85rem; }
        .py-8 { padding: 2rem 0; }

        /* Badges */
        .badge { font-size: 0.7rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 12px; display: inline-block; }
        .role-owner { background: rgba(16, 185, 129, 0.15); color: #34d399; }
        .role-manager { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .role-cashier { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .role-stock { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
        .role-staff { background: var(--surface-3); color: var(--text-secondary); }

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
