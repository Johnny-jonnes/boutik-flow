'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  ShoppingCart,
  MessageSquare,
  Menu,
  X,
  Store,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Rocket,
  BarChart3,
  Tags,
  FolderTree,
  Megaphone,
  Shield,
  Globe,
  Truck,
  UserCog,
  Settings,
  CreditCard,
  LogOut,
  Wallet,
  ClipboardList,
  History,
  Zap,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';
import { ScrollToTop } from '@/components/ScrollToTop';
import { PinLock } from '@/components/ui/PinLock';
import { usePinLock } from '@/hooks/usePinLock';

/* ─── Navigation data ───────────────────────────────────────────── */
const NAV_GROUPS = [
  {
    title: 'Tableau de Bord',
    titleKey: 'nav.dashboard',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard',  icon: LayoutDashboard, labelKey: 'nav.dashboard', label: "Vue d'ensemble", id: 'nav-dashboard' },
      { href: '/analytics',  icon: BarChart3,        labelKey: 'nav.analytics', label: 'Analytique',     id: 'nav-analytics' },
    ],
  },
  {
    title: 'CRM',
    titleKey: 'nav.crm',
    icon: Users,
    items: [
      { href: '/crm',      icon: Users, labelKey: 'nav.crm',      label: 'Clients',  id: 'nav-crm' },
      { href: '/segments', icon: Tags,  labelKey: 'nav.segments',  label: 'Segments', id: 'nav-segments' },
    ],
  },
  {
    title: 'Ventes',
    titleKey: 'nav.products',
    icon: ShoppingBag,
    items: [
      { href: '/pos',        icon: ShoppingCart, labelKey: 'nav.pos',        label: 'Vente Express',      id: 'nav-pos' },
      { href: '/sales',      icon: History,      labelKey: 'nav.sales',      label: 'Historique Ventes',  id: 'nav-sales' },
      { href: '/orders',     icon: ClipboardList,labelKey: 'nav.orders',     label: 'Suivi Commandes',    id: 'nav-orders' },
      { href: '/products',   icon: Package,      labelKey: 'nav.products',   label: 'Produits',           id: 'nav-products' },
      { href: '/categories', icon: FolderTree,   labelKey: 'nav.categories', label: 'Catégories',         id: 'nav-categories' },
      { href: '/suppliers',  icon: Truck,        labelKey: 'nav.suppliers',  label: 'Fournisseurs',       id: 'nav-suppliers' },
    ],
  },
  {
    title: 'Marketing',
    titleKey: 'nav.campaigns',
    icon: Megaphone,
    items: [
      { href: '/whatsapp', icon: MessageSquare, labelKey: 'nav.whatsapp', label: 'WhatsApp', id: 'nav-whatsapp' },
    ],
  },
  {
    title: 'Gestion',
    titleKey: 'nav.management',
    icon: Settings,
    items: [
      { href: '/team',    icon: UserCog,      labelKey: 'nav.team',    label: 'Équipe',   id: 'nav-team' },
      { href: '/finance', icon: Wallet,       labelKey: 'nav.finance', label: 'Finance',  id: 'nav-finance' },
      { href: '/audit',   icon: ClipboardList,labelKey: 'nav.audit',   label: 'Audit',    id: 'nav-audit' },
    ],
  },
];

/* Bottom nav — 5 raccourcis mobiles les plus fréquents */
const BOTTOM_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Accueil' },
  { href: '/pos',       icon: ShoppingCart,    label: 'Caisse' },
  { href: '/products',  icon: Package,         label: 'Produits' },
  { href: '/crm',       icon: Users,           label: 'Clients' },
  { href: '/finance',   icon: Wallet,          label: 'Finance' },
];

/* ─── Logo SVG indigo ───────────────────────────────────────────── */
function Logo({ size = 20 }: { size?: number }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(window.navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg
        width={size} height={size} viewBox="0 0 28 28" fill="none"
        style={{
          filter: `drop-shadow(0 0 5px ${isOnline ? 'rgba(99,102,241,0.4)' : 'rgba(245,158,11,0.4)'})`,
          transition: 'all 0.3s ease',
          animation: 'logo-breathing 4s ease-in-out infinite'
        }}
      >
        <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#bf-g-dyn)" />
        <path d="M9 14L12.5 17.5L19 11" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="bf-g-dyn" x1="2" y1="2" x2="26" y2="26">
            {isOnline ? (
              <>
                <stop stopColor="#818cf8" />
                <stop offset="1" stopColor="#4f46e5" />
              </>
            ) : (
              <>
                <stop stopColor="#fbbf24" />
                <stop offset="1" stopColor="#f59e0b" />
              </>
            )}
          </linearGradient>
        </defs>
      </svg>
      <span
        style={{
          position: 'absolute',
          bottom: '-3px',
          right: '-3px',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          border: '1px solid #0a0a0d',
          backgroundColor: isOnline ? '#22c55e' : '#fbbf24',
          boxShadow: `0 0 5px ${isOnline ? '#22c55e' : '#fbbf24'}`,
          transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════════════════════════ */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLocked, pinError, verifyPin, setPinError } = usePinLock();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Tableau de Bord': true,
    'CRM': true,
    'Ventes': true,
    'Marketing': true,
    'Gestion': true,
    'Administration': true,
  });
  const [userInfo, setUserInfo] = useState({
    boutiqueName: 'Ma Boutique',
    email: '',
    role: 'owner',
    plan: 'freemium',
  });
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();

  /* Decode JWT */
  useEffect(() => {
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserInfo({
          boutiqueName: payload.tenant_name || 'Ma Boutique',
          email:        payload.email || payload.sub || '',
          role:         payload.role  || 'owner',
          plan:         payload.tenant_plan || 'freemium',
        });
      } else {
        window.location.href = '/login';
      }
    } catch {
      window.location.href = '/login';
    }
  }, []);

  /* Close dropdown on outside click */
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const userInitial = userInfo.email ? userInfo.email.charAt(0).toUpperCase() : 'U';
  const userName    = userInfo.email ? userInfo.email.split('@')[0] : 'Utilisateur';

  /* All nav groups including optional admin */
  const allGroups = [
    ...NAV_GROUPS,
    ...(userInfo.role?.toLowerCase() === 'admin' ? [{
      title: 'Administration',
      titleKey: 'nav.admin',
      icon: Shield,
      items: [
        { href: '/admin',         icon: LayoutDashboard, labelKey: 'nav.dashboard', label: "Vue d'ensemble",   id: 'nav-admin-dashboard' },
        { href: '/admin/tenants', icon: Store,            labelKey: 'nav.tenants',   label: 'Gestion Boutiques', id: 'nav-admin-tenants' },
      ],
    }] : []),
  ];

  return (
    <div className="shell">
      {isLocked && <PinLock onVerify={verifyPin} error={pinError} onClearError={() => setPinError('')} />}

      {/* ── Mobile top bar ─────────────────────────── */}
      <header className="mobile-bar">
        <div className="mobile-brand">
          <div className="logo-mark"><Logo size={18} /></div>
          <span className="brand-text">BoutikFlow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ThemeToggle />
          <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(true)} aria-label="Menu">
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* ── Backdrop ───────────────────────────────── */}
      {isMobileMenuOpen && <div className="backdrop" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* ══════════════════════════════════════════════
          SIDEBAR
          ══════════════════════════════════════════════ */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'sidebar--open' : ''}`}>

        {/* Brand header */}
        <div className="sidebar__brand">
          <div className="logo-mark"><Logo size={20} /></div>
          <span className="brand-text">BoutikFlow</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ThemeToggle />
            <button className="sidebar-collapse-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fermer">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Boutique pill */}
        <div className="boutique-card">
          <div className="boutique-icon"><Store size={16} /></div>
          <div className="boutique-details">
            <span className="boutique-name">{userInfo.boutiqueName}</span>
            <span className="boutique-badge">
              {userInfo.plan === 'freemium' ? '✦ Freemium' : userInfo.plan === 'lifetime' ? '⚡ Lifetime' : '✓ Pro'}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          {allGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups[group.title] !== false;
            return (
              <div key={group.title} className="nav-group">
                <button
                  className="nav-section-title"
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group.title]: !isExpanded }))}
                >
                  <div className="nav-section-title-left">
                    <GroupIcon size={13} />
                    <span>{t(group.titleKey)}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                {isExpanded && (
                  <div className="nav-items-wrapper">
                    {group.items.map((item) => {
                      const isDashboard = item.href === '/dashboard';
                      const active = isDashboard ? pathname === item.href : pathname.startsWith(item.href);
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          id={item.id}
                          className={`nav-link ${active ? 'nav-link--active' : ''}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <ItemIcon size={15} className="nav-icon" />
                          <span className="nav-text">{t(item.labelKey)}</span>
                          {item.id === 'nav-whatsapp' && <span className="wa-dot" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar__footer">
          <button className="lang-toggle" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}>
            <Globe size={13} />
            <span>{language === 'fr' ? 'Français' : 'English'}</span>
            <span className="lang-flag">{language === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
          </button>

          <div className="footer-separator" />

          {/* Profile */}
          <div className="profile-container" ref={profileDropdownRef}>
            <div
              className={`profile-card ${isProfileDropdownOpen ? 'profile-card--open' : ''}`}
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <div className="profile-avatar">{userInitial}</div>
              <div className="profile-info">
                <span className="profile-name">{userName}</span>
                <span className="profile-role">
                  {userInfo.role === 'admin' ? 'Super Admin' : userInfo.role === 'owner' ? (language === 'fr' ? 'Propriétaire' : 'Owner') : userInfo.role}
                </span>
              </div>
              <ChevronDown size={13} className={`profile-chevron ${isProfileDropdownOpen ? 'profile-chevron--rotated' : ''}`} />
            </div>

            {isProfileDropdownOpen && (
              <div className="profile-dropdown">
                <div className="dropdown-item dropdown-item--logout" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>{t('sidebar.logout')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────── */}
      <main className="main">
        <div className="main__inner main-content">{children}</div>
        <ScrollToTop />
      </main>

      {/* ══════════════════════════════════════════════
          BOTTOM NAV — Mobile uniquement
          ══════════════════════════════════════════════ */}
      <nav className="bottom-nav">
        <div className="bottom-nav-items">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const isDash = item.href === '/dashboard';
            const active = isDash ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`bottom-nav-item ${active ? 'active' : ''}`}>
                <div className="bottom-nav-icon">
                  <Icon size={22} />
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <style jsx>{`
        /* ══ Shell ══════════════════════════════════ */
        .shell {
          display: flex;
          min-height: 100vh;
          background: var(--surface-0);
        }

        /* ══ Mobile top bar ════════════════════════ */
        .mobile-bar {
          display: none;
          position: fixed; top: 0; left: 0; right: 0;
          height: 56px;
          background: var(--surface-1);
          border-bottom: 1px solid var(--border-subtle);
          padding: 0 1rem;
          align-items: center;
          justify-content: space-between;
          z-index: 40;
          backdrop-filter: blur(20px);
        }
        .mobile-brand { display: flex; align-items: center; gap: 0.5rem; }
        .mobile-toggle {
          background: var(--surface-2); border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-primary); cursor: pointer;
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s ease;
        }
        .mobile-toggle:hover { background: var(--surface-3); }

        /* ══ Logo ══════════════════════════════════ */
        .logo-mark {
          width: 34px; height: 34px;
          border-radius: 10px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.25);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s var(--ease-spring);
        }
        .logo-mark:hover { transform: scale(1.06) rotate(-3deg); }
        @keyframes logo-breathing {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        .brand-text {
          font-family: var(--font-display);
          font-size: 1.15rem; font-weight: 800;
          background: linear-gradient(135deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
        }

        /* ══ SIDEBAR ════════════════════════════════ */
        .sidebar {
          width: 256px;
          height: 100vh;
          position: sticky; top: 0;
          display: flex; flex-direction: column;
          background: linear-gradient(180deg, #0f0f14 0%, #0a0a0e 50%, #070709 100%);
          border-right: 1px solid rgba(99,102,241,0.12);
          flex-shrink: 0;
          z-index: 50;
          overflow-y: auto;
          overflow-x: hidden;
          padding-bottom: 1rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.08) transparent;
        }

        @media (min-width: 1440px) {
          .sidebar { width: 272px; }
        }

        .sidebar__brand {
          display: flex; align-items: center; gap: 0.625rem;
          padding: 1.25rem 1rem 0.875rem;
          position: sticky; top: 0;
          background: inherit;
          z-index: 1;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          margin-bottom: 0.5rem;
        }

        .sidebar-collapse-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #9898a8;
          border-radius: 7px;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          padding: 0;
        }
        .sidebar-collapse-btn:hover {
          background: rgba(255,255,255,0.1);
          color: #f4f4f6;
        }

        /* ── Boutique card ────────────────────────── */
        .boutique-card {
          display: flex; align-items: center; gap: 0.625rem;
          margin: 0 0.75rem 1rem;
          padding: 0.625rem 0.75rem;
          border-radius: 12px;
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.15);
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .boutique-card:hover {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.25);
        }
        .boutique-icon {
          width: 34px; height: 34px;
          border-radius: 8px;
          background: rgba(99,102,241,0.15);
          color: #818cf8;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .boutique-details {
          display: flex; flex-direction: column;
          min-width: 0; flex: 1;
        }
        .boutique-name {
          font-size: 0.83rem; font-weight: 700;
          color: #f4f4f6;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .boutique-badge {
          font-size: 0.68rem;
          color: #818cf8;
          font-weight: 600;
          margin-top: 1px;
        }

        /* ── Navigation ───────────────────────────── */
        .sidebar__nav {
          flex: 1;
          display: flex; flex-direction: column;
          gap: 0.25rem;
          padding: 0 0.625rem;
          margin-bottom: 1rem;
        }

        .nav-group {
          display: flex;
          flex-direction: column;
          margin-bottom: 0.25rem;
        }

        .nav-section-title {
          font-size: 0.7rem; font-weight: 700;
          color: rgba(255,255,255,0.28);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.5rem 0.625rem 0.25rem;
          margin-top: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          border: none;
          width: 100%;
          cursor: pointer;
          transition: color 0.15s ease;
        }
        .nav-section-title:hover { color: rgba(255,255,255,0.55); }
        .nav-section-title-left {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .nav-items-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .nav-link {
          display: flex; align-items: center; gap: 0.625rem;
          padding: 0.55rem 0.75rem;
          border-radius: 10px;
          text-decoration: none;
          color: rgba(255,255,255,0.45);
          font-size: 0.84rem; font-weight: 500;
          position: relative;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          background: transparent;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
        }
        .nav-link:hover {
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.06);
        }
        .nav-link:active { transform: scale(0.98); }

        .nav-link--active {
          color: #a5b4fc;
          background: rgba(99,102,241,0.14);
          border-color: rgba(99,102,241,0.22);
          font-weight: 600;
        }
        .nav-link--active:hover {
          background: rgba(99,102,241,0.18);
          color: #c7d2fe;
        }

        .nav-icon {
          flex-shrink: 0;
          color: inherit;
          width: 15px; height: 15px;
          display: inline-block;
          opacity: 0.8;
        }
        .nav-link--active .nav-icon { opacity: 1; }

        .nav-text {
          flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* POS badge */
        .nav-pill-pos {
          font-size: 0.6rem; font-weight: 800;
          background: rgba(99,102,241,0.25);
          color: #818cf8;
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }

        /* WhatsApp live dot */
        .wa-dot {
          width: 7px; height: 7px;
          background: #22c55e;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(34,197,94,0.6);
          animation: pulse-wa 2s infinite;
        }
        @keyframes pulse-wa {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* ── Footer ───────────────────────────────── */
        .sidebar__footer {
          padding: 0 0.75rem;
          display: flex; flex-direction: column;
          margin-top: auto;
        }

        .lang-toggle {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 0.625rem;
          border-radius: 9px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.38);
          font-size: 0.78rem; font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 0.375rem;
          width: 100%;
        }
        .lang-toggle:hover {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.7);
          border-color: rgba(255,255,255,0.12);
        }
        .lang-flag { margin-left: auto; font-size: 0.9rem; }

        .footer-separator {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 0.375rem 0.25rem 0.625rem;
        }

        /* ── Profile ──────────────────────────────── */
        .profile-container { position: relative; width: 100%; }

        .profile-card {
          display: flex; align-items: center; gap: 0.625rem;
          padding: 0.5rem 0.625rem;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }
        .profile-card:hover, .profile-card--open {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.08);
        }

        .profile-avatar {
          width: 34px; height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          border: 2px solid rgba(99,102,241,0.4);
          color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.85rem;
          flex-shrink: 0;
          box-shadow: 0 0 0 0 rgba(99,102,241,0.4);
          transition: box-shadow 0.2s ease;
        }
        .profile-card:hover .profile-avatar {
          box-shadow: 0 0 0 3px rgba(99,102,241,0.2);
        }

        .profile-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .profile-name { font-size: 0.8rem; font-weight: 600; color: #f4f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .profile-role { font-size: 0.68rem; color: rgba(255,255,255,0.38); margin-top: 1px; }

        .profile-chevron { color: rgba(255,255,255,0.3); transition: transform 0.2s ease; flex-shrink: 0; }
        .profile-chevron--rotated { transform: rotate(180deg); }

        .profile-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0; right: 0;
          background: #1a1a20;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 0.35rem;
          box-shadow: 0 16px 40px rgba(0,0,0,0.7);
          z-index: 60;
          animation: scaleIn 0.18s var(--ease-spring);
        }

        .dropdown-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.625rem 0.75rem;
          border-radius: 8px;
          font-size: 0.84rem; font-weight: 500;
          color: #e4e4e6;
          cursor: pointer;
          transition: all 0.12s ease;
          border: none; background: transparent;
        }
        .dropdown-item:hover { background: rgba(255,255,255,0.07); color: white; }
        .dropdown-item--logout { color: #fca5a5; }
        .dropdown-item--logout:hover { background: rgba(244,63,94,0.15); color: #fff; }

        /* ══ Main content ═══════════════════════════ */
        .main { flex: 1; min-width: 0; overflow-y: auto; }
        .main__inner {
          max-width: 1440px;
          padding: 2rem 2.5rem;
          margin: 0 auto;
        }

        /* ══ Backdrop ═══════════════════════════════ */
        .backdrop {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          z-index: 45;
        }

        /* ══ Responsive ═════════════════════════════ */
        @media (max-width: 768px) {
          .mobile-bar { display: flex; }
          .main__inner { padding: 1.25rem 1rem; padding-top: calc(56px + 1rem); }

          .sidebar {
            position: fixed; left: 0; top: 0; bottom: 0;
            transform: translateX(-100%);
            transition: transform 0.28s var(--ease-out);
            z-index: 50;
          }
          .sidebar--open { transform: translateX(0); }
          .backdrop { display: block; }
        }

        @media (min-width: 769px) {
          .sidebar-collapse-btn { display: none; }
        }
      `}</style>
    </div>
  );
}
