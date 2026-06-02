const mongoose = require('mongoose');

const comboItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1, default: 1 },
}, { _id: false });

const menuItemImageSchema = new mongoose.Schema(
  {
    url: { type: String, default: '' },
    key: { type: String, default: '' },
  },
  { _id: false },
);

const menuItemSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    price: { type: Number, required: true, min: 0 },
    channelPrices: { type: Map, of: Number, default: () => new Map() },
    description: { type: String, default: '' },
    images: { type: [menuItemImageSchema], default: [] },
    image: { type: String, default: '' },
    imageKey: { type: String, default: '' },
    available: { type: Boolean, default: true },
    isCombo: { type: Boolean, default: false },
    comboItems: { type: [comboItemSchema], default: [] },
    hasVariants: { type: Boolean, default: false },
    variantOptions: {
      type: [{
        name: { type: String, required: true },
        values: { type: [String], default: [] }
      }],
      default: []
    },
    variants: {
      type: [{
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        channelPrices: { type: Map, of: Number, default: () => new Map() },
        description: { type: String, default: '' },
        images: { type: [menuItemImageSchema], default: [] },
        image: { type: String, default: '' },
        imageKey: { type: String, default: '' },
        attributes: {
          type: [{
            name: { type: String, required: true },
            value: { type: String, required: true }
          }],
          default: []
        },
        available: { type: Boolean, default: true }
      }],
      default: []
    },
    whatsappSync: {
      featured: { type: Boolean, default: true, index: true },
      lastSyncedAt: { type: Date, default: null },
      whatsappProductId: { type: String, default: '' }
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

menuItemSchema.index({ tenantId: 1, available: 1 });
menuItemSchema.index({ tenantId: 1, category: 1 });
menuItemSchema.index({ tenantId: 1, storeId: 1, category: 1, available: 1 });
menuItemSchema.index({ tenantId: 1, storeId: 1, category: 1, sortOrder: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
