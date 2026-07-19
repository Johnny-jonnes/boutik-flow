'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

/**
 * ThemeToggle — Sun / Moon button.
 * Uses CSS class .theme-toggle defined in globals.css so it
 * inherits all CSS variables and transitions automatically.
 *
 * We avoid useState/useEffect "mounted" tracking (which trips the
 * react-hooks/set-state-in-effect lint rule) by rendering both icons
 * and letting CSS decide which one is visible, with
 * suppressHydrationWarning on the icon wrapper to avoid the harmless
 * server/client mismatch before next-themes has resolved the theme.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme !== 'light';

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      <span suppressHydrationWarning>
        {isDark ? <Sun size={14} /> : <Moon size={14} />}
      </span>
    </button>
  );
}
