'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Calendar, Filter } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDebtsQuery, useTeamQuery, type DebtsFilters } from '@/lib/queries';
import { DebtCard } from '@/components/debts/DebtCard';
import { DebtPaymentModal } from '@/components/debts/DebtPaymentModal';
import { toDateInput, today } from '@/lib/period';
import type { ClientDebt } from '@/types';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom' | '';

/** Même logique de presets calendaires que la page Ventes (voir
 *  sales/page.tsx) — dupliquée volontairement plutôt que factorisée en un
 *  utilitaire partagé, pour rester cohérent avec la décision déjà prise
 *  côté Ventes plutôt que d'introduire une nouvelle abstraction ici. */
function presetToRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  const to = toDateInput(now);
  switch (preset) {
    case 'today':
      return { from: to, to };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: toDateInput(y), to: toDateInput(y) };
    }
    case 'week': {
      const day = now.getDay() === 0 ? 7 : now.getDay();
      const monday = new Date(now); monday.setDate(now.getDate() - (day - 1));
      return { from: toDateInput(monday), to };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toDateInput(first), to };
    }
    case 'year': {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: toDateInput(first), to };
    }
    default:
      return null;
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' GNF';
}

export default function DettesPage() {
  const { language } = useLanguage();
  const { data: teamData } = useTeamQuery();
  const team = teamData ?? [];

  const [statusFilter, setStatusFilter] = useState('all');
  const [sellerId, setSellerId] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [payDebt, setPayDebt] = useState<ClientDebt | null>(null);

  // Débounce la recherche par nom client — évite une requête serveur à
  // chaque frappe, comme le filtrage produit/client au POS.
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setCurrentPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    setCurrentPage(1);
    const range = presetToRange(preset);
    if (range) {
      setDateFrom(range.from);
      setDateTo(range.to);
    } else if (preset !== 'custom') {
      setDateFrom('');
      setDateTo('');
    }
  };

  const filters: DebtsFilters = useMemo(() => ({
    statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
    sellerId: sellerId || undefined,
    search: search || undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
  }), [statusFilter, sellerId, search, dateFrom, dateTo]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, sellerId, dateFrom, dateTo]);

  const { data, isLoading } = useDebtsQuery(filters, currentPage, perPage);
  const debts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{language === 'fr' ? 'Dettes Clients' : 'Client Debts'}</h1>
          <p className="page-subtitle">
            {language === 'fr' ? 'Suivez et réglez les créances de vos clients.' : 'Track and settle your customer debts.'}
          </p>
        </div>
      </div>

      <div className="filters-bar card">
        <div className="filters-row">
          <div className="filter-group">
            <Search size={14} className="filter-icon" />
            <input
              className="input"
              type="text"
              placeholder={language === 'fr' ? 'Rechercher un client...' : 'Search a client...'}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <Filter size={14} className="filter-icon" />
            <select className="input" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
              <option value="all">{language === 'fr' ? 'Tous les statuts' : 'All statuses'}</option>
              <option value="pending">{language === 'fr' ? 'En attente' : 'Pending'}</option>
              <option value="partial">{language === 'fr' ? 'Partiel' : 'Partial'}</option>
              <option value="paid">{language === 'fr' ? 'Soldé' : 'Paid'}</option>
            </select>
          </div>

          <div className="filter-group">
            <select className="input" value={sellerId} onChange={e => { setSellerId(e.target.value); setCurrentPage(1); }}>
              <option value="">{language === 'fr' ? 'Tous les vendeurs' : 'All sellers'}</option>
              {team.map((m: any) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <Calendar size={14} className="filter-icon" />
            <select className="input" value={datePreset} onChange={e => applyPreset(e.target.value as DatePreset)}>
              <option value="">{language === 'fr' ? 'Toute période' : 'All time'}</option>
              <option value="today">{language === 'fr' ? "Aujourd'hui" : 'Today'}</option>
              <option value="yesterday">{language === 'fr' ? 'Hier' : 'Yesterday'}</option>
              <option value="week">{language === 'fr' ? 'Cette semaine' : 'This week'}</option>
              <option value="month">{language === 'fr' ? 'Ce mois' : 'This month'}</option>
              <option value="year">{language === 'fr' ? 'Cette année' : 'This year'}</option>
              <option value="custom">{language === 'fr' ? 'Personnalisée' : 'Custom'}</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <div className="filter-group">
              <input type="date" className="input" value={dateFrom} max={dateTo || today()} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }} />
              <span className="filter-separator">{language === 'fr' ? 'à' : 'to'}</span>
              <input type="date" className="input" value={dateTo} min={dateFrom} max={today()} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }} />
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        {isLoading && debts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : debts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {language === 'fr' ? 'Aucune dette trouvée.' : 'No debts found.'}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {debts.map(debt => (
                <DebtCard key={debt.id} debt={debt} language={language} onPay={setPayDebt} showClientName />
              ))}
            </div>

            <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0 0', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {language === 'fr' ? `Affichage de ${(currentPage - 1) * perPage + 1} à ${Math.min(currentPage * perPage, total)} sur ${total} dettes` : `Showing ${(currentPage - 1) * perPage + 1} to ${Math.min(currentPage * perPage, total)} of ${total} debts`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <select className="input" style={{ width: '80px' }} value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <button className="btn btn-ghost btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>
                  {language === 'fr' ? 'Précédent' : 'Previous'}
                </button>
                <button className="btn btn-ghost btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>
                  {language === 'fr' ? 'Suivant' : 'Next'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <DebtPaymentModal
        debt={payDebt}
        isOpen={!!payDebt}
        onClose={() => setPayDebt(null)}
        onSuccess={() => setPayDebt(null)}
        language={language}
      />

      <style jsx>{`
        .page { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .page-title { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin: 0; }
        .page-subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem; }

        .filters-bar { padding: 1.25rem; }
        .filters-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
        .filter-group { display: flex; align-items: center; gap: 0.5rem; background: var(--surface-0); border: 1px solid var(--border-subtle); padding: 0.25rem 0.75rem; border-radius: 8px; }
        .filter-icon { color: var(--text-muted); flex-shrink: 0; }
        .filter-separator { color: var(--text-muted); font-size: 0.85rem; }
        .filter-group .input { border: none; padding: 0.25rem 0; background: transparent; color: var(--text-primary); outline: none; font-size: 0.9rem; max-width: 200px; }
      `}</style>
    </div>
  );
}
