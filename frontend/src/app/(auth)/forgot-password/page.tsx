'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [form, setForm] = useState({ boutique_slug: '', email: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.forgotPassword(form);
      setIsSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la demande');
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
              <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#gradfp)" />
              <path d="M9 14L12.5 17.5L19 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="gradfp" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#047857" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="auth-logo-text">BoutikFlow</span>
        </div>

        <div className="auth-card glass">
          {isSubmitted ? (
            <>
              <div className="auth-header">
                <div className="forgot-icon-wrap">
                  <Mail size={28} />
                </div>
                <h1 className="auth-title">Vérifiez votre boîte mail</h1>
                <p className="auth-subtitle">
                  Si un compte correspond à ces informations, un email contenant les
                  instructions de réinitialisation vient de vous être envoyé.
                </p>
              </div>
              <Link href="/login" className="btn btn-secondary auth-submit auth-link-btn">
                <ArrowLeft size={16} /> Retour à la connexion
              </Link>
            </>
          ) : (
            <>
              <div className="auth-header">
                <h1 className="auth-title">Mot de passe oublié</h1>
                <p className="auth-subtitle">
                  Indiquez votre boutique et votre email, nous vous envoyons un lien de réinitialisation.
                </p>
              </div>

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

                <button
                  type="submit"
                  id="btn-forgot-password"
                  className="btn btn-primary auth-submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner" />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer le lien de réinitialisation'
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

        .auth-link-btn {
          text-decoration: none;
          gap: 0.5rem;
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
