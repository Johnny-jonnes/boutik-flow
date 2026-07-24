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
  History
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/context/LanguageContext';
import { ScrollToTop } from '@/components/ScrollToTop';
import { PinLock } from '@/components/ui/PinLock';
import { usePinLock } from '@/hooks/usePinLock';

const NAV_CATEGORIES = [
  {
    titleKey: 'nav.dashboard',
    title: 'Tableau de Bord',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', label: "Vue d'ensemble", id: 'nav-dashboard' },
      { href: '/analytics', icon: BarChart3, labelKey: 'nav.analytics', label: 'Analytique', id: 'nav-analytics' },
    ]
  },
  {
    titleKey: 'nav.crm',
    title: 'CRM',
    icon: Users,
    items: [
      { href: '/crm', icon: Users, labelKey: 'nav.crm', label: 'Clients', id: 'nav-crm' },
      { href: '/segments', icon: Tags, labelKey: 'nav.segments', label: 'Segments', id: 'nav-segments' },
    ]
  },
  {
    titleKey: 'nav.products',
    title: 'Ventes',
    icon: ShoppingBag,
    items: [
      { href: '/pos', icon: ShoppingCart, labelKey: 'nav.pos', label: 'Caisse', id: 'nav-pos' },
      { href: '/sales', icon: History, labelKey: 'nav.sales', label: 'Historique Ventes', id: 'nav-sales' },
      { href: '/orders', icon: ClipboardList, labelKey: 'nav.orders', label: 'Suivi Commandes', id: 'nav-orders' },
      { href: '/products', icon: Package, labelKey: 'nav.products', label: 'Produits', id: 'nav-products' },
      { href: '/categories', icon: FolderTree, labelKey: 'nav.categories', label: 'Catégories', id: 'nav-categories' },
      { href: '/suppliers', icon: Truck, labelKey: 'nav.suppliers', label: 'Fournisseurs', id: 'nav-suppliers' },
    ]
  },
  {
    titleKey: 'nav.campaigns',
    title: 'Marketing',
    icon: Megaphone,
    items: [
      { href: '/whatsapp', icon: MessageSquare, labelKey: 'nav.whatsapp', label: 'WhatsApp', id: 'nav-whatsapp' },
    ]
  },
  {
    titleKey: 'nav.management',
    title: 'Gestion',
    icon: Settings,
    items: [
      { href: '/team', icon: UserCog, labelKey: 'nav.team', label: 'Équipe', id: 'nav-team' },
      { href: '/finance', icon: Wallet, labelKey: 'nav.finance', label: 'Finance', id: 'nav-finance' },
      { href: '/audit', icon: ClipboardList, labelKey: 'nav.audit', label: 'Audit', id: 'nav-audit' },
    ]
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLocked, pinError, verifyPin, setPinError } = usePinLock();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Tableau de Bord': true,
    'CRM': true,
    'Ventes': true,
    'Marketing': true,
    'Gestion': true,
    'Administration': true
  });
  const [userInfo, setUserInfo] = useState({ boutiqueName: 'Ma Boutique', email: '', role: 'Admin', plan: 'freemium' });
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    // Decode user info from JWT token
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserInfo({
          boutiqueName: payload.tenant_name || 'Ma Boutique',
          email: payload.email || payload.sub || '',
          role: payload.role || 'Admin',
          plan: payload.tenant_plan || 'freemium',
        });
      } else {
        // Rediriger vers le login si le token est manquant
        window.location.href = '/login';
      }
    } catch {
      window.location.href = '/login';
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const userInitial = userInfo.email ? userInfo.email.charAt(0).toUpperCase() : 'N';
  const userName = userInfo.email ? userInfo.email.split('@')[0] : 'Nom de l\'utilisateur';

  return (
    <div className="shell">
      {isLocked && <PinLock onVerify={verifyPin} error={pinError} onClearError={() => setPinError('')} />}
      {/* Mobile top bar */}
      <header className="mobile-bar">
        <div className="mobile-brand">
          <div className="logo-mark">
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#g1)" />
              <path d="M9 14L12.5 17.5L19 11" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="g1" x1="2" y1="2" x2="26" y2="26"><stop stopColor="#10b981" /><stop offset="1" stopColor="#047857" /></linearGradient></defs>
            </svg>
          </div>
          <span className="brand-text">BoutikFlow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ThemeToggle />
          <button className="mobile-toggle" onClick={() => setIsMobileMenuOpen(true)} aria-label="Menu">
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {isMobileMenuOpen && <div className="backdrop" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'sidebar--open' : ''}`}>
        {/* Header Section */}
        <div className="sidebar__brand">
          <div className="logo-mark">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" fill="url(#g2)" />
              <path d="M9 14L12.5 17.5L19 11" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <defs><linearGradient id="g2" x1="2" y1="2" x2="26" y2="26"><stop stopColor="#10b981" /><stop offset="1" stopColor="#047857" /></linearGradient></defs>
            </svg>
          </div>
          <span className="brand-text">BoutikFlow</span>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ThemeToggle />
            <button className="sidebar-collapse-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fermer la sidebar">
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        {/* Boutique Card */}
        <div className="boutique-card">
          <div className="boutique-icon">
            <Store size={18} />
          </div>
          <div className="boutique-details">
            <span className="boutique-name">{userInfo.boutiqueName}</span>
            <span className="boutique-badge">Plan Freemium</span>
          </div>
          <ChevronDown size={14} className="boutique-chevron" />
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          {[
            {
              titleKey: 'nav.dashboard',
              title: 'Tableau de Bord',
              icon: LayoutDashboard,
              items: [
                { href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', label: 'Vue d\'ensemble', id: 'nav-dashboard' },
                { href: '/analytics', icon: BarChart3, labelKey: 'nav.analytics', label: 'Analytique', id: 'nav-analytics' },
              ]
            },
            {
              titleKey: 'nav.crm',
              title: 'CRM',
              icon: Users,
              items: [
                { href: '/crm', icon: Users, labelKey: 'nav.crm', label: 'Clients', id: 'nav-crm' },
                { href: '/segments', icon: Tags, labelKey: 'nav.segments', label: 'Segments', id: 'nav-segments' },
              ]
            },
            {
              titleKey: 'nav.products',
              title: 'Ventes',
              icon: ShoppingBag,
              items: [
                { href: '/pos', icon: ShoppingCart, labelKey: 'nav.pos', label: 'Caisse', id: 'nav-pos' },
                { href: '/sales', icon: History, labelKey: 'nav.sales', label: 'Historique Ventes', id: 'nav-sales' },
                { href: '/orders', icon: ClipboardList, labelKey: 'nav.orders', label: 'Suivi Commandes', id: 'nav-orders' },
                { href: '/products', icon: Package, labelKey: 'nav.products', label: 'Produits', id: 'nav-products' },
                { href: '/categories', icon: FolderTree, labelKey: 'nav.categories', label: 'Catégories', id: 'nav-categories' },
                { href: '/suppliers', icon: Truck, labelKey: 'nav.suppliers', label: 'Fournisseurs', id: 'nav-suppliers' },
              ]
            },
            {
              titleKey: 'nav.campaigns',
              title: 'Marketing',
              icon: Megaphone,
              items: [
                { href: '/whatsapp', icon: MessageSquare, labelKey: 'nav.whatsapp', label: 'WhatsApp', id: 'nav-whatsapp' },
              ]
            },
            {
              titleKey: 'nav.management',
              title: 'Gestion',
              icon: Settings,
              items: [
                { href: '/team', icon: UserCog, labelKey: 'nav.team', label: 'Équipe', id: 'nav-team' },
                { href: '/finance', icon: Wallet, labelKey: 'nav.finance', label: 'Finance', id: 'nav-finance' },
                { href: '/audit', icon: ClipboardList, labelKey: 'nav.audit', label: 'Audit', id: 'nav-audit' },
              ]
            },
            ...(userInfo.role && userInfo.role.toLowerCase() === 'admin' ? [{
              titleKey: 'nav.admin',
              title: 'Administration',
              icon: Shield,
              items: [
                { href: '/admin', icon: LayoutDashboard, labelKey: 'nav.dashboard', label: 'Vue d\'ensemble', id: 'nav-admin-dashboard' },
                { href: '/admin/tenants', icon: Store, labelKey: 'nav.tenants', label: 'Gestion Boutiques', id: 'nav-admin-tenants' },
              ]
            }] : [])
          ].map((category) => {
            const CategoryIcon = category.icon;
            const isExpanded = expandedCategories[category.title];
            return (
              <div key={category.title} className="nav-group">
                <button 
                  className="nav-section-title" 
                  onClick={() => setExpandedCategories(prev => ({ ...prev, [category.title]: !prev[category.title] }))}
                >
                  <div className="nav-section-title-left">
                    <CategoryIcon size={16} />
                    <span>{t(category.titleKey)}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                
                {isExpanded && (
                  <div className="nav-items-wrapper">
                    {category.items.map((item) => {
                      const isDashboard = item.href === '/dashboard';
                      const active = isDashboard ? pathname === item.href : pathname.startsWith(item.href);
                      const ItemIcon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} id={item.id}
                          className={`nav-link ${active ? 'nav-link--active' : ''}`}
                          onClick={() => setIsMobileMenuOpen(false)}>
                          {active && <span className="nav-indicator" />}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                            <ItemIcon size={16} className="nav-icon" />
                            <span className="nav-text">{t(item.labelKey)}</span>
                          </div>
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

        {/* Persistent Bottom Section */}
        <div className="sidebar__footer">

          {/* Language Selector */}
          <button className="lang-toggle" onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}>
            <Globe size={14} />
            <span>{language === 'fr' ? 'Français' : 'English'}</span>
          </button>

          <div className="footer-separator" />

          {/* User profile dropdown container */}
          <div className="profile-container" ref={profileDropdownRef}>
            <div 
              className={`profile-card ${isProfileDropdownOpen ? 'profile-card--open' : ''}`}
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            >
              <div className="profile-avatar">
                {userInitial}
              </div>
              <div className="profile-info">
                <span className="profile-name">{userName}</span>
                <span className="profile-role">{userInfo.role === 'admin' ? 'Admin' : (language === 'fr' ? 'Propriétaire' : 'Owner')}</span>
              </div>
              <ChevronDown size={14} className={`profile-chevron ${isProfileDropdownOpen ? 'profile-chevron--rotated' : ''}`} />
            </div>

            {/* Dropdown Menu */}
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

      {/* Content */}
      <main className="main">
        <div className="main__inner">{children}</div>
        <ScrollToTop />
      </main>

      <style jsx>{`
        /* ─── Shell ─────────────────────────────────── */
        .shell {
          display: flex;
          min-height: 100vh;
          background: var(--surface-0);
        }

        /* ─── Mobile bar ───────────────────────────── */
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
        }
        .mobile-brand { display: flex; align-items: center; gap: 0.5rem; }
        .mobile-toggle {
          background: none; border: none;
          color: var(--text-primary); cursor: pointer;
          padding: 0.25rem;
        }

        /* ─── Logo ─────────────────────────────────── */
        .logo-mark {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: var(--brand-alpha-10);
          border: 1px solid var(--brand-alpha-20);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .brand-text {
          font-family: var(--font-display);
          font-size: 1.2rem; font-weight: 700;
          background: linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ─── Sidebar ──────────────────────────────── */
        .sidebar {
          width: 260px;
          height: 100vh;
          position: sticky; top: 0;
          display: flex; flex-direction: column;
          /* Mélange haut de gamme de vert forêt émeraude mi-clair */
          background: linear-gradient(180deg, #123d30 0%, #081d16 100%);
          backdrop-filter: blur(16px);
          border-right: 1px solid rgba(52, 211, 153, 0.15);
          flex-shrink: 0;
          z-index: 50;
          overflow-y: auto;
          overflow-x: hidden;
          padding-bottom: 1rem;
        }
        
        @media (min-width: 1440px) {
          .sidebar {
            width: 280px;
          }
        }

        .sidebar__brand {
          display: flex; align-items: center; gap: 0.625rem;
          padding: 1.5rem 1.25rem 1rem;
          position: relative;
        }

        .sidebar-collapse-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #a7b8b0;
          border-radius: 6px;
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sidebar-collapse-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f0fdf4;
        }

        /* ─── Boutique Card ────────────────────────── */
        .boutique-card {
          display: flex; align-items: center; gap: 0.75rem;
          margin: 0.25rem 0.75rem 1.25rem;
          padding: 0.75rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .boutique-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.08);
        }
        .boutique-icon {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: rgba(52, 211, 153, 0.12);
          color: #34d399;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .boutique-details {
          display: flex; flex-direction: column;
          min-width: 0;
          flex: 1;
        }
        .boutique-name {
          font-size: 0.85rem; font-weight: 600;
          color: #f0fdf4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .boutique-badge {
          font-size: 0.7rem;
          color: #34d399;
          font-weight: 500;
          margin-top: 1px;
        }
        .boutique-chevron {
          color: #8fa399;
          flex-shrink: 0;
        }

        /* ─── Nav ──────────────────────────────────── */
        .sidebar__nav {
          flex: 1;
          display: flex; flex-direction: column;
          gap: 0.5rem;
          padding: 0 0.75rem;
          margin-bottom: 1.5rem;
        }
        
        .nav-section-title {
          font-size: 0.75rem; font-weight: 600;
          color: #8fa399;
          text-transform: none;
          letter-spacing: normal;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          border: none;
          width: 100%;
          cursor: pointer;
          transition: color 0.2s;
          white-space: nowrap;
        }

        .nav-section-title:hover {
          color: #f0fdf4;
        }

        .nav-section-title-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: nowrap;
        }

        .nav-group {
          margin-bottom: 0.75rem;
          display: flex;
          flex-direction: column;
        }

        .nav-items-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .nav-link {
          display: flex; align-items: center; gap: 0.5rem;
          flex-wrap: nowrap;
          padding: 0.5rem 0.75rem 0.5rem 1rem;
          border-radius: 8px;
          text-decoration: none;
          color: #a7b8b0;
          font-size: 0.85rem; font-weight: 500;
          position: relative;
          transition: all 0.2s ease;
          border: none; background: transparent;
          width: 100%; text-align: left;
          cursor: pointer;
          white-space: nowrap;
        }
        
        .nav-link:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f0fdf4;
        }
        
        .nav-link--active {
          background: rgba(52, 211, 153, 0.12);
          color: #34d399;
          font-weight: 600;
        }
        
        .nav-icon { flex-shrink: 0; color: inherit; width: 16px; height: 16px; display: inline-block; }
        
        .nav-text {
          flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;
        }
        
        .nav-indicator {
          position: absolute; left: 0; top: 0;
          width: 3px; height: 100%;
          background: #34d399;
          border-radius: 0 4px 4px 0;
        }

        /* ─── Badges ───────────────────────────────── */
        .badge {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.125rem 0.375rem;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
          flex-shrink: 0;
        }
        .badge--red {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
        .badge--green {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }

        /* ─── Footer / Plan / Profile ──────────────── */
        .sidebar__footer {
          padding: 0 0.75rem;
          display: flex; flex-direction: column;
          margin-top: auto;
        }

        .plan-usage-block {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .plan-status-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.375rem 0.625rem;
          border-radius: 8px;
        }
        .plan-status-badge--trial {
          background: rgba(251, 191, 36, 0.12);
          color: #fbbf24;
        }
        .plan-status-badge--monthly {
          background: rgba(52, 211, 153, 0.12);
          color: #34d399;
        }
        .plan-status-badge--lifetime {
          background: rgba(168, 85, 247, 0.12);
          color: #c084fc;
        }
        .plan-status-text {
          font-size: 0.7rem;
          color: #8fa399;
          padding: 0 0.25rem;
        }

        /* ─── Language Toggle ─────────────────────────── */
        .lang-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #a7b8b0;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 0.25rem;
          width: 100%;
        }
        .lang-toggle:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #f0fdf4;
        }
        .lang-flag {
          margin-left: auto;
          font-size: 1rem;
        }
        }

        .upgrade-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-radius: 10px;
          padding: 0.625rem 0.75rem;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.25s ease;
          text-transform: uppercase;
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        }

        .upgrade-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
          border-color: rgba(255, 255, 255, 0.45);
          background: linear-gradient(135deg, #34d399, #10b981);
        }

        .footer-separator {
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
          margin: 0.5rem 0.25rem 0.75rem;
        }

        /* ─── Profile ──────────────────────────────── */
        .profile-container {
          position: relative;
          width: 100%;
        }

        .profile-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .profile-card:hover, .profile-card--open {
          background: rgba(255, 255, 255, 0.05);
        }

        .profile-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f0fdf4;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.85rem;
          flex-shrink: 0;
        }

        .profile-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }

        .profile-name {
          font-size: 0.8rem;
          font-weight: 600;
          color: #f0fdf4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-role {
          font-size: 0.7rem;
          color: #8fa399;
        }

        .profile-chevron {
          color: #8fa399;
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }

        .profile-chevron--rotated {
          transform: rotate(180deg);
        }

        .profile-dropdown {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0; right: 0;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 12px;
          padding: 0.35rem;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6);
          z-index: 60;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.65rem 0.8rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: #f8fafc;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
          background: rgba(255, 255, 255, 0.05);
        }

        .dropdown-item:hover {
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
        }

        .dropdown-item--logout {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.1);
        }
        .dropdown-item--logout:hover {
          background: rgba(239, 68, 68, 0.25);
          color: #ffffff;
        }

        /* ─── Main Content ──────────────────────────── */
        .main {
          flex: 1; min-width: 0;
          overflow-y: auto;
        }
        .main__inner {
          max-width: 1400px;
          padding: 2rem 2.5rem;
          margin: 0 auto;
        }

        /* ─── Backdrop ─────────────────────────────── */
        .backdrop {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          z-index: 45;
        }

        /* ─── Responsive ───────────────────────────── */
        @media (max-width: 768px) {
          .mobile-bar { display: flex; }
          .main__inner { padding: 1.25rem 1rem; padding-top: calc(56px + 1.25rem); }

          .sidebar {
            position: fixed; left: 0;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .sidebar--open { transform: translateX(0); }
          .backdrop { display: block; }
          .sidebar-collapse-btn { display: block; }
        }
      `}</style>
    </div>
  );
}
