'use client';

import { DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { ClientDebt } from '@/types';

const STATUS_STYLE: Record<string, { bg: string; border: string; badgeBg: string; color: string }> = {
  paid:    { bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)', badgeBg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  partial: { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', badgeBg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  pending: { bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)', badgeBg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
};

const STATUS_LABEL: Record<string, { fr: string; en: string }> = {
  paid: { fr: 'Réglé', en: 'Paid' },
  partial: { fr: 'Partiel', en: 'Partial' },
  pending: { fr: 'En attente', en: 'Pending' },
};

/**
 * Extrait de la carte de dette autrefois dupliquée en dur dans la fiche
 * client CRM — réutilisée telle quelle par CRM (showClientName=false,
 * comportement identique à avant) et par le nouveau module Dettes
 * Clients (showClientName=true, avec historique des versements dépliable).
 */
export function DebtCard({
  debt,
  language,
  onPay,
  showClientName = false,
}: {
  debt: ClientDebt;
  language: string;
  onPay?: (debt: ClientDebt) => void;
  showClientName?: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const style = STATUS_STYLE[debt.status] || STATUS_STYLE.pending;
  const label = STATUS_LABEL[debt.status] || STATUS_LABEL.pending;
  const hasPayments = (debt.payments?.length ?? 0) > 0;

  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: '8px', padding: '0.65rem 0.85rem',
      display: 'flex', flexDirection: 'column', gap: '0.3rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {showClientName ? debt.client_name : (debt.description || (language === 'fr' ? 'Vente à crédit' : 'Credit sale'))}
        </span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px',
          background: style.badgeBg, color: style.color,
        }}>
          {language === 'fr' ? label.fr : label.en}
        </span>
      </div>
      {showClientName && debt.description && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{debt.description}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          {language === 'fr' ? 'Montant initial' : 'Original'}: <strong>{debt.original_amount.toLocaleString()} GNF</strong>
        </span>
        <span style={{ color: debt.remaining_amount > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
          {language === 'fr' ? 'Reste' : 'Left'}: {debt.remaining_amount.toLocaleString()} GNF
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
        {debt.remaining_amount > 0 && onPay && (
          <button
            className="btn btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => onPay(debt)}
          >
            <DollarSign size={13} /> {language === 'fr' ? 'Enregistrer un règlement' : 'Record payment'}
          </button>
        )}
        {hasPayments && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            onClick={() => setShowHistory(v => !v)}
          >
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {language === 'fr' ? `Historique (${debt.payments!.length})` : `History (${debt.payments!.length})`}
          </button>
        )}
      </div>

      {showHistory && hasPayments && (
        <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.4rem' }}>
          {debt.payments!.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <span>{new Date(p.paid_at).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {p.paid_by_name ? `· ${p.paid_by_name}` : ''}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.amount.toLocaleString()} GNF</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
