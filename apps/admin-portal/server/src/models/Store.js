const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        street1: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }),
    },
    phone: { type: String, default: '', trim: true },
    paymentMethods: { type: [String], default: ['cash'] },
    isActive: { type: Boolean, default: true },
    /** When true, only a superadmin may set isActive back to true */
    deactivatedBySuperadmin: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    isCentralKitchen: { type: Boolean, default: false },
    replenishmentModel: { type: String, enum: ['autonomous', 'central_kitchen'], default: 'autonomous' },
    /** When true, dine-in orders pick configured tables; tables are locked while an order is active */
    tableManagementEnabled: { type: Boolean, default: false },
    guestWaiterCallCooldownSeconds: { type: Number, default: 300, min: 30, max: 3600 },
    posMenuLayout: { type: String, enum: ['default', 'compact'], default: 'default' },
    posMenuCols: { type: Number, enum: [4, 5, 6], default: 4 },
    whatsappSettings: {
      phoneNumberId: { type: String, default: '' },
      accessToken: { type: String, default: '' },
      catalogId: { type: String, default: '' },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

storeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
storeSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('Store', storeSchema);
