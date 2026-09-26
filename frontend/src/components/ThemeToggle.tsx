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
 * and letting CSS decide which one is visible (.light on <html>, see
 * globals.css). Everything rendered is identical on the server and the
 * client — the previous version switched icon, aria-label and title on
 * the resolved theme, which caused a hydration error in light mode.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Changer de thème (clair / sombre)"
      title="Mode clair / sombre"
    >
      <Sun size={14} className="theme-toggle__sun" />
      <Moon size={14} className="theme-toggle__moon" />
    </button>
  );
}
