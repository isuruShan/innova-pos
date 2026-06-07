/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { applyBrandingThemeToDocument } from '../lib/applyBrandingTheme';
import { setMerchantCurrencyFormat } from '../utils/format';
import { DEFAULT_RECEIPT_PRINT_AT_BY_ORDER_TYPE } from '../utils/receiptPolicy';

/** Fixed chrome in light mode — readability does not follow tenant palette. */
export const LIGHT_THEME_ACCENT_HEX = '#c2410c';
export const LIGHT_THEME_SIDEBAR_HEX = '#ffffff';

const DEFAULT_BRANDING = {
  businessName: 'Cafinity',
  logoUrl: '',
  themePresetId: 'default',
  themePresetName: 'Default / Base',
  themeBaseColor: '#0B1220',
  bodyColor: '#0B1220',
  headerBarColor: '#151F2E',
  buttonColor: '#E94560',
  selectionHighlightColor: '#2A3548',
  hoverColor: '#F06B82',
  buttonTextColor: '#F8FAFC',
  headerBarTextColor: '#F8FAFC',
  bodyTextColor: '#E2E8F0',
  primaryColor: '#0B1220',
  accentColor: '#e94560',
  sidebarColor: '#16213e',
  textColor: '#E2E8F0',
  selectionTextColor: '#ffffff',
  paymentMethods: ['cash', 'card'],
  currency: 'LKR',
  currencySymbol: 'Rs.',
  countryIso: 'LK',
  receiptFooter: 'Thank you for your visit!',
  printReceiptByDefault: false,
  receiptPrintAtStatus: 'placement',
  receiptPrintAtByOrderType: { ...DEFAULT_RECEIPT_PRINT_AT_BY_ORDER_TYPE },
};

const getInitialBranding = () => {
  if (typeof window !== 'undefined') {
    try {
      const userStored = localStorage.getItem('pos_user');
      if (userStored) {
        const stored = localStorage.getItem('pos_tenant_branding');
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_BRANDING;
};

const BrandingContext = createContext(DEFAULT_BRANDING);

export const BrandingProvider = ({ children }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [branding, setBranding] = useState(getInitialBranding);

  const loadBranding = useCallback(async () => {
    if (!user?.tenantId) {
      setBranding(DEFAULT_BRANDING);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('pos_tenant_branding');
        } catch {
          // ignore
        }
      }
      return;
    }
    try {
      const { data } = await api.get('/tenant-settings');
      const merged = { ...DEFAULT_BRANDING, ...data };
      setBranding(merged);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('pos_tenant_branding', JSON.stringify(merged));
        } catch {
          // ignore
        }
      }
      setMerchantCurrencyFormat({
        currencySymbol: merged.currencySymbol,
        currency: merged.currency,
      });
    } catch {
      // Keep existing cached branding on transient load failure
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('pos_tenant_branding');
          if (stored) {
            const parsed = JSON.parse(stored);
            setMerchantCurrencyFormat({
              currencySymbol: parsed.currencySymbol || DEFAULT_BRANDING.currencySymbol,
              currency: parsed.currency || DEFAULT_BRANDING.currency,
            });
            return;
          }
        } catch {
          // ignore
        }
      }
      setMerchantCurrencyFormat(DEFAULT_BRANDING);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    loadBranding();
  }, [loadBranding, user?.id]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadBranding();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadBranding]);

  useEffect(() => {
    applyBrandingThemeToDocument(branding, theme);
    if (branding.businessName) document.title = `${branding.businessName} — POS`;
  }, [branding, theme]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
