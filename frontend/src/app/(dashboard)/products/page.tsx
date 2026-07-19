'use client';

import { useEffect, useState } from 'react';
import { Search, ImageIcon, Pencil, Trash2, Eye, Plus } from 'lucide-react';
import type { Product } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import type { Category } from '@/types';

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', price: '', stock: '', category_id: '', description: '', is_available: true,
  });

  // View modal
  const [viewProduct, setViewProduct] = useState<Product | null>(null);

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', price: '', stock: '', category_id: '', description: '', is_available: true,
  });
  const [isEditing, setIsEditing] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProductsAndCategories = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.getProducts(1, 100),
        api.getCategories(1, 100)
      ]);
      setProducts(prodRes.items);
      setCategories(catRes.items);
    } catch (error) {
      toast.error('Erreur lors de la récupération des données');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProductsAndCategories(); }, []);

  // Add
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createProduct({
        name: addForm.name,
        price: Number(addForm.price),
        stock: addForm.stock ? Number(addForm.stock) : 0,
        category_id: addForm.category_id || undefined,
        description: addForm.description || undefined,
        is_available: addForm.is_available,
      });
      toast.success('Produit ajouté avec succès');
      setIsAddOpen(false);
      setAddForm({ name: '', price: '', stock: '', category_id: '', description: '', is_available: true });
      fetchProductsAndCategories();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit
  const openEdit = (product: Product) => {
    setEditProduct(product);
    setEditForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
      category_id: product.category_id || '',
      description: product.description || '',
      is_available: product.is_available,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setIsEditing(true);
    try {
      await api.updateProduct(editProduct.id, {
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
        category_id: editForm.category_id || undefined,
        description: editForm.description || undefined,
        is_available: editForm.is_available,
      });
      toast.success('Produit modifié avec succès');
      setEditProduct(null);
      fetchProductsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la modification');
    } finally {
      setIsEditing(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteProduct(deleteTarget.id);
      toast.success('Produit supprimé');
      setDeleteTarget(null);
      fetchProductsAndCategories();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderProductForm = (
    form: typeof addForm,
    setForm: (f: typeof addForm) => void,
    onSubmit: (e: React.FormEvent) => void,
    loading: boolean,
    submitLabel: string,
    onCancel: () => void,
  ) => (
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-group">
        <label className="form-label">Nom du produit *</label>
        <input type="text" className="input" required value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Prix (GNF) *</label>
          <input type="number" className="input" required min="0" value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Stock *</label>
          <input type="number" className="input" required min="0" value={form.stock}
            onChange={e => setForm({ ...form, stock: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Catégorie</label>
        <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
          <option value="">Sélectionner une catégorie</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea className="input" rows={3} value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={form.is_available}
          onChange={e => setForm({ ...form, is_available: e.target.checked })} />
        Produit disponible à la vente
      </label>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Chargement...' : submitLabel}</button>
      </div>
    </form>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catalogue Produits</h1>
          <p className="page-subtitle">Gérez votre inventaire et vos prix.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" id="btn-add-product" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> Ajouter produit
          </button>
        </div>
      </div>

      <div className="filters card">
        <div className="search-box">
          <span className="search-icon"><Search size={18} /></span>
          <input type="text" className="input search-input" placeholder="Rechercher un produit..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Catégorie</th>
              <th>Prix</th>
              <th>Stock</th>
              <th>Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id} className={!product.is_available ? 'row-disabled' : ''}>
                <td>
                  <div className="product-cell">
                    <div className="product-img-placeholder"><ImageIcon size={20} /></div>
                    <span className="product-name">{product.name}</span>
                  </div>
                </td>
                <td><span className="tag-pill">{product.category_rel?.name || 'Non classé'}</span></td>
                <td><span className="product-price">{formatGNF(product.price)}</span></td>
                <td>
                  <span className={`stock-badge ${product.stock > 10 ? 'stock-high' : product.stock > 0 ? 'stock-low' : 'stock-out'}`}>
                    {product.stock} en stock
                  </span>
                </td>
                <td>
                  {product.is_available
                    ? <span className="badge badge-success">Disponible</span>
                    : <span className="badge badge-error">Indisponible</span>}
                </td>
                <td className="text-right">
                  <div className="actions-flex">
                    <button className="btn btn-ghost btn-icon" title="Voir" onClick={() => setViewProduct(product)}>
                      <Eye size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon" title="Modifier" onClick={() => openEdit(product)}>
                      <Pencil size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-danger-icon" title="Supprimer" onClick={() => setDeleteTarget(product)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-8"><div className="spinner"></div></td></tr>
            )}
            {!isLoading && filteredProducts.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted">Aucun produit trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Ajouter */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouveau produit">
        {renderProductForm(addForm, setAddForm, handleAdd, isSubmitting, 'Ajouter', () => setIsAddOpen(false))}
      </Modal>

      {/* Modal Voir */}
      <Modal isOpen={!!viewProduct} onClose={() => setViewProduct(null)} title="Détails du produit">
        {viewProduct && (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">Nom</span><span className="detail-value">{viewProduct.name}</span></div>
            <div className="detail-row"><span className="detail-label">Prix</span><span className="detail-value product-price">{formatGNF(viewProduct.price)}</span></div>
            <div className="detail-row"><span className="detail-label">Stock</span><span className="detail-value">{viewProduct.stock}</span></div>
            <div className="detail-row"><span className="detail-label">Catégorie</span><span className="detail-value">{viewProduct.category_rel?.name || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Description</span><span className="detail-value">{viewProduct.description || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Disponible</span><span className="detail-value">{viewProduct.is_available ? 'Oui' : 'Non'}</span></div>
            <div className="detail-row"><span className="detail-label">Créé le</span><span className="detail-value">{new Date(viewProduct.created_at).toLocaleDateString('fr-FR')}</span></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setViewProduct(null)}>Fermer</button>
              <button className="btn btn-primary" onClick={() => { setViewProduct(null); openEdit(viewProduct); }}>
                <Pencil size={14} /> Modifier
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Modifier */}
      <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title="Modifier le produit">
        {renderProductForm(editForm, setEditForm, handleEdit, isEditing, 'Enregistrer', () => setEditProduct(null))}
      </Modal>

      {/* Modal Supprimer */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer la suppression">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Êtes-vous sûr de vouloir supprimer <strong>{deleteTarget?.name}</strong> ? Cette action est irréversible.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Annuler</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </button>
        </div>
      </Modal>

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.75rem; margin-bottom: 0.25rem; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; }

        .filters { padding: 1rem; }
        .search-box { position: relative; max-width: 400px; }
        .search-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .search-input { padding-left: 2.5rem; }

        .table-container { padding: 0; overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table th, .data-table td { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-subtle); }
        .data-table th { font-weight: 600; color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .data-table tr:hover td { background: var(--surface-hover); }
        .data-table tr:last-child td { border-bottom: none; }
        .row-disabled td { opacity: 0.6; }

        .product-cell { display: flex; align-items: center; gap: 0.75rem; }
        .product-img-placeholder { width: 40px; height: 40px; border-radius: 8px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-default); color: var(--text-muted); }
        .product-name { font-weight: 600; }
        .product-price { font-weight: 600; color: var(--color-brand-400); font-family: var(--font-display); }
        .tag-pill { background: var(--surface-3); color: var(--text-secondary); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border-default); }

        .stock-badge { font-size: 0.8rem; font-weight: 600; padding: 0.2rem 0.5rem; border-radius: 4px; }
        .stock-high { color: var(--color-brand-500); background: var(--brand-alpha-10); }
        .stock-low { color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
        .stock-out { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

        .actions-flex { display: flex; gap: 0.25rem; justify-content: flex-end; }
        .btn-icon { padding: 0.4rem; border-radius: 6px; }
        .btn-danger-icon:hover { color: var(--color-error); background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); font-size: 0.85rem; }
        .py-8 { padding: 2rem 0; }

        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .form-row { display: flex; gap: 1rem; }
        .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }

        .detail-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); }
        .detail-row:last-of-type { border-bottom: none; }
        .detail-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .detail-value { font-size: 0.9rem; color: var(--text-primary); font-weight: 500; }
      `}</style>
    </div>
  );
}
