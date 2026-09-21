'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  title: string;
  subtitle?: string;
}

// Remplace l'ancienne approche par fenêtre popup (window.open + document.write)
// : "onload=window.print()" n'est pas traité comme un vrai geste utilisateur
// par de nombreux navigateurs mobiles, bloqué silencieusement de façon
// incohérente. Pas d'option de téléchargement (retirée à la demande) :
// uniquement impression du QR code affiché.
export function QRCodeModal({ isOpen, onClose, value, title, subtitle }: QRCodeModalProps) {
  const { language } = useLanguage();
  const fr = language === 'fr';
  // Le composant reste monté entre deux ouvertures (isOpen bascule sans
  // démonter QRCodeModal — voir products/page.tsx) : on garde le résultat
  // ATTACHÉ à la valeur pour laquelle il a été généré plutôt que de le
  // réinitialiser depuis un effet (aucun setState synchrone nécessaire),
  // et on l'ignore au rendu s'il ne correspond plus au `value` courant —
  // sinon un QR d'un produit précédent flasherait brièvement en rouvrant
  // pour un produit différent.
  const [generated, setGenerated] = useState<{ forValue: string; url: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(value, { width: 320, margin: 1 }))
      .then((url) => { if (!cancelled) setGenerated({ forValue: value, url }); })
      .catch(() => {
        if (!cancelled) toast.error(fr ? 'Erreur lors de la génération du QR code' : 'Error generating QR code');
      });
    return () => { cancelled = true; };
  }, [isOpen, value, fr]);

  if (!isOpen) return null;
  const dataUrl = generated && generated.forValue === value ? generated.url : null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={fr ? 'Code QR' : 'QR Code'} maxWidth="380px">
        <div className="qr-modal-body">
          <h3 className="qr-modal-title">{title}</h3>
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR code" className="qr-modal-image" width={320} height={320} />
          ) : (
            <div className="qr-modal-loading">{fr ? 'Génération…' : 'Generating…'}</div>
          )}
          {subtitle && <p className="qr-modal-subtitle">{subtitle}</p>}

          <div className="qr-modal-actions">
            <button type="button" className="btn btn-primary btn-sm qr-modal-btn" onClick={() => window.print()} disabled={!dataUrl}>
              <Printer size={14} /> {fr ? 'Imprimer' : 'Print'}
            </button>
          </div>

          <button type="button" className="btn btn-ghost btn-sm qr-modal-back" onClick={onClose}>
            <ArrowLeft size={14} /> {fr ? 'Retour' : 'Back'}
          </button>
        </div>
      </Modal>

      {/* Contenu imprimable rendu HORS de la modale, en enfant direct de
          <body> via portail — pas dans .modal-overlay (position: fixed).
          C'est ça la vraie cause de la page blanche à l'impression :
          beaucoup de moteurs de rendu n'impriment pas fiablement un
          contenu positionné en fixed (parfois rien du tout, parfois
          seulement la première page). Invisible à l'écran, affiché
          uniquement par la règle @media print ci-dessous — qui masque
          tout le reste de la page (toute la vraie app est un unique
          enfant direct de body) plutôt que d'essayer de "sauver"
          l'affichage de la modale. */}
      {dataUrl && typeof document !== 'undefined' && createPortal(
        <div className="qr-print-only">
          <h2>{title}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="QR code" width={320} height={320} />
          {subtitle && <p>{subtitle}</p>}
        </div>,
        document.body
      )}

      <style jsx>{`
        .qr-modal-body { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; text-align: center; }
        .qr-modal-title { margin: 0; font-size: 1rem; color: var(--text-primary); }
        .qr-modal-image { border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; padding: 0.5rem; max-width: 100%; height: auto; background: #fff; }
        .qr-modal-loading {
          width: 320px; max-width: 100%; aspect-ratio: 1;
          display: flex; align-items: center; justify-content: center; color: var(--text-muted);
        }
        .qr-modal-subtitle { margin: 0; font-size: 0.8rem; color: var(--text-muted); word-break: break-all; max-width: 300px; }
        .qr-modal-actions { display: flex; gap: 0.6rem; width: 100%; margin-top: 0.4rem; }
        .qr-modal-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; text-decoration: none; }
        .qr-modal-back { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem; }
      `}</style>

      <style jsx global>{`
        .qr-print-only { display: none; }
        @media print {
          body > *:not(.qr-print-only) { display: none !important; }
          .qr-print-only {
            display: flex !important;
            flex-direction: column; align-items: center; text-align: center;
            gap: 0.75rem; padding: 2rem; margin: 0;
          }
          .qr-print-only img { border: 1px solid #eee; padding: 10px; }
          .qr-print-only p { color: #555; word-break: break-all; max-width: 320px; }
        }
      `}</style>
    </>
  );
}
