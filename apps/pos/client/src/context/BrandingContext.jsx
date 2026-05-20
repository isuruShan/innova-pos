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

const BrandingContext = createContext(DEFAULT_BRANDING);

export const BrandingProvider = ({ children }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  const loadBranding = useCallback(async () => {
    if (!user?.tenantId) {
      setBranding(DEFAULT_BRANDING);
      return;
    }
    try {
      const { data } = await api.get('/tenant-settings');
      const merged = { ...DEFAULT_BRANDING, ...data };
      setBranding(merged);
      setMerchantCurrencyFormat({
        currencySymbol: merged.currencySymbol,
        currency: merged.currency,
      });
    } catch {
      setBranding(DEFAULT_BRANDING);
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
