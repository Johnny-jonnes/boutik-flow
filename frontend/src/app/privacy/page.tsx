'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2, Mail, Phone, Building, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function PrivacyPage() {
  const { language, setLanguage } = useLanguage();
  const isFr = language === 'fr';

  return (
    <div className="terms-container">
      {/* Navigation Topbar */}
      <header className="terms-header">
        <div className="terms-header-inner">
          <Link href="/" className="logo-brand">
            <span className="logo-badge">BF</span>
            <span className="logo-text">BoutikFlow</span>
          </Link>

          <div className="terms-header-actions">
            <button
              className="lang-btn"
              onClick={() => setLanguage(isFr ? 'en' : 'fr')}
            >
              {isFr ? 'English' : 'Français'}
            </button>

            <Link href="/login" className="back-link">
              <ArrowLeft size={16} />
              <span>{isFr ? 'Retour à la connexion' : 'Back to Login'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="terms-content">
        <div className="terms-card">
          <div className="terms-badge">
            <ShieldCheck size={18} />
            <span>{isFr ? 'Politique de Confidentialité' : 'Privacy Policy'}</span>
          </div>

          <h1 className="terms-title">
            {isFr ? 'Politique de Confidentialité & Protection des Données' : 'Privacy Policy & Data Protection'}
          </h1>
          <p className="terms-subtitle">
            {isFr
              ? 'Dernière mise à jour : 15 Septembre 2026 · Propulsé par TrillionX'
              : 'Last updated: September 15, 2026 · Powered by TrillionX'}
          </p>

          {/* Placeholder notice — honnêteté avant tout : rien n'est inventé ici */}
          <div className="placeholder-alert-box">
            <div className="alert-icon-wrap"><AlertTriangle size={22} /></div>
            <div className="alert-body">
              <h3>{isFr ? 'Informations à compléter par TrillionX' : 'Information to be completed by TrillionX'}</h3>
              <p>
                {isFr
                  ? "Cette page ne contient aucune information juridique inventée. La raison sociale complète, l'adresse légale et le numéro d'enregistrement d'entreprise de TrillionX doivent être renseignés ci-dessous avant publication officielle — voir les emplacements marqués « À compléter »."
                  : "This page contains no fabricated legal information. TrillionX's full legal name, registered address, and business registration number must be filled in below before official publication — see the sections marked \"To be completed\"."}
              </p>
            </div>
          </div>

          <div className="divider" />

          <div className="terms-articles">
            {/* Article 1 — Responsable du traitement */}
            <section className="article-block">
              <h2>{isFr ? 'Article 1 — Responsable du Traitement' : 'Article 1 — Data Controller'}</h2>
              <p>
                {isFr
                  ? "BoutikFlow est édité par TrillionX (TrillionX Tech Solution), responsable du traitement des données décrites dans cette politique."
                  : "BoutikFlow is published by TrillionX (TrillionX Tech Solution), which acts as data controller for the processing described in this policy."}
              </p>
              <ul>
                <li>
                  <strong>{isFr ? 'Raison sociale complète : ' : 'Full legal name: '}</strong>
                  <span className="placeholder-inline">{isFr ? 'À compléter' : 'To be completed'}</span>
                </li>
                <li>
                  <strong>{isFr ? 'Adresse légale : ' : 'Registered address: '}</strong>
                  <span className="placeholder-inline">{isFr ? 'À compléter' : 'To be completed'}</span>
                </li>
                <li>
                  <strong>{isFr ? "Numéro d'enregistrement d'entreprise : " : 'Business registration number: '}</strong>
                  <span className="placeholder-inline">{isFr ? 'À compléter' : 'To be completed'}</span>
                </li>
              </ul>
            </section>

            {/* Article 2 — Données collectées */}
            <section className="article-block">
              <h2>{isFr ? 'Article 2 — Données Collectées' : 'Article 2 — Data We Collect'}</h2>
              <p>
                {isFr
                  ? "BoutikFlow collecte uniquement les données nécessaires au fonctionnement du service de gestion de boutique :"
                  : "BoutikFlow only collects the data necessary to operate the store management service:"}
              </p>
              <ul>
                <li>{isFr ? 'Compte utilisateur : nom complet, email, téléphone (optionnel), rôle dans la boutique.' : 'User account: full name, email, phone (optional), role within the store.'}</li>
                <li>{isFr ? 'Boutique : nom, identifiant, et les réglages que vous configurez (ex : masquage de chiffres financiers par rôle).' : 'Store: name, identifier, and the settings you configure (e.g. per-role financial figure masking).'}</li>
                <li>{isFr ? 'Clients de votre boutique : nom, téléphone, email (optionnel), historique d\'achats et de dettes — données que vous saisissez vous-même pour gérer votre clientèle.' : "Your store's customers: name, phone, email (optional), purchase and debt history — data you enter yourself to manage your clientele."}</li>
                <li>{isFr ? 'Données commerciales : produits, prix, stock, ventes, commandes, retours, transactions financières.' : 'Business data: products, prices, stock, sales, orders, returns, financial transactions.'}</li>
                <li>{isFr ? "Journal d'activité : connexions et actions sensibles (création/modification/suppression de produits, clients, membres d'équipe, changements de rôle, paiements de dettes) — horodatés avec l'auteur, consultables uniquement par le propriétaire et les gérants de la boutique concernée." : 'Activity log: logins and sensitive actions (product/client/team member creation-edit-deletion, role changes, debt payments) — timestamped with the author, visible only to the owner and managers of the relevant store.'}</li>
              </ul>
              <p>
                {isFr
                  ? "Nous ne collectons aucune donnée bancaire (les paiements Mobile Money sont traités par les opérateurs concernés, jamais stockés par BoutikFlow)."
                  : "We do not collect any banking data (Mobile Money payments are processed by the relevant operators and are never stored by BoutikFlow)."}
              </p>
            </section>

            {/* Article 3 — Finalités */}
            <section className="article-block">
              <h2>{isFr ? 'Article 3 — Pourquoi Nous Utilisons Ces Données' : 'Article 3 — Why We Use This Data'}</h2>
              <ul>
                <li>{isFr ? 'Fournir et faire fonctionner le service (ventes, stock, finances, synchronisation hors-ligne).' : 'Provide and operate the service (sales, stock, finance, offline sync).'}</li>
                <li>{isFr ? 'Sécuriser les comptes et détecter les usages anormaux (journal d\'audit, limitation de débit sur la connexion).' : 'Secure accounts and detect abnormal usage (audit log, login rate limiting).'}</li>
                <li>{isFr ? 'Support technique et réponse à vos demandes.' : 'Technical support and responding to your requests.'}</li>
                <li>{isFr ? "Validation administrative des nouvelles boutiques avant activation (voir CGU, Article 3)." : 'Administrative validation of new stores before activation (see Terms, Article 3).'}</li>
              </ul>
              <p>
                {isFr
                  ? "Nous ne vendons ni ne louons vos données commerciales ou celles de vos clients à des tiers."
                  : "We do not sell or rent your business data or your customers' data to third parties."}
              </p>
            </section>

            {/* Article 4 — Isolation et sécurité */}
            <section className="article-block highlight-section">
              <h2>{isFr ? 'Article 4 — Isolation entre Boutiques & Sécurité' : 'Article 4 — Store Isolation & Security'}</h2>
              <p>
                {isFr
                  ? "BoutikFlow est une plateforme multi-boutiques : chaque boutique est isolée des autres au niveau applicatif (chaque requête est filtrée par l'identifiant de la boutique, vérifié à chaque connexion). Cette isolation est testée systématiquement à chaque évolution du service."
                  : "BoutikFlow is a multi-store platform: each store is isolated from the others at the application level (every request is filtered by the store identifier, verified on every connection). This isolation is systematically tested with every service update."}
              </p>
              <div className="features-grid">
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>{isFr ? 'Isolation par boutique' : 'Per-store isolation'}</strong>
                    <p>{isFr ? 'Aucun utilisateur ne peut voir ou modifier les données d\'une autre boutique — vérifié par des tests automatisés.' : 'No user can see or modify another store\'s data — verified by automated tests.'}</p>
                  </div>
                </div>
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>{isFr ? 'Mots de passe' : 'Passwords'}</strong>
                    <p>{isFr ? 'Jamais stockés en clair — chiffrés (hachage bcrypt) avant tout enregistrement.' : 'Never stored in plain text — encrypted (bcrypt hashing) before storage.'}</p>
                  </div>
                </div>
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>{isFr ? 'Hébergement' : 'Hosting'}</strong>
                    <p>{isFr ? 'Base de données hébergée chez Supabase (PostgreSQL managé), avec ses propres mécanismes de sauvegarde infrastructure.' : 'Database hosted with Supabase (managed PostgreSQL), with its own infrastructure-level backup mechanisms.'}</p>
                  </div>
                </div>
                <div className="feature-card">
                  <CheckCircle2 size={18} className="text-emerald" />
                  <div>
                    <strong>{isFr ? 'Limitation des accès' : 'Access control'}</strong>
                    <p>{isFr ? 'Permissions par rôle : seuls le propriétaire et les gérants voient le journal d\'audit et les finances, sauf réglage contraire explicite.' : 'Role-based permissions: only the owner and managers see the audit log and finances, unless explicitly configured otherwise.'}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Article 5 — Cookies et stockage local */}
            <section className="article-block">
              <h2>{isFr ? 'Article 5 — Cookies, Stockage Local et Traceurs' : 'Article 5 — Cookies, Local Storage & Trackers'}</h2>
              <p>
                {isFr
                  ? "BoutikFlow n'utilise aucun cookie ou traceur publicitaire tiers (pas de Google Analytics, Facebook Pixel ou équivalent). Le stockage local de votre navigateur (localStorage) sert uniquement à conserver votre session de connexion ; une base locale (IndexedDB) permet à l'application de continuer à fonctionner hors connexion et de synchroniser vos ventes dès le retour du réseau."
                  : "BoutikFlow uses no third-party advertising cookies or trackers (no Google Analytics, Facebook Pixel, or equivalent). Your browser's local storage (localStorage) is used only to keep you logged in; a local database (IndexedDB) lets the app keep working offline and sync your sales once the network returns."}
              </p>
              <p>
                {isFr
                  ? "Un service de surveillance des erreurs techniques (Sentry) peut être activé par l'équipe TrillionX pour diagnostiquer des bugs — il collecte des informations techniques sur les erreurs (jamais vos mots de passe), pas un outil de suivi publicitaire."
                  : "A technical error-monitoring service (Sentry) may be enabled by the TrillionX team to diagnose bugs — it collects technical error information (never your passwords), not an advertising tracking tool."}
              </p>
            </section>

            {/* Article 6 — Conservation */}
            <section className="article-block">
              <h2>{isFr ? 'Article 6 — Durée de Conservation' : 'Article 6 — Data Retention'}</h2>
              <p>
                {isFr
                  ? "Vos données sont conservées tant que votre compte boutique est actif. Une suppression (produit, client, membre d'équipe) est d'abord réversible (archivage) avant suppression définitive, pour éviter toute perte accidentelle. Aucune suppression automatique programmée n'efface vos données commerciales sans action de votre part."
                  : "Your data is kept for as long as your store account is active. A deletion (product, customer, team member) is first reversible (archived) before permanent removal, to prevent accidental loss. No scheduled automatic deletion erases your business data without action on your part."}
              </p>
            </section>

            {/* Article 7 — Droits */}
            <section className="article-block">
              <h2>{isFr ? 'Article 7 — Vos Droits' : 'Article 7 — Your Rights'}</h2>
              <p>{isFr ? 'Vous pouvez à tout moment :' : 'You may at any time:'}</p>
              <ul>
                <li>{isFr ? 'Demander une copie exportée de vos données (produits, clients, commandes) — voir CGU, Article 10.' : "Request an exported copy of your data (products, customers, orders) — see Terms, Article 10."}</li>
                <li>{isFr ? 'Demander la correction de données inexactes vous concernant.' : 'Request correction of inaccurate data about you.'}</li>
                <li>{isFr ? "Demander la clôture de votre compte et la suppression de vos données, sous réserve des obligations de conservation légales éventuelles." : 'Request account closure and data deletion, subject to any applicable legal retention obligations.'}</li>
              </ul>
              <p>
                {isFr
                  ? "Pour exercer ces droits, contactez-nous aux coordonnées ci-dessous."
                  : "To exercise these rights, contact us using the details below."}
              </p>
            </section>

            {/* Article 8 — Modifications */}
            <section className="article-block">
              <h2>{isFr ? 'Article 8 — Modifications de cette Politique' : 'Article 8 — Changes to this Policy'}</h2>
              <p>
                {isFr
                  ? "TrillionX peut mettre à jour cette politique de confidentialité. Les utilisateurs seront informés de toute modification substantielle."
                  : "TrillionX may update this privacy policy. Users will be informed of any material changes."}
              </p>
            </section>

            {/* Article 9 — Contact */}
            <section className="article-block contact-block">
              <h2>{isFr ? 'Article 9 — Contact' : 'Article 9 — Contact'}</h2>
              <p>{isFr ? 'Pour toute question sur cette politique de confidentialité ou pour exercer vos droits :' : 'For any question about this privacy policy or to exercise your rights:'}</p>

              <div className="contact-cards">
                <div className="contact-item">
                  <Mail size={18} className="text-emerald" />
                  <div>
                    <span className="contact-label">{isFr ? 'Email Support & Juridique' : 'Legal & Support Email'}</span>
                    <a href="mailto:trillionnx@gmail.com" className="contact-val">trillionnx@gmail.com</a>
                  </div>
                </div>

                <div className="contact-item">
                  <Phone size={18} className="text-emerald" />
                  <div>
                    <span className="contact-label">{isFr ? 'Téléphones Directs' : 'Direct Phone Numbers'}</span>
                    <span className="contact-val">+224 627 17 13 97 / 610 93 55 24</span>
                  </div>
                </div>

                <div className="contact-item">
                  <Building size={18} className="text-emerald" />
                  <div>
                    <span className="contact-label">{isFr ? 'Propulsé par' : 'Powered by'}</span>
                    <span className="contact-val">TrillionX Tech Solution</span>
                  </div>
                </div>
              </div>

              <p style={{ marginTop: '1.25rem' }}>
                {isFr ? (
                  <>Voir aussi nos <Link href="/terms" className="inline-link">Conditions Générales d&apos;Utilisation</Link>.</>
                ) : (
                  <>See also our <Link href="/terms" className="inline-link">Terms of Service</Link>.</>
                )}
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="terms-footer">
        <p>© 2026 BoutikFlow · {isFr ? 'Propulsé par TrillionX. Tous droits réservés.' : 'Powered by TrillionX. All rights reserved.'}</p>
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

        .logo-badge {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(135deg, #10b981, #059669);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 0.9rem;
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
          padding: 0.4rem 0.88rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
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

        .placeholder-alert-box {
          display: flex;
          gap: 1.25rem;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.08));
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: 14px;
          padding: 1.5rem;
          margin-bottom: 2.5rem;
        }

        .placeholder-alert-box .alert-icon-wrap {
          color: #fbbf24;
        }

        .placeholder-alert-box .alert-body h3 {
          color: #fef3c7;
        }

        .alert-icon-wrap {
          flex-shrink: 0;
          padding-top: 0.2rem;
        }

        .alert-body h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          font-weight: 700;
        }

        .alert-body p {
          margin: 0;
          color: #d1d5db;
          font-size: 0.95rem;
          line-height: 1.65;
        }

        .placeholder-inline {
          color: #fbbf24;
          font-weight: 700;
          font-style: italic;
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

        .inline-link {
          color: #34d399;
          font-weight: 600;
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
          .placeholder-alert-box {
            flex-direction: column;
            gap: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
