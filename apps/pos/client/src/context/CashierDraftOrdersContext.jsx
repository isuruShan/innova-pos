import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createDefaultStoreDrafts,
  createEmptyDraft,
  normalizeStoreDrafts,
  readDraftStorage,
  writeDraftStorage,
} from '../utils/cashierDraftOrders';
import { useAuth } from './AuthContext';
import { useStoreContext } from './StoreContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import api from '../api/axios';

const CashierDraftOrdersContext = createContext(null);

export function CashierDraftOrdersProvider({ children }) {
  const { user } = useAuth();
  const { selectedStoreId } = useStoreContext();
  const online = useOnlineStatus();

  const [byStore, setByStore] = useState(() => readDraftStorage());
  const [syncedStores, setSyncedStores] = useState({});

  const persist = useCallback((next) => {
    setByStore((prev) => {
      const updated = typeof next === 'function' ? next(prev) : next;
      writeDraftStorage(updated);
      return updated;
    });
  }, []);

  const ensureStore = useCallback((storeId) => {
    if (!storeId) return createDefaultStoreDrafts();
    return normalizeStoreDrafts(byStore[storeId] || createDefaultStoreDrafts());
  }, [byStore]);

  const getStoreState = useCallback((storeId) => ensureStore(storeId), [ensureStore]);

  const updateStore = useCallback((storeId, updater) => {
    if (!storeId) return;
    persist((prev) => {
      const current = normalizeStoreDrafts(prev[storeId] || createDefaultStoreDrafts());
      const nextStore = updater(current);
      const normalized = normalizeStoreDrafts(nextStore);
      normalized.updatedAt = Date.now();
      return { ...prev, [storeId]: normalized };
    });
  }, [persist]);

  // Reset sync status when store changes
  useEffect(() => {
    if (selectedStoreId) {
      setSyncedStores(prev => ({ ...prev, [selectedStoreId]: false }));
    }
  }, [selectedStoreId]);

  // Load from server
  useEffect(() => {
    if (!online || !selectedStoreId || !user) {
      if (selectedStoreId) {
        setSyncedStores(prev => ({ ...prev, [selectedStoreId]: true }));
      }
      return;
    }
    let active = true;
    api.get('/cashier-drafts', { params: { storeId: selectedStoreId } })
      .then(({ data }) => {
        if (!active) return;
        if (data && Array.isArray(data.drafts)) {
          setByStore((prev) => {
            const currentStoreState = prev[selectedStoreId] || {};
            const localUpdatedAt = currentStoreState.updatedAt || 0;
            const serverUpdatedAt = data.updatedAtMs || 0;

            const isLocalDefault = !currentStoreState.drafts || 
              (currentStoreState.drafts.length === 1 && (!currentStoreState.drafts[0].cart || currentStoreState.drafts[0].cart.length === 0) && !currentStoreState.drafts[0].tableNumber);

            if (serverUpdatedAt > localUpdatedAt || isLocalDefault) {
              const next = {
                ...prev,
                [selectedStoreId]: {
                  activeDraftId: data.activeDraftId,
                  drafts: data.drafts,
                  updatedAt: serverUpdatedAt,
                },
              };
              writeDraftStorage(next);
              return next;
            }
            return prev;
          });
        }
        setSyncedStores(prev => ({ ...prev, [selectedStoreId]: true }));
      })
      .catch((err) => {
        console.error('Failed to fetch drafts from server', err);
        if (active) {
          setSyncedStores(prev => ({ ...prev, [selectedStoreId]: true }));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedStoreId, online, user]);

  // Save to server
  useEffect(() => {
    if (!online || !selectedStoreId || !user || !syncedStores[selectedStoreId]) return;
    const storeState = byStore[selectedStoreId];
    if (!storeState) return;

    const timer = setTimeout(() => {
      api.post('/cashier-drafts', {
        storeId: selectedStoreId,
        activeDraftId: storeState.activeDraftId,
        drafts: storeState.drafts,
        updatedAtMs: storeState.updatedAt || Date.now(),
      }).catch((err) => {
        console.error('Failed to save drafts to server', err);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [byStore, selectedStoreId, online, user, syncedStores]);

  const value = useMemo(() => ({
    getStoreState,
    updateStore,
    clearStore(storeId) {
      if (!storeId) return;
      persist((prev) => {
        const next = { ...prev };
        delete next[storeId];
        return next;
      });
    },
  }), [getStoreState, updateStore, persist]);

  return (
    <CashierDraftOrdersContext.Provider value={value}>
      {children}
    </CashierDraftOrdersContext.Provider>
  );
}

export function useCashierDraftOrders(storeId) {
  const ctx = useContext(CashierDraftOrdersContext);
  if (!ctx) throw new Error('useCashierDraftOrders must be used within CashierDraftOrdersProvider');

  const storeState = ctx.getStoreState(storeId);
  const activeDraft = storeState.drafts.find((d) => d.id === storeState.activeDraftId)
    || storeState.drafts[0]
    || createEmptyDraft();

  const patchActiveDraft = useCallback((updater) => {
    ctx.updateStore(storeId, (state) => {
      const drafts = state.drafts.map((d) => {
        if (d.id !== state.activeDraftId) return d;
        const patch = typeof updater === 'function' ? updater(d) : updater;
        return { ...d, ...patch };
      });
      return { ...state, drafts };
    });
  }, [ctx, storeId]);

  const selectDraft = useCallback((draftId) => {
    ctx.updateStore(storeId, (state) => ({ ...state, activeDraftId: draftId }));
  }, [ctx, storeId]);

  const addDraft = useCallback(() => {
    const draft = createEmptyDraft();
    ctx.updateStore(storeId, (state) => ({
      activeDraftId: draft.id,
      drafts: [...state.drafts, draft],
    }));
    return draft.id;
  }, [ctx, storeId]);

  const addDraftWithTable = useCallback((tableId, tableLabel) => {
    const draft = createEmptyDraft();
    draft.orderType = 'dine-in';
    draft.selectedTableId = tableId;
    draft.tableNumber = tableLabel;
    ctx.updateStore(storeId, (state) => ({
      activeDraftId: draft.id,
      drafts: [...state.drafts, draft],
    }));
    return draft.id;
  }, [ctx, storeId]);

  const removeDraft = useCallback((draftId) => {
    ctx.updateStore(storeId, (state) => {
      if (state.drafts.length <= 1) {
        const fresh = createEmptyDraft();
        return { activeDraftId: fresh.id, drafts: [fresh] };
      }
      const drafts = state.drafts.filter((d) => d.id !== draftId);
      const activeDraftId = state.activeDraftId === draftId
        ? drafts[0]?.id
        : state.activeDraftId;
      return { activeDraftId, drafts };
    });
  }, [ctx, storeId]);

  const clearActiveDraftAfterSubmit = useCallback(() => {
    ctx.updateStore(storeId, (state) => {
      const remaining = state.drafts.filter((d) => d.id !== state.activeDraftId);
      if (remaining.length === 0) {
        const fresh = createEmptyDraft();
        return { activeDraftId: fresh.id, drafts: [fresh] };
      }
      return {
        activeDraftId: remaining[0].id,
        drafts: remaining,
      };
    });
  }, [ctx, storeId]);

  const resetStoreDrafts = useCallback(() => {
    ctx.clearStore(storeId);
  }, [ctx, storeId]);

  return {
    drafts: storeState.drafts,
    activeDraftId: storeState.activeDraftId,
    activeDraft,
    patchActiveDraft,
    selectDraft,
    addDraft,
    addDraftWithTable,
    removeDraft,
    clearActiveDraftAfterSubmit,
    resetStoreDrafts,
  };
}
