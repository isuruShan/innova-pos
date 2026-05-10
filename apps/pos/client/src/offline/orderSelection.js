import { useEffect } from 'react';

/**
 * Normalize store id from API (string or populated { _id }).
 */
export function orderStoreKey(storeId) {
  if (storeId == null || storeId === '') return '';
  if (typeof storeId === 'object' && storeId !== null && storeId._id != null) {
    return String(storeId._id);
  }
  return String(storeId);
}

/**
 * Resolve selected order against merged list (handles id string/ObjectId and post-sync clientRequestId match).
 */
export function resolveLiveOrder(orders, selectedOrder) {
  if (!selectedOrder) return null;
  const id = String(selectedOrder._id);
  const byId = orders.find((o) => String(o._id) === id);
  if (byId) return byId;
  if (selectedOrder.clientRequestId) {
    const byReq = orders.find((o) => o.clientRequestId === selectedOrder.clientRequestId);
    if (byReq) return byReq;
  }
  return selectedOrder;
}

/**
 * When an offline order syncs, server row replaces temp id — update selection so maintenance actions target the real order.
 */
export function useSyncOfflineOrderSelection(orders, selectedOrder, setSelectedOrder) {
  useEffect(() => {
    if (!selectedOrder?._offlinePending || !selectedOrder?.clientRequestId) return;
    const synced = orders.find(
      (o) =>
        o.clientRequestId === selectedOrder.clientRequestId &&
        String(o._id) !== String(selectedOrder._id) &&
        !o._offlinePending
    );
    if (synced) setSelectedOrder(synced);
  }, [orders, selectedOrder, setSelectedOrder]);
}
