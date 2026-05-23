import { createContext, useContext, useEffect, useState, useMemo } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('pos_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('pos_theme', next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
