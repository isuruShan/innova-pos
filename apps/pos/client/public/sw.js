/**
 * POS Client — Service Worker
 *
 * Handles:
 *  1. App shell caching (network-first with cache fallback)
 *  2. Firebase Cloud Messaging background push notifications
 *     (messages received when the tab is closed or in background)
 */

// ─── Firebase background messaging ──────────────────────────────────────────
// importScripts is the only way to use Firebase inside a service worker.
// The version must match what firebase/messaging uses in the main bundle.
try {
  importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

  // The SW cannot read Vite import.meta.env — the config must be injected via
  // a globalThis variable set from the main thread, OR we fall back to reading
  // a well-known broadcast channel message.
  // We listen for a FIREBASE_CONFIG message sent from the app on SW registration.
  self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'FIREBASE_CONFIG' && !self.__fcmInitialised) {
      const cfg = event.data.config;
      if (cfg && cfg.apiKey && cfg.projectId) {
        firebase.initializeApp(cfg);
        const messaging = firebase.messaging();

        // Handle background push messages (tab is closed / backgrounded)
        messaging.onBackgroundMessage((payload) => {
          const { title = 'Notification', body = '' } = payload.notification || {};
          self.registration.showNotification(title, {
            body,
            icon: '/logo.png',
            badge: '/logo.png',
            data: payload.data || {},
            tag: payload.data?.type || 'pos-notification',
            renotify: true,
          });
        });

        self.__fcmInitialised = true;
      }
    }

    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });
} catch (e) {
  // Firebase CDN scripts failed to load (offline / CSP) — skip FCM
  console.warn('[SW] Firebase messaging not available:', e.message);
}

// Notification click → focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});

// ─── App shell caching ───────────────────────────────────────────────────────
const CACHE_NAME = 'cafinity-pos-v2';
const urlsToCache = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => n !== CACHE_NAME && caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('/index.html');
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        })
      )
  );
});
