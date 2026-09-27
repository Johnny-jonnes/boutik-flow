'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, ImageIcon, Pencil, Trash2, Eye, Plus, Download, Printer, Camera, Layers, Wallet, Package, PackagePlus, Share2, MessageCircle, Globe, Link as LinkIcon, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, X, PackageSearch } from 'lucide-react';
import type { Product } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { SKUPrintModal } from '@/components/ui/SKUPrintModal';
import { QRCodeModal } from '@/components/ui/QRCodeModal';
import { BulkAddProductsModal } from '@/components/ui/BulkAddProductsModal';
import { BulkStockInModal } from '@/components/ui/BulkStockInModal';
import { useLanguage } from '@/context/LanguageContext';
import { compressImage } from '@/lib/utils/imageCompressor';
import { useSearchParams, useRouter } from 'next/navigation';
import { useProductsQuery, useCategoriesQuery, useProductStatsQuery, useTenantQuery, queryKeys } from '@/lib/queries';
import { usePermission } from '@/lib/permissions';
import { PageHeader, StatTile } from '@/components/ui/PageHeader';
import { formatGNF, formatNumber, LOW_STOCK_THRESHOLD } from '@/lib/format';
import { celebrate } from '@/lib/celebrate';

type StockFilter = 'all' | 'in' | 'low' | 'out';



function ProductsContent() {
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const categoryIdFromUrl = searchParams.get('category_id');
  const router = useRouter();
  const queryClient = useQueryClient();
  const canWrite = usePermission('products', 'write');
  const canDelete = usePermission('products', 'delete');
  const canWriteStock = usePermission('stock', 'write');
  // Couche mémoire globale : ces deux requêtes partagent leur clé de cache
  // avec le Dashboard, Vendre et Clients — la première de ces pages
  // visitée charge les données, les suivantes les trouvent déjà en
  // mémoire (isLoading ne redevient jamais true après le premier chargement,
  // seule une revalidation silencieuse a lieu en arrière-plan).
  const { data: productsData, isLoading } = useProductsQuery();
  const { data: categoriesData } = useCategoriesQuery();
  const { data: statsData } = useProductStatsQuery();
  const { data: tenantData } = useTenantQuery();
  const products = productsData?.items ?? [];
  const categories = categoriesData?.items ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeScanField, setActiveScanField] = useState<'search' | 'add' | 'edit'>('search');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Add modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isBulkStockInOpen, setIsBulkStockInOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '', price: '', cost_price: '', stock: '', category_id: '', description: '', is_available: true, is_public: true, sku: '', barcode: '',
  });

  // View modal
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [skuPrintProduct, setSkuPrintProduct] = useState<Product | null>(null);

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', price: '', cost_price: '', stock: '', category_id: '', description: '', is_available: true, is_public: false, sku: '', barcode: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [addImagePreview, setAddImagePreview] = useState<string | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  // true seulement si l'utilisateur a réellement importé une nouvelle photo
  // pendant cette édition (voir handleImageUpload) — distingue "aucun
  // changement d'image" de "nouvelle image", pour ne jamais renvoyer au
  // serveur l'aperçu (potentiellement une simple miniature basse résolution
  // de repli, voir openEdit) comme si c'était une vraie nouvelle photo.
  const [editImageChanged, setEditImageChanged] = useState(false);

  // Ré-appelle les deux requêtes (produits + catégories) en arrière-plan —
  // utilisé après une opération groupée (import en masse, entrée de stock
  // groupée) où patcher le cache produit par produit serait plus fragile
  // qu'une revalidation silencieuse de la liste entière.
  const fetchProductsAndCategories = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products() });
    queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
    queryClient.invalidateQueries({ queryKey: ['product-stats'] });
  };

  // Après une synchronisation réussie, le stock local (décrémenté de façon
  // optimiste par des ventes hors-ligne) doit refléter le vrai stock
  // serveur — la revalidation est déjà déclenchée globalement par
  // QueryProvider (voir boutikflow:sync-complete), rien à faire ici.

  const generateClientSku = (name: string): string => {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    const prefix = cleanName || 'PROD';
    const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `SKU-${prefix}-${rand}`;
  };

  // Add
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const finalSku = addForm.sku.trim() || generateClientSku(addForm.name);
      const created = await api.createProduct({
        name: addForm.name,
        price: Number(addForm.price),
        cost_price: addForm.cost_price.trim() ? Number(addForm.cost_price) : undefined,
        stock: addForm.stock ? Number(addForm.stock) : 0,
        category_id: addForm.category_id || undefined,
        description: addForm.description || undefined,
        is_available: addForm.is_available,
        is_public: addForm.is_public,
        sku: finalSku,
        barcode: addForm.barcode || undefined,
        images: addImagePreview ? [addImagePreview] : [],
      });
      celebrate({
        kind: 'product',
        title: language === 'fr' ? 'Produit ajouté' : 'Product added',
        subtitle: created.name,
        chips: [formatGNF(Number(created.price)), `${formatNumber(created.stock)} ${language === 'fr' ? 'en stock' : 'in stock'}`],
      });
      setIsAddOpen(false);
      setAddForm({ name: '', price: '', cost_price: '', stock: '', category_id: '', description: '', is_available: true, is_public: true, sku: '', barcode: '' });
      setAddImagePreview(null);
      // Mise à jour locale immédiate du cache partagé — pas de rechargement
      // complet, le nouveau produit apparaît instantanément dans la liste
      // (ici et sur Dashboard/Vendre) sans re-frapper le serveur.
      queryClient.setQueryData(queryKeys.products(), (old: typeof productsData) =>
        old ? { ...old, items: [created, ...old.items], total: old.total + 1 } : old
      );
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit — la liste (et donc `product` ici) ne contient jamais l'image en
  // pleine résolution (voir GET /products, qui ne renvoie que `thumbnail`
  // pour rester léger) : on tente de recharger le produit complet pour
  // avoir la vraie photo dans l'aperçu. Un échec (connexion instable) ne
  // doit JAMAIS empêcher de modifier les autres champs — retombe alors
  // sur les données déjà en liste (miniature à la place de l'image en
  // aperçu). editImageChanged (jamais mis à true ici) garantit que
  // handleEdit n'enverra cette miniature de repli comme nouvelle photo
  // que si l'utilisateur en importe réellement une.
  const openEdit = async (product: Product) => {
    let full: Product = product;
    try {
      const fetched = await api.getProduct(product.id);
      if (fetched && fetched.id === product.id) full = fetched;
    } catch {
      // Silencieux : les champs texte restent modifiables même sans image fraîche.
    }
    setEditProduct(full);
    setEditForm({
      name: full.name,
      price: String(full.price),
      cost_price: full.cost_price != null ? String(full.cost_price) : '',
      stock: String(full.stock),
      category_id: full.category_id || '',
      description: full.description || '',
      is_available: full.is_available,
      is_public: full.is_public,
      sku: full.sku || '',
      barcode: full.barcode || '',
    });
    setEditImagePreview(full.images?.[0] || full.thumbnail || null);
    setEditImageChanged(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct?.id) { toast.error('Produit invalide, réessayez'); return; }
    setIsEditing(true);
    try {
      const finalSku = editForm.sku.trim() || generateClientSku(editForm.name);
      const updated = await api.updateProduct(editProduct.id, {
        name: editForm.name,
        price: Number(editForm.price),
        // null explicite (pas undefined) : permet de vider un prix d'achat
        // déjà renseigné, puisque le champ est facultatif.
        cost_price: editForm.cost_price.trim() ? Number(editForm.cost_price) : null,
        stock: Number(editForm.stock),
        category_id: editForm.category_id || undefined,
        description: editForm.description || undefined,
        is_available: editForm.is_available,
        is_public: editForm.is_public,
        sku: finalSku,
        barcode: editForm.barcode || undefined,
        // Omis si l'image n'a pas changé (voir editImageChanged) : la
        // renvoyer systématiquement risquait d'écraser la vraie photo par
        // un simple aperçu de repli (miniature) quand le rechargement en
        // pleine résolution avait échoué à l'ouverture du formulaire.
        ...(editImageChanged ? { images: editImagePreview ? [editImagePreview] : [] } : {}),
      });
      toast.success('Produit modifié avec succès');
      setEditProduct(null);
      queryClient.setQueryData(queryKeys.products(), (old: typeof productsData) =>
        old ? { ...old, items: old.items.map(p => (p.id === updated.id ? updated : p)) } : old
      );
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
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
      celebrate({
        kind: 'deleted',
        title: fr ? 'Produit supprimé' : 'Product deleted',
        subtitle: deleteTarget.name,
        chips: [fr ? 'Retiré du catalogue' : 'Removed from catalog'],
      });
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      queryClient.setQueryData(queryKeys.products(), (old: typeof productsData) =>
        old ? { ...old, items: old.items.filter(p => p.id !== deletedId), total: Math.max(0, old.total - 1) } : old
      );
      queryClient.invalidateQueries({ queryKey: ['product-stats'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper local upload photo avec compression
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const compressed = await compressImage(base64String);
      if (isEdit) {
        setEditImagePreview(compressed);
        setEditImageChanged(true);
      } else {
        setAddImagePreview(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  // Partage (Phase 3, chantier vitrine publique) — le lien pointe toujours
  // vers la PAGE PRODUIT publique, jamais l'accueil (voir cahier des
  // charges). Le domaine actuel (Vercel) fonctionne dès maintenant ; le
  // jour d'un domaine personnalisé, seule NEXT_PUBLIC_SITE_URL change.
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://boutik-flow.vercel.app';
  const getPublicProductUrl = (productId: string) =>
    `${SITE_URL}/boutique/${tenantData?.slug}/produit/${productId}`;

  const handleShareWhatsApp = (product: Product) => {
    const url = getPublicProductUrl(product.id);
    const text = `${product.name} — ${formatGNF(product.price)}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareFacebook = (product: Product) => {
    const url = getPublicProductUrl(product.id);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const handleCopyProductLink = async (product: Product) => {
    const url = getPublicProductUrl(product.id);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  // useMemo — sans lui, ce filtrage (jusqu'à 500 produits en mémoire, voir
  // useProductsQuery) recalculait à CHAQUE rendu, y compris en ouvrant/
  // fermant une modale ou en tapant dans un champ de formulaire sans
  // rapport (addForm/editForm), aucun de ces changements d'état ne
  // devant re-filtrer le catalogue.
  const filteredProducts = useMemo(() => products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !categoryIdFromUrl || p.category_id === categoryIdFromUrl;
    const matchesStock = stockFilter === 'all'
      || (stockFilter === 'out' && p.stock <= 0)
      || (stockFilter === 'low' && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD)
      || (stockFilter === 'in' && p.stock > LOW_STOCK_THRESHOLD);
    return matchesSearch && matchesCategory && matchesStock;
  }), [products, searchQuery, categoryIdFromUrl, stockFilter]);

  // Compteurs d'alerte et de catégories — dérivés de la liste chargée
  // (le cache partagé, jusqu'à 500 produits), comme le filtre ci-dessus.
  const { availableCount, lowStockCount, outOfStockCount, categoryCounts } = useMemo(() => {
    const counts = new Map<string, number>();
    let available = 0, low = 0, out = 0;
    for (const p of products) {
      if (p.is_available) available++;
      if (p.stock <= 0) out++;
      else if (p.stock <= LOW_STOCK_THRESHOLD) low++;
      if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    }
    return { availableCount: available, lowStockCount: low, outOfStockCount: out, categoryCounts: counts };
  }, [products]);

  // Un catalogue important rendu d'un coup dans le tableau ralentissait la
  // page (et rejoue le même problème déjà rencontré sur la grille Vendre).
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filteredProducts, currentPage, perPage]
  );

  // La liste peut rétrécir suite à une action (suppression du dernier
  // produit de la page) et non un changement de filtre — sans ce recalage,
  // on reste coincé sur une page devenue vide.
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryIdFromUrl, perPage, stockFilter]);

  // Indicateurs de catalogue — calculés côté serveur sur TOUT le catalogue
  // (voir GET /products/stats), jamais en additionnant `products` : cette
  // liste ne contient que la page chargée (100 au plus), ce qui plafonnait
  // silencieusement ces chiffres et les faisait "redescendre" dès qu'une
  // revalidation en arrière-plan remplaçait un ajout optimiste local
  // au-delà de 100 par la vraie page serveur.
  const totalProducts = productsData?.total ?? products.length;
  // null (jamais 0) quand le propriétaire a masqué les chiffres financiers
  // pour ce rôle (voir Tenant.hidden_financial_roles côté backend) —
  // distinct de "pas encore chargé" (statsData absent), qui ne doit pas
  // afficher "Masqué" pendant le premier rendu.
  const totalStockValue = statsData?.total_stock_value ?? 0;
  const stockValueHidden = !!statsData && statsData.total_stock_value == null;
  const totalStockUnits = statsData?.total_stock_units ?? 0;

  const renderProductForm = (
    form: typeof addForm,
    setForm: (f: typeof addForm) => void,
    onSubmit: (e: React.FormEvent) => void,
    loading: boolean,
    submitLabel: string,
    onCancel: () => void,
    isEdit: boolean,
  ) => {
    const imgPreview = isEdit ? editImagePreview : addImagePreview;
    return (
      <form onSubmit={onSubmit} className="modal-form">
        {/* Photo Section */}
        <div className="ai-photo-section">
          <label className="form-label">Photo du produit</label>
          <div className="ai-photo-row">
            <label
              htmlFor={isEdit ? "edit-file-input" : "add-file-input"}
              className="photo-upload-zone"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {imgPreview ? (
                <img src={imgPreview} alt="Photo du produit" className="uploaded-preview-img" style={{ width: '54px', height: '54px', borderRadius: '10px', objectFit: 'cover' }} />
              ) : (
                <div className="upload-placeholder-box" style={{ width: '54px', height: '54px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', border: '1px dashed var(--border-default)' }}>
                  <Camera size={22} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden-file-input"
                id={isEdit ? "edit-file-input" : "add-file-input"}
                onChange={(e) => handleImageUpload(e, isEdit)}
              />
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nom du produit</label>
          <input 
            type="text" 
            className="input" 
            required 
            placeholder="Ex : Riz 25 kg"
            value={form.name}
            onChange={e => {
              const newName = e.target.value;
              const autoSku = !form.sku || form.sku.startsWith('SKU-') ? generateClientSku(newName) : form.sku;
              setForm({ ...form, name: newName, sku: autoSku });
            }} 
          />
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">{t('prod.sku_label')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="input" placeholder="ex: SKU-ROBE-BLUE" value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })} style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setForm({ ...form, sku: generateClientSku(form.name || 'PROD') })}
                title="Générer SKU"
              >
                ⚡ {t('common.add') === 'Add' ? 'Gen SKU' : 'Générer'}
              </button>
            </div>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">{t('prod.barcode_label')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" className="input" placeholder="ex: 3012345678901" value={form.barcode}
                onChange={e => setForm({ ...form, barcode: e.target.value })} style={{ flex: 1 }} />
              <button 
                type="button" 
                className="btn btn-secondary btn-icon"
                onClick={() => { setActiveScanField(isEdit ? 'edit' : 'add'); setIsScannerOpen(true); }}
                title={t('prod.scan_camera')}
              >
                <Camera size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Prix de vente</label>
            <input type="number" className="input" required min="0" placeholder="Ex : 150 000" value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">En stock</label>
            <input type="number" className="input" required min="0" placeholder="Ex : 50" value={form.stock}
              onChange={e => setForm({ ...form, stock: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">
              Prix d&apos;achat <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(facultatif)</span>
            </label>
            <input type="number" className="input" min="0" placeholder="Ex : 100 000" value={form.cost_price}
              onChange={e => setForm({ ...form, cost_price: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Marge estimée</label>
            <div className="margin-preview">
              {form.price && form.cost_price
                ? formatGNF(Number(form.price) - Number(form.cost_price))
                : '—'}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Catégorie</label>
          <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
            <option value="">Choisir...</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Détails (optionnel)</label>
          <textarea className="input" rows={2} placeholder="Ex : Riz importé, sac de 25 kg" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>

        <label className="checkbox-label">
          <input type="checkbox" checked={form.is_available}
            onChange={e => setForm({ ...form, is_available: e.target.checked })} />
          Disponible à la vente
        </label>

        <label className="checkbox-label">
          <input type="checkbox" checked={form.is_public}
            onChange={e => setForm({ ...form, is_public: e.target.checked })} />
          Visible sur la vitrine publique
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Chargement...' : submitLabel}</button>
        </div>
      </form>
    );
  };

  const fr = language === 'fr';
  const stockTone = (stock: number) => (stock <= 0 ? 'rose' : stock <= LOW_STOCK_THRESHOLD ? 'amber' : 'emerald');
  const stockLabel = (stock: number) =>
    stock <= 0 ? (fr ? 'Rupture' : 'Out of stock') : `${formatNumber(stock)} ${t('prod.in_stock')}`;

  const exportCsv = () => {
    const headers = ['Nom', 'Catégorie', 'Prix (GNF)', 'Stock', 'SKU', 'Code-barres', 'Statut'];
    const csvRows = [headers.join(',')];
    products.forEach(p => {
      csvRows.push([
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category_rel?.name || ''}"`,
        p.price,
        p.stock,
        `"${p.sku || ''}"`,
        `"${p.barcode || ''}"`,
        p.is_available ? 'Disponible' : 'Indisponible'
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalogue_produits_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const productActions = (product: Product) => (
    <div className="bf-row-actions">
      <button type="button" className="bf-icon-btn" title="Imprimer / Télécharger Étiquette SKU" aria-label="Étiquette SKU" onClick={() => setSkuPrintProduct(product)}>
        <Printer size={16} />
      </button>
      <button type="button" className="bf-icon-btn" title="Voir" aria-label="Voir" onClick={() => setViewProduct(product)}>
        <Eye size={16} />
      </button>
      {canWrite && (
        <button type="button" className="bf-icon-btn" title="Modifier" aria-label="Modifier" onClick={() => openEdit(product)}>
          <Pencil size={16} />
        </button>
      )}
      {canDelete && (
        <button type="button" className="bf-icon-btn bf-icon-btn--danger" title="Supprimer" aria-label="Supprimer" onClick={() => setDeleteTarget(product)}>
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  const productThumb = (product: Product) => (
    product.thumbnail
      ? <img src={product.thumbnail} alt={product.name} className="bf-thumb" />
      : <span className="bf-thumb"><ImageIcon size={18} /></span>
  );

  const availabilityBadge = (product: Product) => (
    <span className="bf-badge" data-tone={product.is_available ? 'emerald' : 'slate'}>
      <span className="bf-badge__dot" />
      {product.is_available ? t('prod.available') : t('prod.unavailable')}
    </span>
  );

  return (
    <div className="bf-page">
      <PageHeader
        icon={Package}
        title={t('prod.title')}
        subtitle={t('prod.subtitle')}
        actions={
          <>
            <button className="btn btn-secondary" onClick={exportCsv} title={t('common.download')}>
              <Download size={16} /> {t('common.download')}
            </button>
            {canWriteStock && (
              <button className="btn btn-secondary" id="btn-bulk-stock-in" onClick={() => setIsBulkStockInOpen(true)}>
                <PackagePlus size={16} /> {fr ? 'Entrée de stock' : 'Stock-in'}
              </button>
            )}
            {canWrite && (
              <button className="btn btn-secondary" id="btn-bulk-add-products" onClick={() => setIsBulkAddOpen(true)}>
                <Layers size={16} /> {fr ? 'Créer en groupe' : 'Bulk create'}
              </button>
            )}
            {canWrite && (
              <button className="btn btn-primary" id="btn-add-product" onClick={() => setIsAddOpen(true)}>
                <Plus size={16} /> {t('prod.add')}
              </button>
            )}
          </>
        }
      />

      <section className="bf-stats">
        <StatTile
          tone="emerald" icon={Wallet} label={fr ? 'Valeur du stock' : 'Stock value'}
          value={stockValueHidden ? (fr ? 'Masqué' : 'Hidden') : formatNumber(totalStockValue)}
          suffix={stockValueHidden ? undefined : 'GNF'}
          hint={fr ? 'Au prix de vente' : 'At selling price'}
        />
        <StatTile
          tone="sky" icon={Package} label={fr ? 'Produits en catalogue' : 'Products in catalog'}
          value={formatNumber(totalProducts)}
          hint={<><strong>{formatNumber(availableCount)}</strong> {fr ? 'disponibles à la vente' : 'available for sale'}</>}
        />
        <StatTile
          tone="amber" icon={Layers} label={fr ? 'Unités en stock' : 'Units in stock'}
          value={formatNumber(totalStockUnits)}
          hint={fr ? 'Toutes références confondues' : 'Across all products'}
        />
        <StatTile
          tone="rose" icon={AlertTriangle} label={fr ? 'Alertes stock' : 'Stock alerts'}
          value={formatNumber(lowStockCount + outOfStockCount)}
          hint={<><strong>{formatNumber(outOfStockCount)}</strong> {fr ? 'en rupture' : 'out of stock'} · {formatNumber(lowStockCount)} {fr ? 'faibles' : 'low'}</>}
        />
      </section>

      <section className="bf-toolbar">
        <div className="bf-search">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('prod.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="bf-select-wrap">
          <select
            className={`bf-select ${stockFilter !== 'all' ? 'bf-select--active' : ''}`}
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as StockFilter)}
            aria-label={fr ? 'Filtrer par stock' : 'Filter by stock'}
          >
            <option value="all">{fr ? 'Tous les stocks' : 'All stock levels'}</option>
            <option value="in">{fr ? 'En stock' : 'In stock'}</option>
            <option value="low">{fr ? 'Stock faible' : 'Low stock'}</option>
            <option value="out">{fr ? 'En rupture' : 'Out of stock'}</option>
          </select>
          <ChevronDown size={15} />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => { setActiveScanField('search'); setIsScannerOpen(true); }}
          title={t('prod.scan_camera')}
        >
          <Camera size={17} /> {t('prod.scan_camera')}
        </button>
        {categories.length > 0 && (
          <div className="bf-chips" style={{ flexBasis: '100%' }} role="tablist" aria-label={fr ? 'Catégories' : 'Categories'}>
            <button
              type="button"
              role="tab"
              aria-selected={!categoryIdFromUrl}
              className={`bf-chip ${!categoryIdFromUrl ? 'bf-chip--active' : ''}`}
              onClick={() => router.push('/products')}
            >
              {fr ? 'Toutes' : 'All'} <span className="bf-chip__count">{formatNumber(products.length)}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={categoryIdFromUrl === c.id}
                className={`bf-chip ${categoryIdFromUrl === c.id ? 'bf-chip--active' : ''}`}
                onClick={() => router.push(`/products?category_id=${c.id}`)}
              >
                {c.name} <span className="bf-chip__count">{formatNumber(categoryCounts.get(c.id) ?? 0)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        title={t('prod.scan_camera')}
        onScanSuccess={(decodedText) => {
          if (activeScanField === 'search') {
            setSearchQuery(decodedText);
            toast.success(`Code scanné: ${decodedText}`);
          } else if (activeScanField === 'add') {
            setAddForm(prev => ({ ...prev, barcode: decodedText }));
            toast.success(`Code-barres assigné: ${decodedText}`);
          } else if (activeScanField === 'edit') {
            setEditForm(prev => ({ ...prev, barcode: decodedText }));
            toast.success(`Code-barres assigné: ${decodedText}`);
          }
        }}
      />

      <section className="bf-panel">
        <div className="bf-panel__head">
          <span className="bf-panel__title">
            {fr ? 'Catalogue' : 'Catalog'} <span className="bf-count">{formatNumber(filteredProducts.length)}</span>
          </span>
          {(searchQuery || stockFilter !== 'all' || categoryIdFromUrl) && (
            <button
              type="button"
              className="bf-chip"
              onClick={() => { setSearchQuery(''); setStockFilter('all'); if (categoryIdFromUrl) router.push('/products'); }}
            >
              <X size={14} /> {fr ? 'Effacer les filtres' : 'Clear filters'}
            </button>
          )}
        </div>

        {isLoading && products.length === 0 ? (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="bf-skeleton" style={{ height: 56 }} />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bf-empty">
            <span className="bf-empty__icon"><PackageSearch size={24} /></span>
            <strong>{products.length === 0 ? (fr ? 'Votre catalogue est vide' : 'Your catalog is empty') : (fr ? 'Aucun produit trouvé' : 'No product found')}</strong>
            <span>{products.length === 0
              ? (fr ? 'Ajoutez votre premier produit pour commencer à vendre.' : 'Add your first product to start selling.')
              : (fr ? 'Essayez une autre recherche ou un autre filtre.' : 'Try another search or filter.')}</span>
            {products.length === 0 && canWrite && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsAddOpen(true)}><Plus size={15} /> {t('prod.add')}</button>
            )}
          </div>
        ) : (
          <>
            <div className="bf-table-wrap bf-desktop-only">
              <table className="bf-table">
                <thead>
                  <tr>
                    <th>{t('prod.name')}</th>
                    <th>{t('prod.category')}</th>
                    <th className="bf-right">{t('prod.price')}</th>
                    <th>{t('prod.stock')}</th>
                    <th>{t('prod.status')}</th>
                    <th className="bf-right">{t('prod.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map(product => (
                    <tr key={product.id} className={!product.is_available ? 'bf-row--muted' : ''}>
                      <td>
                        <div className="bf-cell">
                          {productThumb(product)}
                          <span className="bf-cell__text">
                            <span className="bf-name">{product.name}</span>
                            <span className="bf-sub bf-mono">{product.sku || '—'}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        {product.category_rel?.name
                          ? <span className="bf-badge">{product.category_rel.name}</span>
                          : <span className="bf-muted">{fr ? 'Sans catégorie' : 'Uncategorized'}</span>}
                      </td>
                      <td className="bf-right"><span className="bf-money">{formatGNF(product.price)}</span></td>
                      <td>
                        <span className="bf-badge" data-tone={stockTone(product.stock)}>
                          <span className="bf-badge__dot" />{stockLabel(product.stock)}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          {availabilityBadge(product)}
                          {product.is_public && (
                            <span className="bf-muted" title={fr ? 'Visible sur la vitrine publique' : 'Visible on the public storefront'}>
                              <Globe size={14} />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="bf-right">{productActions(product)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bf-mlist">
              {paginatedProducts.map(product => (
                <article key={product.id} className="bf-mcard" style={!product.is_available ? { opacity: 0.6 } : undefined}>
                  {productThumb(product)}
                  <div className="bf-mcard__main">
                    <span className="bf-name">{product.name}</span>
                    <span className="bf-sub">{product.category_rel?.name || (fr ? 'Sans catégorie' : 'Uncategorized')}</span>
                  </div>
                  <div className="bf-mcard__side">
                    <span className="bf-money">{formatGNF(product.price)}</span>
                  </div>
                  <div className="bf-mcard__foot">
                    <div className="bf-mcard__meta">
                      <span className="bf-badge" data-tone={stockTone(product.stock)}>
                        <span className="bf-badge__dot" />{stockLabel(product.stock)}
                      </span>
                      {availabilityBadge(product)}
                    </div>
                    {productActions(product)}
                  </div>
                </article>
              ))}
            </div>

            <div className="bf-pager">
              <span className="bf-pager__info">
                <strong>{(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filteredProducts.length)}</strong>
                {fr ? ' sur ' : ' of '}<strong>{formatNumber(filteredProducts.length)}</strong> {fr ? 'produits' : 'products'}
              </span>
              <div className="bf-pager__controls">
                <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} aria-label={fr ? 'Produits par page' : 'Products per page'}>
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <button type="button" className="bf-icon-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} aria-label={fr ? 'Page précédente' : 'Previous page'}>
                  <ChevronLeft size={16} />
                </button>
                <span className="bf-pager__page">{currentPage} / {totalPages}</span>
                <button type="button" className="bf-icon-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} aria-label={fr ? 'Page suivante' : 'Next page'}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Modal Ajouter */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Nouveau produit">
        {renderProductForm(addForm, setAddForm, handleAdd, isSubmitting, 'Ajouter', () => setIsAddOpen(false), false)}
      </Modal>

      {/* Modal Création groupée */}
      <BulkAddProductsModal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        categories={categories}
        onCreated={fetchProductsAndCategories}
      />

      {/* Modal Entrée de stock groupée */}
      <BulkStockInModal
        isOpen={isBulkStockInOpen}
        onClose={() => setIsBulkStockInOpen(false)}
        products={products}
        onUpdated={fetchProductsAndCategories}
      />

      {/* Modal Voir */}
      <Modal isOpen={!!viewProduct} onClose={() => setViewProduct(null)} title="Détails du produit">
        {viewProduct && (
          <div className="detail-grid">
            {(viewProduct.images?.[0] || viewProduct.thumbnail) && (
              <div className="detail-image-wrap">
                <img src={viewProduct.images?.[0] || viewProduct.thumbnail!} alt={viewProduct.name} className="detail-product-img" />
              </div>
            )}
            <div className="detail-row"><span className="detail-label">Nom</span><span className="detail-value">{viewProduct.name}</span></div>
            <div className="detail-row"><span className="detail-label">SKU</span><span className="detail-value">{viewProduct.sku || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Code-barres</span><span className="detail-value">{viewProduct.barcode || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Prix de vente</span><span className="detail-value product-price">{formatGNF(viewProduct.price)}</span></div>
            <div className="detail-row"><span className="detail-label">Prix d&apos;achat</span><span className="detail-value">{viewProduct.cost_price != null ? formatGNF(viewProduct.cost_price) : '—'}</span></div>
            {viewProduct.cost_price != null && (
              <div className="detail-row"><span className="detail-label">Marge</span><span className="detail-value product-price">{formatGNF(viewProduct.price - viewProduct.cost_price)}</span></div>
            )}
            <div className="detail-row"><span className="detail-label">Stock</span><span className="detail-value">{viewProduct.stock}</span></div>
            <div className="detail-row"><span className="detail-label">Catégorie</span><span className="detail-value">{viewProduct.category_rel?.name || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Description</span><span className="detail-value">{viewProduct.description || '—'}</span></div>
            <div className="detail-row"><span className="detail-label">Disponible</span><span className="detail-value">{viewProduct.is_available ? 'Oui' : 'Non'}</span></div>
            <div className="detail-row"><span className="detail-label">Vitrine publique</span><span className="detail-value">{viewProduct.is_public ? 'Visible' : 'Masqué'}</span></div>
            <div className="detail-row"><span className="detail-label">Créé le</span><span className="detail-value">{new Date(viewProduct.created_at).toLocaleDateString('fr-FR')}</span></div>

            {viewProduct.sku && (
              <div className="qr-container-row">
                <div className="qr-actions-buttons">
                  <button className="btn btn-secondary btn-sm flex items-center justify-center w-full" onClick={() => setIsQrModalOpen(true)}>
                    <Printer size={13} style={{ marginRight: '0.35rem' }} /> Imprimer le code QR
                  </button>
                </div>
              </div>
            )}

            {viewProduct.is_public && tenantData?.slug && (
              <div className="share-section">
                <div className="share-label"><Share2 size={14} /> Partager le produit</div>
                <div className="share-buttons">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleShareWhatsApp(viewProduct)}>
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleShareFacebook(viewProduct)}>
                    <Globe size={14} /> Facebook
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleCopyProductLink(viewProduct)}>
                    <LinkIcon size={14} /> Copier le lien
                  </button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setViewProduct(null)}>Fermer</button>
              {canWrite && (
                <button className="btn btn-primary" onClick={() => { setViewProduct(null); openEdit(viewProduct); }}>
                  <Pencil size={14} /> Modifier
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Modifier */}
      <Modal isOpen={!!editProduct} onClose={() => setEditProduct(null)} title="Modifier le produit">
        {renderProductForm(editForm, setEditForm, handleEdit, isEditing, 'Enregistrer', () => setEditProduct(null), true)}
      </Modal>

      {/* Confirmation de suppression animée */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        fr={fr}
        title={fr ? 'Supprimer ce produit ?' : 'Delete this product?'}
        name={deleteTarget?.name}
        message={fr ? "Il disparaîtra du catalogue, de la caisse et de la vitrine." : "It will be removed from the catalog, the checkout and the storefront."}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <style jsx>{`
        .product-price { font-weight: 700; color: var(--color-brand-500); font-family: var(--font-display); }
        .btn-icon { padding: 0.4rem; border-radius: 6px; }

        .modal-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
        .form-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); }
        .form-row { display: flex; gap: 1rem; }
        .margin-preview {
          min-height: 44px; display: flex; align-items: center;
          padding: 0 0.875rem; border-radius: var(--radius-md);
          background: var(--surface-2); border: 1px solid var(--border-subtle);
          font-weight: 700; color: var(--color-brand-400);
        }
        .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; color: var(--text-secondary); }
        .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }

        .detail-grid { display: flex; flex-direction: column; gap: 0.75rem; }
        .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border-subtle); }
        .detail-row:last-of-type { border-bottom: none; }
        .detail-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .detail-value { font-size: 0.9rem; color: var(--text-primary); font-weight: 500; }

        /* IA / Photo block */
        .ai-photo-section {
          background: var(--overlay-subtle);
          border: 1px solid var(--overlay-border);
          border-radius: 8px;
          padding: 0.75rem;
          margin-bottom: 0.25rem;
        }
        .ai-photo-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        .photo-upload-zone {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .upload-placeholder-box {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.625rem 0.875rem;
          border: 1px dashed var(--border-default);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-primary);
          transition: all 0.2s ease;
        }
        .upload-placeholder-box:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--color-brand-500);
        }
        .uploaded-preview-img {
          width: 44px;
          height: 44px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid var(--border-strong);
        }
        .hidden-file-input {
          display: none;
        }
        .upload-btn {
          cursor: pointer;
        }
        .qr-container-row {
          display: flex;
          gap: 1rem;
          align-items: center;
          background: var(--overlay-subtle);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 0.75rem;
          margin-top: 0.5rem;
        }
        .share-section {
          background: var(--overlay-subtle);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 0.75rem;
          margin-top: 0.75rem;
        }
        .share-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 0.6rem;
        }
        .share-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .share-buttons .btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        @media (max-width: 480px) {
          .qr-container-row {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .qr-actions-buttons {
            width: 100%;
          }
        }
        .qr-actions-buttons {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .qr-actions-buttons .btn {
          font-size: 0.78rem !important;
          padding: 0.4rem 0.5rem !important;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          width: 100%;
        }

        .detail-image-wrap { width: 100%; display: flex; justify-content: center; margin-bottom: 1rem; }
        .detail-product-img { max-width: 150px; max-height: 150px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border-strong); }

        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          :global(.sidebar), :global(.mobile-bar), :global(.bf-actions), :global(.bf-toolbar), :global(.bf-stats), :global(.bf-pager),
          :global(.bf-mlist), :global(.modal), :global(.btn), button, :global(.bf-table th:last-child), :global(.bf-table td:last-child) {
            display: none !important;
          }
          :global(.bf-title) { color: black !important; }
          :global(.bf-table) { border: 1px solid #d1d5db !important; }
          :global(.bf-table th) { background: #f3f4f6 !important; color: black !important; }
          :global(.bf-table td) { color: black !important; border-bottom: 1px solid #e5e7eb !important; }
        }
      `}</style>

      {skuPrintProduct && (
        <SKUPrintModal
          isOpen={!!skuPrintProduct}
          onClose={() => setSkuPrintProduct(null)}
          product={skuPrintProduct}
        />
      )}

      {viewProduct && (
        <QRCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          value={viewProduct.sku || ''}
          title={viewProduct.name}
          subtitle={`SKU: ${viewProduct.sku || ''}`}
        />
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
