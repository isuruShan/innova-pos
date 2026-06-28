const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const centralKitchenSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, default: 'Central Kitchen' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CentralKitchen', centralKitchenSchema);
