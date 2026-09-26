import '@/styles/storefront.css';

// Next.js affiche ce squelette INSTANTANÉMENT au clic (avant même que la
// page réelle ait fini d'aller chercher boutique + produits + catégories
// sur le backend) — sans ça, le clic ne donnait aucun retour visuel
// pendant tout le temps de la requête réseau, ressenti comme un bouton
// qui ne répond pas. Le vrai contenu remplace ce squelette dès qu'il est
// prêt (revalidate: 30 sur page.tsx accélère les visites répétées ;
// ce fichier accélère la PREMIÈRE perception, systématiquement).
// Même structure que la page (styles/storefront.css) : aucun saut visuel.
export default function StorefrontLoading() {
  return (
    <div className="sf" aria-busy="true">
      <header className="sf-header">
        <div className="sf-container sf-header__inner">
          <div className="sf-brand">
            <span className="sf-sk" style={{ width: 40, height: 40 }} />
            <span className="sf-sk" style={{ width: 140, height: 16 }} />
          </div>
        </div>
      </header>
      <main>
        <section className="sf-container sf-hero">
          <div className="sf-cover sf-sk" />
          <div className="sf-identity">
            <div className="sf-logo sf-sk" />
            <div className="sf-identity__text">
              <span className="sf-sk" style={{ width: 220, height: 30 }} />
              <span className="sf-sk" style={{ width: 300, maxWidth: '100%', height: 14 }} />
            </div>
          </div>
        </section>
        <section className="sf-container sf-section">
          <div className="sf-sk" style={{ height: 50, borderRadius: 16, marginBottom: 12 }} />
          <div className="sf-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="sf-card" style={{ animation: 'none' }}>
                <div className="sf-card__media sf-sk" style={{ borderRadius: 0 }} />
                <div className="sf-card__body">
                  <span className="sf-sk" style={{ height: 14, width: '85%' }} />
                  <span className="sf-sk" style={{ height: 14, width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
