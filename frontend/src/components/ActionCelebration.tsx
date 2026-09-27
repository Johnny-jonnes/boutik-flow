'use client';

import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Truck, Check, RotateCcw } from 'lucide-react';
import { CELEBRATE_EVENT, type CelebrationPayload } from '@/lib/celebrate';
import { SoundEffects, triggerHaptic } from '@/lib/audio';
import { formatNumber } from '@/lib/format';
import '@/styles/action-celebration.css';

/** Durée d'affichage avant fermeture automatique (un clic ferme aussi). */
const DURATION = 2300;

// Confettis déterministes (dette soldée) : aucune valeur aléatoire au rendu.
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const dist = 90 + (i % 3) * 20;
  return {
    x: `${Math.round(Math.cos(angle) * dist)}px`,
    y: `${Math.round(Math.sin(angle) * dist)}px`,
    r: `${(i * 71) % 360}deg`,
    color: ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e', '#a78bfa'][i % 5],
  };
});

function Box({ className = '' }: { className?: string }) {
  return <span className={`ac-box ${className}`}><i /></span>;
}

/** Poubelle (suppression) : couvercle articulé et corps rayé. */
function Bin({ idle = false }: { idle?: boolean }) {
  return (
    <span className={`ac-bin ${idle ? 'ac-bin--idle' : ''}`}>
      <span className="ac-bin__lid" />
      <span className="ac-bin__body"><i /><i /><i /></span>
    </span>
  );
}

/** Élément supprimé ou conservé : avatar (initiales) ou carton. */
function Item({ p, className }: { p: CelebrationPayload; className: string }) {
  return p.initials
    ? <span className={`${className} ac-item-avatar`}>{p.initials}</span>
    : <Box className={className} />;
}

/** Scène animée propre à chaque action. */
function Scene({ p }: { p: CelebrationPayload }) {
  switch (p.kind) {
    case 'product':
      return (
        <div className="ac-scene">
          <span className="ac-spark ac-spark--1" /><span className="ac-spark ac-spark--2" /><span className="ac-spark ac-spark--3" />
          <Box className="ac-box--drop" />
          <span className="ac-shelf" />
        </div>
      );
    case 'products':
      return (
        <div className="ac-scene">
          <div className="ac-grid">
            {Array.from({ length: 6 }).map((_, i) => <Box key={i} className="ac-box--mini" />)}
          </div>
        </div>
      );
    case 'stock':
      return (
        <div className="ac-scene">
          <div className="ac-stack">
            <Box className="ac-box--s1" /><Box className="ac-box--s2" /><Box className="ac-box--s3" />
          </div>
          <span className="ac-pallet" />
          {p.count !== undefined && <span className="ac-float">+{p.count}</span>}
        </div>
      );
    case 'category':
      return (
        <div className="ac-scene">
          <span className="ac-paper ac-paper--1" /><span className="ac-paper ac-paper--2" /><span className="ac-paper ac-paper--3" />
          <span className="ac-folder"><FolderOpen size={78} strokeWidth={1.6} /></span>
        </div>
      );
    case 'client':
      return (
        <div className="ac-scene">
          <span className="ac-halo" /><span className="ac-halo ac-halo--2" />
          <span className="ac-avatar">{p.initials || '+'}</span>
          <span className="ac-plus">+</span>
        </div>
      );
    case 'team':
      return (
        <div className="ac-scene">
          <span className="ac-avatar ac-avatar--side ac-avatar--left" />
          <span className="ac-avatar ac-avatar--side ac-avatar--right" />
          <span className="ac-halo" />
          <span className="ac-avatar ac-avatar--join">{p.initials || '+'}</span>
        </div>
      );
    case 'debt':
    case 'debt-paid':
      return (
        <div className="ac-scene">
          <span className="ac-coin ac-coin--1" /><span className="ac-coin ac-coin--2" /><span className="ac-coin ac-coin--3" />
          <div className="ac-jar">
            <span className="ac-jar__fill" style={{ '--ac-fill': `${Math.max(8, Math.min(100, p.progress ?? 100))}%` } as React.CSSProperties} />
          </div>
          {p.kind === 'debt-paid' && CONFETTI.map((c, i) => (
            <span key={i} className="ac-confetti" style={{ '--x': c.x, '--y': c.y, '--r': c.r, background: c.color } as React.CSSProperties} />
          ))}
        </div>
      );
    case 'order':
      return (
        <div className="ac-scene">
          <div className="ac-clipboard">
            {[0, 1, 2].map(i => (
              <div key={i} className="ac-line" style={{ '--d': `${0.25 + i * 0.22}s` } as React.CSSProperties}>
                <span className="ac-tick"><Check size={12} strokeWidth={3.5} /></span>
                <span className="ac-bar" />
              </div>
            ))}
          </div>
          <span className="ac-truck"><Truck size={34} /></span>
        </div>
      );
    case 'deleted':
      return (
        <div className="ac-scene">
          <Item p={p} className="ac-victim" />
          <Bin />
          <span className="ac-dust ac-dust--1" /><span className="ac-dust ac-dust--2" /><span className="ac-dust ac-dust--3" />
        </div>
      );
    case 'delete-cancelled':
      return (
        <div className="ac-scene">
          <Bin idle />
          <Item p={p} className="ac-rescued" />
          <span className="ac-spark ac-spark--1" /><span className="ac-spark ac-spark--2" /><span className="ac-spark ac-spark--3" />
        </div>
      );
    case 'expense':
      return (
        <div className="ac-scene">
          <span className="ac-note ac-note--1" /><span className="ac-note ac-note--2" /><span className="ac-note ac-note--3" />
          <span className="ac-drawer"><i /></span>
          {p.count !== undefined && <span className="ac-float ac-float--out">−{formatNumber(p.count)}</span>}
        </div>
      );
  }
}

/**
 * Hôte unique des animations de succès : écoute celebrate(...) et affiche
 * l'animation par-dessus l'écran pendant ~2 s.
 */
export function CelebrationHost() {
  const [current, setCurrent] = useState<(CelebrationPayload & { key: number }) | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    const onCelebrate = (e: Event) => {
      const payload = (e as CustomEvent<CelebrationPayload>).detail;
      counter.current += 1;
      setCurrent({ ...payload, key: counter.current });
      if (payload.kind === 'delete-cancelled') {
        SoundEffects.playNotification();
        triggerHaptic(20);
      } else {
        SoundEffects.playSuccess();
        triggerHaptic([30, 40, 30]);
      }
    };
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
  }, []);

  useEffect(() => {
    if (!current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = current.duration ?? DURATION;
    const t = setTimeout(() => setCurrent(null), reduced ? Math.min(1300, duration) : duration);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  const p = current;
  const BadgeIcon = p.kind === 'delete-cancelled' ? RotateCcw : Check;
  return (
    <div key={p.key} className={`ac ac--${p.kind}`} role="status" aria-live="polite" onClick={() => setCurrent(null)}>
      <div className="ac-card">
        <div className="ac-stage" aria-hidden="true">
          <Scene p={p} />
          <span className="ac-badge"><BadgeIcon size={22} strokeWidth={3} /></span>
        </div>
        <h2 className="ac-title">{p.title}</h2>
        {p.subtitle && <p className="ac-sub">{p.subtitle}</p>}
        {p.chips && p.chips.length > 0 && (
          <div className="ac-chips">{p.chips.map(c => <span key={c} className="ac-chip">{c}</span>)}</div>
        )}
        <span className="ac-progress" style={{ animationDuration: `${p.duration ?? DURATION}ms` }} />
      </div>
    </div>
  );
}
