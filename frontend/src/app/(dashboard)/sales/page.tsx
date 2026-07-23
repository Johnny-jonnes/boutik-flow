'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Eye, Printer, RotateCcw, Search, Calendar, CreditCard as CardIcon } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import type { Order, Client, Product } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { useLanguage } from '@/context/LanguageContext';

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

function formatDate(isoString: string, language: string) {
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString));
}

export default function SalesHistoryPage() {
  const { t, language } = useLanguage();
  const [sales, setSales] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Data
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Modals state
  const [selectedSale, setSelectedSale] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [shopName, setShopName] = useState('BoutikFlow');
  const [sellerName, setSellerName] = useState('');

  useEffect(() => {
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenant_name) setShopName(payload.tenant_name);
        if (payload.email) {
          const namePart = payload.email.split('@')[0];
          setSellerName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        } else if (payload.sub) {
          const namePart = payload.sub.split('@')[0];
          setSellerName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnItems, setReturnItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // Filter States
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const fetchSales = async () => {
    try {
      setIsLoading(true);
      const response = await api.getOrders(1); // Fetch orders page 1 (we can pagination in client-side)
      // Filter for delivered orders (completed sales)
      const completedSales = response.items.filter(o => o.status === 'delivered');
      setSales(completedSales);
    } catch (error) {
      toast.error(language === 'fr' ? "Erreur de récupération de l'historique" : "Error fetching history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    api.getClients(1, 100).then(res => setClients(res.items)).catch(() => {});
    api.getProducts(1, 100).then(res => setProducts(res.items)).catch(() => {});
  }, []);

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) return client.name;
    return language === 'fr' ? 'Passant' : 'Walk-in';
  };

  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || `Produit...`;

  const getPaymentMethod = (notes: string | null) => {
    if (!notes) return 'cash';
    const match = notes.match(/Mode de paiement:\s*(\w+)/);
    return match ? match[1] : 'cash';
  };

  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: language === 'fr' ? 'Espèces' : 'Cash',
      orange_money: 'Orange Money',
      card: language === 'fr' ? 'Carte' : 'Card',
      transfer: language === 'fr' ? 'Virement' : 'Transfer',
    };
    return labels[method] || method;
  };

  // Export CSV
  const handleExport = () => {
    if (filteredSales.length === 0) {
      toast.error(language === 'fr' ? 'Aucune vente à exporter' : 'No sales to export');
      return;
    }
    const headers = [
      language === 'fr' ? 'ID Vente' : 'Sale ID',
      language === 'fr' ? 'Client' : 'Customer',
      language === 'fr' ? 'Montant' : 'Amount',
      language === 'fr' ? 'Articles' : 'Items',
      language === 'fr' ? 'Paiement' : 'Payment',
      language === 'fr' ? 'Notes' : 'Notes',
      'Date'
    ];
    const rows = filteredSales.map(o => [
      `BF-${o.id.slice(0, 8).toUpperCase()}`,
      getClientName(o.client_id),
      String(o.total || 0),
      String(o.items?.length || 0),
      getPaymentLabel(getPaymentMethod(o.notes)),
      o.notes || '',
      new Date(o.created_at).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ventes_caisse_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Return modal handler
  const openReturnModal = (order: Order) => {
    setReturnOrder(order);
    setReturnReason('');
    setRestockInventory(true);
    setReturnItems(order.items?.map(item => ({ product_id: item.product_id, quantity: 0 })) || []);
  };

  const handleSubmitReturn = async () => {
    if (!returnOrder) return;
    const itemsToReturn = returnItems.filter(ri => ri.quantity > 0);
    if (itemsToReturn.length === 0) {
      toast.error(language === 'fr' ? 'Sélectionnez au moins un produit à retourner' : 'Select at least one product to return');
      return;
    }
    if (!returnReason.trim()) {
      toast.error(language === 'fr' ? 'Indiquez le motif du retour' : 'Please provide a return reason');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      await api.returnOrderItems(returnOrder.id, itemsToReturn, returnReason, restockInventory);
      toast.success(language === 'fr' ? 'Retour validé avec succès' : 'Return processed successfully');
      setReturnOrder(null);
      fetchSales();
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? 'Erreur lors du retour' : 'Error processing return'));
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Filter Logic
  const filteredSales = sales.filter(o => {
    if (filterDateFrom && new Date(o.created_at) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(o.created_at) > new Date(filterDateTo + 'T23:59:59')) return false;
    
    if (filterPayment !== 'all') {
      if (getPaymentMethod(o.notes) !== filterPayment) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientName = getClientName(o.client_id).toLowerCase();
      const receiptNo = `bf-${o.id.slice(0, 8).toLowerCase()}`;
      return receiptNo.includes(q) || clientName.includes(q) || o.id.toLowerCase().includes(q);
    }
    return true;
  });

  const totalFiltered = filteredSales.length;
  const totalPages = Math.ceil(totalFiltered / perPage);
  const paginatedSales = filteredSales.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('sales.title') || 'Historique des Ventes'}</h1>
          <p className="page-subtitle">{t('sales.subtitle') || 'Consultez et gérez les ventes de votre caisse rapide.'}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={handleExport}>
            <Download size={16} /> {language === 'fr' ? 'Exporter CSV' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar card">
        <div className="filters-row">
          <div className="filter-group">
            <Calendar size={14} className="filter-icon" />
            <input 
              type="date" 
              className="input" 
              value={filterDateFrom} 
              onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1); }} 
            />
            <span className="filter-separator">{language === 'fr' ? 'à' : 'to'}</span>
            <input 
              type="date" 
              className="input" 
              value={filterDateTo} 
              onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1); }} 
            />
          </div>

          <div className="filter-group">
            <CardIcon size={14} className="filter-icon" />
            <select 
              className="input" 
              value={filterPayment} 
              onChange={e => { setFilterPayment(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">{language === 'fr' ? 'Tous les paiements' : 'All payments'}</option>
              <option value="cash">{language === 'fr' ? 'Espèces' : 'Cash'}</option>
              <option value="orange_money">Orange Money</option>
              <option value="card">{language === 'fr' ? 'Carte bancaire' : 'Credit Card'}</option>
              <option value="transfer">{language === 'fr' ? 'Virement' : 'Transfer'}</option>
            </select>
          </div>

          <div className="search-group">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              className="input" 
              placeholder={t('sales.search') || 'Rechercher une vente...'} 
              value={searchQuery} 
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
            />
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="table-container card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
        ) : paginatedSales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {t('sales.no_sales') || 'Aucune vente trouvée.'}
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('sales.receipt_no') || 'N° Reçu'}</th>
                  <th>Client</th>
                  <th>Date / Heure</th>
                  <th className="text-right">Montant</th>
                  <th className="text-center">{t('sales.items_count') || 'Articles'}</th>
                  <th>{t('sales.payment_method') || 'Paiement'}</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.map(order => {
                  const paymentMethod = getPaymentMethod(order.notes);
                  return (
                    <tr key={order.id}>
                      <td>
                        <span className="receipt-badge" onClick={() => setSelectedSale(order)}>
                          BF-{order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="client-name">{getClientName(order.client_id)}</span>
                      </td>
                      <td className="text-muted">{formatDate(order.created_at, language)}</td>
                      <td className="text-right font-bold text-emerald">
                        {formatGNF(Number(order.total) || 0)}
                      </td>
                      <td className="text-center font-semibold">
                        {order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0}
                      </td>
                      <td>
                        <span className={`payment-pill ${paymentMethod}`}>
                          {getPaymentLabel(paymentMethod)}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="actions-flex">
                          <button 
                            className="btn btn-ghost btn-icon" 
                            title={language === 'fr' ? 'Voir détails' : 'View details'} 
                            onClick={() => setSelectedSale(order)}
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            className="btn btn-ghost btn-icon" 
                            title={t('sales.view_receipt') || 'Imprimer reçu'} 
                            onClick={() => setReceiptOrder(order)}
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            className="btn btn-ghost btn-icon btn-danger-icon" 
                            title={t('sales.refund') || 'Retourner'} 
                            onClick={() => openReturnModal(order)}
                          >
                            <RotateCcw size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {language === 'fr' ? `Affichage de ${(currentPage - 1) * perPage + 1} à ${Math.min(currentPage * perPage, totalFiltered)} sur ${totalFiltered} ventes` : `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(currentPage * perPage, totalFiltered)} of ${totalFiltered} sales`}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-ghost btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                    {language === 'fr' ? 'Précédent' : 'Previous'}
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                    {language === 'fr' ? 'Suivant' : 'Next'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Detail Sale */}
      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title={language === 'fr' ? 'Détails de la Vente' : 'Sale Details'}>
        {selectedSale && (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">{language === 'fr' ? 'N° Vente' : 'Sale ID'}</span><span className="detail-value">BF-{selectedSale.id.slice(0, 8).toUpperCase()}</span></div>
            <div className="detail-row"><span className="detail-label">Client</span><span className="detail-value">{getClientName(selectedSale.client_id)}</span></div>
            <div className="detail-row"><span className="detail-label">{language === 'fr' ? 'Mode de Paiement' : 'Payment Method'}</span><span className="detail-value">{getPaymentLabel(getPaymentMethod(selectedSale.notes))}</span></div>
            <div className="detail-row"><span className="detail-label">Total</span><span className="detail-value order-amount text-emerald">{formatGNF(Number(selectedSale.total) || 0)}</span></div>
            <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{formatDate(selectedSale.created_at, language)}</span></div>
            
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{language === 'fr' ? 'Articles achetés' : 'Purchased items'}</div>
              {selectedSale.items?.map((item, i) => (
                <div key={i} className="detail-row" style={{ paddingLeft: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="detail-label">{item.quantity} × {getProductName(item.product_id)}</span>
                  <span className="detail-value">{formatGNF(Number(item.unit_price) * item.quantity)}</span>
                </div>
              ))}
            </div>

            {selectedSale.notes && (
              <div className="detail-row" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                <span className="detail-label">Notes</span>
                <span className="detail-value">{selectedSale.notes}</span>
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setSelectedSale(null)}>{language === 'fr' ? 'Fermer' : 'Close'}</button>
              <button className="btn btn-primary" onClick={() => { const s = selectedSale; setSelectedSale(null); setReceiptOrder(s); }}>
                <Printer size={14} /> {language === 'fr' ? 'Reçu de caisse' : 'Print receipt'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Reçu */}
      {receiptOrder && (
        <ReceiptModal
          isOpen={!!receiptOrder}
          onClose={() => setReceiptOrder(null)}
          order={receiptOrder}
          shopName={shopName}
          sellerName={sellerName}
        />
      )}

      {/* Modal Retour Produit */}
      {returnOrder && (
        <Modal isOpen={!!returnOrder} onClose={() => setReturnOrder(null)} title={language === 'fr' ? `Retour Produit - Vente #${returnOrder.id.slice(0, 8).toUpperCase()}` : `Product Return - Sale #${returnOrder.id.slice(0, 8).toUpperCase()}`}>
          <div className="modal-form">
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {language === 'fr' ? 'Sélectionnez les articles à retourner et indiquez les quantités.' : 'Select the items to return and specify the quantities.'}
            </p>
            {returnOrder.items?.map((item, idx) => {
              const prodName = getProductName(item.product_id);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{prodName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'fr' ? `Acheté : ${item.quantity} × ${formatGNF(item.unit_price)}` : `Bought: ${item.quantity} × ${formatGNF(item.unit_price)}`}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'fr' ? 'Retour :' : 'Return:'}</label>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={returnItems[idx]?.quantity || 0}
                      onChange={e => {
                        const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                        setReturnItems(prev => prev.map((ri, i) => i === idx ? { ...ri, quantity: val } : ri));
                      }}
                      className="input"
                      style={{ width: '70px', textAlign: 'center' }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">{language === 'fr' ? 'Motif du retour *' : 'Return Reason *'}</label>
              <textarea className="input" rows={2} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder={language === 'fr' ? "Ex: Erreur de commande, produit défectueux..." : "Ex: Order error, defective product..."} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input type="checkbox" id="restock-check-sales" checked={restockInventory} onChange={e => setRestockInventory(e.target.checked)} />
              <label htmlFor="restock-check-sales" style={{ fontSize: '0.85rem' }}>{language === 'fr' ? 'Réintégrer les articles en stock' : 'Restock returned items'}</label>
            </div>
            {returnItems.filter(i => i.quantity > 0).length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{language === 'fr' ? 'Récapitulatif du remboursement' : 'Refund summary'}</div>
                {returnItems.filter(i => i.quantity > 0).map((ri, idx) => {
                  const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                  if (!origItem) return null;
                  return <div key={idx} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ri.quantity} × {getProductName(ri.product_id)} = {formatGNF(ri.quantity * origItem.unit_price)}</div>;
                })}
                <div style={{ fontWeight: 700, marginTop: '0.5rem', color: 'var(--color-brand-500)' }}>
                  {language === 'fr' ? 'Total remboursement : ' : 'Total refund: '} {formatGNF(returnItems.reduce((acc, ri) => {
                    const origItem = returnOrder.items?.find(oi => oi.product_id === ri.product_id);
                    return acc + (origItem ? ri.quantity * origItem.unit_price : 0);
                  }, 0))}
                </div>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setReturnOrder(null)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitReturn} disabled={isSubmittingReturn}>
                {isSubmittingReturn ? (language === 'fr' ? 'Traitement...' : 'Processing...') : (language === 'fr' ? 'Valider le retour' : 'Submit Return')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin: 0; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem; }
        .header-actions { display: flex; gap: 0.75rem; }
        
        .filters-bar { padding: 1.25rem; }
        .filters-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; }
        .filter-group { display: flex; align-items: center; gap: 0.5rem; background: var(--surface-0); border: 1px solid var(--border-subtle); padding: 0.25rem 0.75rem; border-radius: 8px; }
        .filter-icon { color: var(--text-muted); }
        .filter-separator { color: var(--text-muted); font-size: 0.85rem; }
        .filter-group .input { border: none; padding: 0.25rem 0; background: transparent; color: var(--text-primary); outline: none; font-size: 0.9rem; }
        
        .search-group { display: flex; align-items: center; gap: 0.5rem; background: var(--surface-0); border: 1px solid var(--border-subtle); padding: 0.25rem 0.75rem; border-radius: 8px; flex: 1; min-width: 240px; }
        .search-icon { color: var(--text-muted); }
        .search-group .input { border: none; padding: 0.25rem 0; background: transparent; color: var(--text-primary); outline: none; width: 100%; font-size: 0.9rem; }

        .receipt-badge { background: rgba(59, 130, 246, 0.1); color: #3b82f6; font-family: monospace; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .receipt-badge:hover { background: rgba(59, 130, 246, 0.2); }
        
        .client-name { font-weight: 500; color: var(--text-primary); }
        .text-emerald { color: #10b981 !important; }
        .font-bold { font-weight: 700; }
        
        .payment-pill { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 999px; text-transform: uppercase; }
        .payment-pill.cash { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .payment-pill.orange_money { background: rgba(249, 115, 22, 0.15); color: #f97316; }
        .payment-pill.card { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .payment-pill.transfer { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
        
        .actions-flex { display: flex; justify-content: center; gap: 0.5rem; }
        
        /* Modal details styling */
        .detail-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px dashed var(--border-subtle); }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: var(--text-muted); font-size: 0.9rem; }
        .detail-value { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
        .order-amount { font-size: 1.1rem; font-weight: 700; }

        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
        .form-label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
      `}</style>
    </div>
  );
}
