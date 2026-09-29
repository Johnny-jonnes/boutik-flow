'use client';

import { useMemo, useRef, useState } from 'react';
import { Printer, ReceiptText, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { useClientsQuery, useTenantQuery } from '@/lib/queries';
import { initials } from '@/lib/format';
import { printPaper } from '@/lib/printPaper';
import type { ClientDebt, DebtPaymentEntry } from '@/types';
import '@/styles/debt-receipt.css';

export type DebtReceiptView = 'payment' | 'statement';

const METHOD_LABELS: Record<string, { fr: string; en: string }> = {
  cash: { fr: 'Espèces', en: 'Cash' },
  orange_money: { fr: 'Orange Money', en: 'Orange Money' },
  mtn_money: { fr: 'MTN Money', en: 'MTN Money' },
  wave: { fr: 'Wave', en: 'Wave' },
  card: { fr: 'Carte bancaire', en: 'Bank card' },
  transfer: { fr: 'Virement bancaire', en: 'Bank transfer' },
};

const money = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const ref = (prefix: string, id: string) => `${prefix}-${id.replace(/^local-/, '').slice(0, 8).toUpperCase()}`;

/**
 * Reçus des dettes clients :
 *  - « Ce versement » : reçu d'un paiement (montant versé, déjà payé, reste) ;
 *  - « Récapitulatif » : tous les versements d'une dette, avec le tampon
 *    « Soldée » une fois tout réglé.
 * Deux formats d'impression : ticket 80 mm et A4.
 */
export function DebtReceiptModal({
  isOpen,
  onClose,
  debt,
  payment,
  initialView,
  language,
}: {
  isOpen: boolean;
  onClose: () => void;
  debt: ClientDebt;
  /** Versement concerné ; absent = récapitulatif uniquement. */
  payment?: DebtPaymentEntry | null;
  initialView?: DebtReceiptView;
  language: string;
}) {
  const fr = language === 'fr';
  const [view, setView] = useState<DebtReceiptView>(payment ? (initialView ?? 'payment') : 'statement');
  const [format, setFormat] = useState<'thermal' | 'a4'>('thermal');
  const paperRef = useRef<HTMLDivElement>(null);

  const { data: tenant } = useTenantQuery();
  const { data: clientsData } = useClientsQuery();
  const shopName = tenant?.name || 'Ma Boutique';
  const shopLogo = tenant?.logo || null;
  const shopPhone = tenant?.public_whatsapp || null;
  const clientPhone = clientsData?.items?.find(c => c.id === debt.client_id)?.phone || null;

  const locale = fr ? 'fr-FR' : 'en-US';
  const dateTime = (iso: string) => new Intl.DateTimeFormat(locale, format === 'a4'
    ? { dateStyle: 'long', timeStyle: 'short' }
    : { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const dateOnly = (iso: string) => new Intl.DateTimeFormat(locale, format === 'a4'
    ? { dateStyle: 'long' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  const method = (m: string) => METHOD_LABELS[m]?.[fr ? 'fr' : 'en'] ?? m;

  const original = Number(debt.original_amount) || 0;

  // Versements du plus ancien au plus récent, avec le reste après chacun.
  const history = useMemo(() => {
    const sorted = [...(debt.payments ?? [])].sort((a, b) => +new Date(a.paid_at) - +new Date(b.paid_at));
    const rows: (DebtPaymentEntry & { index: number; before: number; after: number })[] = [];
    let paid = 0;
    for (const p of sorted) {
      paid += Number(p.amount) || 0;
      const after = p.balance_after ?? Math.max(0, original - paid);
      const before = p.balance_before ?? after + (Number(p.amount) || 0);
      rows.push({ ...p, index: rows.length + 1, before: Number(before), after: Number(after) });
    }
    return rows;
  }, [debt.payments, original]);

  const totalPaid = Number(debt.paid_amount) || history.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, Number(debt.remaining_amount) || 0);
  const settled = remaining <= 0;
  const settledAt = settled && history.length ? history[history.length - 1].paid_at : null;
  const settledInDays = settledAt
    ? Math.max(1, Math.ceil((+new Date(settledAt) - +new Date(debt.created_at)) / 86_400_000))
    : 0;

  // Versement affiché (vue « Ce versement »), enrichi de l'état avant/après.
  const current = payment ? (history.find(h => h.id === payment.id) ?? {
    ...payment,
    index: history.length,
    after: Number(payment.balance_after ?? remaining),
    before: Number(payment.balance_before ?? remaining + Number(payment.amount)),
  }) : null;

  const isPaymentView = view === 'payment' && current;
  const paidPct = (after: number) => (original > 0 ? Math.min(100, Math.round(((original - after) / original) * 100)) : 100);
  const pct = isPaymentView ? paidPct(current.after) : paidPct(remaining);
  const clearsDebt = isPaymentView ? current.after <= 0 : settled;

  const title = isPaymentView
    ? (current.after <= 0 ? (fr ? 'Reçu de solde' : 'Final payment receipt') : (fr ? 'Reçu de versement' : 'Payment receipt'))
    : (settled ? (fr ? 'Récapitulatif' : 'Statement') : (fr ? 'Relevé de dette' : 'Debt statement'));
  const status = clearsDebt
    ? (fr ? 'Dette soldée' : 'Debt settled')
    : (fr ? `Reste ${money(isPaymentView ? current.after : remaining)} GNF` : `${money(isPaymentView ? current.after : remaining)} GNF left`);
  const number = isPaymentView ? ref('REC', current.id) : ref('DET', debt.id);
  const docDate = isPaymentView ? current.paid_at : (settledAt ?? new Date().toISOString());

  const handlePrint = () => {
    if (!paperRef.current) return;
    const ok = printPaper(paperRef.current, { title: `${title} ${number}`, format });
    if (!ok) toast.error(fr ? "Le navigateur a bloqué la fenêtre d'impression. Autorisez les popups pour ce site." : 'The browser blocked the print window. Please allow popups for this site.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={fr ? 'Reçu de dette' : 'Debt receipt'} maxWidth="680px">
      <div className="dr-modal">
        <div className="dr-toolbar">
          {payment && (
            <div className="dr-seg" role="tablist" aria-label={fr ? 'Type de reçu' : 'Receipt type'}>
              <button type="button" role="tab" aria-selected={view === 'payment'} className={view === 'payment' ? 'is-active' : ''} onClick={() => setView('payment')}>
                <ReceiptText size={15} /> {fr ? 'Ce versement' : 'This payment'}
              </button>
              <button type="button" role="tab" aria-selected={view === 'statement'} className={view === 'statement' ? 'is-active' : ''} onClick={() => setView('statement')}>
                <ListChecks size={15} /> {fr ? 'Récapitulatif' : 'Statement'}
              </button>
            </div>
          )}
          <div className="dr-seg dr-seg--small" role="tablist" aria-label="Format">
            <button type="button" role="tab" aria-selected={format === 'thermal'} className={format === 'thermal' ? 'is-active' : ''} onClick={() => setFormat('thermal')}>
              {fr ? 'Ticket 80 mm' : '80 mm ticket'}
            </button>
            <button type="button" role="tab" aria-selected={format === 'a4'} className={format === 'a4' ? 'is-active' : ''} onClick={() => setFormat('a4')}>
              A4
            </button>
          </div>
        </div>

        <div className="dr-preview">
          <div ref={paperRef} className={`dr-paper dr-paper--${format}`}>
            {/* ── En-tête : boutique et document ── */}
            <header className="dr-head">
              <div className="dr-brand">
                {shopLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={shopLogo} alt="" className="dr-logo" />
                  : <span className="dr-logo dr-logo--initials">{initials(shopName)}</span>}
                <div className="dr-brand__text">
                  <strong className="dr-shop">{shopName}</strong>
                  {shopPhone && <span className="dr-muted">{fr ? 'Tél.' : 'Tel.'} {shopPhone}</span>}
                </div>
              </div>
              <div className="dr-doc">
                <span className="dr-doc__title">{title}</span>
                <span className={`dr-doc__status ${clearsDebt ? 'is-settled' : ''}`}>{status}</span>
                <span className="dr-doc__meta">N° {number}</span>
                <span className="dr-doc__meta">{dateTime(docDate)}</span>
              </div>
            </header>

            {/* ── Client et dette ── */}
            <section className="dr-parties">
              <div className="dr-party">
                <span className="dr-label">{fr ? 'Client' : 'Customer'}</span>
                <strong>{debt.client_name}</strong>
                {clientPhone && <span className="dr-muted">{clientPhone}</span>}
              </div>
              <div className="dr-party">
                <span className="dr-label">{fr ? 'Dette' : 'Debt'}</span>
                <strong>{debt.description || (fr ? 'Vente à crédit' : 'Credit sale')}</strong>
                <span className="dr-muted">
                  {fr ? 'du' : 'from'} {dateOnly(debt.created_at)}
                  {debt.order_id ? ` · ${fr ? 'Vente' : 'Sale'} ${ref('BF', debt.order_id)}` : ''}
                </span>
              </div>
            </section>

            {isPaymentView ? (
              <>
                {/* ── Montant versé ── */}
                <section className="dr-hero">
                  <span className="dr-label">{fr ? 'Montant versé' : 'Amount paid'}</span>
                  <strong className="dr-hero__amount">{money(current.amount)} <small>GNF</small></strong>
                  <span className="dr-muted">
                    {method(current.payment_method)}
                    {current.paid_by_name ? ` · ${fr ? 'encaissé par' : 'received by'} ${current.paid_by_name}` : ''}
                  </span>
                </section>

                <table className="dr-lines">
                  <tbody>
                    <tr><td>{fr ? 'Montant de la dette' : 'Debt amount'}</td><td>{money(original)} GNF</td></tr>
                    <tr><td>{fr ? 'Déjà payé avant' : 'Paid before'}</td><td>{money(original - current.before)} GNF</td></tr>
                    <tr className="dr-lines__em"><td>{fr ? 'Ce versement' : 'This payment'}</td><td>+ {money(current.amount)} GNF</td></tr>
                    <tr><td>{fr ? 'Total payé à ce jour' : 'Total paid to date'}</td><td>{money(original - current.after)} GNF</td></tr>
                    <tr className={`dr-lines__total ${current.after <= 0 ? 'is-zero' : ''}`}><td>{fr ? 'Reste à payer' : 'Balance due'}</td><td>{money(current.after)} GNF</td></tr>
                  </tbody>
                </table>
                {current.notes && <p className="dr-note">{fr ? 'Note' : 'Note'} : {current.notes}</p>}
              </>
            ) : (
              <>
                {/* ── Synthèse ── */}
                <section className="dr-summary">
                  <div><span className="dr-label">{fr ? 'Montant dû' : 'Amount due'}</span><strong>{money(original)}</strong><small>GNF</small></div>
                  <div className="dr-summary__paid"><span className="dr-label">{fr ? 'Total payé' : 'Total paid'}</span><strong>{money(totalPaid)}</strong><small>GNF</small></div>
                  <div className={settled ? 'dr-summary__zero' : 'dr-summary__due'}><span className="dr-label">{fr ? 'Reste' : 'Balance'}</span><strong>{money(remaining)}</strong><small>GNF</small></div>
                </section>

                {/* ── Détail des versements ── */}
                <p className="dr-section-title">
                  {fr ? 'Détail des versements' : 'Payment details'} ({history.length})
                </p>
                {history.length === 0 ? (
                  <p className="dr-muted dr-empty">{fr ? 'Aucun versement pour le moment.' : 'No payment yet.'}</p>
                ) : format === 'a4' ? (
                  <table className="dr-history">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{fr ? 'Date et heure' : 'Date & time'}</th>
                        <th>{fr ? 'Mode' : 'Method'}</th>
                        <th className="num">{fr ? 'Montant' : 'Amount'}</th>
                        <th className="num">{fr ? 'Reste après' : 'Balance after'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id}>
                          <td>{h.index}</td>
                          <td>{dateTime(h.paid_at)}{h.paid_by_name ? <span className="dr-muted"> · {h.paid_by_name}</span> : null}</td>
                          <td>{method(h.payment_method)}</td>
                          <td className="num strong">{money(h.amount)}</td>
                          <td className="num">{money(h.after)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr><td colSpan={3}>{fr ? 'Total payé' : 'Total paid'}</td><td className="num">{money(totalPaid)}</td><td className="num">{money(remaining)}</td></tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="dr-history-list">
                    {history.map(h => (
                      <div key={h.id} className="dr-history-item">
                        <div><span>#{h.index} · {dateTime(h.paid_at)}</span><strong>{money(h.amount)} GNF</strong></div>
                        <div className="dr-muted"><span>{method(h.payment_method)}</span><span>{fr ? 'reste' : 'left'} {money(h.after)}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Progression ── */}
            <div className="dr-progress" aria-hidden="true">
              <div className="dr-progress__track"><span style={{ width: `${pct}%` }} /></div>
              <span className="dr-progress__label">{pct} % {fr ? 'réglé' : 'paid'}</span>
            </div>

            {clearsDebt && (
              <div className="dr-stamp-wrap">
                <div className="dr-stamp">
                  <span>{fr ? 'Dette soldée' : 'Debt settled'}</span>
                  <small>{dateOnly(isPaymentView ? current.paid_at : (settledAt ?? docDate))}</small>
                </div>
                {!isPaymentView && settledAt && (
                  <p className="dr-muted dr-center">
                    {fr
                      ? `Réglée en ${history.length} versement${history.length > 1 ? 's' : ''}, en ${settledInDays} jour${settledInDays > 1 ? 's' : ''}.`
                      : `Paid in ${history.length} payment${history.length > 1 ? 's' : ''} over ${settledInDays} day${settledInDays > 1 ? 's' : ''}.`}
                  </p>
                )}
              </div>
            )}

            {format === 'a4' && (
              <div className="dr-signatures">
                <div><span>{fr ? 'Signature du client' : 'Customer signature'}</span></div>
                <div><span>{fr ? 'Cachet de la boutique' : 'Shop stamp'}</span></div>
              </div>
            )}

            <footer className="dr-foot">
              <strong>{clearsDebt ? (fr ? 'Merci, tout est réglé !' : 'Thank you, all paid!') : (fr ? 'Merci pour votre versement !' : 'Thank you for your payment!')}</strong>
              <span className="dr-muted">{fr ? 'Conservez ce reçu comme preuve de paiement.' : 'Keep this receipt as proof of payment.'}</span>
              <span className="dr-powered">Propulsé par BoutikFlow</span>
            </footer>
          </div>
        </div>

        <div className="dr-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{fr ? 'Fermer' : 'Close'}</button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> {fr ? 'Imprimer' : 'Print'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
