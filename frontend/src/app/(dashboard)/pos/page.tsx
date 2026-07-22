'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, ShoppingCart, Printer } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { ReceiptModal } from '@/components/ui/ReceiptModal';

import { Product } from '@/types';

interface CartItem extends Product {
  cartQuantity: number;
}

export default function POSPage() {
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'orange_money' | 'transfer'>('cash');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

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
      
      const order = await api.createOrder({
        items: orderItems,
        notes: `Mode de paiement: ${paymentMethod} | Remise: ${discount} GNF`
      });
      
      toast.success(language === 'fr' ? 'Vente validée avec succès' : 'Sale validated successfully');
      
      // Update local stock immediately for better UX
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(c => c.id === p.id);
        if (cartItem) {
          return { ...p, stock: p.stock - cartItem.cartQuantity };
        }
        return p;
      }));
      
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
        client: null,
        created_at: order.created_at || new Date().toISOString(),
        status: 'confirmed'
      });
      setIsReceiptModalOpen(true);
      
      // Clear cart
      setCart([]);
      setDiscount(0);
    } catch (error) {
      toast.error(language === 'fr' ? 'Erreur lors de la validation' : 'Error validating sale');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pos-container">
      <div className="pos-header">
        <div>
          <h1 className="pos-title">{language === 'fr' ? 'Caisse Rapide' : 'Quick Checkout'}</h1>
          <p className="pos-subtitle">{language === 'fr' ? 'Enregistrez vos ventes en magasin.' : 'Record your in-store sales.'}</p>
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
                    <div className="product-info">
                      <h3 className="product-name">{product.name}</h3>
                      <div className="product-price">{product.price.toLocaleString('fr-FR')} GNF</div>
                      <div className={`product-stock ${disabled ? 'text-red' : 'text-green'}`}>
                        {product.stock} {t('prod.in_stock')}
                      </div>
                    </div>
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
          shopName="BoutikFlow"
        />
      )}

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
          grid-template-columns: 1fr;
          gap: 1.5rem;
          flex: 1;
          min-height: 0;
        }
        
        @media (min-width: 768px) {
          .pos-grid {
            grid-template-columns: 2fr 1fr;
          }
        }
        
        /* Products Panel */
        .products-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: var(--surface-1);
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          padding: 1.25rem;
          height: 100%;
          min-height: 500px;
        }
        
        .search-bar {
          position: relative;
          display: flex;
          align-items: center;
        }
        
        .search-icon {
          position: absolute;
          left: 1rem;
          color: var(--text-muted);
        }
        
        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 3rem;
          background: var(--surface-0);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 0.95rem;
          transition: border-color 0.2s;
        }
        
        .search-input:focus {
          outline: none;
          border-color: var(--color-brand-500);
        }
        
        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
          overflow-y: auto;
          flex: 1;
          align-content: start;
        }
        
        .product-card {
          background: var(--surface-0);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }
        
        .product-card:hover:not(.product-card--disabled) {
          border-color: var(--color-brand-500);
          transform: translateY(-2px);
        }
        
        .product-card--disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .product-info {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .product-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .product-price {
          font-weight: 700;
          color: var(--color-brand-500);
        }
        
        .product-stock {
          font-size: 0.75rem;
        }
        
        .text-red { color: #ef4444; }
        .text-green { color: #10b981; }
        
        /* Cart Panel */
        .cart-panel {
          display: flex;
          flex-direction: column;
          background: var(--surface-1);
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          overflow: hidden;
          height: 100%;
        }
        
        @media (max-width: 767px) {
          .cart-panel {
            position: sticky;
            bottom: 0;
            max-height: 50vh;
            z-index: 20;
            box-shadow: 0 -8px 24px rgba(0,0,0,0.3);
            border-top: 2px solid var(--color-brand-500);
          }
          .cart-items {
            max-height: 180px;
            overflow-y: auto;
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
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--surface-0);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          cursor: pointer;
        }
        
        .qty-btn:hover {
          background: rgba(255,255,255,0.05);
        }
        
        .qty-input {
          width: 46px;
          height: 28px;
          text-align: center;
          font-weight: 600;
          font-size: 0.9rem;
          background: var(--surface-0);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
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
          width: 28px;
          height: 28px;
          border-radius: 6px;
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
