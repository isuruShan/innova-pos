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
    deactivatedBySuperadmin: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    /** When true, dine-in orders pick configured tables; tables are locked while an order is active */
    tableManagementEnabled: { type: Boolean, default: false },
    guestWaiterCallCooldownSeconds: { type: Number, default: 300, min: 30, max: 3600 },
    /** POS cashier screen layout: 'default' = standard card grid, 'compact' = small square grid with 1/3 cart */
    posMenuLayout: { type: String, enum: ['default', 'compact'], default: 'default' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

storeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
storeSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('Store', storeSchema);
