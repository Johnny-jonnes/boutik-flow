/**
 * Formatage des montants et quantités affichés dans l'interface.
 *
 * Intl 'fr-FR' sépare les milliers par une espace fine insécable (U+202F),
 * absente de la police d'affichage Outfit : les grands chiffres des cartes
 * s'affichaient collés ("42740000"). On la remplace par une espace
 * insécable classique (U+00A0), présente dans toutes les polices et qui
 * empêche tout de même un retour à la ligne au milieu d'un nombre.
 */
const NARROW_SPACES = /[  ]/g;

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0).replace(NARROW_SPACES, ' ');
}

export function formatGNF(value: number | null | undefined): string {
  return `${formatNumber(value)} GNF`;
}

/** Version courte pour les axes de graphiques et badges : 1,5 k · 12,4 M · 1,2 Md. */
export function formatCompact(value: number | null | undefined): string {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const fmt = (v: number, unit: string) =>
    `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v)} ${unit}`;
  if (abs >= 1e9) return fmt(n / 1e9, 'Md');
  if (abs >= 1e6) return fmt(n / 1e6, 'M');
  if (abs >= 1e3) return fmt(n / 1e3, 'k');
  return formatNumber(n);
}

/** Seuil "stock faible" (unités) — même valeur pour l'accueil et le catalogue. */
export const LOW_STOCK_THRESHOLD = 10;

/** Initiales d'un nom ("Lamine Camara" → "LC") pour les avatars. */
export function initials(name: string | null | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Teinte stable (0-359) dérivée d'un texte — même client, même couleur d'avatar partout. */
export function hueFromString(text: string | null | undefined): number {
  let h = 0;
  for (const ch of text || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** "Aujourd'hui 14:32" · "Hier 09:10" · "12 sept. 14:32". */
export function formatRelativeDay(iso: string, language: string): string {
  const d = new Date(iso);
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return `${language === 'fr' ? "Aujourd'hui" : 'Today'} ${time}`;
  if (diffDays === 1) return `${language === 'fr' ? 'Hier' : 'Yesterday'} ${time}`;
  return `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${time}`;
}

/** Moyens de paiement : libellé + couleur, partagés par l'accueil et l'historique des ventes. */
export const PAYMENT_METHODS: Record<string, { fr: string; en: string; color: string }> = {
  cash:         { fr: 'Espèces',      en: 'Cash',         color: '#10b981' },
  orange_money: { fr: 'Orange Money', en: 'Orange Money', color: '#f97316' },
  card:         { fr: 'Carte',        en: 'Card',         color: '#3b82f6' },
  transfer:     { fr: 'Virement',     en: 'Transfer',     color: '#a855f7' },
};

export function paymentLabel(method: string, language: string): string {
  const m = PAYMENT_METHODS[method];
  return m ? (language === 'fr' ? m.fr : m.en) : method;
}

export function paymentColor(method: string): string {
  return PAYMENT_METHODS[method]?.color ?? '#64748b';
}
