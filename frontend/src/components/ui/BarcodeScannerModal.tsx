'use client';

import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan par caméra',
}) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Small timeout to ensure DOM element is ready
    const timer = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        'reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText);
          scanner.clear().catch(console.error);
          onClose();
        },
        (_errorMessage) => {
          // ignore scan errors
        }
      );

      scannerRef.current = scanner;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay">
      <div className="scanner-modal-content">
        <div className="scanner-modal-header">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-emerald-400" />
            <h3 className="scanner-modal-title">{title}</h3>
          </div>
          <button onClick={onClose} className="scanner-close-btn">
            <X size={18} />
          </button>
        </div>

        <p className="scanner-instructions">
          Pointez la caméra vers un code-barres ou un QR code.
        </p>

        <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }} />

        <div className="scanner-modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            Fermer
          </button>
        </div>
      </div>

      <style jsx>{`
        .scanner-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
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
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }

        .scanner-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .scanner-modal-title {
          font-size: 1.1rem;
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
        }

        .scanner-close-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .scanner-instructions {
          font-size: 0.85rem;
          color: #9ca3af;
          margin-bottom: 1rem;
          text-align: center;
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
