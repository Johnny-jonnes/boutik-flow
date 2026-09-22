import { useId, type CSSProperties } from 'react';

/**
 * Marque BoutikFlow — "Boutique connectée" : silhouette de boutique
 * (commerce physique) + écran à la place de la porte (vente en ligne) +
 * ondes de diffusion (portée/publicité). Remplace l'ancien hexagone aux
 * couleurs du drapeau guinéen, qui ne correspondait plus au dégradé
 * turquoise réellement utilisé partout ailleurs dans l'app (voir
 * globals.css --logo-gradient-from/to).
 *
 * useId() donne un id de dégradé unique par instance : plusieurs
 * <BrandMark /> peuvent coexister sur la même page (ex. sidebar + un
 * lien de secours) sans collision d'id SVG.
 */
export function BrandMark({
  size = 32,
  style,
  className,
}: {
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const gradId = `bf-mark-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#31A292" />
          <stop offset="100%" stopColor="#6DD5C4" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill={`url(#${gradId})`} />
      {/* Ondes de diffusion — portée / publicité */}
      <path d="M68 24 a18 18 0 0 1 0 20" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" opacity="0.5" />
      <path d="M74 20 a26 26 0 0 1 0 28" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" opacity="0.3" />
      {/* Toit de boutique */}
      <polygon points="46,22 70,37 22,37" fill="white" />
      {/* Façade */}
      <rect x="26" y="37" width="40" height="33" rx="2" fill="white" />
      {/* Écran — vente en ligne à la place de la porte */}
      <rect x="38" y="45" width="16" height="21" rx="3" fill="#2C9A87" />
      <rect x="40.5" y="48.5" width="11" height="11" rx="1" fill="white" />
      <circle cx="46" cy="63" r="1.4" fill="white" />
    </svg>
  );
}
