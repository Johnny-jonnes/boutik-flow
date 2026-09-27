'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, FolderTree, Search, Edit2, Trash2, Package, Layers, Tag, ArrowRight, FolderSearch, Crown } from 'lucide-react';
import type { Category } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { usePermission } from '@/lib/permissions';
import { useProductsQuery } from '@/lib/queries';
import { PageHeader, StatTile } from '@/components/ui/PageHeader';
import { formatNumber, hueFromString } from '@/lib/format';
import { celebrate } from '@/lib/celebrate';

export default function CategoriesPage() {
  const { t, language } = useLanguage();
  const fr = language === 'fr';
  const canWrite = usePermission('categories', 'write');
  const canDelete = usePermission('categories', 'delete');
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  // Cache produits partagé (Accueil, Vendre, Produits…) — sert uniquement à
  // compter les produits et unités de chaque catégorie.
  const { data: productsData } = useProductsQuery();

  // Modal Ajouter
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', image_url: '' });

  // Modal Modifier
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', image_url: '' });
  const [isEditing, setIsEditing] = useState(false);

  // Modal Supprimer
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = async () => {
    try {
      const response = await api.getCategories(1, 100);
      setCategories(response.items);
    } catch {
      toast.error('Erreur lors de la récupération des catégories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Après une synchronisation réussie (catégorie créée hors-ligne, etc.),
  // la liste doit refléter les vrais identifiants serveur.
  useEffect(() => {
    const onSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as { succeeded: number } | undefined;
      if (detail?.succeeded) fetchCategories();
    };
    window.addEventListener('boutikflow:sync-complete', onSyncComplete);
    return () => window.removeEventListener('boutikflow:sync-complete', onSyncComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createCategory({
        name: addForm.name,
        description: addForm.description || undefined,
        image_url: addForm.image_url || undefined,
      });
      celebrate({
        kind: 'category',
        title: fr ? 'Catégorie créée' : 'Category created',
        subtitle: addForm.name,
        chips: [fr ? 'Nouveau rayon' : 'New aisle'],
      });
      setIsAddOpen(false);
      setAddForm({ name: '', description: '', image_url: '' });
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Erreur lors de l'ajout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (category: Category) => {
    setEditCategory(category);
    setEditForm({
      name: category.name,
      description: category.description || '',
      image_url: category.image_url || '',
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;
    setIsEditing(true);
    try {
      await api.updateCategory(editCategory.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        image_url: editForm.image_url || undefined,
      });
      toast.success('Catégorie modifiée avec succès');
      setEditCategory(null);
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Erreur lors de la modification');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteCategory(deleteTarget.id);
      celebrate({
        kind: 'deleted',
        title: fr ? 'Catégorie supprimée' : 'Category deleted',
        subtitle: deleteTarget.name,
        chips: [fr ? 'Produits conservés' : 'Products kept'],
      });
      setDeleteTarget(null);
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Produits et unités par catégorie (+ produits non classés).
  const { perCategory, totalProducts, uncategorized } = useMemo(() => {
    const map = new Map<string, { products: number; units: number }>();
    let none = 0;
    const items = productsData?.items ?? [];
    for (const p of items) {
      if (!p.category_id) { none++; continue; }
      const cur = map.get(p.category_id) ?? { products: 0, units: 0 };
      cur.products += 1;
      cur.units += Math.max(0, p.stock || 0);
      map.set(p.category_id, cur);
    }
    return { perCategory: map, totalProducts: items.length, uncategorized: none };
  }, [productsData]);

  const biggest = categories.reduce<{ name: string; count: number } | null>((best, c) => {
    const count = perCategory.get(c.id)?.products ?? 0;
    return count > (best?.count ?? 0) ? { name: c.name, count } : best;
  }, null);

  const renderForm = (
    form: typeof addForm,
    setForm: (f: typeof addForm) => void,
    onSubmit: (e: React.FormEvent) => void,
    loading: boolean,
    submitLabel: string,
    onCancel: () => void
  ) => (
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-group">
        <label className="form-label">{t('cat.name_label')}</label>
        <input type="text" className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">{t('cat.desc_label')}</label>
        <textarea className="input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">URL de l&apos;image (optionnel)</label>
        <input type="url" className="input" placeholder="https://..." value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Chargement...' : submitLabel}</button>
      </div>
    </form>
  );

  return (
    <div className="bf-page fade-in">
      <PageHeader
        icon={FolderTree}
        title={t('cat.title')}
        subtitle={t('cat.subtitle')}
        actions={canWrite && (
          <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            <Plus size={17} /> {t('cat.new')}
          </button>
        )}
      />

      <section className="bf-stats">
        <StatTile tone="teal" icon={FolderTree} label={fr ? 'Catégories' : 'Categories'} value={formatNumber(categories.length)}
          hint={fr ? 'Rayons de votre boutique' : 'Aisles of your shop'} />
        <StatTile tone="sky" icon={Package} label={fr ? 'Produits classés' : 'Classified products'} value={formatNumber(totalProducts - uncategorized)}
          hint={<><strong>{totalProducts ? Math.round(((totalProducts - uncategorized) / totalProducts) * 100) : 0} %</strong> {fr ? 'du catalogue' : 'of the catalog'}</>} />
        <StatTile tone="amber" icon={Tag} label={fr ? 'Sans catégorie' : 'Uncategorized'} value={formatNumber(uncategorized)}
          hint={fr ? 'À ranger dans un rayon' : 'To be assigned'} />
        <StatTile tone="violet" icon={Crown} label={fr ? 'Plus grand rayon' : 'Largest category'} value={biggest?.name ?? '—'}
          hint={biggest ? <><strong>{formatNumber(biggest.count)}</strong> {fr ? 'produits' : 'products'}</> : undefined} />
      </section>

      <section className="bf-toolbar">
        <div className="bf-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('cat.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {isLoading ? (
        <div className="bf-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="bf-skeleton" style={{ height: 190, borderRadius: 20 }} />)}
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bf-panel">
          <div className="bf-empty">
            <span className="bf-empty__icon"><FolderSearch size={24} /></span>
            <strong>{t('cat.no_category')}</strong>
            {categories.length === 0 && canWrite && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsAddOpen(true)}><Plus size={15} /> {t('cat.new')}</button>
            )}
          </div>
        </div>
      ) : (
        <div className="bf-grid">
          {filteredCategories.map((category) => {
            const stats = perCategory.get(category.id) ?? { products: 0, units: 0 };
            const share = totalProducts ? (stats.products / totalProducts) * 100 : 0;
            return (
              <article key={category.id} className="bf-tile cat-tile" style={{ '--hue': hueFromString(category.name) } as React.CSSProperties}>
                <div className="cat-top">
                  <span className="bf-avatar cat-icon"><FolderTree size={20} /></span>
                  <div className="cat-text">
                    <h3 className="cat-name">{category.name}</h3>
                    <p className="cat-desc">{category.description || (fr ? 'Aucune description' : 'No description')}</p>
                  </div>
                </div>

                <div className="cat-figures">
                  <div>
                    <strong>{formatNumber(stats.products)}</strong>
                    <span><Package size={12} /> {fr ? 'produits' : 'products'}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(stats.units)}</strong>
                    <span><Layers size={12} /> {fr ? 'unités en stock' : 'units in stock'}</span>
                  </div>
                </div>

                <div className="bf-meter" data-tone="teal">
                  <div className="bf-meter__track"><div className="bf-meter__bar cat-bar" style={{ width: `${Math.max(share, stats.products ? 3 : 0)}%` }} /></div>
                  <span className="bf-sub">{Math.round(share)} % {fr ? 'du catalogue' : 'of the catalog'}</span>
                </div>

                <div className="cat-foot">
                  <Link href={`/products?category_id=${category.id}`} className="cat-link">
                    {fr ? 'Voir les produits' : 'View products'} <ArrowRight size={15} />
                  </Link>
                  {canWrite && (
                    <button type="button" className="bf-icon-btn bf-icon-btn--lg" onClick={() => openEdit(category)} aria-label={fr ? 'Modifier' : 'Edit'} title={fr ? 'Modifier' : 'Edit'}>
                      <Edit2 size={16} />
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" className="bf-icon-btn bf-icon-btn--lg bf-icon-btn--danger" onClick={() => setDeleteTarget(category)} aria-label={fr ? 'Supprimer' : 'Delete'} title={fr ? 'Supprimer' : 'Delete'}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={t('cat.new_category')}>
        {renderForm(addForm, setAddForm, handleAdd, isSubmitting, t('common.add'), () => setIsAddOpen(false))}
      </Modal>

      <Modal isOpen={!!editCategory} onClose={() => setEditCategory(null)} title={t('cat.edit')}>
        {renderForm(editForm, setEditForm, handleEdit, isEditing, t('common.save'), () => setEditCategory(null))}
      </Modal>

      {/* Confirmation de suppression animée */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        fr={fr}
        title={fr ? 'Supprimer cette catégorie ?' : 'Delete this category?'}
        name={deleteTarget?.name}
        icon={<FolderTree size={17} />}
        message={fr ? "Les produits associés ne seront pas supprimés mais perdront cette catégorie." : "Linked products will not be deleted, they will simply lose this category."}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <style jsx>{`
        .cat-top { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.85rem; align-items: center; }
        .cat-foot { display: flex; gap: 0.5rem; margin-top: auto; }
        .cat-icon { width: 46px; height: 46px; border-radius: 14px; }
        .cat-text { min-width: 0; }
        .cat-name {
          font-family: var(--font-display);
          font-size: 1.08rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cat-desc {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: 0.15rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cat-figures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem; }
        .cat-figures > div {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          padding: 0.65rem 0.8rem;
          border-radius: 13px;
          background: var(--surface-2);
          border: 1px solid var(--border-subtle);
          min-width: 0;
        }
        .cat-figures strong { font-family: var(--font-display); font-size: 1.25rem; font-weight: 800; color: var(--text-primary); line-height: 1.1; }
        .cat-figures span { font-size: 0.72rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.3rem; }
        .cat-bar { background: linear-gradient(90deg, hsl(var(--hue) 55% 42%), hsl(var(--hue) 60% 55%)); }
        .cat-tile :global(.cat-link) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          flex: 1;
          height: 44px;
          border-radius: 12px;
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--color-brand-500);
          background: var(--brand-alpha-10);
          border: 1px solid var(--brand-alpha-20);
          text-decoration: none;
          transition: background 0.15s ease;
        }
        .cat-tile :global(.cat-link:hover) { background: var(--brand-alpha-20); }
        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
      `}</style>
    </div>
  );
}
