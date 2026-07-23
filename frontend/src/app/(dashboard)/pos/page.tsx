'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, ShoppingCart, Printer, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import { Modal } from '@/components/ui/Modal';

import { Product } from '@/types';

interface CartItem extends Product {
  cartQuantity: number;
}

export default function POSPage() {
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'orange_money' | 'transfer'>('cash');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [shopName, setShopName] = useState('BoutikFlow');
  const [sellerName, setSellerName] = useState('');

  // States for cash outflow (sortie de caisse)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('other_expense');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchClients();
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

  const fetchClients = async () => {
    try {
      const res = await api.getClients(1, 100);
      setClients(res.items || []);
    } catch (e) {
      console.error('Fetch clients error:', e);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts(1, 100);
      if (Array.isArray(data)) {
        setProducts(data);
      } else if (data && Array.isArray(data.items)) {
        setProducts(data.items);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Fetch products error:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity >= product.stock) {
          toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock');
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.cartQuantity + delta;
          if (newQty <= 0) return item;
          if (newQty > item.stock) {
            toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock');
            return item;
          }
          return { ...item, cartQuantity: newQty };
        }
        return item;
      }).filter(item => item.cartQuantity > 0);
    });
  };

  const setDirectQuantity = (id: string, qty: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          if (qty <= 0) return { ...item, cartQuantity: 1 };
          if (qty > item.stock) {
            toast.error(language === 'fr' ? 'Stock insuffisant' : 'Insufficient stock');
            return { ...item, cartQuantity: item.stock };
          }
          return { ...item, cartQuantity: qty };
        }
        return item;
      });
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
  const total = Math.max(0, subtotal - discount);

  const handleValidateSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const orderItems = cart.map(item => ({
        product_id: item.id,
        quantity: item.cartQuantity,
      }));
      
      const payload: any = {
        status: 'delivered',
        items: orderItems,
        notes: `Mode de paiement: ${paymentMethod} | Remise: ${discount} GNF`
      };
      
      if (selectedClientId) {
        payload.client_id = selectedClientId;
      }

      const order = await api.createOrder(payload);
      
      toast.success(language === 'fr' ? 'Vente validée avec succès' : 'Sale validated successfully');
      
      // Update local stock immediately for better UX
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.id === p.id);
        if (cartItem) {
          return { ...p, stock: p.stock - cartItem.cartQuantity };
        }
        return p;
      }));

      const selectedClientObj = clients.find(c => c.id === selectedClientId);
      
      // Build receipt data matching ReceiptModal props
      setReceiptData({
        id: order.id,
        total: total,
        notes: `Mode de paiement: ${paymentMethod} | Remise: ${discount} GNF`,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.cartQuantity,
          unit_price: item.price,
          product: { name: item.name }
        })),
        client: selectedClientObj ? { name: selectedClientObj.name, phone: selectedClientObj.phone || '' } : { name: language === 'fr' ? 'Client passant' : 'Walk-in customer', phone: '' },
        created_at: order.created_at || new Date().toISOString(),
        status: 'confirmed'
      });
      setIsReceiptModalOpen(true);
      
      // Clear cart
      setCart([]);
      setDiscount(0);
      setSelectedClientId('');
    } catch (error: any) {
      toast.error(error?.message || (language === 'fr' ? 'Erreur lors de la validation' : 'Error validating sale'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      toast.error(language === 'fr' ? 'Indiquez un montant valide' : 'Please provide a valid amount');
      return;
    }
    if (!expenseDescription.trim()) {
      toast.error(language === 'fr' ? 'Indiquez le motif de la sortie' : 'Please provide a description');
      return;
    }
    setIsSubmittingExpense(true);
    try {
      await api.createFinanceTransaction({
        type: 'expense',
        category: expenseCategory as any,
        amount: Number(expenseAmount),
        description: expenseDescription.trim(),
        payment_method: 'cash',
        reference: language === 'fr' ? 'Sortie Caisse' : 'POS Outflow'
      });
      toast.success(language === 'fr' ? 'Sortie de caisse enregistrée' : 'Cash outflow recorded');
      setIsExpenseModalOpen(false);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseCategory('other_expense');
    } catch (error: any) {
      toast.error(error?.message || (language === 'fr' ? 'Erreur lors de l\'enregistrement' : 'Error recording outflow'));
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  return (
    <div className="pos-container">
      <div className="pos-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="pos-title">{language === 'fr' ? 'Caisse Rapide' : 'Quick Checkout'}</h1>
          <p className="pos-subtitle">{language === 'fr' ? 'Enregistrez vos ventes en magasin.' : 'Record your in-store sales.'}</p>
        </div>
        <div>
          <button 
            type="button" 
            className="btn btn-ghost" 
            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', height: 'auto', fontSize: '0.9rem' }}
            onClick={() => setIsExpenseModalOpen(true)}
          >
            <ArrowUpRight size={16} />
            {language === 'fr' ? 'Sortie de Caisse (-)' : 'Cash Outflow (-)'}
          </button>
        </div>
      </div>

      <div className="pos-grid">
        {/* Products Panel */}
        <div className="products-panel">
          <div className="search-bar">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              placeholder={language === 'fr' ? 'Rechercher un produit...' : 'Search product...'} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="products-grid">
            {loading ? (
              <div className="loading-state">{t('common.loading')}</div>
            ) : filteredProducts.length === 0 ? (
              <div className="empty-state">{t('prod.no_product')}</div>
            ) : (
              filteredProducts.map(product => {
                const disabled = product.stock <= 0;
                return (
                  <div 
                    key={product.id} 
                    className={`product-card ${disabled ? 'product-card--disabled' : ''}`}
                    onClick={() => !disabled && addToCart(product)}
                  >
                    <div className="product-card-top">
                      {product.images && product.images[0] ? (
                        <img src={product.images[0]} alt={product.name} className="product-thumb" />
                      ) : (
                        <div className="product-thumb-placeholder"><ShoppingCart size={22} /></div>
                      )}
                      <div className={`stock-pill ${disabled ? 'stock-pill-out' : 'stock-pill-ok'}`}>
                        {product.stock} {t('prod.in_stock')}
                      </div>
                    </div>

                    <div className="product-info">
                      <h3 className="product-name">{product.name}</h3>
                      {product.sku && <span className="product-sku">SKU: {product.sku}</span>}
                      <div className="product-price">{product.price.toLocaleString('fr-FR')} GNF</div>
                    </div>

                    <button 
                      className="btn-add-fast"
                      disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); if (!disabled) addToCart(product); }}
                    >
                      <Plus size={15} /> {language === 'fr' ? 'Ajouter' : 'Add'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="cart-panel">
          <div className="cart-header">
            <h2>{language === 'fr' ? 'Panier' : 'Cart'}</h2>
            <div className="cart-count">{cart.reduce((a, b) => a + b.cartQuantity, 0)}</div>
          </div>

          {/* Client Selector */}
          <div className="client-selector-box" style={{ padding: '0.75rem 1rem 0.25rem 1rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
              {language === 'fr' ? 'Client :' : 'Customer:'}
            </label>
            <select
              className="input"
              style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'var(--surface-0)' }}
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">{language === 'fr' ? '— Client passant (Comptoir) —' : '— Walk-in customer —'}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>
          
          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty">
                <ShoppingCart size={48} className="empty-icon" />
                <p>{language === 'fr' ? 'Aucun produit dans le panier' : 'No products in cart'}</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="item-details">
                    <span className="item-name">{item.name}</span>
                    <span className="item-price">{(item.price * item.cartQuantity).toLocaleString('fr-FR')} GNF</span>
                  </div>
                  <div className="item-controls">
                    <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn" title="Diminuer"><Minus size={16}/></button>
                    <input 
                      type="number" 
                      className="qty-input" 
                      value={item.cartQuantity} 
                      min="1" 
                      max={item.stock}
                      onChange={(e) => setDirectQuantity(item.id, parseInt(e.target.value) || 1)}
                    />
                    <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn" title="Augmenter"><Plus size={16}/></button>
                    <button onClick={() => removeFromCart(item.id)} className="remove-btn" title="Supprimer"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="cart-summary">
            <div className="summary-row">
              <span>{language === 'fr' ? 'Sous-total' : 'Subtotal'}</span>
              <span>{subtotal.toLocaleString('fr-FR')} GNF</span>
            </div>
            
            <div className="summary-row discount-row">
              <span>{language === 'fr' ? 'Remise' : 'Discount'} (GNF)</span>
              <input 
                type="number" 
                value={discount || ''} 
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="discount-input"
                min="0"
                max={subtotal}
              />
            </div>
            
            <div className="summary-row total-row">
              <span>Total</span>
              <span>{total.toLocaleString('fr-FR')} GNF</span>
            </div>
            
            <div className="payment-methods">
              <label className={`pay-btn ${paymentMethod === 'cash' ? 'active' : ''}`}>
                <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="hidden" />
                <Banknote size={20} />
                <span>{language === 'fr' ? 'Espèces' : 'Cash'}</span>
              </label>
              <label className={`pay-btn ${paymentMethod === 'orange_money' ? 'active' : ''}`}>
                <input type="radio" name="payment" value="orange_money" checked={paymentMethod === 'orange_money'} onChange={() => setPaymentMethod('orange_money')} className="hidden" />
                <Smartphone size={20} />
                <span>Orange M.</span>
              </label>
              <label className={`pay-btn ${paymentMethod === 'card' ? 'active' : ''}`}>
                <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="hidden" />
                <CreditCard size={20} />
                <span>{language === 'fr' ? 'Carte' : 'Card'}</span>
              </label>
            </div>
            
            <button 
              className="validate-btn" 
              disabled={cart.length === 0 || isProcessing}
              onClick={handleValidateSale}
            >
              {isProcessing ? t('common.loading') : (language === 'fr' ? 'Valider la vente' : 'Validate Sale')}
            </button>
          </div>
        </div>
      </div>
      
      {receiptData && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          order={receiptData}
          shopName={shopName}
          sellerName={sellerName}
        />
      )}

      {/* Modal de Sortie de Caisse */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title={language === 'fr' ? 'Déclarer une Sortie de Caisse' : 'Record Cash Outflow'}
      >
        <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {language === 'fr' ? 'Catégorie de charge *' : 'Expense Category *'}
            </label>
            <select
              className="input"
              style={{ width: '100%', padding: '0.5rem', background: 'var(--surface-0)' }}
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value)}
              required
            >
              <option value="supplier_purchase">{language === 'fr' ? 'Achat fournisseur / Approvisionnement' : 'Supplier purchase / Stock procurement'}</option>
              <option value="salary">{language === 'fr' ? 'Salaire / Rémunération équipe' : 'Salary / Team remuneration'}</option>
              <option value="rent">{language === 'fr' ? 'Loyer & Charges boutique' : 'Rent & Shop charges'}</option>
              <option value="utilities">{language === 'fr' ? 'Facture (Électricité, Eau, Internet)' : 'Bill (Electricity, Water, Internet)'}</option>
              <option value="refund">{language === 'fr' ? 'Remboursement client (Retour)' : 'Customer refund (Return)'}</option>
              <option value="other_expense">{language === 'fr' ? 'Autre dépense / Divers' : 'Other expense / Misc'}</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {language === 'fr' ? 'Montant (GNF) *' : 'Amount (GNF) *'}
            </label>
            <input
              type="number"
              min={1}
              className="input"
              style={{ width: '100%', padding: '0.5rem', background: 'var(--surface-0)', fontWeight: 'bold' }}
              placeholder="ex: 50000"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {language === 'fr' ? 'Motif de la sortie / Description *' : 'Outflow reason / Description *'}
            </label>
            <textarea
              className="input"
              rows={3}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--surface-0)' }}
              placeholder={language === 'fr' ? 'Ex: Achat fournitures, Paiement livreur...' : 'Ex: Office supplies, Delivery boy payment...'}
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsExpenseModalOpen(false)}
              disabled={isSubmittingExpense}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: '#ef4444' }}
              disabled={isSubmittingExpense}
            >
              {isSubmittingExpense ? (language === 'fr' ? 'Enregistrement...' : 'Saving...') : (language === 'fr' ? 'Valider la sortie' : 'Validate Outflow')}
            </button>
          </div>
        </form>
      </Modal>

      <style jsx>{`
        .pos-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 1.5rem;
          padding-bottom: 1.5rem;
        }
        
        .pos-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .pos-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }
        
        .pos-subtitle {
          color: var(--text-muted);
          font-size: 0.875rem;
        }
              .pos-grid {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 1023px) {
          .pos-grid {
            grid-template-columns: 1fr;
          }
        }
        
        .products-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: var(--surface-1);
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          padding: 1.25rem;
          min-height: 500px;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 1rem;
        }

        .product-card {
          background: var(--surface-0);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .product-card:hover:not(.product-card--disabled) {
          border-color: var(--color-brand-500);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .product-card--disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .product-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .product-thumb {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          object-fit: cover;
        }

        .product-thumb-placeholder {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: var(--surface-2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .stock-pill {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 999px;
        }

        .stock-pill-ok {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        .stock-pill-out {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        .product-info {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          flex: 1;
        }

        .product-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.25;
        }

        .product-sku {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .product-price {
          font-size: 0.95rem;
          font-weight: 800;
          color: var(--color-brand-500);
          margin-top: 0.25rem;
        }

        .btn-add-fast {
          margin-top: 0.25rem;
          padding: 0.4rem;
          border-radius: 6px;
          border: none;
          background: var(--color-brand-500);
          color: white;
          font-size: 0.8rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-add-fast:hover:not(:disabled) {
          filter: brightness(1.1);
        }

        /* Cart Panel Sticky & Compact */
        .cart-panel {
          display: flex;
          flex-direction: column;
          background: var(--surface-1);
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          position: sticky;
          top: 1rem;
          max-height: calc(100vh - 5rem);
        }
        
        .cart-items {
          max-height: 520px;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        @media (max-width: 767px) {
          .cart-panel {
            position: relative;
            top: auto;
            bottom: auto;
            max-height: none;
            z-index: 10;
            box-shadow: none;
            border-top: 1px solid var(--border-subtle);
            margin-top: 1.5rem;
          }
          .cart-items {
            max-height: none;
            overflow-y: visible;
          }
        }
        
        .cart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--surface-0);
        }
        
        .cart-header h2 {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }
        
        .cart-count {
          background: var(--color-brand-500);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.125rem 0.5rem;
          border-radius: 999px;
        }
        
        .cart-items {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .cart-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          gap: 1rem;
          text-align: center;
        }
        
        .empty-icon {
          opacity: 0.2;
        }
        
        .cart-item {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding-bottom: 1rem;
          border-bottom: 1px dashed var(--border-subtle);
        }
        
        .cart-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        
        .item-details {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        
        .item-name {
          font-weight: 500;
          color: var(--text-primary);
          font-size: 0.9rem;
        }
        
        .item-price {
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          font-size: 0.9rem;
        }
        
        .item-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .qty-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--surface-0);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 1.1rem;
        }
        
        .qty-btn:hover {
          background: rgba(255,255,255,0.05);
        }
        
        .qty-input {
          width: 64px;
          height: 36px;
          text-align: center;
          font-weight: 700;
          font-size: 1rem;
          background: var(--surface-0);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-primary);
          padding: 0 4px;
        }
        
        .qty-input:focus {
          outline: none;
          border-color: var(--color-brand-500);
        }
        
        .remove-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: none;
          cursor: pointer;
          margin-left: auto;
        }
        
        .remove-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }
        
        .cart-summary {
          background: var(--surface-0);
          padding: 1.25rem;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--text-primary);
          font-size: 0.95rem;
        }
        
        .discount-row {
          color: var(--text-muted);
        }
        
        .discount-input {
          width: 100px;
          padding: 0.4rem;
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          color: var(--text-primary);
          text-align: right;
        }
        
        .total-row {
          font-size: 1.2rem;
          font-weight: 700;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px dashed var(--border-subtle);
        }
        
        .payment-methods {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-top: 1rem;
        }
        
        .hidden { display: none; }
        
        .pay-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 0.5rem;
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-1);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .pay-btn.active {
          border-color: var(--color-brand-500);
          color: var(--color-brand-500);
          background: rgba(16, 185, 129, 0.1);
        }
        
        .validate-btn {
          margin-top: 1rem;
          width: 100%;
          padding: 1rem;
          border-radius: 8px;
          background: var(--color-brand-500);
          color: white;
          font-weight: 700;
          font-size: 1rem;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
          min-height: 44px; /* touch-friendly */
        }
        
        .validate-btn:hover:not(:disabled) {
          opacity: 0.9;
        }
        
        .validate-btn:disabled {
          background: var(--border-subtle);
          color: var(--text-muted);
          cursor: not-allowed;
        }
        
        .loading-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 2rem;
          color: var(--text-muted);
        }
        
        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 2rem;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
