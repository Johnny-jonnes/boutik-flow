'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { Printer } from 'lucide-react';

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
    <Modal isOpen={isOpen} onClose={onClose} title={t('receipt.title')}>
      <div className="receipt-modal-content">
        <div className="format-selector no-print">
          <span className="format-label">{t('receipt.format')} :</span>
          <div className="format-buttons">
            <button
              className={`format-btn ${format === 'thermal' ? 'format-btn--active' : ''}`}
              onClick={() => setFormat('thermal')}
            >
              {t('receipt.thermal')}
            </button>
            <button
              className={`format-btn ${format === 'a4' ? 'format-btn--active' : ''}`}
              onClick={() => setFormat('a4')}
            >
              {t('receipt.a4')}
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
              <p className="receipt-title">{t('receipt.title').toUpperCase()}</p>
              <div className="receipt-line-dash" />
            </div>

            {/* ===== Informations Transaction ===== */}
            <div className="receipt-meta">
              <div className="meta-row">
                <span>{t('receipt.number')}</span>
                <span className="strong">{receiptNumber}</span>
              </div>
              <div className="meta-row">
                <span>{t('receipt.date')} :</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              {sellerName && (
                <div className="meta-row">
                  <span>{t('receipt.seller')} :</span>
                  <span>{sellerName}</span>
                </div>
              )}
              <div className="meta-row">
                <span>{t('receipt.client')} :</span>
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
                    <th className="col-desc">{t('receipt.product')}</th>
                    <th className="col-qty">{t('receipt.qty')}</th>
                    <th className="col-price">{t('receipt.unit_price')}</th>
                    <th className="col-total">{t('receipt.subtotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, index) => (
                    <tr key={index}>
                      <td className="col-desc">{item.product?.name || `Art. ${index + 1}`}</td>
                      <td className="col-qty">{item.quantity}</td>
                      <td className="col-price">{formatGNF(item.unit_price || 0)}</td>
                      <td className="col-total">{formatGNF((item.unit_price || 0) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ===== Totaux ===== */}
            <div className="receipt-line-solid" />
            <div className="receipt-totals">
              <div className="total-row">
                <span>{t('receipt.subtotal')} ({order.items?.length || 0}) :</span>
                <span>{formatGNF(subtotal)}</span>
              </div>
              {Number(discountInfo.replace(',', '')) > 0 && (
                <div className="total-row discount-row">
                  <span>Remise :</span>
                  <span>-{formatGNF(Number(discountInfo.replace(',', '')))}</span>
                </div>
              )}
              <div className="receipt-line-dash" />
              <div className="total-row grand-total">
                <span>{t('receipt.total')} :</span>
                <span>{formatGNF(order.total)}</span>
              </div>
              <div className="total-row payment-method">
                <span>{t('receipt.payment')} :</span>
                <span>{paymentLabels[paymentInfo] || paymentInfo}</span>
              </div>
            </div>

            {/* ===== Pied de page ===== */}
            <div className="receipt-line-solid" />
            <div className="receipt-footer">
              <p className="thanks-msg">{t('receipt.thanks')}</p>
              <p className="thanks-sub">Thank you for your purchase!</p>
              <div className="receipt-line-dash footer-divider" />
              <p className="powered-by">Propulsé par BoutikFlow</p>
              <p className="powered-url">www.boutikflow.com</p>
            </div>
          </div>
        </div>

        <div className="modal-actions no-print">
          <button className="btn btn-ghost" onClick={onClose}>
            {language === 'fr' ? 'Fermer' : 'Close'}
          </button>
          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} /> {t('receipt.print')}
          </button>
        </div>
      </div>

      <style jsx>{`
        .receipt-modal-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .format-selector {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .format-label {
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        .format-buttons {
          display: flex;
          gap: 0.25rem;
          background: var(--surface-2);
          padding: 0.2rem;
          border-radius: 8px;
        }
        .format-btn {
          padding: 0.4rem 0.8rem;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .format-btn--active {
          background: var(--color-brand-500);
          color: white;
        }
        .receipt-preview-container {
          background: #d1d5db;
          padding: 1.5rem;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          max-height: 60vh;
          overflow-y: auto;
        }
        
        /* ── Receipt Paper ─── */
        .receipt-paper {
          background: #ffffff;
          color: #111827;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          box-sizing: border-box;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        
        .receipt-paper.thermal {
          width: 80mm;
          max-width: 100%;
          padding: 6mm 4mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.4;
        }
        
        .receipt-paper.a4 {
          width: 210mm;
          max-width: 100%;
          padding: 12mm 15mm;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          font-size: 13px;
          line-height: 1.5;
        }
        
        /* ── Header ─── */
        .receipt-header {
          text-align: center;
          margin-bottom: 0.75rem;
        }
        .shop-logo-placeholder {
          width: 42px;
          height: 42px;
          margin: 0 auto 0.4rem auto;
          background: #047857;
          color: white;
          font-weight: 800;
          font-size: 1.1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .receipt-paper.thermal .shop-logo-placeholder {
          width: 32px;
          height: 32px;
          font-size: 0.85rem;
          border-radius: 6px;
        }
        .shop-name {
          font-weight: 800;
          text-transform: uppercase;
          margin: 0 0 0.2rem 0;
          letter-spacing: 0.03em;
        }
        .receipt-paper.thermal .shop-name { font-size: 1.05rem; }
        .receipt-paper.a4 .shop-name { font-size: 1.5rem; }
        .shop-detail {
          margin: 0;
          color: #4b5563;
          font-size: 0.85em;
        }
        .receipt-title {
          font-weight: 700;
          margin: 0.4rem 0 0.2rem 0;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .receipt-paper.thermal .receipt-title { font-size: 0.95em; }
        .receipt-paper.a4 .receipt-title { font-size: 1.1em; }
        
        /* ── Dividers ─── */
        .receipt-line-solid {
          border-bottom: 1px solid #111827;
          margin: 0.4rem 0;
          width: 100%;
        }
        
        .receipt-line-dash {
          border-bottom: 1px dashed #9ca3af;
          margin: 0.4rem 0;
          width: 100%;
        }
        
        /* ── Meta ─── */
        .receipt-meta {
          margin: 0.5rem 0;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.2rem;
          gap: 0.5rem;
        }
        .meta-row span:first-child {
          color: #4b5563;
        }
        .strong { font-weight: 700; }
        
        /* ── Items Table ─── */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .items-table th {
          text-align: left;
          font-weight: 700;
          padding: 0.3rem 0;
          border-bottom: 1px solid #111827;
          font-size: 0.8em;
          text-transform: uppercase;
        }
        .items-table td {
          padding: 0.3rem 0;
          border-bottom: 1px dotted #d1d5db;
          font-size: 0.9em;
          word-break: break-word;
        }
        .col-desc { width: 40%; }
        .col-qty { width: 12%; text-align: center; }
        .col-price { width: 24%; text-align: right; }
        .col-total { width: 24%; text-align: right; font-weight: 600; }
        .items-table td.col-qty, .items-table th.col-qty { text-align: center; }
        .items-table td.col-price, .items-table th.col-price,
        .items-table td.col-total, .items-table th.col-total { text-align: right; }
        
        /* ── Totals ─── */
        .receipt-totals {
          padding: 0.4rem 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.25rem;
        }
        .discount-row { color: #dc2626; }
        .grand-total {
          font-weight: 800;
          padding: 0.4rem 0;
        }
        .receipt-paper.thermal .grand-total { font-size: 1.1em; }
        .receipt-paper.a4 .grand-total { font-size: 1.25em; }
        .payment-method {
          color: #4b5563;
          font-style: italic;
          font-size: 0.9em;
        }
        
        /* ── Footer ─── */
        .receipt-footer {
          text-align: center;
          padding-top: 0.4rem;
        }
        .thanks-msg {
          font-weight: 700;
          margin: 0.4rem 0 0 0;
        }
        .receipt-paper.thermal .thanks-msg { font-size: 0.95em; }
        .receipt-paper.a4 .thanks-msg { font-size: 1.05em; }
        .thanks-sub {
          font-weight: 400;
          font-size: 0.8em;
          color: #6b7280;
          margin: 0.1rem 0 0.4rem 0;
        }
        .footer-divider { margin-top: 0.4rem; }
        .powered-by {
          font-size: 0.7em;
          color: #9ca3af;
          margin: 0.2rem 0 0 0;
          font-weight: 600;
        }
        .powered-url {
          font-size: 0.65em;
          color: #9ca3af;
          margin: 0;
        }
        
        /* ── Actions ─── */
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        
        /* ── Print ─── */
        @media print {
          body * { visibility: hidden; }
          .receipt-paper, .receipt-paper * { visibility: visible; }
          .receipt-paper {
            position: absolute;
            left: 0; top: 0;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .receipt-paper.thermal {
            width: 80mm;
            padding: 2mm 3mm;
          }
          .receipt-paper.a4 {
            width: 100%;
            padding: 10mm 15mm;
          }
          .no-print { display: none !important; }
          @page { margin: 0; }
        }
      `}</style>
    </Modal>
  );
};
