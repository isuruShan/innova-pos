'use strict';

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
