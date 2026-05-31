'use strict';

const express = require('express');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { uberWebhookAuth } = require('../middleware/uberWebhookAuth');
const { callUberApi, acceptOrder } = require('../services/uberEatsService');
const { notifyCashiersUberEatsOrder } = require('../lib/notificationHelpers');

const router = express.Router();

// Webhook endpoint (unguarded, verified internally via signature middleware)
router.post('/webhook', uberWebhookAuth, (req, res) => {
  const { event_type, resource_id } = req.body;

  // 1. Respond with 200 OK immediately as required by Uber Eats (<5s timeout)
  res.status(200).json({ status: 'received' });

  // 2. Process event asynchronously to prevent blocking
  processWebhookEvent(req.tenant, req.uberStoreId, event_type, resource_id).catch((err) => {
    console.error('[Uber Webhook Error] Processing failed:', err.message);
  });
});

/**
 * Handle Webhook Event Asynchronously
 */
async function processWebhookEvent(tenant, uberStoreId, eventType, resourceId) {
  // Find mapped storeId
  const storeConfig = tenant.paidAddons?.uberEats?.stores?.find(
    (s) => s.uberStoreId === uberStoreId
  );

  if (!storeConfig) {
    console.warn(`[Uber Webhook] Store mapping not found for Uber Store ID: ${uberStoreId}`);
    return;
  }

  const storeId = storeConfig.storeId;

  if (eventType === 'orders.notification') {
    console.log(`[Uber Webhook] New order notification for Uber Order: ${resourceId}`);

    // Create a temporary order reference to fetch from API
    const tempOrderRef = { tenantId: tenant._id, storeId: storeId };
    
    // Fetch full order details from Uber Eats
    const uberOrder = await callUberApi('GET', `/eats/orders/${resourceId}`, tempOrderRef);
    if (!uberOrder) {
      console.warn(`[Uber Webhook] Could not fetch details for Uber Order: ${resourceId}`);
      return;
    }

    // Check if order already exists in our DB (idempotency)
    const existingOrder = await Order.findOne({
      tenantId: tenant._id,
      'uberDetails.uberOrderId': resourceId,
    });
    if (existingOrder) {
      console.log(`[Uber Webhook] Order ${resourceId} already exists in DB. Skipping.`);
      return;
    }

    // Map items from Uber payload
    const mappedItems = [];
    const uberItems = uberOrder.cart?.items || [];

    for (const item of uberItems) {
      // Find matching item in POS by name
      let menuItemDoc = await MenuItem.findOne({
        tenantId: tenant._id,
        name: { $regex: new RegExp(`^${item.title.trim()}$`, 'i') },
        available: true,
      });

      // Placeholder if no item matches
      if (!menuItemDoc) {
        menuItemDoc = await MenuItem.findOne({
          tenantId: tenant._id,
          name: 'Uber Eats Placeholder Item',
        });
      }

      // If placeholder still doesn't exist, create it
      if (!menuItemDoc) {
        menuItemDoc = await MenuItem.create({
          tenantId: tenant._id,
          name: 'Uber Eats Placeholder Item',
          price: 0,
          category: 'Uber Eats',
          available: true,
        });
      }

      mappedItems.push({
        menuItem: menuItemDoc._id,
        name: item.title,
        category: menuItemDoc.category || 'Uber Eats',
        qty: item.quantity || 1,
        price: (item.price || 0) / 100, // convert minor units (cents) to major units
        isCombo: false,
        comboItems: [],
      });
    }

    const subtotal = (uberOrder.payment?.subtotal || 0) / 100;
    const totalAmount = (uberOrder.payment?.total || 0) / 100;

    const FoodmarketPartner = require('../models/FoodmarketPartner');
    let partner = await FoodmarketPartner.findOne({ tenantId: tenant._id, name: { $regex: /uber/i } });
    if (!partner) {
      partner = await FoodmarketPartner.create({
        tenantId: tenant._id,
        name: 'Uber Eats',
        commissionType: 'percentage',
        commissionPercentage: 30,
        commissionFlat: 0,
        isActive: true,
      });
    }

    let commissionAmount = 0;
    if (partner && partner.isActive) {
      const type = partner.commissionType;
      if (type === 'flat' || type === 'both') {
        commissionAmount += partner.commissionFlat || 0;
      }
      if (type === 'percentage' || type === 'both') {
        commissionAmount += (subtotal * (partner.commissionPercentage || 0)) / 100;
      }
      commissionAmount = Math.round(commissionAmount * 100) / 100;
    }

    // Create order document
    const orderDoc = new Order({
      tenantId: tenant._id,
      storeId: storeId,
      orderType: 'uber-eats',
      status: 'pending',
      items: mappedItems,
      subtotal: subtotal,
      totalAmount: totalAmount,
      paymentCollected: true,
      paymentType: 'online',
      reference: `#${uberOrder.display_id || resourceId.slice(0, 5)}`,
      foodmarketPartnerId: partner._id,
      commissionAmount: commissionAmount,
      uberDetails: {
        uberOrderId: resourceId,
        uberDisplayId: uberOrder.display_id || resourceId.slice(0, 5),
        uberStatus: 'new',
        estimatedPrepTime: tenant.paidAddons?.uberEats?.defaultPrepTime || 15,
        riderInfo: {
          name: '',
          phone: '',
          vehicle: '',
          eta: null,
        },
      },
    });

    await orderDoc.save();

    // Auto-Accept logic
    const autoAccept = tenant.paidAddons?.uberEats?.autoAccept === true;
    if (autoAccept) {
      console.log(`[Uber Webhook] Auto-accepting order ${orderDoc.orderNumber}`);
      try {
        await acceptOrder(orderDoc, tenant.paidAddons.uberEats.defaultPrepTime || 15);
      } catch (err) {
        console.error(`[Uber Webhook] Auto-accept failed for order ${orderDoc._id}:`, err.message);
      }
    }

    // Trigger SSE Notification to POS Cashier
    await notifyCashiersUberEatsOrder({
      tenantId: tenant._id,
      storeId: storeId,
      order: orderDoc,
    });

  } else if (eventType === 'orders.cancel') {
    console.log(`[Uber Webhook] Order cancellation received for Uber Order: ${resourceId}`);

    const orderDoc = await Order.findOne({
      tenantId: tenant._id,
      'uberDetails.uberOrderId': resourceId,
    });

    if (!orderDoc) {
      console.warn(`[Uber Webhook] Order not found for cancellation: ${resourceId}`);
      return;
    }

    orderDoc.status = 'cancelled';
    orderDoc.uberDetails.uberStatus = 'cancelled';
    orderDoc.uberDetails.cancelReason = 'Cancelled via Uber Eats Webhook';

    if (!orderDoc.statusHistory) orderDoc.statusHistory = [];
    orderDoc.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      actor: 'uber',
      note: 'Cancelled via Uber webhook',
    });

    await orderDoc.save();

    // Notify cashier
    await notifyCashiersUberEatsOrder({
      tenantId: tenant._id,
      storeId: storeId,
      order: orderDoc,
    });
  }
}

module.exports = router;
