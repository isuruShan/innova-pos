const mongoose = require('mongoose');

const orderComboItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  category: { type: String, default: '', trim: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  isCombo: { type: Boolean, default: false },
  comboItems: { type: [orderComboItemSchema], default: [] },
  deliveredToTable: { type: Boolean, default: false },
  kitchenNew: { type: Boolean, default: false },
  kitchenPendingQty: { type: Number, default: null },
});

const orderSchema = new mongoose.Schema(
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
    orderNumber: { type: Number },
    orderType: {
      type: String,
      enum: ['dine-in', 'takeaway', 'uber-eats', 'pickme'],
      default: 'dine-in',
    },
    tableNumber: { type: String, default: '' },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'CafeTable', default: null, index: true },
    reference: { type: String, default: '' },
    items: [orderItemSchema],
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
      default: 'pending',
    },
    kitchenAddsStatus: { type: String, default: null },
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    appliedPromotions: [{
      promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
      name: { type: String },
      type: { type: String },
      discountAmount: { type: Number, default: 0 },
    }],
    appliedAutomaticLoyalty: [{
      reward: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyReward' },
      name: { type: String, default: '' },
      discountAmount: { type: Number, default: 0 },
    }],
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    serviceFeeRate: { type: Number, default: 0 },
    serviceFeeFixed: { type: Number, default: 0 },
    serviceFeeType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
    serviceFeeAmount: { type: Number, default: 0 },
    paymentType: { type: String, default: 'cash' },
    paymentAmount: { type: Number, default: 0 },
    paymentCollected: { type: Boolean, default: true },
    totalAmount: { type: Number, required: true },
    orderSource: { type: String, enum: ['pos', 'qr'], default: 'pos' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    loyaltyPointsEarned: { type: Number, default: 0, min: 0 },
    loyaltyRedemption: {
      reward: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyReward', default: null },
      name: { type: String, default: '' },
      pointsCost: { type: Number, default: 0, min: 0 },
      discountAmount: { type: Number, default: 0, min: 0 },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    clientRequestId: { type: String, default: null },
  },
  { timestamps: true },
);

orderSchema.pre('save', async function () {
  if (this.isNew) {
    const Order = this.constructor;
    const last = await Order.findOne({ tenantId: this.tenantId }).sort({ orderNumber: -1 });
    this.orderNumber = last ? last.orderNumber + 1 : 1;
  }
});

orderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ tenantId: 1, storeId: 1, status: 1 });
orderSchema.index({ tenantId: 1, status: 1 });
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, storeId: 1, tableId: 1, status: 1 });
orderSchema.index(
  { tenantId: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientRequestId: { $gt: '' } },
  },
);

module.exports = mongoose.model('Order', orderSchema);
