'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Eye, Pencil, Plus, LayoutGrid, List, Check, XCircle, ArrowRight, Trash2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import type { Order, Client, Product, OrderStatus } from '@/types';
import { Modal } from '@/components/ui/Modal';

const STATUS_CONFIG: Record<string, { label: string; cls: string; id: string }> = {
  pending: { label: 'En attente', cls: 'badge-warning', id: 'pending' },
  confirmed: { label: 'Confirmée', cls: 'badge-info', id: 'confirmed' },
  delivered: { label: 'Livrée', cls: 'badge-success', id: 'delivered' },
  cancelled: { label: 'Annulée', cls: 'badge-error', id: 'cancelled' },
};

const COLUMNS = ['pending', 'confirmed', 'delivered', 'cancelled'];

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

function formatDate(isoString: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString));
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<{
    client_id: string;
    items: { product_id: string; quantity: number }[];
    notes: string;
  }>({
    client_id: '', items: [{ product_id: '', quantity: 1 }], notes: '',
  });

  // View modal
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  // Status update modal
  const [statusOrder, setStatusOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchOrders = async () => {
    try {
      const response = await api.getOrders(1); // Fetch all orders
      setOrders(response.items);
    } catch (error) {
      toast.error('Erreur lors de la récupération des commandes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    fetchOrders(); 
  }, []);

  useEffect(() => {
    api.getClients(1, 100).then(res => setClients(res.items)).catch(() => {});
    api.getProducts(1, 100).then(res => setProducts(res.items)).catch(() => {});
  }, []);

  // Multi-product handlers
  const handleAddItem = () => {
    setCreateForm(prev => ({ ...prev, items: [...prev.items, { product_id: '', quantity: 1 }] }));
  };

  const handleRemoveItem = (index: number) => {
    setCreateForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...createForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateForm(prev => ({ ...prev, items: newItems }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.client_id || createForm.items.length === 0 || createForm.items.some(i => !i.product_id)) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createOrder({
        client_id: createForm.client_id,
        items: createForm.items,
        notes: createForm.notes || undefined,
      });
      toast.success('Commande créée avec succès');
      setIsCreateOpen(false);
      setCreateForm({ client_id: '', items: [{ product_id: '', quantity: 1 }], notes: '' });
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status update
  const openStatusModal = (order: Order) => {
    setStatusOrder(order);
    const availableStatuses = Object.keys(STATUS_CONFIG).filter(s => s !== order.status);
    setNewStatus(availableStatuses[0] || '');
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    setIsUpdatingStatus(true);
    try {
      await api.updateOrderStatus(orderId, status);
      toast.success('Statut mis à jour');
      setStatusOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const confirmStatusUpdate = () => {
    if (statusOrder && newStatus) {
      handleStatusUpdate(statusOrder.id, newStatus);
    }
  };

  // Kanban Drag & Drop
  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData('orderId', orderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    const order = orders.find(o => o.id === orderId);
    if (order && order.status !== targetStatus) {
      handleStatusUpdate(orderId, targetStatus);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (orders.length === 0) {
      toast.error('Aucune commande à exporter');
      return;
    }
    const headers = ['ID', 'Client', 'Statut', 'Montant', 'Articles', 'Notes', 'Date'];
    const rows = orders.map(o => [
      o.id.slice(0, 8),
      o.client_id.slice(0, 8),
      STATUS_CONFIG[o.status]?.label || o.status,
      String(o.total || 0),
      String(o.items?.length || 0),
      o.notes || '',
      new Date(o.created_at).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commandes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || `Client...`;
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || `Produit...`;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Commandes</h1>
          <p className="page-subtitle">Gérez vos commandes via le tunnel de vente (Kanban).</p>
        </div>
        <div className="header-actions">
          <div className="view-toggles">
            <button className={`view-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}>
              <LayoutGrid size={16} /> Kanban
            </button>
            <button className={`view-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
              <List size={16} /> Table
            </button>
          </div>
          <button className="btn btn-ghost" onClick={handleExport}>
            <Download size={16} /> Exporter
          </button>
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Nouvelle commande
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
      ) : viewMode === 'kanban' ? (
        <div className="kanban-board">
          {COLUMNS.map(statusId => {
            const columnOrders = orders.filter(o => o.status === statusId);
            const config = STATUS_CONFIG[statusId];
            return (
              <div 
                key={statusId} 
                className="kanban-column"
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, statusId)}
              >
                <div className="kanban-header">
                  <div className="kanban-title">
                    <span className={`kanban-dot ${config.cls}`}></span>
                    {config.label}
                  </div>
                  <span className="kanban-count">{columnOrders.length}</span>
                </div>
                <div className="kanban-cards">
                  {columnOrders.map(order => (
                    <div 
                      key={order.id} 
                      className="kanban-card"
                      draggable
                      onDragStart={e => handleDragStart(e, order.id)}
                      onClick={() => setViewOrder(order)}
                    >
                      <div className="kanban-card-header">
                        <span className="kanban-order-id">#{order.id.slice(0, 6)}</span>
                        <span className="kanban-date">{formatDate(order.created_at).split(' ')[0]}</span>
                      </div>
                      <div className="kanban-client">{getClientName(order.client_id)}</div>
                      <div className="kanban-amount">{formatGNF(Number(order.total))}</div>
                      <div className="kanban-items-count">
                        {order.items?.length || 0} article(s)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-container card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Commande</th>
                <th>Client</th>
                <th>Date</th>
                <th>Statut</th>
                <th className="text-right">Montant</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td>
                    <span className="order-id">#{order.id.slice(0, 8)}</span>
                    {order.notes && <div className="order-notes"><FileText size={12} /> {order.notes}</div>}
                  </td>
                  <td>
                    <div className="client-cell">
                      <div className="client-avatar">{getClientName(order.client_id).charAt(0).toUpperCase()}</div>
                      <span className="client-name">{getClientName(order.client_id)}</span>
                    </div>
                  </td>
                  <td className="text-muted">{formatDate(order.created_at)}</td>
                  <td>
                    <span className={`badge ${STATUS_CONFIG[order.status]?.cls || 'badge-neutral'}`}>
                      {STATUS_CONFIG[order.status]?.label || order.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className="order-amount">{formatGNF(Number(order.total) || 0)}</span>
                    <div className="order-items">{order.items?.length || 0} article(s)</div>
                  </td>
                  <td className="text-center">
                    <div className="actions-flex">
                      <button className="btn btn-ghost btn-icon" onClick={() => setViewOrder(order)}>
                        <Eye size={16} />
                      </button>
                      {order.status !== 'cancelled' && (
                        <button className="btn btn-ghost btn-icon" onClick={() => openStatusModal(order)}>
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Créer Multi-produits */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Nouvelle commande">
        <form onSubmit={handleCreate} className="modal-form">
          <div className="form-group">
            <label className="form-label">Client *</label>
            <select className="input" required value={createForm.client_id} onChange={e => setCreateForm({ ...createForm, client_id: e.target.value })}>
              <option value="">Sélectionner un client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
            </select>
          </div>
          
          <div className="form-section-title">Articles</div>
          <div className="items-list">
            {createForm.items.map((item, index) => (
              <div key={index} className="item-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <select className="input" required value={item.product_id} onChange={e => handleItemChange(index, 'product_id', e.target.value)}>
                    <option value="">Produit</option>
                    {products.filter(p => p.is_available && p.stock > 0).map(p => <option key={p.id} value={p.id}>{p.name} - {formatGNF(p.price)}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ width: '80px' }}>
                  <input type="number" className="input" required min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)} />
                </div>
                {createForm.items.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-icon btn-danger-icon" onClick={() => handleRemoveItem(index)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddItem} style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            <Plus size={14} /> Ajouter un produit
          </button>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">Notes (optionnel)</label>
            <textarea className="input" rows={2} placeholder="Ex: Livraison urgente" value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setIsCreateOpen(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Création...' : 'Créer la commande'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Voir */}
      <Modal isOpen={!!viewOrder} onClose={() => setViewOrder(null)} title="Détails de la commande">
        {viewOrder && (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">Client</span><span className="detail-value">{getClientName(viewOrder.client_id)}</span></div>
            <div className="detail-row"><span className="detail-label">Statut</span><span className={`badge ${STATUS_CONFIG[viewOrder.status]?.cls}`}>{STATUS_CONFIG[viewOrder.status]?.label}</span></div>
            <div className="detail-row"><span className="detail-label">Montant total</span><span className="detail-value order-amount">{formatGNF(Number(viewOrder.total) || 0)}</span></div>
            <div className="detail-row"><span className="detail-label">Articles</span><span className="detail-value">{viewOrder.items?.length || 0} article(s)</span></div>
            {viewOrder.items?.map((item, i) => (
              <div key={i} className="detail-row" style={{ paddingLeft: '1rem' }}>
                <span className="detail-label">— {getProductName(item.product_id)}</span>
                <span className="detail-value">x{item.quantity} · {formatGNF(item.unit_price)}</span>
              </div>
            ))}
            <div className="detail-row"><span className="detail-label">Notes</span><span className="detail-value">{viewOrder.notes || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Créée le</span><span className="detail-value">{formatDate(viewOrder.created_at)}</span></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setViewOrder(null)}>Fermer</button>
              {viewOrder.status !== 'cancelled' && (
                <button className="btn btn-primary" onClick={() => { const o = viewOrder; setViewOrder(null); openStatusModal(o); }}>
                  <ArrowRight size={14} /> Changer le statut
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Changer statut */}
      <Modal isOpen={!!statusOrder} onClose={() => setStatusOrder(null)} title="Changer le statut">
        {statusOrder && (
          <div className="modal-form">
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Statut actuel :
              <span className={`badge ${STATUS_CONFIG[statusOrder.status]?.cls}`} style={{ marginLeft: '0.5rem' }}>
                {STATUS_CONFIG[statusOrder.status]?.label}
              </span>
            </p>
            <div className="form-group">
              <label className="form-label">Déplacer vers</label>
              <select className="input" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {Object.keys(STATUS_CONFIG).filter(s => s !== statusOrder.status).map(status => (
                  <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setStatusOrder(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={confirmStatusUpdate} disabled={!newStatus || isUpdatingStatus}>
                {isUpdatingStatus ? 'Mise à jour...' : 'Confirmer'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.75rem; margin-bottom: 0.25rem; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; }
        .header-actions { display: flex; gap: 0.75rem; align-items: center; }

        .view-toggles { display: flex; background: var(--surface-2); padding: 0.25rem; border-radius: 8px; border: 1px solid var(--border-subtle); }
        .view-btn { display: flex; align-items: center; gap: 0.375rem; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); background: transparent; border: none; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .view-btn:hover { color: var(--text-primary); }
        .view-btn.active { background: var(--surface-3); color: var(--color-brand-400); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }

        /* Kanban Styles */
        .kanban-board {
          display: flex; gap: 1.5rem;
          overflow-x: auto;
          padding-bottom: 1rem;
          min-height: 60vh;
          align-items: flex-start;
        }
        .kanban-column {
          flex: 1;
          min-width: 280px;
          background: var(--surface-1);
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          display: flex; flex-direction: column;
        }
        .kanban-header {
          padding: 1rem;
          border-bottom: 1px solid var(--border-subtle);
          display: flex; justify-content: space-between; align-items: center;
        }
        .kanban-title { font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem; }
        .kanban-dot { width: 8px; height: 8px; border-radius: 50%; }
        .kanban-dot.badge-warning { background: #f59e0b; }
        .kanban-dot.badge-info { background: #3b82f6; }
        .kanban-dot.badge-success { background: #10b981; }
        .kanban-dot.badge-error { background: #f43f5e; }
        .kanban-count { background: var(--surface-2); color: var(--text-muted); font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; }
        .kanban-cards {
          padding: 0.75rem;
          display: flex; flex-direction: column; gap: 0.75rem;
          min-height: 100px;
        }
        .kanban-card {
          background: var(--surface-2);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 0.875rem;
          cursor: grab;
          transition: all 0.2s ease;
        }
        .kanban-card:hover { border-color: var(--color-brand-500); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .kanban-card:active { cursor: grabbing; }
        .kanban-card-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.75rem; }
        .kanban-order-id { font-family: monospace; color: var(--text-muted); }
        .kanban-date { color: var(--text-muted); }
        .kanban-client { font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; }
        .kanban-amount { font-weight: 700; color: var(--color-brand-400); font-family: var(--font-display); margin-bottom: 0.25rem; }
        .kanban-items-count { font-size: 0.75rem; color: var(--text-secondary); }

        /* Table Styles */
        .table-container { padding: 0; overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th, .data-table td { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }
        .data-table th { font-weight: 600; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table tr:hover td { background: var(--surface-hover); }
        .data-table tr:last-child td { border-bottom: none; }
        .order-id { font-weight: 700; font-family: monospace; color: var(--text-primary); font-size: 0.95rem; }
        .client-cell { display: flex; align-items: center; gap: 0.75rem; }
        .client-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; flex-shrink: 0; }
        .client-name { font-weight: 600; }
        .order-amount { font-weight: 700; color: var(--color-brand-400); font-family: var(--font-display); }
        .actions-flex { display: flex; gap: 0.25rem; justify-content: center; }
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); font-size: 0.85rem; }

        /* Form Styles */
        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .form-section-title { font-size: 0.85rem; font-weight: 600; color: var(--text-primary); margin-top: 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border-subtle); }
        .items-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .item-row { display: flex; gap: 0.5rem; align-items: flex-end; }
        .btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }

        /* Detail grid */
        .detail-grid { display: flex; flex-direction: column; gap: 0.5rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); }
        .detail-row:last-of-type { border-bottom: none; }
        .detail-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .detail-value { font-size: 0.9rem; color: var(--text-primary); font-weight: 500; }
      `}</style>
    </div>
  );
}
