'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, X, Loader2, Grid3x3 } from 'lucide-react';
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const nextPage = data.page + 1;
      const res = await publicApi.listProducts(slug, nextPage, perPage, query, categoryId || undefined);
      setData(prev => ({ ...res, items: [...prev.items, ...res.items] }));
    } catch {
      // Silencieux : le bouton reste disponible pour réessayer.
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasMore = data.items.length < data.total;
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
                className="pg-card"
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

          {hasMore && (
            <div className="pg-load-more-wrap">
              <button type="button" className="pg-load-more" onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 size={16} className="pg-spin" /> : `Voir plus (${data.total - data.items.length} restants)`}
              </button>
            </div>
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
          opacity: 0; animation: pg-card-in 0.45s ease forwards;
        }
        @keyframes pg-card-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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
        .pg-card-image-wrap { position: relative; width: 100%; aspect-ratio: 1; background: var(--surface-2); overflow: hidden; }
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

        .pg-load-more-wrap { display: flex; justify-content: center; margin-top: 0.5rem; }
        .pg-load-more {
          background: var(--surface-1); border: 1px solid var(--border-default); color: var(--color-brand-700);
          padding: 0.65rem 1.4rem; border-radius: var(--radius-md); font-family: var(--font-sans);
          font-size: 0.85rem; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; gap: 0.5rem;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .pg-load-more:hover:not(:disabled) { background: var(--surface-2); border-color: var(--border-strong); }
        .pg-load-more:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </div>
  );
}
