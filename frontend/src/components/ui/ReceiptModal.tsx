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
  sellerName?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  shopName,
  shopPhone,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aperçu du reçu">
      <div className="receipt-modal-content">
        <div className="format-selector no-print">
          <span className="format-label">Format:</span>
          <div className="format-buttons">
            <button
              className={`btn btn-sm ${format === 'thermal' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFormat('thermal')}
            >
              Thermique (80mm)
            </button>
            <button
              className={`btn btn-sm ${format === 'a4' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFormat('a4')}
            >
              A4
            </button>
          </div>
        </div>

        <div className="receipt-preview-container">
          <div className={`receipt-paper ${format}`}>
            {/* Header */}
            <div className="receipt-header">
              <h2 className="shop-name">{shopName}</h2>
              {shopPhone && <p className="shop-info">Tel: {shopPhone}</p>}
              <p className="receipt-title">REÇU DE VENTE</p>
            </div>

            {/* Meta */}
            <div className="receipt-meta">
              <div className="meta-row">
                <span>N°:</span>
                <span className="strong">{receiptNumber}</span>
              </div>
              <div className="meta-row">
                <span>Date:</span>
                <span>{formatDate(order.created_at)}</span>
              </div>
              {sellerName && (
                <div className="meta-row">
                  <span>Caissier:</span>
                  <span>{sellerName}</span>
                </div>
              )}
              {order.client?.name && (
                <div className="meta-row">
                  <span>Client:</span>
                  <span>{order.client.name} {order.client.phone ? `- ${order.client.phone}` : ''}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="receipt-items">
              <table className="items-table">
                <thead>
                  <tr>
                    <th className="col-desc">Article</th>
                    <th className="col-qty">Qté</th>
                    <th className="col-price">P.U</th>
                    <th className="col-total">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={index}>
                      <td className="col-desc">{item.product?.name || `Produit ${item.product_id.slice(0, 4)}`}</td>
                      <td className="col-qty">{item.quantity}</td>
                      <td className="col-price">{formatGNF(item.unit_price || 0)}</td>
                      <td className="col-total">{formatGNF((item.unit_price || 0) * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="receipt-totals">
              <div className="total-row grand-total">
                <span>Total à payer:</span>
                <span>{formatGNF(order.total)}</span>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="receipt-notes">
                <p><strong>Notes:</strong> {order.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="receipt-footer">
              <p>Merci pour votre achat!</p>
              <p className="sub-footer">Thank you for your purchase!</p>
            </div>
          </div>
        </div>

        <div className="modal-actions no-print" style={{ marginTop: '1.5rem' }}>
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
          margin-bottom: 1rem;
        }
        
        .format-label {
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .format-buttons {
          display: flex;
          gap: 0.5rem;
          background: var(--surface-2);
          padding: 0.25rem;
          border-radius: 8px;
        }
        
        .receipt-preview-container {
          background: #e5e7eb;
          padding: 2rem;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          max-height: 60vh;
          overflow-y: auto;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .receipt-paper {
          background: #ffffff;
          color: #000000;
          padding: 1.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        .receipt-paper.thermal {
          width: 80mm;
          margin: 0 auto;
          font-family: monospace, sans-serif;
          font-size: 12px;
        }
        
        .receipt-paper.a4 {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 20mm;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
        }
        
        .receipt-header {
          text-align: center;
          margin-bottom: 1.5rem;
          border-bottom: 1px dashed #000;
          padding-bottom: 1rem;
        }
        
        .shop-name {
          font-size: 1.5em;
          font-weight: 700;
          margin: 0 0 0.25rem 0;
          text-transform: uppercase;
        }
        
        .shop-info {
          margin: 0 0 0.5rem 0;
          color: #333;
        }
        
        .receipt-title {
          font-size: 1.2em;
          font-weight: 600;
          margin: 0;
        }
        
        .receipt-meta {
          margin-bottom: 1.5rem;
        }
        
        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.25rem;
        }
        
        .strong {
          font-weight: 700;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.5rem;
        }
        
        .items-table th,
        .items-table td {
          padding: 0.5rem 0;
          border-bottom: 1px dashed #ccc;
        }
        
        .items-table th {
          text-align: left;
          font-weight: 600;
          border-bottom: 1px solid #000;
        }
        
        .col-desc { width: 45%; }
        .col-qty { width: 15%; text-align: center; }
        .col-price { width: 20%; text-align: right; }
        .col-total { width: 20%; text-align: right; }
        
        .items-table td.col-qty,
        .items-table th.col-qty { text-align: center; }
        
        .items-table td.col-price,
        .items-table th.col-price,
        .items-table td.col-total,
        .items-table th.col-total { text-align: right; }
        
        .receipt-totals {
          border-top: 1px solid #000;
          padding-top: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        
        .grand-total {
          font-size: 1.2em;
          font-weight: 700;
        }
        
        .receipt-notes {
          margin-bottom: 1.5rem;
          padding: 0.75rem;
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 4px;
        }
        
        .receipt-notes p {
          margin: 0;
          font-size: 0.9em;
        }
        
        .receipt-footer {
          text-align: center;
          margin-top: 2rem;
          border-top: 1px dashed #000;
          padding-top: 1rem;
          font-weight: 600;
        }
        
        .sub-footer {
          font-weight: 400;
          font-size: 0.9em;
          color: #555;
          margin-top: 0.25rem;
        }
        
        @media print {
          body * {
            visibility: hidden;
          }
          
          .receipt-paper,
          .receipt-paper * {
            visibility: visible;
          }
          
          .receipt-paper {
            position: absolute;
            left: 0;
            top: 0;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          @page {
            margin: 0;
          }
        }
      `}</style>
    </Modal>
  );
};
