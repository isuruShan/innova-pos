const mongoose = require('mongoose');

/**
 * Links a menu item (or variant) to an inventory item with a usage quantity.
 * When the menu item is sold, this defines how much of the inventory item is consumed.
 */
const ingredientLinkSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
      index: true,
    },
    /** Optional: links to a specific variant. If null, applies to base item or all variants. */
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true,
    },
    /** How much of the inventory item is used per unit sold (e.g., 0.25 for 250ml milk in a latte) */
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Optional wastage percentage for processing loss (e.g., 5 for 5% waste during preparation) */
    wastagePercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Unit override (if different from inventory item's unit). Usually inherited. */
    unit: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Ensure unique link per menu item + variant + inventory item combination
ingredientLinkSchema.index(
  { tenantId: 1, menuItemId: 1, variantId: 1, inventoryItemId: 1 },
  { unique: true }
);

ingredientLinkSchema.index({ tenantId: 1, storeId: 1, menuItemId: 1 });

module.exports = mongoose.model('IngredientLink', ingredientLinkSchema);
