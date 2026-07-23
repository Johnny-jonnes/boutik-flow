'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type ServerStatus = 'unknown' | 'waking' | 'ready' | 'error';

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || 'https://boutik-flow.onrender.com/api/v1')
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/$/, '');

const HEALTH_URL = `${API_BASE}/health`;

/**
 * useServerWakeup — Ping le backend au montage pour le réveiller (démarrage du serveur).
 * Retente toutes les 10s jusqu'à ce que le serveur réponde.
 */
export function useServerWakeup() {
  const [status, setStatus] = useState<ServerStatus>('unknown');
  const [wakeSeconds, setWakeSeconds] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  const clearTimers = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (countTimer.current) clearInterval(countTimer.current);
  };

  const ping = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(HEALTH_URL, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      if (!mounted.current) return;

      if (res.ok) {
        clearTimers();
        setStatus('ready');
        setWakeSeconds(0);
      } else {
        startWaking();
      }
    } catch {
      if (mounted.current) startWaking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWaking = useCallback(() => {
    if (!mounted.current) return;
    setStatus('waking');

    // Countdown: affiche combien de secondes jusqu'au prochain essai
    let remaining = 12;
    setWakeSeconds(remaining);
    countTimer.current = setInterval(() => {
      remaining -= 1;
      if (!mounted.current) return;
      setWakeSeconds(remaining);
      if (remaining <= 0) {
        if (countTimer.current) clearInterval(countTimer.current);
      }
    }, 1000);

    retryTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      ping();
    }, 12000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ping]);

  useEffect(() => {
    mounted.current = true;
    ping();
    return () => {
      mounted.current = false;
      clearTimers();
    };
  }, [ping]);

  return { status, wakeSeconds };
}
