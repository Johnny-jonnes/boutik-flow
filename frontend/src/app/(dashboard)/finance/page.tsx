'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/context/LanguageContext';
import type {
  FinancialTransaction,
  FinanceSummary,
  TransactionType,
  TransactionCategory,
  PaymentMethod,
} from '@/types';

function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
}

const CATEGORY_LABELS: Record<string, string> = {
  sale: 'Vente',
  supplier_purchase: 'Achat fournisseur',
  salary: 'Salaire / Rémunération',
  rent: 'Loyer & Charges',
  utilities: 'Factures (Eau/Élec/Net)',
  refund: 'Remboursement',
  other_income: 'Autre revenu',
  other_expense: 'Autre dépense',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  orange_money: 'Orange Money',
  card: 'Carte bancaire',
  transfer: 'Virement bancaire',
};

const INCOME_CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: 'sale', label: 'Vente' },
  { value: 'other_income', label: 'Autre revenu' },
];

const EXPENSE_CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: 'supplier_purchase', label: 'Achat fournisseur' },
  { value: 'salary', label: 'Salaire / Rémunération' },
  { value: 'rent', label: 'Loyer & Charges' },
  { value: 'utilities', label: 'Factures (Eau, Électricité, Internet)' },
  { value: 'refund', label: 'Remboursement' },
  { value: 'other_expense', label: 'Autre dépense' },
];

export default function FinancePage() {
  const { t } = useLanguage();

  // Data states
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination states
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30j');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    type: TransactionType;
    category: string;
    amount: string;
    description: string;
    payment_method: PaymentMethod;
    reference: string;
  }>({
    type: 'income',
    category: 'sale',
    amount: '',
    description: '',
    payment_method: 'cash',
    reference: '',
  });

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const typeParam = selectedType !== 'all' ? selectedType : undefined;
      const categoryParam = selectedCategory !== 'all' ? selectedCategory : undefined;
      const periodParam = selectedPeriod !== 'all' ? selectedPeriod : 'all';

      const res = await api.getFinanceTransactions(
        page,
        perPage,
        typeParam,
        categoryParam,
        periodParam
      );

      setTransactions(res.items || []);
      setSummary(res.summary || null);
      setTotal(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err: any) {
      console.error('Error loading finance transactions:', err);
      toast.error(err?.message || 'Erreur lors du chargement des transactions');
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, selectedType, selectedCategory, selectedPeriod]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle Type toggle in Modal Form
  const handleTypeChange = (newType: TransactionType) => {
    const defaultCategory = newType === 'income' ? 'sale' : 'supplier_purchase';
    setFormData((prev) => ({
      ...prev,
      type: newType,
      category: defaultCategory,
    }));
  };

  const handleOpenModal = () => {
    setFormData({
      type: 'income',
      category: 'sale',
      amount: '',
      description: '',
      payment_method: 'cash',
      reference: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(formData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Veuillez saisir un montant valide supérieur à 0');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('La description est requise');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createFinanceTransaction({
        type: formData.type,
        category: formData.category,
        amount: numericAmount,
        description: formData.description.trim(),
        payment_method: formData.payment_method,
        reference: formData.reference.trim() || undefined,
      });

      toast.success(
        formData.type === 'income'
          ? 'Entrée d\'argent enregistrée avec succès !'
          : 'Dépense enregistrée avec succès !'
      );
      setIsModalOpen(false);
      fetchTransactions();
    } catch (err: any) {
      console.error('Create transaction error:', err);
      toast.error(err?.message || 'Erreur lors de la création de la transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Local search filtering on description or reference
  const filteredTransactions = transactions.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      (t.reference && t.reference.toLowerCase().includes(q)) ||
      (CATEGORY_LABELS[t.category] || t.category).toLowerCase().includes(q)
    );
  });

  return (
    <div className="page fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.finance') || 'Finance & Trésorerie'}</h1>
          <p className="page-subtitle">
            Suivez vos entrées, dépenses et le solde net de votre boutique.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Nouvelle Transaction
          </button>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="kpi-grid">
        {/* Total Revenus */}
        <div className="kpi-card kpi-income">
          <div className="kpi-header">
            <span className="kpi-label">Total Revenus</span>
            <div className="kpi-icon kpi-icon-green">
              <ArrowDownLeft size={20} />
            </div>
          </div>
          <div className="kpi-value text-green">
            {formatGNF(summary?.total_income ?? 0)}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Entrées brutes enregistrées</span>
          </div>
        </div>

        {/* Total Dépenses */}
        <div className="kpi-card kpi-expense">
          <div className="kpi-header">
            <span className="kpi-label">Total Dépenses</span>
            <div className="kpi-icon kpi-icon-red">
              <ArrowUpRight size={20} />
            </div>
          </div>
          <div className="kpi-value text-red">
            {formatGNF(summary?.total_expense ?? 0)}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Dépenses totales sorties</span>
          </div>
        </div>

        {/* Solde Net */}
        <div className="kpi-card kpi-net">
          <div className="kpi-header">
            <span className="kpi-label">Solde Net</span>
            <div className="kpi-icon kpi-icon-blue">
              <Wallet size={20} />
            </div>
          </div>
          <div
            className={`kpi-value ${
              (summary?.net_balance ?? 0) >= 0 ? 'text-blue' : 'text-red'
            }`}
          >
            {formatGNF(summary?.net_balance ?? 0)}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">
              {summary?.transactions_count ?? 0} transaction(s) au total
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="filters-bar card">
        <div className="filters-left">
          {/* Period Filter Tabs */}
          <div className="period-pills">
            {[
              { id: '7j', label: '7 jours' },
              { id: '30j', label: '30 jours' },
              { id: '90j', label: '90 jours' },
              { id: 'all', label: 'Tout' },
              { id: 'custom', label: 'Personnalisé' },
            ].map((p) => (
              <button
                key={p.id}
                className={`pill-btn ${selectedPeriod === p.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedPeriod(p.id);
                  setPage(1);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="filter-select-wrapper">
            <Filter size={15} className="filter-icon" />
            <select
              className="select-input"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Tous les types</option>
              <option value="income">Entrées (+)</option>
              <option value="expense">Sorties (-)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="filter-select-wrapper">
            <Layers size={15} className="filter-icon" />
            <select
              className="select-input"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Toutes les catégories</option>
              <option value="sale">Vente</option>
              <option value="other_income">Autre revenu</option>
              <option value="supplier_purchase">Achat fournisseur</option>
              <option value="salary">Salaire / Rémunération</option>
              <option value="rent">Loyer & Charges</option>
              <option value="utilities">Factures (Eau/Élec/Net)</option>
              <option value="refund">Remboursement</option>
              <option value="other_expense">Autre dépense</option>
            </select>
          </div>
        </div>

        <div className="filters-right">
          {/* Search Box */}
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="input search-input"
              placeholder="Rechercher par description, réf..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date & Heure</th>
              <th>Type</th>
              <th>Catégorie</th>
              <th>Description / Réf</th>
              <th>Mode de Paiement</th>
              <th className="text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="spinner-container">
                    <div className="spinner" />
                    <span className="text-muted">Chargement des transactions...</span>
                  </div>
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted">
                  Aucune transaction trouvée pour cette période.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isIncome = tx.type === 'income';
                return (
                  <tr key={tx.id}>
                    {/* Date */}
                    <td>
                      <div className="date-cell">
                        <span className="date-main">
                          {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="date-sub">
                          {new Date(tx.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td>
                      <span className={`badge-type ${isIncome ? 'badge-income' : 'badge-expense'}`}>
                        {isIncome ? (
                          <>
                            <ArrowDownLeft size={13} /> Entrée
                          </>
                        ) : (
                          <>
                            <ArrowUpRight size={13} /> Sortie
                          </>
                        )}
                      </span>
                    </td>

                    {/* Catégorie */}
                    <td>
                      <span className="category-tag">
                        {CATEGORY_LABELS[tx.category] || tx.category}
                      </span>
                    </td>

                    {/* Description */}
                    <td>
                      <div className="desc-cell">
                        <span className="desc-text">{tx.description}</span>
                        {tx.reference && (
                          <span className="ref-tag">Réf: {tx.reference}</span>
                        )}
                      </div>
                    </td>

                    {/* Payment Method */}
                    <td>
                      <span className="payment-method-badge">
                        {PAYMENT_METHOD_LABELS[tx.payment_method] || tx.payment_method}
                      </span>
                    </td>

                    {/* Montant */}
                    <td className="text-right">
                      <span
                        className={`amount-text ${
                          isIncome ? 'amount-income' : 'amount-expense'
                        }`}
                      >
                        {isIncome ? '+' : '-'} {formatGNF(Number(tx.amount))}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {!isLoading && total > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              <span>
                Affichage de {filteredTransactions.length} sur {total} transaction(s) — Page{' '}
                {page} sur {totalPages}
              </span>
            </div>

            <div className="pagination-controls">
              <div className="per-page-select">
                <span className="per-page-label">Afficher</span>
                <select
                  className="select-input select-sm"
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="nav-buttons">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} /> Précédent
                </button>

                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Add New Transaction */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nouvelle Transaction Financière"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Type Toggle Selector */}
          <div className="type-toggle-container">
            <button
              type="button"
              className={`type-toggle-btn type-income ${
                formData.type === 'income' ? 'active' : ''
              }`}
              onClick={() => handleTypeChange('income')}
            >
              <ArrowDownLeft size={18} />
              <span>Entrée (Revenu)</span>
            </button>
            <button
              type="button"
              className={`type-toggle-btn type-expense ${
                formData.type === 'expense' ? 'active' : ''
              }`}
              onClick={() => handleTypeChange('expense')}
            >
              <ArrowUpRight size={18} />
              <span>Sortie (Dépense)</span>
            </button>
          </div>

          <div className="form-grid">
            {/* Category Select */}
            <div className="form-group">
              <label className="form-label">Catégorie *</label>
              <select
                className="input"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {formData.type === 'income'
                  ? INCOME_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))
                  : EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
              </select>
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label">Montant (GNF) *</label>
              <input
                type="number"
                min="1"
                step="any"
                className="input"
                placeholder="ex: 150000"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label">Mode de Paiement *</label>
              <select
                className="input"
                required
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_method: e.target.value as PaymentMethod,
                  })
                }
              >
                <option value="cash">Espèces</option>
                <option value="orange_money">Orange Money</option>
                <option value="card">Carte bancaire</option>
                <option value="transfer">Virement bancaire</option>
              </select>
            </div>

            {/* Reference */}
            <div className="form-group">
              <label className="form-label">Référence / N° de reçu (Optionnel)</label>
              <input
                type="text"
                className="input"
                placeholder="ex: REC-00921"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="form-group full-width">
              <label className="form-label">Description *</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Détails de la transaction (ex: Vente directe en caisse, Achat de stock...)"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsModalOpen(false)}
            >
              {t('common.cancel') || 'Annuler'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? t('common.saving') || 'Enregistrement...'
                : 'Enregistrer la transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Styled Component CSS */}
      <style jsx>{`
        .page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .page-title {
          font-size: 1.75rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
          color: var(--text-primary);
        }

        .page-subtitle {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
        }

        /* KPI Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.25rem;
        }

        .kpi-card {
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 1.35rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: all 0.2s ease;
        }

        .kpi-card:hover {
          border-color: var(--border-default);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.1));
        }

        .kpi-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kpi-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .kpi-icon {
          padding: 0.6rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kpi-icon-green {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
        }

        .kpi-icon-red {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
        }

        .kpi-icon-blue {
          background: rgba(59, 130, 246, 0.12);
          color: #3b82f6;
        }

        .kpi-value {
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .text-green {
          color: #10b981;
        }

        .text-red {
          color: #ef4444;
        }

        .text-blue {
          color: #3b82f6;
        }

        .kpi-footer {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Toolbar & Filters */
        .filters-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1rem;
        }

        .filters-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .period-pills {
          display: flex;
          background: var(--overlay-subtle, rgba(255, 255, 255, 0.05));
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          padding: 0.25rem;
          gap: 0.25rem;
        }

        .pill-btn {
          padding: 0.4rem 0.8rem;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
          transition: all 0.15s ease;
        }

        .pill-btn:hover {
          color: var(--text-primary);
        }

        .pill-btn.active {
          background: var(--surface-hover, rgba(255, 255, 255, 0.1));
          color: var(--color-brand-500, #10b981);
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .filter-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .filter-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--text-muted);
          pointer-events: none;
        }

        .select-input {
          padding: 0.45rem 0.875rem 0.45rem 2.25rem;
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-1);
          color: var(--text-primary);
          font-size: 0.85rem;
          outline: none;
          cursor: pointer;
        }

        .select-input:focus {
          border-color: var(--color-brand-500, #10b981);
        }

        .filters-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .search-box {
          position: relative;
          min-width: 260px;
        }

        .search-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .search-input {
          padding-left: 2.5rem;
          width: 100%;
        }

        /* Table Container */
        .table-container {
          padding: 0;
          overflow-x: auto;
          border-radius: 16px;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .data-table th,
        .data-table td {
          padding: 0.95rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
        }

        .data-table th {
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--surface-1);
        }

        .data-table tr:hover td {
          background: var(--surface-hover);
        }

        .data-table tr:last-child td {
          border-bottom: none;
        }

        .date-cell {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .date-main {
          font-weight: 600;
          font-size: 0.88rem;
          color: var(--text-primary);
        }

        .date-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .badge-type {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.65rem;
          border-radius: 20px;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .badge-income {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .badge-expense {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .category-tag {
          font-size: 0.85rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .desc-cell {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .desc-text {
          font-size: 0.88rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .ref-tag {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .payment-method-badge {
          display: inline-block;
          padding: 0.2rem 0.55rem;
          border-radius: 6px;
          background: var(--overlay-subtle, rgba(255, 255, 255, 0.06));
          border: 1px solid var(--border-subtle);
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .amount-text {
          font-weight: 700;
          font-size: 0.95rem;
        }

        .amount-income {
          color: #10b981;
        }

        .amount-expense {
          color: #ef4444;
        }

        /* Spinner & Empty State */
        .spinner-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(16, 185, 129, 0.15);
          border-top-color: #10b981;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* Pagination Bar */
        .pagination-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border-subtle);
          background: var(--surface-1);
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .pagination-info {
          font-size: 0.82rem;
          color: var(--text-muted);
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .per-page-select {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .per-page-label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .select-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.8rem;
        }

        .nav-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .btn-sm {
          padding: 0.35rem 0.75rem;
          font-size: 0.8rem;
        }

        /* Modal Styles */
        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .type-toggle-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .type-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: var(--surface-1);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .type-toggle-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-default);
        }

        .type-income.active {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border-color: #10b981;
        }

        .type-expense.active {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border-color: #ef4444;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .full-width {
          grid-column: span 2;
        }

        .form-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .text-right {
          text-align: right;
        }

        .text-center {
          text-align: center;
        }

        .py-12 {
          padding: 3rem 0;
        }

        @media (max-width: 640px) {
          .filters-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .filters-left,
          .filters-right {
            width: 100%;
          }

          .search-box {
            width: 100%;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}
