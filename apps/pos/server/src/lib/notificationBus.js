'use strict';

const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(2000);

let pubClient;
let subClient;
let redisReady = false;
let initPromise;

function channelName(tenantId, userId) {
  return `pos:notif:${String(tenantId)}:${String(userId)}`;
}

/**
 * Connect Redis pub/sub (uses REDIS_URL or RATE_LIMIT_REDIS_URL).
 * Without Redis, signals stay in-process only (fine for single dev server).
 */
function initNotificationBus(logger) {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const url = String(process.env.REDIS_URL || process.env.RATE_LIMIT_REDIS_URL || '').trim();
    if (!url) {
      if (logger?.info) logger.info('[notification-bus] in-process only (set REDIS_URL for cluster SSE)');
      return;
    }
    try {
      const { createClient } = require('redis');
      pubClient = createClient({ url });
      subClient = pubClient.duplicate();
      pubClient.on('error', (err) => {
        if (logger?.warn) logger.warn('[notification-bus] pub client error', { error: err?.message || String(err) });
      });
      subClient.on('error', (err) => {
        if (logger?.warn) logger.warn('[notification-bus] sub client error', { error: err?.message || String(err) });
      });
      await pubClient.connect();
      await subClient.connect();
      await subClient.pSubscribe('pos:notif:*:*', (message, channel) => {
        bus.emit(String(channel), message);
      });
      redisReady = true;
      if (logger?.info) logger.info('[notification-bus] Redis pub/sub ready for notification SSE');
    } catch (e) {
      pubClient = undefined;
      subClient = undefined;
      redisReady = false;
      if (logger?.warn) logger.warn('[notification-bus] Redis unavailable', { error: e?.message || String(e) });
    }
  })();
  return initPromise;
}

function publishNotificationRefresh(tenantId, userIds) {
  const tid = String(tenantId);
  const ids = [...new Set((userIds || []).map((u) => String(u)).filter(Boolean))];
  const payload = JSON.stringify({ v: 1, at: Date.now() });
  for (const uid of ids) {
    const ch = channelName(tid, uid);
    if (redisReady && pubClient?.isReady) {
      pubClient.publish(ch, payload).catch(() => {});
    } else {
      bus.emit(ch, payload);
    }
  }
}

function subscribeUserNotifications(tenantId, userId, handler) {
  const ch = channelName(tenantId, userId);
  bus.on(ch, handler);
  return () => {
    bus.off(ch, handler);
  };
}

module.exports = {
  initNotificationBus,
  publishNotificationRefresh,
  subscribeUserNotifications,
};
