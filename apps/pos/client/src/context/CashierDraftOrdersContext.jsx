import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  createDefaultStoreDrafts,
  createEmptyDraft,
  normalizeStoreDrafts,
  readDraftStorage,
  writeDraftStorage,
} from '../utils/cashierDraftOrders';

const CashierDraftOrdersContext = createContext(null);

export function CashierDraftOrdersProvider({ children }) {
  const [byStore, setByStore] = useState(() => readDraftStorage());

  const persist = useCallback((next) => {
    setByStore(next);
    writeDraftStorage(next);
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
      return { ...prev, [storeId]: normalizeStoreDrafts(nextStore) };
    });
  }, [persist]);

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
