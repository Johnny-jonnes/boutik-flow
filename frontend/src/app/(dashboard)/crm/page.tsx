'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, Pencil, Trash2, UserPlus, CreditCard, DollarSign } from 'lucide-react';
import type { Client, ClientStatus, ClientDebt } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';

const STATUS_COLORS: Record<string, string> = {
  nouveau: 'badge-info',
  actif: 'badge-success',
  vip: 'badge-warning',
  inactif: 'badge-neutral',
};

export default function CRMPage() {
  const { t, language } = useLanguage();
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
  const [clientDebts, setClientDebts] = useState<ClientDebt[]>([]);
  const [isLoadingDebts, setIsLoadingDebts] = useState(false);

  // Payment modal
  const [payDebt, setPayDebt] = useState<ClientDebt | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'cash', notes: '' });
  const [isPayingDebt, setIsPayingDebt] = useState(false);

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

  const fetchClientDebts = async (clientId: string) => {
    setIsLoadingDebts(true);
    try {
      const data = await api.getDebts(clientId);
      setClientDebts(data);
    } catch (error) {
      console.error('Error fetching client debts:', error);
    } finally {
      setIsLoadingDebts(false);
    }
  };

  const openView = (client: Client) => {
    setViewClient(client);
    setClientDebts([]);
    fetchClientDebts(client.id);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDebt) return;
    const amountNum = parseFloat(payForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Veuillez entrer un montant valide supérieur à 0.');
      return;
    }
    if (amountNum > payDebt.remaining_amount) {
      toast.error(`Le montant dépasse le solde restant (${payDebt.remaining_amount} GNF)`);
      return;
    }
    setIsPayingDebt(true);
    try {
      await api.recordDebtPayment(payDebt.id, {
        amount: amountNum,
        payment_method: payForm.paymentMethod,
        notes: payForm.notes || undefined,
      });
      toast.success(language === 'fr' ? 'Règlement enregistré avec succès !' : 'Payment recorded successfully!');
      setPayDebt(null);
      setPayForm({ amount: '', paymentMethod: 'cash', notes: '' });
      if (viewClient) {
        fetchClientDebts(viewClient.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du règlement');
    } finally {
      setIsPayingDebt(false);
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
          <h1 className="page-title">{t('crm.title')}</h1>
          <p className="page-subtitle">{t('crm.subtitle')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" id="btn-add-client" onClick={() => setIsAddOpen(true)}>
            <UserPlus size={16} /> {t('crm.new')}
          </button>
        </div>
      </div>

      <div className="filters card">
        <div className="search-box">
          <span className="search-icon"><Search size={18} /></span>
          <input
            type="text"
            className="input search-input"
            placeholder={t('crm.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('crm.name')}</th>
              <th>{t('crm.phone')}</th>
              <th>{t('crm.status')}</th>
              <th>{t('crm.tags')}</th>
              <th>{t('crm.last_activity')}</th>
              <th className="text-right">{t('prod.actions')}</th>
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
                    <button className="btn btn-ghost btn-icon" title="Voir" onClick={() => openView(client)}>
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
      <Modal isOpen={!!viewClient} onClose={() => { setViewClient(null); setClientDebts([]); }} title={language === 'fr' ? 'Détails du client' : 'Customer Details'}>
        {viewClient && (
          <div className="detail-grid">
            <div className="detail-row">
              <span className="detail-label">{language === 'fr' ? 'Nom' : 'Name'}</span>
              <span className="detail-value">{viewClient.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{language === 'fr' ? 'Téléphone' : 'Phone'}</span>
              <span className="detail-value">{viewClient.phone}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{viewClient.email || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{language === 'fr' ? 'Statut' : 'Status'}</span>
              <span className={`badge ${STATUS_COLORS[viewClient.status]}`}>{viewClient.status.toUpperCase()}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{language === 'fr' ? 'Notes' : 'Notes'}</span>
              <span className="detail-value">{viewClient.notes || '—'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{language === 'fr' ? 'Créé le' : 'Created'}</span>
              <span className="detail-value">{new Date(viewClient.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}</span>
            </div>

            {/* Section Dettes */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <CreditCard size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {language === 'fr' ? 'Dettes & Règlements' : 'Debts & Payments'}
                </span>
              </div>

              {isLoadingDebts ? (
                <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {language === 'fr' ? 'Chargement...' : 'Loading...'}
                </div>
              ) : clientDebts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {language === 'fr' ? 'Aucune dette enregistrée.' : 'No debts recorded.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {clientDebts.map(debt => (
                    <div key={debt.id} style={{
                      background: debt.status === 'paid' ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)',
                      border: `1px solid ${debt.status === 'paid' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      borderRadius: '8px', padding: '0.65rem 0.85rem',
                      display: 'flex', flexDirection: 'column', gap: '0.3rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {debt.description || (language === 'fr' ? 'Vente à crédit' : 'Credit sale')}
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px',
                          background: debt.status === 'paid' ? 'rgba(16,185,129,0.15)' : debt.status === 'partial' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                          color: debt.status === 'paid' ? '#10b981' : debt.status === 'partial' ? '#3b82f6' : '#f59e0b'
                        }}>
                          {debt.status === 'paid' ? (language === 'fr' ? 'Réglé' : 'Paid') : debt.status === 'partial' ? (language === 'fr' ? 'Partiel' : 'Partial') : (language === 'fr' ? 'En attente' : 'Pending')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {language === 'fr' ? 'Montant initial' : 'Original'}: <strong>{debt.original_amount.toLocaleString()} GNF</strong>
                        </span>
                        <span style={{ color: debt.remaining_amount > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          {language === 'fr' ? 'Reste' : 'Left'}: {debt.remaining_amount.toLocaleString()} GNF
                        </span>
                      </div>
                      {debt.remaining_amount > 0 && (
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: '0.3rem', padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          onClick={() => { setPayDebt(debt); setPayForm({ amount: String(debt.remaining_amount), paymentMethod: 'cash', notes: '' }); }}
                        >
                          <DollarSign size={13} /> {language === 'fr' ? 'Enregistrer un règlement' : 'Record payment'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setViewClient(null); setClientDebts([]); }}>{language === 'fr' ? 'Fermer' : 'Close'}</button>
              <button className="btn btn-primary" onClick={() => { setViewClient(null); setClientDebts([]); openEdit(viewClient); }}>
                <Pencil size={14} /> {language === 'fr' ? 'Modifier' : 'Edit'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Règlement de dette */}
      <Modal isOpen={!!payDebt} onClose={() => { setPayDebt(null); setPayForm({ amount: '', paymentMethod: 'cash', notes: '' }); }} title={language === 'fr' ? 'Enregistrer un règlement' : 'Record Payment'}>
        {payDebt && (
          <form onSubmit={handlePaySubmit} className="modal-form">
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <strong style={{ color: '#f59e0b' }}>{language === 'fr' ? 'Solde restant' : 'Remaining balance'} :</strong>
              <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{payDebt.remaining_amount.toLocaleString()} GNF</span>
            </div>
            <div className="form-group">
              <label className="form-label">{language === 'fr' ? 'Montant du versement (GNF) *' : 'Payment Amount (GNF) *'}</label>
              <input
                type="number" className="input" required min="1" max={payDebt.remaining_amount}
                value={payForm.amount}
                onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                placeholder={`Max: ${payDebt.remaining_amount.toLocaleString()} GNF`}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{language === 'fr' ? 'Mode de paiement' : 'Payment Method'}</label>
              <select className="input" value={payForm.paymentMethod} onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                <option value="cash">{language === 'fr' ? 'Espèces' : 'Cash'}</option>
                <option value="orange_money">Orange Money</option>
                <option value="mtn_money">MTN Money</option>
                <option value="wave">Wave</option>
                <option value="card">{language === 'fr' ? 'Carte bancaire' : 'Bank card'}</option>
                <option value="transfer">{language === 'fr' ? 'Virement bancaire' : 'Bank transfer'}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{language === 'fr' ? 'Notes (optionnel)' : 'Notes (optional)'}</label>
              <input type="text" className="input" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setPayDebt(null); setPayForm({ amount: '', paymentMethod: 'cash', notes: '' }); }}>{language === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary" disabled={isPayingDebt}>
                {isPayingDebt ? (language === 'fr' ? 'Enregistrement...' : 'Saving...') : (language === 'fr' ? 'Confirmer le règlement' : 'Confirm Payment')}
              </button>
            </div>
          </form>
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
