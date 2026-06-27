const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    itemName: { type: String, required: true, trim: true },
    
    // Legacy support (fallback)
    unit: { type: String, required: true, trim: true },
    
    // Advanced Unit Configuration
    purchaseUnit: { type: String, default: '' },
    storageUnit: { type: String, default: '' },
    recipeUnit: { type: String, default: '' },
    purchaseToStorageMultiplier: { type: Number, default: 1 },
    storageToRecipeMultiplier: { type: Number, default: 1 },
    
    itemType: {
      type: String,
      enum: ['raw', 'prep'],
      default: 'raw',
      required: true,
    },
    
    // Sub-recipe structure if itemType === 'prep'
    recipe: [
      {
        inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
        quantity: { type: Number, required: true },
        wastagePercentage: { type: Number, default: 0 },
      }
    ],

    quantity: { type: Number, required: true, min: 0 },
    minThreshold: { type: Number, required: true, min: 0 },
    suppliers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryCategory',
      default: null,
      index: true,
    },
    
    // Storage Areas shelf organization
    storageAreas: [{ type: String }],
    
    // Supplier Catalog details
    supplierCatalog: [
      {
        supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
        supplierItemCode: { type: String, default: '' },
        packSize: { type: String, default: '' }, // e.g., "Box of 12"
        purchasePrice: { type: Number, default: 0 },
        moq: { type: Number, default: 1 },
      }
    ],

    lastCost: { type: Number, default: 0 },
    wacCost: { type: Number, default: 0 },
    fifoCost: { type: Number, default: 0 },
    lifoCost: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

inventorySchema.index({ tenantId: 1, itemName: 1 });
inventorySchema.index({ tenantId: 1, storeId: 1, itemName: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
