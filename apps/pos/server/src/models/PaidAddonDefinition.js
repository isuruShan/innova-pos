const mongoose = require('mongoose');

const paidAddonDefinitionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaidAddonDefinition', paidAddonDefinitionSchema);
