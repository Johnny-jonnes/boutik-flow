import type { LucideIcon } from 'lucide-react';

/**
 * En-tête commun des pages de gestion : icône, titre en gras (police
 * d'affichage), sous-titre et actions. Garantit un rendu identique d'une
 * page à l'autre (voir styles/premium-ui.css, classes bf-header*).
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="bf-header">
      <div className="bf-header__main">
        {Icon && (
          <span className="bf-header__icon" aria-hidden="true">
            <Icon size={23} />
          </span>
        )}
        <div className="bf-header__text">
          {eyebrow && <span className="bf-eyebrow">{eyebrow}</span>}
          <h1 className="bf-title">{title}</h1>
          {subtitle && <p className="bf-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="bf-actions">{actions}</div>}
    </header>
  );
}

export type StatTone = 'emerald' | 'rose' | 'violet' | 'amber' | 'sky' | 'teal' | 'slate';

/** Tuile de statistique : libellé, icône teintée, valeur et précision. */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'emerald',
  suffix,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  suffix?: string;
  hint?: React.ReactNode;
}) {
  return (
    <article className="bf-stat" data-tone={tone}>
      <div className="bf-stat__head">
        <span className="bf-stat__label">{label}</span>
        <span className="bf-stat__icon"><Icon size={18} /></span>
      </div>
      <div className="bf-stat__value">
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
      {hint && <div className="bf-stat__hint">{hint}</div>}
    </article>
  );
}
