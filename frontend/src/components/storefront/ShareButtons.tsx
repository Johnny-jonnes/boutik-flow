'use client';

import { MessageCircle, Globe, Link as LinkIcon } from 'lucide-react';

// Composant client isolé : la page produit publique reste un Server
// Component (SEO, rapide sur mobile) — seul ce petit îlot a besoin de JS
// côté navigateur (onClick, clipboard). Le lien pointe toujours vers CETTE
// page produit, jamais l'accueil (voir cahier des charges chantier vitrine).
export function ShareButtons({ url, title, price }: { url: string; title: string; price: string }) {
  const shareText = `${title} — ${price}\n${url}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      // Pas de lib toast sur la vitrine publique (page volontairement
      // minimale, sans les dépendances du dashboard) — retour visuel simple.
      alert('Lien copié');
    } catch {
      // Silencieux : au pire l'utilisateur copie l'URL manuellement.
    }
  };

  return (
    <div className="share-buttons-public">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="share-btn"
      >
        <MessageCircle size={16} /> WhatsApp
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="share-btn"
      >
        <Globe size={16} /> Facebook
      </a>
      <button type="button" onClick={handleCopy} className="share-btn">
        <LinkIcon size={16} /> Copier le lien
      </button>

      <style jsx>{`
        .share-buttons-public {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .share-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e5e7eb;
          padding: 0.5rem 0.9rem;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s ease;
        }
        .share-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </div>
  );
}
