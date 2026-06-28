const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    storeType: { type: String, enum: ['Store', 'CentralKitchen'], default: 'Store', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, refPath: 'storeType', default: null, index: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

supplierSchema.index({ tenantId: 1, name: 1 });
supplierSchema.index({ tenantId: 1, storeId: 1, name: 1 });

supplierSchema.pre('save', async function (next) {
  if (this.isModified('storeId') && this.storeId) {
    const Store = mongoose.model('Store');
    const store = await Store.findById(this.storeId).select('_id');
    this.storeType = store ? 'Store' : 'CentralKitchen';
  }
  next();
});

module.exports = mongoose.model('Supplier', supplierSchema);
