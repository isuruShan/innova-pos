import api from '../api/axios';
import { getFirebaseInstances } from './firebase';
import { getToken, deleteToken } from 'firebase/messaging';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const TOKEN_KEY = 'pos_fcm_token';

/**
 * Posts the Firebase client config to the active service worker so it can
 * initialise firebase-messaging-compat for background push handling.
 * The SW cannot read Vite import.meta.env, so we bridge it here.
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

/**
 * Returns the active service worker registration so FCM can use it.
 * Prefers the VitePWA-registered SW; falls back to any existing registration.
 */
async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs[0] || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Request user permission for push notifications and register the real FCM
 * token with the backend.
 *
 * Call this only when the user has just clicked "Enable notifications" in the
 * consent banner, or immediately after login if permission is already 'granted'.
 *
 * @returns {string|null} The registered FCM token, or null on failure/denial.
 */
export async function initializePushNotifications() {
  if (!('Notification' in window)) {
    console.warn('[PushService] This browser does not support notifications.');
    return null;
  }

  if (Notification.permission === 'denied') {
    console.warn('[PushService] Notification permission has been denied by the user.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[PushService] Notification permission was not granted.');
      return null;
    }

    const { messaging } = await getFirebaseInstances();

    if (!messaging) {
      console.warn('[PushService] Firebase Messaging not available — VITE_FIREBASE_* env vars may be missing.');
      return null;
    }

    if (!VAPID_KEY) {
      console.warn('[PushService] VITE_FIREBASE_VAPID_KEY is not set — cannot obtain FCM token.');
      return null;
    }

    // Get or refresh the real FCM registration token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await getServiceWorkerRegistration(),
    });

    if (!token) {
      console.warn('[PushService] FCM getToken returned empty — check VAPID key and service worker.');
      return null;
    }

    // Cache locally to allow unregister on logout
    localStorage.setItem(TOKEN_KEY, token);

    // Send Firebase config to the service worker for background message handling
    await sendConfigToServiceWorker();

    // Register token with backend
    await api.post('/users/push-token', { token });
    console.log('[PushService] FCM token registered successfully.');
    return token;

  } catch (error) {
    console.error('[PushService] Failed to initialize push notifications:', error.message);
    return null;
  }
}

/**
 * Silently re-register if permission is already granted (e.g. on page load after
 * a previous session where the user clicked Allow). Does NOT prompt the user.
 */
export async function silentRegisterIfGranted() {
  if (Notification.permission !== 'granted') return null;
  return initializePushNotifications();
}

/**
 * Remove the FCM token from the backend and delete it from Firebase on logout.
 */
export async function unregisterPushNotifications() {
  const token = localStorage.getItem(TOKEN_KEY);
  try {
    if (token) {
      await api.post('/users/push-token/remove', { token }).catch(() => {});
    }
    const { messaging } = await getFirebaseInstances();
    if (messaging) {
      await deleteToken(messaging).catch(() => {});
    }
  } catch (_) {
    // Suppress — best effort on logout
  } finally {
    localStorage.removeItem(TOKEN_KEY);
    console.log('[PushService] Push token unregistered.');
  }
}
