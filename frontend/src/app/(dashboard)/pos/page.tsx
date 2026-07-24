'use client';

import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  Smartphone, ShoppingCart, ArrowUpRight, CheckCircle, X, Receipt,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { Modal } from '@/components/ui/Modal';
import { Product } from '@/types';

interface CartItem extends Product { cartQuantity: number; }

/* ─── Icône produit ─────────────────────────────────────────────── */
const PRODUCT_EMOJIS = ['🛍️','📦','👗','👟','💄','🍎','🥤','🫒','🧴','💊','📱','🔧','🎁','🪴','🧸'];
function productEmoji(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PRODUCT_EMOJIS[Math.abs(h) % PRODUCT_EMOJIS.length];
}

/* ─── Formatage GNF ─────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('fr-FR') + ' GNF';

export default function POSPage() {
  const { language, t } = useLanguage();
  const [products, setProducts]         = useState<Product[]>([]);
  const [clients, setClients]           = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery]   = useState('');
  const [discount, setDiscount]         = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'card'|'orange_money'|'transfer'>('cash');
  const [loading, setLoading]           = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successAnim, setSuccessAnim]   = useState(false);

  // Debt
  const [isDebt, setIsDebt]               = useState(false);
  const [debtDescription, setDebtDescription] = useState('');
  const [debtDueDate, setDebtDueDate]     = useState('');

  // Receipt
  const [receiptData, setReceiptData]         = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [shopName, setShopName]           = useState('BoutikFlow');
  const [sellerName, setSellerName]       = useState('');

  // Expense modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount]     = useState('');
  const [expenseCategory, setExpenseCategory] = useState('other_expense');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchClients();
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const p = JSON.parse(atob(token.split('.')[1]));
        if (p.tenant_name) setShopName(p.tenant_name);
        const raw = p.email || p.sub || '';
        if (raw) {
          const n = raw.split('@')[0];
          setSellerName(n.charAt(0).toUpperCase() + n.slice(1));
        }
      }
    } catch {}
  }, []);

  const fetchClients = async () => {
    try { const r = await api.getClients(1, 100); setClients(r.items || []); } catch {}
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts(1, 200);
      setProducts(Array.isArray(data) ? data : data?.items || []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        if (ex.cartQuantity >= product.stock) { toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock'); return prev; }
        return prev.map(i => i.id === product.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) =>
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const q = i.cartQuantity + delta;
      if (q <= 0) return i;
      if (q > i.stock) { toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock'); return i; }
      return { ...i, cartQuantity: q };
    }).filter(i => i.cartQuantity > 0));

  const setDirectQty = (id: string, qty: number) =>
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (qty <= 0) return { ...i, cartQuantity: 1 };
      if (qty > i.stock) { toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock'); return { ...i, cartQuantity: i.stock }; }
      return { ...i, cartQuantity: qty };
    }));

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const subtotal   = cart.reduce((s, i) => s + i.price * i.cartQuantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.cartQuantity, 0);
  const total      = Math.max(0, subtotal - discount);

  const handleValidateSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const payload: any = {
        status: 'delivered',
        items: cart.map(i => ({ product_id: i.id, quantity: i.cartQuantity })),
        notes: isDebt
          ? `[Vente à crédit] Paiement: ${paymentMethod} | Remise: ${discount} GNF`
          : `Paiement: ${paymentMethod} | Remise: ${discount} GNF`,
      };
      if (selectedClientId) payload.client_id = selectedClientId;

      const order = await api.createOrder(payload);

      if (isDebt && selectedClientId) {
        try {
          await api.createDebt({
            client_id: selectedClientId,
            order_id: order.id,
            original_amount: total,
            description: debtDescription.trim() || (language === 'fr' ? 'Achat à crédit' : 'Credit purchase'),
            due_date: debtDueDate || undefined,
          });
          toast.success(language === 'fr' ? 'Dette enregistrée ✓' : 'Debt recorded ✓');
        } catch { toast.error(language === 'fr' ? 'Erreur lors de la dette' : 'Failed to record debt'); }
      }

      // Mise à jour stock local
      setProducts(prev => prev.map(p => {
        const ci = cart.find(c => c.id === p.id);
        return ci ? { ...p, stock: p.stock - ci.cartQuantity } : p;
      }));

      // Animation succès
      setSuccessAnim(true);
      setTimeout(() => setSuccessAnim(false), 1200);
      toast.success(language === 'fr' ? '✓ Vente validée !' : '✓ Sale validated!');

      const client = clients.find(c => c.id === selectedClientId);
      setReceiptData({
        id: order.id, total,
        notes: payload.notes,
        items: cart.map(i => ({ product_id: i.id, quantity: i.cartQuantity, unit_price: i.price, product: { name: i.name } })),
        client: client ? { name: client.name, phone: client.phone || '' } : { name: language === 'fr' ? 'Client passant' : 'Walk-in', phone: '' },
        created_at: order.created_at || new Date().toISOString(),
        status: 'confirmed',
      });
      setIsReceiptModalOpen(true);

      setCart([]); setDiscount(0); setSelectedClientId('');
      setIsDebt(false); setDebtDescription(''); setDebtDueDate('');
    } catch (err: any) {
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

  /* ─── Render ────────────────────────────────────────────────────── */
  return (
    <div className="pos-root">
      {/* ── Top header ── */}
      <div className="pos-topbar">
        <div>
          <h1 className="pos-title">
            <ShoppingCart size={22} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem', opacity: 0.7 }} />
            {language === 'fr' ? 'Caisse' : 'Checkout'}
          </h1>
          <p className="pos-subtitle">{language === 'fr' ? 'Enregistrez vos ventes rapidement.' : 'Record your sales quickly.'}</p>
        </div>
        <button
          className="btn btn-ghost expense-btn"
          onClick={() => setIsExpenseModalOpen(true)}
        >
          <ArrowUpRight size={16} />
          {language === 'fr' ? 'Sortie de caisse' : 'Cash Outflow'}
        </button>
      </div>

      {/* ── Main grid ── */}
      <div className="pos-grid">

        {/* ══ Products zone ══════════════════════════════════════════ */}
        <div className="pos-products-zone">
          {/* Search bar */}
          <div className="pos-header">
            <div className="pos-search">
              <Search className="pos-search-icon" size={18} />
              <input
                type="text"
                className="input pos-search-input"
                placeholder={language === 'fr' ? 'Rechercher un produit…' : 'Search product…'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="products-count">
              {filteredProducts.length} {language === 'fr' ? 'produits' : 'products'}
            </span>
          </div>

          {/* Products grid */}
          <div className="pos-products-grid">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton skeleton-card product-skeleton" />
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="pos-empty" style={{ gridColumn: '1/-1' }}>
                <ShoppingCart size={40} opacity={0.2} />
                <p>{language === 'fr' ? 'Aucun produit trouvé' : 'No products found'}</p>
              </div>
            ) : (
              filteredProducts.map(product => {
                const disabled  = product.stock <= 0;
                const inCart    = cart.find(i => i.id === product.id);
                const emoji     = productEmoji(product.name);
                return (
                  <div
                    key={product.id}
                    className={`product-card ${disabled ? 'product-card--disabled' : ''} ${inCart ? 'product-card--in-cart' : ''}`}
                    onClick={() => !disabled && addToCart(product)}
                  >
                    {/* Qty badge */}
                    {inCart && (
                      <div className="product-cart-badge">{inCart.cartQuantity}</div>
                    )}
                    {/* Image / emoji */}
                    {product.images && product.images[0] ? (
                      <img src={product.images[0]} alt={product.name} className="product-img" />
                    ) : (
                      <div className="product-emoji">{emoji}</div>
                    )}
                    <span className="product-name">{product.name}</span>
                    <span className="product-price">{product.price.toLocaleString('fr-FR')} <small>GNF</small></span>
                    <span className={`product-stock ${disabled ? 'product-stock--out' : product.stock <= 5 ? 'product-stock--low' : ''}`}>
                      {disabled ? (language === 'fr' ? 'Épuisé' : 'Out of stock') : `${product.stock} ${language === 'fr' ? 'en stock' : 'in stock'}`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ══ Cart panel ══════════════════════════════════════════════ */}
        <div className="cart-panel">
          {/* Header */}
          <div className="cart-header">
            <span className="cart-title">{language === 'fr' ? 'Panier' : 'Cart'}</span>
            {totalItems > 0 && (
              <span className="cart-count">{totalItems}</span>
            )}
            {cart.length > 0 && (
              <button
                onClick={() => { setCart([]); setDiscount(0); }}
                className="btn btn-ghost btn--sm"
                style={{ marginLeft: 'auto', color: 'var(--color-error)', fontSize: '0.75rem' }}
                title={language === 'fr' ? 'Vider le panier' : 'Clear cart'}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Client selector */}
          <div className="client-selector-box">
            <label className="form-label">{language === 'fr' ? 'Client' : 'Customer'}</label>
            <select
              className="input"
              value={selectedClientId}
              onChange={e => {
                setSelectedClientId(e.target.value);
                if (!e.target.value) { setIsDebt(false); setDebtDescription(''); setDebtDueDate(''); }
              }}
            >
              <option value="">{language === 'fr' ? '— Client passant —' : '— Walk-in customer —'}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Cart items */}
          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <ShoppingCart size={44} className="empty-icon" />
                <p style={{ fontSize: '0.85rem' }}>{language === 'fr' ? 'Sélectionnez des produits' : 'Select products to start'}</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="item-emoji">{productEmoji(item.name)}</div>
                  <div className="item-details">
                    <span className="item-name">{item.name}</span>
                    <span className="item-price">{fmt(item.price * item.cartQuantity)}</span>
                  </div>
                  <div className="item-controls">
                    <button onClick={() => updateQty(item.id, -1)} className="qty-btn"><Minus size={13}/></button>
                    <input
                      type="number" className="qty-input"
                      value={item.cartQuantity} min="1" max={item.stock}
                      onChange={e => setDirectQty(item.id, parseInt(e.target.value) || 1)}
                    />
                    <button onClick={() => updateQty(item.id, 1)} className="qty-btn"><Plus size={13}/></button>
                    <button onClick={() => removeFromCart(item.id)} className="remove-btn"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Summary + validation */}
          <div className="cart-summary">
            {/* Totaux */}
            <div className="summary-row">
              <span>{language === 'fr' ? 'Sous-total' : 'Subtotal'}</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <div className="summary-row discount-row">
              <span>{language === 'fr' ? 'Remise (GNF)' : 'Discount (GNF)'}</span>
              <input
                type="number" className="discount-input"
                value={discount || ''} min="0" max={subtotal}
                onChange={e => setDiscount(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className="summary-row total-row">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>

            {/* Modes de paiement */}
            <div className="payment-methods">
              {([
                { value: 'cash',         label: language === 'fr' ? 'Espèces' : 'Cash',   Icon: Banknote },
                { value: 'orange_money', label: 'Orange M.',                              Icon: Smartphone },
                { value: 'card',         label: language === 'fr' ? 'Carte' : 'Card',     Icon: CreditCard },
              ] as const).map(({ value, label, Icon }) => (
                <label key={value} className={`pay-btn ${paymentMethod === value ? 'active' : ''}`}>
                  <input type="radio" name="payment" value={value} checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} className="hidden" />
                  <Icon size={18} />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {/* Option dette — uniquement si client sélectionné */}
            {selectedClientId && (
              <div className="debt-box">
                <label className="debt-checkbox-label">
                  <input
                    type="checkbox" id="pos-debt-chk"
                    checked={isDebt}
                    onChange={e => setIsDebt(e.target.checked)}
                    style={{ accentColor: 'var(--color-error)', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>{language === 'fr' ? '📋 Vente à crédit (dette)' : '📋 Credit sale (debt)'}</span>
                </label>
                {isDebt && (
                  <div className="debt-fields">
                    <input
                      type="text" className="input"
                      placeholder={language === 'fr' ? 'Motif (optionnel)' : 'Reason (optional)'}
                      value={debtDescription}
                      onChange={e => setDebtDescription(e.target.value)}
                    />
                    <input
                      type="date" className="input"
                      value={debtDueDate}
                      onChange={e => setDebtDueDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* BOUTON VALIDER */}
            <button
              className={`validate-btn ${successAnim ? 'validate-btn--success' : ''} ${isDebt ? 'validate-btn--debt' : ''}`}
              disabled={cart.length === 0 || isProcessing}
              onClick={handleValidateSale}
            >
              {isProcessing ? (
                <><span className="spinner" /> {language === 'fr' ? 'Traitement…' : 'Processing…'}</>
              ) : successAnim ? (
                <><CheckCircle size={22} /> {language === 'fr' ? 'Vente validée !' : 'Sale confirmed!'}</>
              ) : (
                <>
                  {isDebt
                    ? `📋 ${language === 'fr' ? 'Valider à crédit' : 'Validate credit'}`
                    : `✓ ${language === 'fr' ? 'Valider la vente' : 'Validate sale'}`
                  }
                  {cart.length > 0 && <span className="validate-total">{fmt(total)}</span>}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Receipt modal ── */}
      {receiptData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          order={receiptData}
          shopName={shopName}
          sellerName={sellerName}
        />
      )}

      {/* ── Expense modal ── */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={language === 'fr' ? 'Sortie de Caisse' : 'Cash Outflow'}
      >
        <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="form-label">{language === 'fr' ? 'Catégorie *' : 'Category *'}</label>
            <select className="input" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} required>
              <option value="supplier_purchase">{language === 'fr' ? 'Achat fournisseur' : 'Supplier purchase'}</option>
              <option value="salary">{language === 'fr' ? 'Salaire équipe' : 'Staff salary'}</option>
              <option value="rent">{language === 'fr' ? 'Loyer & charges' : 'Rent & charges'}</option>
              <option value="utilities">{language === 'fr' ? 'Factures (eau, électricité…)' : 'Bills (water, electricity…)'}</option>
              <option value="refund">{language === 'fr' ? 'Remboursement client' : 'Customer refund'}</option>
              <option value="other_expense">{language === 'fr' ? 'Autre dépense' : 'Other expense'}</option>
            </select>
          </div>
          <div className="input-group">
            <label className="form-label">{language === 'fr' ? 'Montant (GNF) *' : 'Amount (GNF) *'}</label>
            <input type="number" min={1} className="input" placeholder="ex: 50 000" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="form-label">{language === 'fr' ? 'Motif *' : 'Reason *'}</label>
            <textarea className="input" rows={3} placeholder={language === 'fr' ? 'Ex: Paiement livreur, fournitures…' : 'Ex: Delivery payment, supplies…'} value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.25rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsExpenseModalOpen(false)} disabled={isSubmittingExpense}>
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-danger" disabled={isSubmittingExpense}>
              {isSubmittingExpense ? (language === 'fr' ? 'Enregistrement…' : 'Saving…') : (language === 'fr' ? 'Valider la sortie' : 'Record outflow')}
            </button>
          </div>
        </form>
      </Modal>

      <style jsx>{`
        /* ── Layout racine ── */
        .pos-root {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          height: calc(100vh - 4.5rem);
          max-height: calc(100vh - 4.5rem);
          overflow: hidden;
        }

        /* ── Top bar ── */
        .pos-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-shrink: 0;
        }
        .pos-title {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }
        .pos-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .expense-btn {
          color: var(--color-error);
          border-color: rgba(244,63,94,0.2);
          font-size: 0.82rem;
        }
        .expense-btn:hover {
          background: rgba(244,63,94,0.08);
          border-color: rgba(244,63,94,0.3);
        }

        /* ── Main grid ── */
        .pos-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 0;
          flex: 1;
          min-height: 0;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          background: var(--surface-1);
          box-shadow: var(--shadow-md);
        }

        @media (max-width: 1100px) {
          .pos-grid { grid-template-columns: 1fr 340px; }
        }

        @media (max-width: 900px) {
          .pos-root { height: auto; max-height: none; overflow: visible; }
          .pos-grid { grid-template-columns: 1fr; border-radius: var(--radius-lg); }
        }

        /* ── Products zone ── */
        .pos-products-zone {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid var(--border-subtle);
        }

        /* Search header */
        .pos-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          border-bottom: 1px solid var(--border-subtle);
          flex-shrink: 0;
          background: var(--surface-2);
        }
        .pos-search {
          flex: 1;
          position: relative;
        }
        .pos-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }
        .pos-search-input {
          padding-left: 2.5rem !important;
          min-height: 42px;
          border-radius: var(--radius-md);
          background: var(--surface-1) !important;
        }
        .products-count {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* Products grid */
        .pos-products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 0.625rem;
          padding: 0.875rem;
          overflow-y: auto;
          flex: 1;
          align-content: start;
        }

        @media (max-width: 768px) {
          .pos-products-grid {
            grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
            gap: 0.5rem;
            padding: 0.625rem;
          }
        }

        /* Product card */
        .product-card {
          background: var(--surface-0);
          border: 1.5px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 0.75rem 0.625rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          text-align: center;
          position: relative;
          overflow: hidden;
          transition:
            border-color 120ms ease,
            background 120ms ease,
            transform 200ms var(--ease-spring),
            box-shadow 150ms ease;
          user-select: none;
          -webkit-user-select: none;
        }
        .product-card:hover:not(.product-card--disabled) {
          border-color: var(--color-brand-400);
          background: var(--surface-1);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }
        .product-card:active:not(.product-card--disabled) {
          transform: scale(0.94);
          box-shadow: none;
        }
        .product-card--in-cart {
          border-color: rgba(99,102,241,0.4);
          background: rgba(99,102,241,0.04);
        }
        .product-card--disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .product-cart-badge {
          position: absolute;
          top: 5px; right: 5px;
          background: var(--color-brand-500);
          color: white;
          font-size: 0.62rem;
          font-weight: 800;
          width: 18px; height: 18px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          animation: bounceIn 0.25s var(--ease-spring);
        }
        .product-img {
          width: 52px; height: 52px;
          border-radius: var(--radius-md);
          object-fit: cover;
        }
        .product-emoji {
          font-size: 2rem;
          line-height: 1;
          width: 52px; height: 52px;
          display: flex; align-items: center; justify-content: center;
          background: var(--surface-2);
          border-radius: var(--radius-md);
          transition: transform 200ms var(--ease-spring);
        }
        .product-card:hover .product-emoji { transform: scale(1.1); }

        .product-name {
          font-size: 0.73rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          width: 100%;
        }
        .product-price {
          font-size: 0.78rem;
          font-weight: 800;
          color: var(--color-brand-400);
          font-family: var(--font-display);
        }
        .product-price small { font-size: 0.62rem; font-weight: 600; opacity: 0.7; }
        .product-stock { font-size: 0.63rem; font-weight: 600; color: var(--text-muted); }
        .product-stock--low { color: var(--color-warning); }
        .product-stock--out { color: var(--color-error); }

        /* Skeleton */
        .product-skeleton { height: 150px; }

        /* Empty */
        .pos-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 3rem 1rem;
          gap: 0.75rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        /* ── Cart panel ── */
        .cart-panel {
          background: var(--surface-1);
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .cart-header {
          padding: 0.875rem 1rem;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
          background: var(--surface-2);
        }
        .cart-title {
          font-family: var(--font-display);
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .cart-count {
          background: var(--color-brand-500);
          color: white;
          font-size: 0.68rem; font-weight: 700;
          min-width: 20px; height: 20px;
          border-radius: 99px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 0.3rem;
          animation: scaleIn 0.2s var(--ease-spring);
        }

        /* Client selector */
        .client-selector-box {
          padding: 0.625rem 0.875rem;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--surface-2);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        /* Items */
        .cart-items { flex: 1; overflow-y: auto; padding: 0.25rem 0; }
        .cart-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          height: 100%; gap: 0.75rem;
          color: var(--text-muted); padding: 2rem;
        }
        .cart-empty .empty-icon { opacity: 0.2; }

        .cart-item {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.625rem 0.875rem;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 120ms ease;
          animation: slideUp 0.2s var(--ease-out) both;
        }
        .cart-item:hover { background: var(--surface-2); }
        .cart-item:last-child { border-bottom: none; }

        .item-emoji {
          font-size: 1.25rem;
          flex-shrink: 0;
          width: 30px; text-align: center;
        }
        .item-details { flex: 1; min-width: 0; }
        .item-name {
          display: block;
          font-size: 0.78rem; font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .item-price {
          display: block;
          font-size: 0.72rem; font-weight: 700;
          color: var(--color-brand-400);
          font-family: var(--font-display);
          margin-top: 1px;
        }

        .item-controls { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
        .qty-btn {
          width: 26px; height: 26px;
          background: var(--surface-2);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 120ms ease; flex-shrink: 0; padding: 0;
        }
        .qty-btn:hover { background: var(--color-brand-500); border-color: var(--color-brand-600); color: white; transform: scale(1.08); }
        .qty-btn:active { transform: scale(0.9); }

        .qty-input {
          width: 34px; height: 26px;
          background: var(--surface-0);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.75rem; font-weight: 700;
          text-align: center; outline: none;
          transition: border-color 120ms ease;
        }
        .qty-input:focus { border-color: var(--color-brand-500); }
        .qty-input::-webkit-outer-spin-button,
        .qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

        .remove-btn {
          width: 26px; height: 26px;
          background: transparent; border: none;
          border-radius: var(--radius-sm);
          color: var(--text-disabled);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 120ms ease; flex-shrink: 0; padding: 0;
        }
        .remove-btn:hover { background: rgba(244,63,94,0.1); color: var(--color-error); transform: scale(1.1); }

        /* Summary */
        .cart-summary {
          padding: 0.75rem 0.875rem;
          border-top: 1px solid var(--border-subtle);
          flex-shrink: 0;
          display: flex; flex-direction: column; gap: 0.5rem;
          background: var(--surface-1);
        }

        .summary-row {
          display: flex; justify-content: space-between; align-items: center;
          font-size: 0.82rem; color: var(--text-secondary);
        }
        .summary-row span:last-child { font-weight: 600; }
        .total-row {
          padding-top: 0.4rem;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.95rem; font-weight: 800;
          color: var(--text-primary);
          font-family: var(--font-display);
        }
        .total-row span:last-child { color: var(--color-brand-400); font-size: 1rem; }

        .discount-input {
          width: 90px; height: 28px;
          background: var(--surface-2); border: 1px solid var(--border-default);
          border-radius: var(--radius-sm); color: var(--text-primary);
          font-size: 0.78rem; text-align: right; padding: 0 0.5rem; outline: none;
          transition: border-color 120ms ease;
        }
        .discount-input:focus { border-color: var(--color-brand-500); }
        .discount-input::-webkit-outer-spin-button,
        .discount-input::-webkit-inner-spin-button { -webkit-appearance: none; }

        /* Payment methods */
        .payment-methods { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.375rem; }
        .pay-btn {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 0.25rem; padding: 0.5rem 0.25rem;
          background: var(--surface-2); border: 1.5px solid var(--border-default);
          border-radius: var(--radius-md); cursor: pointer;
          font-size: 0.65rem; font-weight: 700; color: var(--text-muted);
          transition: all 120ms ease; min-height: 48px; user-select: none;
          text-transform: uppercase; letter-spacing: 0.03em;
        }
        .pay-btn:hover { border-color: var(--color-brand-400); color: var(--text-primary); background: var(--brand-alpha-08); transform: translateY(-1px); }
        .pay-btn.active { border-color: var(--color-brand-500); background: var(--brand-alpha-15); color: var(--color-brand-400); box-shadow: 0 0 0 1px var(--color-brand-500); }

        /* Debt box */
        .debt-box {
          background: rgba(244,63,94,0.06);
          border: 1px solid rgba(244,63,94,0.18);
          border-radius: var(--radius-md);
          padding: 0.625rem;
          display: flex; flex-direction: column; gap: 0.4rem;
        }
        .debt-checkbox-label {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.78rem; font-weight: 700;
          color: var(--color-error); cursor: pointer;
        }
        .debt-fields { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.125rem; }
        .debt-fields .input { font-size: 0.78rem !important; min-height: 36px !important; }

        /* Validate button */
        .validate-btn {
          width: 100%;
          min-height: 54px;
          background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-600));
          color: white;
          font-family: var(--font-display);
          font-size: 0.95rem; font-weight: 800;
          border: none; border-radius: var(--radius-lg);
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: all 200ms var(--ease-out);
          box-shadow: 0 4px 16px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          position: relative; overflow: hidden;
        }
        .validate-btn::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 50%;
          background: rgba(255,255,255,0.06);
          border-radius: inherit;
          pointer-events: none;
        }
        .validate-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
          background: linear-gradient(135deg, var(--color-brand-400), var(--color-brand-500));
        }
        .validate-btn:active:not(:disabled) { transform: scale(0.97); box-shadow: none; }
        .validate-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; transform: none; }
        .validate-btn--success { background: linear-gradient(135deg, #10b981, #059669) !important; animation: pulseSuccess 0.6s ease-out; box-shadow: var(--shadow-success) !important; }
        .validate-btn--debt { background: linear-gradient(135deg, #f43f5e, #e11d48) !important; box-shadow: 0 4px 16px rgba(244,63,94,0.3) !important; }

        .validate-total {
          font-size: 0.75rem;
          opacity: 0.8;
          font-weight: 600;
          margin-left: 0.25rem;
          background: rgba(255,255,255,0.15);
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-sm);
        }

        /* Hidden radio */
        .hidden { display: none; }

        @media (max-width: 768px) {
          .pos-topbar { flex-wrap: wrap; }
          .pos-grid { min-height: 0; }
          .pos-products-zone { min-height: 360px; }
        }
      `}</style>
    </div>
  );
}
