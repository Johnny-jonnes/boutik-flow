'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Package, Trash2, X } from 'lucide-react';
import { celebrate } from '@/lib/celebrate';
import '@/styles/confirm-delete.css';

interface ConfirmDeleteDialogProps {
  open: boolean;
  /** Question affichée en titre : « Supprimer ce produit ? ». */
  title: string;
  /** Nom de l'élément concerné, mis en évidence. */
  name?: string;
  /** Initiales (client, membre…) : avatar au lieu de l'icône. */
  initials?: string;
  /** Icône de l'élément quand il n'y a pas d'initiales (carton par défaut). */
  icon?: React.ReactNode;
  /** Précision sur les conséquences de la suppression. */
  message?: React.ReactNode;
  isDeleting: boolean;
  fr: boolean;
  onConfirm: () => void;
  /** Ferme la boîte ; l'animation « Suppression annulée » est jouée ici. */
  onCancel: () => void;
}

/**
 * Confirmation de suppression animée, commune à toutes les pages.
 * Annuler (bouton, croix, clic à côté, Échap) joue l'animation
 * « Suppression annulée » ; la page appelle celebrate({ kind: 'deleted' })
 * une fois la suppression réussie.
 */
export function ConfirmDeleteDialog({
  open, title, name, initials, icon, message, isDeleting, fr, onConfirm, onCancel,
}: ConfirmDeleteDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const cancel = () => {
    if (isDeleting) return;
    celebrate({
      kind: 'delete-cancelled',
      title: fr ? 'Suppression annulée' : 'Deletion cancelled',
      subtitle: name,
      initials,
      chips: [fr ? "Rien n'a été supprimé" : 'Nothing was deleted'],
      duration: 1800,
    });
    onCancel();
  };

  // Échap annule ; le défilement de la page est bloqué tant que la boîte est ouverte.
  const cancelLatest = useRef(cancel);
  useEffect(() => { cancelLatest.current = cancel; });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelLatest.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  // Rendue à la racine du document : couvre tout l'écran, menu latéral compris
  // (le contenu des pages forme son propre contexte d'empilement).
  return createPortal(
    <div className="cdd-overlay" onClick={cancel}>
      <div
        className={`cdd-card ${isDeleting ? 'cdd-card--busy' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cdd-title"
        aria-describedby="cdd-desc"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="cdd-close" onClick={cancel} aria-label={fr ? 'Fermer' : 'Close'} disabled={isDeleting}>
          <X size={18} />
        </button>

        <div className="cdd-icon" aria-hidden="true">
          <span className="cdd-ring" /><span className="cdd-ring cdd-ring--2" />
          <span className="cdd-can"><Trash2 size={30} strokeWidth={2.2} /></span>
        </div>

        <h2 id="cdd-title" className="cdd-title">{title}</h2>

        {name && (
          <div className="cdd-item">
            {initials
              ? <span className="cdd-item__avatar">{initials}</span>
              : <span className="cdd-item__icon">{icon ?? <Package size={17} />}</span>}
            <strong className="cdd-item__name">{name}</strong>
          </div>
        )}

        <div id="cdd-desc">
          {message && <p className="cdd-msg">{message}</p>}
          <p className="cdd-warn"><AlertTriangle size={14} /> {fr ? 'Cette action est irréversible.' : 'This action cannot be undone.'}</p>
        </div>

        <div className="cdd-actions">
          <button ref={cancelRef} type="button" className="btn btn-ghost cdd-btn" onClick={cancel} disabled={isDeleting}>
            {fr ? 'Annuler' : 'Cancel'}
          </button>
          <button type="button" className="btn btn-danger cdd-btn cdd-btn--danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting
              ? <><Loader2 size={16} className="cdd-spin" /> {fr ? 'Suppression…' : 'Deleting…'}</>
              : <><Trash2 size={16} /> {fr ? 'Supprimer' : 'Delete'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
