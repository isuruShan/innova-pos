import { createContext, useContext, useEffect, useMemo } from 'react';

const ThemeContext = createContext(null);

/** POS uses dark chrome only; tenant branding still applies via BrandingContext. */
export function ThemeProvider({ children }) {
  const theme = 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    try {
      localStorage.removeItem('pos_theme');
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
