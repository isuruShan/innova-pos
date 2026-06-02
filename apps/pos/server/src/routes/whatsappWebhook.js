'use strict';

const express = require('express');
const mongoose = require('mongoose');
const WhatsAppClient = require('../services/whatsappClient');
const { isWhatsappEffective } = require('@innovapos/paid-addons');

const router = express.Router();

// Mock/helper helper to send interactive button messages back to WhatsApp
async function sendWhatsAppMessage(accessToken, phoneNumberId, recipientPhone, payload) {
  try {
    await WhatsAppClient.postMessage(accessToken, phoneNumberId, recipientPhone, payload);
  } catch (err) {
    console.error('[WhatsApp Send Message Error]:', err.response?.data || err.message);
  }
}

/**
 * GET: Webhook verification handshake
 */
router.get('/', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'innovapos_verify_token';
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Verification successful.');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ message: 'Forbidden' });
});

/**
 * POST: Incoming messages/events
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') {
      return res.status(404).json({ message: 'Invalid object type' });
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const metadata = value?.metadata;
    const message = value?.messages?.[0];
    
    if (!message || !metadata) {
      return res.json({ status: 'ignored' });
    }

    const phoneNumberId = metadata.phone_number_id;
    const customerPhone = message.from;

    const Store = mongoose.model('Store');
    const Tenant = mongoose.model('Tenant');
    const Order = mongoose.model('Order');

    // 1. Resolve store by WhatsApp phone number ID
    const store = await Store.findOne({ 
      'whatsappSettings.phoneNumberId': phoneNumberId,
      isActive: true 
    }).lean();

    if (!store) {
      console.error(`[WhatsApp Webhook Error] Store not found for Phone ID: ${phoneNumberId}`);
      return res.status(404).json({ message: 'Store not found' });
    }

    // 2. Resolve tenant and check paid entitlement
    const tenant = await Tenant.findById(store.tenantId).select('paidAddons').lean();
    if (!tenant || !isWhatsappEffective(tenant.paidAddons)) {
      console.warn(`[WhatsApp Gating Alert] Tenant ${store.tenantId} attempting WhatsApp order without subscription.`);
      return res.status(402).json({ message: 'WhatsApp integration paid add-on is required' });
    }

    const accessToken = store.whatsappSettings.accessToken;

    // 3. Handle incoming message events
    // Case A: Customer sends a Catalog Cart
    if (message.type === 'order') {
      const orderData = message.order; // Cart contents (items, quantities)
      
      // Cache this cart temporarily or save state (simulate in webhook logs)
      console.log(`[WhatsApp Webhook] Received cart from ${customerPhone}:`, orderData);

      // Respond with interactive order method choice
      await sendWhatsAppMessage(accessToken, phoneNumberId, customerPhone, {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'How would you like to receive your order?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'method_pickup', title: 'Pickup/Takeaway' } },
              { type: 'reply', reply: { id: 'method_delivery', title: 'Delivery' } }
            ]
          }
        }
      });

      return res.json({ status: 'processing_cart' });
    }

    // Case B: Customer clicks a button reply
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      const replyId = message.interactive.button_reply.id;

      if (replyId === 'method_pickup') {
        // Create draft Pickup Order (takeaway)
        const order = new Order({
          tenantId: store.tenantId,
          storeId: store._id,
          orderType: 'takeaway',
          orderSource: 'whatsapp',
          whatsappPhone: customerPhone,
          status: 'pending',
          paymentCollected: false,
          totalAmount: 1200, // Hardcoded simulation, resolved from cart in prod
          items: [
            {
              menuItem: new mongoose.Types.ObjectId(), // Simulated menu item ID
              name: 'WhatsApp Standard Combo',
              qty: 1,
              price: 1200
            }
          ]
        });

        await order.save();

        await sendWhatsAppMessage(accessToken, phoneNumberId, customerPhone, {
          type: 'text',
          text: { body: `Great! Your pickup order has been placed. Order ID: #${order.orderNumber}. We will update you when it is ready.` }
        });

        return res.json({ status: 'order_created' });
      }

      if (replyId === 'method_delivery') {
        // Send address collection message
        await sendWhatsAppMessage(accessToken, phoneNumberId, customerPhone, {
          type: 'text',
          text: { body: 'Please reply with your delivery address to complete your order.' }
        });
        return res.json({ status: 'awaiting_address' });
      }
    }

    // Case C: Standard text message (usually address input or order scheduling requests)
    if (message.type === 'text') {
      const textBody = message.text.body;

      // Check if this is a delivery address (heuristic: length > 10 and we assume it's an address)
      if (textBody.length > 10) {
        // Create Delivery Order
        const order = new Order({
          tenantId: store.tenantId,
          storeId: store._id,
          orderType: 'delivery',
          orderSource: 'whatsapp',
          whatsappPhone: customerPhone,
          status: 'pending',
          paymentCollected: false,
          totalAmount: 1500, // Cart total + simulated delivery fee
          deliveryDetails: {
            address: textBody,
            deliveryFee: 300
          },
          items: [
            {
              menuItem: new mongoose.Types.ObjectId(), // Simulated menu item ID
              name: 'WhatsApp Standard Combo',
              qty: 1,
              price: 1200
            }
          ]
        });

        // Check if there is an order scheduling parameter (mock keyword: "schedule for tomorrow")
        if (textBody.toLowerCase().includes('schedule')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(12, 0, 0, 0); // Schedule for 12:00 PM tomorrow
          order.scheduledFor = tomorrow;
        }

        await order.save();

        const scheduleMsg = order.scheduledFor 
          ? `scheduled for ${order.scheduledFor.toLocaleString()}` 
          : 'placed';

        await sendWhatsAppMessage(accessToken, phoneNumberId, customerPhone, {
          type: 'text',
          text: { body: `Thank you! Your delivery order has been ${scheduleMsg}. Order ID: #${order.orderNumber}. We will update you as it progresses.` }
        });

        return res.json({ status: 'delivery_order_created' });
      }
    }

    return res.json({ status: 'unhandled_event' });
  } catch (err) {
    console.error('[WhatsApp Webhook Outer Error]:', err.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
