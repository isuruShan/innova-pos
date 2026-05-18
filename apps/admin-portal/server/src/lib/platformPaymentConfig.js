'use strict';

const PlatformPaymentSettings = require('../models/PlatformPaymentSettings');

async function loadPaymentSettings() {
  let doc = await PlatformPaymentSettings.findOne({ singletonKey: 'default' })
    .select('+stripe.secretKey +stripe.webhookSecret +paypal.clientSecret');
  if (!doc) {
    doc = await PlatformPaymentSettings.create({ singletonKey: 'default' });
  }
  return doc;
}

function stripeSecret(doc) {
  return process.env.STRIPE_SECRET_KEY || doc?.stripe?.secretKey || '';
}

function stripeWebhookSecret(doc) {
  return process.env.STRIPE_WEBHOOK_SECRET || doc?.stripe?.webhookSecret || '';
}

function paypalCredentials(doc) {
  return {
    clientId: doc?.paypal?.clientId || process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || doc?.paypal?.clientSecret || '',
    mode: doc?.paypal?.mode === 'live' ? 'live' : 'sandbox',
  };
}

function adminPortalBaseUrl() {
  return (
    process.env.ADMIN_PORTAL_URL
    || process.env.ADMIN_URL
    || process.env.CORS_ORIGIN?.split(',')[0]
    || 'http://localhost:5174'
  ).replace(/\/$/, '');
}

module.exports = {
  loadPaymentSettings,
  stripeSecret,
  stripeWebhookSecret,
  paypalCredentials,
  adminPortalBaseUrl,
};
