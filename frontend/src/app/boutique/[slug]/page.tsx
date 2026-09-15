import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Store } from 'lucide-react';
import { publicApi, PublicApiError } from '@/lib/api/publicClient';

// Server Component : pas de JS client nécessaire pour afficher le
// catalogue, rendu direct côté serveur — rapide sur mobile/connexion
// lente, et permet un vrai SEO (generateMetadata ci-dessous) plutôt
// qu'une page vide indexée par les moteurs de recherche/crawlers sociaux.
export const dynamic = 'force-dynamic';

async function getStore(slug: string) {
  try {
    return await publicApi.getStore(slug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) return { title: 'Boutique introuvable · BoutikFlow' };
  return {
    title: `${store.name} · BoutikFlow`,
    description: `Découvrez les produits de ${store.name} sur BoutikFlow.`,
    openGraph: {
      title: store.name,
      description: `Découvrez les produits de ${store.name} sur BoutikFlow.`,
      type: 'website',
    },
  };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const products = await publicApi.listProducts(slug, 1, 40);

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
          <div className="store-icon"><Store size={28} /></div>
          <h1 className="store-name">{store.name}</h1>
        </div>

        {products.items.length === 0 ? (
          <div className="empty-state">
            <p>Cette boutique n&apos;a pas encore de produits publiés.</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.items.map((p) => (
              <Link key={p.id} href={`/boutique/${slug}/produit/${p.id}`} className="product-card">
                <div className="product-image-wrap">
                  {p.has_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicApi.imageUrl(slug, p.id)} alt={p.name} className="product-image" loading="lazy" />
                  ) : (
                    <div className="product-image-placeholder" />
                  )}
                  {!p.is_available && <span className="badge-unavailable">Rupture</span>}
                </div>
                <div className="product-info">
                  <span className="product-name">{p.name}</span>
                  <span className="product-price">{Number(p.price).toLocaleString('fr-GN')} GNF</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="storefront-footer">
        <p>Propulsé par BoutikFlow</p>
      </footer>

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
          max-width: 1000px;
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
          max-width: 1000px;
          margin: 0 auto;
          padding: 1.5rem;
        }
        .store-banner {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.75rem;
          padding: 2rem 1rem;
        }
        .store-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .store-name {
          font-size: 1.6rem;
          font-weight: 800;
          color: white;
          margin: 0;
        }
        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #9ca3af;
        }
        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }
        .product-card {
          display: flex;
          flex-direction: column;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          overflow: hidden;
          text-decoration: none;
          transition: border-color 0.15s ease;
        }
        .product-card:hover {
          border-color: rgba(16, 185, 129, 0.4);
        }
        .product-image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          background: #1f2937;
        }
        .product-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .product-image-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #1f2937, #111827);
        }
        .badge-unavailable {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: rgba(244, 63, 94, 0.9);
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
        }
        .product-info {
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .product-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: #f3f4f6;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .product-price {
          font-size: 0.85rem;
          font-weight: 700;
          color: #34d399;
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
