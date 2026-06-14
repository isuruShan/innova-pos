const GoodsReceipt = require('../models/GoodsReceipt');
const Inventory = require('../models/Inventory');

/**
 * Recalculates unit costs (FIFO, LIFO, WAC, Last Cost) for one or more inventory items
 * based on their confirmed goods receipt history.
 * 
 * @param {string} tenantId 
 * @param {string} storeId 
 * @param {string|string[]} inventoryItemIds 
 */
async function recalculateInventoryCosts(tenantId, storeId, inventoryItemIds) {
  try {
    const itemIds = Array.isArray(inventoryItemIds) ? inventoryItemIds : [inventoryItemIds];
    if (itemIds.length === 0) return;

    // Fetch all confirmed receipts containing these items, sorted oldest to newest
    const grns = await GoodsReceipt.find({
      tenantId,
      storeId,
      type: 'receipt',
      status: 'confirmed',
      'items.inventoryItemId': { $in: itemIds },
    }).sort({ confirmedAt: 1, createdAt: 1 });

    for (const itemId of itemIds) {
      const inventoryItem = await Inventory.findOne({ _id: itemId, tenantId, storeId });
      if (!inventoryItem) continue;

      const Q = inventoryItem.quantity || 0;

      // Extract all receipt entries for this specific item
      const receipts = [];
      for (const grn of grns) {
        const itemMatch = grn.items.find(it => String(it.inventoryItemId) === String(itemId));
        if (itemMatch && itemMatch.acceptedQty > 0) {
          receipts.push({
            qty: itemMatch.acceptedQty,
            price: itemMatch.unitPrice || 0,
            date: grn.confirmedAt || grn.createdAt,
          });
        }
      }

      if (receipts.length === 0) {
        // If no receipts, reset costing to 0 (or keep default)
        inventoryItem.lastCost = 0;
        inventoryItem.wacCost = 0;
        inventoryItem.fifoCost = 0;
        inventoryItem.lifoCost = 0;
      } else {
        // 1. Last Cost
        const lastReceipt = receipts[receipts.length - 1];
        const lastCost = lastReceipt.price;

        // 2. Weighted Average Cost (WAC)
        let totalQty = 0;
        let totalCost = 0;
        for (const r of receipts) {
          totalQty += r.qty;
          totalCost += r.qty * r.price;
        }
        const wacCost = totalQty > 0 ? totalCost / totalQty : 0;

        // 3. FIFO Cost (Accumulate from newest receipts backwards)
        let fifoRemainingQty = Q;
        let fifoTotalVal = 0;
        for (let i = receipts.length - 1; i >= 0; i--) {
          if (fifoRemainingQty <= 0) break;
          const r = receipts[i];
          const takeQty = Math.min(fifoRemainingQty, r.qty);
          fifoTotalVal += takeQty * r.price;
          fifoRemainingQty -= takeQty;
        }
        // If stock Q exceeds total receipt qty, value the remainder at the oldest receipt price
        if (fifoRemainingQty > 0 && receipts.length > 0) {
          fifoTotalVal += fifoRemainingQty * receipts[0].price;
        }
        const fifoCost = Q > 0 ? fifoTotalVal / Q : lastCost;

        // 4. LIFO Cost (Accumulate from oldest receipts forwards)
        let lifoRemainingQty = Q;
        let lifoTotalVal = 0;
        for (let i = 0; i < receipts.length; i++) {
          if (lifoRemainingQty <= 0) break;
          const r = receipts[i];
          const takeQty = Math.min(lifoRemainingQty, r.qty);
          lifoTotalVal += takeQty * r.price;
          lifoRemainingQty -= takeQty;
        }
        // If stock Q exceeds total receipt qty, value the remainder at the newest receipt price
        if (lifoRemainingQty > 0 && receipts.length > 0) {
          lifoTotalVal += lifoRemainingQty * receipts[receipts.length - 1].price;
        }
        const lifoCost = Q > 0 ? lifoTotalVal / Q : lastCost;

        // Save values
        inventoryItem.lastCost = Number(lastCost.toFixed(2));
        inventoryItem.wacCost = Number(wacCost.toFixed(2));
        inventoryItem.fifoCost = Number(fifoCost.toFixed(2));
        inventoryItem.lifoCost = Number(lifoCost.toFixed(2));
      }

      inventoryItem.lastUpdated = new Date();
      await inventoryItem.save();
    }
  } catch (error) {
    console.error('Error recalculating inventory costs:', error);
  }
}

module.exports = {
  recalculateInventoryCosts,
};
