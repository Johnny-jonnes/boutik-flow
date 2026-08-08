'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { Modal } from '@/components/ui/Modal';
import type { ClientDebt } from '@/types';

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
      await api.recordDebtPayment(debt.id, {
        amount: amountNum,
        payment_method: paymentMethod,
        notes: notes || undefined,
      });
      toast.success(language === 'fr' ? 'Règlement enregistré avec succès !' : 'Payment recorded successfully!');
      // Signal explicite, sur le même modèle que boutikflow:order-created —
      // permet à QueryProvider d'invalider les caches Dettes/Finance/
      // Dashboard immédiatement, sans attendre une synchronisation.
      window.dispatchEvent(new CustomEvent('boutikflow:debt-paid', { detail: { debtId: debt.id, amount: amountNum } }));
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || (language === 'fr' ? 'Erreur lors du règlement' : 'Error recording payment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
  );
}
