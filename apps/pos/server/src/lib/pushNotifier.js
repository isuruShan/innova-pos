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
  if (!ids.length) return;

  try {
    // 1. Fetch user FCM tokens
    const users = await User.find({ _id: { $in: ids } }).select('_id fcmTokens').lean();
    const tokenToUserMap = {};
    const tokens = [];

    for (const u of users) {
      if (u.fcmTokens && u.fcmTokens.length) {
        for (const token of u.fcmTokens) {
          tokens.push(token);
          tokenToUserMap[token] = u._id;
        }
      }
    }

    if (tokens.length === 0) {
      logger.info(`[PushNotifier] No registered FCM tokens found for users: ${ids.join(', ')}`);
      return;
    }

    const title = payload.title || '';
    const body = payload.body || '';
    const data = payload.meta ? Object.keys(payload.meta).reduce((acc, k) => {
      acc[k] = String(payload.meta[k]);
      return acc;
    }, {}) : {};

    // 2. Check for Firebase Admin Credentials
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      logger.info(`[PushNotifier] Dispatched push payload via FCM to ${tokens.length} devices.`);
      
      const admin = require('firebase-admin');
      
      // Initialize Firebase application if not already initialized
      if (!fcmAppInstance) {
        const formattedKey = privateKey.replace(/\\n/g, '\n');
        fcmAppInstance = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: formattedKey,
          }),
        });
      }

      const message = {
        notification: { title, body },
        data,
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info(`[PushNotifier] Multicast result: successCount=${response.successCount}, failureCount=${response.failureCount}`);

      // Parse failures to clean up invalid/expired tokens
      if (response.failureCount > 0) {
        const tokensToRemove = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            if (
              error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered'
            ) {
              const badToken = tokens[idx];
              tokensToRemove.push(badToken);
              logger.warn(`[PushNotifier] Expired or invalid token detected and queued for removal: ${badToken}`);
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
          logger.info(`[PushNotifier] Purged ${tokensToRemove.length} expired FCM registration tokens.`);
        }
      }
    } else {
      // 3. Fallback to Local Logging
      logger.info('--------------------------------------------------');
      logger.info('[FCM PUSH NOTIFICATION FALLBACK LOG]');
      logger.info(`To Users: ${ids.join(', ')}`);
      logger.info(`Target Devices Count: ${tokens.length}`);
      logger.info(`Title: ${title}`);
      logger.info(`Body: ${body}`);
      logger.info('Data Payload:', data);
      logger.info('--------------------------------------------------');
    }
  } catch (error) {
    logger.error('[PushNotifier] Error during push dispatch', {
      error: error.message,
      stack: error.stack,
    });
  }
}

module.exports = { sendPushNotification };
