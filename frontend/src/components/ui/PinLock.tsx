'use client';

import { useState } from 'react';
import { Lock, Delete } from 'lucide-react';

interface PinLockProps {
  onVerify: (pin: string) => boolean;
  error: string;
  onClearError: () => void;
}

export function PinLock({ onVerify, error, onClearError }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleDigit = (d: string) => {
    onClearError();
    if (pin.length < 4) {
      const newPin = pin + d;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => {
          const ok = onVerify(newPin);
          if (!ok) {
            setShaking(true);
            setTimeout(() => { setShaking(false); setPin(''); }, 600);
          }
        }, 100);
      }
    }
  };

  const handleDelete = () => {
    onClearError();
    setPin(p => p.slice(0, -1));
  };

  const digits = ['1','2','3','4','5','6','7','8','9','','0','del'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'var(--surface-0, #090d16)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '2rem', padding: '2rem'
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #10b981, #047857)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem auto', boxShadow: '0 8px 32px rgba(16,185,129,0.3)'
        }}>
          <Lock size={28} color="white" />
        </div>
        <h1 style={{ color: 'var(--text-primary, #fff)', fontWeight: 700, fontSize: '1.4rem', margin: '0 0 0.25rem 0' }}>BoutikFlow</h1>
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem', margin: 0 }}>Entrez votre code PIN pour continuer</p>
      </div>

      {/* PIN dots */}
      <div style={{ display: 'flex', gap: '1rem', animation: shaking ? 'shake 0.5s' : 'none' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            background: i < pin.length ? '#10b981' : 'rgba(255,255,255,0.15)',
            border: '2px solid',
            borderColor: i < pin.length ? '#10b981' : 'rgba(255,255,255,0.2)',
            transition: 'all 0.15s ease'
          }} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '-1rem 0', textAlign: 'center' }}>{error}</p>
      )}

      {/* Numpad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', width: '100%', maxWidth: 280 }}>
        {digits.map((d, i) => (
          <button
            key={i}
            onClick={() => d === 'del' ? handleDelete() : d ? handleDigit(d) : undefined}
            disabled={!d && d !== '0'}
            style={{
              height: 64, borderRadius: 12,
              background: d === 'del' ? 'rgba(239,68,68,0.15)' : d ? 'rgba(255,255,255,0.07)' : 'transparent',
              border: d ? '1px solid rgba(255,255,255,0.1)' : 'none',
              color: d === 'del' ? '#ef4444' : 'var(--text-primary, #fff)',
              fontSize: d === 'del' ? '1rem' : '1.4rem',
              fontWeight: 600, cursor: d || d === '0' ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            {d === 'del' ? <Delete size={20} /> : d}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
