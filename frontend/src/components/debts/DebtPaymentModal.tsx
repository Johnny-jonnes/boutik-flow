'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import type { ClientDebt, DebtPaymentEntry } from '@/types';
import { celebrate } from '@/lib/celebrate';
import { formatGNF } from '@/lib/format';
import { DebtReceiptModal } from '@/components/debts/DebtReceiptModal';

type ReceiptState = { debt: ClientDebt; payment: DebtPaymentEntry };

/**
 * Dette et versement tels qu'enregistrés (numéro, « encaissé par »…) ;
 * repli sur l'état calculé localement si la relecture échoue (hors-ligne).
 */
async function latestReceipt(local: ReceiptState): Promise<ReceiptState> {
  try {
    const fresh = (await api.getDebts(local.debt.client_id)).find(d => d.id === local.debt.id);
    const newest = [...(fresh?.payments ?? [])].sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at))[0];
    if (fresh && newest && Math.abs(Number(newest.amount) - Number(local.payment.amount)) < 0.5) {
      return { debt: fresh, payment: newest };
    }
  } catch {
    // Reçu construit localement.
  }
  return local;
}

/**
 * Extrait du modal de règlement autrefois dupliqué en dur dans crm/page.tsx
 * — réutilisé tel quel par la fiche client CRM et par le nouveau module
 * Dettes Clients, pour que les deux ne puissent jamais diverger.
 */
export function DebtPaymentModal({
  debt,
  isOpen,
  onClose,
  onSuccess,
  language,
}: {
  debt: ClientDebt | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  language: string;
}) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Reçu affiché après chaque versement (le récapitulatif quand la dette est soldée).
  const [receipt, setReceipt] = useState<ReceiptState | null>(null);

  useEffect(() => {
    if (debt) {
      setAmount(String(debt.remaining_amount));
      setPaymentMethod('cash');
      setNotes('');
    }
  }, [debt]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt || isSubmitting) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error(language === 'fr' ? 'Veuillez entrer un montant valide supérieur à 0.' : 'Please enter a valid amount greater than 0.');
      return;
    }
    // Garde-fou client — jamais de dépassement possible (demande 11) ;
    // le serveur revérifie de toute façon (voir record_payment).
    if (amountNum > debt.remaining_amount) {
      toast.error(language === 'fr' ? `Le montant dépasse le solde restant (${debt.remaining_amount.toLocaleString()} GNF)` : `Amount exceeds the remaining balance (${debt.remaining_amount.toLocaleString()} GNF)`);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.recordDebtPayment(debt.id, {
        amount: amountNum,
        payment_method: paymentMethod,
        notes: notes || undefined,
      });
      const fr = language === 'fr';
      const remaining = typeof res?.remaining_amount === 'number'
        ? Math.max(0, res.remaining_amount)
        : Math.max(0, Number(debt.remaining_amount) - amountNum);
      const original = Number(debt.original_amount) || 0;
      const progress = original > 0 ? Math.round(((original - remaining) / original) * 100) : 100;
      celebrate(remaining <= 0
        ? {
            kind: 'debt-paid',
            title: fr ? 'Dette soldée !' : 'Debt fully paid!',
            subtitle: fr ? `${debt.client_name} a tout réglé` : `${debt.client_name} paid in full`,
            chips: [formatGNF(original)],
            progress: 100,
          }
        : {
            kind: 'debt',
            title: fr ? 'Versement enregistré' : 'Payment recorded',
            subtitle: fr ? `${formatGNF(amountNum)} de ${debt.client_name}` : `${formatGNF(amountNum)} from ${debt.client_name}`,
            chips: [fr ? `${progress} % réglé` : `${progress}% paid`, fr ? `Reste ${formatGNF(remaining)}` : `Left ${formatGNF(remaining)}`],
            progress,
          });
      // Signal explicite, sur le même modèle que boutikflow:order-created —
      // permet à QueryProvider d'invalider les caches Dettes/Finance/
      // Dashboard immédiatement, sans attendre une synchronisation.
      window.dispatchEvent(new CustomEvent('boutikflow:debt-paid', { detail: { debtId: debt.id, amount: amountNum } }));
      onSuccess();

      // Reçu à remettre au client : il s'ouvre sous l'animation et
      // apparaît dès qu'elle se termine.
      const entry: DebtPaymentEntry = {
        id: `local-${Date.now()}`,
        amount: amountNum,
        payment_method: paymentMethod,
        notes: notes || null,
        paid_at: new Date().toISOString(),
        paid_by_name: null,
        balance_before: Number(debt.remaining_amount),
        balance_after: remaining,
      };
      setReceipt(await latestReceipt({
        debt: {
          ...debt,
          paid_amount: Number(debt.paid_amount) + amountNum,
          remaining_amount: remaining,
          status: remaining <= 0 ? 'paid' : 'partial',
          payments: [entry, ...(debt.payments ?? [])],
        },
        payment: entry,
      }));
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? 'Erreur lors du règlement' : 'Error recording payment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleClose} title={language === 'fr' ? 'Enregistrer un règlement' : 'Record Payment'}>
      {debt && (
        <form onSubmit={handleSubmit} className="modal-form">
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            <strong style={{ color: '#f59e0b' }}>{language === 'fr' ? 'Solde restant' : 'Remaining balance'} :</strong>
            <span style={{ marginLeft: '0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{debt.remaining_amount.toLocaleString()} GNF</span>
          </div>
          <div className="form-group">
            <label className="form-label">{language === 'fr' ? 'Montant du versement (GNF) *' : 'Payment Amount (GNF) *'}</label>
            <input
              type="number" className="input" required min="1" max={debt.remaining_amount}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`Max: ${debt.remaining_amount.toLocaleString()} GNF`}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{language === 'fr' ? 'Mode de paiement' : 'Payment Method'}</label>
            <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="cash">{language === 'fr' ? 'Espèces' : 'Cash'}</option>
              <option value="orange_money">Orange Money</option>
              <option value="mtn_money">MTN Money</option>
              <option value="wave">Wave</option>
              <option value="card">{language === 'fr' ? 'Carte bancaire' : 'Bank card'}</option>
              <option value="transfer">{language === 'fr' ? 'Virement bancaire' : 'Bank transfer'}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{language === 'fr' ? 'Notes (optionnel)' : 'Notes (optional)'}</label>
            <input type="text" className="input" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={isSubmitting}>{language === 'fr' ? 'Annuler' : 'Cancel'}</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (language === 'fr' ? 'Enregistrement...' : 'Saving...') : (language === 'fr' ? 'Confirmer le règlement' : 'Confirm Payment')}
            </button>
          </div>
        </form>
      )}
    </Modal>
    {receipt && (
      <DebtReceiptModal
        key={receipt.payment.id}
        isOpen
        onClose={() => setReceipt(null)}
        debt={receipt.debt}
        payment={receipt.payment}
        initialView={Number(receipt.debt.remaining_amount) <= 0 ? 'statement' : 'payment'}
        language={language}
      />
    )}
    </>
  );
}
