const mongoose = require('mongoose');

const bundleItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  name: { type: String, default: '' },
  qty: { type: Number, default: 1, min: 1 },
}, { _id: false });

const changeHistoryEntrySchema = new mongoose.Schema({
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, default: Date.now },
  action: { type: String, enum: ['created', 'updated', 'approved', 'rejected'], required: true },
  previousValues: { type: mongoose.Schema.Types.Mixed },
  newValues: { type: mongoose.Schema.Types.Mixed },
  reason: { type: String, default: '' },
}, { _id: true });

const promotionSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['bundle', 'buyXgetY', 'flatPrice', 'flatDiscount', 'percentageDiscount'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    active: { type: Boolean, default: true },
    /** Manager-submitted promos need merchant admin approval before they apply at checkout */
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    rejectionReason: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },

    bundleItems: [bundleItemSchema],
    bundlePrice: { type: Number, default: 0 },

    buyItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    buyItemName: { type: String, default: '' },
    buyQty: { type: Number, default: 1 },
    buyVariantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    getFreeItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    getFreeItemName: { type: String, default: '' },
    getFreeQty: { type: Number, default: 1 },
    getFreeVariantId: { type: mongoose.Schema.Types.ObjectId, default: null },

    applicableItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' }],
    applicableVariantIds: [{ type: mongoose.Schema.Types.ObjectId, default: null }],
    applicableItemNames: [{ type: String }],
    applicableCategories: [{ type: String }],
    flatPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    maxDiscountAmount: { type: Number, default: null, min: 0 },
    minOrderAmount: { type: Number, default: 0 },
    minTierLevel: { type: Number, default: null, min: 1 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    foodmarketPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodmarketPartner',
      default: null,
      index: true,
    },
    changeHistory: [changeHistoryEntrySchema],
  },
  { timestamps: true }
);

promotionSchema.index({ tenantId: 1, active: 1, endDate: 1 });
promotionSchema.index({ tenantId: 1, storeId: 1, active: 1, endDate: 1 });

module.exports = mongoose.model('Promotion', promotionSchema);
