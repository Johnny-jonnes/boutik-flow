'use client';

import { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { getSyncQueueStatus } from '@/lib/api/client';

type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced' | 'issues';

export function OfflineStatusBar() {
  const [status, setStatus] = useState<SyncStatus>('online');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const refreshQueueCounts = useCallback(() => {
    const { pendingCount: pending, failed } = getSyncQueueStatus();
    setPendingCount(pending);
    setFailedCount(failed.length);
    return { pending, failedCount: failed.length };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { pending: initialPending, failedCount: initialFailed } = refreshQueueCounts();
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

    const onSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as { succeeded: number; failed: number } | undefined;
      const { failedCount } = refreshQueueCounts();
      if (failedCount > 0) {
        setStatus('issues');
      } else if (detail?.succeeded) {
        setStatus('synced');
        setTimeout(() => setStatus('online'), 3000);
      } else {
        setStatus('online');
      }
    };

    const onQueueChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { pending: number; failed: number } | undefined;
      if (detail) {
        setPendingCount(detail.pending);
        setFailedCount(detail.failed);
      }
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('boutikflow:sync-start', onSyncStart);
    window.addEventListener('boutikflow:sync-complete', onSyncComplete);
    window.addEventListener('boutikflow:queue-changed', onQueueChanged);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('boutikflow:sync-start', onSyncStart);
      window.removeEventListener('boutikflow:sync-complete', onSyncComplete);
      window.removeEventListener('boutikflow:queue-changed', onQueueChanged);
    };
  }, [refreshQueueCounts]);

  if (status === 'online') return null;

  return (
    <>
      <div className={`offline-bar offline-bar--${status}`}>
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
              {failedCount} opération{failedCount > 1 ? 's' : ''} n&apos;{failedCount > 1 ? 'ont' : 'a'} pas pu être synchronisée{failedCount > 1 ? 's' : ''} — vérifiez vos ventes récentes
            </span>
          </>
        )}
      </div>

      <style jsx>{`
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
          z-index: 1200;
          animation: slideDown 0.25s var(--ease-out);
          user-select: none;
          width: 100%;
          text-align: center;
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
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; height: 0; padding: 0; border: none; overflow: hidden; }
        }
      `}</style>
    </>
  );
}
