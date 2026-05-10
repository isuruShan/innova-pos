import { orderStoreKey } from './orderSelection.js';

/**
 * Merge server orders with locally persisted offline-created orders.
 * Dedupes by clientRequestId and _id so the board stays consistent after sync.
 */
export function mergeOrderLists(remoteList, pendingList, selectedStoreId) {
  const sid = selectedStoreId ? String(selectedStoreId) : '';
  const remote = Array.isArray(remoteList) ? remoteList : [];
  const pending = Array.isArray(pendingList) ? pendingList : [];

  const remoteReqIds = new Set(
    remote.map((o) => o.clientRequestId).filter(Boolean),
  );
  const remoteIds = new Set(remote.map((o) => String(o._id)));

  const extras = pending.filter((o) => {
    if (!o?._offlinePending) return false;
    if (o.clientRequestId && remoteReqIds.has(o.clientRequestId)) return false;
    if (remoteIds.has(String(o._id))) return false;
    const oSid = orderStoreKey(o.storeId);
    if (sid && oSid && oSid !== sid) return false;
    return true;
  });

  const merged = [...remote, ...extras];
  merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return merged;
}
