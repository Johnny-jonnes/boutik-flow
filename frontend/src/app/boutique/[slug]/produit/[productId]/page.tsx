import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, MessageCircle, BadgeCheck, Truck, Wallet, Clock, Store, ImageIcon, ArrowUpRight } from 'lucide-react';
import { publicApi, PublicApiError, type PublicProduct } from '@/lib/api/publicClient';
import { ShareButtons } from '@/components/storefront/ShareButtons';
import { WhatsAppButton } from '@/components/storefront/WhatsAppButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BrandMark } from '@/components/BrandMark';
import { formatNumber } from '@/lib/format';
import '@/styles/storefront.css';

// force-dynamic (avant) obligeait un aller-retour serveur complet — 2
// appels API réseau vers Render — à CHAQUE navigation, y compris un
// simple retour vers une fiche déjà vue il y a 2 secondes : d'où la
// lenteur (2-3s) du bouton retour. Un produit public n'a pas besoin
// d'être à la milliseconde près (le flux d'achat passe par WhatsApp, pas
// une transaction en direct sur cette page) — revalidate met en cache le
// HTML pendant 30s : un retour dans cette fenêtre s'affiche à l'instant,
// tout en gardant les données globalement à jour.
export const revalidate = 30;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://boutik-flow.vercel.app';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces', orange_money: 'Orange Money', mobile_money: 'Mobile Money', card: 'Carte bancaire',
};

/** Couleur de la boutique (Réglages) si valide, sinon l'émeraude BoutikFlow. */
function storeAccent(color: string | null | undefined): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#10b981';
}

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

/** "Vous aimerez aussi" : même catégorie d'abord, sinon le reste du
 *  catalogue. Jamais bloquant — une erreur réseau masque simplement la section. */
async function getRelated(slug: string, product: PublicProduct): Promise<PublicProduct[]> {
  try {
    let items: PublicProduct[] = [];
    if (product.category_name) {
      const categories = await publicApi.getCategories(slug);
      const category = categories.find(c => c.name === product.category_name);
      if (category) items = (await publicApi.listProducts(slug, 1, 5, undefined, category.id)).items;
    }
    items = items.filter(p => p.id !== product.id);
    if (items.length < 4) {
      const more = (await publicApi.listProducts(slug, 1, 9)).items;
      for (const p of more) {
        if (items.length >= 4) break;
        if (p.id !== product.id && !items.some(i => i.id === p.id)) items.push(p);
      }
    }
    return items.slice(0, 4);
  } catch {
    return [];
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
  const related = await getRelated(slug, product);

  const priceLabel = `${Number(product.price).toLocaleString('fr-GN')} GNF`;
  const waMessage = `Bonjour, je suis intéressé(e) par "${product.name}" (${priceLabel}) sur ${store.name}.`;
  const waHref = store.public_whatsapp
    ? `https://wa.me/${store.public_whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(waMessage)}`
    : null;
  const payments = (store.payment_methods ?? []).map(m => PAYMENT_LABELS[m] || m);
  const assurances = [
    store.is_verified && { icon: BadgeCheck, text: 'Boutique vérifiée' },
    store.delivery_info && { icon: Truck, text: store.delivery_info },
    payments.length > 0 && { icon: Wallet, text: payments.join(' · ') },
    store.opening_hours && { icon: Clock, text: store.opening_hours },
  ].filter(Boolean) as { icon: typeof BadgeCheck; text: string }[];

  return (
    <div className="sf" style={{ '--sf-accent': storeAccent(store.theme_color) } as React.CSSProperties}>
      <header className="sf-header">
        <div className="sf-container sf-header__inner">
          <Link href={`/boutique/${slug}`} className="sf-back">
            <span className="sf-back__icon"><ArrowLeft size={18} /></span>
            <span className="sf-brand__logo" style={{ width: 32, height: 32, borderRadius: 10 }}>
              {store.has_logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={publicApi.logoUrl(slug)} alt="" />
                : <Store size={16} />}
            </span>
            <span className="sf-brand__name" style={{ fontSize: '0.98rem' }}>{store.name}</span>
          </Link>
          <div className="sf-header__actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="sf-container">
        <section className="sf-product">
          <div className="sf-gallery">
            {product.has_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicApi.imageUrl(slug, product.id)} alt={product.name} />
            ) : (
              <div className="sf-card__placeholder"><ImageIcon size={42} /></div>
            )}
            {product.category_name && <span className="sf-card__tag">{product.category_name}</span>}
          </div>

          <div className="sf-pinfo">
            <h1 className="sf-pinfo__name">{product.name}</h1>
            <div className="sf-pinfo__price">{formatNumber(Number(product.price))}<small>GNF</small></div>
            <span className={`sf-stock ${product.is_available ? 'sf-stock--in' : 'sf-stock--out'}`}>
              <i /> {product.is_available ? 'Disponible' : 'Rupture de stock'}
            </span>
            {product.description && <p className="sf-pinfo__desc">{product.description}</p>}

            {waHref ? (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn--wa sf-btn--block" style={{ height: 54, fontSize: '1rem' }}>
                <MessageCircle size={20} fill="white" strokeWidth={0} /> Commander sur WhatsApp
              </a>
            ) : (
              <Link href={`/boutique/${slug}`} className="sf-btn sf-btn--primary sf-btn--block" style={{ height: 54 }}>
                Voir toute la boutique
              </Link>
            )}

            {assurances.length > 0 && (
              <>
                <div className="sf-divider" />
                <div className="sf-assurances">
                  {assurances.map(({ icon: Icon, text }) => (
                    <div key={text} className="sf-assurance">
                      <span className="sf-fact__icon"><Icon size={17} /></span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="sf-divider" />
            <ShareButtons url={`${SITE_URL}/boutique/${slug}/produit/${productId}`} title={product.name} price={priceLabel} />
          </div>
        </section>

        {related.length > 0 && (
          <section className="sf-section">
            <div className="sf-section__head">
              <div>
                <h2 className="sf-section__title">Vous aimerez aussi</h2>
                <p className="sf-section__sub">D&apos;autres produits de {store.name}</p>
              </div>
              <Link href={`/boutique/${slug}`} className="sf-btn sf-btn--ghost sf-btn--sm">Tout voir</Link>
            </div>
            <div className="sf-grid">
              {related.map((p, i) => (
                <Link key={p.id} href={`/boutique/${slug}/produit/${p.id}`} className="sf-card" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="sf-card__media">
                    {p.has_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={publicApi.imageUrl(slug, p.id)} alt={p.name} loading="lazy" />
                    ) : (
                      <div className="sf-card__placeholder"><ImageIcon size={28} /></div>
                    )}
                    {p.category_name && <span className="sf-card__tag">{p.category_name}</span>}
                  </div>
                  <div className="sf-card__body">
                    <span className="sf-card__name">{p.name}</span>
                    <div className="sf-card__foot">
                      <span className="sf-price">{formatNumber(Number(p.price))}<small>GNF</small></span>
                      <span className="sf-card__go" aria-hidden="true"><ArrowUpRight size={17} /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="sf-footer">
        <div className="sf-container sf-footer__inner">
          {/* Page destinée aux clients de la boutique : aucun lien vers
              l'application (accueil, connexion, inscription), simple mention. */}
          <span className="sf-footer__brand">
            <BrandMark size={26} /> Propulsé par <b>BoutikFlow</b>
          </span>
        </div>
      </footer>

      {store.public_whatsapp && (
        <WhatsAppButton phone={store.public_whatsapp} message={waMessage} />
      )}
    </div>
  );
}
