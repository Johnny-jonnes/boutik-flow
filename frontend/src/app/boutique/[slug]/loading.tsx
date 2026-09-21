// Next.js affiche ce squelette INSTANTANÉMENT au clic (avant même que la
// page réelle ait fini d'aller chercher boutique + produits + catégories
// sur le backend) — sans ça, le clic ne donnait aucun retour visuel
// pendant tout le temps de la requête réseau, ressenti comme un bouton
// qui ne répond pas. Le vrai contenu remplace ce squelette dès qu'il est
// prêt (revalidate: 30 sur page.tsx accélère les visites répétées ;
// ce fichier accélère la PREMIÈRE perception, systématiquement).
export default function StorefrontLoading() {
  return (
    <div className="storefront light sk-page">
      <header className="sk-header">
        <div className="sk-header-inner">
          <div className="sk-pill sk-w-100" />
        </div>
      </header>

      <main className="sk-content">
        <div className="sk-banner">
          <div className="sk-icon" />
          <div className="sk-line sk-w-160" />
          <div className="sk-line sk-w-220 sk-thin" />
        </div>

        <div className="sk-search" />

        <div className="sk-rail">
          <div className="sk-pill sk-w-70" />
          <div className="sk-pill sk-w-90" />
          <div className="sk-pill sk-w-80" />
        </div>

        <div className="sk-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="sk-card" key={i}>
              <div className="sk-card-media" />
              <div className="sk-line sk-w-100" />
              <div className="sk-line sk-w-60 sk-thin" />
            </div>
          ))}
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
        .sk-header-inner { max-width: 1100px; margin: 0 auto; }
        .sk-content { max-width: 1100px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .sk-banner { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; padding: 1.5rem 1rem 0.5rem; }
        .sk-icon { width: 116px; height: 116px; border-radius: var(--radius-xl); }
        .sk-search { height: 46px; border-radius: var(--radius-md); }
        .sk-rail { display: flex; gap: 0.55rem; }
        .sk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 1.1rem; }
        .sk-card { display: flex; flex-direction: column; gap: 0.5rem; }
        .sk-card-media { aspect-ratio: 1; border-radius: var(--radius-lg); }

        .sk-icon, .sk-search, .sk-pill, .sk-line, .sk-card-media {
          background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
          background-size: 200% 100%;
          animation: sk-shimmer 1.5s ease-in-out infinite;
        }
        .sk-pill { height: 34px; border-radius: var(--radius-full); }
        .sk-line { height: 14px; border-radius: 6px; }
        .sk-thin { height: 10px; opacity: 0.7; }
        .sk-w-100 { width: 100px; } .sk-w-160 { width: 160px; } .sk-w-220 { width: 220px; }
        .sk-w-70 { width: 70px; } .sk-w-80 { width: 80px; } .sk-w-90 { width: 90px; } .sk-w-60 { width: 60%; }
        @keyframes sk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        @media (prefers-reduced-motion: reduce) {
          .sk-icon, .sk-search, .sk-pill, .sk-line, .sk-card-media { animation: none; }
        }
      `}</style>
    </div>
  );
}
