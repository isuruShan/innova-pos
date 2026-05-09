const mongoose = require('mongoose');

const taxComponentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  rate: { type: Number, required: true, min: 0, max: 100 },
  isCompound: { type: Boolean, default: false },
}, { _id: false });

const orderTypeSettingSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  label: { type: String, default: '' },
  taxComponents: { type: [taxComponentSchema], default: [] },
  serviceFeeType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
  serviceFeeRate: { type: Number, default: 0, min: 0, max: 100 },
  serviceFeeFixed: { type: Number, default: 0, min: 0 },
  serviceFeeLabel: { type: String, default: 'Service Fee' },
}, { _id: false });

const settingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    orderTypes: {
      'dine-in': { type: orderTypeSettingSchema, default: () => ({}) },
      takeaway: { type: orderTypeSettingSchema, default: () => ({}) },
      'uber-eats': { type: orderTypeSettingSchema, default: () => ({}) },
      pickme: { type: orderTypeSettingSchema, default: () => ({}) },
    },
    currency: { type: String, default: 'LKR' },
    currencySymbol: { type: String, default: 'Rs.' },
    timezone: { type: String, default: 'Asia/Colombo' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
