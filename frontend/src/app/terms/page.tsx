'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2, FileText, Mail, Phone, Building } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function TermsPage() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="terms-container">
      {/* Navigation Topbar */}
      <header className="terms-header">
        <div className="terms-header-inner">
          <Link href="/" className="logo-brand">
            <div className="logo-icon">⚡</div>
            <span className="logo-text">BoutikFlow</span>
          </Link>

          <div className="terms-header-actions">
            <button 
              className="lang-btn" 
              onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
            >
              🌐 {language === 'fr' ? 'English' : 'Français'}
            </button>

            <Link href="/login" className="back-link">
              <ArrowLeft size={16} />
              <span>{language === 'fr' ? 'Retour à la connexion' : 'Back to Login'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="terms-content">
        <div className="terms-card">
          {/* Badge & Title */}
          <div className="terms-badge">
            <ShieldCheck size={18} />
            <span>{language === 'fr' ? 'Document Juridique Officiel' : 'Official Legal Document'}</span>
          </div>

          <h1 className="terms-title">
            {language === 'fr' 
              ? "Conditions Générales d'Utilisation & Protection des Données" 
              : "Terms of Service & Data Protection Policy"}
          </h1>
          <p className="terms-subtitle">
            {language === 'fr'
              ? 'Dernière mise à jour : 21 Juillet 2026 · Propulsé par TrillionX'
              : 'Last updated: July 21, 2026 · Powered by TrillionX'}
          </p>

          {/* Golden Rule Consent Alert */}
          <div className="consent-alert-box">
            <div className="alert-icon-wrap">
              <Lock size={24} />
            </div>
            <div className="alert-body">
              <h3>
                {language === 'fr' 
                  ? ' Consentement Explicite et Veille Active sur vos Données' 
                  : ' Explicit Consent & Active Data Protection'}
              </h3>
              <p>
                {language === 'fr'
                  ? "En créant un compte, en vous connectant ou en utilisant l'application BoutikFlow, vous acceptez expressément et sans réserve l'intégralité des présentes Conditions Générales d'Utilisation. Par cette inscription, toute personne ou entité utilisatrice donne son accord ferme et explicite à ce que BoutikFlow et la société TrillionX veillent activement sur la sécurité, l'intégrité, la confidentialité et la sauvegarde de l'ensemble de ses données commerciales, produits, transactions et données clients."
                  : "By creating an account, logging in, or using the BoutikFlow application, you expressly and unreservedly accept all of these Terms of Service. Through this registration, any user or entity gives their firm and explicit consent to BoutikFlow and TrillionX actively safeguarding the security, integrity, confidentiality, and backup of all their business data, products, transactions, and customer records."}
              </p>
            </div>
          </div>

          <div className="divider" />

          {/* Legal Sections */}
          <div className="terms-articles">
            {/* Article 1 */}
            <section className="article-block">
              <h2>Article 1 — Définitions et Objet du Service</h2>
              <p>
                La plateforme <strong>BoutikFlow</strong> est une solution logicielle en mode SaaS (Software as a Service) conçue et éditée par la société <strong>TrillionX</strong>. 
                Elle offre aux commerçants, entreprises et indépendants une suite intégrée d'outils de gestion comprenant la gestion du catalogue produits, du stock, des commandes, de la relation client (CRM), de l'automatisation marketing et de la communication omnicanale via WhatsApp.
              </p>
              <p>
                Les présentes Conditions Générales d'Utilisation (CGU) encadrent l'accès et l'utilisation de l'ensemble des services web et mobiles fournis sous la marque BoutikFlow.
              </p>
            </section>

            {/* Article 2 */}
            <section className="article-block">
              <h2>Article 2 — Acceptation Obligatoire et Automatique</h2>
              <p>
                L'accès aux services de BoutikFlow est soumis au respect strict des présentes CGU. 
                La création d'un compte sur le portail <code>boutikflow.app</code> ou toute utilisation continue des fonctionnalités du tableau de bord vaut acceptation intégrale, immédiate et irrévocable de l'ensemble des clauses énoncées dans ce document.
              </p>
              <p>
                Si l'utilisateur n'accepte pas les présentes conditions, il doit s'abstenir immédiatement d'utiliser les services de la plateforme.
              </p>
            </section>

            {/* Article 3 */}
            <section className="article-block">
              <h2>Article 3 — Inscription, Compte et Validation Administrative</h2>
              <p>
                Toute inscription sur la plateforme donne lieu à la création d'une instance boutique avec le statut <em>« En attente de validation » (Pending)</em>. 
                Pour préserver la sécurité de la plateforme et lutter contre les utilisations frauduleuses, l'équipe d'administration de TrillionX procède à la vérification de chaque nouvelle demande de boutique.
              </p>
              <ul>
                <li>L'accès au tableau de bord n'est activé qu'après validation expresse de l'administrateur.</li>
                <li>L'utilisateur est notifié par e-mail dès la validation ou en cas de demande d'informations complémentaires.</li>
                <li>L'utilisateur est seul responsable de la confidentialité de ses identifiants de connexion et des actions accomplies sous son compte.</li>
              </ul>
            </section>

            {/* Article 4 */}
            <section className="article-block highlight-section">
              <h2>Article 4 — Veille Active, Sécurité et Confidentialité des Données</h2>
              <p>
                <strong>Engagement de Veille et de Protection :</strong> Conformément au consentement accordé lors de l'inscription, BoutikFlow et TrillionX mettent en œuvre tous les moyens technologiques, organisationnels et de chiffrement appropriés pour veiller jour et nuit sur les données transmises.
              </p>
              <div className="features-grid">
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>Chiffrement & Isolation</strong>
                    <p>Les données de chaque boutique sont strictement isolées au niveau base de données (Architecture Multi-Tenant).</p>
                  </div>
                </div>
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>Sauvegardes Quotidiennes</strong>
                    <p>Vos produits, commandes et historiques clients font l'objet de sauvegardes automatiques sécurisées.</p>
                  </div>
                </div>
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>Non-Revente des Données</strong>
                    <p>TrillionX s'interdit formellement de vendre, louer ou céder vos données commerciales ou celles de vos clients à des tiers.</p>
                  </div>
                </div>
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>Surveillance Anti-Intrusion</strong>
                    <p>Des systèmes automatisés détectent et bloquent les tentatives d'accès suspectes ou non autorisées.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Article 5 */}
            <section className="article-block">
              <h2>Article 5 — Utilisation du Module WhatsApp et Gestion CRM</h2>
              <p>
                BoutikFlow met à disposition des marchands des outils d'interaction rapide WhatsApp Direct et d'envoi de messages ciblés. 
                L'utilisateur s'engage à utiliser ces outils dans le respect des réglementations sur les communications électroniques et le consentement préalable des acheteurs :
              </p>
              <ul>
                <li>Interdiction absolue d'envoyer des messages spams, trompeurs ou à caractère abusif.</li>
                <li>Respect strict des conditions d'utilisation imposées par WhatsApp / Meta Cloud API.</li>
                <li>L'utilisateur demeure seul responsable du contenu des messages envoyés à ses clients finaux.</li>
              </ul>
            </section>

            {/* Article 6 */}
            <section className="article-block">
              <h2>Article 6 — Formules d'Abonnement et Mises à Niveau (Upgrade PRO)</h2>
              <p>
                BoutikFlow propose une formule d'entrée de gamme <strong>Freemium</strong> ainsi que des formules avancées (Mensuelle et À vie). 
                La demande de passage en version PRO s'effectue via le bouton dédié dans l'application :
              </p>
              <p>
                Toute demande d'upgrade déclenche l'envoi d'une notification directe à l'équipe commerciale TrillionX. Le changement de forfait est finalisé et activé par l'administrateur après confirmation des modalités de règlement.
              </p>
            </section>

            {/* Article 7 */}
            <section className="article-block">
              <h2>Article 7 — Propriété Intellectuelle</h2>
              <p>
                L'ensemble des éléments de la plateforme BoutikFlow (code source, interfaces graphiques, logos, algorithmes d'IA, marques, bases de données) est la propriété exclusive de <strong>TrillionX</strong>.
              </p>
              <p>
                En revanche, le commerçant conserve la propriété intégrale de ses contenus commerciaux : photos de produits, descriptions, marques déposées et fichier clients importé ou généré sur son instance.
              </p>
            </section>

            {/* Article 8 */}
            <section className="article-block">
              <h2>Article 8 — Responsabilités et Interdictions</h2>
              <p>
                L'utilisateur s'interdit formellement d'utiliser BoutikFlow pour promouvoir, commercialiser ou distribuer des produits ou services illicites, contrefaits, ou contraires aux lois en vigueur en République de Guinée et à l'international.
              </p>
              <p>
                TrillionX se réserve le droit de suspendre ou fermer sans préavis tout compte associé à des activités frauduleuses, des comportements suspects ou des tentatives de contournement de la sécurité de la plateforme.
              </p>
            </section>

            {/* Article 9 */}
            <section className="article-block">
              <h2>Article 9 — Disponibilité et Maintenance du Service</h2>
              <p>
                TrillionX s'efforce de maintenir un taux d'accessibilité des services de 99,9%. Cependant, des interruptions temporaires peuvent survenir pour des opérations de maintenance préventive, des mises à jour de sécurité ou des contraintes liées aux infrastructures d'hébergement cloud (démarrage du serveur backend Render en cold-start).
              </p>
            </section>

            {/* Article 10 */}
            <section className="article-block">
              <h2>Article 10 — Résiliation et Récupération des Données</h2>
              <p>
                L'utilisateur peut demander la suppression de son compte et de sa boutique à tout moment en contactant le support TrillionX. 
                Sur simple demande écrite du propriétaire légitime, une exportation de l'ensemble de ses données (produits, clients, commandes) lui sera fournie au format CSV/JSON avant la clôture définitive.
              </p>
            </section>

            {/* Article 11 */}
            <section className="article-block">
              <h2>Article 11 — Modifications des CGU</h2>
              <p>
                TrillionX se réserve le droit de modifier les présentes Conditions Générales à tout moment afin d'intégrer les nouvelles fonctionnalités de l'application ou l'évolution des lois. Les utilisateurs seront informés de toute modification majeure par e-mail ou notification dans leur tableau de bord.
              </p>
            </section>

            {/* Article 12 */}
            <section className="article-block contact-block">
              <h2>Article 12 — Contact & Support TrillionX</h2>
              <p>Pour toute question concernant les présentes Conditions Générales ou pour exercer vos droits sur vos données, notre équipe est à votre disposition :</p>
              
              <div className="contact-cards">
                <div className="contact-item">
                  <Mail size={18} className="text-emerald" />
                  <div>
                    <span className="contact-label">Email Support & Juridique</span>
                    <a href="mailto:trillionnx@gmail.com" className="contact-val">trillionnx@gmail.com</a>
                  </div>
                </div>

                <div className="contact-item">
                  <Phone size={18} className="text-emerald" />
                  <div>
                    <span className="contact-label">Téléphones Directs</span>
                    <span className="contact-val">+224 627 17 13 97 / 610 93 55 24</span>
                  </div>
                </div>

                <div className="contact-item">
                  <Building size={18} className="text-emerald" />
                  <div>
                    <span className="contact-label">Propulsé par</span>
                    <span className="contact-val">TrillionX Tech Solution</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="terms-footer">
        <p>© 2026 BoutikFlow · Propulsé par TrillionX. Tous droits réservés.</p>
      </footer>

      <style jsx>{`
        .terms-container {
          min-height: 100vh;
          background: #090d16;
          color: #e5e7eb;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .terms-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(17, 24, 39, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1rem 2rem;
        }

        .terms-header-inner {
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          text-decoration: none;
        }

        .logo-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(135deg, #10b981, #059669);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        }

        .logo-text {
          font-size: 1.2rem;
          font-weight: 700;
          color: white;
        }

        .terms-header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .lang-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #d1d5db;
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .lang-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: white;
        }

        .back-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #10b981;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: #34d399;
        }

        .terms-content {
          max-width: 1000px;
          margin: 2.5rem auto;
          padding: 0 1.5rem;
        }

        .terms-card {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 3rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .terms-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 0.35rem 0.85rem;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 1.25rem;
        }

        .terms-title {
          font-size: 2.2rem;
          font-weight: 800;
          color: white;
          margin: 0 0 0.5rem 0;
          line-height: 1.2;
        }

        .terms-subtitle {
          color: #9ca3af;
          font-size: 0.95rem;
          margin-bottom: 2rem;
        }

        .consent-alert-box {
          display: flex;
          gap: 1.25rem;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.08));
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 14px;
          padding: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .alert-icon-wrap {
          color: #34d399;
          flex-shrink: 0;
          padding-top: 0.2rem;
        }

        .alert-body h3 {
          margin: 0 0 0.5rem 0;
          color: #ecfdf5;
          font-size: 1.1rem;
          font-weight: 700;
        }

        .alert-body p {
          margin: 0;
          color: #d1d5db;
          font-size: 0.95rem;
          line-height: 1.65;
        }

        .divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 2.5rem 0;
        }

        .terms-articles {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .article-block h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f3f4f6;
          margin: 0 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .article-block p {
          color: #9ca3af;
          font-size: 0.95rem;
          line-height: 1.7;
          margin: 0 0 0.85rem 0;
        }

        .article-block ul {
          margin: 0.5rem 0 1rem 1.5rem;
          color: #9ca3af;
          font-size: 0.95rem;
          line-height: 1.7;
        }

        .article-block li {
          margin-bottom: 0.4rem;
        }

        .highlight-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.25rem;
          margin-top: 1.25rem;
        }

        .feature-card {
          display: flex;
          gap: 0.75rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 1rem;
          border-radius: 10px;
        }

        .feature-card strong {
          display: block;
          color: #f3f4f6;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
        }

        .feature-card p {
          margin: 0;
          font-size: 0.825rem;
          color: #9ca3af;
          line-height: 1.4;
        }

        .text-emerald {
          color: #34d399;
          flex-shrink: 0;
        }

        .contact-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 1rem;
          border-radius: 10px;
        }

        .contact-label {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;

        }

        .contact-val {
          color: #e5e7eb;
          font-size: 0.9rem;
          font-weight: 600;
          text-decoration: none;
        }

        .contact-val:hover {
          color: #34d399;
        }

        .terms-footer {
          text-align: center;
          padding: 2rem 1rem;
          color: #6b7280;
          font-size: 0.85rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin-top: 3rem;
        }

        @media (max-width: 640px) {
          .terms-card {
            padding: 1.5rem;
          }
          .terms-title {
            font-size: 1.6rem;
          }
          .consent-alert-box {
            flex-direction: column;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
