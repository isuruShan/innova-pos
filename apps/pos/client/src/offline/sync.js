import {
  listQueue,
  removeQueueItem,
  removePendingOrder,
  setIdMap,
  loadAllIdMappings,
} from './idb.js';
import { tempOrderId } from './constants.js';

let clientApi;

async function rewriteUrl(url, map) {
  let out = url;
  const merged = { ...map };
  for (const [temp, real] of Object.entries(merged)) {
    if (!temp || !real) continue;
    const encTemp = encodeURIComponent(temp);
    const encReal = encodeURIComponent(real);
    out = out.split(encTemp).join(encReal);
    out = out.split(temp).join(real);
  }
  return out;
}

/**
 * Replay queued mutations (FIFO). Updates temp-id map after successful order creates.
 */
export async function processSyncQueue() {
  if (typeof window !== 'undefined' && window.navigator.onLine === false) return;
  if (!clientApi) return;

  let items = await listQueue();
  items = items.sort((a, b) => a.createdAt - b.createdAt);
  let map = await loadAllIdMappings();
  let completedSomething = false;

  for (const item of items) {
    try {
      let url = await rewriteUrl(item.url, map);
      const headers = {
        'x-pos-sync-replay': '1',
      };
      if (item.clientRequestId) {
        headers['x-client-request-id'] = item.clientRequestId;
      }

      let res;
      if (item.method === 'POST') {
        res = await clientApi.post(url, item.body, { headers });
      } else if (item.method === 'PUT') {
        res = await clientApi.put(url, item.body, { headers });
      } else {
        await removeQueueItem(item.id);
        continue;
      }

      if (item.kind === 'POST_ORDERS' && item.clientRequestId) {
        await removePendingOrder(item.clientRequestId);
        const sid = res?.data?._id ? String(res.data._id) : null;
        if (sid) {
          await setIdMap(tempOrderId(item.clientRequestId), sid);
          map[tempOrderId(item.clientRequestId)] = sid;
        }
      }

      await removeQueueItem(item.id);
      map = await loadAllIdMappings();
      completedSomething = true;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-offline-queue'));
      }
    } catch (e) {
      console.warn('[pos-offline] Sync stopped:', e?.message || e);
      break;
    }
  }

  if (completedSomething && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos-offline-sync-done'));
  }
}

export function registerSyncListeners(apiInstance) {
  clientApi = apiInstance;
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    processSyncQueue();
  });

  window.addEventListener('pos-offline-queue', () => {
    if (window.navigator.onLine) {
      processSyncQueue();
    }
  });

  // Initial attempt when app loads online
  setTimeout(() => {
    if (window.navigator.onLine) processSyncQueue();
  }, 500);
}
