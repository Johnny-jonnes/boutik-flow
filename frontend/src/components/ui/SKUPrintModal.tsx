'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Printer, Download, Grid, Tag } from 'lucide-react';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';

interface SKUPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    price: number;
  };
}

export const SKUPrintModal: React.FC<SKUPrintModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [labelFormat, setLabelFormat] = useState<'thermal_single' | 'grid_a4_24' | 'grid_a4_40'>('thermal_single');
  const [copies, setCopies] = useState<number>(labelFormat === 'thermal_single' ? 1 : 24);
  const printRef = useRef<HTMLDivElement>(null);

  const skuCode = product.sku || product.barcode || `SKU-${product.id.slice(0, 8).toUpperCase()}`;

  // Vrai code-barres Code128 (encode SKU alphanumérique aussi bien qu'un
  // code-barres numérique) — remplace l'ancien motif de rayures purement
  // décoratif qui n'encodait aucune donnée et ne pouvait jamais être
  // scanné en caisse. Généré une seule fois par code et réutilisé comme
  // image dans toutes les étiquettes répétées de la planche.
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, skuCode, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height: 45,
        width: 2,
      });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setBarcodeDataUrl('');
    }
  }, [skuCode]);

  const formatGNF = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPNG = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 400;
      canvas.height = 260;

      // Fond blanc
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bordure
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

      // Nom produit
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(product.name.slice(0, 24), canvas.width / 2, 38);

      // Vrai code-barres Code128 (scannable), composé sur le canvas de
      // l'étiquette — remplace l'ancienne simulation de rayures qui
      // n'encodait aucune donnée réelle.
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, skuCode, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 18,
        margin: 0,
        height: 55,
        width: 2.4,
      });
      const drawWidth = Math.min(320, barcodeCanvas.width);
      const scale = drawWidth / barcodeCanvas.width;
      const drawHeight = barcodeCanvas.height * scale;
      const barcodeY = 52;
      ctx.drawImage(barcodeCanvas, (canvas.width - drawWidth) / 2, barcodeY, drawWidth, drawHeight);

      // Prix
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(formatGNF(product.price), canvas.width / 2, barcodeY + drawHeight + 28);

      const link = document.createElement('a');
      link.download = `SKU_${skuCode}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Étiquette SKU téléchargée avec succès !');
    } catch {
      toast.error('Erreur lors de la génération de l\'étiquette');
    }
  };

  if (!product) return null;

  const labelsArray = Array.from({ length: copies });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Impression & Export Étiquettes SKU">
      <div className="sku-modal-content">
        <div className="format-options no-print">
          <div className="option-group">
            <label className="option-label">Format de l'étiquette :</label>
            <div className="btn-group">
              <button
                className={`btn btn-sm ${labelFormat === 'thermal_single' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setLabelFormat('thermal_single'); setCopies(1); }}
              >
                <Tag size={15} /> Thermique (Unique 50x30mm)
              </button>
              <button
                className={`btn btn-sm ${labelFormat === 'grid_a4_24' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setLabelFormat('grid_a4_24'); setCopies(24); }}
              >
                <Grid size={15} /> Planche A4 (24 étiquettes)
              </button>
              <button
                className={`btn btn-sm ${labelFormat === 'grid_a4_40' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setLabelFormat('grid_a4_40'); setCopies(40); }}
              >
                <Grid size={15} /> Planche A4 (40 étiquettes)
              </button>
            </div>
          </div>

          <div className="option-group" style={{ marginTop: '0.75rem' }}>
            <label className="option-label">Nombre d'exemplaires :</label>
            <input
              type="number"
              min="1"
              max="200"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="input"
              style={{ width: '100px', padding: '0.35rem 0.6rem' }}
            />
          </div>
        </div>

        {/* Zone d'aperçu d'impression */}
        <div className="sku-preview-container">
          <div ref={printRef} className={`sku-paper ${labelFormat}`}>
            {labelsArray.map((_, i) => (
              <div key={i} className="sku-card-item">
                <span className="sku-prod-name">{product.name}</span>
                <div className="sku-barcode-sim">
                  {barcodeDataUrl ? (
                    <img src={barcodeDataUrl} alt={skuCode} className="barcode-img" />
                  ) : (
                    <div className="bars-graphic" />
                  )}
                  <span className="sku-code-text">{skuCode}</span>
                </div>
                <span className="sku-prod-price">{formatGNF(product.price)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions no-print" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem' }}>
          <button className="btn btn-ghost" onClick={handleDownloadPNG} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={16} /> Télécharger Image (PNG)
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
            <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Printer size={16} /> Imprimer ({copies})
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sku-modal-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .option-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .option-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .btn-group {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .sku-preview-container {
          background: #d1d5db;
          padding: 1.5rem;
          border-radius: 8px;
          display: flex;
          justify-content: center;
          max-height: 55vh;
          overflow-y: auto;
        }
        .sku-paper {
          background: white;
          color: black;
          box-shadow: 0 4px 10px rgba(0,0,0,0.15);
        }

        .sku-paper.thermal_single {
          width: 60mm;
          padding: 6mm;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .sku-paper.grid_a4_24 {
          width: 210mm;
          min-height: 297mm;
          padding: 10mm;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8mm;
        }

        .sku-paper.grid_a4_40 {
          width: 210mm;
          min-height: 297mm;
          padding: 8mm;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 5mm;
        }

        .sku-card-item {
          border: 1px solid #111;
          border-radius: 6px;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: #ffffff;
        }

        .sku-prod-name {
          font-weight: 700;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .sku-barcode-sim {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0.3rem 0;
          width: 100%;
        }

        .bars-graphic {
          width: 80%;
          height: 28px;
          background: repeating-linear-gradient(
            90deg,
            #000 0px, #000 2px,
            #fff 2px, #fff 4px,
            #000 4px, #000 7px
          );
        }

        .barcode-img {
          width: 80%;
          max-width: 160px;
          height: 28px;
          object-fit: contain;
          image-rendering: pixelated;
        }

        .sku-code-text {
          font-family: monospace;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.08em;
          margin-top: 2px;
        }

        .sku-prod-price {
          font-weight: 800;
          font-size: 12px;
          color: #047857;
        }

        @media print {
          body * { visibility: hidden; }
          .sku-paper, .sku-paper * { visibility: visible; }
          .sku-paper {
            position: absolute;
            left: 0; top: 0;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .no-print { display: none !important; }
          @page { margin: 0; }
        }
      `}</style>
    </Modal>
  );
};
