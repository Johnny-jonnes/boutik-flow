'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Rocket, CheckCircle2, Shield, Zap, Users, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    boutique_name: '',
    boutique_slug: '',
    full_name: '',
    email: '',
    password: '',
    phone: '',
  });

  const generateSlug = (name: string) =>
    name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleBoutiqueNameChange = (name: string) => {
    setForm(f => ({
      ...f,
      boutique_name: name,
      boutique_slug: generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.register({
        ...form,
        phone: form.phone || undefined,
      });
      setIsSuccess(true);
      toast.success(res.message || 'Demande de création de boutique envoyée !');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('en cours') || msg.toLowerCase().includes('network')) {
        toast.error('Connexion au serveur en cours. Veuillez réessayez dans 30 secondes.');
      } else {
        toast.error(msg || 'Erreur lors de la création de la boutique');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const plans = [
    {
      icon: <Zap size={18} />,
      label: 'Assistant WhatsApp 24h/24',
    },
    {
      icon: <Users size={18} />,
      label: 'CRM clients complet',
    },
    {
      icon: <BarChart3 size={18} />,
      label: 'Tableau de bord en temps réel',
    },
    {
      icon: <Shield size={18} />,
      label: 'Données sécurisées et isolées',
    },
  ];

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />
      <div className="auth-glow" />

      <div className="register-container animate-fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#grad2)" />
              <path d="M9 14L12.5 17.5L19 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="grad2" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="1" stopColor="#047857" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="auth-logo-text">BoutikFlow</span>
        </div>

        {isSuccess ? (
          /* Success Screen */
          <div className="auth-card glass success-card">
            <div className="success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h1 className="auth-title">Demande envoyée !</h1>
            <p className="auth-subtitle" style={{ textAlign: 'center', lineHeight: '1.7' }}>
              Votre boutique <strong>{form.boutique_name}</strong> a bien été créée.<br />
              Notre équipe va valider votre compte et vous contacter très prochainement.
            </p>
            <div className="success-steps">
              <div className="success-step">
                <span className="success-step-num">1</span>
                <span>Demande reçue et enregistrée ✓</span>
              </div>
              <div className="success-step">
                <span className="success-step-num">2</span>
                <span>Validation par notre équipe (sous 24h)</span>
              </div>
              <div className="success-step">
                <span className="success-step-num">3</span>
                <span>Accès à votre tableau de bord</span>
              </div>
            </div>
            <Link href="/login" className="btn btn-primary auth-submit" style={{ textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              Accéder à la connexion
            </Link>
          </div>
        ) : (
        <div className="register-layout">
          {/* Form */}
          <div className="auth-card glass">
            <div className="auth-header">
              <h1 className="auth-title">Créer votre boutique</h1>
              <p className="auth-subtitle">Démarrez en 2 minutes</p>
            </div>

            {/* Steps */}
            <div className="steps-indicator">
              {[1, 2].map(s => (
                <div key={s} className={`step-dot ${step >= s ? 'active' : ''}`}>
                  {step > s ? '✓' : s}
                </div>
              ))}
              <div className={`step-line ${step >= 2 ? 'active' : ''}`} />
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {step === 1 ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Nom de votre boutique</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ma Super Boutique"
                      value={form.boutique_name}
                      onChange={e => handleBoutiqueNameChange(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Identifiant unique (URL)</label>
                    <div className="input-wrapper">
                      <span className="input-prefix">boutikflow.app/</span>
                      <input
                        type="text"
                        className="input input-with-prefix"
                        value={form.boutique_slug}
                        onChange={e => setForm(f => ({ ...f, boutique_slug: e.target.value.toLowerCase() }))}
                        required
                        pattern="^[a-z0-9-]+$"
                        title="Lettres minuscules, chiffres et tirets uniquement"
                      />
                    </div>
                    <span className="form-hint">Utilisé pour vous connecter à votre boutique</span>
                  </div>

                  <button
                    type="button"
                    id="btn-next-step"
                    className="btn btn-primary auth-submit"
                    onClick={() => setStep(2)}
                    disabled={!form.boutique_name || !form.boutique_slug}
                  >
                    Continuer →
                  </button>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Votre nom complet</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Mamadou Diallo"
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Adresse email</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="vous@exemple.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Téléphone (optionnel)</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="+224 6XX XX XX XX"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mot de passe</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Min. 8 caractères, 1 majuscule, 1 chiffre"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                      minLength={8}
                    />
                  </div>

                  <div className="terms-agreement-note" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0.75rem 0' }}>
                    En créant un compte, vous acceptez nos <Link href="/terms" target="_blank" style={{ color: '#10b981', textDecoration: 'underline' }}>Conditions d'Utilisation</Link> et autorisez BoutikFlow / TrillionX à veiller sur la protection de vos données.
                  </div>

                  <div className="register-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setStep(1)}
                    >
                      ← Retour
                    </button>
                    <button
                      type="submit"
                      id="btn-register"
                      className="btn btn-primary"
                      disabled={isLoading}
                      style={{ flex: 1 }}
                    >
                      {isLoading ? (
                        <><span className="spinner" /> Création...</>
                      ) : (
                        <span className="flex items-center gap-2">Créer ma boutique <Rocket size={18} /></span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>

            <div className="auth-footer">
              <span className="auth-footer-text">Déjà une boutique ?</span>
              <Link href="/login" className="auth-footer-link">Se connecter</Link>
            </div>
          </div>

          {/* Benefits sidebar - no prices */}
          <div className="plans-preview">
            <div className="benefits-header">
              <h3>Ce que vous obtenez</h3>
              <p>Tout ce dont votre boutique a besoin pour grandir.</p>
            </div>
            <div className="benefits-list">
              {plans.map((p, i) => (
                <div key={i} className="benefit-item">
                  <div className="benefit-icon">{p.icon}</div>
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
            <div className="benefits-trust">
              <p>Données sécurisées · Conçu pour l&apos;Afrique · 100% Mobile</p>
            </div>
          </div>
        </div>
        )}
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
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, var(--auth-glow-color) 0%, transparent 70%);
        }
        .register-container {
          position: relative;
          width: 100%;
          max-width: 860px;
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
        .register-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          width: 100%;
        }
        @media (max-width: 680px) {
          .register-layout { grid-template-columns: 1fr; }
          .plans-preview { display: none; }
        }
        .auth-card {
          border-radius: var(--radius-xl);
          padding: 2rem;
          box-shadow: var(--shadow-lg);
        }
        .auth-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .auth-title { font-size: 1.4rem; margin-bottom: 0.375rem; }
        .auth-subtitle { color: var(--text-secondary); font-size: 0.9rem; }
        .steps-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 1.75rem;
          position: relative;
        }
        .step-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
          background: var(--surface-3);
          border: 2px solid var(--border-default);
          color: var(--text-muted);
          transition: var(--transition-base);
          z-index: 1;
        }
        .step-dot.active {
          background: var(--color-brand-600);
          border-color: var(--color-brand-500);
          color: white;
          box-shadow: 0 0 0 4px var(--focus-ring-color);
        }
        .step-line {
          width: 60px;
          height: 2px;
          background: var(--border-default);
          transition: var(--transition-base);
        }
        .step-line.active { background: var(--color-brand-500); }
        .auth-form { display: flex; flex-direction: column; gap: 1.125rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-label { font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); }
        .form-hint { font-size: 0.75rem; color: var(--text-muted); }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-prefix {
          position: absolute;
          left: 0.875rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          pointer-events: none;
          white-space: nowrap;
        }
        .input-with-prefix { padding-left: 8.5rem !important; }
        .auth-submit {
          width: 100%;
          justify-content: center;
          padding: 0.75rem;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }
        .register-actions {
          display: flex;
          gap: 0.75rem;
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
          margin-top: 1.25rem;
          padding-top: 1.25rem;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.875rem;
        }
        .auth-footer-text { color: var(--text-muted); }
        .auth-footer-link {
          color: var(--color-brand-600);
          font-weight: 600;
          text-decoration: none;
        }
        /* Benefits Sidebar */
        .plans-preview {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          justify-content: center;
        }
        .benefits-header h3 {
          font-family: var(--font-display);
          font-size: 1.15rem;
          font-weight: 700;
          margin-bottom: 0.375rem;
          color: var(--text-primary);
        }
        .benefits-header p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .benefits-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .benefit-item {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 1rem;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          font-size: 0.875rem;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }
        .benefit-item:hover {
          border-color: rgba(52, 211, 153, 0.25);
          color: var(--text-primary);
        }
        .benefit-icon {
          color: var(--color-brand-400);
          flex-shrink: 0;
        }
        .benefits-trust {
          font-size: 0.75rem;
          color: var(--text-disabled);
          text-align: center;
          line-height: 1.5;
          padding: 0.5rem;
        }

        /* Success Screen */
        .success-card {
          max-width: 480px;
          width: 100%;
          text-align: center;
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }
        .success-icon {
          color: var(--color-brand-400);
          animation: fadeIn 0.6s ease forwards;
        }
        .success-steps {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
          text-align: left;
        }
        .success-step {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
          padding: 0.625rem 0.875rem;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
        }
        .success-step-num {
          width: 24px;
          height: 24px;
          background: var(--color-brand-600);
          color: white;
          border-radius: 50%;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
