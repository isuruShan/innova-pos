/**
 * Firebase Web SDK singleton for the Admin Portal client.
 * Mirrors apps/pos/client/src/services/firebase.js — same logic, separate instance.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId,
);

let _app = null;
let _messaging = null;

export async function getFirebaseInstances() {
  if (!isConfigured) return { app: null, messaging: null };
  try {
    const supported = await isSupported();
    if (!supported) return { app: null, messaging: null };
    if (!_app) {
      _app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      _messaging = getMessaging(_app);
    }
    return { app: _app, messaging: _messaging };
  } catch (err) {
    console.warn('[Firebase] Initialisation failed:', err.message);
    return { app: null, messaging: null };
  }
}
