'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';

interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  contact_person: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function SuppliersPage() {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
    contact_person: '',
    notes: ''
  });

  // View modal
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSuppliers = async () => {
    try {
      const response = await api.getSuppliers(1, 100);
      if (Array.isArray(response)) {
        setSuppliers(response);
      } else if (response && Array.isArray(response.items)) {
        setSuppliers(response.items);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error('Fetch suppliers error:', error);
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenAdd = () => {
    setEditSupplier(null);
    setFormData({
      name: '', company: '', phone: '', email: '', address: '', city: '', country: '', contact_person: '', notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditSupplier(supplier);
    setFormData({
      name: supplier.name,
      company: supplier.company || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      country: supplier.country || '',
      contact_person: supplier.contact_person || '',
      notes: supplier.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: formData.name,
        company: formData.company || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined,
        contact_person: formData.contact_person || undefined,
        notes: formData.notes || undefined,
      };
      
      if (editSupplier) {
        await api.updateSupplier(editSupplier.id, payload);
        toast.success(t('common.saving'));
      } else {
        await api.createSupplier(payload);
        toast.success(t('common.saving'));
      }
      
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteSupplier(deleteTarget.id);
      toast.success(t('common.deleting'));
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.company && s.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.phone && s.phone.includes(searchQuery))
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('sup.title')}</h1>
          <p className="page-subtitle">{t('sup.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <Plus size={16} /> {t('sup.new')}
          </button>
        </div>
      </div>

      <div className="filters card">
        <div className="search-box">
          <span className="search-icon"><Search size={18} /></span>
          <input
            type="text"
            className="input search-input"
            placeholder={t('sup.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('sup.name')}</th>
              <th>{t('sup.company')}</th>
              <th>{t('sup.phone')} / {t('sup.email')}</th>
              <th>{t('sup.city')} / {t('sup.country')}</th>
              <th>{t('sup.contact')}</th>
              <th className="text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map(sup => (
              <tr key={sup.id}>
                <td>
                  <div className="supplier-cell">
                    <div className="supplier-avatar">{sup.name.charAt(0).toUpperCase()}</div>
                    <span className="supplier-name">{sup.name}</span>
                  </div>
                </td>
                <td><span className="text-muted">{sup.company || '—'}</span></td>
                <td>
                  <div className="contact-info">
                    {sup.phone && <span>{sup.phone}</span>}
                    {sup.email && <span className="text-muted">{sup.email}</span>}
                    {!sup.phone && !sup.email && <span className="text-muted">—</span>}
                  </div>
                </td>
                <td>
                  <div className="location-info">
                    {sup.city && <span>{sup.city}</span>}
                    {sup.country && <span className="text-muted">{sup.country}</span>}
                    {!sup.city && !sup.country && <span className="text-muted">—</span>}
                  </div>
                </td>
                <td><span className="text-muted">{sup.contact_person || '—'}</span></td>
                <td className="text-right">
                  <div className="actions-flex">
                    <button className="btn btn-ghost btn-icon" title={t('sup.details')} onClick={() => setViewSupplier(sup)}>
                      <Eye size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon" title={t('sup.edit')} onClick={() => handleOpenEdit(sup)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-danger-icon" title={t('common.delete')} onClick={() => setDeleteTarget(sup)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8"><div className="spinner"></div></td></tr>
            )}
            {!isLoading && filteredSuppliers.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted">{t('sup.no_supplier')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Add/Edit */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editSupplier ? t('sup.edit') : t('sup.new')}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t('sup.name')} *</label>
              <input type="text" className="input" required value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('sup.company')}</label>
              <input type="text" className="input" value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })} />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('sup.phone')}</label>
              <input type="tel" className="input" value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('sup.email')}</label>
              <input type="email" className="input" value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('sup.city')}</label>
              <input type="text" className="input" value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('sup.country')}</label>
              <input type="text" className="input" value={formData.country}
                onChange={e => setFormData({ ...formData, country: e.target.value })} />
            </div>
            
            <div className="form-group full-width">
              <label className="form-label">{t('sup.address')}</label>
              <input type="text" className="input" value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('sup.contact')}</label>
              <input type="text" className="input" value={formData.contact_person}
                onChange={e => setFormData({ ...formData, contact_person: e.target.value })} />
            </div>
            
            <div className="form-group full-width">
              <label className="form-label">{t('sup.notes')}</label>
              <textarea className="input" rows={3} value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal View */}
      <Modal isOpen={!!viewSupplier} onClose={() => setViewSupplier(null)} title={t('sup.details')}>
        {viewSupplier && (
          <div className="detail-grid">
            <div className="detail-row">
              <span className="detail-label">{t('sup.name')}</span>
              <span className="detail-value">{viewSupplier.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('sup.company')}</span>
              <span className="detail-value">{viewSupplier.company || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('sup.phone')}</span>
              <span className="detail-value">{viewSupplier.phone || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('sup.email')}</span>
              <span className="detail-value">{viewSupplier.email || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('sup.address')}</span>
              <span className="detail-value">{viewSupplier.address || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('sup.city')} / {t('sup.country')}</span>
              <span className="detail-value">
                {viewSupplier.city || ''} {viewSupplier.city && viewSupplier.country ? '/' : ''} {viewSupplier.country || ''}
                {!viewSupplier.city && !viewSupplier.country && '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('sup.contact')}</span>
              <span className="detail-value">{viewSupplier.contact_person || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('sup.notes')}</span>
              <span className="detail-value">{viewSupplier.notes || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('common.created_at')}</span>
              <span className="detail-value">{new Date(viewSupplier.created_at).toLocaleDateString()}</span>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setViewSupplier(null)}>{t('common.close')}</button>
              <button className="btn btn-primary" onClick={() => { setViewSupplier(null); handleOpenEdit(viewSupplier); }}>
                <Pencil size={14} /> {t('common.edit')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Delete */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('sup.confirm_delete')}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {t('sup.delete_msg')} <br/><br/>
          <strong>{deleteTarget?.name}</strong>
        </p>
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

        .filters { padding: 1rem; }
        .search-box { position: relative; max-width: 400px; }
        .search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .search-input { padding-left: 2.5rem; }

        .table-container { padding: 0; overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th, .data-table td { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-subtle); }
        .data-table th { font-weight: 600; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table tr:hover td { background: var(--surface-hover); }
        .data-table tr:last-child td { border-bottom: none; }

        .supplier-cell { display: flex; align-items: center; gap: 0.75rem; }
        .supplier-avatar { width: 32px; height: 32px; border-radius: 8px; background: rgba(52, 211, 153, 0.15); color: #10b981; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; flex-shrink: 0; }
        .supplier-name { font-weight: 600; }
        
        .contact-info, .location-info { display: flex; flex-direction: column; gap: 0.125rem; font-size: 0.85rem; }

        .actions-flex { display: flex; gap: 0.25rem; justify-content: flex-end; }
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); font-size: 0.85rem; }
        .py-8 { padding: 2rem 0; }

        .modal-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .full-width { grid-column: span 2; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }

        .detail-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); }
        .detail-row:last-of-type { border-bottom: none; }
        .detail-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .detail-value { font-size: 0.9rem; color: var(--text-primary); font-weight: 500; max-width: 60%; text-align: right; }
        
        @media (max-width: 640px) {
          .form-grid { grid-template-columns: 1fr; }
          .full-width { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}
