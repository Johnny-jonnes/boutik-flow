'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingBag, 
  MessageSquare, 
  Zap, 
  LogOut, 
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
  Shield
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV_CATEGORIES = [
  {
    title: 'Tableau de Bord',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Vue d\'ensemble', id: 'nav-dashboard' },
      { href: '/analytics', icon: BarChart3, label: 'Analytique', id: 'nav-analytics' },
    ]
  },
  {
    title: 'CRM',
    icon: Users,
    items: [
      { href: '/crm', icon: Users, label: 'Clients', id: 'nav-crm' },
      { href: '/segments', icon: Tags, label: 'Segments', id: 'nav-segments' },
    ]
  },
  {
    title: 'Ventes',
    icon: ShoppingBag,
    items: [
      { href: '/products', icon: Package, label: 'Produits', id: 'nav-products' },
      { href: '/categories', icon: FolderTree, label: 'Catégories', id: 'nav-categories' },
      { href: '/orders', icon: ShoppingBag, label: 'Commandes', id: 'nav-orders' },
    ]
  },
  {
    title: 'Marketing',
    icon: Megaphone,
    items: [
      { href: '/whatsapp', icon: MessageSquare, label: 'WhatsApp', id: 'nav-whatsapp' },
      { href: '/campaigns', icon: Megaphone, label: 'Campagnes', id: 'nav-campaigns' },
    ]
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Tableau de Bord': true,
    'CRM': true,
    'Ventes': true,
    'Marketing': true,
    'Administration': true
  });
  const [userInfo, setUserInfo] = useState({ boutiqueName: 'Ma Boutique', email: '', role: 'Admin' });
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Decode email from JWT token
    try {
      const token = localStorage.getItem('boutikflow_access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserInfo({
          boutiqueName: payload.tenant_name || 'Ma Boutique',
          email: payload.email || payload.sub || '',
          role: payload.role || 'Admin',
        });
      }
    } catch {
      setUserInfo({ boutiqueName: 'Ma Boutique', email: '', role: 'Admin' });
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
            ...NAV_CATEGORIES,
            ...(userInfo.role && userInfo.role.toLowerCase() === 'admin' ? [{
              title: 'Administration',
              icon: Shield,
              items: [
                { href: '/admin', icon: LayoutDashboard, label: 'Vue d\'ensemble', id: 'nav-admin-dashboard' },
                { href: '/admin/tenants', icon: Store, label: 'Gestion Boutiques', id: 'nav-admin-tenants' },
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
                    <span>{category.title}</span>
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
                            <span className="nav-text">{item.label}</span>
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
          {/* Plan block */}
          <div className="plan-usage-block">
            <div className="plan-usage-header">
              <span>Utilisation de votre plan</span>
              <span className="plan-percentage">60% utilisé</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '60%' }} />
            </div>
            
            <Link href="/billing" className="upgrade-btn">
              <Rocket size={14} />
              <span>Passer au Starter</span>
            </Link>
          </div>

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
                <span className="profile-role">Administrateur</span>
              </div>
              <ChevronDown size={14} className={`profile-chevron ${isProfileDropdownOpen ? 'profile-chevron--rotated' : ''}`} />
            </div>

            {/* Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="profile-dropdown">
                <Link href="/billing" className="dropdown-item" onClick={() => setIsProfileDropdownOpen(false)}>
                  <Zap size={14} />
                  <span>Facturation</span>
                </Link>
                <div className="dropdown-item dropdown-item--logout" onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>Déconnexion</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="main">
        <div className="main__inner">{children}</div>
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
          background: linear-gradient(180deg, var(--surface-1) 0%, var(--sidebar-gradient-end) 100%);
          backdrop-filter: blur(16px);
          border-right: 1px solid var(--border-subtle);
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
          background: var(--overlay-subtle);
          border: 1px solid var(--overlay-border);
          color: var(--text-muted);
          border-radius: 6px;
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sidebar-collapse-btn:hover {
          background: var(--overlay-medium);
          color: var(--text-primary);
        }

        /* ─── Boutique Card ────────────────────────── */
        .boutique-card {
          display: flex; align-items: center; gap: 0.75rem;
          margin: 0.25rem 0.75rem 1.25rem;
          padding: 0.75rem;
          border-radius: 12px;
          background: var(--overlay-subtle);
          border: 1px solid var(--overlay-border);
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .boutique-card:hover {
          background: var(--overlay-light);
          border-color: var(--overlay-medium);
        }
        .boutique-icon {
          width: 36px; height: 36px;
          border-radius: 8px;
          background: var(--brand-alpha-10);
          color: var(--color-brand-500);
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
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .boutique-badge {
          font-size: 0.7rem;
          color: var(--color-brand-500);
          font-weight: 500;
          margin-top: 1px;
        }
        .boutique-chevron {
          color: var(--text-muted);
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
          color: var(--text-muted);
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
          color: var(--text-primary);
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
          color: var(--text-secondary);
          font-size: 0.85rem; font-weight: 500;
          position: relative;
          transition: all 0.2s ease;
          border: none; background: transparent;
          width: 100%; text-align: left;
          cursor: pointer;
          white-space: nowrap;
        }
        
        .nav-link:hover {
          background: var(--surface-2);
          color: var(--text-primary);
        }
        
        .nav-link--active {
          background: var(--brand-alpha-08);
          color: var(--color-brand-500);
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
          background: var(--color-brand-500);
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
          background: var(--overlay-subtle);
          border: 1px solid var(--overlay-border);
          border-radius: 12px;
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
          margin-bottom: 0.75rem;
        }

        .plan-usage-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .plan-percentage {
          font-weight: 600;
          color: var(--text-secondary);
        }

        .progress-bar {
          height: 6px;
          background: var(--progress-track-bg);
          border-radius: 3px;
          overflow: hidden;
          width: 100%;
        }

        .progress-fill {
          height: 100%;
          background: #10b981;
          border-radius: 3px;
        }

        .upgrade-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          background: linear-gradient(135deg, var(--logo-gradient-from), var(--logo-gradient-to));
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.5rem;
          font-size: 0.8rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .upgrade-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        .footer-separator {
          height: 1px;
          background: var(--overlay-medium);
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
          background: var(--overlay-light);
        }

        .profile-avatar {
          width: 32px; height: 32px;
          border-radius: 50%;
          background: var(--overlay-medium);
          border: 1px solid var(--overlay-border-strong);
          color: var(--text-primary);
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
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-role {
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .profile-chevron {
          color: var(--text-muted);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }

        .profile-chevron--rotated {
          transform: rotate(180deg);
        }

        .profile-dropdown {
          position: absolute;
          bottom: calc(100% + 4px);
          left: 0; right: 0;
          background: var(--profile-dropdown-bg);
          border: 1px solid var(--overlay-border);
          border-radius: 10px;
          padding: 0.25rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
          z-index: 60;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: 6px;
          font-size: 0.8rem;
          color: var(--text-secondary);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dropdown-item:hover {
          background: var(--overlay-light);
          color: var(--text-primary);
        }

        .dropdown-item--logout {
          color: #f87171;
        }
        .dropdown-item--logout:hover {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
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
