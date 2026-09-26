'use client';

import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mainEl = document.querySelector('.main');

    const toggleVisibility = () => {
      const mainScroll = mainEl ? mainEl.scrollTop : 0;
      const windowScroll = window.scrollY || document.documentElement.scrollTop || 0;

      if (mainScroll > 300 || windowScroll > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, true);
    if (mainEl) {
      mainEl.addEventListener('scroll', toggleVisibility);
    }

    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', toggleVisibility, true);
      if (mainEl) {
        mainEl.removeEventListener('scroll', toggleVisibility);
      }
    };
  }, []);

  const scrollToTop = () => {
    const mainEl = document.querySelector('.main');
    if (mainEl && mainEl.scrollTop > 0) {
      mainEl.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <>
      <button
        onClick={scrollToTop}
        className="scroll-to-top"
        aria-label="Retour en haut"
      >
        <ArrowUp size={20} />
      </button>
      <style jsx>{`
        .scroll-to-top {
          position: fixed;
          bottom: max(24px, env(safe-area-inset-bottom, 0px));
          right: max(24px, env(safe-area-inset-right, 0px));
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700));
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1050;
          box-shadow: 0 10px 24px rgba(12, 74, 65, 0.35);
          animation: scaleIn 0.2s var(--ease-spring);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .scroll-to-top:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(12, 74, 65, 0.45);
        }

        .scroll-to-top:active {
          transform: scale(0.94);
        }

        /* Mobile : la barre de navigation du bas (64px + marge + encoche)
           recouvrait la flèche — on la place juste au-dessus. */
        @media (max-width: 768px) {
          .scroll-to-top {
            bottom: calc(0.6rem + 64px + 12px + env(safe-area-inset-bottom, 0px));
            right: max(16px, env(safe-area-inset-right, 0px));
          }
        }
      `}</style>
    </>
  );
}

export default ScrollToTop;
