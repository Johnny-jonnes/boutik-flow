import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
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
  const accent = store.theme_color || '#10b981';

  return (
    <div className="storefront">
      <header className="storefront-header">
        <div className="storefront-header-inner">
          <Link href={`/boutique/${slug}`} className="back-link" style={{ color: accent }}>
            <ArrowLeft size={16} />
            <span>{store.name}</span>
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
        </div>

        <div className="product-detail-info">
          {product.category_name && <span className="product-category" style={{ color: accent }}>{product.category_name}</span>}
          <h1 className="product-detail-name">{product.name}</h1>
          <span className="product-detail-price" style={{ color: accent }}>{Number(product.price).toLocaleString('fr-GN')} GNF</span>
          {!product.is_available && <span className="badge-unavailable-inline">Rupture de stock</span>}
          {product.description && <p className="product-detail-description">{product.description}</p>}

          {store.public_whatsapp && (
            <a
              href={`https://wa.me/${store.public_whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par "${product.name}" (${Number(product.price).toLocaleString('fr-GN')} GNF) sur ${store.name}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="wa-inline-btn"
            >
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
          max-width: 700px;
          margin: 0 auto;
        }
        .back-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .back-link:hover { opacity: 0.8; }
        .product-detail {
          max-width: 700px;
          margin: 0 auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .product-detail-image-wrap {
          width: 100%;
          aspect-ratio: 1;
          max-height: 420px;
          border-radius: 16px;
          overflow: hidden;
          background: #1f2937;
          animation: pd-fade-in 0.4s ease;
        }
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
          background: linear-gradient(135deg, #1f2937, #111827);
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
        }
        .product-detail-name {
          font-size: 1.5rem;
          font-weight: 800;
          color: white;
          margin: 0;
        }
        .product-detail-price {
          font-size: 1.3rem;
          font-weight: 700;
        }
        .badge-unavailable-inline {
          display: inline-block;
          width: fit-content;
          background: rgba(244, 63, 94, 0.15);
          color: #fb7185;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.3rem 0.7rem;
          border-radius: 8px;
        }
        .product-detail-description {
          color: #9ca3af;
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
          border-radius: 10px;
          text-decoration: none;
          transition: filter 0.15s ease;
        }
        .wa-inline-btn:hover { filter: brightness(1.08); }
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
