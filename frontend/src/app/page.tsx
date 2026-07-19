'use client';

import Link from 'next/link';
import { MapPin, MessageSquareText, Users, Package, BarChart3, Bot, Smartphone } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function HomePage() {
  return (
    <main className="landing">
      {/* Background */}
      <div className="landing-bg-grid" />
      <div className="landing-glow-top" />
      <div className="landing-glow-bottom" />

      {/* Navbar */}
      <nav className="landing-nav glass">
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#navgrad)" />
              <path d="M9 14L12.5 17.5L19 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="navgrad" x1="2" y1="2" x2="26" y2="26">
                  <stop stopColor="#10b981" /><stop offset="1" stopColor="#047857" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="nav-logo-text">BoutikFlow</span>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <Link href="/login" className="btn btn-ghost" id="btn-nav-login">Se connecter</Link>
          <Link href="/register" className="btn btn-primary" id="btn-nav-register">Créer ma boutique</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge badge-success"><MapPin size={14} className="mr-1" /> Fait pour la Guinée</span>
        </div>
        <h1 className="hero-title">
          Vendez plus via <br />
          <span className="text-gradient">WhatsApp</span>
        </h1>
        <p className="hero-subtitle">
          BoutikFlow est le CRM intelligent conçu pour les boutiques africaines.
          Gérez vos clients, automatisez vos ventes WhatsApp et ne perdez plus jamais une vente.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="btn btn-primary hero-cta" id="btn-hero-start">
            Créer ma boutique
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link href="/login" className="btn btn-ghost hero-cta-secondary" id="btn-hero-login">
            J&apos;ai déjà une boutique
          </Link>
        </div>
        <div className="hero-stats">
          {[
            { value: '50 000 GNF', label: 'Pour commencer' },
            { value: 'WhatsApp', label: 'Intégration native' },
            { value: 'Assistant virtuel', label: 'Réponses intelligentes' },
          ].map(stat => (
            <div key={stat.label} className="hero-stat">
              <span className="hero-stat-value">{stat.value}</span>
              <span className="hero-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="section-header">
          <h2>Tout ce dont votre boutique a besoin</h2>
          <p>Une plateforme complète pour vendre via WhatsApp</p>
        </div>
        <div className="features-grid">
          {[
            {
              icon: <MessageSquareText size={32} className="text-brand-500" />,
              title: 'WhatsApp Automatique',
              desc: 'Répondez automatiquement à vos clients 24h/7j. Menus interactifs, messages de bienvenue et relances automatiques.',
            },
            {
              icon: <Users size={32} className="text-brand-500" />,
              title: 'CRM Clients',
              desc: 'Fiche client complète avec historique, tags, statut VIP et notes. Ne perdez plus jamais un client.',
            },
            {
              icon: <Package size={32} className="text-brand-500" />,
              title: 'Catalogue Produits',
              desc: 'Gérez votre catalogue avec images, prix et stocks. Vos clients peuvent commander directement via WhatsApp.',
            },
            {
              icon: <BarChart3 size={32} className="text-brand-500" />,
              title: 'Tableau de Bord',
              desc: 'Suivez vos ventes en temps réel. Chiffre d\'affaires, commandes, clients actifs et tendances.',
            },
            {
              icon: <Bot size={32} className="text-brand-500" />,
              title: 'Assistant virtuel',
              desc: 'Générez des réponses intelligentes, résumez les conversations et analysez vos clients avec votre assistant virtuel.',
            },
            {
              icon: <Smartphone size={32} className="text-brand-500" />,
              title: '100% Mobile',
              desc: 'Interface optimisée pour votre téléphone. Gérez votre boutique depuis n\'importe où.',
            },
          ].map(f => (
            <div key={f.title} className="feature-card card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing">
        <div className="section-header">
          <h2>Tarifs simples et transparents</h2>
          <p>Des tarifs accessibles, évoluez selon vos besoins</p>
        </div>
        <div className="pricing-grid">
          {[
            {
              name: 'Freemium',
              price: '50 000',
              period: 'GNF / mois',
              features: ['1 utilisateur', '50 clients max', 'Réponses auto simples', 'Catalogue limité', 'Dashboard basique'],
              cta: 'Commencer',
              href: '/register',
              highlighted: false,
            },
            {
              name: 'Starter',
              price: '800 000',
              period: 'GNF / mois',
              features: ['Clients illimités', 'Automatisation avancée', 'Relances automatiques', 'Assistant virtuel intégré', 'Support prioritaire'],
              cta: 'Démarrer l\'essai',
              href: '/register',
              highlighted: true,
            },
            {
              name: 'Pro',
              price: '1 500 000',
              period: 'GNF / mois',
              features: ['Multi-utilisateurs', 'Dashboard avancé', 'Rapports exportables', 'Assistant virtuel premium', 'Support dédié'],
              cta: 'Contacter l\'équipe',
              href: '/register',
              highlighted: false,
            },
          ].map(plan => (
            <div key={plan.name} className={`pricing-card glass ${plan.highlighted ? 'pricing-highlighted' : ''}`}>
              {plan.highlighted && <div className="pricing-badge">Populaire</div>}
              <div className="pricing-name">{plan.name}</div>
              <div className="pricing-price">
                <span className="pricing-amount">{plan.price}</span>
                <span className="pricing-period">{plan.period}</span>
              </div>
              <ul className="pricing-features">
                {plan.features.map(f => (
                  <li key={f} className="pricing-feature">
                    <span className="pricing-check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`btn ${plan.highlighted ? 'btn-primary' : 'btn-ghost'} pricing-cta`}
                id={`btn-pricing-${plan.name.toLowerCase()}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-logo">
          <span className="text-gradient" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>BoutikFlow</span>
        </div>
        <p className="footer-text">© 2026 BoutikFlow. Conçu pour les commerçants guinéens.</p>
      </footer>

      <style jsx>{`
        .landing {
          min-height: 100vh;
          background: var(--surface-0);
          position: relative;
          overflow: hidden;
        }
        .landing-bg-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(16,185,129,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.025) 1px, transparent 1px);
          background-size: 50px 50px;
          pointer-events: none;
        }
        .landing-glow-top {
          position: fixed;
          top: -300px;
          left: 50%;
          transform: translateX(-50%);
          width: 1000px;
          height: 800px;
          background: radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .landing-glow-bottom {
          position: fixed;
          bottom: -300px;
          right: -200px;
          width: 600px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(16,185,129,0.04) 0%, transparent 70%);
          pointer-events: none;
        }

        /* Navbar */
        .landing-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          border-bottom: 1px solid var(--border-subtle);
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }
        .nav-logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-2);
          border: 1px solid var(--border-default);
        }
        .nav-logo-text {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
          background: linear-gradient(135deg, #10b981, #047857);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nav-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        /* Hero */
        .hero {
          position: relative;
          max-width: 800px;
          margin: 0 auto;
          padding: 6rem 2rem 4rem;
          text-align: center;
          animation: fadeIn 0.6s ease forwards;
        }
        .hero-badge { margin-bottom: 1.5rem; }
        .hero-title {
          font-size: clamp(2.5rem, 7vw, 4.5rem);
          line-height: 1.1;
          margin-bottom: 1.5rem;
          letter-spacing: -0.03em;
        }
        .hero-subtitle {
          font-size: 1.125rem;
          color: var(--text-secondary);
          line-height: 1.7;
          max-width: 600px;
          margin: 0 auto 2.5rem;
        }
        .hero-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 3rem;
        }
        .hero-cta {
          padding: 0.875rem 1.75rem;
          font-size: 1rem;
          gap: 0.625rem;
        }
        .hero-cta-secondary { padding: 0.875rem 1.5rem; font-size: 1rem; }
        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 3rem;
          flex-wrap: wrap;
        }
        .hero-stat {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .hero-stat-value {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-brand-400);
        }
        .hero-stat-label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        /* Features */
        .features {
          position: relative;
          max-width: 1100px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }
        .section-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        .section-header h2 { margin-bottom: 0.75rem; }
        .section-header p { color: var(--text-secondary); font-size: 1.05rem; }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.25rem;
        }
        .feature-card { cursor: default; }
        .feature-icon { font-size: 2rem; margin-bottom: 1rem; }
        .feature-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .feature-desc {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* Pricing */
        .pricing {
          position: relative;
          max-width: 1000px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
          align-items: start;
        }
        .pricing-card {
          border-radius: var(--radius-xl);
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }
        .pricing-highlighted {
          border-color: rgba(16,185,129,0.3) !important;
          box-shadow: var(--shadow-brand);
        }
        .pricing-badge {
          position: absolute;
          top: 1rem;
          right: 1rem;
          font-size: 0.7rem;
          font-weight: 700;
          background: var(--color-brand-600);
          color: white;
          padding: 0.25rem 0.625rem;
          border-radius: 100px;
        }
        .pricing-name {
          font-family: var(--font-display);
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .pricing-price {
          display: flex;
          flex-direction: column;
          margin-bottom: 1.5rem;
        }
        .pricing-amount {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--color-brand-400);
        }
        .pricing-period {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          margin-bottom: 1.75rem;
        }
        .pricing-feature {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        .pricing-check {
          color: var(--color-brand-500);
          font-weight: 700;
        }
        .pricing-cta {
          width: 100%;
          justify-content: center;
        }

        /* Footer */
        .landing-footer {
          position: relative;
          text-align: center;
          padding: 3rem 2rem;
          border-top: 1px solid var(--border-subtle);
        }
        .footer-logo { margin-bottom: 0.75rem; font-size: 1.25rem; }
        .footer-text { color: var(--text-muted); font-size: 0.875rem; }
      `}</style>
    </main>
  );
}
