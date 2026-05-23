'use strict';

const crypto = require('crypto');
const Tenant = require('../models/Tenant');

/**
 * Middleware to verify HMAC signature from Uber Eats webhooks
 */
async function uberWebhookAuth(req, res, next) {
  const signature = req.headers['x-uber-signature'];
  if (!signature) {
    console.warn('[Uber Webhook] Verification failed: Missing x-uber-signature header.');
    return res.status(401).json({ message: 'Unauthorized: Missing signature' });
  }

  const uberStoreId = req.body?.meta?.store_id;
  if (!uberStoreId) {
    console.warn('[Uber Webhook] Verification failed: Missing meta.store_id in body.');
    return res.status(400).json({ message: 'Bad Request: Missing store ID' });
  }

  try {
    // Locate tenant having the mapped store
    const tenant = await Tenant.findOne({
      'paidAddons.uberEats.stores.uberStoreId': uberStoreId,
    });

    if (!tenant || !tenant.paidAddons?.uberEats?.webhookSecret) {
      console.warn(`[Uber Webhook] Tenant or Webhook Secret not found for store: ${uberStoreId}`);
      return res.status(404).json({ message: 'Tenant integration not configured' });
    }

    const secret = tenant.paidAddons.uberEats.webhookSecret;
    const bodyStr = req.rawBody || JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyStr)
      .digest('hex');

    // Secure timing comparison
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn('[Uber Webhook] Signature verification mismatch.');
      return res.status(401).json({ message: 'Unauthorized: Invalid signature' });
    }

    // Attach tenant and config context to request for routes to use
    req.tenant = tenant;
    req.uberStoreId = uberStoreId;
    next();
  } catch (error) {
    console.error('[Uber Webhook Auth Error]:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

module.exports = { uberWebhookAuth };
