import { MessageCircle } from 'lucide-react';

// Bouton flottant "Commander sur WhatsApp" — n'apparaît que si le
// boutiquier a renseigné public_whatsapp dans Réglages (jamais deviné à
// partir d'un autre champ — voir Tenant.public_whatsapp). Positionné avec
// env(safe-area-inset-*) : sans ça, il se retrouve caché derrière la barre
// système sur iPhone (viewport-fit=cover, voir layout.tsx).
// Styles : styles/storefront.css (.sf-wa-fab).
export function WhatsAppButton({ phone, message, label = 'Commander' }: { phone: string; message: string; label?: string }) {
  const digitsOnly = phone.replace(/[^\d]/g, '');
  const href = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="sf-wa-fab" aria-label="Discuter sur WhatsApp">
      <MessageCircle size={24} fill="white" strokeWidth={0} />
      <span>{label}</span>
    </a>
  );
}
