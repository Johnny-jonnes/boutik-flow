'use client';

import { useEffect, useRef } from 'react';
import { Clock, Hourglass, Landmark, Nfc } from 'lucide-react';
import { formatGNF } from '@/lib/format';
import '@/styles/payment-celebration.css';

export type CelebrationMethod = 'cash' | 'orange_money' | 'card' | 'transfer';
export type CelebrationMode = 'full' | 'partial' | 'deferred';

/** Durée avant l'affichage du reçu (un clic permet de passer). */
const DURATION = 3000;

const METHOD_TEXT: Record<CelebrationMethod, { fr: string; en: string }> = {
  cash: { fr: 'en espèces', en: 'in cash' },
  orange_money: { fr: 'par Orange Money', en: 'via Orange Money' },
  card: { fr: 'par carte', en: 'by card' },
  transfer: { fr: 'par virement', en: 'by transfer' },
};

// Confettis déterministes (paiement total) : aucune valeur aléatoire au rendu.
const CONFETTI = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  const dist = 95 + (i % 3) * 22;
  return {
    x: `${Math.round(Math.cos(angle) * dist)}px`,
    y: `${Math.round(Math.sin(angle) * dist)}px`,
    r: `${(i * 67) % 360}deg`,
    color: ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#a78bfa'][i % 5],
  };
});

/** Scène du moyen de paiement ; le type (total/partiel/différé) la module via CSS. */
function MethodScene({ method, mode }: { method: CelebrationMethod; mode: CelebrationMode }) {
  const clock = mode === 'deferred' && <span className="pc-clock"><Clock size={22} /></span>;
  if (method === 'orange_money') {
    return (
      <div className="pc-scene">
        <span className="pc-wave" /><span className="pc-wave" /><span className="pc-wave" />
        <div className="pc-phone">
          <div className="pc-phone__screen">
            <span className="pc-phone__label">Orange Money</span>
            <span className="pc-phone__bar"><i /></span>
          </div>
        </div>
        {clock}
      </div>
    );
  }
  if (method === 'card') {
    return (
      <div className="pc-scene">
        <span className="pc-contactless"><Nfc size={26} /></span>
        <div className="pc-terminal">
          <div className="pc-terminal__screen" />
          <div className="pc-terminal__keys">{Array.from({ length: 9 }).map((_, i) => <i key={i} />)}</div>
        </div>
        <div className="pc-bank-card"><div className="pc-bank-card__chip" /><div className="pc-bank-card__num" /></div>
        {clock}
      </div>
    );
  }
  if (method === 'transfer') {
    return (
      <div className="pc-scene">
        <div className="pc-bank"><Landmark size={40} /></div>
        <div className="pc-dots"><i /><i /><i /><i /><i /></div>
        {clock}
      </div>
    );
  }
  return (
    <div className="pc-scene">
      <div className="pc-note">GNF</div>
      <div className="pc-note">GNF</div>
      <div className="pc-note">GNF</div>
      <span className="pc-coin pc-coin--l" />
      <span className="pc-coin pc-coin--r" />
      <div className="pc-drawer" />
      {clock}
    </div>
  );
}

/**
 * Animation plein écran jouée après l'encaissement, avant le reçu : une
 * scène par moyen de paiement, déclinée selon le type de paiement.
 */
export function PaymentCelebration({
  method,
  mode,
  total,
  paid,
  language,
  onDone,
}: {
  method: CelebrationMethod;
  mode: CelebrationMode;
  total: number;
  paid: number;
  language: string;
  onDone: () => void;
}) {
  const fr = language === 'fr';
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => doneRef.current(), reduced ? 1400 : DURATION);
    return () => clearTimeout(t);
  }, []);

  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const how = fr ? METHOD_TEXT[method].fr : METHOD_TEXT[method].en;
  // Anneau : circonférence 402 (r = 64) — plein, au % payé, ou vide (différé).
  const offset = mode === 'full' ? 0 : mode === 'partial' ? 402 * (1 - Math.min(1, pct / 100)) : 402;

  const title = mode === 'full'
    ? (fr ? 'Paiement réussi' : 'Payment successful')
    : mode === 'partial'
      ? (fr ? 'Paiement partiel' : 'Partial payment')
      : (fr ? 'Vente à crédit' : 'Credit sale');

  return (
    <div
      className={`pc pc--${method} pc--${mode}`}
      role="status"
      aria-live="polite"
      onClick={() => doneRef.current()}
      style={{ '--pc-duration': `${DURATION}ms` } as React.CSSProperties}
    >
      <div className="pc-card">
        <div className="pc-stage" aria-hidden="true">
          <MethodScene method={method} mode={mode} />
          <div className="pc-final">
            <svg className="pc-ring" viewBox="0 0 150 150">
              <circle className="pc-ring__track" cx="75" cy="75" r="64" />
              <circle className="pc-ring__paid" cx="75" cy="75" r="64" style={{ '--pc-offset': offset } as React.CSSProperties} />
            </svg>
            <div className="pc-final__icon">
              {mode === 'full' && (
                <svg className="pc-check" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
              {mode === 'partial' && <span className="pc-final__pct">{pct} %</span>}
              {mode === 'deferred' && <Hourglass size={38} />}
            </div>
            {mode === 'full' && CONFETTI.map((c, i) => (
              <span
                key={i}
                className="pc-confetti"
                style={{ '--x': c.x, '--y': c.y, '--r': c.r, background: c.color, animationDelay: `${2 + (i % 4) * 0.04}s` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>

        <h2 className="pc-title">{title}</h2>
        {mode === 'full' && (
          <p className="pc-sub"><b>{formatGNF(total)}</b> {fr ? 'reçus' : 'received'} {how}</p>
        )}
        {mode === 'partial' && (
          <>
            <p className="pc-sub"><b>{formatGNF(paid)}</b> {fr ? 'reçus' : 'received'} {how}</p>
            <div className="pc-chips">
              <span className="pc-chip pc-chip--paid">{pct} % {fr ? 'payé' : 'paid'}</span>
              <span className="pc-chip pc-chip--debt">{fr ? 'Reste' : 'Remaining'} {formatGNF(remaining)}</span>
            </div>
          </>
        )}
        {mode === 'deferred' && (
          <>
            <p className="pc-sub"><b>{formatGNF(total)}</b> {fr ? 'à régler plus tard' : 'to be paid later'}</p>
            <div className="pc-chips">
              <span className="pc-chip pc-chip--deferred">{fr ? 'Dette créée' : 'Debt created'}</span>
              <span className="pc-chip pc-chip--paid">{fr ? 'Paiement prévu' : 'Planned payment'} {how}</span>
            </div>
          </>
        )}
        <button type="button" className="pc-skip" onClick={(e) => { e.stopPropagation(); doneRef.current(); }}>
          {fr ? 'Voir le reçu →' : 'View receipt →'}
        </button>
        <span className="pc-progress" />
      </div>
    </div>
  );
}
