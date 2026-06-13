'use strict';

/**
 * subscriptionNotify.js
 *
 * Helper that pairs email + in-app notifications for subscription events.
 * Every email sent here is accompanied by a push notification (same data)
 * because notifyMerchantAdmins / notifySuperAdmins already dispatch push.
 */

const User = require('../models/User');
const { notifyMerchantAdmins, notifySuperAdmins } = require('./notificationHelpers');
const { sendEmail } = require('../utils/mailer');

async function emailMerchantAdmins(tenantId, { subject, html }) {
  const admins = await User.find({
    tenantId,
    role: 'merchant_admin',
    isActive: true,
  }).select('email').lean();
  await Promise.all(
    admins.map((a) => sendEmail({ to: a.email, subject, html }).catch(() => {})),
  );
}

async function emailSuperAdmins({ subject, html }) {
  const supers = await User.find({ role: 'superadmin', isActive: true }).select('email').lean();
  await Promise.all(
    supers.map((u) => sendEmail({ to: u.email, subject, html }).catch(() => {})),
  );
}

/**
 * Fire email + in-app + push for a subscription lifecycle event.
 *
 * notifyMerchantAdmins / notifySuperAdmins already call sendPushNotification
 * internally, so push is covered automatically whenever those helpers are used.
 */
async function notifySubscriptionEvent(tenantId, {
  type,
  title,
  body,
  meta = {},
  merchantEmail,
  superEmail,
}) {
  await Promise.all([
    notifyMerchantAdmins(tenantId, { type, title, body, meta }).catch(() => {}),
    notifySuperAdmins(tenantId, { type, title, body, meta }).catch(() => {}),
  ]);
  if (merchantEmail) {
    await emailMerchantAdmins(tenantId, merchantEmail).catch(() => {});
  }
  if (superEmail) {
    await emailSuperAdmins(superEmail).catch(() => {});
  }
}

module.exports = {
  emailMerchantAdmins,
  emailSuperAdmins,
  notifySubscriptionEvent,
};
