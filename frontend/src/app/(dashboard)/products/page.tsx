'use client';

import { useEffect, useState, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search, ImageIcon, Pencil, Trash2, Eye, Plus, Sparkles, Download, Printer, Camera, Layers, Wallet, Package, PackagePlus } from 'lucide-react';
import type { Product } from '@/types';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { SKUPrintModal } from '@/components/ui/SKUPrintModal';
import { BulkAddProductsModal } from '@/components/ui/BulkAddProductsModal';
import { BulkStockInModal } from '@/components/ui/BulkStockInModal';
import { useLanguage } from '@/context/LanguageContext';
import { compressImage } from '@/lib/utils/imageCompressor';
import { useSearchParams, useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useProductsQuery, useCategoriesQuery, queryKeys } from '@/lib/queries';

function formatGNF(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}



function ProductsContent() {
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();
  const categoryIdFromUrl = searchParams.get('category_id');
  const router = useRouter();
  const queryClient = useQueryClient();
  // Couche mémoire globale : ces deux requêtes partagent leur clé de cache
  // avec le Dashboard, Vendre et Clients — la première de ces pages
  // visitée charge les données, les suivantes les trouvent déjà en
  // mémoire (isLoading ne redevient jamais true après le premier chargement,
  // seule une revalidation silencieuse a lieu en arrière-plan).
  const { data: productsData, isLoading } = useProductsQuery();
  const { data: categoriesData } = useCategoriesQuery();
  const products = productsData?.items ?? [];
  const categories = categoriesData?.items ?? [];
  const [searchQuery, setSearchQuery] = useState('');
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
    name: '', price: '', cost_price: '', stock: '', category_id: '', description: '', is_available: true, sku: '', barcode: '',
  });

  // View modal
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [skuPrintProduct, setSkuPrintProduct] = useState<Product | null>(null);

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', price: '', cost_price: '', stock: '', category_id: '', description: '', is_available: true, sku: '', barcode: '',
  });
  const [isEditing, setIsEditing] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI Assistant states
  const [addImagePreview, setAddImagePreview] = useState<string | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [isAILoading, setIsAILoading] = useState(false);

  // Ré-appelle les deux requêtes (produits + catégories) en arrière-plan —
  // utilisé après une opération groupée (import en masse, entrée de stock
  // groupée) où patcher le cache produit par produit serait plus fragile
  // qu'une revalidation silencieuse de la liste entière.
  const fetchProductsAndCategories = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.products() });
    queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
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
        sku: finalSku,
        barcode: addForm.barcode || undefined,
        images: addImagePreview ? [addImagePreview] : [],
      });
      toast.success('Produit ajouté avec succès');
      setIsAddOpen(false);
      setAddForm({ name: '', price: '', cost_price: '', stock: '', category_id: '', description: '', is_available: true, sku: '', barcode: '' });
      setAddImagePreview(null);
      // Mise à jour locale immédiate du cache partagé — pas de rechargement
      // complet, le nouveau produit apparaît instantanément dans la liste
      // (ici et sur Dashboard/Vendre) sans re-frapper le serveur.
      queryClient.setQueryData(queryKeys.products(), (old: typeof productsData) =>
        old ? { ...old, items: [created, ...old.items], total: old.total + 1 } : old
      );
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
      cost_price: product.cost_price != null ? String(product.cost_price) : '',
      stock: String(product.stock),
      category_id: product.category_id || '',
      description: product.description || '',
      is_available: product.is_available,
      sku: product.sku || '',
      barcode: product.barcode || '',
    });
    setEditImagePreview(product.images?.[0] || null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
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
        sku: finalSku,
        barcode: editForm.barcode || undefined,
        images: editImagePreview ? [editImagePreview] : [],
      });
      toast.success('Produit modifié avec succès');
      setEditProduct(null);
      queryClient.setQueryData(queryKeys.products(), (old: typeof productsData) =>
        old ? { ...old, items: old.items.map(p => (p.id === updated.id ? updated : p)) } : old
      );
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
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      queryClient.setQueryData(queryKeys.products(), (old: typeof productsData) =>
        old ? { ...old, items: old.items.filter(p => p.id !== deletedId), total: Math.max(0, old.total - 1) } : old
      );
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
      } else {
        setAddImagePreview(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-remplissage IA
  const handleAIPrefill = async (isEdit: boolean) => {
    const imgPreview = isEdit ? editImagePreview : addImagePreview;
    if (!imgPreview) {
      toast.error("Veuillez d'abord sélectionner une photo.");
      return;
    }
    setIsAILoading(true);
    try {
      const suggestions = await api.analyzeProductImage(imgPreview);
      const targetForm = isEdit ? editForm : addForm;
      const targetSetForm = isEdit ? setEditForm : setAddForm;
      
      targetSetForm({
        ...targetForm,
        name: suggestions.name || targetForm.name,
        description: suggestions.description || targetForm.description,
      });
      toast.success("Champs préremplis avec succès par l'IA !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'analyse");
    } finally {
      setIsAILoading(false);
    }
  };

  // QR Code download/print helpers — générés localement (le service Google
  // Charts précédemment utilisé a été fermé par Google et répond 404 :
  // aucun QR code ne pouvait plus être ni téléchargé ni imprimé).
  const downloadQRCode = async (sku: string, productName: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(sku, { width: 300, margin: 1 });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `QRCode-${productName.replace(/\s+/g, '_')}-${sku}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast.error(language === 'fr' ? 'Erreur lors de la génération du QR code' : 'Error generating QR code');
    }
  };

  const printQRCode = (sku: string, productName: string) => {
    // Ouvrir la popup de façon synchrone (avant tout await) : sinon les
    // navigateurs strictement anti-popup (Safari) bloquent window.open()
    // une fois sorti du contexte direct du clic utilisateur.
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:2rem;">${language === 'fr' ? 'Génération du QR code…' : 'Generating QR code…'}</body></html>`);

    QRCode.toDataURL(sku, { width: 250, margin: 1 }).then((dataUrl) => {
      printWindow.document.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimer QR Code - ${productName}</title>
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; text-align: center; }
              h2 { margin-bottom: 5px; }
              p { margin-top: 5px; color: #555; }
              img { border: 1px solid #eee; padding: 10px; }
              @media print {
                img { max-width: 100%; }
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <h2>${productName}</h2>
            <img src="${dataUrl}" alt="${sku}" />
            <p>SKU: <strong>${sku}</strong></p>
          </body>
        </html>
      `);
      printWindow.document.close();
    }).catch(() => {
      printWindow.close();
      toast.error(language === 'fr' ? 'Erreur lors de la génération du QR code' : 'Error generating QR code');
    });
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !categoryIdFromUrl || p.category_id === categoryIdFromUrl;
    return matchesSearch && matchesCategory;
  });

  // Un catalogue important rendu d'un coup dans le tableau ralentissait la
  // page (et rejoue le même problème déjà rencontré sur la grille Vendre).
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * perPage, currentPage * perPage);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, categoryIdFromUrl, perPage]);

  // Indicateurs de catalogue — toujours calculés sur l'ensemble des
  // produits chargés, pas seulement la page ou le filtre courant.
  const totalStockValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);

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

            {imgPreview && (
              <button
                type="button"
                className="btn btn-secondary btn-sm ai-prefill-btn"
                disabled={isAILoading}
                onClick={() => handleAIPrefill(isEdit)}
              >
                <Sparkles size={13} className="sparkle-icon" />
                {isAILoading ? 'Analyse...' : 'Auto-remplir avec l\'IA'}
              </button>
            )}
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

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Chargement...' : submitLabel}</button>
        </div>
      </form>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('prod.title')}</h1>
          <p className="page-subtitle">{t('prod.subtitle')}</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => window.print()}
            title={t('common.print')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Printer size={16} />
            <span>{t('common.print')}</span>
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={() => {
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
            }}
            title={t('common.download')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={16} />
            <span>{t('common.download')}</span>
          </button>

          <button className="btn btn-ghost" id="btn-bulk-stock-in" onClick={() => setIsBulkStockInOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <PackagePlus size={16} />
            <span>{language === 'fr' ? 'Entrée de stock' : 'Stock-in'}</span>
          </button>

          <button className="btn btn-ghost" id="btn-bulk-add-products" onClick={() => setIsBulkAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={16} />
            <span>{language === 'fr' ? 'Créer en groupe' : 'Bulk create'}</span>
          </button>

          <button className="btn btn-primary" id="btn-add-product" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} /> {t('prod.add')}
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-green"><Wallet size={20} /></div>
          <span className="kpi-label">{language === 'fr' ? 'Valeur du stock' : 'Stock value'}</span>
          <span className="kpi-value">{formatGNF(totalStockValue)}</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-indigo"><Package size={20} /></div>
          <span className="kpi-label">{language === 'fr' ? 'Produits en catalogue' : 'Products in catalog'}</span>
          <span className="kpi-value">{products.length}</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber"><Layers size={20} /></div>
          <span className="kpi-label">{language === 'fr' ? 'Unités en stock' : 'Units in stock'}</span>
          <span className="kpi-value">{totalStockUnits.toLocaleString('fr-FR')}</span>
        </div>
      </div>

      <div className="filters card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1 }}>
          <span className="search-icon"><Search size={18} /></span>
          <input type="text" className="input search-input" placeholder={t('prod.search')}
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {categoryIdFromUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#10b981' }}>
            <span>Filtré par catégorie</span>
            <button 
              onClick={() => router.push('/products')} 
              style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', lineHeight: 1, padding: '0 0.2rem' }}
              title="Supprimer le filtre"
            >×</button>
          </div>
        )}
        <button 
          className="btn btn-secondary" 
          onClick={() => { setActiveScanField('search'); setIsScannerOpen(true); }}
          title={t('prod.scan_camera')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Camera size={18} />
          <span>{t('prod.scan_camera')}</span>
        </button>
      </div>

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

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('prod.name')}</th>
              <th>{t('prod.category')}</th>
              <th>{t('prod.price')}</th>
              <th>{t('prod.stock')}</th>
              <th>{t('prod.sku')}</th>
              <th>{t('prod.status')}</th>
              <th className="text-right">{t('prod.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map(product => (
              <tr key={product.id} className={!product.is_available ? 'row-disabled' : ''}>
                <td>
                  <div className="product-cell">
                    {product.images && product.images[0] ? (
                      <img src={product.images[0]} alt={product.name} className="product-list-img" />
                    ) : (
                      <div className="product-img-placeholder"><ImageIcon size={20} /></div>
                    )}
                    <span className="product-name">{product.name}</span>
                  </div>
                </td>
                <td><span className="tag-pill">{product.category_rel?.name || 'Uncategorized'}</span></td>
                <td><span className="product-price">{formatGNF(product.price)}</span></td>
                <td>
                  <span className={`stock-badge ${product.stock > 10 ? 'stock-high' : product.stock > 0 ? 'stock-low' : 'stock-out'}`}>
                    {product.stock} {t('prod.in_stock')}
                  </span>
                </td>
                <td><span className="sku-text">{product.sku || '—'}</span></td>
                <td>
                  {product.is_available
                    ? <span className="badge badge-success">{t('prod.available')}</span>
                    : <span className="badge badge-error">{t('prod.unavailable')}</span>}
                </td>
                <td className="text-right">
                  <div className="actions-flex">
                    <button className="btn btn-ghost btn-icon" title="Imprimer / Télécharger Étiquette SKU" onClick={() => setSkuPrintProduct(product)}>
                      <Printer size={16} />
                    </button>
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
              <tr><td colSpan={7} className="text-center py-8"><div className="spinner"></div></td></tr>
            )}
            {!isLoading && filteredProducts.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-muted">Aucun produit trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination-bar">
          <div className="per-page-wrap">
            <span className="per-page-label">{language === 'fr' ? 'Par page' : 'Per page'} :</span>
            <select className="input" style={{ width: '80px' }} value={perPage} onChange={e => setPerPage(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="page-nav">
            <button className="btn btn-ghost btn-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>{language === 'fr' ? 'Précédent' : 'Previous'}</button>
            <span className="page-indicator">{language === 'fr' ? 'Page' : 'Page'} {currentPage} {language === 'fr' ? 'sur' : 'of'} {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>{language === 'fr' ? 'Suivant' : 'Next'}</button>
          </div>
        </div>
      )}

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
            {viewProduct.images && viewProduct.images[0] && (
              <div className="detail-image-wrap">
                <img src={viewProduct.images[0]} alt={viewProduct.name} className="detail-product-img" />
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
            <div className="detail-row"><span className="detail-label">Créé le</span><span className="detail-value">{new Date(viewProduct.created_at).toLocaleDateString('fr-FR')}</span></div>

            {viewProduct.sku && (
              <div className="qr-container-row">
                <div className="qr-img-wrap">
                  <img
                    src={`https://chart.googleapis.com/chart?chs=150x150&cht=qr&chl=${encodeURIComponent(viewProduct.sku)}&choe=UTF-8`}
                    alt={viewProduct.sku}
                    className="qr-img"
                  />
                </div>
                <div className="qr-actions-buttons">
                  <button className="btn btn-secondary btn-sm flex items-center justify-center w-full" onClick={() => downloadQRCode(viewProduct.sku || '', viewProduct.name)}>
                    <Download size={13} style={{ marginRight: '0.35rem' }} /> Télécharger
                  </button>
                  <button className="btn btn-secondary btn-sm flex items-center justify-center w-full mt-2" onClick={() => printQRCode(viewProduct.sku || '', viewProduct.name)}>
                    <Printer size={13} style={{ marginRight: '0.35rem' }} /> Imprimer
                  </button>
                </div>
              </div>
            )}

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
        {renderProductForm(editForm, setEditForm, handleEdit, isEditing, 'Enregistrer', () => setEditProduct(null), true)}
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

        /* Pagination */
        .pagination-bar { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; gap: 1rem; flex-wrap: wrap; }
        .per-page-wrap { display: flex; align-items: center; gap: 0.5rem; }
        .per-page-label { font-size: 0.85rem; color: var(--text-muted); }
        .page-nav { display: flex; align-items: center; gap: 0.75rem; }
        .page-indicator { font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; }
        .data-table tr:hover td { background: var(--surface-hover); }
        .data-table tr:last-child td { border-bottom: none; }
        .row-disabled td { opacity: 0.6; }

        .product-cell { display: flex; align-items: center; gap: 0.75rem; }
        .product-img-placeholder { width: 40px; height: 40px; border-radius: 8px; background: var(--surface-3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-default); color: var(--text-muted); }
        .product-list-img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-default); flex-shrink: 0; }
        .product-name { font-weight: 600; }
        .product-price { font-weight: 600; color: var(--color-brand-400); font-family: var(--font-display); }
        .tag-pill { background: var(--surface-3); color: var(--text-secondary); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; border: 1px solid var(--border-default); }
        .sku-text { font-family: monospace; font-size: 0.8rem; color: var(--text-secondary); }

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
        .ai-prefill-btn {
          background: var(--brand-alpha-10);
          color: var(--color-brand-400);
          border: 1px solid var(--brand-alpha-20);
          gap: 0.35rem;
        }
        .ai-prefill-btn:hover {
          background: var(--brand-alpha-20);
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
        .qr-img-wrap {
          background: white;
          padding: 0.5rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-default);
          flex-shrink: 0;
        }
        .qr-img {
          width: 90px;
          height: 90px;
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

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        .sparkle-icon {
          animation: pulse 1.5s infinite;
        }

        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .sidebar, .mobile-bar, .header-actions, .filters, .modal, .btn, button, .text-right, th:last-child, td:last-child {
            display: none !important;
          }
          .page {
            padding: 0 !important;
            margin: 0 !important;
          }
          .page-title {
            color: black !important;
            font-size: 1.8rem !important;
          }
          .page-subtitle {
            color: #4b5563 !important;
            font-size: 0.9rem !important;
          }
          .data-table {
            border: 1px solid #d1d5db !important;
            width: 100% !important;
          }
          .data-table th {
            background: #f3f4f6 !important;
            color: black !important;
            border-bottom: 2px solid #9ca3af !important;
          }
          .data-table td {
            border-bottom: 1px solid #e5e7eb !important;
            color: black !important;
          }
          .badge-success { background: #dcfce7 !important; color: #166534 !important; border: 1px solid #86efac !important; }
          .badge-error { background: #fee2e2 !important; color: #991b1b !important; border: 1px solid #fca5a5 !important; }
        }
      `}</style>

      {skuPrintProduct && (
        <SKUPrintModal
          isOpen={!!skuPrintProduct}
          onClose={() => setSkuPrintProduct(null)}
          product={skuPrintProduct}
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
