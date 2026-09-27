'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Eye, Pencil, Trash2, UserPlus, CreditCard, Users, Crown, UserCheck, ShoppingBag, MessageCircle, ChevronDown, ChevronLeft, ChevronRight, UserSearch } from 'lucide-react';
import type { Client, ClientStatus, ClientDebt } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { useLanguage } from '@/context/LanguageContext';
import { useClientsQuery, useOrdersQuery, queryKeys } from '@/lib/queries';
import { PageHeader, StatTile, type StatTone } from '@/components/ui/PageHeader';
import { formatGNF, formatNumber, formatRelativeDay, hueFromString, initials } from '@/lib/format';
import { celebrate } from '@/lib/celebrate';
import { usePermission } from '@/lib/permissions';
import { DebtCard } from '@/components/debts/DebtCard';
import { DebtPaymentModal } from '@/components/debts/DebtPaymentModal';

const STATUS_COLORS: Record<string, string> = {
  nouveau: 'badge-info',
  actif: 'badge-success',
  vip: 'badge-warning',
  inactif: 'badge-neutral',
};

// Libellés affichés — "actif" correspond à "Régulier" dans les formulaires.
const STATUS_CONFIG: Record<string, { fr: string; en: string; tone: StatTone }> = {
  nouveau: { fr: 'Nouveau', en: 'New', tone: 'sky' },
  actif: { fr: 'Régulier', en: 'Regular', tone: 'emerald' },
  vip: { fr: 'VIP', en: 'VIP', tone: 'amber' },
  inactif: { fr: 'Inactif', en: 'Inactive', tone: 'slate' },
};

export default function CRMPage() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const canCreate = usePermission('clients', 'create');
  const canEdit = usePermission('clients', 'edit');
  const canDelete = usePermission('clients', 'delete');
  // Cache partagé avec Dashboard, Vendre et Produits — voir products/page.tsx.
  const { data: clientsData, isLoading } = useClientsQuery();
  const clients = clientsData?.items ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientStatus>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'spent' | 'name'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  // Cache des ventes partagé avec l'Accueil — sert au total d'achats par client.
  const { data: ordersData } = useOrdersQuery();

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

  // Edit modal
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', phone: '', email: '', status: 'nouveau' as ClientStatus, notes: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // La revalidation après synchronisation offline→online est gérée
  // globalement par QueryProvider (clé de cache partagée avec cette page).

  // Add client
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await api.createClient({
        ...addForm,
        email: addForm.email || undefined,
        notes: addForm.notes || undefined,
      });
      celebrate({
        kind: 'client',
        title: language === 'fr' ? 'Client ajouté' : 'Customer added',
        subtitle: created.name,
        initials: initials(created.name),
        chips: [created.phone, language === 'fr' ? STATUS_CONFIG[created.status]?.fr ?? created.status : STATUS_CONFIG[created.status]?.en ?? created.status].filter(Boolean),
      });
      setIsAddOpen(false);
      setAddForm({ name: '', phone: '', email: '', status: 'nouveau', notes: '' });
      queryClient.setQueryData(queryKeys.clients(), (old: typeof clientsData) =>
        old ? { ...old, items: [created, ...old.items], total: old.total + 1 } : old
      );
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
      const updated = await api.updateClient(editClient.id, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email || undefined,
        status: editForm.status,
        notes: editForm.notes || undefined,
      });
      toast.success('Client modifié avec succès');
      setEditClient(null);
      queryClient.setQueryData(queryKeys.clients(), (old: typeof clientsData) =>
        old ? { ...old, items: old.items.map(c => (c.id === updated.id ? updated : c)) } : old
      );
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
      celebrate({
        kind: 'deleted',
        title: fr ? 'Client supprimé' : 'Customer deleted',
        subtitle: deleteTarget.name,
        initials: initials(deleteTarget.name),
        chips: [fr ? 'Retiré de vos clients' : 'Removed from customers'],
      });
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      queryClient.setQueryData(queryKeys.clients(), (old: typeof clientsData) =>
        old ? { ...old, items: old.items.filter(c => c.id !== deletedId), total: Math.max(0, old.total - 1) } : old
      );
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const fr = language === 'fr';

  // Achats par client (nombre, total, dernier achat) — dérivés du cache
  // partagé des ventes (useOrdersQuery, le même que l'Accueil).
  const purchasesByClient = useMemo(() => {
    const map = new Map<string, { count: number; total: number; last: string }>();
    for (const o of ordersData?.items ?? []) {
      if (!o.client_id || o.status === 'cancelled') continue;
      const cur = map.get(o.client_id) ?? { count: 0, total: 0, last: o.created_at };
      cur.count += 1;
      cur.total += Number(o.total) || 0;
      if (new Date(o.created_at) > new Date(cur.last)) cur.last = o.created_at;
      map.set(o.client_id, cur);
    }
    return map;
  }, [ordersData]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clients) counts[c.status] = (counts[c.status] ?? 0) + 1;
    return counts;
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = clients.filter(c =>
      (c.name.toLowerCase().includes(q) || c.phone.includes(searchQuery)) &&
      (statusFilter === 'all' || c.status === statusFilter)
    );
    const spent = (c: Client) => purchasesByClient.get(c.id)?.total ?? 0;
    const lastActivity = (c: Client) => new Date(purchasesByClient.get(c.id)?.last || c.last_activity_at || c.created_at).getTime();
    return [...list].sort((a, b) =>
      sortBy === 'name' ? a.name.localeCompare(b.name)
        : sortBy === 'spent' ? spent(b) - spent(a)
          : lastActivity(b) - lastActivity(a)
    );
  }, [clients, searchQuery, statusFilter, sortBy, purchasesByClient]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const pagedClients = filteredClients.slice((safePage - 1) * perPage, safePage * perPage);
  const totalSpent = [...purchasesByClient.values()].reduce((acc, p) => acc + p.total, 0);

  const setFilter = (status: 'all' | ClientStatus) => { setStatusFilter(status); setCurrentPage(1); };

  const statusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] ?? { fr: status, en: status, tone: 'slate' };
    return (
      <span className="bf-badge" data-tone={cfg.tone}>
        {status === 'vip' ? <Crown size={12} /> : <span className="bf-badge__dot" />}
        {fr ? cfg.fr : cfg.en}
      </span>
    );
  };

  const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/[^\d]/g, '')}`;

  const clientActions = (client: Client) => (
    <div className="bf-row-actions">
      <a className="bf-icon-btn bf-icon-btn--brand" href={whatsappHref(client.phone)} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label="WhatsApp">
        <MessageCircle size={16} />
      </a>
      <button type="button" className="bf-icon-btn" title="Voir" aria-label="Voir" onClick={() => openView(client)}>
        <Eye size={16} />
      </button>
      {canEdit && (
        <button type="button" className="bf-icon-btn" title="Modifier" aria-label="Modifier" onClick={() => openEdit(client)}>
          <Pencil size={16} />
        </button>
      )}
      {canDelete && (
        <button type="button" className="bf-icon-btn bf-icon-btn--danger" title="Supprimer" aria-label="Supprimer" onClick={() => setDeleteTarget(client)}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  const avatar = (client: Client) => (
    <span className="bf-avatar" style={{ '--hue': hueFromString(client.name) } as React.CSSProperties}>{initials(client.name)}</span>
  );

  const purchasesCell = (client: Client) => {
    const p = purchasesByClient.get(client.id);
    return p
      ? <span className="bf-cell__text"><span className="bf-money">{formatGNF(p.total)}</span><span className="bf-sub">{formatNumber(p.count)} {fr ? (p.count > 1 ? 'achats' : 'achat') : (p.count > 1 ? 'purchases' : 'purchase')}</span></span>
      : <span className="bf-muted">{fr ? 'Aucun achat' : 'No purchase'}</span>;
  };

  const lastActivity = (client: Client) =>
    formatRelativeDay(purchasesByClient.get(client.id)?.last || client.last_activity_at || client.created_at, language);

  return (
    <div className="bf-page">
      <PageHeader
        icon={Users}
        title={t('crm.title')}
        subtitle={t('crm.subtitle')}
        actions={canCreate && (
          <button className="btn btn-primary" id="btn-add-client" onClick={() => setIsAddOpen(true)}>
            <UserPlus size={16} /> {t('crm.new')}
          </button>
        )}
      />

      <section className="bf-stats">
        <StatTile tone="teal" icon={Users} label={fr ? 'Clients' : 'Customers'} value={formatNumber(clients.length)}
          hint={<><strong>{formatNumber(statusCounts.nouveau ?? 0)}</strong> {fr ? 'nouveaux' : 'new'}</>} />
        <StatTile tone="amber" icon={Crown} label="VIP" value={formatNumber(statusCounts.vip ?? 0)}
          hint={fr ? 'Vos meilleurs clients' : 'Your best customers'} />
        <StatTile tone="emerald" icon={UserCheck} label={fr ? 'Réguliers' : 'Regulars'} value={formatNumber(statusCounts.actif ?? 0)}
          hint={<><strong>{formatNumber(purchasesByClient.size)}</strong> {fr ? 'ont déjà acheté' : 'have purchased'}</>} />
        <StatTile tone="violet" icon={ShoppingBag} label={fr ? 'Dépenses clients' : 'Customer spend'} value={formatNumber(totalSpent)} suffix="GNF"
          hint={fr ? 'Ventes aux clients identifiés' : 'Sales to known customers'} />
      </section>

      <section className="bf-toolbar">
        <div className="bf-search">
          <Search size={18} />
          <input type="text" placeholder={t('crm.search')} value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
        </div>
        <div className="bf-select-wrap">
          <select className="bf-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label={fr ? 'Trier' : 'Sort'}>
            <option value="recent">{fr ? 'Activité récente' : 'Recent activity'}</option>
            <option value="spent">{fr ? 'Meilleurs clients' : 'Top spenders'}</option>
            <option value="name">{fr ? 'Nom (A → Z)' : 'Name (A → Z)'}</option>
          </select>
          <ChevronDown size={15} />
        </div>
        <div className="bf-chips" style={{ flexBasis: '100%' }} role="tablist">
          {(['all', 'nouveau', 'actif', 'vip', 'inactif'] as const).map((st) => (
            <button key={st} type="button" role="tab" aria-selected={statusFilter === st}
              className={`bf-chip ${statusFilter === st ? 'bf-chip--active' : ''}`} onClick={() => setFilter(st)}>
              {st === 'all' ? (fr ? 'Tous' : 'All') : (fr ? STATUS_CONFIG[st].fr : STATUS_CONFIG[st].en)}
              <span className="bf-chip__count">{formatNumber(st === 'all' ? clients.length : statusCounts[st] ?? 0)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bf-panel">
        <div className="bf-panel__head">
          <span className="bf-panel__title">{fr ? 'Fichier clients' : 'Customer list'} <span className="bf-count">{formatNumber(filteredClients.length)}</span></span>
        </div>

        {isLoading && clients.length === 0 ? (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="bf-skeleton" style={{ height: 56 }} />)}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="bf-empty">
            <span className="bf-empty__icon"><UserSearch size={24} /></span>
            <strong>{clients.length === 0 ? (fr ? 'Aucun client pour le moment' : 'No customers yet') : (fr ? 'Aucun client trouvé' : 'No customer found')}</strong>
            {clients.length === 0 && canCreate && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsAddOpen(true)}><UserPlus size={15} /> {t('crm.new')}</button>
            )}
          </div>
        ) : (
          <>
            <div className="bf-table-wrap bf-desktop-only">
              <table className="bf-table">
                <thead>
                  <tr>
                    <th>{t('crm.name')}</th>
                    <th>{t('crm.phone')}</th>
                    <th>{t('crm.status')}</th>
                    <th>{fr ? 'Achats' : 'Purchases'}</th>
                    <th>{t('crm.last_activity')}</th>
                    <th className="bf-right">{t('prod.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedClients.map(client => (
                    <tr key={client.id}>
                      <td>
                        <div className="bf-cell">
                          {avatar(client)}
                          <span className="bf-cell__text">
                            <span className="bf-name">{client.name}</span>
                            {(client.email || client.tags.length > 0) && (
                              <span className="bf-sub">{client.email || client.tags.join(' · ')}</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td><span className="bf-mono bf-muted" style={{ fontSize: '0.84rem' }}>{client.phone}</span></td>
                      <td>{statusBadge(client.status)}</td>
                      <td>{purchasesCell(client)}</td>
                      <td className="bf-muted">{lastActivity(client)}</td>
                      <td className="bf-right">{clientActions(client)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bf-mlist">
              {pagedClients.map(client => (
                <article key={client.id} className="bf-mcard">
                  {avatar(client)}
                  <div className="bf-mcard__main">
                    <span className="bf-name">{client.name}</span>
                    <span className="bf-sub bf-mono">{client.phone}</span>
                  </div>
                  <div className="bf-mcard__side">{purchasesCell(client)}</div>
                  <div className="bf-mcard__foot">
                    <div className="bf-mcard__meta">
                      {statusBadge(client.status)}
                      <span>{lastActivity(client)}</span>
                    </div>
                    {clientActions(client)}
                  </div>
                </article>
              ))}
            </div>

            <div className="bf-pager">
              <span className="bf-pager__info">
                <strong>{(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, filteredClients.length)}</strong>
                {fr ? ' sur ' : ' of '}<strong>{formatNumber(filteredClients.length)}</strong> {fr ? 'clients' : 'customers'}
              </span>
              <div className="bf-pager__controls">
                <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }} aria-label={fr ? 'Clients par page' : 'Customers per page'}>
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <button type="button" className="bf-icon-btn" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)} aria-label={fr ? 'Page précédente' : 'Previous page'}>
                  <ChevronLeft size={16} />
                </button>
                <span className="bf-pager__page">{safePage} / {totalPages}</span>
                <button type="button" className="bf-icon-btn" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)} aria-label={fr ? 'Page suivante' : 'Next page'}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="+ Client">
        <form onSubmit={handleAdd} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nom du client</label>
            <input type="text" className="input" required value={addForm.name}
              onChange={e => setAddForm({ ...addForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input type="tel" className="input" required value={addForm.phone}
              onChange={e => setAddForm({ ...addForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="input" value={addForm.email}
              onChange={e => setAddForm({ ...addForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Type de client</label>
            <select className="input" value={addForm.status}
              onChange={e => setAddForm({ ...addForm, status: e.target.value as ClientStatus })}>
              <option value="nouveau">Nouveau</option>
              <option value="actif">Régulier</option>
              <option value="vip">VIP</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="input" rows={2} value={addForm.notes}
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
                    <DebtCard key={debt.id} debt={debt} language={language} onPay={setPayDebt} />
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setViewClient(null); setClientDebts([]); }}>{language === 'fr' ? 'Fermer' : 'Close'}</button>
              {canEdit && (
                <button className="btn btn-primary" onClick={() => { setViewClient(null); setClientDebts([]); openEdit(viewClient); }}>
                  <Pencil size={14} /> {language === 'fr' ? 'Modifier' : 'Edit'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Règlement de dette */}
      <DebtPaymentModal
        debt={payDebt}
        isOpen={!!payDebt}
        onClose={() => setPayDebt(null)}
        onSuccess={() => {
          setPayDebt(null);
          if (viewClient) fetchClientDebts(viewClient.id);
        }}
        language={language}
      />

      <Modal isOpen={!!editClient} onClose={() => setEditClient(null)} title="Modifier">
        <form onSubmit={handleEdit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nom du client</label>
            <input type="text" className="input" required value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input type="tel" className="input" required value={editForm.phone}
              onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="input" value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Type de client</label>
            <select className="input" value={editForm.status}
              onChange={e => setEditForm({ ...editForm, status: e.target.value as ClientStatus })}>
              <option value="nouveau">Nouveau</option>
              <option value="actif">Régulier</option>
              <option value="vip">VIP</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="input" rows={2} value={editForm.notes}
              onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditClient(null)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={isEditing}>
              {isEditing ? 'Sauvegarde...' : 'Sauver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation de suppression animée */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        fr={fr}
        title={fr ? 'Supprimer ce client ?' : 'Delete this customer?'}
        name={deleteTarget?.name}
        initials={deleteTarget ? initials(deleteTarget.name) : undefined}
        message={fr ? "Sa fiche client sera retirée de votre liste." : "Their customer record will be removed from your list."}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <style jsx>{`
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
