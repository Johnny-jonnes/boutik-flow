'use client';

import { useEffect, useState } from 'react';
import { Plus, Tags, Search, Edit2, Trash2, Users, Check } from 'lucide-react';
import type { Segment } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';

export default function SegmentsPage() {
  const { t } = useLanguage();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({ 
    name: '', 
    description: '', 
    status: '', 
    tagsStr: '' 
  });

  // Edit modal
  const [editSegment, setEditSegment] = useState<Segment | null>(null);
  const [editForm, setEditForm] = useState({ 
    name: '', 
    description: '', 
    status: '', 
    tagsStr: '' 
  });
  const [isEditing, setIsEditing] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSegments = async () => {
    try {
      const response = await api.getSegments(1, 100);
      setSegments(response.items);
    } catch (error) {
      toast.error('Erreur lors de la récupération des segments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const filters: Record<string, any> = {};
      if (addForm.status) {
        filters.status = addForm.status;
      }
      if (addForm.tagsStr) {
        filters.tags = addForm.tagsStr
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0);
      }

      await api.createSegment({
        name: addForm.name,
        description: addForm.description || undefined,
        filters,
      });
      toast.success('Segment créé avec succès');
      setIsAddOpen(false);
      setAddForm({ name: '', description: '', status: '', tagsStr: '' });
      fetchSegments();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (segment: Segment) => {
    const filters = segment.filters || {};
    setEditSegment(segment);
    setEditForm({
      name: segment.name,
      description: segment.description || '',
      status: (filters.status as string) || '',
      tagsStr: Array.isArray(filters.tags) ? filters.tags.join(', ') : '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSegment) return;
    setIsEditing(true);
    try {
      const filters: Record<string, any> = {};
      if (editForm.status) {
        filters.status = editForm.status;
      }
      if (editForm.tagsStr) {
        filters.tags = editForm.tagsStr
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0);
      }

      await api.updateSegment(editSegment.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        filters,
      });
      toast.success('Segment modifié avec succès');
      setEditSegment(null);
      fetchSegments();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la modification');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteSegment(deleteTarget.id);
      toast.success('Segment supprimé');
      setDeleteTarget(null);
      fetchSegments();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFilters = (filters: Record<string, any>) => {
    const parts: string[] = [];
    if (filters.status) {
      parts.push(`Statut: ${filters.status.toUpperCase()}`);
    }
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
      parts.push(`Tags: ${filters.tags.join(', ')}`);
    }
    return parts.length > 0 ? parts.join(' | ') : 'Tous les clients';
  };

  const filteredSegments = segments.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">{t('seg.title')}</h1>
          <p className="page-header__desc">{t('seg.subtitle')}</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsAddOpen(true)}>
            <Plus size={18} />
            <span>{t('seg.new')}</span>
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>{t('seg.total')}</span>
            <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: '#10b981' }}>
              <Tags size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{segments.length}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div className="search-box" style={{ position: 'relative', maxWidth: '400px', width: '100%' }}>
            <span className="search-icon" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Search size={18} /></span>
            <input 
              type="text" 
              className="input search-input" 
              placeholder={t('seg.search')} 
              style={{ paddingLeft: '2.5rem', width: '100%' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('seg.name')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('seg.description')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('seg.filters')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>{t('seg.members')}</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }} className="text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSegments.map((segment) => (
                  <tr key={segment.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-brand-500)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{segment.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{segment.description || '—'}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <span className="badge" style={{ background: 'var(--surface-2)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                        {formatFilters(segment.filters)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        <Users size={16} style={{ color: 'var(--text-muted)' }} />
                        <span>{segment.client_count} {t('common.clients')}</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEdit(segment)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-danger-icon" onClick={() => setDeleteTarget(segment)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSegments.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {t('seg.no_segment')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ajouter */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t('seg.create')}>
        <form onSubmit={handleAdd} className="modal-form">
          <div className="form-group">
            <label className="form-label">{t('seg.name_label')}</label>
            <input type="text" className="input" required value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})} placeholder="ex: Clients VIP" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('seg.desc_label')}</label>
            <textarea className="input" rows={2} value={addForm.description} onChange={e => setAddForm({...addForm, description: e.target.value})} placeholder="ex: Clients ayant le statut VIP" />
          </div>
          <div className="form-group">
            <label className="form-label">{t('seg.status_label')}</label>
            <select className="input" value={addForm.status} onChange={e => setAddForm({...addForm, status: e.target.value})}>
              <option value="">{t('seg.all_statuses')}</option>
              <option value="nouveau">Nouveau</option>
              <option value="actif">Actif</option>
              <option value="vip">VIP</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tags requis (séparés par des virgules)</label>
            <input type="text" className="input" value={addForm.tagsStr} onChange={e => setAddForm({...addForm, tagsStr: e.target.value})} placeholder="ex: Bazin, Grossiste" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsAddOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Création...' : t('common.add')}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Modifier */}
      <Modal isOpen={!!editSegment} onClose={() => setEditSegment(null)} title={t('seg.edit')}>
        <form onSubmit={handleEdit} className="modal-form">
          <div className="form-group">
            <label className="form-label">{t('seg.name_label')}</label>
            <input type="text" className="input" required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('seg.desc_label')}</label>
            <textarea className="input" rows={2} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('seg.status_label')}</label>
            <select className="input" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
              <option value="">{t('seg.all_statuses')}</option>
              <option value="nouveau">Nouveau</option>
              <option value="actif">Actif</option>
              <option value="vip">VIP</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tags requis (séparés par des virgules)</label>
            <input type="text" className="input" value={editForm.tagsStr} onChange={e => setEditForm({...editForm, tagsStr: e.target.value})} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditSegment(null)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={isEditing}>{isEditing ? 'Enregistrement...' : t('common.save')}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Supprimer */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('seg.confirm_delete')}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Êtes-vous sûr de vouloir supprimer le segment <strong>{deleteTarget?.name}</strong> ? Les clients associés ne seront pas supprimés.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Suppression...' : t('common.delete')}
          </button>
        </div>
      </Modal>

      <style jsx>{`
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
        .data-table tr:hover td { background: var(--surface-hover); }
      `}</style>
    </div>
  );
}
