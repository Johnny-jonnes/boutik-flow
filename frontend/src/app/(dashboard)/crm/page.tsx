'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, Pencil, Trash2, UserPlus } from 'lucide-react';
import type { Client, ClientStatus } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';

const STATUS_COLORS: Record<string, string> = {
  nouveau: 'badge-info',
  actif: 'badge-success',
  vip: 'badge-warning',
  inactif: 'badge-neutral',
};

export default function CRMPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', phone: '', email: '', status: 'nouveau' as ClientStatus, notes: '',
  });

  // View modal
  const [viewClient, setViewClient] = useState<Client | null>(null);

  // Edit modal
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', phone: '', email: '', status: 'nouveau' as ClientStatus, notes: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchClients = async () => {
    try {
      const response = await api.getClients(1, 100);
      setClients(response.items);
    } catch (error) {
      toast.error('Erreur lors de la récupération des clients');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  // Add client
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createClient({
        ...addForm,
        email: addForm.email || undefined,
        notes: addForm.notes || undefined,
      });
      toast.success('Client ajouté avec succès');
      setIsAddOpen(false);
      setAddForm({ name: '', phone: '', email: '', status: 'nouveau', notes: '' });
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit client
  const openEdit = (client: Client) => {
    setEditClient(client);
    setEditForm({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      status: client.status,
      notes: client.notes || '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClient) return;
    setIsEditing(true);
    try {
      await api.updateClient(editClient.id, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email || undefined,
        status: editForm.status,
        notes: editForm.notes || undefined,
      });
      toast.success('Client modifié avec succès');
      setEditClient(null);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la modification');
    } finally {
      setIsEditing(false);
    }
  };

  // Delete client
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteClient(deleteTarget.id);
      toast.success('Client supprimé');
      setDeleteTarget(null);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients (CRM)</h1>
          <p className="page-subtitle">Gérez vos clients et leur historique d&apos;achat.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" id="btn-add-client" onClick={() => setIsAddOpen(true)}>
            <UserPlus size={16} /> Nouveau client
          </button>
        </div>
      </div>

      <div className="filters card">
        <div className="search-box">
          <span className="search-icon"><Search size={18} /></span>
          <input
            type="text"
            className="input search-input"
            placeholder="Rechercher par nom ou numéro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Téléphone</th>
              <th>Statut</th>
              <th>Tags</th>
              <th>Dernière activité</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => (
              <tr key={client.id}>
                <td>
                  <div className="client-cell">
                    <div className="client-avatar">{client.name.charAt(0)}</div>
                    <span className="client-name">{client.name}</span>
                  </div>
                </td>
                <td><span className="client-phone">{client.phone}</span></td>
                <td>
                  <span className={`badge ${STATUS_COLORS[client.status] || 'badge-neutral'}`}>
                    {client.status.toUpperCase()}
                  </span>
                </td>
                <td>
                  <div className="tags-flex">
                    {client.tags.map(tag => (
                      <span key={tag} className="tag-pill">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="text-muted">
                  {new Date(client.last_activity_at || client.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="text-right">
                  <div className="actions-flex">
                    <button className="btn btn-ghost btn-icon" title="Voir" onClick={() => setViewClient(client)}>
                      <Eye size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon" title="Modifier" onClick={() => openEdit(client)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-danger-icon" title="Supprimer" onClick={() => setDeleteTarget(client)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8"><div className="spinner"></div></td></tr>
            )}
            {!isLoading && filteredClients.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted">Aucun client trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Ajouter */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouveau client">
        <form onSubmit={handleAdd} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nom complet *</label>
            <input type="text" className="input" required value={addForm.name}
              onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone *</label>
            <input type="tel" className="input" required value={addForm.phone}
              onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email (optionnel)</label>
            <input type="email" className="input" value={addForm.email}
              onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Statut</label>
            <select className="input" value={addForm.status}
              onChange={e => setAddForm({ ...addForm, status: e.target.value as ClientStatus })}>
              <option value="nouveau">Nouveau</option>
              <option value="actif">Actif</option>
              <option value="vip">VIP</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optionnel)</label>
            <textarea className="input" rows={3} value={addForm.notes}
              onChange={e => setAddForm({ ...addForm, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsAddOpen(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Voir */}
      <Modal isOpen={!!viewClient} onClose={() => setViewClient(null)} title="Détails du client">
        {viewClient && (
          <div className="detail-grid">
            <div className="detail-row">
              <span className="detail-label">Nom</span>
              <span className="detail-value">{viewClient.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Téléphone</span>
              <span className="detail-value">{viewClient.phone}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{viewClient.email || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Statut</span>
              <span className={`badge ${STATUS_COLORS[viewClient.status]}`}>{viewClient.status.toUpperCase()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Notes</span>
              <span className="detail-value">{viewClient.notes || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Créé le</span>
              <span className="detail-value">{new Date(viewClient.created_at).toLocaleDateString('fr-FR')}</span>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setViewClient(null)}>Fermer</button>
              <button className="btn btn-primary" onClick={() => { setViewClient(null); openEdit(viewClient); }}>
                <Pencil size={14} /> Modifier
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Modifier */}
      <Modal isOpen={!!editClient} onClose={() => setEditClient(null)} title="Modifier le client">
        <form onSubmit={handleEdit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nom complet *</label>
            <input type="text" className="input" required value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone *</label>
            <input type="tel" className="input" required value={editForm.phone}
              onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="input" value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Statut</label>
            <select className="input" value={editForm.status}
              onChange={e => setEditForm({ ...editForm, status: e.target.value as ClientStatus })}>
              <option value="nouveau">Nouveau</option>
              <option value="actif">Actif</option>
              <option value="vip">VIP</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="input" rows={3} value={editForm.notes}
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditClient(null)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={isEditing}>
              {isEditing ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Supprimer */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer la suppression">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Êtes-vous sûr de vouloir supprimer le client <strong>{deleteTarget?.name}</strong> ? Cette action est irréversible.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Annuler</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Suppression...' : 'Supprimer'}
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

        .client-cell { display: flex; align-items: center; gap: 0.75rem; }
        .client-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--color-brand-600); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; flex-shrink: 0; }
        .client-name { font-weight: 600; }
        .client-phone { color: var(--text-secondary); font-family: monospace; font-size: 0.9rem; }

        .tags-flex { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .tag-pill { background: var(--surface-3); color: var(--text-secondary); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border-default); }

        .actions-flex { display: flex; gap: 0.25rem; justify-content: flex-end; }
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); font-size: 0.85rem; }
        .py-8 { padding: 2rem 0; }

        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }

        .detail-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); }
        .detail-row:last-of-type { border-bottom: none; }
        .detail-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .detail-value { font-size: 0.9rem; color: var(--text-primary); font-weight: 500; }
      `}</style>
    </div>
  );
}
