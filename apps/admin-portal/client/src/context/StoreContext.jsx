import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const { user, isSuperAdmin } = useAuth();
  const [selectedStoreId, setSelectedStoreId] = useState(() => localStorage.getItem('admin_selected_store') || '');

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', user?.tenantId],
    queryFn: async () => {
      const { data } = await api.get('/stores', { params: { page: 1, limit: 500 } });
      if (Array.isArray(data)) return data;
      return data?.items || [];
    },
    enabled: Boolean(user?.tenantId && !isSuperAdmin),
  });

  const selectStore = (storeId) => {
    const normalized = storeId || '';
    setSelectedStoreId(normalized);
    localStorage.setItem('admin_selected_store', normalized);
  };

  useEffect(() => {
    if (isSuperAdmin) return;
    if (!stores.length) {
      setSelectedStoreId('');
      localStorage.setItem('admin_selected_store', '');
      return;
    }
    const exists = stores.some((s) => String(s._id) === String(selectedStoreId));
    if (!exists) {
      const fallback = stores[0]._id;
      setSelectedStoreId(fallback);
      localStorage.setItem('admin_selected_store', fallback);
    }
  }, [stores, selectedStoreId, isSuperAdmin]);

  const value = useMemo(() => ({
    stores,
    selectedStoreId,
    selectStore,
    isAllStores: false,
    /** Menu/promotion builders need a concrete store when multiple exist */
    isStoreReady: Boolean(user?.tenantId && stores.length > 0 && selectedStoreId),
  }), [stores, selectedStoreId, user?.tenantId]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStoreContext() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreContext must be used inside StoreProvider');
  return ctx;
}
