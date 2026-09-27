/**
 * Animations de succès (ajout de produit, entrée de stock, client, dette…).
 * Les pages appellent simplement celebrate({...}) ; l'animation est jouée
 * par <CelebrationHost /> (monté une seule fois dans le layout du tableau
 * de bord — voir components/ActionCelebration.tsx).
 */
export type CelebrationKind =
  | 'product'   // produit ajouté
  | 'products'  // création groupée
  | 'stock'     // entrée de stock
  | 'category'  // catégorie créée
  | 'client'    // client ajouté
  | 'debt'      // versement enregistré (dette encore ouverte)
  | 'debt-paid' // dette soldée
  | 'team'      // membre d'équipe ajouté
  | 'order'     // commande créée
  | 'deleted'   // élément supprimé (produit, client, catégorie…)
  | 'delete-cancelled' // suppression annulée
  | 'expense';  // sortie de caisse

export interface CelebrationPayload {
  kind: CelebrationKind;
  title: string;
  subtitle?: string;
  /** Petites pastilles d'information sous le sous-titre. */
  chips?: string[];
  /** Initiales affichées dans l'avatar (client, équipe). */
  initials?: string;
  /** Nombre mis en avant (produits créés, unités entrées…). */
  count?: number;
  /** Progression 0-100 (part de la dette réglée). */
  progress?: number;
  /** Durée d'affichage en ms (par défaut ~2,3 s). */
  duration?: number;
}

export const CELEBRATE_EVENT = 'boutikflow:celebrate';

export function celebrate(payload: CelebrationPayload) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CelebrationPayload>(CELEBRATE_EVENT, { detail: payload }));
}
