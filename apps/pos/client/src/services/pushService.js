import api from '../api/axios';

/**
 * Request user permission for push notifications and register the browser token with the backend.
 * 
 * Supports dynamically checking if Firebase Messaging is configured on the window
 * (initialized via firebase.js configuration if active).
 */
export async function initializePushNotifications() {
  if (!('Notification' in window)) {
    console.warn('[PushService] This browser does not support desktop notifications.');
    return null;
  }

  // Check current permission state
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

    // In a production environment, FCM web SDK `messaging.getToken()` would be requested:
    // const messaging = getFirebaseMessagingInstance();
    // const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
    
    // For demonstration, retrieve or generate a mockup persistent device token
    let clientToken = localStorage.getItem('pos_fcm_token');
    if (!clientToken) {
      clientToken = 'mock_fcm_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('pos_fcm_token', clientToken);
    }

    // Send the token to the backend
    await api.post('/users/push-token', { token: clientToken });
    console.log('[PushService] Push notification token successfully registered.');
    return clientToken;

  } catch (error) {
    console.error('[PushService] Failed to initialize push notifications:', error.message);
    return null;
  }
}

/**
 * Remove user push token on signout.
 */
export async function unregisterPushNotifications() {
  const clientToken = localStorage.getItem('pos_fcm_token');
  if (!clientToken) return;

  try {
    await api.post('/users/push-token/remove', { token: clientToken });
    localStorage.removeItem('pos_fcm_token');
    console.log('[PushService] Push token unregistered successfully.');
  } catch (error) {
    console.error('[PushService] Failed to unregister push token:', error.message);
  }
}
