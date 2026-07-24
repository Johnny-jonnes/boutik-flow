'use client';

import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  Smartphone, ShoppingCart, ArrowUpRight, CheckCircle, X,
  Zap, Package, AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { Modal } from '@/components/ui/Modal';
import { Product } from '@/types';
import { SoundEffects, triggerHaptic } from '@/lib/audio';

interface CartItem extends Product { cartQuantity: number; }

const fmt = (n: number) => n.toLocaleString('fr-FR') + ' GNF';

export default function POSPage() {
  const { language, t } = useLanguage();
  const [products, setProducts]         = useState<Product[]>([]);
  const [clients, setClients]           = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery]   = useState('');
  const [discount, setDiscount]         = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'orange_money' | 'transfer'>('cash');
  const [loading, setLoading]           = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successAnim, setSuccessAnim]   = useState(false);

  // Dette
  const [isDebt, setIsDebt]               = useState(false);
  const [debtDescription, setDebtDescription] = useState('');
  const [debtDueDate, setDebtDueDate]     = useState('');

  // Reçu
  const [receiptData, setReceiptData]               = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [shopName, setShopName]   = useState('BoutikFlow');
  const [sellerName, setSellerName] = useState('');

  // Sortie caisse
  const [isExpenseModalOpen, setIsExpenseModalOpen]       = useState(false);
  const [expenseAmount, setExpenseAmount]                 = useState('');
  const [expenseCategory, setExpenseCategory]             = useState('other_expense');
  const [expenseDescription, setExpenseDescription]       = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense]     = useState(false);

  // ─── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadProducts();
    loadClients();
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const p = JSON.parse(atob(token.split('.')[1]));
        if (p.tenant_name) setShopName(p.tenant_name);
        const raw = p.email || p.sub || '';
        if (raw) { const n = raw.split('@')[0]; setSellerName(n.charAt(0).toUpperCase() + n.slice(1)); }
      }
    } catch {}
  }, []);

  const loadClients = async () => {
    const cached = (() => { try { const c = localStorage.getItem('offline_clients'); if (c) { const parsed = JSON.parse(c); if (Array.isArray(parsed) && parsed.length > 0) return parsed; } } catch {} return []; })();
    if (cached.length > 0) setClients(cached);
    try { const r = await api.getClients(1, 200); const items = r.items || []; if (items.length > 0) { setClients(items); try { localStorage.setItem('offline_clients', JSON.stringify(items)); } catch {} } } catch {}
  };

  const loadProducts = async () => {
    // 1. Instant load from cache (zero latency - never shows error)
    const cached = (() => {
      try {
        const p = localStorage.getItem('offline_products');
        if (p) { const parsed = JSON.parse(p); if (Array.isArray(parsed) && parsed.length > 0) return parsed; }
      } catch {}
      return [];
    })();
    if (cached.length > 0) { setProducts(cached); setLoading(false); } else { setLoading(true); }
    // 2. Silent background refresh from server
    try {
      const data = await api.getProducts(1, 200);
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      if (items.length > 0) {
        setProducts(items);
        try { localStorage.setItem('offline_products', JSON.stringify(items)); } catch {}
      }
    } catch { /* silent - cache already loaded */ } finally { setLoading(false); }
  };

  // ─── Filtrage ────────────────────────────────────────────────────
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ─── Panier ──────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      SoundEffects.playError();
      triggerHaptic([100, 50, 100]);
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        if (ex.cartQuantity >= product.stock) {
          SoundEffects.playError();
          triggerHaptic([100, 50, 100]);
          toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock');
          return prev;
        }
        SoundEffects.playClick();
        triggerHaptic(15);
        return prev.map(i => i.id === product.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
      }
      SoundEffects.playClick();
      triggerHaptic(15);
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const q = i.cartQuantity + delta;
      if (q <= 0) {
        SoundEffects.playClick();
        triggerHaptic(10);
        return { ...i, cartQuantity: 1 };
      }
      if (q > i.stock) {
        SoundEffects.playError();
        triggerHaptic([100, 50, 100]);
        toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock');
        return i;
      }
      SoundEffects.playClick();
      triggerHaptic(10);
      return { ...i, cartQuantity: q };
    }));
  };

  const setDirectQty = (id: string, qty: number) =>
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (qty <= 0) return { ...i, cartQuantity: 1 };
      if (qty > i.stock) return { ...i, cartQuantity: i.stock };
      return { ...i, cartQuantity: qty };
    }));

  const removeFromCart = (id: string) => {
    SoundEffects.playClick();
    triggerHaptic(10);
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const subtotal   = cart.reduce((s, i) => s + i.price * i.cartQuantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.cartQuantity, 0);
  const total      = Math.max(0, subtotal - discount);

  // ─── Validation vente ────────────────────────────────────────────
  const handleValidateSale = async () => {
    if (cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const payload: any = {
        status: isDebt ? 'pending' : 'delivered',
        items: cart.map(i => ({ product_id: i.id, quantity: i.cartQuantity })),
        notes: isDebt
          ? `[DETTE] Montant: ${total} GNF | Paiement: ${paymentMethod} | Remise: ${discount} GNF`
          : `Paiement: ${paymentMethod} | Remise: ${discount} GNF`,
        is_debt: isDebt,
      };
      if (selectedClientId) payload.client_id = selectedClientId;

      const order = await api.createOrder(payload);

      // Enregistrement de la dette — ne compte PAS comme encaissement
      if (isDebt && selectedClientId) {
        try {
          await api.createDebt({
            client_id: selectedClientId,
            order_id: order.id,
            original_amount: total,
            description: debtDescription.trim() || (language === 'fr' ? 'Achat à crédit' : 'Credit purchase'),
            due_date: debtDueDate || undefined,
          });
          toast.success(language === 'fr' ? '📋 Dette enregistrée — sera comptabilisée à l\'encaissement' : '📋 Debt recorded — will be counted on payment');
        } catch { toast.error(language === 'fr' ? 'Erreur enregistrement dette' : 'Error recording debt'); }
      } else {
        // Vente normale → transaction finance positive
        try {
          await api.createFinanceTransaction({
            type: 'income',
            category: 'sale',
            amount: total,
            description: `Vente caisse — ${cart.length} article(s)`,
            payment_method: paymentMethod,
            reference: order.id,
          });
        } catch { /* Finance non bloquante */ }
      }

      // Mise à jour stock local
      setProducts(prev => prev.map(p => {
        const ci = cart.find(c => c.id === p.id);
        return ci ? { ...p, stock: Math.max(0, p.stock - ci.cartQuantity) } : p;
      }));

      // Animation succès
      SoundEffects.playSuccess();
      triggerHaptic([30, 50, 30]);
      setSuccessAnim(true);
      setTimeout(() => setSuccessAnim(false), 1400);
      if (!isDebt) toast.success(language === 'fr' ? '✓ Vente encaissée !' : '✓ Sale recorded!');

      const client = clients.find(c => c.id === selectedClientId);
      setReceiptData({
        id: order.id, total,
        notes: payload.notes,
        items: cart.map(i => ({ product_id: i.id, quantity: i.cartQuantity, unit_price: i.price, product: { name: i.name } })),
        client: client ? { name: client.name, phone: client.phone || '' } : { name: language === 'fr' ? 'Client passant' : 'Walk-in', phone: '' },
        created_at: order.created_at || new Date().toISOString(),
        status: isDebt ? 'pending' : 'confirmed',
      });
      setIsReceiptModalOpen(true);

      // Reset
      setCart([]); setDiscount(0); setSelectedClientId('');
      setIsDebt(false); setDebtDescription(''); setDebtDueDate('');
    } catch (err: any) {
      SoundEffects.playError();
      triggerHaptic([100, 50, 100]);
      toast.error(err?.message || (language === 'fr' ? 'Erreur de validation' : 'Validation error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) { toast.error(language === 'fr' ? 'Montant invalide' : 'Invalid amount'); return; }
    if (!expenseDescription.trim()) { toast.error(language === 'fr' ? 'Motif obligatoire' : 'Description required'); return; }
    setIsSubmittingExpense(true);
    try {
      await api.createFinanceTransaction({
        type: 'expense', category: expenseCategory as any,
        amount: Number(expenseAmount),
        description: expenseDescription.trim(),
        payment_method: 'cash',
        reference: language === 'fr' ? 'Sortie Caisse' : 'POS Outflow',
      });
      toast.success(language === 'fr' ? 'Sortie enregistrée ✓' : 'Outflow recorded ✓');
      setIsExpenseModalOpen(false); setExpenseAmount(''); setExpenseDescription(''); setExpenseCategory('other_expense');
    } catch (err: any) {
      toast.error(err?.message || (language === 'fr' ? 'Erreur' : 'Error'));
    } finally { setIsSubmittingExpense(false); }
  };

  // ─── RENDER ─────────────────────────────────────────────────────
  return (
    <div className="pos-page-container">
      {/* ══ TOP BAR ══════════════════════════════════════════════════ */}
      <div className="p-topbar">
        <div>
          <h1 className="p-title">
            <Zap size={20} style={{ display:'inline', verticalAlign:'middle', marginRight:'0.5rem', color:'var(--color-accent-500)' }}/>
            {language === 'fr' ? 'Caisse / Vente' : 'Checkout / Sales'}
          </h1>
          <p className="p-subtitle">{language === 'fr' ? 'Enregistrez vos ventes.' : 'Record your sales.'}</p>
        </div>
        <button className="btn btn-ghost p-expense-btn" onClick={() => setIsExpenseModalOpen(true)}>
          <ArrowUpRight size={15}/>
          {language === 'fr' ? 'Sortie de caisse' : 'Outflow'}
        </button>
      </div>

      {/* ══ GRID ════════════════════════════════════════════════════ */}
      <div className="p-grid">

        {/* ── Zone produits ──────────────────────────────────────── */}
        <section className="p-products-zone">

          {/* Barre de recherche */}
          <div className="p-search-bar">
            <Search size={16} className="p-search-icon"/>
            <input
              className="p-search-input"
              type="text"
              placeholder={language === 'fr' ? 'Rechercher…' : 'Search…'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery && (
              <button className="p-search-clear" onClick={() => setSearchQuery('')}><X size={14}/></button>
            )}
            <span className="p-products-count">
              {filteredProducts.length}
            </span>
          </div>

          {/* Grille */}
          <div className="p-products-grid">
            {loading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton p-card-skeleton" style={{ animationDelay: `${i * 40}ms` }}/>
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="p-empty">
                <Package size={36} opacity={0.2}/>
                <span>{searchQuery ? (language === 'fr' ? 'Aucun résultat' : 'No results') : (language === 'fr' ? 'Aucun produit' : 'No products')}</span>
                {!searchQuery && (
                  <button className="btn btn-ghost btn--sm" onClick={loadProducts} style={{ marginTop: '0.5rem' }}>
                    ↻ {language === 'fr' ? 'Recharger' : 'Reload'}
                  </button>
                )}
              </div>
            ) : (
              filteredProducts.map((product, idx) => {
                const disabled = product.stock <= 0;
                const inCart   = cart.find(i => i.id === product.id);
                return (
                  <button
                    key={product.id}
                    className={`p-card ${disabled ? 'p-card--out' : ''} ${inCart ? 'p-card--in-cart' : ''}`}
                    onClick={() => !disabled && addToCart(product)}
                    disabled={disabled}
                    style={{ animationDelay: `${idx * 20}ms` }}
                    title={product.name}
                  >
                    {inCart && <span className="p-qty-badge">{inCart.cartQuantity}</span>}
                    
                    <div className="p-card-image-box">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="p-card-img" />
                      ) : (
                        <div className="p-card-img-placeholder">
                          <span className="p-card-emoji"><Package size={24} style={{ color: 'var(--color-brand-400)' }} /></span>
                        </div>
                      )}
                      <span className={`p-card-stock ${disabled ? 'out' : product.stock <= 5 ? 'low' : ''}`}>
                        {disabled ? 'Rupture' : `${product.stock} dispo.`}
                      </span>
                    </div>

                    <div className="p-card-info">
                      <span className="p-card-name">{product.name}</span>
                      <span className="p-card-price">{product.price.toLocaleString('fr-FR')}<small> GNF</small></span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ── Panier ──────────────────────────────────────────────── */}
        <aside className="p-cart">

          {/* Header */}
          <div className="p-cart-header">
            <span className="p-cart-title">
              <ShoppingCart size={16} style={{ opacity: 0.7 }}/>
              {language === 'fr' ? 'Panier' : 'Cart'}
            </span>
            {totalItems > 0 && <span className="p-cart-badge">{totalItems}</span>}
            {cart.length > 0 && (
              <button className="p-cart-clear" onClick={() => { setCart([]); setDiscount(0); }} title={language === 'fr' ? 'Vider' : 'Clear'}>
                <X size={13}/>
              </button>
            )}
          </div>

          {/* Client */}
          <div className="p-client-box">
            <select
              className="p-select"
              value={selectedClientId}
              onChange={e => {
                setSelectedClientId(e.target.value);
                if (!e.target.value) { setIsDebt(false); setDebtDescription(''); setDebtDueDate(''); }
              }}
            >
              <option value="">{language === 'fr' ? 'Client passant' : 'Walk-in customer'}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Articles — zone scrollable */}
          <div className="p-items">
            {cart.length === 0 ? (
              <div className="p-cart-empty">
                <ShoppingCart size={40} opacity={0.15}/>
                <span>{language === 'fr' ? 'Appuyez sur un produit' : 'Tap a product'}</span>
              </div>
            ) : cart.map(item => (
              <div key={item.id} className="p-item">
                <div style={{ background: 'var(--surface-2)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}><Package size={14} style={{ color: 'var(--color-brand-400)' }} /></div>
                <div className="p-item-info">
                  <span className="p-item-name">{item.name}</span>
                  <span className="p-item-total">{fmt(item.price * item.cartQuantity)}</span>
                </div>
                <div className="p-item-ctrl">
                  <button className="p-qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={12}/></button>
                  <input
                    className="p-qty-input"
                    type="number" value={item.cartQuantity} min="1" max={item.stock}
                    onChange={e => setDirectQty(item.id, parseInt(e.target.value) || 1)}
                  />
                  <button className="p-qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={12}/></button>
                  <button className="p-remove-btn" onClick={() => removeFromCart(item.id)}><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary + Validation */}
          <div className="p-summary">
            {/* Totaux */}
            <div className="p-row">
              <span>{language === 'fr' ? 'Sous-total' : 'Subtotal'}</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="p-row">
              <span>{language === 'fr' ? 'Remise' : 'Discount'}</span>
              <input
                className="p-discount"
                type="number" min="0" max={subtotal}
                value={discount || ''} placeholder="0"
                onChange={e => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="p-row p-total">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>

            {/* Paiement */}
            <div className="p-payment">
              {([
                { v: 'cash',         label: language === 'fr' ? 'Espèces' : 'Cash',  Icon: Banknote },
                { v: 'orange_money', label: 'Orange M.',                             Icon: Smartphone },
                { v: 'card',         label: language === 'fr' ? 'Carte' : 'Card',    Icon: CreditCard },
              ] as const).map(({ v, label, Icon }) => (
                <label key={v} className={`p-pay-btn ${paymentMethod === v ? 'active' : ''}`}>
                  <input type="radio" name="pm" value={v} checked={paymentMethod === v} onChange={() => setPaymentMethod(v)} style={{ display:'none' }}/>
                  <Icon size={16}/>
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {/* Dette — visible uniquement si client sélectionné */}
            {selectedClientId && (
              <div className="p-debt-box">
                <label className="p-debt-label">
                  <input
                    type="checkbox" checked={isDebt}
                    onChange={e => setIsDebt(e.target.checked)}
                    style={{ accentColor: 'var(--color-error)', width:15, height:15, cursor:'pointer', flexShrink:0 }}
                  />
                  <span>📋 {language === 'fr' ? 'Vente à crédit' : 'Credit sale'}</span>
                </label>
                {isDebt && (
                  <div className="p-debt-fields">
                    <input className="p-debt-input" type="text" placeholder={language === 'fr' ? 'Motif (optionnel)' : 'Reason'} value={debtDescription} onChange={e => setDebtDescription(e.target.value)}/>
                    <input className="p-debt-input" type="date" value={debtDueDate} onChange={e => setDebtDueDate(e.target.value)}/>
                  </div>
                )}
              </div>
            )}

            {/* BOUTON VALIDER */}
            <button
              className={`p-validate ${successAnim ? 'success' : ''} ${isDebt ? 'debt' : ''}`}
              disabled={cart.length === 0 || isProcessing}
              onClick={handleValidateSale}
            >
              {isProcessing ? (
                <><span className="spinner spinner--sm"/> {language === 'fr' ? 'En cours…' : 'Processing…'}</>
              ) : successAnim ? (
                <><CheckCircle size={20}/> {language === 'fr' ? 'Validé !' : 'Done!'}</>
              ) : (
                <>
                  <span style={{ flex: 1 }}>
                    {isDebt ? `📋 ${language === 'fr' ? 'Crédit' : 'Credit'}` : `✓ ${language === 'fr' ? 'Encaisser' : 'Collect'}`}
                  </span>
                  {cart.length > 0 && <span className="p-validate-amount">{fmt(total)}</span>}
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* ── Reçu ─────────────────────────────────────────────────── */}
      {receiptData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          order={receiptData}
          shopName={shopName}
          sellerName={sellerName}
        />
      )}

      {/* ── Modal sortie caisse ──────────────────────────────────── */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={language === 'fr' ? 'Sortie de Caisse' : 'Cash Outflow'}>
        <form onSubmit={handleCreateExpense} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          <div className="input-group">
            <label className="form-label">{language === 'fr' ? 'Catégorie *' : 'Category *'}</label>
            <select className="input" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} required>
              <option value="supplier_purchase">{language === 'fr' ? 'Achat fournisseur' : 'Supplier purchase'}</option>
              <option value="salary">{language === 'fr' ? 'Salaire équipe' : 'Staff salary'}</option>
              <option value="rent">{language === 'fr' ? 'Loyer & charges' : 'Rent & charges'}</option>
              <option value="utilities">{language === 'fr' ? 'Factures' : 'Bills'}</option>
              <option value="refund">{language === 'fr' ? 'Remboursement client' : 'Customer refund'}</option>
              <option value="other_expense">{language === 'fr' ? 'Autre dépense' : 'Other expense'}</option>
            </select>
          </div>
          <div className="input-group">
            <label className="form-label">{language === 'fr' ? 'Montant (GNF) *' : 'Amount (GNF) *'}</label>
            <input type="number" min={1} className="input" placeholder="50 000" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} required/>
          </div>
          <div className="input-group">
            <label className="form-label">{language === 'fr' ? 'Motif *' : 'Reason *'}</label>
            <textarea className="input" rows={3} placeholder={language === 'fr' ? 'Ex: Paiement livreur…' : 'Ex: Delivery payment…'} value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} required/>
          </div>
          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsExpenseModalOpen(false)} disabled={isSubmittingExpense}>{language === 'fr' ? 'Annuler' : 'Cancel'}</button>
            <button type="submit" className="btn btn-danger" disabled={isSubmittingExpense}>{isSubmittingExpense ? '…' : (language === 'fr' ? 'Valider la sortie' : 'Record')}</button>
          </div>
        </form>
      </Modal>

      {/* ══ STYLES SCOPED ═══════════════════════════════════════════ */}
      <style jsx>{`
        /* ─── Layout racine ─────────────────────────────────────── */
        .pos-page-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 8rem);
          max-height: calc(100vh - 8rem);
          overflow: hidden;
          padding-bottom: 1rem;
        }

        .p-topbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; margin-bottom: 1rem; flex-shrink: 0;
        }
        .p-title {
          font-family: var(--font-display);
          font-size: 1.625rem; font-weight: 800;
          color: var(--text-primary); letter-spacing: -0.03em;
        }
        .p-subtitle { font-size: 0.82rem; color: var(--text-muted); margin-top: 2px; }
        .p-expense-btn {
          color: var(--color-error); border-color: rgba(244,63,94,0.2);
          font-size: 0.8rem; min-height: 38px;
        }
        .p-expense-btn:hover { background: rgba(244,63,94,0.08); border-color: rgba(244,63,94,0.3); }

        /* ─── Grid ──────────────────────────────────────────────── */
        .p-grid {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 0;
          flex: 1;
          min-height: 0;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          box-shadow: var(--shadow-lg);
        }

        @media (max-width: 1100px) { .p-grid { grid-template-columns: 1fr 320px; } }
        @media (max-width: 860px) {
          .p-grid {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr auto;
            height: auto;
          }
        }

        /* ─── Zone produits ─────────────────────────────────────── */
        .p-products-zone {
          display: flex; flex-direction: column;
          background: var(--surface-0);
          border-right: 1px solid var(--border-subtle);
          overflow: hidden;
        }

        /* Search */
        .p-search-bar {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.75rem 0.875rem;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--surface-1);
          flex-shrink: 0; position: relative;
        }
        .p-search-icon { color: var(--text-muted); flex-shrink: 0; }
        .p-search-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text-primary); font-size: 0.9rem; font-family: var(--font-sans);
          min-width: 0;
        }
        .p-search-input::placeholder { color: var(--text-muted); }
        .p-search-clear {
          background: none; border: none; color: var(--text-muted);
          cursor: pointer; padding: 2px; display: flex; align-items: center;
          transition: color 120ms; flex-shrink: 0;
        }
        .p-search-clear:hover { color: var(--text-primary); }
        .p-products-count {
          font-size: 0.72rem; font-weight: 700;
          color: var(--text-muted); flex-shrink: 0;
          background: var(--surface-2); padding: 0.15rem 0.5rem;
          border-radius: 99px; border: 1px solid var(--border-subtle);
        }

        /* Grid produits */
        .p-products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 0.5rem;
          padding: 0.75rem;
          overflow-y: auto; flex: 1; align-content: start;
        }

        /* Card produit */
        .p-card {
          background: var(--surface-1);
          border: 1.5px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          cursor: pointer;
          display: flex; flex-direction: column;
          text-align: left;
          position: relative; overflow: hidden;
          transition:
            border-color 100ms ease,
            background 100ms ease,
            transform 180ms var(--ease-spring),
            box-shadow 150ms ease;
          animation: slideUp 0.3s var(--ease-out) both;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          padding: 0;
        }
        .p-card:hover:not(.p-card--out) {
          border-color: rgba(99,102,241,0.5);
          background: var(--surface-2);
          transform: translateY(-3px) scale(1.01);
          box-shadow: var(--shadow-md);
        }
        .p-card:active:not(.p-card--out) {
          transform: scale(0.95);
          box-shadow: none;
          border-color: var(--color-brand-500);
        }
        .p-card--in-cart {
          border-color: var(--color-brand-500);
          background: var(--brand-alpha-08);
        }
        .p-card--out { opacity: 0.45; cursor: not-allowed; }

        .p-card-image-box {
          position: relative;
          width: 100%;
          height: 100px;
          background: var(--surface-2);
          overflow: hidden;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .p-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .p-card:hover .p-card-img {
          transform: scale(1.08);
        }
        .p-card-img-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--surface-2), var(--surface-3));
        }
        .p-card-emoji {
          font-size: 2.2rem;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
          transition: transform 0.3s ease;
        }
        .p-card:hover .p-card-emoji {
          transform: scale(1.15) rotate(5deg);
        }

        .p-card-info {
          padding: 0.6rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }

        .p-card-name {
          font-size: 0.76rem; font-weight: 700; color: var(--text-primary);
          line-height: 1.35; width: 100%;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
          height: 2rem;
        }
        .p-card-price {
          font-size: 0.8rem; font-weight: 800;
          color: var(--color-brand-400); font-family: var(--font-display);
        }
        .p-card-price small { font-size: 0.62rem; opacity: 0.75; font-weight: 600; }
        
        .p-card-stock {
          position: absolute;
          bottom: 6px;
          right: 6px;
          font-size: 0.62rem;
          font-weight: 800;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          backdrop-filter: blur(4px);
        }
        .p-card-stock.low {
          background: rgba(245, 158, 11, 0.8);
        }
        .p-card-stock.out {
          background: rgba(244, 63, 94, 0.8);
        }
        
        .p-qty-badge {
          position: absolute; top: 6px; left: 6px;
          background: var(--color-brand-500); color: #fff;
          font-size: 0.65rem; font-weight: 800;
          min-width: 19px; height: 19px; border-radius: 99px;
          display: flex; align-items: center; justify-content: center;
          animation: bounceIn 0.25s var(--ease-spring);
          padding: 0 4px;
          z-index: 2;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .p-card-skeleton { height: 160px; border-radius: var(--radius-lg); }

        .p-empty {
          grid-column: 1/-1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 4rem 1rem; gap: 0.75rem;
          color: var(--text-muted); font-size: 0.875rem;
        }

        /* ─── Panier ────────────────────────────────────────────── */
        .p-cart {
          background: var(--surface-1);
          display: flex; flex-direction: column;
          height: 100%; overflow: hidden;
        }

        .p-cart-header {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.75rem 0.875rem;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--surface-2); flex-shrink: 0;
        }
        .p-cart-title {
          font-family: var(--font-display); font-size: 0.88rem; font-weight: 800;
          color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;
        }
        .p-cart-badge {
          background: var(--color-brand-500); color: #fff;
          font-size: 0.65rem; font-weight: 800;
          min-width: 20px; height: 20px; border-radius: 99px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 0.3rem;
          animation: scaleIn 0.2s var(--ease-spring);
        }
        .p-cart-clear {
          margin-left: auto; background: none; border: 1px solid var(--border-subtle);
          border-radius: 6px; color: var(--text-muted);
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 120ms ease;
        }
        .p-cart-clear:hover { background: rgba(244,63,94,0.1); color: var(--color-error); border-color: rgba(244,63,94,0.2); }

        /* Client */
        .p-client-box {
          padding: 0.5rem 0.875rem;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--surface-2); flex-shrink: 0;
        }
        .p-select {
          width: 100%; background: var(--surface-1);
          border: 1px solid var(--border-default); border-radius: var(--radius-md);
          color: var(--text-primary); font-size: 0.82rem;
          padding: 0.45rem 0.625rem; outline: none;
          transition: border-color 120ms ease;
          font-family: var(--font-sans);
        }
        .p-select:focus { border-color: var(--color-brand-500); }

        /* Items — scrollable */
        .p-items { flex: 1; overflow-y: auto; padding: 0.25rem 0; }

        .p-cart-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100%; gap: 0.625rem; color: var(--text-muted);
          font-size: 0.82rem; padding: 2rem;
        }

        .p-item {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 0.875rem;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 100ms ease;
          animation: slideUp 0.15s var(--ease-out) both;
        }
        .p-item:hover { background: var(--surface-2); }
        .p-item:last-child { border-bottom: none; }

        .p-item-emoji { font-size: 1.1rem; flex-shrink: 0; width: 26px; text-align: center; }
        .p-item-info { flex: 1; min-width: 0; }
        .p-item-name {
          display: block; font-size: 0.76rem; font-weight: 600;
          color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .p-item-total {
          display: block; font-size: 0.7rem; font-weight: 700;
          color: var(--color-brand-400); font-family: var(--font-display); margin-top: 1px;
        }

        .p-item-ctrl { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
        .p-qty-btn {
          width: 24px; height: 24px; background: var(--surface-2);
          border: 1px solid var(--border-default); border-radius: 6px;
          color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 100ms ease; flex-shrink: 0; padding: 0;
        }
        .p-qty-btn:hover { background: var(--color-brand-500); border-color: var(--color-brand-600); color: #fff; transform: scale(1.1); }
        .p-qty-btn:active { transform: scale(0.88); }

        .p-qty-input {
          width: 30px; height: 24px; background: var(--surface-0);
          border: 1px solid var(--border-default); border-radius: 6px;
          color: var(--text-primary); font-size: 0.72rem; font-weight: 700;
          text-align: center; outline: none; transition: border-color 100ms ease;
        }
        .p-qty-input:focus { border-color: var(--color-brand-500); }
        .p-qty-input::-webkit-outer-spin-button, .p-qty-input::-webkit-inner-spin-button { -webkit-appearance: none; }

        .p-remove-btn {
          width: 24px; height: 24px; background: none; border: none;
          border-radius: 6px; color: var(--text-disabled);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 100ms ease; flex-shrink: 0; padding: 0;
        }
        .p-remove-btn:hover { background: rgba(244,63,94,0.1); color: var(--color-error); transform: scale(1.12); }

        /* Summary */
        .p-summary {
          padding: 0.75rem 0.875rem;
          border-top: 1px solid var(--border-subtle);
          flex-shrink: 0;
          display: flex; flex-direction: column; gap: 0.45rem;
          background: var(--surface-1);
          overflow-y: auto;
          max-height: 52vh;
        }

        .p-row {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 0.8rem; color: var(--text-secondary);
        }
        .p-row span:last-child { font-weight: 600; }
        .p-total {
          padding-top: 0.35rem; margin-top: 0.125rem;
          border-top: 1px solid var(--border-subtle);
        }
        .p-debt-box {
          background: rgba(244,63,94,0.06); border: 1.5px solid rgba(244,63,94,0.25);
          border-radius: var(--radius-lg); padding: 0.75rem;
          display: flex; flex-direction: column; gap: 0.5rem;
          animation: slideUp 0.25s var(--ease-spring);
          margin: 0.5rem 0;
        }
        .p-debt-label {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.8rem; font-weight: 800; color: var(--color-error);
          cursor: pointer;
        }
        .p-debt-fields { display: flex; flex-direction: column; gap: 0.4rem; }
        .p-debt-input {
          background: var(--surface-1); border: 1.5px solid var(--border-default);
          border-radius: 8px; color: var(--text-primary);
          font-size: 0.78rem !important; padding: 0.45rem 0.625rem;
          font-family: var(--font-sans); outline: none; width: 100%;
          min-height: 36px;
          transition: border-color 120ms;
        }
        .p-debt-input:focus { border-color: var(--color-error); }

        /* Bouton valider */
        .p-validate {
          width: 100%; min-height: 54px;
          background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-600));
          color: #fff; font-family: var(--font-display);
          font-size: 0.92rem; font-weight: 800;
          border: none; border-radius: var(--radius-lg);
          cursor: pointer; letter-spacing: 0.01em;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          transition: all 250ms var(--ease-out);
          box-shadow: 0 4px 16px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          position: relative; overflow: hidden;
          margin-top: 0.625rem;
          -webkit-tap-highlight-color: transparent;
        }
        .p-validate::before {
          content:''; position:absolute; top:0; left:0; right:0; height:50%;
          background: rgba(255,255,255,0.06); border-radius: inherit; pointer-events:none;
        }
        .p-validate:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
          background: linear-gradient(135deg, var(--color-brand-400), var(--color-brand-500));
        }
        .p-validate:active:not(:disabled) { transform: scale(0.97); box-shadow: none; }
        .p-validate:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; transform: none; }
        .p-validate.success { background: linear-gradient(135deg,#10b981,#059669) !important; animation: pulseSuccess 0.7s ease-out; }
        .p-validate.debt {
          background: linear-gradient(135deg, #f43f5e, #be123c) !important;
          box-shadow: 0 10px 25px rgba(244, 63, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          transform: scale(1.02);
          animation: pulse-debt 2s infinite ease-in-out;
        }
        .p-validate.debt:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.04);
          box-shadow: 0 12px 28px rgba(244, 63, 94, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3) !important;
        }

        @keyframes pulse-debt {
          0%, 100% { box-shadow: 0 10px 25px rgba(244, 63, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2); transform: scale(1.02); }
          50% { box-shadow: 0 10px 30px rgba(244, 63, 94, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.3); transform: scale(1.035); }
        }

        .p-validate-amount {
          font-size: 0.72rem; opacity: 0.85; font-weight: 600;
          background: rgba(255,255,255,0.15); padding: 0.1rem 0.4rem;
          border-radius: 5px; white-space: nowrap;
        }

        @media (max-width: 768px) {
          .pos-page-container {
            height: auto;
            max-height: none;
            overflow: visible;
          }
          .p-products-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
          .p-grid { height: auto; }
          .p-items { max-height: 220px; }
        }
      `}</style>
    </div>
  );
}
