'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Languages, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';
import '@/styles/legal.css';

/**
 * Mise en page commune des pages légales (confidentialité, CGU) : en-tête
 * avec retour à la page précédente, sommaire généré à partir des titres
 * d'articles, thèmes clair/sombre. Le contenu (articles) reste dans chaque
 * page — styles des classes existantes (.article-block, .feature-card…)
 * dans styles/legal.css.
 */
export function LegalLayout({
  icon: Icon,
  badge,
  title,
  updated,
  other,
  children,
}: {
  icon: LucideIcon;
  badge: string;
  title: string;
  updated: string;
  other: { href: string; label: string };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const fr = language === 'fr';
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; label: string }[]>([]);
  const [activeId, setActiveId] = useState('');

  // Retour là où était le visiteur (accueil, inscription…) : la page
  // précédente si elle vient de BoutikFlow, sinon l'accueil — l'ancien lien
  // renvoyait toujours vers la connexion. Un onglet ouvert depuis
  // l'inscription (target=_blank) n'a pas d'historique : repli sur l'accueil.
  const goBack = () => {
    let sameOrigin = false;
    try {
      sameOrigin = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
    } catch {
      sameOrigin = false;
    }
    if (sameOrigin && window.history.length > 1) router.back();
    else router.push('/');
  };

  // Sommaire construit à partir des titres d'articles déjà rendus (les deux
  // langues sont gérées sans liste en double) ; recalculé au changement de langue.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const frame = requestAnimationFrame(() => {
      const items = [...root.querySelectorAll<HTMLElement>('.article-block')].map((section, i) => {
        const id = `article-${i + 1}`;
        section.id = id;
        const heading = section.querySelector('h2')?.textContent ?? '';
        return { id, label: heading.replace(/^(Article|Art\.)\s*\d+\s*[—-]\s*/i, '') };
      });
      setToc(items);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -65% 0px' },
    );
    root.querySelectorAll('.article-block').forEach(el => observer.observe(el));
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [language]);

  const tocList = (
    <ol className="lg-toc__list">
      {toc.map((item, i) => (
        <li key={item.id}>
          <a href={`#${item.id}`} className={activeId === item.id ? 'lg-toc__link lg-toc__link--active' : 'lg-toc__link'}>
            <span className="lg-toc__num">{String(i + 1).padStart(2, '0')}</span>
            <span>{item.label}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="lg">
      <header className="lg-header">
        <div className="lg-container lg-header__inner">
          <button type="button" className="lg-back" onClick={goBack}>
            <ArrowLeft size={18} />
            <span>{fr ? 'Retour' : 'Back'}</span>
          </button>
          <Link href="/" className="lg-brand">
            <BrandMark size={32} />
            <span className="lg-brand__text">BoutikFlow</span>
          </Link>
          <div className="lg-header__actions">
            <button type="button" className="lg-lang" onClick={() => setLanguage(fr ? 'en' : 'fr')} title={fr ? 'Switch to English' : 'Passer en français'}>
              <Languages size={16} /> {fr ? 'EN' : 'FR'}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="lg-hero">
        <div className="lg-container">
          <span className="lg-badge"><Icon size={16} /> {badge}</span>
          <h1 className="lg-title">{title}</h1>
          <p className="lg-updated">{updated}</p>
        </div>
      </section>

      <div className="lg-container lg-body">
        <aside className="lg-toc" aria-label={fr ? 'Sommaire' : 'Contents'}>
          <span className="lg-toc__title">{fr ? 'Sommaire' : 'Contents'}</span>
          {tocList}
          <Link href={other.href} className="lg-toc__other">{other.label} →</Link>
        </aside>

        <main className="lg-main">
          <details className="lg-toc-mobile">
            <summary>{fr ? 'Sommaire' : 'Contents'} <ChevronDown size={16} /></summary>
            {tocList}
          </details>
          <div ref={contentRef} className="lg-content">{children}</div>
        </main>
      </div>

      <footer className="lg-footer">
        <div className="lg-container lg-footer__inner">
          <span>© 2026 BoutikFlow · {fr ? 'Propulsé par TrillionX. Tous droits réservés.' : 'Powered by TrillionX. All rights reserved.'}</span>
          <nav>
            <Link href="/">{fr ? 'Accueil' : 'Home'}</Link>
            <Link href="/privacy">{fr ? 'Confidentialité' : 'Privacy'}</Link>
            <Link href="/terms">{fr ? "Conditions d'utilisation" : 'Terms'}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
