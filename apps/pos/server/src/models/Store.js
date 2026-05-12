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
    address: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    paymentMethods: { type: [String], default: ['cash'] },
    isActive: { type: Boolean, default: true },
    deactivatedBySuperadmin: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    /** When true, dine-in orders pick configured tables; tables are locked while an order is active */
    tableManagementEnabled: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

storeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
storeSchema.index({ tenantId: 1, name: 1 });

module.exports = mongoose.model('Store', storeSchema);
