const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
  description: { type: String, trim: true }
});

const journalEntrySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null }, // Optional if tenant-wide
    date: { type: Date, required: true, index: true },
    reference: { type: String, trim: true }, // e.g. "Order #1024", "Invoice #SUP-001"
    referenceModel: { type: String, enum: ['Order', 'Bill', 'PayrollRun', 'Manual'] },
    description: { type: String, trim: true },
    lines: {
      type: [journalLineSchema],
      validate: [
        (v) => v.length >= 2,
        'Journal entry must contain at least 2 lines'
      ]
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

// Pre-save validation: Debits must equal Credits
journalEntrySchema.pre('save', function (next) {
  const sumDebits = this.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const sumCredits = this.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  
  // Use epsilon check for floats to avoid floating-point issues
  if (Math.abs(sumDebits - sumCredits) > 0.01) {
    return next(new Error(`Double-entry check failed: Total Debits (${sumDebits}) must equal Total Credits (${sumCredits})`));
  }
  next();
});

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
