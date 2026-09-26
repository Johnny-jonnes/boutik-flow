'use client';

import { useState } from 'react';
import { MessageCircle, Globe, Link as LinkIcon, Check, Share2 } from 'lucide-react';

// Composants clients isolés : les pages de la vitrine restent des Server
// Components (SEO, rapides sur mobile) — seuls ces petits îlots ont besoin
// de JS côté navigateur (onClick, presse-papiers, partage natif).
// Styles : styles/storefront.css (classes sf-*).

function useCopied() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silencieux : au pire l'utilisateur copie l'URL manuellement.
    }
  };
  return { copied, copy };
}

/** Partage d'une fiche produit : le lien pointe toujours vers CETTE page
 *  produit, jamais l'accueil (voir cahier des charges chantier vitrine). */
export function ShareButtons({ url, title, price }: { url: string; title: string; price: string }) {
  const shareText = `${title} — ${price}\n${url}`;
  const { copied, copy } = useCopied();

  return (
    <div className="sf-share">
      <span className="sf-share__label">Partager ce produit</span>
      <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn--ghost sf-btn--sm">
        <MessageCircle size={16} /> WhatsApp
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn--ghost sf-btn--sm">
        <Globe size={16} /> Facebook
      </a>
      <button type="button" onClick={() => copy(url)} className="sf-btn sf-btn--ghost sf-btn--sm">
        {copied ? <><Check size={16} /> Lien copié</> : <><LinkIcon size={16} /> Copier le lien</>}
      </button>
    </div>
  );
}

/** Partage de la boutique : feuille de partage native du téléphone quand
 *  elle existe (WhatsApp, Instagram…), sinon copie du lien. */
export function ShareStoreButton({ url, name, className = 'sf-btn sf-btn--ghost' }: { url: string; name: string; className?: string }) {
  const { copied, copy } = useCopied();
  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: name, text: `Découvrez ${name}`, url });
        return;
      } catch {
        // Annulé par l'utilisateur : on ne fait rien de plus.
        return;
      }
    }
    copy(url);
  };
  return (
    <button type="button" onClick={share} className={className}>
      {copied ? <><Check size={17} /> Lien copié</> : <><Share2 size={17} /> Partager</>}
    </button>
  );
}
