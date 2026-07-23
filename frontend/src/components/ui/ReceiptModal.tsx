'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { Printer } from 'lucide-react';
import './ReceiptModal.css';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    total: number;
    notes: string | null;
    items: { product_id: string; quantity: number; unit_price: number; product?: { name: string } }[];
    client?: { name: string; phone: string } | null;
    created_at: string;
    status: string;
  };
  shopName: string;
  shopPhone?: string;
  shopAddress?: string;
  sellerName?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  shopName,
  shopPhone,
  shopAddress,
  sellerName,
}) => {
  const { t, language } = useLanguage();
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');

  const formatGNF = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const formatDate = (isoString: string) => {
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  };

  const handlePrint = () => {
    window.print();
  };

  if (!order) return null;

  const formatNumber = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount);
  };

  const receiptNumber = `BF-${order.id.slice(0, 8).toUpperCase()}`;
  const subtotal = order.items?.reduce((acc, item) => acc + (item.unit_price || 0) * item.quantity, 0) || 0;
  const paymentInfo = order.notes?.match(/Mode de paiement:\s*(\w+)/)?.[1] || 'cash';
  const discountInfo = order.notes?.match(/Remise:\s*([\d,]+)/)?.[1] || '0';

  const paymentLabels: Record<string, string> = {
    cash: language === 'fr' ? 'Espèces' : 'Cash',
    orange_money: 'Orange Money',
    card: language === 'fr' ? 'Carte bancaire' : 'Credit Card',
    transfer: language === 'fr' ? 'Virement' : 'Bank Transfer',
  };

  const clientName = order.client?.name || (language === 'fr' ? 'Client passant' : 'Walk-in customer');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={language === 'fr' ? 'Reçu de vente' : 'Sales Receipt'} maxWidth="650px">
      <div className="receipt-modal-content">
        <div className="format-selector no-print">
          <span className="format-label">{language === 'fr' ? 'Format' : 'Format'} :</span>
          <div className="format-buttons">
            <button
              className={`format-btn ${format === 'thermal' ? 'format-btn--active' : ''}`}
              onClick={() => setFormat('thermal')}
            >
              Thermique (80mm)
            </button>
            <button
              className={`format-btn ${format === 'a4' ? 'format-btn--active' : ''}`}
              onClick={() => setFormat('a4')}
            >
              A4
            </button>
          </div>
        </div>

        <div className="receipt-preview-container">
          <div className={`receipt-paper ${format}`}>
            {/* ===== En-tête Boutique ===== */}
            <div className="receipt-header">
              <div className="shop-logo-placeholder">BF</div>
              <h2 className="shop-name">{shopName}</h2>
              {shopAddress && <p className="shop-detail">{shopAddress}</p>}
              {shopPhone && <p className="shop-detail">Tel : {shopPhone}</p>}
              <div className="receipt-line-solid" />
              <p className="receipt-title">{language === 'fr' ? 'REÇU DE VENTE' : 'SALES RECEIPT'}</p>
              <div className="receipt-line-dash" />
            </div>

            {/* ===== Informations Transaction ===== */}
            <div className="receipt-meta">
              <div className="meta-row">
                <span>{language === 'fr' ? 'N° Reçu' : 'Receipt #'} :</span>
                <span className="strong">{receiptNumber}</span>
              </div>
              <div className="meta-row">
                <span>Date :</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              {sellerName && (
                <div className="meta-row">
                  <span>{language === 'fr' ? 'Vendeur' : 'Seller'} :</span>
                  <span>{sellerName}</span>
                </div>
              )}
              <div className="meta-row">
                <span>Client :</span>
                <span>{clientName}</span>
              </div>
              {order.client?.phone && (
                <div className="meta-row">
                  <span>Tél :</span>
                  <span>{order.client.phone}</span>
                </div>
              )}
            </div>

            <div className="receipt-line-dash" />

            {/* ===== Articles ===== */}
            <div className="receipt-items">
              <table className="items-table">
                <thead>
                  <tr>
                    <th className="col-desc">Article</th>
                    <th className="col-qty">Qté</th>
                    <th className="col-price">P.U.</th>
                    <th className="col-total">{language === 'fr' ? 'Total' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, index) => (
                    <tr key={index}>
                      <td className="col-desc">{item.product?.name || `Art. ${index + 1}`}</td>
                      <td className="col-qty">{item.quantity}</td>
                      <td className="col-price">{formatNumber(item.unit_price || 0)}</td>
                      <td className="col-total">{formatNumber((item.unit_price || 0) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ===== Totaux ===== */}
            <div className="receipt-line-solid" />
            <div className="receipt-totals">
              <div className="total-row">
                <span>{language === 'fr' ? 'Sous-total' : 'Subtotal'} ({order.items?.length || 0}) :</span>
                <span>{formatGNF(subtotal)}</span>
              </div>
              {Number(discountInfo.replace(',', '')) > 0 && (
                <div className="total-row discount-row">
                  <span>{language === 'fr' ? 'Remise' : 'Discount'} :</span>
                  <span>-{formatGNF(Number(discountInfo.replace(',', '')))}</span>
                </div>
              )}
              <div className="receipt-line-dash" />
              <div className="total-row grand-total">
                <span>TOTAL :</span>
                <span>{formatGNF(order.total)}</span>
              </div>
              <div className="total-row payment-method">
                <span>{language === 'fr' ? 'Paiement' : 'Payment'} :</span>
                <span>{paymentLabels[paymentInfo] || paymentInfo}</span>
              </div>
            </div>

            {/* ===== Pied de page ===== */}
            <div className="receipt-line-solid" />
            <div className="receipt-footer">
              <p className="thanks-msg">{language === 'fr' ? 'Merci pour votre achat !' : 'Thank you for your purchase!'}</p>
              <p className="thanks-sub">{language === 'fr' ? 'Conservez ce reçu' : 'Keep this receipt'}</p>
              <div className="receipt-line-dash footer-divider" />
              <p className="powered-by">Propulsé par BoutikFlow</p>
              <p className="powered-url">www.boutikflow.com</p>
            </div>
          </div>
        </div>

        <div className="receipt-actions no-print">
          <button className="btn btn-ghost" onClick={onClose}>
            {language === 'fr' ? 'Fermer' : 'Close'}
          </button>
          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} /> {language === 'fr' ? 'Imprimer' : 'Print'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
