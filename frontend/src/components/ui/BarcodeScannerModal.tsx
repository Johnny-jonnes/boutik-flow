'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Camera, X, ScanLine } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

// Unique ID pour éviter les conflits si plusieurs modals existent
const READER_ID = 'boutikflow-barcode-reader';

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan par caméra',
}) => {
  const scannerRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScanner = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    // Nettoyer le DOM manuellement si nécessaire
    const el = document.getElementById(READER_ID);
    if (el) el.innerHTML = '';
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    // Délai pour s'assurer que le DOM est monté
    timerRef.current = setTimeout(async () => {
      // S'assurer que html5-qrcode est disponible (import dynamique pour éviter SSR)
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode');
        const el = document.getElementById(READER_ID);
        if (!el) return;

        // Nettoyer avant de recréer
        el.innerHTML = '';

        const scanner = new Html5QrcodeScanner(
          READER_ID,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            supportedScanTypes: [0], // 0 = SCAN_TYPE_CAMERA
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText: string) => {
            stopScanner().then(() => {
              onScanSuccess(decodedText);
              onClose();
            });
          },
          (_errorMessage: string) => {
            // ignore frame errors (normal during scanning)
          }
        );

        scannerRef.current = scanner;
      } catch (err) {
        console.error('Barcode scanner init error:', err);
      }
    }, 150);

    return () => {
      stopScanner();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="scanner-modal-content">
        <div className="scanner-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={20} style={{ color: '#10b981' }} />
            <h3 className="scanner-modal-title">{title}</h3>
          </div>
          <button onClick={onClose} className="scanner-close-btn" title="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="scanner-instructions-bar">
          <ScanLine size={14} />
          <span>Pointez la caméra vers un code-barres ou QR code.</span>
        </div>

        {/* Le div cible pour html5-qrcode */}
        <div id={READER_ID} style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }} />

        <div className="scanner-modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            Annuler
          </button>
        </div>
      </div>

      <style jsx>{`
        .scanner-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.88);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .scanner-modal-content {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 1.5rem;
          width: 100%;
          max-width: 480px;
          color: white;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        }

        .scanner-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .scanner-modal-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: #f3f4f6;
          margin: 0;
        }

        .scanner-close-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
        }

        .scanner-close-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .scanner-instructions-bar {
          font-size: 0.82rem;
          color: #9ca3af;
          margin-bottom: 1rem;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
        }

        .scanner-modal-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 1rem;
        }
      `}</style>
    </div>
  );
};
