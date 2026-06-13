const User = require('../models/User');

let fcmAppInstance = null;

/**
 * Sends a push notification payload to the specified users via Firebase Cloud Messaging.
 * Falls back to local logging when Firebase credentials are not present in process.env.
 *
 * Target users are queried, all stored FCM tokens aggregated, and multicasted.
 * Invalid tokens reported by Firebase are automatically purged.
 *
 * @param {Array|string} userIds - Target User ID(s)
 * @param {object} payload - { title: string, body: string, data: object }
 * @param {object} logger - Winston logger instance
 */
async function sendPushNotification(userIds, payload, logger = console) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (!ids.length) {
    logger.info('[PushNotifier] Called with empty userIds — skipping.');
    return;
  }

  try {
    // 1. Fetch user FCM tokens from DB
    const users = await User.find({ _id: { $in: ids } }).select('_id name fcmTokens').lean();
    const tokenToUserMap = {};
    const tokens = [];

    for (const u of users) {
      const count = u.fcmTokens ? u.fcmTokens.length : 0;
      logger.info(`[PushNotifier] User "${u.name || u._id}" has ${count} registered FCM token(s).`);
      if (u.fcmTokens && u.fcmTokens.length) {
        for (const token of u.fcmTokens) {
          tokens.push(token);
          tokenToUserMap[token] = u._id;
        }
      }
    }

    if (users.length === 0) {
      logger.warn(`[PushNotifier] No users found in DB for IDs: ${ids.join(', ')}`);
      return;
    }

    if (tokens.length === 0) {
      logger.warn(`[PushNotifier] Users found but no FCM tokens registered. Make sure the mobile app calls POST /api/users/push-token after login. User IDs: ${ids.join(', ')}`);
      return;
    }

    const title = payload.title || '';
    const body = payload.body || '';
    const data = payload.meta ? Object.keys(payload.meta).reduce((acc, k) => {
      acc[k] = String(payload.meta[k]);
      return acc;
    }, {}) : {};

    // 2. Check for Firebase Admin SDK Credentials
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      const missing = [
        !projectId && 'FIREBASE_PROJECT_ID',
        !clientEmail && 'FIREBASE_CLIENT_EMAIL',
        !privateKey && 'FIREBASE_PRIVATE_KEY',
      ].filter(Boolean);
      logger.warn(`[PushNotifier] Firebase credentials not found — missing env vars: ${missing.join(', ')}. Falling back to local log.`);
      // Fallback log
      logger.info('--------------------------------------------------');
      logger.info('[FCM PUSH NOTIFICATION FALLBACK LOG]');
      logger.info(`To Users: ${ids.join(', ')}`);
      logger.info(`Target Devices Count: ${tokens.length}`);
      logger.info(`Title: ${title}`);
      logger.info(`Body: ${body}`);
      logger.info('Data Payload:', data);
      logger.info('--------------------------------------------------');
      return;
    }

    // 3. Initialise Firebase Admin SDK
    const admin = require('firebase-admin');

    if (!fcmAppInstance) {
      if (admin.apps.length > 0) {
        logger.info('[PushNotifier] Reusing existing Firebase Admin app instance.');
        fcmAppInstance = admin.apps[0];
      } else {
        // The private key stored in env / Key Vault may have literal \n sequences
        // (common when stored as a JSON string) — convert them to real newlines.
        const formattedKey = privateKey.replace(/\\n/g, '\n');
        if (!formattedKey.startsWith('-----BEGIN')) {
          logger.error('[PushNotifier] FIREBASE_PRIVATE_KEY does not look like a valid PEM key. Make sure the value starts with "-----BEGIN RSA PRIVATE KEY-----" or "-----BEGIN PRIVATE KEY-----". Check Key Vault secret JSON for accidental escaping.');
        }
        logger.info(`[PushNotifier] Initialising Firebase Admin SDK for project: ${projectId}, clientEmail: ${clientEmail}`);
        try {
          fcmAppInstance = admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              clientEmail,
              privateKey: formattedKey,
            }),
          });
          logger.info('[PushNotifier] Firebase Admin SDK initialised successfully.');
        } catch (initErr) {
          logger.error('[PushNotifier] Firebase Admin SDK initializeApp failed:', { error: initErr.message });
          throw initErr;
        }
      }
    }

    const message = {
      notification: { title, body },
      data,
      tokens,
    };

    logger.info(`[PushNotifier] Sending multicast to ${tokens.length} token(s). Title: "${title}"`);

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`[PushNotifier] FCM multicast result: successCount=${response.successCount}, failureCount=${response.failureCount}`);

    // 4. Parse per-token failures and log them + purge expired tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          logger.warn(`[PushNotifier] Token #${idx} failed — code: ${error?.code}, message: ${error?.message}`);
          if (
            error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered'
          ) {
            tokensToRemove.push(tokens[idx]);
            logger.warn(`[PushNotifier] Queuing expired/invalid token for removal: ${tokens[idx].substring(0, 20)}...`);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        for (const token of tokensToRemove) {
          const uId = tokenToUserMap[token];
          if (uId) {
            await User.findByIdAndUpdate(uId, { $pull: { fcmTokens: token } });
          }
        }
        logger.info(`[PushNotifier] Purged ${tokensToRemove.length} expired FCM registration token(s).`);
      }
    }
  } catch (error) {
    logger.error('[PushNotifier] Error during push dispatch', {
      error: error.message,
      stack: error.stack,
    });
  }
}

module.exports = { sendPushNotification };
