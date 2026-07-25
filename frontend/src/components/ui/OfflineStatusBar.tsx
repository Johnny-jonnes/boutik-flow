'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, Check } from 'lucide-react';

type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced';

export function OfflineStatusBar() {
  const [status, setStatus] = useState<SyncStatus>('online');

  const updateStatus = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setStatus(navigator.onLine ? 'online' : 'offline');

    const goOnline = () => {
      setStatus('syncing');
      // Tenter la synchronisation
      const syncEvent = new CustomEvent('boutikflow:sync-request');
      window.dispatchEvent(syncEvent);
      // Auto-transition vers 'synced' après 2s (ou sur event)
      setTimeout(() => {
        setStatus('synced');
        setTimeout(() => setStatus('online'), 2500);
      }, 1500);
    };

    const goOffline = () => setStatus('offline');

    const onSynced = () => {
      setStatus('synced');
      setTimeout(() => setStatus('online'), 2500);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('boutikflow:synced', onSynced);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('boutikflow:synced', onSynced);
    };
  }, []);

  if (status === 'online') return null;

  return (
    <>
      <div className={`offline-bar offline-bar--${status}`}>
        {status === 'offline' && (
          <>
            <WifiOff size={13} />
            <span>Hors ligne</span>
          </>
        )}
        {status === 'syncing' && (
          <>
            <RefreshCw size={13} className="offline-bar-spin" />
            <span>Synchronisation...</span>
          </>
        )}
        {status === 'synced' && (
          <>
            <Check size={13} />
            <span>Synchronisé</span>
          </>
        )}
      </div>

      <style jsx>{`
        .offline-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          height: 28px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          z-index: 1200;
          animation: slideDown 0.25s var(--ease-out);
          user-select: none;
          width: 100%;
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
          animation: slideDown 0.25s var(--ease-out), fadeOut 0.4s ease 2s forwards;
        }
        .offline-bar-spin {
          animation: spin 1s linear infinite;
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
