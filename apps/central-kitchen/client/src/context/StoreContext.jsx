import { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const StoreContext = createContext(null);

export const StoreProvider = ({ children }) => {
  const { user } = useAuth();
  const [selectedStoreId, setSelectedStoreId] = useState(null);

  const { data: ck, isLoading } = useQuery({
    queryKey: ['central-kitchen-metadata'],
    queryFn: () => api.get('/central-kitchen').then((r) => r.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (ck?._id) {
      setSelectedStoreId(ck._id);
      localStorage.setItem('ck_selected_store', ck._id);
    }
  }, [ck]);

  const isStoreReady = !!selectedStoreId;
  const stores = ck ? [ck] : [];

  return (
    <StoreContext.Provider value={{ selectedStoreId, isStoreReady, stores, selectStore: () => {}, ck }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStoreContext = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStoreContext must be inside StoreProvider');
  return ctx;
};
