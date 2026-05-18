'use strict';

const Stripe = require('stripe');
const { loadPaymentSettings, stripeSecret, adminPortalBaseUrl } = require('../platformPaymentConfig');

async function getStripe() {
  const doc = await loadPaymentSettings();
  const key = stripeSecret(doc);
  if (!key) return null;
  return new Stripe(key);
}

async function createCheckoutSession({ tenant, plan, userId }) {
  const stripe = await getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const base = adminPortalBaseUrl();
  const currency = (plan.currency || 'LKR').toLowerCase();
  const unitAmount = Math.round(Number(plan.amount) * 100);
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    throw new Error('Invalid plan amount for Stripe');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${base}/subscription?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/subscription?payment=cancelled`,
    client_reference_id: String(tenant._id),
    metadata: {
      tenantId: String(tenant._id),
      planId: String(plan._id),
      userId: String(userId || ''),
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: plan.name || 'Cafinity subscription',
            description: plan.code || undefined,
          },
        },
      },
    ],
  });

  return session;
}

module.exports = { getStripe, createCheckoutSession };
