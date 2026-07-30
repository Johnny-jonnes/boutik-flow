'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, Send, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { getSyncJournal } from '@/lib/api/client';
import type { SyncJournalEntry, SyncJournalStatus } from '@/lib/offlineDb';

interface SyncJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "à l'instant";
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

const STATUS_CONFIG: Record<SyncJournalStatus, { label: string; icon: typeof Clock; cls: string }> = {
  pending: { label: 'En attente', icon: Clock, cls: 'sj-badge--pending' },
  sent: { label: 'Envoyée', icon: Send, cls: 'sj-badge--sent' },
  confirmed: { label: 'Confirmée', icon: CheckCircle2, cls: 'sj-badge--confirmed' },
  error: { label: 'Erreur', icon: AlertTriangle, cls: 'sj-badge--error' },
};

export function SyncJournalModal({ isOpen, onClose }: SyncJournalModalProps) {
  const [entries, setEntries] = useState<SyncJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const journal = await getSyncJournal();
      setEntries(journal);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Journal de synchronisation" maxWidth="560px">
      <div className="sj-modal">
        <div className="sj-toolbar">
          <p className="sj-hint">
            Historique des opérations faites hors connexion — jusqu&apos;aux 500 plus récentes,
            même une fois confirmées côté serveur.
          </p>
          <button type="button" className="btn btn-ghost btn-icon" onClick={load} title="Actualiser" disabled={isLoading}>
            <RefreshCw size={15} className={isLoading ? 'sj-spin' : ''} />
          </button>
        </div>

        {isLoading && entries.length === 0 && (
          <div className="sj-empty">Chargement…</div>
        )}
        {!isLoading && entries.length === 0 && (
          <div className="sj-empty">Aucune opération enregistrée pour l&apos;instant.</div>
        )}

        <div className="sj-list">
          {entries.map(entry => {
            const cfg = STATUS_CONFIG[entry.status];
            const Icon = cfg.icon;
            return (
              <div key={entry.id} className="sj-item">
                <div className={`sj-badge ${cfg.cls}`}>
                  <Icon size={12} />
                  <span>{cfg.label}</span>
                </div>
                <div className="sj-item-body">
                  <span className="sj-item-title">{entry.description}</span>
                  {entry.errorMessage && <span className="sj-item-error">{entry.errorMessage}</span>}
                </div>
                <span className="sj-item-time">{timeAgo(entry.updatedAt)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .sj-modal { display: flex; flex-direction: column; gap: 0.75rem; }
        .sj-toolbar { display: flex; align-items: flex-start; gap: 0.5rem; }
        .sj-hint { flex: 1; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin: 0; }
        .sj-empty { text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem; }
        .sj-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 60vh; overflow-y: auto; }
        .sj-item {
          display: flex; align-items: center; gap: 0.6rem;
          border: 1px solid var(--border-subtle); border-radius: 10px;
          padding: 0.5rem 0.65rem; background: var(--surface-2);
        }
        .sj-badge {
          display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0;
          font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;
          padding: 0.2rem 0.45rem; border-radius: 999px;
        }
        .sj-badge--pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .sj-badge--sent { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .sj-badge--confirmed { background: rgba(16,185,129,0.15); color: #10b981; }
        .sj-badge--error { background: rgba(244,63,94,0.15); color: #f43f5e; }
        .sj-item-body { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 1px; }
        .sj-item-title { font-size: 0.83rem; font-weight: 600; color: var(--text-primary); }
        .sj-item-error {
          font-size: 0.72rem; color: var(--color-error, #f43f5e);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sj-item-time { font-size: 0.72rem; color: var(--text-muted); flex-shrink: 0; white-space: nowrap; }
        .sj-spin { animation: sj-spin 0.8s linear infinite; }
        @keyframes sj-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Modal>
  );
}
