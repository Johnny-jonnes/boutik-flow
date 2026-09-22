import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Store, BadgeCheck, ShoppingBag, Clock, Truck, Wallet } from 'lucide-react';
import { publicApi, PublicApiError } from '@/lib/api/publicClient';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { WhatsAppButton } from '@/components/storefront/WhatsAppButton';
import { BrandMark } from '@/components/BrandMark';

// Server Component : pas de JS client nécessaire pour afficher le
// catalogue, rendu direct côté serveur — rapide sur mobile/connexion
// lente, et permet un vrai SEO (generateMetadata ci-dessous) plutôt
// qu'une page vide indexée par les moteurs de recherche/crawlers sociaux.
// La recherche/filtre catégorie/pagination sont délégués à ProductGrid
// (client component, appels API directs) — cette page ne rend QUE
// l'instantané initial, jamais l'état d'une recherche/filtre en cours.
// force-dynamic (avant) obligeait un aller-retour serveur complet — 3
// appels API vers Render — à CHAQUE navigation, y compris un simple
// retour depuis une fiche produit consultée 2 secondes plus tôt (d'où la
// lenteur perçue du bouton retour). revalidate met en cache le HTML
// pendant 30s : un retour dans cette fenêtre s'affiche à l'instant.
export const revalidate = 30;

const PER_PAGE = 24;

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces', orange_money: 'Orange Money', mobile_money: 'Mobile Money', card: 'Carte bancaire',
};

async function getData(slug: string) {
  try {
    const [store, products, categories] = await Promise.all([
      publicApi.getStore(slug),
      publicApi.listProducts(slug, 1, PER_PAGE),
      publicApi.getCategories(slug),
    ]);
    return { store, products, categories };
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return { title: 'Boutique introuvable · BoutikFlow' };
  const { store } = data;
  const description = store.description || `Découvrez les produits de ${store.name} sur BoutikFlow.`;
  // Logo de la boutique comme image d'aperçu — c'est lui qui "masque" le
  // lien brut quand on le colle dans WhatsApp/Instagram/Facebook (statut,
  // message, story) : la plateforme affiche une grande carte avec cette
  // image au lieu du texte de l'URL. Répété en Open Graph ET Twitter Card
  // (WhatsApp et certains navigateurs in-app lisent l'un ou l'autre).
  // "summary_large_image" affiche l'image en grand bandeau plutôt qu'en
  // petite vignette carrée — le lien devient un détail à peine visible en
  // dessous, jamais l'inverse (aucune plateforme ne masque totalement le
  // domaine : protection anti-hameçonnage volontaire, pas un réglage).
  const previewImages = store.has_logo ? [publicApi.logoUrl(slug)] : [];
  return {
    title: `${store.name} · BoutikFlow`,
    description,
    alternates: { canonical: `/boutique/${slug}` },
    openGraph: {
      title: store.name,
      description,
      type: 'website',
      url: `/boutique/${slug}`,
      siteName: store.name,
      images: previewImages,
    },
    twitter: {
      card: previewImages.length > 0 ? 'summary_large_image' : 'summary',
      title: store.name,
      description,
      images: previewImages,
    },
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();
  const { store, products, categories } = data;

  // Bandeau défilant : construit côté serveur à partir des premiers
  // produits déjà chargés — aucune requête ni JS client supplémentaire.
  // Dupliqué une fois pour une boucle CSS parfaitement continue.
  const tickerSource = products.items.slice(0, 8);
  const showTicker = tickerSource.length >= 3;
  const tickerItems = showTicker ? [...tickerSource, ...tickerSource] : [];

  return (
    <div className="storefront light">
      <header className="storefront-header">
        <div className="storefront-header-inner">
          <Link href="/" className="logo-brand">
            <BrandMark size={32} />
            <span className="logo-text">BoutikFlow</span>
          </Link>
        </div>
      </header>

      <main className="storefront-content">
        <div className="store-banner">
          <div className="store-icon">
            {store.has_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicApi.logoUrl(slug)} alt={store.name} className="store-logo-img" />
            ) : (
              <Store size={44} />
            )}
          </div>
          <h1 className="store-name">{store.name}</h1>
          {store.description && <p className="store-description">{store.description}</p>}

          <div className="trust-row">
            <span className="trust-badge verified">
              <BadgeCheck size={14} /> Boutique vérifiée
            </span>
            {!!store.orders_count && store.orders_count > 0 && (
              <span className="trust-badge">
                <ShoppingBag size={14} /> {store.orders_count.toLocaleString('fr-GN')} commande{store.orders_count > 1 ? 's' : ''} servie{store.orders_count > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {(store.opening_hours || store.delivery_info || (store.payment_methods?.length ?? 0) > 0) && (
            <div className="practical-row">
              {store.opening_hours && (
                <span className="practical-item"><Clock size={14} />{store.opening_hours}</span>
              )}
              {store.delivery_info && (
                <span className="practical-item"><Truck size={14} />{store.delivery_info}</span>
              )}
              {(store.payment_methods?.length ?? 0) > 0 && (
                <span className="practical-item">
                  <Wallet size={14} />
                  {store.payment_methods.map(m => PAYMENT_LABELS[m] || m).join(' · ')}
                </span>
              )}
            </div>
          )}
        </div>

        {showTicker && (
          <div className="ticker-wrap" aria-hidden="true">
            <div className="ticker-track">
              {tickerItems.map((p, i) => (
                <span className="ticker-item" key={`${p.id}-${i}`}>
                  <span className="ticker-dot" />
                  <b>{p.name}</b> — {Number(p.price).toLocaleString('fr-GN')} GNF
                </span>
              ))}
            </div>
          </div>
        )}

        <ProductGrid slug={slug} initialData={products} categories={categories} perPage={PER_PAGE} />

        {store.about && (
          <section className="about-section">
            <h2 className="about-title">À propos de {store.name}</h2>
            <p className="about-text">{store.about}</p>
          </section>
        )}
      </main>

      <footer className="storefront-footer">
        <p>Propulsé par BoutikFlow</p>
      </footer>

      {store.public_whatsapp && (
        <WhatsAppButton
          phone={store.public_whatsapp}
          message={`Bonjour ${store.name}, je suis intéressé(e) par vos produits.`}
        />
      )}

      <style>{`
        /* Vitrine publique : toujours claire, même si l'appareil du
           visiteur est en mode sombre (voir classe "light" sur le
           conteneur) — s'appuie sur le design system de l'app
           (globals.css) plutôt qu'une palette dupliquée à la main. */
        .storefront {
          min-height: 100vh;
          background: var(--surface-0);
          color: var(--text-primary);
          font-family: var(--font-sans);
        }
        .storefront-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: color-mix(in srgb, var(--surface-1) 88%, transparent);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
          padding: 1rem 1.5rem;
        }
        .storefront-header-inner {
          max-width: 1100px;
          margin: 0 auto;
        }
        .logo-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          text-decoration: none;
          width: fit-content;
        }
        .logo-text {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .storefront-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .store-banner {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.7rem;
          padding: 1.5rem 1rem 0.5rem;
        }
        .store-icon {
          width: 116px;
          height: 116px;
          border-radius: var(--radius-xl);
          background: linear-gradient(155deg, var(--surface-2), var(--surface-1)) padding-box,
                      linear-gradient(120deg, var(--color-brand-300), var(--color-brand-600) 55%, var(--color-warning)) border-box;
          border: 2px solid transparent;
          box-shadow: var(--shadow-brand);
          color: var(--color-brand-700);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          animation: store-icon-in 0.5s ease;
        }
        @keyframes store-icon-in {
          from { opacity: 0; transform: scale(0.9) translateY(-6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .store-logo-img { width: 100%; height: 100%; object-fit: cover; }
        .store-name {
          font-family: var(--font-display);
          font-size: 1.7rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .store-description {
          max-width: 480px;
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
        }

        .trust-row { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-top: 0.2rem; }
        .trust-badge {
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);
          background: var(--surface-2); border: 1px solid var(--border-default);
          padding: 0.3rem 0.65rem; border-radius: var(--radius-full);
        }
        .trust-badge.verified { color: var(--color-brand-700); background: var(--brand-alpha-15); border-color: transparent; }

        .practical-row { display: flex; gap: 0.6rem; flex-wrap: wrap; justify-content: center; margin-top: 0.1rem; }
        .practical-item {
          display: flex; align-items: center; gap: 0.4rem;
          font-size: 0.82rem; color: var(--text-secondary);
        }
        .practical-item svg { color: var(--color-brand-600); flex-shrink: 0; }

        .about-section {
          border-top: 1px solid var(--border-subtle);
          padding-top: 1.5rem;
          margin-top: 0.5rem;
        }
        .about-title {
          font-family: var(--font-display);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 0.6rem;
        }
        .about-text {
          color: var(--text-secondary);
          font-size: 0.92rem;
          line-height: 1.7;
          white-space: pre-wrap;
          max-width: 70ch;
          margin: 0;
        }

        .ticker-wrap {
          border-top: 1px solid var(--border-subtle);
          border-bottom: 1px solid var(--border-subtle);
          background: var(--surface-2);
          overflow: hidden;
          padding: 0.6rem 0;
          margin: 0 -1.5rem;
        }
        .ticker-track {
          display: flex;
          width: max-content;
          gap: 2.2rem;
          padding: 0 1.5rem;
          animation: ticker-scroll 26s linear infinite;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .ticker-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          white-space: nowrap;
        }
        .ticker-item b { color: var(--text-primary); font-weight: 600; }
        .ticker-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--color-warning); flex-shrink: 0;
        }

        .storefront-footer {
          text-align: center;
          padding: 2rem 1rem;
          color: var(--text-muted);
          font-size: 0.85rem;
          border-top: 1px solid var(--border-subtle);
          margin-top: 1rem;
        }

        @media (prefers-reduced-motion: reduce) {
          .ticker-track { animation: none; }
          .store-icon { animation: none; }
        }

        @media (max-width: 640px) {
          .store-icon { width: 88px; height: 88px; }
        }
      `}</style>
    </div>
  );
}
