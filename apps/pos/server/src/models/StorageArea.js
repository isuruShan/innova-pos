const mongoose = require('mongoose');

const storageAreaSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

storageAreaSchema.index({ tenantId: 1, storeId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('StorageArea', storageAreaSchema);
