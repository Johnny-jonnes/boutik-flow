'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, X, Loader2, LayoutGrid, ChevronLeft, ChevronRight, ArrowUpRight, ImageIcon, PackageSearch } from 'lucide-react';
import { publicApi, PublicProduct, PublicProductList, PublicCategory } from '@/lib/api/publicClient';
import { formatNumber } from '@/lib/format';

// Rail de catégories + recherche + grille — composant client isolé : la
// page boutique elle-même reste un Server Component (SEO), seule cette
// section a besoin d'interactivité. Les catégories viennent de
// GET /storefront/{slug}/categories — jamais une liste écrite en dur,
// chaque boutique affiche exactement les catégories qu'elle a créées et
// qui contiennent au moins un produit public (voir cahier des charges :
// "le tri par catégorie doit correspondre à ce que le boutiquier a mis").
// Styles : styles/storefront.css (classes sf-*).
export function ProductGrid({
  slug,
  initialData,
  categories,
  perPage,
}: {
  slug: string;
  initialData: PublicProductList;
  categories: PublicCategory[];
  perPage: number;
}) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [data, setData] = useState(initialData);
  const [isSearching, setIsSearching] = useState(false);
  const [isPaging, setIsPaging] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Un seul point d'entrée pour (re)charger la page 1 selon les filtres
  // courants — appelé depuis les handlers (clic catégorie, saisie
  // recherche), jamais depuis un effet : l'action de l'utilisateur EST
  // l'événement déclencheur.
  const runQuery = (nextQuery: string, nextCategoryId: string | null) => {
    if (!nextQuery.trim() && !nextCategoryId) {
      setIsSearching(false);
      setData(initialData);
      return;
    }
    setIsSearching(true);
    publicApi.listProducts(slug, 1, perPage, nextQuery, nextCategoryId || undefined)
      .then(res => setData(res))
      .catch(() => {
        // Silencieux : au pire la grille garde son dernier résultat connu.
      })
      .finally(() => setIsSearching(false));
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    setDebounceTimer(setTimeout(() => runQuery(value, categoryId), 350));
  };

  const handleCategoryClick = (id: string | null) => {
    setCategoryId(id);
    if (debounceTimer) clearTimeout(debounceTimer);
    runQuery(query, id);
  };

  // Pagination réelle : chaque page reste bornée à `perPage` éléments —
  // jamais le catalogue entier chargé en mémoire. Le changement de page fait
  // d'abord sortir les cartes actuelles, puis charge/affiche la nouvelle page
  // une fois la petite animation de sortie terminée, et remonte en haut du
  // catalogue (sinon on reste en bas de page, devant une grille qui change).
  const goToPage = (page: number) => {
    if (page === data.page || isPaging) return;
    setIsPaging(true);
    setIsLeaving(true);
    setTimeout(() => {
      publicApi.listProducts(slug, page, perPage, query, categoryId || undefined)
        .then(res => {
          setData(res);
          document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(() => {
          // Silencieux : la pagination reste utilisable pour réessayer.
        })
        .finally(() => {
          setIsLeaving(false);
          setIsPaging(false);
        });
    }, 180);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / perPage));
  const totalAll = initialData.total;
  const activeCategory = categories.find(c => c.id === categoryId);

  return (
    <>
      <div className="sf-toolbar">
        <div className="sf-search">
          <Search size={18} />
          <input
            type="search"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Rechercher un produit…"
            aria-label="Rechercher un produit"
          />
          {query && (
            <button type="button" className="sf-search__clear" onClick={() => handleQueryChange('')} aria-label="Effacer la recherche">
              <X size={16} />
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <nav className="sf-chips" aria-label="Catégories">
            <button
              type="button"
              className={'sf-chip' + (categoryId === null ? ' sf-chip--active' : '')}
              onClick={() => handleCategoryClick(null)}
              aria-pressed={categoryId === null}
            >
              <LayoutGrid size={15} /> Tout <span className="sf-chip__count">{totalAll}</span>
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                className={'sf-chip' + (categoryId === c.id ? ' sf-chip--active' : '')}
                onClick={() => handleCategoryClick(c.id)}
                aria-pressed={categoryId === c.id}
              >
                {c.name} <span className="sf-chip__count">{c.count}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {!isSearching && data.items.length > 0 && (
        <p className="sf-results">
          <b>{formatNumber(data.total)}</b> produit{data.total > 1 ? 's' : ''}
          {activeCategory && <> dans <b>{activeCategory.name}</b></>}
          {query.trim() && <> pour « <b>{query.trim()}</b> »</>}
        </p>
      )}

      {isSearching ? (
        <div className="sf-state"><Loader2 size={22} className="sf-spin" /></div>
      ) : data.items.length === 0 ? (
        <div className="sf-state">
          <span className="sf-state__icon"><PackageSearch size={24} /></span>
          {query || categoryId ? 'Aucun produit ne correspond à votre recherche.' : "Cette boutique n'a pas encore de produits publiés."}
        </div>
      ) : (
        <>
          <div className="sf-grid">
            {data.items.map((p: PublicProduct, i: number) => (
              <Link
                key={p.id}
                href={`/boutique/${slug}/produit/${p.id}`}
                className={'sf-card' + (isLeaving ? ' sf-card--leaving' : '')}
                style={{ animationDelay: isLeaving ? '0ms' : `${Math.min(i, 11) * 40}ms` }}
              >
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

          {totalPages > 1 && (
            <nav className="sf-pager" aria-label="Pages du catalogue">
              <button
                type="button"
                className="sf-page"
                disabled={data.page === 1 || isPaging}
                onClick={() => goToPage(data.page - 1)}
                aria-label="Page précédente"
              >
                <ChevronLeft size={16} />
              </button>
              {getPageNumbers(data.page, totalPages).map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e${i}`} className="sf-page-gap">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={'sf-page' + (p === data.page ? ' sf-page--active' : '')}
                    disabled={isPaging}
                    onClick={() => goToPage(p)}
                    aria-current={p === data.page ? 'page' : undefined}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                className="sf-page"
                disabled={data.page === totalPages || isPaging}
                onClick={() => goToPage(data.page + 1)}
                aria-label="Page suivante"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}

// Fenêtre de pagination avec "…" — évite une rangée de 30 boutons sur un
// grand catalogue. En dessous de 8 pages, tout s'affiche (pas de repli utile).
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1];
  if (current > 3) pages.push('ellipsis');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}
