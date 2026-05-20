'use strict';

const axios = require('axios');
const { loadPaymentSettings, paypalCredentials } = require('../platformPaymentConfig');

function apiBase(mode) {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  const doc = await loadPaymentSettings();
  const { clientId, clientSecret, mode } = paypalCredentials(doc);
  if (!clientId || !clientSecret) throw new Error('PayPal is not configured');

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const { data } = await axios.post(
    `${apiBase(mode)}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    },
  );
  return { token: data.access_token, mode };
}

async function createAddonOrder({ tenant, addonCode, amount, currency, description }) {
  const { token, mode } = await getAccessToken();
  const cur = currency || 'LKR';
  const value = Number(amount).toFixed(2);
  const code = String(addonCode || '').trim().toLowerCase();

  const { data } = await axios.post(
    `${apiBase(mode)}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: String(tenant._id),
          custom_id: `${tenant._id}:addon:${code}`,
          amount: {
            currency_code: cur,
            value,
          },
          description: description || `Cafinity add-on: ${code}`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    },
  );

  return { orderId: data.id, mode };
}

async function createOrder({ tenant, plan }) {
  const { token, mode } = await getAccessToken();
  const currency = plan.currency || 'LKR';
  const value = Number(plan.amount).toFixed(2);

  const { data } = await axios.post(
    `${apiBase(mode)}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: String(tenant._id),
          custom_id: `${tenant._id}:${plan._id}`,
          amount: {
            currency_code: currency,
            value,
          },
          description: plan.name || 'Cafinity subscription',
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    },
  );

  return { orderId: data.id, mode };
}

async function captureOrder(orderId) {
  const { token, mode } = await getAccessToken();
  const { data } = await axios.post(
    `${apiBase(mode)}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    },
  );
  return data;
}

module.exports = { createOrder, createAddonOrder, captureOrder, getAccessToken };
