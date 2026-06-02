'use strict';

const mongoose = require('mongoose');
const { notifyPosStaffOrderStatusChange } = require('../lib/notificationHelpers');

/**
 * Scans the database for scheduled orders that are now due for preparation,
 * activates them, and dispatches customer & POS staff updates.
 */
async function processScheduledOrders(logger) {
  const Order = mongoose.model('Order');
  const now = new Date();

  try {
    // Find orders that are scheduled for now or in the past, and have not been activated yet
    const pendingScheduledOrders = await Order.find({
      status: 'pending',
      scheduledFor: { $ne: null, $lte: now },
      scheduledActivated: { $ne: true }
    });

    if (pendingScheduledOrders.length === 0) {
      return { processedCount: 0 };
    }

    logger.info(`[Order Scheduler] Found ${pendingScheduledOrders.length} scheduled orders due for activation.`);

    let activatedCount = 0;
    for (const order of pendingScheduledOrders) {
      order.scheduledActivated = true;
      await order.save();
      activatedCount++;

      // 1. Notify POS staff so cashier order boards receive real-time additions
      try {
        notifyPosStaffOrderStatusChange(order);
      } catch (err) {
        logger.error(`[Order Scheduler] POS staff notification failed for order #${order.orderNumber}:`, err.message);
      }

      // 2. Notify customer via WhatsApp if that's the order channel
      if (order.orderSource === 'whatsapp') {
        try {
          const { sendOrderStatusNotification } = require('../services/whatsappNotificationService');
          await sendOrderStatusNotification(order, 'preparing');
        } catch (err) {
          logger.error(`[Order Scheduler] WhatsApp customer status alert failed for order #${order.orderNumber}:`, err.message);
        }
      }

      logger.info(`[Order Scheduler] Activated scheduled order #${order.orderNumber} for tenant ${order.tenantId}`);
    }

    return { processedCount: activatedCount };
  } catch (err) {
    logger.error('[Order Scheduler Error]:', {
      error: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = {
  processScheduledOrders
};
