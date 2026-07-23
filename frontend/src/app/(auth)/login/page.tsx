'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [form, setForm] = useState({
    boutique_slug: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('registered') === 'true') {
        setIsRegistered(true);
      }
      const slug = params.get('slug');
      if (slug) {
        setForm(f => ({ ...f, boutique_slug: slug }));
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.login(form);
      toast.success('Connexion réussie !');
      if (res.user && res.user.role && res.user.role.toLowerCase() === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        toast.error('Le serveur démarre, veuillez réessayer dans 30 secondes.');
      } else {
        const msg = err instanceof Error ? err.message : 'Erreur de connexion';
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />
      <div className="auth-glow" />

      <div className="auth-container animate-fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#grad)" />
              <path d="M9 14L12.5 17.5L19 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="grad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#047857" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="auth-logo-text">BoutikFlow</span>
        </div>

        <div className="auth-card glass">
          <div className="auth-header">
            <h1 className="auth-title">Bon retour</h1>
            <p className="auth-subtitle">Connectez-vous à votre boutique</p>
          </div>

          {isRegistered && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'start',
              gap: '0.75rem',
              color: '#10b981',
              fontSize: '0.875rem',
              lineHeight: '1.4'
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#10b981' }} />
              <div>
                <strong style={{ display: 'block', marginBottom: '2px', fontWeight: 600 }}>Demande envoyée avec succès !</strong>
                Votre boutique a été pré-enregistrée. Elle sera accessible dès qu&apos;elle aura été validée par l&apos;administrateur.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="boutique_slug">
                Identifiant boutique
              </label>
              <div className="input-wrapper">
                <span className="input-prefix">boutikflow.app/</span>
                <input
                  id="boutique_slug"
                  type="text"
                  className="input input-with-prefix"
                  placeholder="ma-boutique"
                  value={form.boutique_slug}
                  onChange={e => setForm(f => ({ ...f, boutique_slug: e.target.value.toLowerCase() }))}
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="vous@exemple.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="password">Mot de passe</label>
                <Link href="/forgot-password" className="form-link">Oublié ?</Link>
              </div>
              <div className="password-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '2.5rem', width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.25rem'
                  }}
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-login"
              className="btn btn-primary auth-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <div className="auth-footer">
            <span className="auth-footer-text">Pas encore de boutique ?</span>
            <Link href="/register" className="auth-footer-link">Créer un compte</Link>
          </div>
        </div>

        {/* Trust badges - no prices, no emojis */}
        <div className="auth-badge">
          <span className="badge badge-success flex items-center gap-1">Sans engagement</span>
          <span className="badge badge-neutral">Concu pour les commerces africains</span>
        </div>
        <p className="trillionx-tag">Propulsé par <strong>TrillionX</strong></p>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-0);
          position: relative;
          overflow: hidden;
          padding: 2rem;
        }

        .auth-bg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--auth-grid-color) 1px, transparent 1px),
            linear-gradient(90deg, var(--auth-grid-color) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .auth-glow {
          position: absolute;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, var(--auth-glow-color) 0%, transparent 70%);
          pointer-events: none;
        }

        .auth-container {
          position: relative;
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .auth-logo-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-2);
          border: 1px solid var(--border-default);
          box-shadow: var(--shadow-brand);
        }

        .auth-logo-text {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .auth-card {
          width: 100%;
          border-radius: var(--radius-xl);
          padding: 2rem;
          box-shadow: var(--shadow-lg);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 1.75rem;
        }

        .auth-title {
          font-size: 1.5rem;
          margin-bottom: 0.375rem;
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .form-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .form-link {
          font-size: 0.8rem;
          color: var(--color-brand-600);
          text-decoration: none;
          transition: var(--transition-fast);
        }

        .form-link:hover { color: var(--color-brand-500); }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-prefix {
          position: absolute;
          left: 0.875rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          pointer-events: none;
          white-space: nowrap;
        }

        .input-with-prefix {
          padding-left: 8.5rem !important;
        }

        .auth-submit {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        .auth-footer {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.875rem;
        }

        .auth-footer-text { color: var(--text-muted); }

        .auth-footer-link {
          color: var(--color-brand-600);
          font-weight: 600;
          text-decoration: none;
          transition: var(--transition-fast);
        }

        .auth-footer-link:hover { color: var(--color-brand-500); }

        .auth-badge {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }
        .trillionx-tag {
          font-size: 0.75rem;
          color: var(--text-disabled);
          text-align: center;
          margin-top: 0.25rem;
          letter-spacing: 0.01em;
        }
        .trillionx-tag strong {
          color: var(--text-muted);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
