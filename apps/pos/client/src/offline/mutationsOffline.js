import {
  enqueue,
  putPendingOrder,
  patchPendingOrderByOrderId,
  listPendingOrders,
} from './idb.js';
import { normalizeApiPath } from './http.js';
import { buildSyntheticOrderFromPostBody } from './syntheticOrder.js';

function parseBody(config) {
  const d = config.data;
  if (d == null) return {};
  if (typeof d === 'string') {
    try {
      return JSON.parse(d);
    } catch {
      return {};
    }
  }
  return { ...d };
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('pos_user') || 'null');
  } catch {
    return null;
  }
}

function dispatchQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos-offline-queue'));
  }
}

const KITCHEN_FORWARD = { pending: 'preparing', preparing: 'ready', ready: 'completed' };

async function advanceOfflineKitchenOrder(orderId) {
  const orders = await listPendingOrders();
  const o = orders.find((x) => x._id === orderId);
  if (!o) return;
  const next = KITCHEN_FORWARD[o.status];
  if (next) await patchPendingOrderByOrderId(orderId, { status: next });
}

/**
 * @returns {Promise<{ data: unknown, status: number, headers: object, config: object } | null>}
 */
export async function serveOfflineMutation(err) {
  const config = err.config;
  if (!config || config.headers?.['x-pos-sync-replay']) return null;

  const method = (config.method || 'GET').toUpperCase();
  const rawPath = normalizeApiPath(config);
  const pathOnly = rawPath.split('?')[0];

  if (method === 'POST' && /\/orders\/?$/.test(pathOnly)) {
    const clientRequestId = crypto.randomUUID();
    const base = parseBody(config);
    const body = { ...base, clientRequestId };
    const user = getStoredUser();
    const synthetic = buildSyntheticOrderFromPostBody(body, clientRequestId, user);

    await putPendingOrder(clientRequestId, synthetic);
    await enqueue({
      id: crypto.randomUUID(),
      kind: 'POST_ORDERS',
      method: 'POST',
      url: '/orders',
      body,
      clientRequestId,
      createdAt: Date.now(),
    });
    dispatchQueueChanged();

    return {
      data: synthetic,
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
    };
  }

  if (method === 'PUT' && pathOnly.includes('/orders/') && pathOnly.endsWith('/status')) {
    const m = pathOnly.match(/\/orders\/([^/]+)\/status$/);
    const orderId = m ? decodeURIComponent(m[1]) : null;
    const body = parseBody(config);
    if (orderId && body.status) {
      await patchPendingOrderByOrderId(orderId, { status: body.status });
    } else if (orderId && !body.status) {
      await advanceOfflineKitchenOrder(orderId);
    }

    await enqueue({
      id: crypto.randomUUID(),
      kind: 'PUT_ORDER_STATUS',
      method: 'PUT',
      url: config.url || rawPath.replace(/^\/api/, ''),
      body,
      clientRequestId: null,
      createdAt: Date.now(),
    });
    dispatchQueueChanged();

    return {
      data: { ok: true, _offlinePending: true, _id: orderId, status: body.status },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  }

  return null;
}
