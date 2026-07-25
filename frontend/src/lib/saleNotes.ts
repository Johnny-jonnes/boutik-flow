/**
 * Le mode de paiement et la remise d'une vente comptoir ne sont pas des
 * colonnes structurées en base (`Order` n'a pas de champ `payment_method`) :
 * le POS les encode dans `order.notes` sous forme de texte, et les écrans
 * qui affichent ou impriment une vente (reçu, historique des ventes) les
 * relisent depuis ce même texte.
 *
 * Garder l'écriture (`buildSaleNotes`) et la lecture (`extractPaymentMethod`,
 * `extractDiscount`) dans un seul fichier évite qu'elles divergent : c'est
 * exactement ce qui s'était produit — le texte lu ("Mode de paiement:")
 * ne correspondait plus au texte réellement écrit par le POS ("Paiement:"),
 * si bien que le reçu imprimé affichait toujours "Espèces" et le filtre de
 * paiement de la page Ventes ne retournait jamais aucun résultat.
 */

export function buildSaleNotes({
  paymentMethod,
  discount,
  isDebt = false,
  debtTotal,
}: {
  paymentMethod: string;
  discount: number;
  isDebt?: boolean;
  debtTotal?: number;
}): string {
  const base = `Paiement: ${paymentMethod} | Remise: ${discount} GNF`;
  return isDebt && debtTotal !== undefined ? `[DETTE] Montant: ${debtTotal} GNF | ${base}` : base;
}

export function extractPaymentMethod(notes: string | null | undefined): string {
  if (!notes) return 'cash';
  const match = notes.match(/Paiement:\s*(\w+)/);
  return match ? match[1] : 'cash';
}

export function extractDiscount(notes: string | null | undefined): number {
  if (!notes) return 0;
  const match = notes.match(/Remise:\s*([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
}
