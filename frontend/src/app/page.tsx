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
  UserCog,
  Smartphone,
  ShieldCheck,
  WifiOff,
  EyeOff,
  ArrowRight,
  ChevronDown,
  ScanBarcode,
  Check,
  X,
  CloudOff,
  TrendingUp,
  MessageCircle,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SplashLink, useSplashNavigation } from '@/components/SplashScreen';
import s from './landing.module.css';

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className={`${s.faqItem} ${isOpen ? s.faqOpen : ''}`}>
      <button type="button" className={s.faqQ} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        <span>{question}</span>
        <span className={s.faqArrow}><ChevronDown size={18} /></span>
      </button>
      <div className={s.faqA}>
        <div><p>{answer}</p></div>
      </div>
    </div>
  );
}

const PROBLEMS = [
  "Le stock affiché ne correspond jamais à ce qu'il reste vraiment en rayon.",
  "Deux vendeurs encaissent le même dernier article, et vous le découvrez trop tard.",
  "Une vente se perd parce que la connexion a coupé au mauvais moment.",
  "Des clients potentiels ne savent même pas ce que vous vendez, faute de vitrine en ligne.",
  "Vous ne savez plus qui, dans l'équipe, a vraiment vendu quoi.",
  "Un employé voit vos marges et votre chiffre d'affaires alors que ça ne le regarde pas.",
];

const FEATURES = [
  {
    icon: Users, c1: '#6366f1', c2: '#4338ca',
    title: 'CRM Clients & Dettes',
    desc: "Retrouvez l'historique de chaque client, organisez-les par segments, et suivez précisément qui vous doit quoi.",
  },
  {
    icon: Package, c1: '#f59e0b', c2: '#d97706',
    title: 'Stock sans erreur',
    desc: "Chaque vente verrouille la ligne de stock concernée avant de la débiter : impossible de vendre deux fois le même dernier article, même avec plusieurs vendeurs en même temps.",
  },
  {
    icon: BarChart3, c1: '#0ea5e9', c2: '#0369a1',
    title: 'Tableau de bord de performance',
    desc: "Suivez votre chiffre d'affaires, vos produits qui se vendent le mieux et l'activité de votre équipe — masquable par rôle si vous ne voulez pas que tout le monde voie les chiffres.",
  },
  {
    icon: UserCog, c1: '#8b5cf6', c2: '#6d28d9',
    title: 'Équipe & permissions',
    desc: "Vendeur, gestionnaire de stock, gérant : chacun a exactement les droits nécessaires, ni plus ni moins. Vous décidez qui fait quoi.",
  },
  {
    icon: ScanBarcode, c1: '#ec4899', c2: '#be185d',
    title: 'Scanner code-barres intégré',
    desc: "Enregistrez vos ventes en scannant le code-barres ou le SKU directement depuis l'appareil photo de votre téléphone.",
  },
];

const ASSETS = [
  { icon: Smartphone, title: '100% Mobile & Rapide', desc: 'Pilotez votre boutique directement depuis votre téléphone ou votre tablette, où que vous soyez.' },
  { icon: ShieldCheck, title: 'Données Sécurisées', desc: 'Vos conversations, fiches clients et historiques de ventes sont cryptés et stockés en toute sécurité.' },
  { icon: WifiOff, title: 'Fonctionne hors-ligne', desc: "Une coupure réseau n'arrête jamais une vente : elle s'enregistre localement et se synchronise dès que la connexion revient." },
  { icon: EyeOff, title: 'Vos chiffres, vos règles', desc: "Choisissez qui voit la marge et le chiffre d'affaires — pour les autres, ces chiffres ne sont même pas envoyés à leur appareil." },
];

const WHY = [
  { title: 'Fiable même sans réseau stable', desc: "Pensé pour des connexions qui coupent : vos ventes ne dépendent jamais d'Internet pour être enregistrées." },
  { title: 'Zéro formation requise', desc: 'Une interface claire, ergonomique et épurée que vous et vos employés prendrez en main en moins de 10 minutes.' },
  { title: 'Vous gardez le contact direct', desc: "Pas de robot entre vous et vos clients : la vitrine les amène jusqu'à votre WhatsApp habituel, c'est vous qui répondez." },
];

const FAQ = [
  { q: 'Comment mes clients me contactent-ils depuis ma vitrine ?', a: 'Un bouton « Discuter sur WhatsApp » ouvre directement une conversation avec vous, sur votre numéro WhatsApp habituel — pas de nouvelle carte SIM ni de compte professionnel requis.' },
  { q: 'Ma vitrine en ligne est-elle automatique ?', a: "Oui : dès qu'un produit est marqué visible, il apparaît sur votre page publique avec catégories et recherche. Vous partagez le lien ou le QR code une seule fois, jamais besoin de le refaire à chaque nouveau produit." },
  { q: 'Que se passe-t-il si ma connexion coupe pendant une vente ?', a: "La vente s'enregistre quand même sur l'appareil et se synchronise automatiquement dès que le réseau revient — aucune vente perdue." },
  { q: 'Mes données et celles de mes clients sont-elles sécurisées ?', a: "Chaque boutique est isolée : les données d'une boutique ne sont jamais visibles par une autre, et l'accès de chaque membre de votre équipe est limité à son rôle." },
  { q: "Puis-je masquer les chiffres sensibles (marge, chiffre d'affaires) à certains employés ?", a: "Oui, depuis les réglages vous choisissez quels rôles ne voient ni la marge, ni le prix d'achat, ni le chiffre d'affaires — ces chiffres ne sont alors même pas envoyés à leur appareil." },
  { q: "L'application fonctionne-t-elle correctement sur mobile ?", a: "Oui, toute l'interface est pensée mobile d'abord — vous pouvez l'installer comme une application sur votre téléphone et gérer votre boutique en déplacement." },
];

// Commerces illustrés dans le bandeau défilant (décoratif).
const TRADES = [
  ['👗', 'Mode & prêt-à-porter'], ['👟', 'Chaussures'], ['💄', 'Cosmétiques'], ['📱', 'Téléphonie'],
  ['🛒', 'Alimentation'], ['💍', 'Bijoux & accessoires'], ['🛋️', 'Maison & déco'], ['📚', 'Librairie'],
];

// Hauteurs des barres du graphique de l'aperçu (décoratif).
const BARS = [38, 52, 44, 66, 58, 72, 61, 84, 70, 92, 78, 100];

export default function HomePage() {
  // Connexion / inscription : écran de chargement BoutikFlow avant la page cible.
  const { splash, navigate } = useSplashNavigation();

  return (
    <main className={s.page}>
      {splash}
      <div className={s.bg} aria-hidden="true" />

      {/* ── Navigation ── */}
      <nav className={s.nav}>
        <div className={`${s.container} ${s.navInner}`}>
          <Link href="/" className={s.brand}>
            <BrandMark size={36} />
            <span className={s.brandText}>BoutikFlow</span>
          </Link>
          <div className={s.navLinks}>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#pourquoi">Pourquoi nous</a>
            <a href="#tarif">Tarif</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className={s.navActions}>
            <ThemeToggle />
            <SplashLink href="/login" message="Ouverture de votre espace…" go={navigate} className={`${s.btn} ${s.btnGhost} ${s.btnSm} ${s.hideXs}`} id="btn-nav-login">Se connecter</SplashLink>
            <SplashLink href="/register" message="Préparation de votre boutique…" go={navigate} className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`} id="btn-nav-register">
              Essayer<span className={s.hideXs}>gratuitement</span>
            </SplashLink>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={`${s.container} ${s.hero}`}>
        <div className={s.heroText}>
          <span className={s.pill}>
            <span className={s.pillIcon}><MapPin size={13} /></span>
            Conçu pour les commerçants africains
          </span>
          <h1 className={s.title}>
            Ne perdez plus une <span className={s.highlight}>seule vente</span>{' '}à cause d&apos;une erreur évitable
          </h1>
          <p className={s.subtitle}>
            Un stock mal compté, une connexion qui coupe en pleine vente, une boutique invisible en dehors du quartier — BoutikFlow règle ces problèmes-là. Caisse fiable, stock verrouillé contre les erreurs, et une vraie vitrine en ligne que vos clients trouvent et vous contactent directement sur WhatsApp.
          </p>
          <div className={s.ctas}>
            <SplashLink href="/register" message="Préparation de votre boutique…" go={navigate} className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`} id="btn-hero-start">
              Créer ma boutique <ArrowRight size={18} />
            </SplashLink>
            <SplashLink href="/login" message="Ouverture de votre espace…" go={navigate} className={`${s.btn} ${s.btnGhost} ${s.btnLg}`} id="btn-hero-login">
              Accéder à mon espace
            </SplashLink>
          </div>
          <div className={s.checks}>
            {[
              'Hors-ligne : la caisse marche sans Internet',
              'Vitrine en ligne incluse',
              "Toute l'équipe, un accès chacun",
            ].map(item => (
              <span key={item} className={s.check}><span className={s.checkIcon}><Check size={13} strokeWidth={3} /></span>{item}</span>
            ))}
          </div>
        </div>

        {/* Aperçu décoratif de l'application (HTML/CSS, aucune image) */}
        <div className={s.visual} aria-hidden="true">
          <div className={s.window}>
            <div className={s.windowBar}>
              <i /><i /><i />
              <span className={s.windowUrl}>boutikflow.app/dashboard</span>
            </div>
            <div className={s.windowBody}>
              <div className={s.mockSide}>
                {Array.from({ length: 7 }).map((_, i) => <span key={i} />)}
              </div>
              <div className={s.mockMain}>
                <div className={s.mockHero}>
                  <div className={s.mockLabel}>CHIFFRE D&apos;AFFAIRES</div>
                  <div className={s.mockValue}>98 185 000<small>GNF</small></div>
                  <svg viewBox="0 0 300 40" preserveAspectRatio="none">
                    <path d="M0 34 C 20 30, 30 18, 50 22 S 80 36, 100 24 S 130 8, 150 18 S 185 30, 205 14 S 240 4, 260 12 S 290 6, 300 2 L300 40 L0 40 Z" fill="rgba(255,255,255,0.18)" />
                    <path d="M0 34 C 20 30, 30 18, 50 22 S 80 36, 100 24 S 130 8, 150 18 S 185 30, 205 14 S 240 4, 260 12 S 290 6, 300 2" fill="none" stroke="#fff" strokeWidth="2" />
                  </svg>
                </div>
                <div className={s.mockKpis}>
                  <div className={s.mockKpi}><b>218</b><span>Ventes</span></div>
                  <div className={s.mockKpi}><b>450 k</b><span>Panier moyen</span></div>
                  <div className={s.mockKpi}><b>30</b><span>Clients</span></div>
                </div>
                <div className={s.mockChart}>
                  {BARS.map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} />)}
                </div>
              </div>
            </div>
          </div>

          <div className={s.phone}>
            <div className={s.phoneScreen}>
              <div className={s.phoneCover}><span className={s.phoneLogo}>🛍️</span></div>
              <div className={s.phoneName}>Ma Boutique</div>
              <div className={s.phoneGrid}>
                {[['👟', '#fde2cf'], ['👜', '#e7defc'], ['⌚', '#d6ecfb'], ['💄', '#fbd9e8']].map(([e, bg]) => (
                  <div key={e} className={s.phoneTile}>
                    <div style={{ background: bg }}>{e}</div>
                    <span>150 000 GNF</span>
                  </div>
                ))}
              </div>
              <div className={s.phoneWa}><MessageCircle size={10} fill="white" strokeWidth={0} /> Commander</div>
            </div>
          </div>

          <div className={`${s.toast} ${s.toastA}`}>
            <span className={s.toastIcon} style={{ background: '#10b981' }}><CloudOff size={15} /></span>
            Vente enregistrée hors-ligne
          </div>
          <div className={`${s.toast} ${s.toastB}`}>
            <span className={s.toastIcon} style={{ background: '#f59e0b' }}><TrendingUp size={15} /></span>
            Stock verrouillé, zéro erreur
          </div>
        </div>
      </section>

      {/* ── Bandeau des commerces ── */}
      <div className={s.marquee} aria-hidden="true">
        <div className={s.marqueeTrack}>
          {[...TRADES, ...TRADES].map(([emoji, label], i) => (
            <span key={i} className={s.marqueeItem}><span>{emoji}</span>{label}</span>
          ))}
        </div>
      </div>

      {/* ── Problèmes ── */}
      <section className={`${s.container} ${s.section}`}>
        <div className={s.sectionHead}>
          <span className={s.eyebrow}>Le quotidien d&apos;un commerçant</span>
          <h2 className={s.h2}>Ça vous parle ?</h2>
        </div>
        <div className={s.problems}>
          {PROBLEMS.map(p => (
            <div key={p} className={s.problem}>
              <span className={s.problemMark}><X size={17} strokeWidth={3} /></span>
              <p>{p}</p>
            </div>
          ))}
        </div>
        <p className={s.transition}>BoutikFlow règle ces six problèmes. Concrètement, pas en promesse. <ArrowRight size={17} /></p>
      </section>

      {/* ── Fonctionnalités ── */}
      <section id="fonctionnalites" className={`${s.container} ${s.section}`}>
        <div className={s.sectionHead}>
          <span className={s.eyebrow}>Fonctionnalités</span>
          <h2 className={s.h2}>Faites grandir votre boutique simplement</h2>
          <p className={s.lead}>Toutes les fonctionnalités pensées pour maximiser la satisfaction client et simplifier votre quotidien.</p>
        </div>
        <div className={s.bento}>
          <article className={`${s.feature} ${s.featureWide}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span className={s.featureIcon} style={{ '--c1': '#10b981', '--c2': '#0b7a63' } as React.CSSProperties}><Store size={24} /></span>
              <h3 className={s.featureTitle}>Vitrine publique incluse</h3>
              <p className={s.featureDesc}>
                Chaque boutique a sa propre page en ligne — catégories, recherche, fiches produits avec photo — partageable en un lien ou un QR code. Un bouton WhatsApp laisse vos clients vous écrire directement.
              </p>
            </div>
            <div className={s.featureDemo} aria-hidden="true">
              {[['👗', '#d9f5ea', 'Robe wax'], ['👟', '#fde2cf', 'Sneakers'], ['👜', '#e7defc', 'Sac à main'], ['⌚', '#d6ecfb', 'Montre'], ['🧴', '#fbd9e8', 'Crème'], ['🎧', '#e0e7ff', 'Écouteurs']].map(([e, bg, n]) => (
                <div key={n} className={s.demoTile}>
                  <div style={{ background: bg }}>{e}</div>
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </article>
          {FEATURES.map(({ icon: Icon, c1, c2, title, desc }, i) => {
            const isLast = i === FEATURES.length - 1;
            return (
              <article key={title} className={`${s.feature} ${isLast ? s.featureFull : ''}`}>
                <span className={s.featureIcon} style={{ '--c1': c1, '--c2': c2, flexShrink: 0 } as React.CSSProperties}><Icon size={24} /></span>
                <div style={isLast ? undefined : { display: 'contents' }}>
                  <h3 className={s.featureTitle}>{title}</h3>
                  <p className={s.featureDesc}>{desc}</p>
                </div>
              </article>
            );
          })}
        </div>
        <p className={s.footnote}>
          Aussi inclus : prenez une photo d&apos;un produit, l&apos;IA propose un nom et une description — pratique, jamais indispensable.
        </p>
      </section>

      {/* ── Pourquoi BoutikFlow ── */}
      <section id="pourquoi" className={`${s.container} ${s.section}`}>
        <div className={s.sectionHead}>
          <span className={s.eyebrow}>Pourquoi BoutikFlow</span>
          <h2 className={s.h2}>Pourquoi choisir BoutikFlow ?</h2>
          <p className={s.lead}>Le meilleur allié pour digitaliser votre activité et accélérer votre croissance commerciale.</p>
        </div>
        <div className={s.assets}>
          {ASSETS.map(({ icon: Icon, title, desc }) => (
            <article key={title} className={s.asset}>
              <span className={s.assetIcon}><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
        <div className={s.why}>
          {WHY.map((w, i) => (
            <article key={w.title} className={s.whyItem}>
              <span className={s.whyNum}>0{i + 1}</span>
              <h3>{w.title}</h3>
              <p>{w.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Tarif ── */}
      <section id="tarif" className={`${s.container} ${s.section}`}>
        <div className={s.pricing}>
          <div className={s.price}>
            <span className={s.eyebrow}>Tarif</span>
            <h2 className={s.h2} style={{ textAlign: 'left' }}>Commencez gratuitement</h2>
            <p className={s.lead}>
              Créez votre boutique, ajoutez vos produits et testez la caisse sans engagement. Pour un accompagnement ou des besoins spécifiques, contactez-nous directement.
            </p>
            <div className={s.ctas} style={{ marginTop: '0.5rem' }}>
              <SplashLink href="/register" message="Préparation de votre boutique…" go={navigate} className={`${s.btn} ${s.btnPrimary}`} id="btn-pricing-start">Créer ma boutique <ArrowRight size={17} /></SplashLink>
              <a href="mailto:trillionnx@gmail.com" className={`${s.btn} ${s.btnGhost}`} id="btn-pricing-contact">Nous contacter</a>
            </div>
          </div>
          <ul className={s.priceList}>
            {[
              'Caisse, stock et suivi des ventes',
              'Vitrine publique en ligne, incluse',
              'Gestion clients, dettes et équipe',
              'Fonctionne hors-ligne, sur mobile',
            ].map(f => (
              <li key={f}><span className={s.checkIcon} style={{ width: 28, height: 28 }}><Check size={15} strokeWidth={3} /></span>{f}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className={`${s.container} ${s.section}`}>
        <div className={s.sectionHead}>
          <span className={s.eyebrow}>FAQ</span>
          <h2 className={s.h2}>Questions fréquentes</h2>
          <p className={s.lead}>Toutes les réponses à vos interrogations pour démarrer sereinement.</p>
        </div>
        <div className={s.faq}>
          {FAQ.map(f => <FAQItem key={f.q} question={f.q} answer={f.a} />)}
        </div>
      </section>

      {/* ── Appel final ── */}
      <section className={`${s.container} ${s.section}`}>
        <div className={s.finalCta}>
          <h2>Prêt à ne plus perdre une seule vente ?</h2>
          <p>Créez votre boutique en quelques minutes : caisse, stock, clients et vitrine en ligne, même sans connexion.</p>
          <div className={s.ctas} style={{ justifyContent: 'center' }}>
            <SplashLink href="/register" message="Préparation de votre boutique…" go={navigate} className={`${s.btn} ${s.btnWhite} ${s.btnLg}`}>Créer ma boutique <ArrowRight size={18} /></SplashLink>
            <SplashLink href="/login" message="Ouverture de votre espace…" go={navigate} className={`${s.btn} ${s.btnOutlineWhite} ${s.btnLg}`}>Se connecter</SplashLink>
          </div>
        </div>
      </section>

      {/* ── Pied de page ── */}
      <footer className={s.footer}>
        <div className={s.container}>
          <div className={s.footerCols}>
            <div className={s.footerBrand}>
              <Link href="/" className={s.brand}>
                <BrandMark size={32} />
                <span className={s.brandText}>BoutikFlow</span>
              </Link>
              <p>La caisse, le stock et la vitrine en ligne des commerçants, dans une seule application — même sans connexion.</p>
            </div>
            <div className={s.footerCol}>
              <h4>Produit</h4>
              <a href="#fonctionnalites">Fonctionnalités</a>
              <a href="#tarif">Tarification</a>
              <SplashLink href="/login" message="Ouverture de votre espace…" go={navigate}>Espace Client</SplashLink>
            </div>
            <div className={s.footerCol}>
              <h4>Support & Contact</h4>
              <a href="mailto:trillionnx@gmail.com">trillionnx@gmail.com</a>
              <a href="tel:+224627171397">+224 627 17 13 97</a>
              <a href="tel:+224610935524">+224 610 93 55 24</a>
              <a href="#faq">Centre d&apos;aide</a>
            </div>
            <div className={s.footerCol}>
              <h4>Légal</h4>
              <Link href="/privacy">Politique de confidentialité</Link>
              <Link href="/terms">Conditions d&apos;utilisation</Link>
            </div>
          </div>
          <div className={s.footerBottom}>
            <p>© 2026 BoutikFlow. Tous droits réservés.</p>
            <p>Conçu pour le commerce de demain.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
