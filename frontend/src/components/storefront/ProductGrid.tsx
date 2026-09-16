'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, X, Loader2, Grid3x3, ChevronLeft, ChevronRight } from 'lucide-react';
import { publicApi, PublicProduct, PublicProductList, PublicCategory } from '@/lib/api/publicClient';

// Rail de catégories + recherche + grille — composant client isolé : la
// page boutique elle-même reste un Server Component (SEO), seule cette
// section a besoin d'interactivité. Les catégories viennent de
// GET /storefront/{slug}/categories — jamais une liste écrite en dur,
// chaque boutique affiche exactement les catégories qu'elle a créées et
// qui contiennent au moins un produit public (voir cahier des charges :
// "le tri par catégorie doit correspondre à ce que le boutiquier a mis").
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

  // Pagination réelle (remplace l'ancien "Voir plus" qui empilait les
  // produits) : chaque page reste bornée à `perPage` éléments — jamais le
  // catalogue entier chargé en mémoire. Le changement de page fait d'abord
  // sortir les cartes actuelles (classe "leaving"), puis charge/affiche la
  // nouvelle page une fois la petite animation de sortie terminée.
  const goToPage = (page: number) => {
    if (page === data.page || isPaging) return;
    setIsPaging(true);
    setIsLeaving(true);
    setTimeout(() => {
      publicApi.listProducts(slug, page, perPage, query, categoryId || undefined)
        .then(res => setData(res))
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

  return (
    <div className="pg-wrap">
      {categories.length > 0 && (
        <nav className="pg-cat-rail" aria-label="Catégories">
          <button
            type="button"
            className={'pg-cat-pill' + (categoryId === null ? ' active' : '')}
            onClick={() => handleCategoryClick(null)}
          >
            <Grid3x3 size={14} />
            <span>Tout</span>
            <span className="pg-cat-count">{totalAll}</span>
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              className={'pg-cat-pill' + (categoryId === c.id ? ' active' : '')}
              onClick={() => handleCategoryClick(c.id)}
            >
              <span>{c.name}</span>
              <span className="pg-cat-count">{c.count}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="pg-search">
        <Search size={17} className="pg-search-icon" />
        <input
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Rechercher un produit…"
          className="pg-search-input"
        />
        {query && (
          <button type="button" className="pg-search-clear" onClick={() => handleQueryChange('')} aria-label="Effacer">
            <X size={15} />
          </button>
        )}
      </div>

      {isSearching ? (
        <div className="pg-status"><Loader2 size={20} className="pg-spin" /></div>
      ) : data.items.length === 0 ? (
        <div className="pg-empty">
          {query || categoryId ? 'Aucun produit ne correspond à votre recherche.' : "Cette boutique n'a pas encore de produits publiés."}
        </div>
      ) : (
        <>
          <div className="pg-grid">
            {data.items.map((p: PublicProduct, i: number) => (
              <Link
                key={p.id}
                href={`/boutique/${slug}/produit/${p.id}`}
                className={'pg-card' + (isLeaving ? ' leaving' : '')}
                style={{ animationDelay: `${Math.min(i, 11) * 45}ms` }}
              >
                <span className="pg-card-notch" aria-hidden="true" />
                <span className="pg-card-hole" aria-hidden="true" />
                <div className="pg-card-image-wrap">
                  {p.has_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicApi.imageUrl(slug, p.id)} alt={p.name} className="pg-card-image" loading="lazy" />
                  ) : (
                    <div className="pg-card-image-placeholder" />
                  )}
                  {!p.is_available && <span className="pg-badge-unavailable">Rupture</span>}
                </div>
                <div className="pg-card-info">
                  {p.category_name && <span className="pg-card-cat">{p.category_name}</span>}
                  <span className="pg-card-name">{p.name}</span>
                  <span className="pg-card-price">
                    <b>{Number(p.price).toLocaleString('fr-GN')}</b>
                    <span>GNF</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="pg-pagination" aria-label="Pages du catalogue">
              <button
                type="button"
                className="pg-page-btn"
                disabled={data.page === 1 || isPaging}
                onClick={() => goToPage(data.page - 1)}
                aria-label="Page précédente"
              >
                <ChevronLeft size={15} /> Précédent
              </button>
              {getPageNumbers(data.page, totalPages).map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e${i}`} className="pg-page-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={'pg-page-btn pg-page-num' + (p === data.page ? ' active' : '')}
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
                className="pg-page-btn"
                disabled={data.page === totalPages || isPaging}
                onClick={() => goToPage(data.page + 1)}
                aria-label="Page suivante"
              >
                Suivant <ChevronRight size={15} />
              </button>
            </nav>
          )}
        </>
      )}

      <style jsx>{`
        .pg-wrap { display: flex; flex-direction: column; gap: 1.25rem; }

        .pg-cat-rail {
          display: flex; gap: 0.55rem; overflow-x: auto; padding-bottom: 0.2rem;
          scrollbar-width: none;
        }
        .pg-cat-rail::-webkit-scrollbar { display: none; }
        .pg-cat-pill {
          flex-shrink: 0;
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.5rem 0.95rem;
          border-radius: var(--radius-full);
          border: 1px solid var(--border-default);
          background: var(--surface-1);
          color: var(--text-secondary);
          font-family: var(--font-sans); font-size: 0.82rem; font-weight: 500;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
        }
        .pg-cat-pill:hover { transform: translateY(-1px); border-color: var(--border-strong); }
        .pg-cat-pill.active {
          background: linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to));
          border-color: transparent; color: #ffffff;
        }
        .pg-cat-count { font-size: 0.72rem; opacity: 0.75; }

        .pg-search {
          position: relative; display: flex; align-items: center;
          background: var(--surface-1);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md); padding: 0.7rem 0.9rem;
          transition: border-color 0.15s ease;
        }
        .pg-search:focus-within { border-color: var(--color-brand-400); }
        .pg-search-icon { color: var(--text-muted); flex-shrink: 0; }
        .pg-search-input {
          flex: 1; background: none; border: none; outline: none;
          color: var(--text-primary); font-family: var(--font-sans); font-size: 0.95rem; padding: 0 0.6rem;
        }
        .pg-search-input::placeholder { color: var(--text-muted); }
        .pg-search-clear {
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; padding: 0.2rem;
        }
        .pg-search-clear:hover { color: var(--text-primary); }

        .pg-status { display: flex; justify-content: center; padding: 3rem 0; color: var(--text-muted); }
        .pg-spin { animation: pg-spin 0.8s linear infinite; }
        @keyframes pg-spin { to { transform: rotate(360deg); } }
        .pg-empty { text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-family: var(--font-sans); }

        .pg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          gap: 1.1rem;
        }
        .pg-card {
          position: relative;
          display: flex; flex-direction: column;
          background: var(--surface-1);
          border: 1px solid var(--border-default);
          border-radius: 4px var(--radius-lg) var(--radius-lg) var(--radius-lg);
          overflow: hidden; text-decoration: none;
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          opacity: 0; animation: pg-card-in 0.45s cubic-bezier(.2,.8,.2,1) forwards;
        }
        @keyframes pg-card-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pg-card.leaving {
          animation: pg-card-out 0.18s ease forwards;
        }
        @keyframes pg-card-out {
          to { opacity: 0; transform: translateY(-8px) scale(0.96); }
        }
        .pg-card:hover {
          border-color: var(--border-strong);
          transform: translateY(-4px);
          box-shadow: var(--shadow-brand);
        }
        .pg-card-notch {
          position: absolute; top: 0; left: 0; width: 28px; height: 28px;
          background: var(--surface-0);
          clip-path: polygon(0 0, 100% 0, 0 100%);
          z-index: 2;
        }
        .pg-card-hole {
          position: absolute; top: 7px; left: 7px; width: 6px; height: 6px;
          border-radius: 50%; background: var(--surface-1); z-index: 3;
          box-shadow: inset 0 0 0 1px var(--border-strong);
        }
        .pg-card-image-wrap {
          position: relative; width: 100%; aspect-ratio: 1; background: var(--surface-2); overflow: hidden;
          animation: pg-media-float 3.2s ease-in-out infinite;
        }
        /* Décalage/durée variés par carte pour un mouvement organique
           plutôt que toutes les vignettes flottant en parfaite unisson. */
        .pg-card:nth-child(2n) .pg-card-image-wrap { animation-duration: 3.7s; animation-delay: 0.35s; }
        .pg-card:nth-child(3n) .pg-card-image-wrap { animation-duration: 2.8s; animation-delay: 0.7s; }
        .pg-card:nth-child(5n) .pg-card-image-wrap { animation-duration: 4.1s; animation-delay: 0.15s; }
        @keyframes pg-media-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .pg-card-image { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
        .pg-card:hover .pg-card-image { transform: scale(1.06); }
        .pg-card-image-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, var(--surface-2), var(--surface-3)); }
        .pg-badge-unavailable {
          position: absolute; top: 0.5rem; right: 0.5rem;
          background: var(--color-error); color: white;
          font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm);
        }
        .pg-card-info { padding: 0.75rem 0.85rem 0.9rem; display: flex; flex-direction: column; gap: 0.25rem; }
        .pg-card-cat {
          font-family: var(--font-sans); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--color-brand-600);
        }
        .pg-card-name {
          font-family: var(--font-sans); font-size: 0.9rem; font-weight: 600; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pg-card-price {
          display: flex; align-items: baseline; gap: 0.3rem; margin-top: 0.15rem;
          font-variant-numeric: tabular-nums;
        }
        .pg-card-price b {
          font-size: 0.92rem; font-weight: 800;
          background: linear-gradient(90deg, var(--color-brand-700), var(--color-warning));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .pg-card-price span { font-size: 0.68rem; color: var(--text-muted); }

        .pg-pagination {
          display: flex; align-items: center; justify-content: center; gap: 0.4rem;
          margin-top: 0.5rem; flex-wrap: wrap;
        }
        .pg-page-btn {
          display: flex; align-items: center; gap: 0.3rem;
          min-width: 38px; height: 38px; padding: 0 0.7rem;
          border-radius: var(--radius-md); border: 1px solid var(--border-default);
          background: var(--surface-1); color: var(--text-secondary);
          font-family: var(--font-sans); font-size: 0.84rem; font-weight: 600;
          cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .pg-page-btn:hover:not(:disabled):not(.active) { border-color: var(--border-strong); transform: translateY(-1px); }
        .pg-page-num.active {
          background: linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to));
          border-color: transparent; color: #ffffff;
        }
        .pg-page-btn:disabled { opacity: 0.45; cursor: default; }
        .pg-page-ellipsis { color: var(--text-muted); padding: 0 0.2rem; font-size: 0.84rem; }

        @media (prefers-reduced-motion: reduce) {
          .pg-card { animation: none; opacity: 1; transform: none; }
          .pg-card.leaving { animation: none; }
          .pg-card-image-wrap { animation: none; }
        }
      `}</style>
    </div>
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
