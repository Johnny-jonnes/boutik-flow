'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
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

  const formatGNF = (amount: number, compact = false) => {
    const num = new Intl.NumberFormat('fr-FR').format(amount);
    return compact ? num : `${num} GNF`;
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
    // Get the receipt paper HTML
    const paperElement = document.querySelector(`.receipt-paper.${format}`);
    if (!paperElement) {
      toast.error(language === 'fr' ? 'Impossible de trouver le ticket à imprimer.' : 'Could not find the receipt to print.');
      return;
    }
    const paperHtml = paperElement.outerHTML;

    // Collect all CSS
    let stylesHtml = '';
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        let cssRules = '';
        for (let j = 0; j < sheet.cssRules.length; j++) {
          cssRules += sheet.cssRules[j].cssText + '\n';
        }
        stylesHtml += `<style>${cssRules}</style>`;
      } catch {
        if (sheet.href) stylesHtml += `<link rel="stylesheet" href="${sheet.href}">`;
      }
    }

    // Open a new popup window
    const popup = window.open('', '_blank', `width=600,height=800,toolbar=0,scrollbars=1,status=0,resizable=1`);
    if (!popup) {
      toast.error(language === 'fr' ? 'Le navigateur a bloqué la fenêtre d\'impression. Autorisez les popups pour ce site.' : 'Browser blocked the print popup. Please allow popups for this site.');
      return;
    }

    const isA4 = format === 'a4';
    popup.document.open();
    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${language === 'fr' ? 'Reçu de vente' : 'Sales Receipt'}</title>
          ${stylesHtml}
          <style>
            @page {
              size: ${isA4 ? 'A4' : '80mm auto'};
              margin: 0;
            }
            * { box-sizing: border-box !important; }
            html, body {
              background: #fff !important;
              color: #000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            .receipt-paper {
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
              background: #fff !important;
              color: #000 !important;
              overflow: visible !important;
            }
            .receipt-paper.thermal {
              width: 80mm !important;
              max-width: 80mm !important;
              min-width: 80mm !important;
              padding: 3mm 2mm !important;
              font-family: 'Courier New', Courier, monospace !important;
              font-size: 10pt !important;
              line-height: 1.35 !important;
            }
            .receipt-paper.a4 {
              width: 100% !important;
              max-width: 210mm !important;
              padding: 12mm 15mm !important;
              font-family: system-ui, -apple-system, sans-serif !important;
            }
            .thermal-items { width: 100%; }
            .thermal-item { margin-bottom: 0.3rem; border-bottom: 1px dotted #d1d5db; padding-bottom: 0.25rem; }
            .thermal-item-name { font-weight: 600; font-size: 0.92em; margin-bottom: 0.1rem; word-break: break-word; }
            .thermal-item-detail { display: flex; justify-content: space-between; font-size: 0.88em; }
            .thermal-item-detail span:last-child { font-weight: 700; white-space: nowrap; margin-left: 0.3rem; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 0.22rem; }
            .total-row span:last-child { white-space: nowrap; }
            .grand-total { font-weight: 800; }
            .discount-row { color: #dc2626; }
            .payment-method { color: #4b5563; font-style: italic; font-size: 0.88em; }
            .meta-row { display: flex; justify-content: space-between; margin-bottom: 0.18rem; gap: 0.4rem; }
            .receipt-line-solid { border: none; border-bottom: 1px solid #111827; margin: 0.35rem 0; width: 100%; }
            .receipt-line-dash { border: none; border-bottom: 1px dashed #9ca3af; margin: 0.35rem 0; width: 100%; }
            .receipt-header { text-align: center; margin-bottom: 0.6rem; }
            .shop-name { font-weight: 800; text-transform: uppercase; margin: 0 0 0.15rem 0; }
            .receipt-title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
            .receipt-totals { padding: 0.3rem 0; }
            .receipt-footer { text-align: center; padding-top: 0.35rem; }
            .thanks-msg { font-weight: 700; margin: 0.35rem 0 0 0; }
            .thanks-sub { font-size: 0.78em; color: #6b7280; margin: 0.08rem 0 0.35rem 0; }
            .powered-by { font-size: 0.68em; color: #9ca3af; margin: 0.15rem 0 0 0; font-weight: 600; }
            .powered-url { font-size: 0.62em; color: #9ca3af; margin: 0; }
            .shop-logo-placeholder { width: 28px; height: 28px; margin: 0 auto 0.35rem auto; background: #047857; color: white; font-weight: 800; font-size: 0.75rem; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
            .shop-detail { margin: 0; color: #4b5563; font-size: 0.82em; }
            .strong { font-weight: 700; }
            .items-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .items-table th { text-align: left; font-weight: 700; padding: 0.3rem 0.2rem; border-bottom: 1px solid #111827; font-size: 0.78em; text-transform: uppercase; }
            .items-table td { padding: 0.3rem 0.2rem; border-bottom: 1px dotted #d1d5db; font-size: 0.9em; word-break: break-word; }
            .col-desc { width: 44%; } .col-qty { width: 10%; text-align: center; } .col-price { width: 23%; text-align: right; } .col-total { width: 23%; text-align: right; font-weight: 600; }
          </style>
        </head>
        <body>
          ${paperHtml}
        </body>
      </html>
    `);
    popup.document.close();

    // Wait for popup to load then print
    popup.onload = () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
        setTimeout(() => popup.close(), 1000);
      }, 200);
    };

    // Fallback if onload doesn't fire
    setTimeout(() => {
      if (!popup.closed) {
        popup.focus();
        popup.print();
        setTimeout(() => { if (!popup.closed) popup.close(); }, 2000);
      }
    }, 800);
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
            {format === 'thermal' ? (
              /* Layout thermique : 2 lignes par article pour éviter le débordement */
              <div className="thermal-items">
                {order.items?.map((item, index) => (
                  <div key={index} className="thermal-item">
                    <div className="thermal-item-name">
                      {item.product?.name || `Art. ${index + 1}`}
                    </div>
                    <div className="thermal-item-detail">
                      <span>{item.quantity} × {formatGNF(item.unit_price || 0, true)}</span>
                      <span>= {formatGNF((item.unit_price || 0) * item.quantity, true)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Layout A4 : tableau classique à 4 colonnes */
              <div className="receipt-items">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th className="col-desc">Article</th>
                      <th className="col-qty">Qté</th>
                      <th className="col-price">P.U. (GNF)</th>
                      <th className="col-total">Total (GNF)</th>
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
            )}

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
