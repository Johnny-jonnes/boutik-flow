'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryToken = searchParams.get('token') || '';
  
  const [supabaseToken, setSupabaseToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [form, setForm] = useState({ password: '', confirmPassword: '' });

  useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        if (accessToken) {
          setSupabaseToken(accessToken);
        }
      }
    }
  });

  const token = queryToken || supabaseToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error('Lien de réinitialisation invalide ou expiré.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      await api.resetPassword({ token, new_password: form.password });
      setIsSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation');
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
              <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#gradrp)" />
              <path d="M9 14L12.5 17.5L19 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="gradrp" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#047857" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="auth-logo-text">BoutikFlow</span>
        </div>

        <div className="auth-card glass">
          {isSuccess ? (
            <div className="auth-header">
              <div className="forgot-icon-wrap forgot-icon-wrap--success">
                <CheckCircle2 size={28} />
              </div>
              <h1 className="auth-title">Mot de passe mis à jour</h1>
              <p className="auth-subtitle">Redirection vers la connexion...</p>
            </div>
          ) : !token ? (
            <>
              <div className="auth-header">
                <h1 className="auth-title">Lien invalide</h1>
                <p className="auth-subtitle">
                  Ce lien de réinitialisation est invalide ou a expiré. Merci de refaire une demande.
                </p>
              </div>
              <Link href="/forgot-password" className="btn btn-primary auth-submit auth-link-btn">
                Refaire une demande
              </Link>
            </>
          ) : (
            <>
              <div className="auth-header">
                <h1 className="auth-title">Nouveau mot de passe</h1>
                <p className="auth-subtitle">Choisissez un nouveau mot de passe pour votre compte.</p>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="password">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  id="btn-reset-password"
                  className="btn btn-primary auth-submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" />
                      Mise à jour...
                    </>
                  ) : (
                    'Réinitialiser le mot de passe'
                  )}
                </button>
              </form>

              <div className="auth-footer">
                <Link href="/login" className="auth-footer-link auth-footer-link--icon">
                  <ArrowLeft size={14} /> Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
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

        .forgot-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--brand-alpha-10);
          color: var(--color-brand-500);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem;
        }

        .forgot-icon-wrap--success {
          background: rgba(34, 197, 94, 0.12);
          color: var(--color-success);
        }

        .auth-title {
          font-size: 1.5rem;
          margin-bottom: 0.375rem;
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.6;
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

        .auth-submit {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }

        .auth-link-btn {
          text-decoration: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        .auth-footer {
          display: flex;
          justify-content: center;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.875rem;
        }

        .auth-footer-link {
          color: var(--color-brand-600);
          font-weight: 600;
          text-decoration: none;
          transition: var(--transition-fast);
        }

        .auth-footer-link--icon {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .auth-footer-link:hover {
          color: var(--color-brand-500);
        }
      `}</style>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
