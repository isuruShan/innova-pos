/**
 * Minimal IndexedDB helper for POS offline (no extra deps).
 */

const DB_NAME = 'pos-offline-v1';
const DB_VERSION = 1;

const STORES = {
  queue: 'syncQueue',
  cache: 'responseCache',
  pendingOrders: 'pendingOrders',
  idMap: 'idMap',
};

let dbPromise;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.queue)) {
          db.createObjectStore(STORES.queue, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.cache)) {
          db.createObjectStore(STORES.cache, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.pendingOrders)) {
          db.createObjectStore(STORES.pendingOrders, { keyPath: 'clientRequestId' });
        }
        if (!db.objectStoreNames.contains(STORES.idMap)) {
          db.createObjectStore(STORES.idMap, { keyPath: 'tempId' });
        }
      };
    });
  }
  return dbPromise;
}

async function tx(storeNames, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    transaction.oncomplete = () => {};
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    Promise.resolve(fn(transaction)).then(resolve, reject);
  });
}

export async function enqueue(item) {
  await tx([STORES.queue], 'readwrite', (t) => {
    const store = t.objectStore(STORES.queue);
    store.put(item);
  });
}

export async function listQueue() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORES.queue, 'readonly').objectStore(STORES.queue).getAll();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result || []);
  });
}

export async function removeQueueItem(id) {
  await tx([STORES.queue], 'readwrite', (t) => {
    t.objectStore(STORES.queue).delete(id);
  });
}

export async function setCacheEntry(key, value) {
  await tx([STORES.cache], 'readwrite', (t) => {
    t.objectStore(STORES.cache).put({ key, value, storedAt: Date.now() });
  });
}

export async function getCacheRow(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORES.cache, 'readonly').objectStore(STORES.cache).get(key);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result ?? null);
  });
}

export async function putPendingOrder(clientRequestId, orderDoc) {
  await tx([STORES.pendingOrders], 'readwrite', (t) => {
    t.objectStore(STORES.pendingOrders).put({ clientRequestId, order: orderDoc, savedAt: Date.now() });
  });
}

export async function removePendingOrder(clientRequestId) {
  await tx([STORES.pendingOrders], 'readwrite', (t) => {
    t.objectStore(STORES.pendingOrders).delete(clientRequestId);
  });
}

export async function listPendingOrders() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORES.pendingOrders, 'readonly').objectStore(STORES.pendingOrders).getAll();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve((r.result || []).map((x) => x.order).filter(Boolean));
  });
}

export async function patchPendingOrderByOrderId(orderId, patch) {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const r = db.transaction(STORES.pendingOrders, 'readonly').objectStore(STORES.pendingOrders).getAll();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result || []);
  });
  const row = rows.find((x) => x.order?._id === orderId);
  if (!row) return false;
  const next = { ...row.order, ...patch, updatedAt: new Date().toISOString() };
  await putPendingOrder(row.clientRequestId, next);
  return true;
}

export async function setIdMap(tempId, serverId) {
  await tx([STORES.idMap], 'readwrite', (t) => {
    t.objectStore(STORES.idMap).put({ tempId, serverId });
  });
}

export async function getServerIdForTemp(tempId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORES.idMap, 'readonly').objectStore(STORES.idMap).get(tempId);
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(r.result?.serverId ?? null);
  });
}

export async function loadAllIdMappings() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORES.idMap, 'readonly').objectStore(STORES.idMap).getAll();
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const map = {};
      for (const row of r.result || []) {
        map[row.tempId] = row.serverId;
      }
      resolve(map);
    };
  });
}
