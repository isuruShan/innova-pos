import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';

/** Fixed chrome in light mode — readability does not follow tenant palette. */
const LIGHT_MODE_CHROME = {
  '--color-primary': '#1e293b',
  '--color-accent': '#c2410c',
  '--color-sidebar': '#ffffff',
  '--color-text': '#0f172a',
};

/** Must match LIGHT_MODE_CHROME — used where JS computes contrast for the same surfaces */
export const LIGHT_THEME_ACCENT_HEX = '#c2410c';
export const LIGHT_THEME_SIDEBAR_HEX = '#ffffff';

const DEFAULT_BRANDING = {
  businessName: 'Cafinity',
  logoUrl: '',
  primaryColor: '#1a1a2e',
  accentColor: '#e94560',
  sidebarColor: '#16213e',
  textColor: '#ffffff',
  selectionTextColor: '#ffffff',
  paymentMethods: ['cash', 'card'],
  currency: 'LKR',
  currencySymbol: 'Rs.',
  countryIso: 'LK',
  receiptFooter: 'Thank you for your visit!',
  printReceiptByDefault: false,
  receiptPrintAtStatus: 'placement',
};

const BrandingContext = createContext(DEFAULT_BRANDING);

export const BrandingProvider = ({ children }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    if (!user?.tenantId) {
      setBranding(DEFAULT_BRANDING);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/tenant-settings');
        if (!cancelled) setBranding({ ...DEFAULT_BRANDING, ...data });
      } catch {
        if (!cancelled) setBranding(DEFAULT_BRANDING);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.tenantId, user?.id]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pos-selection-text', branding.selectionTextColor || '#ffffff');
    if (theme === 'dark') {
      root.style.setProperty('--color-primary', branding.primaryColor);
      root.style.setProperty('--color-accent', branding.accentColor);
      root.style.setProperty('--color-sidebar', branding.sidebarColor);
      root.style.setProperty('--color-text', branding.textColor || '#f1f5f9');
    } else {
      Object.entries(LIGHT_MODE_CHROME).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
    if (branding.businessName) document.title = `${branding.businessName} — POS`;
  }, [branding, theme]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
