import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Store, BadgeCheck, ShoppingBag, Clock, Truck, Wallet, MessageCircle, Package, LayoutGrid, Info } from 'lucide-react';
import { publicApi, PublicApiError } from '@/lib/api/publicClient';
import { ProductGrid } from '@/components/storefront/ProductGrid';
import { WhatsAppButton } from '@/components/storefront/WhatsAppButton';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShareStoreButton } from '@/components/storefront/ShareButtons';
import '@/styles/storefront.css';

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
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://boutik-flow.vercel.app';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces', orange_money: 'Orange Money', mobile_money: 'Mobile Money', card: 'Carte bancaire',
};

/** Couleur de la boutique (Réglages) si valide, sinon l'émeraude BoutikFlow. */
function storeAccent(color: string | null | undefined): string {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#10b981';
}

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

  const storeUrl = `${SITE_URL}/boutique/${slug}`;
  const waHref = store.public_whatsapp
    ? `https://wa.me/${store.public_whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(`Bonjour ${store.name}, je suis intéressé(e) par vos produits.`)}`
    : null;
  const payments = (store.payment_methods ?? []).map(m => PAYMENT_LABELS[m] || m);
  const facts = [
    store.opening_hours && { icon: Clock, label: 'Horaires', value: store.opening_hours },
    store.delivery_info && { icon: Truck, label: 'Livraison', value: store.delivery_info },
    payments.length > 0 && { icon: Wallet, label: 'Paiement', value: payments.join(' · ') },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[];

  // Bandeau défilant : construit côté serveur à partir des premiers
  // produits déjà chargés — aucune requête ni JS client supplémentaire.
  // Dupliqué une fois pour une boucle CSS parfaitement continue.
  const tickerSource = products.items.slice(0, 8);
  const showTicker = tickerSource.length >= 3;
  const tickerItems = showTicker ? [...tickerSource, ...tickerSource] : [];

  const logo = (size: number) => store.has_logo
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={publicApi.logoUrl(slug)} alt={store.name} />
    : <Store size={size} />;

  return (
    // Plus de classe "light" forcée : la vitrine suit le thème du visiteur
    // (clair/sombre), avec une bascule dans l'en-tête.
    <div className="sf" style={{ '--sf-accent': storeAccent(store.theme_color) } as React.CSSProperties}>
      <header className="sf-header">
        <div className="sf-container sf-header__inner">
          <Link href={`/boutique/${slug}`} className="sf-brand">
            <span className="sf-brand__logo">{logo(20)}</span>
            <span className="sf-brand__name">{store.name}</span>
          </Link>
          <div className="sf-header__actions">
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn--wa sf-btn--sm sf-hide-mobile">
                <MessageCircle size={16} fill="white" strokeWidth={0} /> WhatsApp
              </a>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <section className="sf-container sf-hero">
          <div className="sf-cover" aria-hidden="true" />
          <div className="sf-identity">
            <div className="sf-logo">{logo(48)}</div>
            <div className="sf-identity__text">
              <h1 className="sf-name">{store.name}</h1>
              {store.description && <p className="sf-desc">{store.description}</p>}
              <div className="sf-badges">
                {store.is_verified && (
                  <span className="sf-badge sf-badge--verified"><BadgeCheck size={14} /> Boutique vérifiée</span>
                )}
                {!!store.orders_count && store.orders_count > 0 && (
                  <span className="sf-badge">
                    <ShoppingBag size={14} /> {store.orders_count.toLocaleString('fr-GN')} commande{store.orders_count > 1 ? 's' : ''} servie{store.orders_count > 1 ? 's' : ''}
                  </span>
                )}
                {products.total > 0 && (
                  <span className="sf-badge"><Package size={14} /> {products.total} produit{products.total > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <div className="sf-identity__cta">
              {waHref ? (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn--wa">
                  <MessageCircle size={18} fill="white" strokeWidth={0} /> Commander
                </a>
              ) : (
                <a href="#catalogue" className="sf-btn sf-btn--primary"><LayoutGrid size={17} /> Voir le catalogue</a>
              )}
              <ShareStoreButton url={storeUrl} name={store.name} />
            </div>
          </div>

          {facts.length > 0 && (
            <div className="sf-facts">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="sf-fact">
                  <span className="sf-fact__icon"><Icon size={19} /></span>
                  <span>
                    <span className="sf-fact__label">{label}</span>
                    <span className="sf-fact__value" style={{ display: 'block' }}>{value}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {showTicker && (
          <div className="sf-ticker" aria-hidden="true">
            <div className="sf-ticker__track">
              {tickerItems.map((p, i) => (
                <span className="sf-ticker__item" key={`${p.id}-${i}`}>
                  <span className="sf-ticker__dot" />
                  <b>{p.name}</b> {Number(p.price).toLocaleString('fr-GN')} GNF
                </span>
              ))}
            </div>
          </div>
        )}

        <section id="catalogue" className="sf-container sf-section">
          <div className="sf-section__head">
            <div>
              <h2 className="sf-section__title">Nos produits</h2>
              <p className="sf-section__sub">Touchez un produit pour voir les détails et commander.</p>
            </div>
          </div>
          <ProductGrid slug={slug} initialData={products} categories={categories} perPage={PER_PAGE} />
        </section>

        {/* Contenu configuré dans Paramètres → Ma page vitrine : chaque panneau
            n'apparaît que si le boutiquier a rempli les champs correspondants. */}
        {(store.about || facts.length > 0 || waHref) && (
          <section className="sf-container sf-section">
            <div className={`sf-about${store.about && (facts.length > 0 || waHref) ? '' : ' sf-about--single'}`}>
              {store.about && (
                <div className="sf-panel">
                  <h3>À propos de {store.name}</h3>
                  <p className="sf-about__text">{store.about}</p>
                </div>
              )}
              {(facts.length > 0 || waHref) && (
                <div className="sf-panel">
                  <h3>Commander facilement</h3>
                  <div className="sf-info-list">
                    {waHref && (
                      <div className="sf-info">
                        <span className="sf-fact__icon"><Info size={18} /></span>
                        <span className="sf-fact__value">Choisissez vos produits, puis envoyez-nous un message : nous confirmons la disponibilité et la livraison.</span>
                      </div>
                    )}
                    {facts.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="sf-info">
                        <span className="sf-fact__icon"><Icon size={18} /></span>
                        <span>
                          <span className="sf-fact__label">{label}</span>
                          <span className="sf-fact__value" style={{ display: 'block' }}>{value}</span>
                        </span>
                      </div>
                    ))}
                    {waHref && (
                      <a href={waHref} target="_blank" rel="noopener noreferrer" className="sf-btn sf-btn--wa sf-btn--block">
                        <MessageCircle size={18} fill="white" strokeWidth={0} /> Écrire sur WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}
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
        <WhatsAppButton
          phone={store.public_whatsapp}
          message={`Bonjour ${store.name}, je suis intéressé(e) par vos produits.`}
        />
      )}
    </div>
  );
}
