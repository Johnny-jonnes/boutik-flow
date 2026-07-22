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
          bottom: 24px;
          right: 24px;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background-color: var(--color-brand-500, #10b981);
          opacity: 0.85;
          color: #ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 50;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          transition: opacity 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
        }

        .scroll-to-top:hover {
          opacity: 1;
          transform: translateY(-2px);
          background-color: var(--color-brand-600, #059669);
        }

        .scroll-to-top:active {
          transform: translateY(0);
        }
      `}</style>
    </>
  );
}

export default ScrollToTop;
