'use client';

import { useState } from 'react';
import { Plus, Trash2, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import type { Category, ProductCreate } from '@/types';

interface BulkRow {
  key: string;
  name: string;
  price: string;
  cost_price: string;
  stock: string;
  category_id: string;
}

function emptyRow(): BulkRow {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '', price: '', cost_price: '', stock: '', category_id: '',
  };
}

interface BulkAddProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onCreated: () => void;
}

export function BulkAddProductsModal({ isOpen, onClose, categories, onCreated }: BulkAddProductsModalProps) {
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [rows, setRows] = useState<BulkRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ createdCount: number; errors: { index: number; name: string; error: string }[] } | null>(null);

  const updateRow = (key: string, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (key: string) => setRows(prev => (prev.length > 1 ? prev.filter(r => r.key !== key) : prev));

  const reset = () => {
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setResult(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const validRows = rows.filter(r => r.name.trim() && r.price.trim());
    if (validRows.length === 0) {
      toast.error(fr ? 'Renseignez au moins un produit (nom + prix requis)' : 'Fill in at least one product (name + price required)');
      return;
    }

    const payload: ProductCreate[] = validRows.map(r => ({
      name: r.name.trim(),
      price: Number(r.price),
      cost_price: r.cost_price.trim() ? Number(r.cost_price) : undefined,
      stock: r.stock.trim() ? Number(r.stock) : 0,
      category_id: r.category_id || undefined,
    }));

    setIsSubmitting(true);
    try {
      const res = await api.createProductsBulk(payload);
      setResult({ createdCount: res.created.length, errors: res.errors });
      if (res.errors.length === 0) {
        toast.success(
          fr ? `${res.created.length} produit(s) créé(s) avec succès` : `${res.created.length} product(s) created successfully`
        );
        onCreated();
        reset();
        onClose();
      } else {
        toast.warning(
          fr
            ? `${res.created.length} créé(s), ${res.errors.length} en erreur — voir le détail ci-dessous`
            : `${res.created.length} created, ${res.errors.length} failed — see details below`
        );
        onCreated();
      }
    } catch (err: any) {
      toast.error(err.message || (fr ? 'Erreur lors de la création groupée' : 'Error during bulk creation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={fr ? 'Créer des produits en groupe' : 'Bulk create products'} maxWidth="720px">
      <div className="bulk-modal">
        <p className="bulk-hint">
          <Layers size={14} />
          {fr
            ? 'Remplissez plusieurs lignes puis validez en une seule fois. Nom et prix sont requis, le reste est facultatif.'
            : 'Fill in several rows then submit them all at once. Name and price are required, the rest is optional.'}
        </p>

        <div className="bulk-rows">
          {rows.map((row, i) => (
            <div key={row.key} className="bulk-row">
              <div className="bulk-row-head">
                <span className="bulk-row-index">#{i + 1}</span>
                <button
                  type="button"
                  className="bulk-row-remove"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  title={fr ? 'Retirer cette ligne' : 'Remove this row'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="bulk-row-fields">
                <input
                  className="input"
                  placeholder={fr ? 'Nom du produit *' : 'Product name *'}
                  value={row.name}
                  onChange={e => updateRow(row.key, 'name', e.target.value)}
                />
                <input
                  className="input"
                  type="number" min="0"
                  placeholder={fr ? 'Prix de vente *' : 'Sale price *'}
                  value={row.price}
                  onChange={e => updateRow(row.key, 'price', e.target.value)}
                />
                <input
                  className="input"
                  type="number" min="0"
                  placeholder={fr ? "Prix d'achat" : 'Cost price'}
                  value={row.cost_price}
                  onChange={e => updateRow(row.key, 'cost_price', e.target.value)}
                />
                <input
                  className="input"
                  type="number" min="0"
                  placeholder={fr ? 'Stock' : 'Stock'}
                  value={row.stock}
                  onChange={e => updateRow(row.key, 'stock', e.target.value)}
                />
                <select
                  className="input"
                  value={row.category_id}
                  onChange={e => updateRow(row.key, 'category_id', e.target.value)}
                >
                  <option value="">{fr ? 'Catégorie (facultatif)' : 'Category (optional)'}</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {result?.errors.find(e => e.index === i) && (
                <div className="bulk-row-error">
                  <AlertTriangle size={13} />
                  {result.errors.find(e => e.index === i)?.error}
                </div>
              )}
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost bulk-add-row-btn" onClick={addRow}>
          <Plus size={15} /> {fr ? 'Ajouter une ligne' : 'Add a row'}
        </button>

        {result && (
          <div className="bulk-summary">
            <CheckCircle size={14} />
            {fr
              ? `${result.createdCount} produit(s) créé(s)${result.errors.length ? `, ${result.errors.length} en erreur` : ''}.`
              : `${result.createdCount} product(s) created${result.errors.length ? `, ${result.errors.length} failed` : ''}.`}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={isSubmitting}>
            {fr ? 'Fermer' : 'Close'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? (fr ? 'Création…' : 'Creating…')
              : (fr ? `Créer ${rows.filter(r => r.name.trim() && r.price.trim()).length || ''} produit(s)` : `Create ${rows.filter(r => r.name.trim() && r.price.trim()).length || ''} product(s)`)}
          </button>
        </div>
      </div>

      <style jsx>{`
        .bulk-modal { display: flex; flex-direction: column; gap: 1rem; }
        .bulk-hint {
          display: flex; align-items: flex-start; gap: 0.5rem;
          font-size: 0.82rem; color: var(--text-muted);
          background: var(--overlay-subtle); border: 1px solid var(--overlay-border);
          border-radius: 10px; padding: 0.7rem 0.85rem; line-height: 1.4;
        }
        .bulk-rows { display: flex; flex-direction: column; gap: 0.75rem; }
        .bulk-row {
          border: 1px solid var(--border-subtle); border-radius: 12px;
          padding: 0.75rem; background: var(--surface-2);
        }
        .bulk-row-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .bulk-row-index { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); }
        .bulk-row-remove {
          background: none; border: none; color: var(--text-disabled);
          cursor: pointer; padding: 0.3rem; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
        }
        .bulk-row-remove:hover:not(:disabled) { background: rgba(244,63,94,0.1); color: var(--color-error); }
        .bulk-row-remove:disabled { opacity: 0.3; cursor: not-allowed; }
        .bulk-row-fields {
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1.4fr; gap: 0.5rem;
        }
        .bulk-row-fields .input { min-height: 42px; }
        .bulk-row-error {
          display: flex; align-items: center; gap: 0.4rem;
          margin-top: 0.5rem; font-size: 0.78rem; color: var(--color-error);
        }
        .bulk-add-row-btn { display: flex; align-items: center; gap: 0.4rem; align-self: flex-start; }
        .bulk-summary {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.85rem; color: var(--color-success);
          background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2);
          border-radius: 10px; padding: 0.6rem 0.85rem;
        }

        @media (max-width: 640px) {
          .bulk-row-fields { grid-template-columns: 1fr; }
        }
      `}</style>
    </Modal>
  );
}
