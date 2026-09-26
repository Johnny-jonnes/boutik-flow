import '@/styles/storefront.css';

// Squelette instantané de la fiche produit (voir boutique/[slug]/loading.tsx) —
// même structure que la page réelle, pour qu'elle le remplace sans saut visuel.
export default function StorefrontProductLoading() {
  return (
    <div className="sf" aria-busy="true">
      <header className="sf-header">
        <div className="sf-container sf-header__inner">
          <div className="sf-brand">
            <span className="sf-sk" style={{ width: 34, height: 34 }} />
            <span className="sf-sk" style={{ width: 150, height: 16 }} />
          </div>
        </div>
      </header>
      <main className="sf-container">
        <section className="sf-product">
          <div className="sf-gallery sf-sk" style={{ animation: undefined }} />
          <div className="sf-pinfo" style={{ animation: 'none' }}>
            <span className="sf-sk" style={{ height: 38, width: '80%' }} />
            <span className="sf-sk" style={{ height: 32, width: '45%' }} />
            <span className="sf-sk" style={{ height: 14, width: '100%' }} />
            <span className="sf-sk" style={{ height: 14, width: '90%' }} />
            <span className="sf-sk" style={{ height: 54, width: '100%', borderRadius: 14 }} />
          </div>
        </section>
      </main>
    </div>
  );
}
