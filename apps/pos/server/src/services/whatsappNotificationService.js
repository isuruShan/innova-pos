'use strict';

const mongoose = require('mongoose');
const WhatsAppClient = require('./whatsappClient');
const { isWhatsappEffective } = require('@innovapos/paid-addons');

/**
 * Sends a template status update notification via Meta's WhatsApp API to the customer.
 * 
 * @param {object} order - Mongoose order document
 * @param {string} status - The next status of the order
 */
async function sendOrderStatusNotification(order, status) {
  try {
    const recipientPhone = order.whatsappPhone;
    if (!recipientPhone) {
      return;
    }

    const Tenant = mongoose.model('Tenant');
    const Store = mongoose.model('Store');

    // 1. Check paid entitlement
    require('../models/SubscriptionPlan');
    const tenant = await Tenant.findById(order.tenantId)
      .select('paidAddons assignedPlanId')
      .populate('assignedPlanId')
      .lean();
    if (!tenant || !isWhatsappEffective(tenant)) {
      return;
    }

    // 2. Resolve store config
    const store = await Store.findById(order.storeId).lean();
    if (!store || !store.whatsappSettings?.phoneNumberId || !store.whatsappSettings?.accessToken) {
      return;
    }

    const { phoneNumberId, accessToken } = store.whatsappSettings;
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    // 3. Resolve template details based on status
    let templateName = '';
    let parameters = [];

    switch (status) {
      case 'preparing':
        templateName = 'order_preparing';
        parameters = [{ type: 'text', text: order.orderNumber.toString() }];
        break;
      case 'ready':
        templateName = 'order_ready';
        const actionType = order.orderType === 'delivery' ? 'dispatched for delivery' : 'ready for pickup';
        parameters = [
          { type: 'text', text: order.orderNumber.toString() },
          { type: 'text', text: actionType }
        ];
        break;
      case 'delivered':
        templateName = 'order_delivered';
        parameters = [{ type: 'text', text: order.orderNumber.toString() }];
        break;
      case 'completed':
        templateName = 'order_completed';
        parameters = [{ type: 'text', text: order.orderNumber.toString() }];
        break;
      default:
        // No templates for other states
        return;
    }

    // 4. Dispatch call to WhatsApp API
    await WhatsAppClient.sendTemplateNotification(
      accessToken,
      phoneNumberId,
      recipientPhone,
      templateName,
      parameters
    );

    console.log(`[WhatsApp Notifications] Dispatched ${templateName} template to ${recipientPhone} for order #${order.orderNumber}.`);
  } catch (err) {
    console.error(`[WhatsApp Notifications Error] Failed to send status alert for order ${order._id}:`, err.response?.data || err.message);
  }
}

module.exports = {
  sendOrderStatusNotification
};
