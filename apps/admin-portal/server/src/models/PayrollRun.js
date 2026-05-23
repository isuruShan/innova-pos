const mongoose = require('mongoose');

const slipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName: String,
  basicSalary: { type: Number, required: true },
  allowances: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  taxWithheld: { type: Number, default: 0 },
  netPay: { type: Number, required: true }
});

const payrollRunSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
    slips: [slipSchema],
    paidAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

payrollRunSchema.index({ tenantId: 1, storeId: 1, month: 1, year: 1 }, { unique: true });
module.exports = mongoose.model('PayrollRun', payrollRunSchema);
