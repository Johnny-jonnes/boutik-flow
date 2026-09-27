'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import '@/styles/splash.css';

/** Durée d'affichage de l'écran de chargement avant la navigation. */
export const SPLASH_DURATION = 2800;

/** Écran de chargement plein écran aux couleurs de BoutikFlow (logo de l'application). */
export function SplashScreen({ message }: { message?: string }) {
  return (
    <div
      className="bf-splash"
      role="status"
      aria-live="polite"
      aria-label={message || 'Chargement'}
      style={{ '--splash-duration': `${SPLASH_DURATION}ms` } as React.CSSProperties}
    >
      <div className="bf-splash__mark">
        <span className="bf-splash__ring" />
        <span className="bf-splash__ring bf-splash__ring--2" />
        <span className="bf-splash__ring bf-splash__ring--3" />
        <BrandMark size={64} />
      </div>
      <h1 className="bf-splash__name">BoutikFlow</h1>
      {message && <p className="bf-splash__msg">{message}</p>}
      <div className="bf-splash__bar"><span /></div>
      <span className="bf-splash__foot">Caisse · Stock · Vitrine</span>
    </div>
  );
}

/**
 * Affiche l'écran de chargement puis navigue vers `href` — la page cible
 * est préchargée pendant l'animation, elle s'affiche donc aussitôt après.
 * Renvoie l'élément à rendre (null hors chargement) et la fonction de navigation.
 */
export function useSplashNavigation() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const navigate = useCallback((href: string, msg = 'Chargement…') => {
    if (timer.current) return;
    setMessage(msg);
    router.prefetch(href);
    timer.current = setTimeout(() => router.push(href), SPLASH_DURATION);
  }, [router]);

  return { splash: message !== null ? <SplashScreen message={message} /> : null, navigate };
}

/**
 * Lien qui passe par l'écran de chargement. Ctrl/Cmd/Maj-clic et clic
 * molette gardent le comportement normal (ouverture dans un nouvel onglet).
 */
export function SplashLink({
  href,
  message,
  go,
  children,
  ...rest
}: {
  href: string;
  message: string;
  go: (href: string, message: string) => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'onClick' | 'onNavigate'>) {
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        go(href, message);
      }}
    >
      {children}
    </Link>
  );
}
