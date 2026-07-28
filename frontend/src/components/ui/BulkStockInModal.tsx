'use client';

import { useState, useMemo } from 'react';
import { Search, PackagePlus, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import type { Product } from '@/types';

interface BulkStockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onUpdated: () => void;
}

export function BulkStockInModal({ isOpen, onClose, products, onUpdated }: BulkStockInModalProps) {
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [searchQuery, setSearchQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ updatedCount: number; errors: { index: number; product_id: string; error: string }[] } | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  const selectedEntries = Object.entries(quantities).filter(([, v]) => v.trim() && Number(v) > 0);
  const selectedCount = selectedEntries.length;

  const setQty = (id: string, value: string) => {
    setQuantities(prev => ({ ...prev, [id]: value }));
  };

  const reset = () => {
    setQuantities({});
    setSearchQuery('');
    setReason('');
    setResult(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (selectedCount === 0) {
      toast.error(fr ? 'Indiquez une quantité pour au moins un produit' : 'Enter a quantity for at least one product');
      return;
    }

    const items = selectedEntries.map(([product_id, qty]) => ({ product_id, quantity: Number(qty) }));

    setIsSubmitting(true);
    try {
      const res = await api.bulkStockIn(items, reason.trim() || undefined);
      setResult({ updatedCount: res.updated.length, errors: res.errors });
      if (res.errors.length === 0) {
        toast.success(
          fr ? `Stock mis à jour pour ${res.updated.length} produit(s)` : `Stock updated for ${res.updated.length} product(s)`
        );
        onUpdated();
        reset();
        onClose();
      } else {
        toast.warning(
          fr
            ? `${res.updated.length} mis à jour, ${res.errors.length} en erreur — voir le détail ci-dessous`
            : `${res.updated.length} updated, ${res.errors.length} failed — see details below`
        );
        onUpdated();
      }
    } catch (err: any) {
      toast.error(err.message || (fr ? "Erreur lors de l'entrée de stock groupée" : 'Error during bulk stock-in'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={fr ? 'Entrée de stock groupée' : 'Bulk stock-in'} maxWidth="640px">
      <div className="bsi-modal">
        <p className="bsi-hint">
          <PackagePlus size={14} />
          {fr
            ? "Indiquez la quantité reçue pour chaque produit concerné (ex: après une livraison fournisseur) — elle s'ajoute au stock actuel, sans l'écraser."
            : 'Enter the quantity received for each relevant product (e.g. after a supplier delivery) — it adds to the current stock, without overwriting it.'}
        </p>

        <div className="bsi-search">
          <Search size={16} />
          <input
            className="input"
            placeholder={fr ? 'Rechercher un produit...' : 'Search a product...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="bsi-list">
          {filtered.length === 0 && (
            <div className="bsi-empty">{fr ? 'Aucun produit trouvé.' : 'No product found.'}</div>
          )}
          {filtered.map((p, i) => {
            const err = result?.errors.find(e => e.product_id === p.id);
            const active = !!quantities[p.id]?.trim() && Number(quantities[p.id]) > 0;
            return (
              <div key={p.id} className={`bsi-row ${active ? 'bsi-row--active' : ''}`}>
                <div className="bsi-row-info">
                  <span className="bsi-row-name">{p.name}</span>
                  <span className="bsi-row-stock">{fr ? 'Stock actuel' : 'Current stock'} : {p.stock}</span>
                </div>
                <div className="bsi-row-input">
                  <span className="bsi-row-plus">+</span>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    placeholder="0"
                    value={quantities[p.id] || ''}
                    onChange={e => setQty(p.id, e.target.value)}
                  />
                </div>
                {err && (
                  <div className="bsi-row-error">
                    <AlertTriangle size={12} /> {err.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="form-group">
          <label className="form-label">{fr ? 'Motif (facultatif)' : 'Reason (optional)'}</label>
          <input
            className="input"
            placeholder={fr ? 'Ex: Livraison fournisseur Kaba & Fils' : 'E.g. Supplier delivery'}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        {result && (
          <div className="bsi-summary">
            <CheckCircle size={14} />
            {fr
              ? `${result.updatedCount} produit(s) mis à jour${result.errors.length ? `, ${result.errors.length} en erreur` : ''}.`
              : `${result.updatedCount} product(s) updated${result.errors.length ? `, ${result.errors.length} failed` : ''}.`}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={isSubmitting}>
            {fr ? 'Fermer' : 'Close'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting || selectedCount === 0}>
            {isSubmitting
              ? (fr ? 'Enregistrement…' : 'Saving…')
              : (fr ? `Valider (${selectedCount})` : `Confirm (${selectedCount})`)}
          </button>
        </div>
      </div>

      <style jsx>{`
        .bsi-modal { display: flex; flex-direction: column; gap: 1rem; }
        .bsi-hint {
          display: flex; align-items: flex-start; gap: 0.5rem;
          font-size: 0.82rem; color: var(--text-muted);
          background: var(--overlay-subtle); border: 1px solid var(--overlay-border);
          border-radius: 10px; padding: 0.7rem 0.85rem; line-height: 1.4;
        }
        .bsi-search {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0 0.75rem; border: 1px solid var(--border-default);
          border-radius: 10px; background: var(--surface-2); color: var(--text-muted);
        }
        .bsi-search .input { border: none; background: none; padding-left: 0; }
        .bsi-list {
          display: flex; flex-direction: column; gap: 0.5rem;
          max-height: 320px; overflow-y: auto; padding-right: 2px;
        }
        .bsi-empty { text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem; }
        .bsi-row {
          display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
          border: 1px solid var(--border-subtle); border-radius: 10px;
          padding: 0.55rem 0.75rem; background: var(--surface-2);
          transition: border-color 0.15s ease, background 0.15s ease;
          flex-wrap: wrap;
        }
        .bsi-row--active { border-color: var(--color-brand-500); background: var(--brand-alpha-08); }
        .bsi-row-info { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
        .bsi-row-name { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
        .bsi-row-stock { font-size: 0.72rem; color: var(--text-muted); }
        .bsi-row-input { display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0; }
        .bsi-row-plus { font-weight: 800; color: var(--color-brand-500); font-size: 0.9rem; }
        .bsi-row-input .input { width: 80px; min-height: 38px; text-align: center; padding: 0.4rem; }
        .bsi-row-error {
          width: 100%;
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.72rem; color: var(--color-error);
        }
        .bsi-summary {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.85rem; color: var(--color-success);
          background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2);
          border-radius: 10px; padding: 0.6rem 0.85rem;
        }
      `}</style>
    </Modal>
  );
}
