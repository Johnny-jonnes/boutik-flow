'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  MapPin, 
  MessageSquareText, 
  Users, 
  Package, 
  BarChart3, 
  Bot, 
  Smartphone, 
  CheckCircle, 
  ShieldCheck, 
  Zap, 
  Globe, 
  ArrowRight, 
  Sparkles,
  ChevronDown,
  Layers,
  Sparkle
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`faq-item ${isOpen ? 'faq-open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
      <div className="faq-question">
        <span>{question}</span>
        <ChevronDown size={18} className="faq-arrow" />
      </div>
      <div className="faq-answer">
        <p>{answer}</p>
      </div>
      <style jsx>{`
        .faq-item {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 0.75rem;
        }
        .faq-item:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--color-brand-400);
        }
        .faq-question {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          color: var(--text-primary);
          font-size: 1rem;
        }
        .faq-arrow {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--text-muted);
        }
        .faq-open .faq-arrow {
          transform: rotate(180deg);
          color: var(--color-brand-400);
        }
        .faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.3s ease;
        }
        .faq-open .faq-answer {
          max-height: 200px;
          margin-top: 0.75rem;
        }
        .faq-answer p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}

export default function HomePage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly' | 'lifetime'>('monthly');

  const plans = {
    monthly: [
      {
        name: 'Pack Standard',
        badge: 'idéal pour démarrer',
        features: [
          'Réponse automatique intelligente',
          'Gestion de 100 clients actifs',
          'Catalogue produits basique',
          'Rapports de ventes hebdomadaires',
          'Support par e-mail standard'
        ],
        highlighted: false,
        cta: 'Essayer BoutikFlow'
      },
      {
        name: 'Pack Pro',
        badge: 'le plus populaire',
        features: [
          'Clients et ventes illimités',
          'Relances intelligentes par relance WhatsApp',
          'Assistant virtuel IA inclus',
          'Génération de SKU et codes barres',
          'Support WhatsApp prioritaire'
        ],
        highlighted: true,
        cta: 'Lancer ma boutique'
      },
      {
        name: 'Pack Entreprise',
        badge: 'recommandé pour la croissance',
        features: [
          'Multi-boutiques & multi-utilisateurs',
          'Automatisation marketing poussée',
          'Export comptable en un clic',
          'Accès API & intégrations dédiées',
          'Gestionnaire de compte dédié'
        ],
        highlighted: false,
        cta: 'Contactez-nous'
      }
    ],
    yearly: [
      {
        name: 'Pack Standard (Annuel)',
        badge: '2 mois gratuits inclus',
        features: [
          'Réponse automatique intelligente',
          'Gestion de 200 clients actifs',
          'Catalogue produits complet',
          'Rapports de ventes hebdomadaires',
          'Support par e-mail & WhatsApp'
        ],
        highlighted: false,
        cta: 'Essayer BoutikFlow'
      },
      {
        name: 'Pack Pro (Annuel)',
        badge: 'meilleur rapport qualité/prix',
        features: [
          'Clients et ventes illimités',
          'Relances intelligentes par relance WhatsApp',
          'Assistant virtuel IA inclus',
          'Génération de SKU et codes barres',
          'Support WhatsApp prioritaire 24/7'
        ],
        highlighted: true,
        cta: 'Lancer ma boutique'
      },
      {
        name: 'Pack Entreprise (Annuel)',
        badge: 'recommandé pour la croissance',
        features: [
          'Multi-boutiques & multi-utilisateurs',
          'Automatisation marketing poussée',
          'Export comptable en un clic',
          'Accès API & intégrations dédiées',
          'Gestionnaire de compte dédié'
        ],
        highlighted: false,
        cta: 'Contactez-nous'
      }
    ],
    lifetime: [
      {
        name: 'Pack Standard à Vie',
        badge: 'licence perpétuelle standard',
        features: [
          'Réponse automatique intelligente',
          'Gestion de 500 clients actifs',
          'Catalogue produits complet',
          'Mises à jour standard incluses à vie',
          'Support client standard à vie'
        ],
        highlighted: false,
        cta: 'Essayer BoutikFlow'
      },
      {
        name: 'Pack Pro à Vie',
        badge: 'recommandé pour les leaders',
        features: [
          'Clients, ventes et produits illimités',
          'Relances intelligentes par relance WhatsApp à vie',
          'Assistant virtuel IA inclus à vie',
          'Accès prioritaire à toutes les nouveautés',
          'Support client VIP à vie'
        ],
        highlighted: true,
        cta: 'Lancer ma boutique'
      },
      {
        name: 'Pack Entreprise à Vie',
        badge: 'solution complète illimitée',
        features: [
          'Multi-boutiques & multi-utilisateurs illimités',
          'Toutes les automatisations incluses à vie',
          'Hébergement et bande passante inclus à vie',
          'Déploiement sur mesure',
          'Support VIP téléphonique dédié 24/7'
        ],
        highlighted: false,
        cta: 'Contactez-nous'
      }
    ]
  };

  return (
    <main className="landing">
      {/* Background elements */}
      <div className="landing-bg-grid" />
      <div className="landing-glow-top" />
      <div className="landing-glow-bottom" />

      {/* Navbar */}
      <nav className="landing-nav glass">
        <div className="nav-logo">
          <div className="nav-logo-icon">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="nav-hex-grad" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#818cf8" />
                  <stop offset="1" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="nav-wave-amber" x1="0" y1="0" x2="40" y2="0">
                  <stop stopColor="#fbbf24" stopOpacity="0" />
                  <stop offset="0.4" stopColor="#f59e0b" />
                  <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
                </linearGradient>
                <filter id="nav-glow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              {/* Hexagon */}
              <path d="M20 2L36 11V29L20 38L4 29V11L20 2Z" fill="url(#nav-hex-grad)" opacity="0.95" />
              <path d="M20 2L36 11V29L20 38L4 29V11L20 2Z" stroke="rgba(129,140,248,0.3)" strokeWidth="0.5" fill="none" />
              {/* Wave line 1 — top, white, subtle */}
              <path d="M8 15 Q14 12 20 15 Q26 18 32 15" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              {/* Wave line 2 — middle, white bright */}
              <path d="M8 20 Q14 16 20 20 Q26 24 32 20" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              {/* Wave line 2 — amber accent overlay */}
              <path d="M8 20 Q14 16 20 20 Q26 24 32 20" stroke="url(#nav-wave-amber)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.7" />
              {/* Wave line 3 — bottom, white subtle */}
              <path d="M8 25 Q14 22 20 25 Q26 28 32 25" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <span className="nav-logo-text">
            <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>Boutik</span><span style={{ background: 'linear-gradient(135deg, #818cf8, #4f46e5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Flow</span>
          </span>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <Link href="/login" className="btn btn-ghost" id="btn-nav-login">Se connecter</Link>
          <Link href="/register" className="btn btn-primary" id="btn-nav-register">Essayer BoutikFlow</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge badge-success"><MapPin size={14} className="mr-1" /> Conçu pour les commerçants africains</span>
        </div>
        <h1 className="hero-title">
          Ne perdez plus aucun client sur <span className="text-gradient">WhatsApp</span>
        </h1>
        <p className="hero-subtitle">
          Le premier assistant intelligent qui répond instantanément à vos acheteurs, gère vos stocks et centralise vos commandes 24h/24. Développez votre chiffre d'affaires sans effort.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="btn btn-primary hero-cta animate-pulse-light" id="btn-hero-start">
            Commencer gratuitement
            <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="btn btn-ghost hero-cta-secondary" id="btn-hero-login">
            Accéder à mon espace
          </Link>
        </div>
        <div className="hero-stats">
          {[
            { value: '24h/7j', label: 'Disponibilité absolue' },
            { value: '100% Automatique', label: 'Prise de commandes' },
            { value: '0 Client Perdu', label: 'Satisfaction garantie' },
          ].map(stat => (
            <div key={stat.label} className="hero-stat">
              <span className="hero-stat-value">{stat.value}</span>
              <span className="hero-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Credibility section */}
      <section className="credibility-section">
        <div className="cred-grid">
          <div className="cred-card">
            <Smartphone size={24} className="text-brand-400" />
            <h3>100% Mobile & Rapide</h3>
            <p>Pilotez votre boutique directement depuis votre téléphone ou votre tablette, où que vous soyez.</p>
          </div>
          <div className="cred-card">
            <ShieldCheck size={24} className="text-brand-400" />
            <h3>Données Sécurisées</h3>
            <p>Vos conversations, fiches clients et historiques de ventes sont cryptés et stockés en toute sécurité.</p>
          </div>
          <div className="cred-card">
            <Zap size={24} className="text-brand-400" />
            <h3>Synchro Temps Réel</h3>
            <p>Dès qu'un client commande sur WhatsApp, vos stocks se mettent à jour instantanément.</p>
          </div>
          <div className="cred-card">
            <Sparkles size={24} className="text-brand-400" />
            <h3>Assistant IA intégré</h3>
            <p>Optimisez vos descriptions de produits et générez des réponses intelligentes automatiques.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="section-header">
          <h2>Faites grandir votre boutique simplement</h2>
          <p>Toutes les fonctionnalités pensées pour maximiser la satisfaction client et simplifier votre quotidien.</p>
        </div>
        <div className="features-grid">
          {[
            {
              icon: <MessageSquareText size={32} className="text-brand-500" />,
              title: 'Réponses instantanées 24h/7j',
              desc: 'Notre assistant WhatsApp intelligent accueille vos clients, répond aux questions fréquentes et prend les commandes même pendant que vous dormez.',
            },
            {
              icon: <Users size={32} className="text-brand-500" />,
              title: 'CRM Clients & Fidélisation',
              desc: "Retrouvez instantanément l'historique de chaque client, catégorisez-les avec des étiquettes intelligentes et personnalisez vos échanges pour multiplier vos ventes.",
            },
            {
              icon: <Package size={32} className="text-brand-500" />,
              title: 'Gestion de stock intelligente',
              desc: 'Ajoutez vos produits, gérez vos prix et suivez l\'inventaire en temps réel. Fini les ruptures imprévues ou les erreurs de prix communiqués.',
            },
            {
              icon: <BarChart3 size={32} className="text-brand-500" />,
              title: 'Tableau de bord de performance',
              desc: 'Suivez la croissance de votre chiffre d\'affaires, le volume de commandes et l\'activité de vos clients en un clin d\'œil sur des graphiques clairs.',
            },
            {
              icon: <Bot size={32} className="text-brand-500" />,
              title: 'Remplissage Assisté par IA',
              desc: 'Prenez une photo de votre produit et laissez notre intelligence artificielle rédiger des descriptions captivantes et générer des fiches produits complètes.',
            },
            {
              icon: <Layers size={32} className="text-brand-500" />,
              title: 'Scanner POS Intégré',
              desc: 'Enregistrez vos ventes physiques instantanément grâce au scanner de code-barres et SKU directement depuis l\'appareil photo de votre mobile.',
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

      {/* Why Choose BoutikFlow Section */}
      <section className="why-choose">
        <div className="section-header">
          <h2>Pourquoi choisir BoutikFlow ?</h2>
          <p>Le meilleur allié pour digitaliser votre activité et accélérer votre croissance commerciale.</p>
        </div>
        <div className="why-grid">
          <div className="why-item">
            <div className="why-num">1</div>
            <div>
              <h3>Focalisé sur la rentabilité</h3>
              <p>Chaque message automatique est conçu pour amener le client vers l'achat et réduire les abandons.</p>
            </div>
          </div>
          <div className="why-item">
            <div className="why-num">2</div>
            <div>
              <h3>Zéro formation requise</h3>
              <p>Une interface claire, ergonomique et épurée que vous et vos employés prendrez en main en moins de 10 minutes.</p>
            </div>
          </div>
          <div className="why-item">
            <div className="why-num">3</div>
            <div>
              <h3>Proximité client préservée</h3>
              <p>L'IA qualifie le client, vous prenez le relais quand vous le souhaitez pour finaliser les ventes importantes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing">
        <div className="section-header">
          <h2>Formules adaptées à vos besoins</h2>
          <p>Aucun frais caché. Choisissez l'accès qui correspond à la dynamique de votre commerce.</p>
        </div>

        {/* Billing Period Selector */}
        <div className="pricing-toggle-container">
          <div className="pricing-toggle-bar">
            <button 
              className={`toggle-btn ${billingPeriod === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('monthly')}
            >
              Mensuel
            </button>
            <button 
              className={`toggle-btn ${billingPeriod === 'yearly' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('yearly')}
            >
              Annuel
            </button>
            <button 
              className={`toggle-btn ${billingPeriod === 'lifetime' ? 'active' : ''}`}
              onClick={() => setBillingPeriod('lifetime')}
            >
              À vie
            </button>
          </div>
        </div>

        <div className="pricing-grid">
          {plans[billingPeriod].map(plan => (
            <div key={plan.name} className={`pricing-card glass ${plan.highlighted ? 'pricing-highlighted' : ''}`}>
              <div className="pricing-badge">{plan.badge}</div>
              <div className="pricing-name">{plan.name}</div>
              
              <div className="pricing-price">
                <span className="pricing-amount">Tarif sur demande</span>
                <span className="pricing-period">Contactez notre support pour activer</span>
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
                href="/register"
                className={`btn ${plan.highlighted ? 'btn-primary' : 'btn-ghost'} pricing-cta`}
                id={`btn-pricing-${plan.name.replace(/\s+/g, '-').toLowerCase()}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="section-header">
          <h2>Questions fréquentes</h2>
          <p>Toutes les réponses à vos interrogations pour démarrer sereinement.</p>
        </div>
        <div className="faq-grid">
          <FAQItem 
            question="Dois-je utiliser un compte WhatsApp Business ?" 
            answer="BoutikFlow fonctionne aussi bien avec un compte WhatsApp classique qu'avec un compte WhatsApp Business. L'intégration s'effectue simplement en quelques secondes." 
          />
          <FAQItem 
            question="Puis-je conserver mon numéro de téléphone actuel ?" 
            answer="Oui absolument. Vous n'avez pas besoin d'acheter une nouvelle carte SIM. Vous connectez votre numéro de téléphone habituel directement sur notre plateforme." 
          />
          <FAQItem 
            question="Est-il possible de gérer plusieurs boutiques à la fois ?" 
            answer="Oui, nos plans avancés (Pack Entreprise) vous permettent de configurer et basculer facilement entre plusieurs boutiques à partir du même tableau de bord." 
          />
          <FAQItem 
            question="Mes données et celles de mes clients sont-elles sécurisées ?" 
            answer="La sécurité est notre priorité absolue. Vos bases de données clients sont isolées par boutique, cryptées, et stockées sur des serveurs sécurisés sans aucun partage." 
          />
          <FAQItem 
            question="Puis-je annuler ou changer d'abonnement à tout moment ?" 
            answer="Oui, les formules mensuelles et annuelles sont sans engagement de durée. Vous pouvez annuler, suspendre ou modifier votre formule librement depuis votre espace." 
          />
          <FAQItem 
            question="L'application fonctionne-t-elle correctement sur mobile ?" 
            answer="Tout à fait. L'ensemble de l'interface commerçant a été pensé pour le mobile. Vous pouvez gérer vos stocks, ajouter des produits et valider des commandes directement en déplacement." 
          />
        </div>
      </section>

      {/* Footer Overhaul */}
      <footer className="landing-footer-premium">
        <div className="footer-cols">
          <div className="footer-brand-col">
            <span className="text-gradient brand-title-footer">BoutikFlow</span>
            <p className="brand-subtitle-footer">Le CRM WhatsApp conçu pour digitaliser et accélérer les ventes des commerçants.</p>
          </div>
          <div className="footer-links-col">
            <h4>Produit</h4>
            <Link href="#features">Fonctionnalités</Link>
            <Link href="#pricing">Tarification</Link>
            <Link href="/login">Espace Client</Link>
          </div>
          <div className="footer-links-col">
            <h4>Support & Contact</h4>
            <a href="mailto:trillionnx@gmail.com">trillionnx@gmail.com</a>
            <a href="tel:+224627171397">+224 627 17 13 97</a>
            <a href="tel:+224610935524">+224 610 93 55 24</a>
            <Link href="#faq">Centre d'aide</Link>
          </div>
          <div className="footer-links-col">
            <h4>Légal</h4>
            <Link href="/privacy">Politique de confidentialité</Link>
            <Link href="/terms">Conditions d'utilisation</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 BoutikFlow. Tous droits réservés. Conçu pour le commerce de demain.</p>
        </div>
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
            linear-gradient(rgba(16,185,129,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.02) 1px, transparent 1px);
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
          background: radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .landing-glow-bottom {
          position: fixed;
          bottom: -300px;
          right: -200px;
          width: 600px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(16,185,129,0.03) 0%, transparent 70%);
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
          padding: 1rem 2.5rem;
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
          font-size: 1.15rem;
          font-weight: 700;
          background: linear-gradient(135deg, #818cf8, #4f46e5);
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
          max-width: 900px;
          margin: 0 auto;
          padding: 6.5rem 2rem 4.5rem;
          text-align: center;
          animation: fadeIn 0.6s ease forwards;
        }
        .hero-badge { margin-bottom: 1.75rem; }
        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(2.25rem, 6.5vw, 4rem);
          line-height: 1.15;
          margin-bottom: 1.5rem;
          letter-spacing: -0.03em;
          font-weight: 800;
          color: var(--text-primary);
        }
        .hero-subtitle {
          font-size: 1.15rem;
          color: var(--text-secondary);
          line-height: 1.75;
          max-width: 680px;
          margin: 0 auto 2.75rem;
        }
        .hero-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 3.5rem;
        }
        .hero-cta {
          padding: 0.875rem 2rem;
          font-size: 1.05rem;
          gap: 0.625rem;
          font-weight: 600;
          box-shadow: var(--shadow-brand);
        }
        .hero-cta-secondary { padding: 0.875rem 1.75rem; font-size: 1.05rem; }
        
        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 4rem;
          flex-wrap: wrap;
          padding-top: 1.5rem;
          border-top: 1px solid var(--border-subtle);
          max-width: 600px;
          margin: 0 auto;
        }
        .hero-stat {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          align-items: center;
        }
        .hero-stat-value {
          font-family: var(--font-display);
          font-size: 1.4rem;
          font-weight: 800;
          color: var(--color-brand-400);
        }
        .hero-stat-label {
          font-size: 0.825rem;
          color: var(--text-muted);
        }

        /* Credibility cards */
        .credibility-section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem;
        }
        .cred-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
        }
        .cred-card {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: transform 0.2s ease;
        }
        .cred-card:hover {
          transform: translateY(-2px);
          border-color: rgba(52, 211, 153, 0.2);
        }
        .cred-card h3 {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .cred-card p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* Features */
        .features {
          position: relative;
          max-width: 1100px;
          margin: 0 auto;
          padding: 5rem 2rem;
        }
        .section-header {
          text-align: center;
          margin-bottom: 3.5rem;
        }
        .section-header h2 { 
          font-family: var(--font-display);
          font-size: 2.25rem;
          font-weight: 800;
          margin-bottom: 0.75rem; 
        }
        .section-header p { color: var(--text-secondary); font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
        
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
        }
        .feature-card { 
          cursor: default; 
          transition: all 0.3s ease;
          border: 1px solid var(--border-subtle);
          padding: 2.25rem 2rem;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          border-color: rgba(52, 211, 153, 0.25);
          box-shadow: var(--shadow-md);
        }
        .feature-icon { font-size: 2rem; margin-bottom: 1.25rem; }
        .feature-title {
          font-size: 1.15rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
          color: var(--text-primary);
        }
        .feature-desc {
          font-size: 0.925rem;
          color: var(--text-secondary);
          line-height: 1.65;
        }

        /* Why Choose Section */
        .why-choose {
          max-width: 900px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }
        .why-grid {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .why-item {
          display: flex;
          gap: 1.25rem;
          align-items: flex-start;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-subtle);
          padding: 1.5rem;
          border-radius: 16px;
          transition: all 0.25s ease;
        }
        .why-item:hover {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(52, 211, 153, 0.2);
        }
        .why-num {
          background: var(--color-brand-600);
          color: white;
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .why-item h3 {
          font-size: 1.05rem;
          font-weight: 700;
          margin-bottom: 0.375rem;
          color: var(--text-primary);
        }
        .why-item p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* Pricing Toggle */
        .pricing-toggle-container {
          display: flex;
          justify-content: center;
          margin-bottom: 3rem;
        }
        .pricing-toggle-bar {
          background: var(--surface-2);
          border: 1px solid var(--border-subtle);
          padding: 0.375rem;
          border-radius: 100px;
          display: flex;
          gap: 4px;
        }
        .toggle-btn {
          border: none;
          background: transparent;
          color: var(--text-muted);
          padding: 0.5rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          border-radius: 100px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .toggle-btn.active {
          background: var(--color-brand-600);
          color: white;
        }

        /* Pricing */
        .pricing {
          position: relative;
          max-width: 1100px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          align-items: start;
        }
        .pricing-card {
          border-radius: var(--radius-xl);
          padding: 2.5rem 2rem;
          position: relative;
          overflow: hidden;
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
        }
        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
        .pricing-highlighted {
          border-color: rgba(16,185,129,0.3) !important;
          box-shadow: var(--shadow-brand);
          background: linear-gradient(180deg, var(--surface-1) 0%, rgba(16,185,129,0.02) 100%);
        }
        .pricing-badge {
          position: absolute;
          top: 1rem;
          right: 1.25rem;
          font-size: 0.72rem;
          font-weight: 700;
          background: var(--color-brand-600);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 100px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pricing-name {
          font-family: var(--font-display);
          font-size: 1.3rem;
          font-weight: 800;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }
        .pricing-price {
          display: flex;
          flex-direction: column;
          margin-bottom: 2rem;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 1.5rem;
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
          margin-top: 0.25rem;
        }
        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 2.25rem;
          padding: 0;
          flex-grow: 1;
        }
        .pricing-feature {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .pricing-check {
          color: var(--color-brand-400);
          font-weight: 700;
        }
        .pricing-cta {
          width: 100%;
          justify-content: center;
          padding: 0.875rem;
          font-weight: 600;
        }

        /* FAQ */
        .faq-section {
          max-width: 800px;
          margin: 0 auto;
          padding: 5rem 2rem;
        }
        .faq-grid {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        /* Premium Footer */
        .landing-footer-premium {
          padding: 5rem 2rem 3rem;
          border-top: 1px solid var(--border-subtle);
          background: rgba(255, 255, 255, 0.005);
          position: relative;
        }
        .footer-cols {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 3rem;
          margin-bottom: 4rem;
        }
        @media (max-width: 768px) {
          .footer-cols {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
          .landing-nav {
            padding: 0.75rem 1rem !important;
          }
          .nav-logo-text {
            font-size: 1rem !important;
          }
          .nav-actions {
            gap: 0.35rem !important;
          }
          .nav-actions .btn {
            padding: 0.4rem 0.65rem !important;
            font-size: 0.75rem !important;
            height: auto !important;
          }
        }
        .footer-brand-col {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .brand-title-footer {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 800;
        }
        .brand-subtitle-footer {
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.6;
          max-width: 320px;
        }
        .footer-links-col {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .footer-links-col h4 {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .footer-links-col a {
          font-size: 0.9rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .footer-links-col a:hover {
          color: var(--color-brand-400);
        }
        .footer-bottom {
          border-top: 1px solid var(--border-subtle);
          padding-top: 2rem;
          text-align: center;
          max-width: 1100px;
          margin: 0 auto;
        }
        .footer-bottom p {
          font-size: 0.825rem;
          color: var(--text-disabled);
        }

        /* Pulsing light effect */
        .animate-pulse-light {
          animation: pulse-light 2s infinite;
        }
        @keyframes pulse-light {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          50% {
            box-shadow: 0 0 15px 4px rgba(16, 185, 129, 0.25);
          }
        }
      `}</style>
    </main>
  );
}
