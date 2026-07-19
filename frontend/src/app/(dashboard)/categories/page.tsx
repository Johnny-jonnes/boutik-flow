'use client';

import { useEffect, useState } from 'react';
import { Plus, FolderTree, Search, Edit2, Trash2, Package } from 'lucide-react';
import type { Category } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
    } catch (error) {
      toast.error('Erreur lors de la récupération des catégories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
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
      toast.success('Catégorie ajoutée avec succès');
      setIsAddOpen(false);
      setAddForm({ name: '', description: '', image_url: '' });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
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
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la modification');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteCategory(deleteTarget.id);
      toast.success('Catégorie supprimée');
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <label className="form-label">Nom *</label>
        <input type="text" className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">URL de l'image (optionnel)</label>
        <input type="url" className="input" placeholder="https://..." value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Chargement...' : submitLabel}</button>
      </div>
    </form>
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-header__title">Catégories de Produits</h1>
          <p className="page-header__desc">Organisez votre catalogue pour la clientèle locale et internationale.</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsAddOpen(true)}>
            <Plus size={18} />
            <span>Nouvelle catégorie</span>
          </button>
        </div>
      </div>

      <div className="filters card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="search-box" style={{ position: 'relative', maxWidth: '400px' }}>
          <span className="search-icon" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Search size={18} /></span>
          <input 
            type="text" 
            className="input search-input" 
            placeholder="Rechercher une catégorie..." 
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner"></div></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filteredCategories.map((category) => (
            <div key={category.id} style={{
              background: 'var(--surface-0)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
            }}
            className="hover-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#10b981', flexShrink: 0 }}>
                    <FolderTree size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{category.name}</h3>
                    {category.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{category.description}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => openEdit(category)}>
                    <Edit2 size={14} />
                  </button>
                  <button className="btn btn-ghost btn-icon btn-danger-icon" onClick={() => setDeleteTarget(category)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', marginTop: 'auto' }}>
                <Link href={`/products?category_id=${category.id}`} style={{ fontSize: '0.8rem', color: 'var(--color-brand-500)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
                  Voir les produits →
                </Link>
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Aucune catégorie trouvée.
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouvelle catégorie">
        {renderForm(addForm, setAddForm, handleAdd, isSubmitting, 'Ajouter', () => setIsAddOpen(false))}
      </Modal>

      <Modal isOpen={!!editCategory} onClose={() => setEditCategory(null)} title="Modifier la catégorie">
        {renderForm(editForm, setEditForm, handleEdit, isEditing, 'Enregistrer', () => setEditCategory(null))}
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer la suppression">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Êtes-vous sûr de vouloir supprimer la catégorie <strong>{deleteTarget?.name}</strong> ? Les produits associés ne seront pas supprimés mais perdront cette catégorie.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Annuler</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </Modal>
      
      <style jsx>{`
        .hover-card:hover {
          transform: translateY(-4px);
          border-color: rgba(16, 185, 129, 0.3) !important;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.05) !important;
        }
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }
        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
      `}</style>
    </div>
  );
}
