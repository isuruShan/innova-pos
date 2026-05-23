const mongoose = require('mongoose');

const accountingContactSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['debtor', 'creditor'], required: true }, // customer vs supplier
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
    creditLimit: { type: Number, default: 0 }, // For debtors
    outstandingBalance: { type: Number, default: 0 }, // Positive = they owe us (debtor) / we owe them (creditor)
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccountingContact', accountingContactSchema);
