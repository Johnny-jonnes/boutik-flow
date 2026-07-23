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
    // 1. Create a temporary iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    // 2. Extract the ticket HTML
    const paperElement = document.querySelector(`.receipt-paper.${format}`);
    if (!paperElement) {
      window.print();
      return;
    }
    const paperHtml = paperElement.outerHTML;

    // 3. Collect active CSS stylesheets
    let stylesHtml = '';
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        let cssRules = '';
        for (let j = 0; j < sheet.cssRules.length; j++) {
          cssRules += sheet.cssRules[j].cssText + '\n';
        }
        stylesHtml += `<style>${cssRules}</style>`;
      } catch (e) {
        if (sheet.href) {
          stylesHtml += `<link rel="stylesheet" href="${sheet.href}">`;
        }
      }
    }

    // 4. Open document in iframe and inject markup
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${language === 'fr' ? 'Impression Reçu' : 'Print Receipt'}</title>
          ${stylesHtml}
          <style>
            @page {
              size: ${format === 'thermal' ? '80mm auto' : 'A4'};
              margin: ${format === 'thermal' ? '0' : '10mm 15mm'};
            }
            * {
              box-sizing: border-box !important;
            }
            body {
              background: #fff !important;
              color: #000 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .receipt-paper {
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
              background: #fff !important;
              color: #000 !important;
            }
            .receipt-paper.thermal {
              width: 74mm !important;
              max-width: 74mm !important;
              padding: 2mm 1mm !important;
              font-family: 'Courier New', Courier, monospace !important;
              font-size: 12px !important;
              line-height: 1.3 !important;
            }
            .receipt-paper.a4 {
              width: 100% !important;
              max-width: 100% !important;
              font-family: system-ui, -apple-system, sans-serif !important;
            }
          </style>
        </head>
        <body>
          ${paperHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    // 5. Trigger print from iframe focus
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 10000); // Clean up after 10s
      } catch (e) {
        window.print();
      }
    }, 500);
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
