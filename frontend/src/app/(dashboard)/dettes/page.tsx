'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Calendar, CreditCard, Wallet, HandCoins, Percent, AlertCircle, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Banknote, UserCog, WifiOff, SearchX,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDebtsQuery, useTeamQuery, type DebtsFilters } from '@/lib/queries';
import { api } from '@/lib/api/client';
import { DebtPaymentModal } from '@/components/debts/DebtPaymentModal';
import { PageHeader, StatTile, type StatTone } from '@/components/ui/PageHeader';
import { toDateInput, today } from '@/lib/period';
import { formatGNF, formatNumber, formatRelativeDay, hueFromString, initials } from '@/lib/format';
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

const STATUS: Record<ClientDebt['status'], { fr: string; en: string; tone: StatTone }> = {
  pending: { fr: 'En attente', en: 'Pending', tone: 'amber' },
  partial: { fr: 'Partiel', en: 'Partial', tone: 'sky' },
  paid: { fr: 'Soldée', en: 'Paid', tone: 'emerald' },
};

/** Ligne de dette : client, progression du remboursement, montants, action d'encaissement. */
function DebtRow({ debt, language, onPay }: { debt: ClientDebt; language: string; onPay: (d: ClientDebt) => void }) {
  const fr = language === 'fr';
  const [open, setOpen] = useState(false);
  const status = STATUS[debt.status] ?? STATUS.pending;
  const paidPct = debt.original_amount > 0 ? (debt.paid_amount / debt.original_amount) * 100 : 0;
  const payments = debt.payments ?? [];
  return (
    <article className="debt-row">
      <span className="bf-avatar" style={{ '--hue': hueFromString(debt.client_name) } as React.CSSProperties}>{initials(debt.client_name)}</span>
      <div className="debt-main">
        <span className="bf-name">{debt.client_name}</span>
        <span className="bf-sub">
          {debt.description || (fr ? 'Vente à crédit' : 'Credit sale')} · {formatRelativeDay(debt.created_at, language)}
        </span>
      </div>
      <div className="debt-progress bf-meter" data-tone={status.tone}>
        <div className="bf-meter__track"><div className="bf-meter__bar" style={{ width: `${Math.min(100, paidPct)}%` }} /></div>
        <span className="bf-sub">{Math.round(paidPct)} % {fr ? 'réglé' : 'paid'} · {formatGNF(debt.paid_amount)}</span>
      </div>
      <div className="debt-amounts">
        <span className="bf-money" style={{ color: debt.remaining_amount > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
          {formatGNF(debt.remaining_amount)}
        </span>
        <span className="bf-sub">{fr ? 'sur' : 'of'} {formatGNF(debt.original_amount)}</span>
      </div>
      <div className="debt-actions">
        <span className="bf-badge" data-tone={status.tone}><span className="bf-badge__dot" />{fr ? status.fr : status.en}</span>
        {payments.length > 0 && (
          <button type="button" className="bf-icon-btn" onClick={() => setOpen(v => !v)} aria-expanded={open}
            title={fr ? 'Historique des versements' : 'Payment history'} aria-label={fr ? 'Historique des versements' : 'Payment history'}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
        {debt.remaining_amount > 0 && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onPay(debt)}>
            <Banknote size={14} /> {fr ? 'Encaisser' : 'Collect'}
          </button>
        )}
      </div>
      {open && payments.length > 0 && (
        <div className="debt-history">
          {payments.map(p => (
            <div key={p.id} className="debt-history-row">
              <span>{new Date(p.paid_at).toLocaleString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{p.paid_by_name ? ` · ${p.paid_by_name}` : ''}</span>
              <strong>{formatGNF(p.amount)}</strong>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function DettesPage() {
  const { language } = useLanguage();
  const fr = language === 'fr';
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

  const { data, isLoading, isError, refetch } = useDebtsQuery(filters, currentPage, perPage);
  const debts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  // Synthèse globale (toutes les dettes, sans pagination) — la clé commence
  // par 'debts-list' pour être rafraîchie par QueryProvider après chaque
  // versement (événement boutikflow:debt-paid), comme la liste.
  const { data: allDebts } = useQuery({
    queryKey: ['debts-list', 'summary'],
    queryFn: () => api.getDebts(),
  });
  const summary = useMemo(() => {
    const list = Array.isArray(allDebts) ? allDebts : [];
    let remaining = 0, paid = 0, original = 0, open = 0;
    const debtors = new Set<string>();
    for (const d of list) {
      remaining += Number(d.remaining_amount) || 0;
      paid += Number(d.paid_amount) || 0;
      original += Number(d.original_amount) || 0;
      if (d.status !== 'paid') { open++; debtors.add(d.client_id); }
    }
    return { remaining, paid, open, debtors: debtors.size, rate: original > 0 ? (paid / original) * 100 : 0 };
  }, [allDebts]);

  const setStatus = (st: string) => { setStatusFilter(st); setCurrentPage(1); };

  return (
    <div className="bf-page fade-in">
      <PageHeader
        icon={CreditCard}
        title={fr ? 'Dettes clients' : 'Client debts'}
        subtitle={fr ? 'Suivez et réglez les créances de vos clients.' : 'Track and settle your customer debts.'}
      />

      <section className="bf-stats">
        <StatTile tone="rose" icon={AlertCircle} label={fr ? 'Reste à encaisser' : 'Outstanding'} value={formatNumber(summary.remaining)} suffix="GNF"
          hint={<><strong>{formatNumber(summary.debtors)}</strong> {fr ? 'client(s) débiteur(s)' : 'debtor(s)'}</>} />
        <StatTile tone="emerald" icon={HandCoins} label={fr ? 'Déjà encaissé' : 'Collected'} value={formatNumber(summary.paid)} suffix="GNF"
          hint={fr ? 'Versements reçus' : 'Payments received'} />
        <StatTile tone="amber" icon={Wallet} label={fr ? 'Dettes ouvertes' : 'Open debts'} value={formatNumber(summary.open)}
          hint={fr ? 'En attente ou partielles' : 'Pending or partial'} />
        <StatTile tone="sky" icon={Percent} label={fr ? 'Taux de recouvrement' : 'Recovery rate'} value={`${Math.round(summary.rate)} %`}
          hint={fr ? 'Du montant total prêté' : 'Of the total lent'} />
      </section>

      <section className="bf-toolbar">
        <div className="bf-search">
          <Search size={18} />
          <input type="text" placeholder={fr ? 'Rechercher un client...' : 'Search a client...'} value={searchInput}
            onChange={e => setSearchInput(e.target.value)} />
        </div>
        <div className="bf-select-wrap">
          <select className={`bf-select ${sellerId ? 'bf-select--active' : ''}`} value={sellerId}
            onChange={e => { setSellerId(e.target.value); setCurrentPage(1); }} aria-label={fr ? 'Vendeur' : 'Seller'}>
            <option value="">{fr ? 'Tous les vendeurs' : 'All sellers'}</option>
            {team.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
          </select>
          <UserCog size={15} />
        </div>
        <div className="bf-select-wrap">
          <select className={`bf-select ${datePreset ? 'bf-select--active' : ''}`} value={datePreset}
            onChange={e => applyPreset(e.target.value as DatePreset)} aria-label={fr ? 'Période' : 'Period'}>
            <option value="">{fr ? 'Toute période' : 'All time'}</option>
            <option value="today">{fr ? "Aujourd'hui" : 'Today'}</option>
            <option value="yesterday">{fr ? 'Hier' : 'Yesterday'}</option>
            <option value="week">{fr ? 'Cette semaine' : 'This week'}</option>
            <option value="month">{fr ? 'Ce mois' : 'This month'}</option>
            <option value="year">{fr ? 'Cette année' : 'This year'}</option>
            <option value="custom">{fr ? 'Personnalisée' : 'Custom'}</option>
          </select>
          <Calendar size={15} />
        </div>
        {datePreset === 'custom' && (
          <div className="custom-range">
            <input type="date" className="input" value={dateFrom} max={dateTo || today()} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }} />
            <span>{fr ? 'à' : 'to'}</span>
            <input type="date" className="input" value={dateTo} min={dateFrom} max={today()} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }} />
          </div>
        )}
        <div className="bf-chips" style={{ flexBasis: '100%' }} role="tablist">
          {(['all', 'pending', 'partial', 'paid'] as const).map(st => (
            <button key={st} type="button" role="tab" aria-selected={statusFilter === st}
              className={`bf-chip ${statusFilter === st ? 'bf-chip--active' : ''}`} onClick={() => setStatus(st)}>
              {st === 'all' ? (fr ? 'Toutes' : 'All') : (fr ? STATUS[st].fr : STATUS[st].en)}
            </button>
          ))}
        </div>
      </section>

      <section className="bf-panel">
        <div className="bf-panel__head">
          <span className="bf-panel__title">{fr ? 'Créances' : 'Receivables'} <span className="bf-count">{formatNumber(total)}</span></span>
        </div>

        {isLoading && debts.length === 0 ? (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[1, 2, 3].map(i => <div key={i} className="bf-skeleton" style={{ height: 64 }} />)}
          </div>
        ) : isError && debts.length === 0 ? (
          <div className="bf-empty">
            <span className="bf-empty__icon"><WifiOff size={24} /></span>
            <strong>{fr ? 'Impossible de charger les dettes.' : 'Unable to load debts.'}</strong>
            <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>{fr ? 'Réessayer' : 'Retry'}</button>
          </div>
        ) : debts.length === 0 ? (
          <div className="bf-empty">
            <span className="bf-empty__icon"><SearchX size={24} /></span>
            <strong>{fr ? 'Aucune dette trouvée' : 'No debts found'}</strong>
            <span>{fr ? 'Les ventes à crédit apparaîtront ici.' : 'Credit sales will show up here.'}</span>
          </div>
        ) : (
          <>
            <div className="debt-list">
              {debts.map(debt => <DebtRow key={debt.id} debt={debt} language={language} onPay={setPayDebt} />)}
            </div>
            <div className="bf-pager">
              <span className="bf-pager__info">
                <strong>{(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, total)}</strong>
                {fr ? ' sur ' : ' of '}<strong>{formatNumber(total)}</strong> {fr ? 'dettes' : 'debts'}
              </span>
              <div className="bf-pager__controls">
                <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setCurrentPage(1); }} aria-label={fr ? 'Dettes par page' : 'Debts per page'}>
                  <option value={15}>15 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
                <button type="button" className="bf-icon-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} aria-label={fr ? 'Page précédente' : 'Previous page'}>
                  <ChevronLeft size={16} />
                </button>
                <span className="bf-pager__page">{currentPage} / {Math.max(totalPages, 1)}</span>
                <button type="button" className="bf-icon-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} aria-label={fr ? 'Page suivante' : 'Next page'}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <DebtPaymentModal
        debt={payDebt}
        isOpen={!!payDebt}
        onClose={() => setPayDebt(null)}
        onSuccess={() => setPayDebt(null)}
        language={language}
      />

      <style jsx global>{`
        .debt-list { display: flex; flex-direction: column; }
        .debt-row {
          display: grid;
          grid-template-columns: auto minmax(0, 1.4fr) minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 0.6rem 1.1rem;
          padding: 0.9rem 1.2rem;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.12s ease;
        }
        .debt-row:last-child { border-bottom: none; }
        .debt-row:hover { background: var(--surface-hover); }
        .debt-main { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
        .debt-progress { min-width: 0; }
        .debt-amounts { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; text-align: right; }
        .debt-actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; }
        .debt-history {
          grid-column: 2 / -1;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 0.6rem 0.8rem;
          border-radius: 12px;
          background: var(--surface-2);
          border: 1px dashed var(--border-default);
        }
        .debt-history-row { display: flex; justify-content: space-between; gap: 0.75rem; font-size: 0.78rem; color: var(--text-muted); }
        .debt-history-row strong { color: var(--text-primary); white-space: nowrap; }
        .custom-range { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .custom-range input { width: auto; min-height: 42px; }
        .custom-range span { color: var(--text-muted); font-size: 0.85rem; }

        @media (max-width: 1023px) {
          .debt-row {
            grid-template-columns: auto minmax(0, 1fr) auto;
            grid-template-areas:
              'avatar main amounts'
              'progress progress progress'
              'actions actions actions';
            padding: 0.95rem 1rem;
          }
          .debt-row > .bf-avatar { grid-area: avatar; }
          .debt-main { grid-area: main; }
          .debt-amounts { grid-area: amounts; }
          .debt-progress { grid-area: progress; }
          .debt-actions { grid-area: actions; justify-content: space-between; }
          .debt-actions .btn { margin-left: auto; }
          .debt-history { grid-column: 1 / -1; }
        }
        @media (max-width: 768px) {
          .custom-range { width: 100%; }
          .custom-range input { flex: 1; min-width: 0; font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
