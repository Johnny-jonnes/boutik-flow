// Même principe que boutique/[slug]/loading.tsx : affichage instantané au
// clic sur une photo produit, avant même que le serveur ait fini de
// charger boutique + produit — c'est ça qui corrige la sensation de clic
// qui ne répond pas, pas seulement le temps réseau réel.
export default function StorefrontProductLoading() {
  return (
    <div className="storefront light sk-page">
      <header className="sk-header">
        <div className="sk-header-inner">
          <div className="sk-pill sk-w-140" />
        </div>
      </header>

      <main className="sk-detail">
        <div className="sk-image" />
        <div className="sk-info">
          <div className="sk-line sk-w-80" />
          <div className="sk-line sk-w-220 sk-big" />
          <div className="sk-line sk-w-140" />
          <div className="sk-line sk-w-full sk-thin" />
          <div className="sk-line sk-w-full sk-thin" />
          <div className="sk-line sk-w-160 sk-thin" />
          <div className="sk-btn" />
        </div>
      </main>

      <style>{`
        .sk-page { min-height: 100vh; background: var(--surface-0); font-family: var(--font-sans); }
        .sk-header {
          position: sticky; top: 0; z-index: 50;
          background: color-mix(in srgb, var(--surface-1) 88%, transparent);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
          padding: 1rem 1.5rem;
        }
        .sk-header-inner { max-width: 700px; margin: 0 auto; }
        .sk-detail { max-width: 700px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .sk-image { width: 100%; aspect-ratio: 1; max-height: 420px; border-radius: var(--radius-lg); }
        .sk-info { display: flex; flex-direction: column; gap: 0.7rem; }
        .sk-btn { height: 44px; width: 200px; border-radius: var(--radius-md); margin-top: 0.5rem; }

        .sk-image, .sk-pill, .sk-line, .sk-btn {
          background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
          background-size: 200% 100%;
          animation: sk-shimmer 1.5s ease-in-out infinite;
        }
        .sk-pill { height: 34px; border-radius: var(--radius-full); }
        .sk-line { height: 14px; border-radius: 6px; }
        .sk-big { height: 26px; }
        .sk-thin { height: 10px; opacity: 0.7; }
        .sk-w-80 { width: 80px; } .sk-w-140 { width: 140px; } .sk-w-160 { width: 160px; }
        .sk-w-220 { width: 220px; } .sk-w-full { width: 100%; }
        @keyframes sk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        @media (prefers-reduced-motion: reduce) {
          .sk-image, .sk-pill, .sk-line, .sk-btn { animation: none; }
        }
      `}</style>
    </div>
  );
}
