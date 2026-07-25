'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Menu,
  X,
  Store,
  Globe,
  UserCog,
  Settings,
  LogOut,
  Wallet,
  History,
  Volume2,
  Volume1,
  VolumeX,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';
import { ScrollToTop } from '@/components/ScrollToTop';
import { PinLock } from '@/components/ui/PinLock';
import { usePinLock } from '@/hooks/usePinLock';
import { getSoundVolumePreference, setSoundVolumePreference, VolumeLevel } from '@/lib/audio';
import { OfflineStatusBar } from '@/components/ui/OfflineStatusBar';

/* ─── Navigation simplifiée — 8 liens max ───────────────────────── */
const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Accueil',   labelEn: 'Home',     id: 'nav-dashboard' },
  { href: '/pos',       icon: ShoppingCart,    label: 'Caisse',    labelEn: 'POS',      id: 'nav-pos' },
  { href: '/products',  icon: Package,         label: 'Produits',  labelEn: 'Products', id: 'nav-products' },
  { href: '/crm',       icon: Users,           label: 'Clients',   labelEn: 'Clients',  id: 'nav-crm' },
  { href: '/sales',     icon: History,         label: 'Ventes',    labelEn: 'Sales',    id: 'nav-sales' },
  { href: '/finance',   icon: Wallet,          label: 'Finance',   labelEn: 'Finance',  id: 'nav-finance' },
  { href: '/team',      icon: UserCog,         label: 'Équipe',    labelEn: 'Team',     id: 'nav-team' },
  { href: '/billing',   icon: Settings,        label: 'Réglages',  labelEn: 'Settings', id: 'nav-settings' },
];

/* Bottom nav — 5 raccourcis mobiles */
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
        width={size} height={size} viewBox="0 0 40 40" fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: `drop-shadow(0 0 ${isOnline ? '5px rgba(109,213,196,0.6)' : '5px rgba(245,158,11,0.45)'})`,
          transition: 'filter 0.4s ease',
          animation: 'logo-breathing 4s ease-in-out infinite'
        }}
      >
        <defs>
          <linearGradient id="bf-g-dyn" x1="0" y1="0" x2="40" y2="40">
            {isOnline ? (
              <>
                <stop stopColor="#6dd5c4" />
                <stop offset="1" stopColor="#31a292" />
              </>
            ) : (
              <>
                <stop stopColor="#fbbf24" />
                <stop offset="1" stopColor="#f59e0b" />
              </>
            )}
          </linearGradient>
          <linearGradient id="bf-wave-amber" x1="0" y1="0" x2="40" y2="0">
            <stop stopColor="#fbbf24" stopOpacity="0" />
            <stop offset="0.4" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Hexagon body */}
        <path d="M20 2L36 11V29L20 38L4 29V11L20 2Z" fill="url(#bf-g-dyn)" opacity="0.95" />
        <path d="M20 2L36 11V29L20 38L4 29V11L20 2Z" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" fill="none" />
        {/* Wave 1 – top subtle */}
        <path d="M9 15 Q14.5 12 20 15 Q25.5 18 31 15" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* Wave 2 – middle bright + amber glow */}
        <path d="M9 20 Q14.5 16 20 20 Q25.5 24 31 20" stroke="rgba(255,255,255,0.88)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M9 20 Q14.5 16 20 20 Q25.5 24 31 20" stroke="url(#bf-wave-amber)" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.65" />
        {/* Wave 3 – bottom subtle */}
        <path d="M9 25 Q14.5 22 20 25 Q25.5 28 31 25" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
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
  const [userInfo, setUserInfo] = useState({
    boutiqueName: 'Ma Boutique',
    email: '',
    role: 'owner',
    plan: 'freemium',
  });
  const [soundVolume, setSoundVolume] = useState<VolumeLevel>('normal');
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage } = useLanguage();

  // Charger le volume initial
  useEffect(() => {
    setSoundVolume(getSoundVolumePreference());
  }, []);

  const handleCycleVolume = () => {
    const nextVolumeMap: Record<VolumeLevel, VolumeLevel> = {
      'normal': 'discret',
      'discret': 'muted',
      'muted': 'normal'
    };
    const nextVol = nextVolumeMap[soundVolume];
    setSoundVolume(nextVol);
    setSoundVolumePreference(nextVol);
  };

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

  /* Nav items — admin gets extra entries */
  const navItems = userInfo.role?.toLowerCase() === 'admin'
    ? [...NAV_ITEMS, { href: '/admin', icon: Store, label: 'Admin', labelEn: 'Admin', id: 'nav-admin' }]
    : NAV_ITEMS;

  return (
    <div className="shell">
      {isLocked && <PinLock onVerify={verifyPin} error={pinError} onClearError={() => setPinError('')} />}

      {/* ── Mobile top bar — affiche le nom de la boutique ── */}
      <header className="mobile-bar">
        <div className="mobile-brand">
          <div className="logo-mark"><Logo size={18} /></div>
          <span className="mobile-boutique-name">{userInfo.boutiqueName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="mobile-toggle" onClick={handleCycleVolume} aria-label="Volume">
            {soundVolume === 'normal' && <Volume2 size={18} />}
            {soundVolume === 'discret' && <Volume1 size={18} />}
            {soundVolume === 'muted' && <VolumeX size={18} />}
          </button>
          <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(true)} aria-label="Menu">
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* ── Barre offline — juste sous la mobile-bar ── */}
      <div className="offline-bar-wrapper">
        <OfflineStatusBar />
      </div>

      {/* ── Backdrop ── */}
      {isMobileMenuOpen && <div className="backdrop" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* ══ SIDEBAR — Navigation plate 8 liens ══ */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'sidebar--open' : ''}`}>

        {/* En-tête : logo + nom boutique + fermer */}
        <div className="sidebar__brand">
          <div className="logo-mark"><Logo size={20} /></div>
          <div className="sidebar-brand-info">
            <span className="sidebar-boutique-name">{userInfo.boutiqueName}</span>
            <span className="sidebar-plan-badge">
              {userInfo.plan === 'freemium' ? '✦ Freemium' : userInfo.plan === 'lifetime' ? '⚡ Lifetime' : '✓ Pro'}
            </span>
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* Navigation plate */}
        <nav className="sidebar__nav">
          {navItems.map((item) => {
            const ItemIcon = item.icon;
            const isDash = item.href === '/dashboard';
            const active = isDash ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                id={item.id}
                className={`nav-link ${active ? 'nav-link--active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="nav-icon-wrap">
                  <ItemIcon size={20} />
                </div>
                <span className="nav-text">{language === 'fr' ? item.label : item.labelEn}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer profil */}
        <div className="sidebar__footer">
          <button className="lang-toggle" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}>
            <Globe size={14} />
            <span>{language === 'fr' ? 'Français' : 'English'}</span>
            <span>{language === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
          </button>

          <div className="footer-separator" />

          <div className="profile-container" ref={profileDropdownRef}>
            <div
              className={`profile-card ${isProfileDropdownOpen ? 'profile-card--open' : ''}`}
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <div className="profile-avatar">{userInitial}</div>
              <div className="profile-info">
                <span className="profile-name">{userName}</span>
                <span className="profile-role">
                  {userInfo.role === 'admin' ? 'Admin' : userInfo.role === 'owner' ? (language === 'fr' ? 'Propriétaire' : 'Owner') : userInfo.role}
                </span>
              </div>
            </div>

            {isProfileDropdownOpen && (
              <div className="profile-dropdown">
                <div className="dropdown-item dropdown-item--logout" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>{language === 'fr' ? 'Déconnexion' : 'Logout'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="main">
        <div className="main__inner main-content">{children}</div>
        <ScrollToTop />
      </main>

      {/* ══ BOTTOM NAV — Glassmorphism Dock ══ */}
      <nav className="bottom-nav" aria-label="Navigation principale mobile">
        <div className="bottom-nav-glass">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const isDash = item.href === '/dashboard';
            const active = isDash ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`bottom-nav-item ${active ? 'active' : ''}`}>
                <div className="bottom-nav-icon-box">
                  <Icon size={20} className="bottom-nav-icon" />
                  {active && <div className="bottom-nav-pill-bg" />}
                </div>
                <span className="bottom-nav-label">{item.label}</span>
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
          /* safe-area pour l'encoche iOS / Dynamic Island */
          padding-top: env(safe-area-inset-top, 0px);
          height: calc(56px + env(safe-area-inset-top, 0px));
          background: rgba(8, 12, 11, 0.92);
          border-bottom: 1px solid rgba(109,213,196,0.15);
          padding-left: 1rem;
          padding-right: 1rem;
          align-items: flex-end;
          padding-bottom: 0.5rem;
          justify-content: space-between;
          z-index: 1100;
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
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
          background: rgba(109,213,196,0.15);
          border: 1px solid rgba(109,213,196,0.25);
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
          font-size: 1.1rem; font-weight: 800;
          background: linear-gradient(135deg, #6dd5c4 0%, #4ebfae 50%, #31a292 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }

        /* Nom de boutique dans la barre mobile */
        .mobile-boutique-name {
          font-family: var(--font-display);
          font-size: 1rem; font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }

        /* Barre offline positionnée sous la mobile-bar */
        .offline-bar-wrapper {
          display: none;
          position: fixed;
          top: calc(56px + env(safe-area-inset-top, 0px));
          left: 0; right: 0;
          z-index: 1090;
        }

        /* ══ SIDEBAR ════════════════════════════════ */
        .sidebar {
          width: 256px;
          height: 100vh;
          position: sticky; top: 0;
          display: flex; flex-direction: column;
          background: linear-gradient(180deg, #080c0b 0%, #050807 50%, #030504 100%);
          border-right: 1px solid rgba(109,213,196,0.14);
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
          padding: 1rem 1rem 0.875rem;
          position: sticky; top: 0;
          background: inherit;
          z-index: 1;
          border-bottom: 1px solid rgba(109,213,196,0.10);
          margin-bottom: 0.25rem;
          min-width: 0;
        }

        /* Info boutique dans la sidebar */
        .sidebar-brand-info {
          display: flex; flex-direction: column;
          min-width: 0; flex: 1;
        }
        .sidebar-boutique-name {
          font-family: var(--font-display);
          font-size: 0.88rem; font-weight: 800;
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          letter-spacing: -0.01em;
        }
        .sidebar-plan-badge {
          font-size: 0.67rem; font-weight: 600;
          color: #6dd5c4;
          margin-top: 1px;
        }

        .sidebar-collapse-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #9898a8;
          border-radius: 7px;
          width: 28px; height: 28px;
          min-width: 28px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          padding: 0;
          flex-shrink: 0;
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
          background: rgba(109,213,196,0.06);
          border: 1px solid rgba(109,213,196,0.15);
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .boutique-card:hover {
          background: rgba(109,213,196,0.12);
          border-color: rgba(109,213,196,0.28);
        }
        .boutique-icon {
          width: 34px; height: 34px;
          border-radius: 8px;
          background: rgba(109,213,196,0.15);
          color: #6dd5c4;
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
          color: #6dd5c4;
          font-weight: 600;
          margin-top: 1px;
        }

        /* ── Navigation plate ─────────────────────── */
        .sidebar__nav {
          flex: 1;
          display: flex; flex-direction: column;
          gap: 2px;
          padding: 0.25rem 0.75rem;
          margin-bottom: 0.5rem;
        }

        /* Icône wrap — carré arrondi visible */
        .nav-icon-wrap {
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          background: transparent;
          transition: background 0.15s ease;
          color: inherit;
        }
        .nav-link--active .nav-icon-wrap {
          background: rgba(109,213,196,0.18);
          color: #6dd5c4;
        }

        .nav-link {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.375rem 0.5rem;
          min-height: 48px;
          border-radius: 12px;
          text-decoration: none;
          color: rgba(255,255,255,0.5);
          font-size: 0.9rem; font-weight: 500;
          position: relative;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          background: transparent;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }
        .nav-link:hover {
          color: rgba(255,255,255,0.9);
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.06);
        }
        .nav-link:active { transform: scale(0.98); }

        .nav-link--active {
          color: #6dd5c4;
          background: rgba(109,213,196,0.10);
          border-color: rgba(109,213,196,0.20);
          font-weight: 700;
        }
        .nav-link--active:hover {
          background: rgba(109,213,196,0.16);
          color: #98e5d9;
        }

        .nav-icon {
          flex-shrink: 0; color: inherit;
          width: 20px; height: 20px;
          display: inline-block; opacity: 0.85;
        }
        .nav-link--active .nav-icon { opacity: 1; color: #6dd5c4; }

        .nav-text {
          flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* POS badge */
        .nav-pill-pos {
          font-size: 0.6rem; font-weight: 800;
          background: rgba(109,213,196,0.25);
          color: #6dd5c4;
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
          color: rgba(255,255,255,0.4);
          font-size: 0.78rem; font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 0.375rem;
          width: 100%;
        }
        .lang-toggle:hover {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.75);
          border-color: rgba(109,213,196,0.2);
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
          border-color: rgba(109,213,196,0.2);
        }

        .profile-avatar {
          width: 34px; height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6dd5c4, #31a292);
          border: 2px solid rgba(109,213,196,0.4);
          color: #080c0b;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.85rem;
          flex-shrink: 0;
          box-shadow: 0 0 0 0 rgba(109,213,196,0.4);
          transition: box-shadow 0.2s ease;
        }
        .profile-card:hover .profile-avatar {
          box-shadow: 0 0 0 3px rgba(109,213,196,0.25);
        }

        .profile-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .profile-name { font-size: 0.8rem; font-weight: 600; color: #f4f4f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .profile-role { font-size: 0.68rem; color: rgba(255,255,255,0.4); margin-top: 1px; }

        .profile-chevron { color: rgba(255,255,255,0.3); transition: transform 0.2s ease; flex-shrink: 0; }
        .profile-chevron--rotated { transform: rotate(180deg); }

        .profile-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0; right: 0;
          background: #0e1412;
          border: 1px solid rgba(109,213,196,0.2);
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
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 45;
        }

        /* ══ Bottom Navigation Fixed ══════════════════ */
        .bottom-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .mobile-bar { display: flex; }
          .offline-bar-wrapper { display: block; }

          .main__inner {
            padding: 1.25rem 1rem;
            /* Compense hauteur barre top + safe-area haut + marge */
            padding-top: calc(56px + env(safe-area-inset-top, 0px) + 1rem) !important;
            padding-bottom: calc(90px + env(safe-area-inset-bottom, 0px)) !important;
          }

          .sidebar {
            position: fixed; left: 0; top: 0; bottom: 0;
            width: 280px;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 1050;
            box-shadow: 12px 0 40px rgba(0,0,0,0.65);
            padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
          }
          .sidebar--open { transform: translateX(0); }
          .backdrop { display: block; }

          /* Glassmorphism Floating Dock Fixed Navigation */
          .bottom-nav {
            display: flex;
            position: fixed;
            bottom: calc(0.6rem + env(safe-area-inset-bottom, 0px));
            left: 0;
            right: 0;
            justify-content: center;
            z-index: 1000;
            pointer-events: none;
            padding: 0 1rem;
          }

          .bottom-nav-glass {
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: space-around;
            width: 100%;
            max-width: 440px;
            height: 64px;
            background: rgba(8, 12, 11, 0.85);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(109, 213, 196, 0.24);
            border-radius: 26px;
            box-shadow: 
              0 12px 32px rgba(0, 0, 0, 0.55),
              0 2px 10px rgba(109, 213, 196, 0.12),
              inset 0 1px 0 rgba(255, 255, 255, 0.12);
            padding: 0 0.4rem;
          }

          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            flex: 1;
            height: 100%;
            text-decoration: none;
            color: var(--text-muted);
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            -webkit-tap-highlight-color: transparent;
          }

          .bottom-nav-icon-box {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 28px;
            border-radius: 14px;
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          .bottom-nav-icon {
            z-index: 2;
            transition: transform 0.2s var(--ease-spring), color 0.2s ease;
          }

          .bottom-nav-pill-bg {
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(109, 213, 196, 0.25), rgba(49, 162, 146, 0.2));
            border: 1px solid rgba(109, 213, 196, 0.35);
            border-radius: 14px;
            z-index: 1;
            animation: pulseIn 0.25s var(--ease-spring);
            box-shadow: 0 2px 10px rgba(109, 213, 196, 0.25);
          }

          .bottom-nav-label {
            font-size: 0.68rem;
            font-weight: 600;
            letter-spacing: -0.01em;
            transition: color 0.2s ease, font-weight 0.2s ease;
          }

          .bottom-nav-item.active .bottom-nav-icon {
            color: #6dd5c4;
            transform: translateY(-1px) scale(1.1);
          }

          .bottom-nav-item.active .bottom-nav-label {
            color: #6dd5c4;
            font-weight: 800;
          }

          .bottom-nav-item:active {
            transform: scale(0.92);
          }
        }

        @media (min-width: 769px) {
          .sidebar-collapse-btn { display: none; }
        }
      `}</style>
    </div>
  );
}

