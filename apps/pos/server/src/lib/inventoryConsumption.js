const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const IngredientLink = require('../models/IngredientLink');
const StockMovement = require('../models/StockMovement');
const Tenant = require('../models/Tenant');
const { entitlementKeyForCode, isPaidAddonEffective } = require('@innovapos/paid-addons');

/**
 * Recursively resolves inventory consumption down to raw ingredients,
 * applying unit conversions (recipeUnit -> storageUnit).
 * Uses a shared cache to avoid repeated DB hits for the same inventory item.
 */
async function resolveAdvancedConsumption(tenantId, itemId, targetQty, depth = 0, cache = new Map()) {
  if (depth > 5) return [];

  const cacheKey = String(itemId);
  let item = cache.get(cacheKey);
  if (!item) {
    item = await Inventory.findOne({ _id: itemId, tenantId }).lean();
    if (item) cache.set(cacheKey, item);
  }
  if (!item) return [];

  if (item.itemType === 'raw') {
    const storageToRecipe = item.storageToRecipeMultiplier || 1;
    return [{
      inventoryItemId: item._id,
      quantity: targetQty / storageToRecipe,
      unit: item.storageUnit || item.unit,
    }];
  }

  if (item.itemType === 'prep' && item.recipe && item.recipe.length > 0) {
    let resolved = [];
    for (const sub of item.recipe) {
      const subTotalQty = sub.quantity * targetQty * (1 + (sub.wastagePercentage || 0) / 100);
      const subResolved = await resolveAdvancedConsumption(tenantId, sub.inventoryItemId, subTotalQty, depth + 1, cache);
      resolved = resolved.concat(subResolved);
    }
    return resolved;
  }

  const storageToRecipe = item.storageToRecipeMultiplier || 1;
  return [{
    inventoryItemId: item._id,
    quantity: targetQty / storageToRecipe,
    unit: item.storageUnit || item.unit,
  }];
}

/**
 * Deducts ingredient stock levels based on MenuItem recipes when an order is completed.
 * Recursively resolves prep/sub-recipes and applies unit conversions.
 */
async function consumeInventoryForOrder(orderId, userId) {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) return;

    const tenantId = order.tenantId;
    const storeId = order.storeId;

    const tenant = await Tenant.findById(tenantId)
      .select('paidAddons assignedPlanId')
      .populate('assignedPlanId')
      .lean();
    if (!tenant || !isPaidAddonEffective(tenant, entitlementKeyForCode('advanced_inventory'))) return;

    const existing = await StockMovement.exists({ orderId, type: 'sale' });
    if (existing) return;

    // Batch-fetch ALL ingredient links for this order in one query
    const menuItemIds = [...new Set(order.items.map(i => i.menuItem))];
    const modifierIds = [
      ...new Set(order.items.flatMap(i => (i.modifiers || []).map(m => m.modifierId))),
    ];

    const allLinks = await IngredientLink.find({
      tenantId,
      $or: [
        { menuItemId: { $in: menuItemIds } },
        ...(modifierIds.length > 0 ? [{ menuItemId: null, modifierId: { $in: modifierIds } }] : []),
      ],
    }).lean();

    // Index links: key = `${menuItemId}|${variantId}|${modifierId}` for O(1) lookup
    const linkMap = new Map();
    for (const link of allLinks) {
      const key = `${link.menuItemId}|${link.variantId}|${link.modifierId}`;
      if (!linkMap.has(key)) linkMap.set(key, []);
      linkMap.get(key).push(link);
    }

    const getLinks = (menuItemId, variantId, modifierId) => {
      const k1 = `${menuItemId}|${variantId}|${modifierId}`;
      const r1 = linkMap.get(k1);
      if (r1 && r1.length > 0) return r1;
      if (variantId) {
        const k2 = `${menuItemId}|null|${modifierId}`;
        const r2 = linkMap.get(k2);
        if (r2 && r2.length > 0) return r2;
      }
      if (modifierId) {
        const k3 = `null|null|${modifierId}`;
        const r3 = linkMap.get(k3);
        if (r3 && r3.length > 0) return r3;
      }
      return [];
    };

    // Resolve all consumptions, sharing inventory cache across recursive calls
    const inventoryCache = new Map();
    const pendingConsumptions = [];

    for (const item of order.items) {
      const menuItemId = item.menuItem;
      const variantId = item.variantId || null;

      const allResolvedLinks = [];

      for (const link of getLinks(menuItemId, variantId, null)) {
        allResolvedLinks.push({ link, multiplier: 1 });
      }

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          for (const link of getLinks(menuItemId, variantId, mod.modifierId)) {
            allResolvedLinks.push({ link, multiplier: mod.qty || 1 });
          }
        }
      }

      for (const { link, multiplier } of allResolvedLinks) {
        const baseRecipeQty = link.quantity * multiplier * item.qty;
        const totalRecipeQty = baseRecipeQty * (1 + (link.wastagePercentage || 0) / 100);
        if (totalRecipeQty <= 0) continue;

        const exploded = await resolveAdvancedConsumption(tenantId, link.inventoryItemId, totalRecipeQty, 0, inventoryCache);
        pendingConsumptions.push(...exploded);
      }
    }

    if (pendingConsumptions.length === 0) return;

    // Aggregate by inventoryItemId to minimise save calls when same item consumed multiple times
    const consumptionMap = new Map();
    for (const cons of pendingConsumptions) {
      const key = String(cons.inventoryItemId);
      if (!consumptionMap.has(key)) {
        consumptionMap.set(key, { inventoryItemId: cons.inventoryItemId, quantity: 0, unit: cons.unit });
      }
      consumptionMap.get(key).quantity += cons.quantity;
    }

    // Batch-fetch mutable inventory documents for saving
    const uniqueIds = [...consumptionMap.keys()];
    const invDocs = await Inventory.find({ _id: { $in: uniqueIds }, tenantId });
    const invDocMap = new Map(invDocs.map(d => [String(d._id), d]));

    for (const [idStr, cons] of consumptionMap) {
      const invItem = invDocMap.get(idStr);
      if (!invItem) continue;

      const previousQty = invItem.quantity;
      const totalQty = cons.quantity;

      invItem.quantity = Math.max(0, previousQty - totalQty);
      await invItem.save();

      await new StockMovement({
        tenantId,
        storeId,
        inventoryItemId: cons.inventoryItemId,
        type: 'sale',
        quantity: -totalQty,
        previousQty,
        newQty: invItem.quantity,
        reason: 'sale',
        notes: `Auto sale deduction for Order #${order.orderNumber || order._id}`,
        orderId: order._id,
        createdBy: userId || order.createdBy || order._id,
      }).save();
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
    const movements = await StockMovement.find({ orderId, type: 'sale' }).lean();
    if (movements.length === 0) return;

    // Aggregate reversals per item to avoid multiple saves for the same document
    const reversalMap = new Map();
    for (const m of movements) {
      const key = String(m.inventoryItemId);
      if (!reversalMap.has(key)) {
        reversalMap.set(key, { inventoryItemId: m.inventoryItemId, tenantId: m.tenantId, absQty: 0 });
      }
      reversalMap.get(key).absQty += Math.abs(m.quantity);
    }

    // Batch-fetch mutable inventory documents
    const ids = [...reversalMap.keys()];
    const invDocs = await Inventory.find({ _id: { $in: ids } });
    const invDocMap = new Map(invDocs.map(d => [String(d._id), d]));

    for (const [idStr, rev] of reversalMap) {
      const invItem = invDocMap.get(idStr);
      if (!invItem) continue;
      invItem.quantity = invItem.quantity + rev.absQty;
      await invItem.save();
    }

    await StockMovement.deleteMany({ orderId });
  } catch (err) {
    console.error(`[Inventory Reversal Error] Failed for order ${orderId}:`, err);
  }
}

module.exports = {
  consumeInventoryForOrder,
  reverseInventoryForOrder,
};
