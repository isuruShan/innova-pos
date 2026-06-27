import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { preloadOfflineData } from '../offline/preload.js';

const StoreContext = createContext(null);

/** Stable string id for APIs and comparisons (handles ObjectId-shaped values from JSON). */
export function normalizeStoreId(id) {
  if (id == null || id === '') return '';
  return String(id);
}

export function StoreProvider({ children }) {
  const { user } = useAuth();
  const [selectedStoreId, setSelectedStoreId] = useState(() =>
    normalizeStoreId(localStorage.getItem('pos_selected_store')),
  );

  const { data: stores = [] } = useQuery({
    queryKey: ['pos-stores', user?.tenantId],
    queryFn: async () => {
      const { data } = await api.get('/stores');
      return data;
    },
    enabled: Boolean(user?.tenantId),
    retry: 2,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    refetchInterval: 45_000,
  });

  const selectStore = (storeId) => {
    const normalized = normalizeStoreId(storeId);
    localStorage.setItem('pos_selected_store', normalized);
    flushSync(() => setSelectedStoreId(normalized));
  };

  useEffect(() => {
    if (!stores.length) {
      setSelectedStoreId((prev) => {
        if (prev === '') return prev;
        localStorage.setItem('pos_selected_store', '');
        return '';
      });
      return;
    }
    const ids = stores.map((s) => normalizeStoreId(s._id));
    setSelectedStoreId((current) => {
      const normalized = normalizeStoreId(current);
      if (normalized !== '' && ids.includes(normalized)) return normalized;
      const fallback = normalizeStoreId(stores[0]._id);
      localStorage.setItem('pos_selected_store', fallback);
      return fallback;
    });
  }, [stores]);

  const isStoreReady = Boolean(user?.tenantId && stores.length > 0 && selectedStoreId);

  useEffect(() => {
    if (isStoreReady && typeof window !== 'undefined' && window.navigator.onLine) {
      preloadOfflineData();
    }
  }, [isStoreReady, selectedStoreId]);

  const value = useMemo(() => ({
    stores,
    selectedStoreId,
    selectStore,
    isAllStores: false,
    isStoreReady,
  }), [stores, selectedStoreId, user?.tenantId]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreContext() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreContext must be used inside StoreProvider');
  return ctx;
}
