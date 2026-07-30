'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, Check, AlertTriangle, ChevronDown, X, RotateCcw } from 'lucide-react';
import { getSyncQueueStatus, retryFailedOperation, discardFailedOperation, syncOfflineQueue } from '@/lib/api/client';
import { describeOperation } from '@/lib/offlineDb';

type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced' | 'issues';
interface FailedOp { id: string; method: string; path: string; errorMessage?: string; attempts: number; createdAt: number }

function timeAgo(ts: number | undefined): string {
  if (!ts) return 'jamais';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "à l'instant";
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export function OfflineStatusBar() {
  const [status, setStatus] = useState<SyncStatus>('online');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedOps, setFailedOps] = useState<FailedOp[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshQueueCounts = useCallback(async () => {
    const { pendingCount: pending, failed, lastSyncAt: last } = await getSyncQueueStatus();
    setPendingCount(pending);
    setFailedOps(failed);
    setLastSyncAt(last);
    return { pending, failedCount: failed.length };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    (async () => {
      const { pending: initialPending, failedCount: initialFailed } = await refreshQueueCounts();
      if (cancelled) return;
      if (!navigator.onLine) {
        setStatus('offline');
      } else if (initialFailed > 0) {
        setStatus('issues');
      } else if (initialPending > 0) {
        // Une file existait déjà (session précédente) : le sync automatique
        // au chargement du module va démarrer sous peu, on l'annonce déjà.
        setStatus('syncing');
      } else {
        setStatus('online');
      }
    })();

    const goOffline = () => {
      refreshQueueCounts();
      setStatus('offline');
    };

    // La synchronisation elle-même est déclenchée automatiquement par
    // lib/api/client.ts dès l'événement "online" (ou au chargement si déjà
    // en ligne) : ce composant se contente d'en refléter la progression
    // réelle via ces événements, il ne simule plus rien lui-même.
    const onSyncStart = (e: Event) => {
      const detail = (e as CustomEvent).detail as { count: number } | undefined;
      if (detail?.count) setPendingCount(detail.count);
      setStatus('syncing');
    };

    const onSyncComplete = async (e: Event) => {
      const detail = (e as CustomEvent).detail as { succeeded: number; failed: number } | undefined;
      const { failedCount } = await refreshQueueCounts();
      if (failedCount > 0) {
        setStatus('issues');
      } else if (detail?.succeeded) {
        setStatus('synced');
        setTimeout(() => setStatus('online'), 3000);
      } else {
        setStatus('online');
      }
    };

    const onQueueChanged = () => { refreshQueueCounts(); };

    window.addEventListener('offline', goOffline);
    window.addEventListener('boutikflow:sync-start', onSyncStart);
    window.addEventListener('boutikflow:sync-complete', onSyncComplete);
    window.addEventListener('boutikflow:queue-changed', onQueueChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('boutikflow:sync-start', onSyncStart);
      window.removeEventListener('boutikflow:sync-complete', onSyncComplete);
      window.removeEventListener('boutikflow:queue-changed', onQueueChanged);
    };
  }, [refreshQueueCounts]);

  // Ferme le panneau au clic extérieur.
  useEffect(() => {
    if (!expanded) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [expanded]);

  const failedCount = failedOps.length;

  if (status === 'online') return null;

  return (
    <>
      <div className="offline-bar-wrap" ref={panelRef}>
        <button
          type="button"
          className={`offline-bar offline-bar--${status}`}
          onClick={() => setExpanded(v => !v)}
        >
          {status === 'offline' && (
            <>
              <WifiOff size={13} />
              <span>
                Hors ligne
                {pendingCount > 0 && ` — ${pendingCount} en attente de synchronisation`}
              </span>
            </>
          )}
          {status === 'syncing' && (
            <>
              <RefreshCw size={13} className="offline-bar-spin" />
              <span>Synchronisation{pendingCount > 0 ? ` (${pendingCount})` : ''}...</span>
            </>
          )}
          {status === 'synced' && (
            <>
              <Check size={13} />
              <span>Synchronisé</span>
            </>
          )}
          {status === 'issues' && (
            <>
              <AlertTriangle size={13} />
              <span>
                {failedCount} opération{failedCount > 1 ? 's' : ''} n&apos;{failedCount > 1 ? 'ont' : 'a'} pas pu être synchronisée{failedCount > 1 ? 's' : ''}
              </span>
            </>
          )}
          <ChevronDown size={12} className={`offline-bar-chevron ${expanded ? 'offline-bar-chevron--open' : ''}`} />
        </button>

        {expanded && (
          <div className="offline-panel">
            <div className="offline-panel-row">
              <span>En attente</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="offline-panel-row">
              <span>Dernière synchronisation</span>
              <strong>{timeAgo(lastSyncAt)}</strong>
            </div>

            {failedCount > 0 && (
              <>
                <div className="offline-panel-divider" />
                <div className="offline-panel-label">Échecs à traiter</div>
                <div className="offline-panel-list">
                  {failedOps.map(op => (
                    <div key={op.id} className="offline-panel-item">
                      <div className="offline-panel-item-info">
                        <span className="offline-panel-item-title">{describeOperation(op.method, op.path)}</span>
                        <span className="offline-panel-item-error">{op.errorMessage || 'Erreur inconnue'}</span>
                      </div>
                      <div className="offline-panel-item-actions">
                        <button
                          type="button"
                          title="Réessayer"
                          onClick={async () => { await retryFailedOperation(op.id); syncOfflineQueue(); }}
                        >
                          <RotateCcw size={13} />
                        </button>
                        <button
                          type="button"
                          title="Abandonner"
                          onClick={async () => { await discardFailedOperation(op.id); }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .offline-bar-wrap {
          position: relative;
          width: 100%;
          z-index: 1200;
        }
        .offline-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 28px;
          padding: 0.2rem 0.75rem;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          animation: slideDown 0.25s var(--ease-out);
          user-select: none;
          width: 100%;
          text-align: center;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .offline-bar--offline {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border-bottom: 1px solid rgba(245, 158, 11, 0.2);
        }
        .offline-bar--syncing {
          background: rgba(109, 213, 196, 0.12);
          color: #6dd5c4;
          border-bottom: 1px solid rgba(109, 213, 196, 0.18);
        }
        .offline-bar--synced {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border-bottom: 1px solid rgba(16, 185, 129, 0.18);
          animation: slideDown 0.25s var(--ease-out), fadeOut 0.4s ease 2.6s forwards;
        }
        .offline-bar--issues {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border-bottom: 1px solid rgba(244, 63, 94, 0.25);
        }
        .offline-bar-spin {
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }
        .offline-bar-chevron {
          margin-left: 0.15rem;
          transition: transform 0.15s ease;
          opacity: 0.7;
        }
        .offline-bar-chevron--open { transform: rotate(180deg); }

        .offline-panel {
          position: absolute;
          top: calc(100% + 4px);
          left: 50%;
          transform: translateX(-50%);
          width: min(340px, 92vw);
          background: var(--surface-1);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md, 10px);
          box-shadow: var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.25));
          padding: 0.75rem;
          text-align: left;
          animation: fadeInPanel 0.15s ease-out;
        }
        .offline-panel-row {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 0.78rem; color: var(--text-secondary);
          padding: 0.2rem 0;
        }
        .offline-panel-row strong { color: var(--text-primary); font-weight: 700; }
        .offline-panel-divider { height: 1px; background: var(--border-subtle); margin: 0.5rem 0; }
        .offline-panel-label {
          font-size: 0.68rem; font-weight: 800; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 0.35rem;
        }
        .offline-panel-list { display: flex; flex-direction: column; gap: 0.35rem; max-height: 220px; overflow-y: auto; }
        .offline-panel-item {
          display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
          background: var(--surface-2); border-radius: 8px; padding: 0.4rem 0.55rem;
        }
        .offline-panel-item-info { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
        .offline-panel-item-title { font-size: 0.76rem; font-weight: 700; color: var(--text-primary); }
        .offline-panel-item-error {
          font-size: 0.68rem; color: var(--color-error, #f43f5e);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
        }
        .offline-panel-item-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
        .offline-panel-item-actions button {
          width: 26px; height: 26px; border-radius: 6px; border: 1px solid var(--border-default);
          background: var(--surface-1); color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .offline-panel-item-actions button:hover { background: var(--surface-3); color: var(--text-primary); }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; height: 0; padding: 0; border: none; overflow: hidden; }
        }
        @keyframes fadeInPanel {
          from { opacity: 0; transform: translateX(-50%) translateY(-4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </>
  );
}
