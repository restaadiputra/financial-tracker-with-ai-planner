'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'ft-theme';
const DEFAULT_THEME: Theme = 'light';

/**
 * Inline, render-blocking script that applies the persisted theme to
 * <html data-theme> before first paint, so there is no flash of the wrong
 * theme. Light is the default when nothing is stored. Kept dependency-free
 * and tiny because it runs synchronously in <head>; the matching React state
 * below reads back whatever this script set. Theme is a device-level UI
 * preference (localStorage), never financial data.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${JSON.stringify(
  DEFAULT_THEME
)};}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme=${JSON.stringify(
  DEFAULT_THEME
)};}})();`;

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The inline script has already set data-theme; read it back so the very
  // first client render matches the DOM (no hydration mismatch).
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === 'undefined') return DEFAULT_THEME;
    const fromDom = document.documentElement.dataset.theme;
    return fromDom === 'dark' || fromDom === 'system' || fromDom === 'light'
      ? fromDom
      : DEFAULT_THEME;
  });

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled: theme still applies for the session.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
