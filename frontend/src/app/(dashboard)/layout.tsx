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
  CreditCard,
  Globe,
  UserCog,
  Settings,
  LogOut,
  Wallet,
  History,
  FolderTree,
  Volume2,
  Volume1,
  VolumeX,
  Bell,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';
import { ScrollToTop } from '@/components/ScrollToTop';
import { PinLock } from '@/components/ui/PinLock';
import { usePinLock } from '@/hooks/usePinLock';
import { getSoundVolumePreference, setSoundVolumePreference, VolumeLevel, SoundEffects, triggerHaptic } from '@/lib/audio';
import { OfflineStatusBar } from '@/components/ui/OfflineStatusBar';
import { clearOfflineDatabase } from '@/lib/offlineDb';
import { SyncJournalModal } from '@/components/ui/SyncJournalModal';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { hasPermission, ROUTE_PERMISSIONS, firstAllowedRoute } from '@/lib/permissions';
import { BrandMark } from '@/components/BrandMark';
import '@/styles/premium-ui.css';

/* ─── Navigation — regroupée par sections ───────────────────────── */
type NavGroup = 'main' | 'catalog' | 'sales' | 'manage' | 'admin';

const NAV_GROUPS: { id: NavGroup; label: string; labelEn: string }[] = [
  { id: 'main',    label: 'Principal',        labelEn: 'Main' },
  { id: 'catalog', label: 'Catalogue',        labelEn: 'Catalog' },
  { id: 'sales',   label: 'Clients & ventes', labelEn: 'Customers & sales' },
  { id: 'manage',  label: 'Gestion',          labelEn: 'Management' },
  { id: 'admin',   label: 'Plateforme',       labelEn: 'Platform' },
];

const NAV_ITEMS: { href: string; icon: typeof LayoutDashboard; label: string; labelEn: string; id: string; group: NavGroup }[] = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Accueil',     labelEn: 'Home',       id: 'nav-dashboard',  group: 'main' },
  { href: '/pos',        icon: ShoppingCart,    label: 'Vendre',      labelEn: 'Sell',       id: 'nav-pos',        group: 'main' },
  { href: '/products',   icon: Package,         label: 'Produits',    labelEn: 'Products',   id: 'nav-products',   group: 'catalog' },
  { href: '/categories', icon: FolderTree,      label: 'Catégories',  labelEn: 'Categories', id: 'nav-categories', group: 'catalog' },
  { href: '/crm',        icon: Users,           label: 'Clients',     labelEn: 'Clients',    id: 'nav-crm',        group: 'sales' },
  { href: '/dettes',     icon: CreditCard,      label: 'Dettes',      labelEn: 'Debts',      id: 'nav-dettes',     group: 'sales' },
  { href: '/sales',      icon: History,         label: 'Ventes',      labelEn: 'Sales',      id: 'nav-sales',      group: 'sales' },
  { href: '/finance',    icon: Wallet,          label: 'Finances',    labelEn: 'Finances',   id: 'nav-finance',    group: 'manage' },
  { href: '/team',       icon: UserCog,         label: 'Équipe',      labelEn: 'Team',       id: 'nav-team',       group: 'manage' },
  { href: '/settings',   icon: Settings,        label: 'Paramètres',  labelEn: 'Settings',   id: 'nav-settings',   group: 'manage' },
];

/* Libellés lisibles des rôles (le JWT porte la valeur brute de RoleEnum). */
const ROLE_LABELS: Record<string, { fr: string; en: string }> = {
  owner:                { fr: 'Propriétaire',       en: 'Owner' },
  manager:              { fr: 'Gérant',             en: 'Manager' },
  cashier:              { fr: 'Caissier',           en: 'Cashier' },
  stock_manager:        { fr: 'Gestionnaire stock', en: 'Stock manager' },
  seller_stock_manager: { fr: 'Vendeur · Stock',    en: 'Seller · Stock' },
  staff:                { fr: 'Employé',            en: 'Staff' },
  admin:                { fr: 'Administrateur',     en: 'Administrator' },
};

/* Bottom nav — 5 raccourcis mobiles */
const BOTTOM_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Accueil',  labelEn: 'Home' },
  { href: '/pos',       icon: ShoppingCart,    label: 'Vendre',   labelEn: 'Sell' },
  { href: '/products',  icon: Package,         label: 'Produits', labelEn: 'Products' },
  { href: '/crm',       icon: Users,           label: 'Clients',  labelEn: 'Clients' },
  { href: '/finance',   icon: Wallet,          label: 'Finances', labelEn: 'Finances' },
];

/* ─── Logo BF — couleurs guinéennes ─────────────────────────────── */
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
      <BrandMark
        size={size}
        style={{
          filter: `drop-shadow(0 0 ${isOnline ? '4px rgba(49,162,146,0.5)' : '4px rgba(245,158,11,0.45)'})`,
          transition: 'filter 0.4s ease',
          animation: 'logo-breathing 4s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'absolute',
          bottom: '-2px',
          right: '-2px',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          border: '1.5px solid var(--sidebar-bg)',
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
  const router = useRouter();
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
  const [isSyncJournalOpen, setIsSyncJournalOpen] = useState(false);
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

  /* Garde de route par rôle — le vrai contrôle d'accès reste côté FastAPI
     (require_permission) : ceci n'est qu'un filet UX cohérent, pour ne
     jamais laisser un rôle atterrir sur une page dont le menu est déjà
     masqué pour lui (lien direct, favori, retour navigateur...). */
  useEffect(() => {
    if (!userInfo.email || !pathname) return;
    if (userInfo.role?.toLowerCase() === 'admin') return;
    const perm = ROUTE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix));
    if (perm && !hasPermission(userInfo.role, perm.module, perm.action)) {
      router.replace(firstAllowedRoute(userInfo.role));
    }
  }, [pathname, userInfo.role, userInfo.email, router]);

  /* Alerte admin en temps réel — cloche + son quand une nouvelle demande
     d'inscription arrive, quel que soit l'appareil ou la distance du
     demandeur. Sans ce polling, la seule façon de voir une nouvelle
     demande était d'ouvrir /admin manuellement et de le rafraîchir. */
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const prevUnreadCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (userInfo.role?.toLowerCase() !== 'admin') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const stats = await api.getAdminStats();
        if (cancelled) return;
        const count = stats.unread_notifications || 0;
        if (prevUnreadCountRef.current !== null && count > prevUnreadCountRef.current) {
          SoundEffects.playNotification();
          triggerHaptic(200);
          toast.info(
            language === 'fr'
              ? 'Nouvelle demande d\'inscription reçue'
              : 'New registration request received'
          );
        }
        prevUnreadCountRef.current = count;
        setUnreadAdminCount(count);
      } catch {
        // Polling silencieux : une erreur réseau ponctuelle ne doit pas gêner l'utilisateur.
      }
    };

    poll();
    const interval = setInterval(poll, 25000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userInfo.role, language]);

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

  const handleLogout = async () => {
    // Sur un appareil partagé entre boutiques, le cache hors-ligne (IndexedDB)
    // doit être vidé avant qu'un autre utilisateur/boutique ne se connecte —
    // sinon ses produits/clients/commandes resteraient visibles localement
    // tant qu'aucune synchronisation n'a eu lieu.
    await clearOfflineDatabase();
    localStorage.clear();
    window.location.href = '/login';
  };

  const userInitial = userInfo.email ? userInfo.email.charAt(0).toUpperCase() : 'U';
  const userName    = userInfo.email ? userInfo.email.split('@')[0] : 'Utilisateur';
  const roleLabel   = ROLE_LABELS[userInfo.role?.toLowerCase()]?.[language === 'fr' ? 'fr' : 'en'] ?? userInfo.role;

  /* Nav items — filtrés par permission du rôle, admin voit tout + entrée dédiée */
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    const perm = ROUTE_PERMISSIONS.find((r) => r.prefix === item.href);
    return !perm || hasPermission(userInfo.role, perm.module, perm.action);
  });
  const navItems = userInfo.role?.toLowerCase() === 'admin'
    ? [...visibleNavItems, { href: '/admin', icon: Store, label: 'Admin', labelEn: 'Admin', id: 'nav-admin', group: 'admin' as NavGroup }]
    : visibleNavItems;
  /* Sections vides (aucun lien autorisé pour ce rôle) masquées entièrement. */
  const navSections = NAV_GROUPS
    .map((group) => ({ ...group, items: navItems.filter((item) => item.group === group.id) }))
    .filter((group) => group.items.length > 0);

  /* Même filtrage par permission que le menu latéral — la nav du bas ne
     doit jamais proposer un raccourci vers une page que le rôle ne peut
     pas ouvrir. */
  const visibleBottomNav = BOTTOM_NAV.filter((item) => {
    const perm = ROUTE_PERMISSIONS.find((r) => r.prefix === item.href);
    return !perm || hasPermission(userInfo.role, perm.module, perm.action);
  });

  return (
    <div className="shell">
      {isLocked && <PinLock onVerify={verifyPin} error={pinError} onClearError={() => setPinError('')} />}
      <SyncJournalModal isOpen={isSyncJournalOpen} onClose={() => setIsSyncJournalOpen(false)} />

      {/* ── Mobile top bar — affiche le nom de la boutique ── */}
      <header className="mobile-bar">
        <div className="mobile-brand">
          <div className="logo-mark"><Logo size={18} /></div>
          <span className="mobile-boutique-name">{userInfo.boutiqueName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ThemeToggle />
          {userInfo.role?.toLowerCase() === 'admin' && (
            <Link href="/admin" className="mobile-toggle admin-bell-btn" aria-label="Notifications admin">
              <Bell size={18} />
              {unreadAdminCount > 0 && (
                <span className="admin-bell-badge">{unreadAdminCount > 9 ? '9+' : unreadAdminCount}</span>
              )}
            </Link>
          )}
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

      {/* ══ SIDEBAR — panneau émeraude, navigation par sections ══ */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'sidebar--open' : ''}`}>

        {/* En-tête : logo + nom boutique + fermer */}
        <div className="sidebar__brand">
          <div className="logo-mark"><Logo size={20} /></div>
          <div className="sidebar-brand-info">
            <span className="sidebar-boutique-name" title={userInfo.boutiqueName}>{userInfo.boutiqueName}</span>
            <span className="sidebar-plan-badge">
              {userInfo.plan === 'freemium' ? '✦ Freemium' : userInfo.plan === 'lifetime' ? '⚡ Lifetime' : '✓ Pro'}
            </span>
          </div>
          <button className="sidebar-collapse-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        {/* Navigation par sections */}
        <nav className="sidebar__nav">
          {navSections.map((section) => (
            <div key={section.id} className="nav-section">
              <span className="nav-section__label">{language === 'fr' ? section.label : section.labelEn}</span>
              {section.items.map((item) => {
                const ItemIcon = item.icon;
                const isDash = item.href === '/dashboard';
                const active = isDash ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    id={item.id}
                    className={`nav-link ${active ? 'nav-link--active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="nav-icon-wrap">
                      <ItemIcon size={18} strokeWidth={active ? 2.3 : 2} />
                    </span>
                    <span className="nav-text">{language === 'fr' ? item.label : item.labelEn}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar__footer">
          <div className="sidebar-tools">
            <ThemeToggle />
            <button
              className="tool-btn"
              onClick={() => setIsSyncJournalOpen(true)}
              aria-label={language === 'fr' ? 'Journal de synchronisation' : 'Sync journal'}
              title={language === 'fr' ? 'Journal de synchronisation' : 'Sync journal'}
            >
              <History size={15} />
            </button>
            {userInfo.role?.toLowerCase() === 'admin' && (
              <Link href="/admin" className="tool-btn admin-bell-btn" aria-label="Notifications admin" title="Notifications">
                <Bell size={15} />
                {unreadAdminCount > 0 && (
                  <span className="admin-bell-badge">{unreadAdminCount > 9 ? '9+' : unreadAdminCount}</span>
                )}
              </Link>
            )}
            <button
              className="lang-toggle"
              onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
              title={language === 'fr' ? 'Switch to English' : 'Passer en français'}
            >
              <Globe size={14} />
              <span>{language === 'fr' ? 'FR' : 'EN'}</span>
            </button>
          </div>

          <div className="profile-container" ref={profileDropdownRef}>
            {isProfileDropdownOpen && (
              <div className="profile-dropdown">
                <Link href="/settings" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
                  <Settings size={14} />
                  <span>{language === 'fr' ? 'Paramètres' : 'Settings'}</span>
                </Link>
                <button type="button" className="dropdown-item dropdown-item--logout" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>{language === 'fr' ? 'Déconnexion' : 'Logout'}</span>
                </button>
              </div>
            )}

            <div className={`profile-card ${isProfileDropdownOpen ? 'profile-card--open' : ''}`}>
              <button
                type="button"
                className="profile-main"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                aria-expanded={isProfileDropdownOpen}
              >
                <span className="profile-avatar">{userInitial}</span>
                <span className="profile-info">
                  <span className="profile-name">{userName}</span>
                  <span className="profile-role">{roleLabel}</span>
                </span>
                <ChevronUp size={14} className={`profile-chevron ${isProfileDropdownOpen ? '' : 'profile-chevron--down'}`} />
              </button>
              {/* Déconnexion directe en un clic — le menu du profil reste disponible. */}
              <button
                type="button"
                className="profile-logout"
                onClick={handleLogout}
                aria-label={language === 'fr' ? 'Se déconnecter' : 'Log out'}
                title={language === 'fr' ? 'Se déconnecter' : 'Log out'}
              >
                <LogOut size={16} />
              </button>
            </div>
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
          {visibleBottomNav.map((item) => {
            const Icon = item.icon;
            const isDash = item.href === '/dashboard';
            const active = isDash ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`bottom-nav-item ${active ? 'active' : ''}`}>
                <div className="bottom-nav-icon-box">
                  <Icon size={20} className="bottom-nav-icon" />
                  {active && <div className="bottom-nav-pill-bg" />}
                </div>
                <span className="bottom-nav-label">{language === 'fr' ? item.label : item.labelEn}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <style jsx>{`
        /* styled-jsx n'ajoute sa classe de portée qu'aux éléments DOM natifs :
           tout className posé sur un composant (<Link>, icône lucide,
           <ThemeToggle>) doit être ciblé via :global(), sinon il ne reçoit
           aucun style — c'est ce qui empilait icône et texte dans le menu. */

        /* ══ Shell ══════════════════════════════════ */
        .shell {
          display: flex;
          min-height: 100vh;
          background: var(--surface-0);
        }
        .shell :global(.admin-bell-btn) { position: relative; text-decoration: none; }

        /* ══ Mobile top bar ════════════════════════ */
        .mobile-bar {
          display: none;
          position: fixed; top: 0; left: 0; right: 0;
          /* safe-area pour l'encoche iOS / Dynamic Island */
          padding-top: env(safe-area-inset-top, 0px);
          height: calc(56px + env(safe-area-inset-top, 0px));
          background: var(--chrome-glass-bg);
          border-bottom: 1px solid rgba(109,213,196,0.15);
          /* max() garde 1rem minimum et s'élargit derrière l'encoche latérale
             en paysage (iPhone) ou la découpe caméra d'un Android bord à bord. */
          padding-left: max(1rem, env(safe-area-inset-left, 0px));
          padding-right: max(1rem, env(safe-area-inset-right, 0px));
          align-items: flex-end;
          padding-bottom: 0.5rem;
          justify-content: space-between;
          z-index: 1100;
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
        }
        .mobile-brand { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
        .mobile-bar :global(.mobile-toggle) {
          position: relative;
          border: 1px solid var(--overlay-border);
          background: var(--overlay-medium);
          width: 36px; height: 36px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-primary);
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s ease, transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .mobile-bar :global(.mobile-toggle:hover) { background: var(--overlay-border-strong); }
        .mobile-bar :global(.mobile-toggle:active) { transform: scale(0.94); }

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

        /* Nom de boutique dans la barre mobile — couleur accentée */
        .mobile-boutique-name {
          font-family: var(--font-display);
          font-size: 1.05rem; font-weight: 800;
          background: var(--flag-text-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }

        .admin-bell-badge {
          position: absolute;
          top: -4px; right: -4px;
          min-width: 16px; height: 16px;
          border-radius: 99px;
          background: var(--color-error);
          color: #fff;
          font-size: 0.62rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px;
          border: 1.5px solid var(--sidebar-bg);
          animation: scaleIn 0.2s var(--ease-spring);
        }

        /* Barre offline positionnée sous la mobile-bar */
        .offline-bar-wrapper {
          display: none;
          position: fixed;
          top: calc(56px + env(safe-area-inset-top, 0px));
          left: 0; right: 0;
          z-index: 1090;
        }

        /* ══ SIDEBAR — panneau émeraude (même rendu dans les deux thèmes) ══ */
        .sidebar {
          /* Le panneau reste sombre quel que soit le thème de la page : ses
             descendants (ThemeToggle, menu du profil...) héritent donc d'une
             palette locale claire-sur-sombre au lieu des tokens du thème. */
          --text-primary: #ffffff;
          --text-secondary: rgba(233, 247, 243, 0.78);
          --text-muted: rgba(233, 247, 243, 0.52);
          --overlay-subtle: rgba(255, 255, 255, 0.03);
          --overlay-medium: rgba(255, 255, 255, 0.07);
          --overlay-border: rgba(255, 255, 255, 0.08);
          --overlay-border-strong: rgba(255, 255, 255, 0.16);
          --sb-accent: #7fe3d2;

          width: 260px;
          height: 100vh;
          position: sticky; top: 0;
          display: flex; flex-direction: column;
          background: var(--sidebar-bg-gradient);
          background-color: var(--sidebar-bg);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 10px 0 36px rgba(4, 20, 17, 0.14);
          color: var(--text-secondary);
          flex-shrink: 0;
          z-index: 50;
          overflow: hidden;
        }
        @media (min-width: 1440px) {
          .sidebar { width: 272px; }
        }

        .sidebar__brand {
          display: flex; align-items: center; gap: 0.7rem;
          padding: 1.15rem 1rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          flex-shrink: 0;
          min-width: 0;
        }
        .sidebar__brand .logo-mark {
          width: 40px; height: 40px;
          border-radius: 12px;
          background: linear-gradient(145deg, rgba(127,227,210,0.30), rgba(49,162,146,0.10));
          border: 1px solid rgba(127,227,210,0.35);
          box-shadow: 0 8px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.14);
        }
        .sidebar-brand-info {
          display: flex; flex-direction: column; gap: 4px;
          min-width: 0; flex: 1;
        }
        .sidebar-boutique-name {
          font-family: var(--font-display);
          font-size: 1rem; font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.015em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sidebar-plan-badge {
          align-self: flex-start;
          font-size: 0.63rem; font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--sb-accent);
          background: rgba(127,227,210,0.12);
          border: 1px solid rgba(127,227,210,0.24);
          padding: 1px 8px;
          border-radius: 99px;
        }
        .sidebar-collapse-btn {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(233,247,243,0.7);
          border-radius: 8px;
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          padding: 0;
          flex-shrink: 0;
        }
        .sidebar-collapse-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }

        /* ── Navigation par sections ─────────────────── */
        .sidebar__nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          display: flex; flex-direction: column;
          gap: 1rem;
          padding: 1rem 0.75rem 1rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.14) transparent;
        }
        .nav-section { display: flex; flex-direction: column; gap: 3px; }
        .nav-section__label {
          font-size: 0.63rem; font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.13em;
          color: rgba(233,247,243,0.4);
          padding: 0 0.7rem 0.3rem;
        }

        .sidebar__nav :global(.nav-link) {
          position: relative;
          display: flex; align-items: center; gap: 0.7rem;
          min-height: 42px;
          padding: 0.3rem 0.6rem 0.3rem 0.4rem;
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 0.9rem; font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
          border: 1px solid transparent;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.12s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .sidebar__nav :global(.nav-link:hover) {
          background: rgba(255,255,255,0.055);
          color: #ffffff;
        }
        .sidebar__nav :global(.nav-link:active) { transform: scale(0.985); }
        .sidebar__nav :global(.nav-link:focus-visible) {
          outline: 2px solid var(--sb-accent);
          outline-offset: 2px;
        }
        .sidebar__nav :global(.nav-link--active) {
          color: #ffffff;
          font-weight: 650;
          background: linear-gradient(90deg, rgba(127,227,210,0.20) 0%, rgba(127,227,210,0.06) 100%);
          border-color: rgba(127,227,210,0.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.18);
        }
        .sidebar__nav :global(.nav-link--active)::before {
          content: '';
          position: absolute;
          left: -0.75rem; top: 10px; bottom: 10px;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background: var(--sb-accent);
          box-shadow: 0 0 12px rgba(127,227,210,0.85);
        }

        .nav-icon-wrap {
          width: 32px; height: 32px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          color: rgba(233,247,243,0.66);
          background: rgba(255,255,255,0.045);
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.18s ease;
        }
        .sidebar__nav :global(.nav-link:hover) .nav-icon-wrap {
          color: #ffffff;
          background: rgba(255,255,255,0.09);
        }
        .sidebar__nav :global(.nav-link--active) .nav-icon-wrap {
          color: #0a2c27;
          background: linear-gradient(145deg, #93f1e1 0%, #4cc6b3 100%);
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(76,198,179,0.45);
        }
        .nav-text {
          flex: 1;
          overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Footer : outils + profil ─────────────────── */
        .sidebar__footer {
          flex-shrink: 0;
          display: flex; flex-direction: column; gap: 0.65rem;
          padding: 0.75rem 0.75rem 0.9rem;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.14) 100%);
        }
        .sidebar-tools { display: flex; align-items: center; gap: 0.4rem; }
        .sidebar-tools :global(.theme-toggle),
        .sidebar-tools :global(.tool-btn) {
          position: relative;
          width: 34px; height: 34px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(233,247,243,0.72);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          padding: 0;
          text-decoration: none;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .sidebar-tools :global(.theme-toggle:hover),
        .sidebar-tools :global(.tool-btn:hover) {
          background: rgba(255,255,255,0.11);
          border-color: rgba(127,227,210,0.3);
          color: #ffffff;
          transform: none;
        }
        .lang-toggle {
          margin-left: auto;
          display: inline-flex; align-items: center; gap: 0.35rem;
          height: 34px;
          padding: 0 0.7rem;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(233,247,243,0.78);
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .lang-toggle:hover { background: rgba(255,255,255,0.11); color: #ffffff; }

        .profile-container { position: relative; width: 100%; }
        .profile-card {
          display: flex; align-items: center; gap: 0.35rem;
          padding: 0.35rem;
          border-radius: 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .profile-card:hover, .profile-card--open {
          background: rgba(255,255,255,0.08);
          border-color: rgba(127,227,210,0.24);
        }
        .profile-main {
          flex: 1; min-width: 0;
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.2rem 0.3rem;
          background: none; border: none;
          border-radius: 10px;
          color: inherit;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
        }
        .profile-main:focus-visible { outline: 2px solid var(--sb-accent); outline-offset: 1px; }
        .profile-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: linear-gradient(145deg, #93f1e1, #31a292);
          color: #0a2c27;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.88rem;
          flex-shrink: 0;
          box-shadow: 0 0 0 2px rgba(127,227,210,0.28);
        }
        .profile-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
        .profile-name {
          font-size: 0.84rem; font-weight: 700;
          color: #ffffff;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .profile-role { font-size: 0.68rem; color: rgba(233,247,243,0.55); margin-top: 1px; }
        .profile-main :global(.profile-chevron) {
          color: rgba(233,247,243,0.5);
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }
        .profile-main :global(.profile-chevron--down) { transform: rotate(180deg); }

        /* Bouton de déconnexion direct, toujours visible */
        .profile-logout {
          width: 38px; height: 38px;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: 11px;
          background: rgba(244,63,94,0.12);
          border: 1px solid rgba(244,63,94,0.3);
          color: #fda4af;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;
        }
        .profile-logout:hover {
          background: #f43f5e;
          border-color: #f43f5e;
          color: #ffffff;
          box-shadow: 0 6px 18px rgba(244,63,94,0.35);
        }
        .profile-logout:active { transform: scale(0.94); }
        .profile-logout:focus-visible { outline: 2px solid #fda4af; outline-offset: 2px; }

        .profile-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0; right: 0;
          background: #10231f;
          border: 1px solid rgba(127,227,210,0.2);
          border-radius: 14px;
          padding: 0.35rem;
          box-shadow: 0 18px 44px rgba(0,0,0,0.45);
          z-index: 60;
          transform-origin: bottom center;
          animation: scaleIn 0.18s var(--ease-spring);
        }
        .profile-dropdown :global(.dropdown-item) {
          width: 100%;
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.6rem 0.75rem;
          border-radius: 9px;
          font-family: inherit;
          font-size: 0.84rem; font-weight: 500;
          color: #ffffff;
          text-decoration: none;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .profile-dropdown :global(.dropdown-item:hover) { background: rgba(255,255,255,0.08); }
        .profile-dropdown :global(.dropdown-item--logout) { color: #fda4af; }
        .profile-dropdown :global(.dropdown-item--logout:hover) { background: rgba(244,63,94,0.18); color: #fecdd3; }

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

          .backdrop { display: block; z-index: 1200 !important; }

          .sidebar {
            position: fixed; left: 0; top: 0; bottom: 0;
            width: 284px;
            height: 100dvh;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 1300 !important;
            box-shadow: 16px 0 50px var(--sidebar-mobile-shadow);
            padding-top: env(safe-area-inset-top, 0px);
            padding-bottom: env(safe-area-inset-bottom, 0px);
            /* Le tiroir colle au bord gauche : en paysage sur iPhone à
               encoche, son contenu doit rester derrière la découpe. */
            padding-left: env(safe-area-inset-left, 0px);
          }
          .sidebar--open { transform: translateX(0); }

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
            padding-left: max(1rem, env(safe-area-inset-left, 0px));
            padding-right: max(1rem, env(safe-area-inset-right, 0px));
          }

          .bottom-nav-glass {
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: space-around;
            width: 100%;
            max-width: 440px;
            height: 64px;
            background: var(--chrome-glass-bg-strong);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            border: 1px solid rgba(109, 213, 196, 0.24);
            border-radius: 26px;
            box-shadow:
              0 12px 32px var(--chrome-shadow),
              0 2px 10px rgba(109, 213, 196, 0.12),
              inset 0 1px 0 var(--overlay-border-strong);
            padding: 0 0.4rem;
          }

          .bottom-nav-glass :global(.bottom-nav-item) {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            flex: 1;
            height: 100%;
            text-decoration: none;
            color: var(--text-muted);
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease;
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

          .bottom-nav-icon-box :global(.bottom-nav-icon) {
            position: relative;
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

          .bottom-nav-glass :global(.bottom-nav-item.active) { color: var(--sidebar-accent); }
          .bottom-nav-glass :global(.bottom-nav-item.active) .bottom-nav-icon-box :global(.bottom-nav-icon) {
            transform: translateY(-1px) scale(1.1);
          }
          .bottom-nav-glass :global(.bottom-nav-item.active) .bottom-nav-label { font-weight: 800; }
          .bottom-nav-glass :global(.bottom-nav-item:active) { transform: scale(0.92); }
        }

        @media (min-width: 769px) {
          .sidebar-collapse-btn { display: none; }
        }
      `}</style>
    </div>
  );
}

