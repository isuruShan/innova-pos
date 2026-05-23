'use strict';

const axios = require('axios');
const { getStoreAccessToken } = require('./uberAuthService');

const UBER_API_BASE_URL = process.env.UBER_EATS_API_BASE_URL || 'https://api.uber.com/v1';

/**
 * Execute an authenticated request to Uber Eats API
 * @param {string} method
 * @param {string} path
 * @param {object} order - Order document
 * @param {object} [body]
 */
async function callUberApi(method, path, order, body = {}) {
  const token = await getStoreAccessToken(order.tenantId, order.storeId);
  const url = `${UBER_API_BASE_URL}${path}`;

  const config = {
    method,
    url,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (method.toLowerCase() !== 'get' && method.toLowerCase() !== 'delete') {
    config.data = body;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error(`[Uber API Error] ${method} ${path} failed:`, errorMsg);
    throw new Error(`Uber API Error: ${errorMsg}`);
  }
}

/**
 * Accept an incoming Uber Eats order
 * @param {object} order - Order document
 * @param {number} prepTime - Estimated prep time in minutes
 */
async function acceptOrder(order, prepTime = 15) {
  if (!order.uberDetails?.uberOrderId) {
    throw new Error('Order does not have a valid Uber Order ID.');
  }

  const path = `/eats/orders/${order.uberDetails.uberOrderId}/accept_pos_order`;
  const body = {
    // Uber expects prep_time_delay_in_seconds or similar structure depending on version
    // Standard is: prep_time_delay_in_seconds
    prep_time_delay_in_seconds: prepTime * 60,
  };

  await callUberApi('POST', path, order, body);

  order.uberDetails.uberStatus = 'accepted';
  order.uberDetails.estimatedPrepTime = prepTime;
  order.status = 'preparing';
  
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'preparing',
    timestamp: new Date(),
    actor: 'cashier',
    note: `Accepted with ${prepTime} min prep time`,
  });

  await order.save();
}

/**
 * Deny an incoming Uber Eats order
 * @param {object} order - Order document
 * @param {string} reason - Deny explanation
 */
async function denyOrder(order, reason = 'OUT_OF_ITEMS') {
  if (!order.uberDetails?.uberOrderId) {
    throw new Error('Order does not have a valid Uber Order ID.');
  }

  const path = `/eats/orders/${order.uberDetails.uberOrderId}/deny_pos_order`;
  const body = {
    reason: {
      explanation: reason,
      // Standard Uber reasons: OUT_OF_ITEMS, KITCHEN_CLOSED, CUSTOMER_REQUEST, etc.
      code: reason.toUpperCase().replace(/\s+/g, '_'),
    },
  };

  await callUberApi('POST', path, order, body);

  order.uberDetails.uberStatus = 'denied';
  order.uberDetails.denyReason = reason;
  order.status = 'cancelled';
  
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    actor: 'cashier',
    note: `Denied: ${reason}`,
  });

  await order.save();
}

/**
 * Mark order as ready for rider pickup
 * @param {object} order - Order document
 */
async function markReady(order) {
  if (!order.uberDetails?.uberOrderId) {
    throw new Error('Order does not have a valid Uber Order ID.');
  }

  const path = `/eats/orders/${order.uberDetails.uberOrderId}/ready_for_pickup`;
  await callUberApi('POST', path, order);

  order.uberDetails.uberStatus = 'ready';
  order.status = 'ready';
  
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'ready',
    timestamp: new Date(),
    actor: 'system',
    note: 'Marked ready for pickup. Notified Uber.',
  });

  await order.save();
}

/**
 * Cancel an active Uber Eats order (merchant-initiated cancel)
 * @param {object} order - Order document
 * @param {string} reason - Cancellation reason
 */
async function cancelOrder(order, reason) {
  if (!order.uberDetails?.uberOrderId) {
    throw new Error('Order does not have a valid Uber Order ID.');
  }

  const path = `/eats/orders/${order.uberDetails.uberOrderId}/cancel`;
  const body = {
    reason: {
      explanation: reason,
      code: 'MERCHANT_CANCELLED',
    },
  };

  await callUberApi('POST', path, order, body);

  order.uberDetails.uberStatus = 'cancelled';
  order.uberDetails.cancelReason = reason;
  order.status = 'cancelled';
  
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    actor: 'cashier',
    note: `Cancelled: ${reason}`,
  });

  await order.save();
}

module.exports = {
  callUberApi,
  acceptOrder,
  denyOrder,
  markReady,
  cancelOrder,
};
