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
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    images: { type: [menuItemImageSchema], default: [] },
    image: { type: String, default: '' },
    imageKey: { type: String, default: '' },
    available: { type: Boolean, default: true },
    isCombo: { type: Boolean, default: false },
    comboItems: { type: [comboItemSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

menuItemSchema.index({ tenantId: 1, available: 1 });
menuItemSchema.index({ tenantId: 1, category: 1 });
menuItemSchema.index({ tenantId: 1, storeId: 1, category: 1, available: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
