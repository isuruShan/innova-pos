const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const IngredientLink = require('../models/IngredientLink');
const StockMovement = require('../models/StockMovement');

/**
 * Deducts ingredient stock levels based on MenuItem recipes when an order is completed.
 */
async function consumeInventoryForOrder(orderId, userId) {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) return;

    const tenantId = order.tenantId;
    const storeId = order.storeId;

    // Check if we already processed consumption for this order to prevent double deduction
    const existing = await StockMovement.exists({ orderId, type: { $in: ['sale', 'consumption'] } });
    if (existing) return;

    for (const item of order.items) {
      const menuItemId = item.menuItem;
      const variantId = item.variantId || null;

      // Find links (match variant specifically first, otherwise fall back to null)
      let links = await IngredientLink.find({
        tenantId,
        menuItemId,
        variantId
      }).lean();

      if (links.length === 0 && variantId) {
        links = await IngredientLink.find({
          tenantId,
          menuItemId,
          variantId: null
        }).lean();
      }

      for (const link of links) {
        const inventoryItemId = link.inventoryItemId;

        const baseQty = link.quantity * item.qty;
        const wasteQty = baseQty * ((link.wastagePercentage || 0) / 100);
        const totalQty = baseQty + wasteQty;

        if (totalQty <= 0) continue;

        const invItem = await Inventory.findOne({ _id: inventoryItemId, tenantId });
        if (!invItem) continue;

        const previousQty = invItem.quantity;
        invItem.quantity = Math.max(0, previousQty - totalQty);
        await invItem.save();

        const saleMovement = new StockMovement({
          tenantId,
          storeId,
          inventoryItemId,
          type: 'sale',
          quantity: -baseQty,
          previousQty,
          newQty: previousQty - baseQty,
          reason: 'sale',
          orderId: order._id,
          createdBy: userId || order.createdBy || order._id
        });
        await saleMovement.save();

        if (wasteQty > 0) {
          const wasteMovement = new StockMovement({
            tenantId,
            storeId,
            inventoryItemId,
            type: 'waste',
            quantity: -wasteQty,
            previousQty: previousQty - baseQty,
            newQty: previousQty - totalQty,
            reason: 'processing_loss',
            orderId: order._id,
            createdBy: userId || order.createdBy || order._id
          });
          await wasteMovement.save();
        }
      }
    }
  } catch (err) {
    console.error(`[Inventory Consumption Error] Failed for order ${orderId}:`, err);
  }
}

/**
 * Reverts ingredient stock levels if a completed order is cancelled.
 */
async function reverseInventoryForOrder(orderId, userId) {
  try {
    const movements = await StockMovement.find({ orderId });
    if (movements.length === 0) return;

    for (const m of movements) {
      const invItem = await Inventory.findOne({ _id: m.inventoryItemId, tenantId: m.tenantId });
      if (invItem) {
        const absQty = Math.abs(m.quantity);
        const previousQty = invItem.quantity;
        invItem.quantity = previousQty + absQty;
        await invItem.save();
      }
    }

    await StockMovement.deleteMany({ orderId });
  } catch (err) {
    console.error(`[Inventory Reversal Error] Failed for order ${orderId}:`, err);
  }
}

module.exports = {
  consumeInventoryForOrder,
  reverseInventoryForOrder
};
