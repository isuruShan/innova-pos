import api from '../api/axios';
import { getFirebaseInstances } from './firebase';
import { getToken, deleteToken } from 'firebase/messaging';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const TOKEN_KEY = 'admin_fcm_token';

/**
 * Posts the Firebase client config to the active service worker so it can
 * initialise firebase-messaging-compat for background push handling.
 */
async function sendConfigToServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const sw = regs[0]?.active;
    if (!sw) return;
    sw.postMessage({
      type: 'FIREBASE_CONFIG',
      config: {
        apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId:             import.meta.env.VITE_FIREBASE_APP_ID,
      },
    });
  } catch (e) {
    console.warn('[PushService] Could not send Firebase config to SW:', e.message);
  }
}

export async function initializePushNotifications() {
  if (!('Notification' in window)) return null;
  if (Notification.permission === 'denied') return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const { messaging } = await getFirebaseInstances();
    if (!messaging || !VAPID_KEY) {
      console.warn('[PushService] Firebase Messaging not available or VAPID key missing.');
      return null;
    }

    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: regs[0] || undefined,
    });

    if (!token) {
      console.warn('[PushService] FCM getToken returned empty — check VAPID key and service worker.');
      return null;
    }

    localStorage.setItem(TOKEN_KEY, token);

    // Send Firebase config to the service worker for background message handling
    await sendConfigToServiceWorker();

    await api.post('/users/push-token', { token });
    console.log('[PushService] Admin FCM token registered.');
    return token;

  } catch (err) {
    console.error('[PushService] Push init failed:', err.message);
    return null;
  }
}

export async function silentRegisterIfGranted() {
  if (Notification.permission !== 'granted') return null;
  return initializePushNotifications();
}

export async function unregisterPushNotifications() {
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    if (token) await api.post('/users/push-token/remove', { token }).catch(() => {});
    const { messaging } = await getFirebaseInstances();
    if (messaging) await deleteToken(messaging).catch(() => {});
  } finally {
    localStorage.removeItem(TOKEN_KEY);
    console.log('[PushService] Push token unregistered.');
  }
}
