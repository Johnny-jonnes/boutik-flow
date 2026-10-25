'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import { Printer, Download, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractPaymentMethod, extractDiscount } from '@/lib/saleNotes';
import { useTenantQuery } from '@/lib/queries';
import { initials } from '@/lib/format';
import './ReceiptModal.css';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    total: number;
    notes: string | null;
    // product_name (plat) est le champ réellement renvoyé par l'API pour
    // une commande existante (voir OrderItemResponse.product_name côté
    // backend) — product.name (imbriqué) n'est jamais peuplé que par le
    // POS, qui construit lui-même l'objet localement au moment de la
    // vente. Sans repli sur product_name, un reçu rouvert depuis
    // l'historique des Ventes affichait "Art. 1/2/3..." au lieu du vrai
    // nom de chaque article.
    items: { product_id: string; quantity: number; unit_price: number; product_name?: string | null; product?: { name: string } }[];
    client?: { name: string; phone: string } | null;
    created_at: string;
    status: string;
    // Structurés (Phase 4) — prioritaires sur le texte libre parsé dans
    // `notes` (extractPaymentMethod), qui reste le seul repli pour les
    // ventes antérieures à ces colonnes. Sans amount_paid_now, un reçu de
    // vente à crédit affichait le total comme intégralement encaissé.
    payment_method?: string | null;
    amount_paid_now?: number | null;
  };
  shopName: string;
  sellerName?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  shopName,
  sellerName,
}) => {
  const { language } = useLanguage();
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Logo de la boutique (Paramètres) — cache partagé avec le menu latéral.
  const { data: tenant } = useTenantQuery();
  const shopLogo = tenant?.logo || null;

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
            .shop-logo-img { display: block; width: 18mm; height: 18mm; object-fit: contain; margin: 0 auto 0.35rem auto; }
            .receipt-paper.a4 .shop-logo-img { width: 26mm; height: 26mm; }
            .shop-logo-placeholder { width: 28px; height: 28px; margin: 0 auto 0.35rem auto; background: #047857; color: white; font-weight: 800; font-size: 0.75rem; border-radius: 5px; display: flex; align-items: center; justify-content: center; }
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
  const paymentInfo = order.payment_method || extractPaymentMethod(order.notes);
  const discountAmount = extractDiscount(order.notes);

  // Vente à crédit (partielle ou 100% différée) : amount_paid_now < total.
  // Absent (vente comptant classique, ou ancien reçu antérieur à ce champ)
  // -> aucune mention, comportement inchangé.
  const hasAmountPaidNow = order.amount_paid_now !== undefined && order.amount_paid_now !== null;
  const amountPaidNow = hasAmountPaidNow ? Number(order.amount_paid_now) : order.total;
  const remainingAmount = Math.max(0, order.total - amountPaidNow);
  const isCreditSale = hasAmountPaidNow && remainingAmount > 0;

  const paymentLabels: Record<string, string> = {
    cash: language === 'fr' ? 'Espèces' : 'Cash',
    orange_money: 'Orange Money',
    card: language === 'fr' ? 'Carte bancaire' : 'Credit Card',
    transfer: language === 'fr' ? 'Virement' : 'Bank Transfer',
  };

  const clientName = order.client?.name || (language === 'fr' ? 'Client passant' : 'Walk-in customer');
  const pdfFileName = `Recu-${receiptNumber}.pdf`;

  // Capture le ticket tel qu'affiché (même DOM, même CSS que l'impression)
  // en image haute résolution puis l'intègre dans un vrai PDF — garantit
  // une fidélité visuelle totale avec le design du reçu sans dupliquer sa
  // mise en page dans un second moteur de rendu. Le format A4 est découpé
  // sur plusieurs pages si la vente compte trop d'articles pour tenir sur
  // une seule page.
  const buildReceiptPdf = async () => {
    const paperElement = document.querySelector(`.receipt-paper.${format}`) as HTMLElement | null;
    if (!paperElement) {
      throw new Error('receipt-paper introuvable');
    }

    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]);

    // Le logo boutique (data-URI) peut ne pas avoir fini de décoder au
    // moment où html2canvas capture le DOM — sans cette attente, le canvas
    // saisi le peint encore vide, ce qui cassait aussi la mise en page
    // autour (texte décalé comme si le logo n'existait pas).
    const images = Array.from(paperElement.querySelectorAll('img'));
    await Promise.all(images.map((img) => (
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      })
    )));

    const canvas = await html2canvas(paperElement, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      // `onclone` est le point d'entrée documenté d'html2canvas pour
      // ajuster SON propre clone interne (mis en page dans un iframe caché
      // avant la capture) — contrairement à une mutation de l'élément réel
      // ou un clone manuel détaché, essayés d'abord, qui perdaient les
      // valeurs des lignes alignées à droite (date, totaux) dans le rendu
      // final.
      onclone: (clonedDoc: Document) => {
        // Le format A4 est en `width: 100%` dans l'aperçu (CSS responsive,
        // pour rester lisible dans la modale sur mobile) — capturer
        // l'élément tel quel sur un petit écran saisissait un rendu étriqué
        // (~350px) puis l'étirait sur 210mm : texte énorme, proportions
        // cassées, et le contenu dépassait artificiellement une page.
        // Le but est que le PDF téléchargé garde exactement les mêmes
        // proportions que la fiche de reçu affichée à l'écran — donc on ne
        // touche à aucun espacement ici, seulement à la largeur de capture
        // (ci-dessous) et à un cas de mesure de texte cassé (plus bas).
        if (format === 'a4') {
          const clonedPaper = clonedDoc.querySelector(`.receipt-paper.${format}`) as HTMLElement | null;
          if (clonedPaper) {
            clonedPaper.style.width = '780px';
            clonedPaper.style.maxWidth = '780px';
          }
        }
        // Un emoji (ex: drapeau 🇬🇳 dans le nom de la boutique) est un
        // glyphe couleur que html2canvas mesure mal lors de son rendu texte
        // manuel, ce qui peut décaler la ligne du nom de la boutique.
        // Retiré uniquement pour la capture : l'aperçu et l'impression
        // affichent toujours le vrai nom, emoji compris.
        const shopNameEl = clonedDoc.querySelector('.shop-name') as HTMLElement | null;
        if (shopNameEl?.textContent) {
          shopNameEl.textContent = shopNameEl.textContent.replace(
            /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu,
            ''
          ).trim();
        }
        // Le retrait des emoji seul ne suffit pas toujours à empêcher le
        // chevauchement logo/nom sur certains appareils (polices système
        // différentes, rendu couleur des emoji variable selon l'OS) — on
        // isole donc clairement le logo en haut avec un espace généreux et
        // garanti avant le nom de la boutique, uniquement dans le PDF
        // généré.
        const logoEl = clonedDoc.querySelector('.shop-logo-img, .shop-logo-placeholder') as HTMLElement | null;
        if (logoEl) logoEl.style.marginBottom = '16px';
        if (shopNameEl) shopNameEl.style.marginTop = '20px';
      },
    });
    // JPEG plutôt que PNG : le décodeur PNG intégré à jsPDF a des limites
    // connues sur les images larges (le reçu capturé à l'échelle 3 dépasse
    // 2000px de large) — il produisait un PDF correct visuellement au
    // premier coup d'œil mais qui perdait silencieusement les valeurs
    // alignées à droite (date, totaux) et gonflait le fichier à plus de
    // 12 Mo (proche d'un bitmap brut non compressé). Le reçu n'a pas besoin
    // de transparence, JPEG évite entièrement ce chemin de code.
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    if (format === 'thermal') {
      const pageWidthMm = 80;
      const pageHeightMm = (canvas.height / canvas.width) * pageWidthMm;
      // jsPDF choisit l'orientation 'portrait' par défaut et, sans la
      // préciser explicitement, inverse silencieusement un format [largeur,
      // hauteur] personnalisé dès que la largeur dépasse la hauteur — la
      // page obtenue devient alors plus étroite que prévu et l'image
      // (dessinée à la largeur voulue) déborde hors de la page réelle,
      // coupant tout son côté droit (d'où les valeurs alignées à droite
      // disparues). Préciser l'orientation réelle l'empêche.
      const doc = new jsPDF({ unit: 'mm', format: [pageWidthMm, pageHeightMm], orientation: pageWidthMm > pageHeightMm ? 'l' : 'p' });
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, pageHeightMm);
      return doc;
    }

    // A4 : un reçu tient presque toujours largement sous une page standard
    // (297mm) — forcer systématiquement cette hauteur pleine laissait un
    // grand espace vide sous le contenu, surtout visible avec le logo en
    // en-tête. On ne garde une vraie page A4 fixe (donc paginée) que si le
    // contenu dépasse réellement cette hauteur ; sinon le PDF est taillé
    // exactement à la hauteur du reçu, comme le format thermique.
    const pageWidthMm = 210;
    const standardHeightMm = 297;
    const imgHeightMm = (canvas.height / canvas.width) * pageWidthMm;

    if (imgHeightMm <= standardHeightMm) {
      const doc = new jsPDF({ unit: 'mm', format: [pageWidthMm, imgHeightMm], orientation: pageWidthMm > imgHeightMm ? 'l' : 'p' });
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, imgHeightMm);
      return doc;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let remainingHeight = imgHeightMm;
    let offsetMm = 0;
    let first = true;
    while (remainingHeight > 0) {
      if (!first) doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, -offsetMm, pageWidthMm, imgHeightMm);
      remainingHeight -= standardHeightMm;
      offsetMm += standardHeightMm;
      first = false;
    }
    return doc;
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const doc = await buildReceiptPdf();
      doc.save(pdfFileName);
    } catch {
      toast.error(language === 'fr' ? 'Impossible de générer le PDF.' : 'Could not generate the PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSendToClient = async () => {
    setIsSending(true);
    try {
      const doc = await buildReceiptPdf();
      const blob = doc.output('blob');
      const file = new File([blob], pdfFileName, { type: 'application/pdf' });
      const shareText = language === 'fr'
        ? `Voici votre reçu ${shopName} (${receiptNumber}) — Total : ${formatGNF(order.total)}.`
        : `Here is your ${shopName} receipt (${receiptNumber}) — Total: ${formatGNF(order.total)}.`;

      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
      if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: language === 'fr' ? 'Reçu de vente' : 'Sales receipt',
          text: shareText,
        });
        return;
      }

      // Repli (bureau / navigateur sans partage de fichier) : on télécharge
      // le PDF puis, si le téléphone du client est connu, on ouvre WhatsApp
      // avec un message prêt — il ne reste qu'à joindre le fichier déjà
      // téléchargé, WhatsApp Web ne permettant pas de pré-attacher un
      // fichier depuis un lien.
      doc.save(pdfFileName);
      if (order.client?.phone) {
        const phoneDigits = order.client.phone.replace(/[^\d+]/g, '');
        const waText = encodeURIComponent(
          shareText + (language === 'fr'
            ? ' (PDF téléchargé — à joindre à ce message)'
            : ' (PDF downloaded — attach it to this message)')
        );
        window.open(`https://wa.me/${phoneDigits}?text=${waText}`, '_blank');
      } else {
        toast.success(language === 'fr' ? 'PDF téléchargé.' : 'PDF downloaded.');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        toast.error(language === 'fr' ? "Impossible d'envoyer le reçu." : 'Could not send the receipt.');
      }
    } finally {
      setIsSending(false);
    }
  };

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
              {shopLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shopLogo} alt={shopName} className="shop-logo-img" />
              ) : (
                <div className="shop-logo-placeholder">{initials(shopName)}</div>
              )}
              <h2 className="shop-name">{shopName}</h2>
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
                      {item.product?.name || item.product_name || `Art. ${index + 1}`}
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
                        <td className="col-desc">{item.product?.name || item.product_name || `Art. ${index + 1}`}</td>
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
              {discountAmount > 0 && (
                <div className="total-row discount-row">
                  <span>{language === 'fr' ? 'Remise' : 'Discount'} :</span>
                  <span>-{formatGNF(discountAmount)}</span>
                </div>
              )}
              <div className="receipt-line-dash" />
              <div className="total-row grand-total">
                <span>TOTAL :</span>
                <span>{formatGNF(order.total)}</span>
              </div>
              {isCreditSale && (
                <>
                  <div className="total-row">
                    <span>{language === 'fr' ? 'Payé maintenant' : 'Paid now'} :</span>
                    <span>{formatGNF(amountPaidNow)}</span>
                  </div>
                  <div className="total-row" style={{ color: '#dc2626', fontWeight: 700 }}>
                    <span>{language === 'fr' ? 'Reste dû (dette)' : 'Remaining (debt)'} :</span>
                    <span>{formatGNF(remainingAmount)}</span>
                  </div>
                </>
              )}
              <div className="total-row payment-method">
                <span>{language === 'fr' ? 'Paiement' : 'Payment'} :</span>
                <span>{paymentLabels[paymentInfo] || paymentInfo}</span>
              </div>
              {isCreditSale && (
                <div className="total-row" style={{ color: '#dc2626', fontWeight: 700, fontStyle: 'italic' }}>
                  <span>
                    {amountPaidNow <= 0
                      ? (language === 'fr' ? '⚠ VENTE ENTIÈREMENT À CRÉDIT' : '⚠ FULLY DEFERRED CREDIT SALE')
                      : (language === 'fr' ? '⚠ VENTE À CRÉDIT — PAIEMENT PARTIEL' : '⚠ CREDIT SALE — PARTIAL PAYMENT')}
                  </span>
                  <span></span>
                </div>
              )}
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
          <button
            className="btn btn-secondary"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {isExportingPdf ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
            {language === 'fr' ? 'Télécharger PDF' : 'Download PDF'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSendToClient}
            disabled={isSending}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {isSending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            {language === 'fr' ? 'Envoyer au client' : 'Send to customer'}
          </button>
          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} /> {language === 'fr' ? 'Imprimer' : 'Print'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
