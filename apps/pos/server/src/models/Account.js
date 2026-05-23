const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    code: { type: String, required: true, trim: true }, // e.g. "1000", "4000"
    name: { type: String, required: true, trim: true }, // e.g. "Petty Cash", "Sales Revenue"
    type: { 
      type: String, 
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'], 
      required: true 
    },
    parentAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    isSystem: { type: Boolean, default: false }, // Cannot be deleted
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
module.exports = mongoose.model('Account', accountSchema);
