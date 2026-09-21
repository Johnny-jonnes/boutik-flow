import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { publicApi, PublicApiError } from '@/lib/api/publicClient';
import { ShareButtons } from '@/components/storefront/ShareButtons';
import { WhatsAppButton } from '@/components/storefront/WhatsAppButton';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://boutik-flow.vercel.app';

async function getData(slug: string, productId: string) {
  try {
    const [store, product] = await Promise.all([
      publicApi.getStore(slug),
      publicApi.getProduct(slug, productId),
    ]);
    return { store, product };
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  const data = await getData(slug, productId);
  if (!data) return { title: 'Produit introuvable · BoutikFlow' };
  const { store, product } = data;
  const priceLabel = `${Number(product.price).toLocaleString('fr-GN')} GNF`;
  const description = product.description || `${product.name} — ${priceLabel} — ${store.name}`;
  // Photo du produit en priorité (le plus pertinent pour un lien vers CE
  // produit précis) ; à défaut, le logo de la boutique — jamais un lien nu
  // sans aperçu, voir boutique/[slug]/page.tsx pour la même logique.
  const images = product.has_image ? [publicApi.imageUrl(slug, product.id)] : (store.has_logo ? [publicApi.logoUrl(slug)] : []);
  return {
    title: `${product.name} — ${priceLabel} · ${store.name}`,
    description,
    alternates: { canonical: `/boutique/${slug}/produit/${productId}` },
    openGraph: {
      title: product.name,
      description,
      type: 'website',
      url: `/boutique/${slug}/produit/${productId}`,
      siteName: store.name,
      images,
    },
    twitter: {
      card: images.length > 0 ? 'summary_large_image' : 'summary',
      title: product.name,
      description,
      images,
    },
  };
}

export default async function StorefrontProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const data = await getData(slug, productId);
  if (!data) notFound();
  const { store, product } = data;
  const waMessage = `Bonjour, je suis intéressé(e) par "${product.name}" (${Number(product.price).toLocaleString('fr-GN')} GNF) sur ${store.name}.`;
  const waHref = store.public_whatsapp
    ? `https://wa.me/${store.public_whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(waMessage)}`
    : null;

  return (
    <div className="storefront light">
      <header className="storefront-header">
        <div className="storefront-header-inner">
          <Link href={`/boutique/${slug}`} className="back-link">
            <ArrowLeft size={18} />
            <span>Retour à {store.name}</span>
          </Link>
        </div>
      </header>

      <main className="product-detail">
        <div className="product-detail-image-wrap">
          {product.has_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicApi.imageUrl(slug, product.id)} alt={product.name} className="product-detail-image" />
          ) : (
            <div className="product-detail-image-placeholder" />
          )}
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="image-contact-badge" aria-label="Contacter le vendeur sur WhatsApp">
              <MessageCircle size={15} fill="white" strokeWidth={0} />
              <span>Contacter le vendeur</span>
            </a>
          )}
        </div>

        <div className="product-detail-info">
          {product.category_name && <span className="product-category">{product.category_name}</span>}
          <h1 className="product-detail-name">{product.name}</h1>
          <span className="product-detail-price">{Number(product.price).toLocaleString('fr-GN')} GNF</span>
          {!product.is_available && <span className="badge-unavailable-inline">Rupture de stock</span>}
          {product.description && <p className="product-detail-description">{product.description}</p>}

          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="wa-inline-btn">
              Discuter sur WhatsApp
            </a>
          )}

          <ShareButtons
            url={`${SITE_URL}/boutique/${slug}/produit/${productId}`}
            title={product.name}
            price={`${Number(product.price).toLocaleString('fr-GN')} GNF`}
          />
        </div>
      </main>

      <footer className="storefront-footer">
        <p>Propulsé par BoutikFlow</p>
      </footer>

      {store.public_whatsapp && (
        <WhatsAppButton
          phone={store.public_whatsapp}
          message={`Bonjour, je suis intéressé(e) par "${product.name}" (${Number(product.price).toLocaleString('fr-GN')} GNF) sur ${store.name}.`}
        />
      )}

      <style>{`
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
          max-width: 700px;
          margin: 0 auto;
        }
        .back-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: fit-content;
          margin: -0.5rem;
          padding: 0.5rem;
          border-radius: var(--radius-md);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-brand-700);
          transition: background 0.15s ease;
        }
        .back-link:hover { background: var(--surface-2); }
        .back-link:active { background: var(--surface-3); }
        .product-detail {
          max-width: 700px;
          margin: 0 auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .product-detail-image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          max-height: 420px;
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--surface-2);
          animation: pd-fade-in 0.4s ease;
        }
        .image-contact-badge {
          position: absolute;
          left: 0.75rem;
          bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(37, 211, 102, 0.94);
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.5rem 0.8rem;
          border-radius: var(--radius-full);
          text-decoration: none;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .image-contact-badge:hover { transform: translateY(-2px); filter: brightness(1.05); }
        @keyframes pd-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .product-detail-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .product-detail-image-placeholder {
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, var(--surface-2), var(--surface-3));
        }
        .product-detail-info {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          animation: pd-slide-in 0.45s ease 0.1s backwards;
        }
        @keyframes pd-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .product-category {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-brand-600);
        }
        .product-detail-name {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .product-detail-price {
          font-size: 1.3rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          background: linear-gradient(90deg, var(--color-brand-700), var(--color-warning));
          -webkit-background-clip: text; background-clip: text; color: transparent;
          width: fit-content;
        }
        .badge-unavailable-inline {
          display: inline-block;
          width: fit-content;
          background: color-mix(in srgb, var(--color-error) 12%, transparent);
          color: var(--color-error);
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.3rem 0.7rem;
          border-radius: var(--radius-sm);
        }
        .product-detail-description {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.7;
          white-space: pre-wrap;
        }
        .wa-inline-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: fit-content;
          background: #25d366;
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          padding: 0.7rem 1.3rem;
          border-radius: var(--radius-md);
          text-decoration: none;
          transition: filter 0.15s ease;
        }
        .wa-inline-btn:hover { filter: brightness(1.08); }
        .storefront-footer {
          text-align: center;
          padding: 2rem 1rem;
          color: var(--text-muted);
          font-size: 0.85rem;
          border-top: 1px solid var(--border-subtle);
          margin-top: 2rem;
        }
      `}</style>
    </div>
  );
}
