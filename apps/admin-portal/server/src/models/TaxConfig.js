const mongoose = require('mongoose');

const taxConfigSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true }, // e.g. "VAT 15%"
    rate: { type: Number, required: true }, // e.g. 15 for 15%
    type: { type: String, enum: ['sales', 'purchase', 'custom'], default: 'sales' },
    receivableAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true }, // Tax Payable Account
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('TaxConfig', taxConfigSchema);
