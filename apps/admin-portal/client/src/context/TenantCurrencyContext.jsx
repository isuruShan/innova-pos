import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { setMerchantCurrencyFormat } from '../utils/format';

const DEFAULT = { currency: 'LKR', currencySymbol: 'Rs.', countryIso: 'LK' };

const TenantCurrencyContext = createContext({
  ...DEFAULT,
  formatCurrency: (n) => `Rs ${Number(n || 0).toFixed(2)}`,
  reload: () => {},
});

export function TenantCurrencyProvider({ children }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(DEFAULT);

  const reload = useCallback(async () => {
    if (!user?.tenantId) {
      setSettings(DEFAULT);
      setMerchantCurrencyFormat(DEFAULT);
      return;
    }
    try {
      const { data } = await api.get('/tenant-settings');
      const next = {
        currency: data.currency || DEFAULT.currency,
        currencySymbol: data.currencySymbol || DEFAULT.currencySymbol,
        countryIso: (data.countryIso || DEFAULT.countryIso).toUpperCase(),
      };
      setSettings(next);
      setMerchantCurrencyFormat(next);
    } catch {
      setSettings(DEFAULT);
      setMerchantCurrencyFormat(DEFAULT);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    reload();
  }, [reload, user?.id]);

  const formatCurrency = useCallback(
    (n) => {
      const sym = settings.currencySymbol || 'Rs.';
      const x = Number(n);
      if (!Number.isFinite(x)) return `${sym} 0.00`;
      return `${sym} ${(Math.round(x * 100) / 100).toFixed(2)}`;
    },
    [settings.currencySymbol],
  );

  const value = useMemo(
    () => ({ ...settings, formatCurrency, reload }),
    [settings, formatCurrency, reload],
  );

  return <TenantCurrencyContext.Provider value={value}>{children}</TenantCurrencyContext.Provider>;
}

export function useTenantCurrency() {
  return useContext(TenantCurrencyContext);
}
