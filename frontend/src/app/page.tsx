'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import {
  MapPin,
  Store,
  Users,
  Package,
  BarChart3,
  Bot,
  Smartphone,
  ShieldCheck,
  WifiOff,
  ArrowRight,
  ChevronDown,
  ScanBarcode,
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
  return (
    <main className="landing">
      {/* Background elements */}
      <div className="landing-bg-grid" />
      <div className="landing-glow-top" />
      <div className="landing-glow-bottom" />

      {/* Navbar */}
      <nav className="landing-nav glass">
        <div className="nav-logo">
          <div className="nav-logo-icon" style={{ background: 'transparent', border: 'none', width: 'auto', height: 'auto' }}>
            <BrandMark size={36} />
          </div>
          <span className="nav-logo-text">BoutikFlow</span>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <Link href="/login" className="btn btn-ghost hide-on-xs" id="btn-nav-login">Se connecter</Link>
          <Link href="/register" className="btn btn-primary nav-cta-btn" id="btn-nav-register">
            <span className="hide-on-xs-btn">Essayer BoutikFlow</span>
            <span className="show-on-xs-btn">Essayer</span>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge">
          <span className="badge badge-success"><MapPin size={14} className="mr-1" /> Conçu pour les commerçants africains</span>
        </div>
        <h1 className="hero-title">
          Votre boutique, en magasin <span className="text-gradient">et</span> en ligne
        </h1>
        <p className="hero-subtitle">
          BoutikFlow enregistre vos ventes en caisse, suit votre stock en temps réel et donne à votre boutique une vraie page en ligne — catalogue, recherche, et un bouton pour que vos clients vous contactent directement sur WhatsApp. Même sans connexion, rien n'est perdu : tout se synchronise dès que le réseau revient.
        </p>
        <div className="hero-actions">
          <Link href="/register" className="btn btn-primary hero-cta animate-pulse-light" id="btn-hero-start">
            Créer ma boutique
            <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="btn btn-ghost hero-cta-secondary" id="btn-hero-login">
            Accéder à mon espace
          </Link>
        </div>
        <div className="hero-stats">
          {[
            { value: 'Hors-ligne', label: 'La caisse marche sans Internet' },
            { value: 'Vitrine incluse', label: 'Une page publique par boutique' },
            { value: 'Multi-rôles', label: "Toute l'équipe, un accès chacun" },
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
            <WifiOff size={24} className="text-brand-400" />
            <h3>Fonctionne hors-ligne</h3>
            <p>Une coupure réseau n'arrête jamais une vente : elle s'enregistre localement et se synchronise dès que la connexion revient.</p>
          </div>
          <div className="cred-card">
            <Bot size={24} className="text-brand-400" />
            <h3>IA pour vos fiches produits</h3>
            <p>Prenez une photo d'un article : l'IA rédige le nom, la catégorie et la description à votre place.</p>
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
              icon: <Store size={32} className="text-brand-500" />,
              title: 'Vitrine publique incluse',
              desc: "Chaque boutique a sa propre page en ligne — catégories, recherche, fiches produits avec photo — partageable en un lien ou un QR code. Un bouton WhatsApp laisse vos clients vous écrire directement.",
            },
            {
              icon: <Users size={32} className="text-brand-500" />,
              title: 'CRM Clients & Dettes',
              desc: "Retrouvez l'historique de chaque client, organisez-les par segments, et suivez précisément qui vous doit quoi.",
            },
            {
              icon: <Package size={32} className="text-brand-500" />,
              title: 'Stock sans erreur',
              desc: "Chaque vente verrouille la ligne de stock concernée avant de la débiter : impossible de vendre deux fois le même dernier article, même avec plusieurs vendeurs en même temps.",
            },
            {
              icon: <BarChart3 size={32} className="text-brand-500" />,
              title: 'Tableau de bord de performance',
              desc: "Suivez votre chiffre d'affaires, vos produits qui se vendent le mieux et l'activité de votre équipe — masquable par rôle si vous ne voulez pas que tout le monde voie les chiffres.",
            },
            {
              icon: <Bot size={32} className="text-brand-500" />,
              title: 'Fiches produits assistées par IA',
              desc: "Prenez une photo de votre produit : l'IA propose un nom, une catégorie et une description prêts à publier.",
            },
            {
              icon: <ScanBarcode size={32} className="text-brand-500" />,
              title: 'Scanner code-barres intégré',
              desc: "Enregistrez vos ventes en scannant le code-barres ou le SKU directement depuis l'appareil photo de votre téléphone.",
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
              <h3>Fiable même sans réseau stable</h3>
              <p>Pensé pour des connexions qui coupent : vos ventes ne dépendent jamais d'Internet pour être enregistrées.</p>
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
              <h3>Vous gardez le contact direct</h3>
              <p>Pas de robot entre vous et vos clients : la vitrine les amène jusqu'à votre WhatsApp habituel, c'est vous qui répondez.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing">
        <div className="section-header">
          <h2>Commencez gratuitement</h2>
          <p>Créez votre boutique, ajoutez vos produits et testez la caisse sans engagement. Pour un accompagnement ou des besoins spécifiques, contactez-nous directement.</p>
        </div>

        <div className="pricing-single">
          <ul className="pricing-features">
            {[
              'Caisse, stock et suivi des ventes',
              'Vitrine publique en ligne, incluse',
              'Gestion clients, dettes et équipe',
              'Fonctionne hors-ligne, sur mobile',
            ].map(f => (
              <li key={f} className="pricing-feature">
                <span className="pricing-check">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="pricing-single-actions">
            <Link href="/register" className="btn btn-primary pricing-cta" id="btn-pricing-start">
              Créer ma boutique
            </Link>
            <a href="mailto:trillionnx@gmail.com" className="btn btn-ghost pricing-cta" id="btn-pricing-contact">
              Nous contacter
            </a>
          </div>
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
            question="Comment mes clients me contactent-ils depuis ma vitrine ?"
            answer="Un bouton « Discuter sur WhatsApp » ouvre directement une conversation avec vous, sur votre numéro WhatsApp habituel — pas de nouvelle carte SIM ni de compte professionnel requis."
          />
          <FAQItem
            question="Ma vitrine en ligne est-elle automatique ?"
            answer="Oui : dès qu'un produit est marqué visible, il apparaît sur votre page publique avec catégories et recherche. Vous partagez le lien ou le QR code une seule fois, jamais besoin de le refaire à chaque nouveau produit."
          />
          <FAQItem
            question="Que se passe-t-il si ma connexion coupe pendant une vente ?"
            answer="La vente s'enregistre quand même sur l'appareil et se synchronise automatiquement dès que le réseau revient — aucune vente perdue."
          />
          <FAQItem
            question="Mes données et celles de mes clients sont-elles sécurisées ?"
            answer="Chaque boutique est isolée : les données d'une boutique ne sont jamais visibles par une autre, et l'accès de chaque membre de votre équipe est limité à son rôle."
          />
          <FAQItem
            question="Puis-je masquer les chiffres sensibles (marge, chiffre d'affaires) à certains employés ?"
            answer="Oui, depuis les réglages vous choisissez quels rôles ne voient ni la marge, ni le prix d'achat, ni le chiffre d'affaires — ces chiffres ne sont alors même pas envoyés à leur appareil."
          />
          <FAQItem
            question="L'application fonctionne-t-elle correctement sur mobile ?"
            answer="Oui, toute l'interface est pensée mobile d'abord — vous pouvez l'installer comme une application sur votre téléphone et gérer votre boutique en déplacement."
          />
        </div>
      </section>

      {/* Footer Overhaul */}
      <footer className="landing-footer-premium">
        <div className="footer-cols">
          <div className="footer-brand-col">
            <span className="text-gradient brand-title-footer">BoutikFlow</span>
            <p className="brand-subtitle-footer">La caisse, le stock et la vitrine en ligne des commerçants, dans une seule application — même sans connexion.</p>
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
          /* Filet de sécurité si jamais le bouton ne se compacte pas
             (par ex. un navigateur qui rapporte mal la largeur de
             viewport) : plutôt que de déborder hors écran, la ligne
             d'actions passe à la ligne suivante au lieu d'être coupée. */
          flex-wrap: wrap;
          row-gap: 0.5rem;
          padding: max(1rem, env(safe-area-inset-top, 0px)) max(2.5rem, env(safe-area-inset-right, 0px))
                   1rem max(2.5rem, env(safe-area-inset-left, 0px));
          border-bottom: 1px solid var(--border-subtle);
        }
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          flex-shrink: 0;
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
          font-weight: 800;
          background: linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .nav-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-left: auto;
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
          font-weight: 800;
          color: #ffffff;
          /* Dégradé volontairement plus sombre que le bleu turquoise clair
             utilisé ailleurs dans l'app : sur fond clair comme sur fond
             sombre, le texte blanc y garde un contraste ≥ 4.5:1 (WCAG AA),
             ce qui n'était pas le cas du dégradé brand-500→600 d'origine. */
          background: linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-900) 100%);
          border: 1.5px solid rgba(255,255,255,0.25);
          box-shadow:
            0 12px 32px rgba(24,87,80,0.5),
            0 4px 12px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.3);
          text-shadow: 0 1px 2px rgba(0,0,0,0.25);
        }
        .hero-cta:hover {
          filter: brightness(1.12);
          transform: translateY(-2px);
          box-shadow:
            0 16px 40px rgba(24,87,80,0.6),
            0 6px 16px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.35);
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

        /* Pricing */
        .pricing {
          position: relative;
          max-width: 700px;
          margin: 0 auto;
          padding: 4rem 2rem;
        }
        .pricing-single {
          border-radius: var(--radius-xl);
          padding: 2.5rem 2rem;
          background: var(--surface-1);
          border: 1px solid var(--border-subtle);
          box-shadow: var(--shadow-brand);
        }
        .pricing-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin: 0 0 2rem;
          padding: 0;
        }
        .pricing-feature {
          display: flex;
          align-items: flex-start;
          gap: 0.625rem;
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .pricing-check {
          color: var(--color-brand-400);
          font-weight: 700;
        }
        .pricing-single-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .pricing-cta {
          flex: 1;
          justify-content: center;
          padding: 0.875rem;
          font-weight: 600;
          min-width: 180px;
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
            padding: max(0.75rem, env(safe-area-inset-top, 0px)) max(1rem, env(safe-area-inset-right, 0px))
                     0.75rem max(1rem, env(safe-area-inset-left, 0px)) !important;
          }
          .nav-logo-text {
            font-size: 1rem !important;
          }
          .nav-actions {
            gap: 0.5rem !important;
            flex-shrink: 0;
          }
          .nav-actions .btn {
            padding: 0.45rem 0.75rem !important;
            font-size: 0.8rem !important;
            height: auto !important;
            white-space: nowrap !important;
          }
        }
        .show-on-xs-btn { display: none; }

        /* Même correction de contraste que le CTA du hero : le bouton de la
           barre de navigation doit rester lisible sur toutes les tailles
           d'écran, y compris une fois réduit à "Essayer" en mobile. */
        .nav-cta-btn {
          color: #ffffff;
          font-weight: 800;
          background: linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-900) 100%);
          border: 1.5px solid rgba(255,255,255,0.25);
          box-shadow:
            0 4px 16px rgba(24,87,80,0.45),
            0 1px 4px rgba(0,0,0,0.25),
            inset 0 1px 0 rgba(255,255,255,0.28);
          text-shadow: 0 1px 2px rgba(0,0,0,0.25);
        }
        .nav-cta-btn:hover {
          filter: brightness(1.12);
          box-shadow:
            0 6px 20px rgba(24,87,80,0.55),
            0 2px 6px rgba(0,0,0,0.3),
            inset 0 1px 0 rgba(255,255,255,0.32);
        }

        @media (max-width: 640px) {
          #btn-nav-login, .hide-on-xs, .hide-on-xs-btn { display: none !important; }
          .show-on-xs-btn { display: inline !important; }
          .nav-cta-btn {
            padding: 0.45rem 0.8rem !important;
            font-size: 0.82rem !important;
            font-weight: 700 !important;
            white-space: nowrap !important;
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
