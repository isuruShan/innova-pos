const Order = require('../models/Order');
const Inventory = require('../models/Inventory');
const IngredientLink = require('../models/IngredientLink');
const StockMovement = require('../models/StockMovement');
const Tenant = require('../models/Tenant');
const { entitlementKeyForCode, isPaidAddonEffective } = require('@innovapos/paid-addons');

/**
 * Recursively resolves inventory consumption down to raw ingredients,
 * applying unit conversions (recipeUnit -> storageUnit).
 */
async function resolveAdvancedConsumption(tenantId, itemId, targetQty, depth = 0) {
  if (depth > 5) return []; // Limit depth to prevent infinite loops

  const item = await Inventory.findOne({ _id: itemId, tenantId }).lean();
  if (!item) return [];

  // 1. Raw Materials: base case, convert recipeUnit to storageUnit
  if (item.itemType === 'raw') {
    const storageToRecipe = item.storageToRecipeMultiplier || 1;
    const storageQty = targetQty / storageToRecipe;
    return [{
      inventoryItemId: item._id,
      quantity: storageQty, // in storageUnit
      unit: item.storageUnit || item.unit,
    }];
  }

  // 2. Prep Items: sub-recipe base case, resolve recursively
  if (item.itemType === 'prep' && item.recipe && item.recipe.length > 0) {
    let resolved = [];
    for (const sub of item.recipe) {
      // sub.quantity is in recipeUnit of the child ingredient
      const subTotalQty = sub.quantity * targetQty * (1 + (sub.wastagePercentage || 0) / 100);
      const subResolved = await resolveAdvancedConsumption(tenantId, sub.inventoryItemId, subTotalQty, depth + 1);
      resolved = resolved.concat(subResolved);
    }
    return resolved;
  }

  // Fallback
  const storageToRecipe = item.storageToRecipeMultiplier || 1;
  const storageQty = targetQty / storageToRecipe;
  return [{
    inventoryItemId: item._id,
    quantity: storageQty,
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

    // Gate stock consumption behind Advanced Inventory paid addon subscription
    const tenant = await Tenant.findById(tenantId)
      .select('paidAddons assignedPlanId')
      .populate('assignedPlanId')
      .lean();
    if (!tenant || !isPaidAddonEffective(tenant, entitlementKeyForCode('advanced_inventory'))) {
      return;
    }

    // Check if we already processed consumption for this order to prevent double deduction
    const existing = await StockMovement.exists({ orderId, type: 'sale' });
    if (existing) return;

    for (const item of order.items) {
      const menuItemId = item.menuItem;
      const variantId = item.variantId || null;

      // 1. Gather all recipe links for this line item (base recipe + modifier recipes)
      const allResolvedLinks = [];

      // A. Base item links (must have modifierId = null)
      let baseLinks = await IngredientLink.find({
        tenantId,
        menuItemId,
        variantId,
        modifierId: null
      }).lean();

      if (baseLinks.length === 0 && variantId) {
        baseLinks = await IngredientLink.find({
          tenantId,
          menuItemId,
          variantId: null,
          modifierId: null
        }).lean();
      }

      // Add base links to resolved links list
      for (const link of baseLinks) {
        allResolvedLinks.push({ link, multiplier: 1 });
      }

      // B. Modifier specific links
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modifierId = mod.modifierId;
          
          let modLinks = await IngredientLink.find({
            tenantId,
            menuItemId,
            variantId,
            modifierId
          }).lean();

          if (modLinks.length === 0 && variantId) {
            modLinks = await IngredientLink.find({
              tenantId,
              menuItemId,
              variantId: null,
              modifierId
            }).lean();
          }

          if (modLinks.length === 0) {
            modLinks = await IngredientLink.find({
              tenantId,
              menuItemId: null,
              variantId: null,
              modifierId
            }).lean();
          }

          for (const link of modLinks) {
            allResolvedLinks.push({ link, multiplier: mod.qty || 1 });
          }
        }
      }

      // 2. Deduct inventory for all gathered links recursively
      for (const { link, multiplier } of allResolvedLinks) {
        const inventoryItemId = link.inventoryItemId;

        // Base recipe quantity for this sale item (link.quantity is in recipeUnit of the linked inventory item)
        const baseRecipeQty = link.quantity * multiplier * item.qty;
        const totalRecipeQty = baseRecipeQty * (1 + (link.wastagePercentage || 0) / 100);

        if (totalRecipeQty <= 0) continue;

        // Recursively explode the recipe
        const explodedConsumptions = await resolveAdvancedConsumption(tenantId, inventoryItemId, totalRecipeQty);

        for (const cons of explodedConsumptions) {
          const invItem = await Inventory.findOne({ _id: cons.inventoryItemId, tenantId });
          if (!invItem) continue;

          const previousQty = invItem.quantity;
          const totalQty = cons.quantity; // in storageUnit

          invItem.quantity = Math.max(0, previousQty - totalQty);
          await invItem.save();

          const saleMovement = new StockMovement({
            tenantId,
            storeId,
            inventoryItemId: cons.inventoryItemId,
            type: 'sale',
            quantity: -totalQty,
            previousQty,
            newQty: previousQty - totalQty,
            reason: 'sale',
            notes: `Auto sale deduction for Order #${order.orderNumber || order._id}`,
            orderId: order._id,
            createdBy: userId || order.createdBy || order._id
          });
          await saleMovement.save();
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
