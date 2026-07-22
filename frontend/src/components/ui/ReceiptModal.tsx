'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { Printer, Download } from 'lucide-react';

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
  const { t } = useLanguage();
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');

  const formatGNF = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const formatDate = (isoString: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
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
  const subtotal = order.items.reduce((acc, item) => acc + (item.unit_price || 0) * item.quantity, 0);
  const paymentInfo = order.notes?.match(/Mode de paiement:\s*(\w+)/)?.[1] || 'Cash';
  const discountInfo = order.notes?.match(/Remise:\s*([\d,]+)/)?.[1] || '0';

  const paymentLabels: Record<string, string> = {
    cash: 'Espèces',
    orange_money: 'Orange Money',
    card: 'Carte bancaire',
    transfer: 'Virement',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reçu de vente">
      <div className="receipt-modal-content">
        <div className="format-selector no-print">
          <span className="format-label">Format :</span>
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
              Reçu A4
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
              <div className="receipt-divider">{'='.repeat(format === 'thermal' ? 40 : 60)}</div>
              <p className="receipt-title">REÇU DE VENTE</p>
              <div className="receipt-divider-dash">{'- '.repeat(format === 'thermal' ? 20 : 30)}</div>
            </div>

            {/* ===== Informations de la Transaction ===== */}
            <div className="receipt-meta">
              <div className="meta-row">
                <span>N° Reçu :</span>
                <span className="strong">{receiptNumber}</span>
              </div>
              <div className="meta-row">
                <span>Date :</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              {sellerName && (
                <div className="meta-row">
                  <span>Vendeur :</span>
                  <span>{sellerName}</span>
                </div>
              )}
              {order.client?.name && (
                <div className="meta-row">
                  <span>Client :</span>
                  <span>{order.client.name}</span>
                </div>
              )}
              {order.client?.phone && (
                <div className="meta-row">
                  <span>Tél. Client :</span>
                  <span>{order.client.phone}</span>
                </div>
              )}
            </div>

            <div className="receipt-divider-dash">{'- '.repeat(format === 'thermal' ? 20 : 30)}</div>

            {/* ===== Articles ===== */}
            <div className="receipt-items">
              <table className="items-table">
                <thead>
                  <tr>
                    <th className="col-desc">Article</th>
                    <th className="col-qty">Qté</th>
                    <th className="col-price">P.U.</th>
                    <th className="col-total">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index}>
                      <td className="col-desc">{item.product?.name || `Art. ${(index + 1)}`}</td>
                      <td className="col-qty">{item.quantity}</td>
                      <td className="col-price">{formatGNF(item.unit_price || 0)}</td>
                      <td className="col-total">{formatGNF((item.unit_price || 0) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ===== Récapitulatif Financier ===== */}
            <div className="receipt-divider">{'='.repeat(format === 'thermal' ? 40 : 60)}</div>
            <div className="receipt-totals">
              <div className="total-row">
                <span>Sous-total ({order.items.length} article{order.items.length > 1 ? 's' : ''}) :</span>
                <span>{formatGNF(subtotal)}</span>
              </div>
              {Number(discountInfo.replace(',', '')) > 0 && (
                <div className="total-row discount-row">
                  <span>Remise :</span>
                  <span>-{formatGNF(Number(discountInfo.replace(',', '')))}</span>
                </div>
              )}
              <div className="receipt-divider-dash">{'- '.repeat(format === 'thermal' ? 20 : 30)}</div>
              <div className="total-row grand-total">
                <span>TOTAL A PAYER :</span>
                <span>{formatGNF(order.total)}</span>
              </div>
              <div className="total-row payment-method">
                <span>Mode de paiement :</span>
                <span>{paymentLabels[paymentInfo] || paymentInfo}</span>
              </div>
            </div>

            {/* ===== Pied de Page ===== */}
            <div className="receipt-divider">{'='.repeat(format === 'thermal' ? 40 : 60)}</div>
            <div className="receipt-footer">
              <p className="thanks-msg">Merci pour votre confiance !</p>
              <p className="thanks-sub">Thank you for your purchase!</p>
              <div className="receipt-divider-dash footer-divider">{'- '.repeat(format === 'thermal' ? 20 : 30)}</div>
              <p className="powered-by">Propulsé par BoutikFlow</p>
              <p className="powered-url">www.boutikflow.com</p>
            </div>
          </div>
        </div>

        <div className="modal-actions no-print">
          <button className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} /> Imprimer
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
        }
        
        .receipt-paper.thermal {
          width: 80mm;
          padding: 8mm 5mm;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.5;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        
        .receipt-paper.a4 {
          width: 210mm;
          max-width: 100%;
          padding: 15mm 20mm;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          font-size: 13px;
          line-height: 1.6;
        }
        
        /* ── Header ─── */
        .receipt-header {
          text-align: center;
          margin-bottom: 1rem;
        }
        .shop-logo-placeholder {
          width: 48px;
          height: 48px;
          margin: 0 auto 0.5rem auto;
          background: #047857;
          color: white;
          font-weight: 800;
          font-size: 1.2rem;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .receipt-paper.thermal .shop-logo-placeholder {
          width: 36px;
          height: 36px;
          font-size: 0.9rem;
          border-radius: 6px;
        }
        .shop-name {
          font-weight: 800;
          text-transform: uppercase;
          margin: 0 0 0.25rem 0;
          letter-spacing: 0.05em;
        }
        .receipt-paper.thermal .shop-name { font-size: 1.1rem; }
        .receipt-paper.a4 .shop-name { font-size: 1.6rem; }
        .shop-detail {
          margin: 0;
          color: #4b5563;
          font-size: 0.9em;
        }
        .receipt-title {
          font-weight: 700;
          margin: 0.5rem 0 0 0;
          letter-spacing: 0.1em;
        }
        .receipt-paper.thermal .receipt-title { font-size: 1em; }
        .receipt-paper.a4 .receipt-title { font-size: 1.15em; }
        
        /* ── Dividers ─── */
        .receipt-divider,
        .receipt-divider-dash {
          text-align: center;
          color: #9ca3af;
          margin: 0.5rem 0;
          font-size: 0.7em;
          overflow: hidden;
          white-space: nowrap;
          letter-spacing: -0.05em;
        }
        
        /* ── Meta ─── */
        .receipt-meta {
          margin: 0.75rem 0;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.2rem;
          gap: 0.5rem;
        }
        .meta-row span:first-child {
          color: #6b7280;
        }
        .strong { font-weight: 700; }
        
        /* ── Items Table ─── */
        .items-table {
          width: 100%;
          border-collapse: collapse;
        }
        .items-table th {
          text-align: left;
          font-weight: 700;
          padding: 0.4rem 0;
          border-bottom: 1px solid #111;
          font-size: 0.85em;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .items-table td {
          padding: 0.35rem 0;
          border-bottom: 1px dotted #d1d5db;
          word-break: break-word;
        }
        .col-desc { width: 42%; }
        .col-qty { width: 12%; text-align: center; }
        .col-price { width: 23%; text-align: right; }
        .col-total { width: 23%; text-align: right; font-weight: 600; }
        .items-table td.col-qty, .items-table th.col-qty { text-align: center; }
        .items-table td.col-price, .items-table th.col-price,
        .items-table td.col-total, .items-table th.col-total { text-align: right; }
        
        /* ── Totals ─── */
        .receipt-totals {
          padding: 0.5rem 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.3rem;
        }
        .discount-row { color: #dc2626; }
        .grand-total {
          font-weight: 800;
          padding: 0.5rem 0;
        }
        .receipt-paper.thermal .grand-total { font-size: 1.15em; }
        .receipt-paper.a4 .grand-total { font-size: 1.3em; }
        .payment-method {
          color: #6b7280;
          font-style: italic;
        }
        
        /* ── Footer ─── */
        .receipt-footer {
          text-align: center;
          padding-top: 0.5rem;
        }
        .thanks-msg {
          font-weight: 700;
          margin: 0.5rem 0 0 0;
        }
        .receipt-paper.thermal .thanks-msg { font-size: 1em; }
        .receipt-paper.a4 .thanks-msg { font-size: 1.1em; }
        .thanks-sub {
          font-weight: 400;
          font-size: 0.85em;
          color: #6b7280;
          margin: 0.15rem 0 0.5rem 0;
        }
        .footer-divider { margin-top: 0.5rem; }
        .powered-by {
          font-size: 0.75em;
          color: #9ca3af;
          margin: 0.25rem 0 0 0;
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
