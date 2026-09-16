'use client';

import { MessageCircle } from 'lucide-react';

// Bouton flottant "Discuter sur WhatsApp" — composant client isolé (la
// page produit/boutique reste un Server Component). N'apparaît que si le
// boutiquier a renseigné public_whatsapp dans Réglages (jamais deviné à
// partir d'un autre champ — voir Tenant.public_whatsapp).
export function WhatsAppButton({ phone, message }: { phone: string; message: string }) {
  const digitsOnly = phone.replace(/[^\d]/g, '');
  const href = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="wa-fab" aria-label="Discuter sur WhatsApp">
      <MessageCircle size={24} fill="white" strokeWidth={0} />
      <style jsx>{`
        .wa-fab {
          position: fixed;
          /* viewport-fit=cover (voir layout.tsx) étend la page sous
             l'encoche/l'indicateur d'accueil iOS — sans env(), ce bouton
             se retrouve caché derrière la barre système sur iPhone (même
             bug déjà corrigé une fois pour ScrollToTop). */
          bottom: max(1.25rem, env(safe-area-inset-bottom, 0px));
          right: max(1.25rem, env(safe-area-inset-right, 0px));
          z-index: 60;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #25d366;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px rgba(37, 211, 102, 0.45);
          animation: wa-pulse 2.4s ease-in-out infinite;
          transition: transform 0.15s ease;
        }
        .wa-fab:hover { transform: scale(1.08); }
        @keyframes wa-pulse {
          0%, 100% { box-shadow: 0 6px 20px rgba(37, 211, 102, 0.45); }
          50% { box-shadow: 0 6px 28px rgba(37, 211, 102, 0.7); }
        }
        @media (max-width: 480px) {
          .wa-fab {
            width: 50px; height: 50px;
            bottom: max(1rem, env(safe-area-inset-bottom, 0px));
            right: max(1rem, env(safe-area-inset-right, 0px));
          }
        }
      `}</style>
    </a>
  );
}
