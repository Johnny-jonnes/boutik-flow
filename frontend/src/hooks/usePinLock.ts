'use client';

import { useState, useEffect, useCallback } from 'react';

const PIN_HASH_KEY = 'boutikflow_pin_hash';
const PIN_ENABLED_KEY = 'boutikflow_pin_enabled';
const PIN_VERIFIED_KEY = 'boutikflow_pin_session_verified';

// Simple hash for PIN (not cryptographically secure, but sufficient for UI lock)
function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return String(Math.abs(hash) + pin.length * 7919);
}

export function usePinLock() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const enabled = localStorage.getItem(PIN_ENABLED_KEY) === 'true';
    setIsEnabled(enabled);
    if (enabled) {
      // Lock on every new session (tab open)
      const sessionVerified = sessionStorage.getItem(PIN_VERIFIED_KEY) === 'true';
      if (!sessionVerified) {
        setIsLocked(true);
      }
    }
  }, []);

  const verifyPin = useCallback((pin: string): boolean => {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash) return false;
    const correct = hashPin(pin) === storedHash;
    if (correct) {
      sessionStorage.setItem(PIN_VERIFIED_KEY, 'true');
      setIsLocked(false);
      setPinError('');
    } else {
      setPinError('Code PIN incorrect. Réessayez.');
    }
    return correct;
  }, []);

  const enablePin = useCallback((pin: string) => {
    localStorage.setItem(PIN_HASH_KEY, hashPin(pin));
    localStorage.setItem(PIN_ENABLED_KEY, 'true');
    sessionStorage.setItem(PIN_VERIFIED_KEY, 'true');
    setIsEnabled(true);
    setIsLocked(false);
  }, []);

  const disablePin = useCallback((pin: string): boolean => {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash || hashPin(pin) !== storedHash) {
      setPinError('Code PIN incorrect. Impossible de désactiver.');
      return false;
    }
    localStorage.removeItem(PIN_HASH_KEY);
    localStorage.removeItem(PIN_ENABLED_KEY);
    sessionStorage.removeItem(PIN_VERIFIED_KEY);
    setIsEnabled(false);
    setIsLocked(false);
    setPinError('');
    return true;
  }, []);

  const changePin = useCallback((oldPin: string, newPin: string): boolean => {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash || hashPin(oldPin) !== storedHash) {
      setPinError('Ancien PIN incorrect.');
      return false;
    }
    localStorage.setItem(PIN_HASH_KEY, hashPin(newPin));
    setPinError('');
    return true;
  }, []);

  return { isEnabled, isLocked, pinError, verifyPin, enablePin, disablePin, changePin, setPinError };
}
