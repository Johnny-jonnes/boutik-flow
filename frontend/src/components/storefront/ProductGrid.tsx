'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, Loader2 } from 'lucide-react';
import { publicApi, PublicProduct, PublicProductList } from '@/lib/api/publicClient';

// Grille produits + recherche vitrine — composant client isolé : la page
// boutique elle-même reste un Server Component (SEO), seule cette section
// a besoin d'interactivité (recherche live, "voir plus"). L'affichage
// initial (SSR) est réutilisé tel quel tant que le visiteur n'a rien tapé,
// aucun aller-retour réseau supplémentaire au premier rendu.
export function ProductGrid({
  slug,
  initialData,
  perPage,
  accent,
}: {
  slug: string;
  initialData: PublicProductList;
  perPage: number;
  accent: string;
}) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState(initialData);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Géré directement dans le handler de saisie plutôt que dans un effet :
  // un effet dont le corps appelle setState de façon synchrone (hors
  // callback réseau/minuteur) déclenche des rendus en cascade évitables
  // (règle react-hooks/set-state-in-effect) — ici la saisie elle-même EST
  // l'événement déclencheur, pas un état externe à synchroniser.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Recherche vide : on revient à la liste initiale (déjà rendue côté
    // serveur), pas de requête réseau inutile.
    if (!value.trim()) {
      setIsSearching(false);
      setData(initialData);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      publicApi.listProducts(slug, 1, perPage, value)
        .then(res => setData(res))
        .catch(() => {
          // Silencieux : au pire la grille garde son dernier résultat connu.
        })
        .finally(() => setIsSearching(false));
    }, 350);
  };

  // Nettoyage du minuteur en attente au démontage uniquement — aucun
  // setState ici, juste la libération d'une ressource externe (le timer).
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const nextPage = data.page + 1;
      const res = await publicApi.listProducts(slug, nextPage, perPage, query);
      setData(prev => ({ ...res, items: [...prev.items, ...res.items] }));
    } catch {
      // Silencieux : le bouton reste disponible pour réessayer.
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasMore = data.items.length < data.total;

  return (
    <div className="pg-wrap">
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
          {query ? `Aucun produit ne correspond à "${query}".` : "Cette boutique n'a pas encore de produits publiés."}
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
                  <span className="pg-card-name">{p.name}</span>
                  <span className="pg-card-price" style={{ color: accent }}>
                    {Number(p.price).toLocaleString('fr-GN')} GNF
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="pg-load-more-wrap">
              <button type="button" className="pg-load-more" onClick={handleLoadMore} disabled={isLoadingMore} style={{ borderColor: accent, color: accent }}>
                {isLoadingMore ? <Loader2 size={16} className="pg-spin" /> : `Voir plus (${data.total - data.items.length} restants)`}
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .pg-wrap { display: flex; flex-direction: column; gap: 1.25rem; }
        .pg-search {
          position: relative; display: flex; align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px; padding: 0.7rem 0.9rem;
          transition: border-color 0.15s ease;
        }
        .pg-search:focus-within { border-color: rgba(255, 255, 255, 0.3); }
        .pg-search-icon { color: #6b7280; flex-shrink: 0; }
        .pg-search-input {
          flex: 1; background: none; border: none; outline: none;
          color: #f3f4f6; font-size: 0.95rem; padding: 0 0.6rem;
        }
        .pg-search-input::placeholder { color: #6b7280; }
        .pg-search-clear {
          background: none; border: none; color: #6b7280; cursor: pointer;
          display: flex; align-items: center; padding: 0.2rem;
        }
        .pg-search-clear:hover { color: #e5e7eb; }
        .pg-status { display: flex; justify-content: center; padding: 3rem 0; color: #6b7280; }
        .pg-spin { animation: pg-spin 0.8s linear infinite; }
        @keyframes pg-spin { to { transform: rotate(360deg); } }
        .pg-empty { text-align: center; padding: 3rem 1rem; color: #9ca3af; }
        .pg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 1rem;
        }
        .pg-card {
          display: flex; flex-direction: column;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px; overflow: hidden; text-decoration: none;
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          opacity: 0; animation: pg-card-in 0.45s ease forwards;
        }
        @keyframes pg-card-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pg-card:hover {
          border-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-3px);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
        }
        .pg-card-image-wrap { position: relative; width: 100%; aspect-ratio: 1; background: #1f2937; overflow: hidden; }
        .pg-card-image { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
        .pg-card:hover .pg-card-image { transform: scale(1.06); }
        .pg-card-image-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #1f2937, #111827); }
        .pg-badge-unavailable {
          position: absolute; top: 0.5rem; right: 0.5rem;
          background: rgba(244, 63, 94, 0.9); color: white;
          font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 6px;
        }
        .pg-card-info { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
        .pg-card-name {
          font-size: 0.9rem; font-weight: 600; color: #f3f4f6;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pg-card-price { font-size: 0.85rem; font-weight: 700; }
        .pg-load-more-wrap { display: flex; justify-content: center; margin-top: 0.5rem; }
        .pg-load-more {
          background: rgba(255, 255, 255, 0.04); border: 1px solid;
          padding: 0.65rem 1.4rem; border-radius: 10px; font-size: 0.85rem;
          font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;
          transition: background 0.15s ease;
        }
        .pg-load-more:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
        .pg-load-more:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </div>
  );
}
