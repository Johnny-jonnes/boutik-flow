import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Store } from 'lucide-react';
import { publicApi, PublicApiError } from '@/lib/api/publicClient';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { WhatsAppButton } from '@/components/storefront/WhatsAppButton';

// Server Component : pas de JS client nécessaire pour afficher le
// catalogue, rendu direct côté serveur — rapide sur mobile/connexion
// lente, et permet un vrai SEO (generateMetadata ci-dessous) plutôt
// qu'une page vide indexée par les moteurs de recherche/crawlers sociaux.
// La recherche/pagination "voir plus" sont déléguées à ProductGrid (client
// component), seule partie de la page qui a besoin d'interactivité.
export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

// Convertit #RRGGBB en rgba(...) pour les fonds/halos dérivés de la couleur
// d'accent choisie par le boutiquier — calculé côté serveur (Server
// Component), pas de JS client nécessaire pour ça.
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(16, 185, 129, ${alpha})`;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

async function getData(slug: string) {
  try {
    const [store, products] = await Promise.all([
      publicApi.getStore(slug),
      publicApi.listProducts(slug, 1, PER_PAGE),
    ]);
    return { store, products };
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
  return {
    title: `${store.name} · BoutikFlow`,
    description,
    alternates: { canonical: `/boutique/${slug}` },
    openGraph: {
      title: store.name,
      description,
      type: 'website',
      url: `/boutique/${slug}`,
      images: store.has_logo ? [publicApi.logoUrl(slug)] : [],
    },
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();
  const { store, products } = data;

  const accent = store.theme_color || '#10b981';
  const accentSoft = hexToRgba(accent, 0.12);
  const accentGlow = hexToRgba(accent, 0.35);

  return (
    <div className="storefront">
      <header className="storefront-header">
        <div className="storefront-header-inner">
          <Link href="/" className="logo-brand">
            <span className="logo-badge">BF</span>
            <span className="logo-text">BoutikFlow</span>
          </Link>
        </div>
      </header>

      <main className="storefront-content">
        <div className="store-banner">
          <div className="store-glow" style={{ background: accentGlow }} />
          <div className="store-icon" style={{ background: accentSoft, color: accent, borderColor: hexToRgba(accent, 0.3) }}>
            {store.has_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicApi.logoUrl(slug)} alt={store.name} className="store-logo-img" />
            ) : (
              <Store size={28} />
            )}
          </div>
          <h1 className="store-name">{store.name}</h1>
          {store.description && <p className="store-description">{store.description}</p>}
        </div>

        <ProductGrid slug={slug} initialData={products} perPage={PER_PAGE} accent={accent} />
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
        .storefront {
          min-height: 100vh;
          background: #090d16;
          color: #e5e7eb;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .storefront-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
        .logo-badge {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(135deg, #10b981, #059669);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 0.9rem;
        }
        .logo-text {
          font-size: 1.2rem;
          font-weight: 700;
          color: white;
        }
        .storefront-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 1.5rem;
        }
        .store-banner {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.6rem;
          padding: 2.5rem 1rem 2rem;
          overflow: hidden;
        }
        .store-glow {
          position: absolute;
          top: -60px;
          left: 50%;
          transform: translateX(-50%);
          width: 320px;
          height: 200px;
          filter: blur(60px);
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }
        .store-icon {
          position: relative;
          z-index: 1;
          width: 64px;
          height: 64px;
          border-radius: 18px;
          border: 1px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          animation: store-icon-in 0.5s ease;
        }
        @keyframes store-icon-in {
          from { opacity: 0; transform: scale(0.85) translateY(-6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .store-logo-img { width: 100%; height: 100%; object-fit: cover; }
        .store-name {
          position: relative;
          z-index: 1;
          font-size: 1.7rem;
          font-weight: 800;
          color: white;
          margin: 0;
        }
        .store-description {
          position: relative;
          z-index: 1;
          max-width: 480px;
          color: #9ca3af;
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
        }
        .storefront-footer {
          text-align: center;
          padding: 2rem 1rem;
          color: #6b7280;
          font-size: 0.85rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin-top: 2rem;
        }
      `}</style>
    </div>
  );
}
