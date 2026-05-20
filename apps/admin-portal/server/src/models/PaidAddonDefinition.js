const mongoose = require('mongoose');

/**
 * Super-admin configurable paid add-ons (e.g. guest QR ordering).
 * Prices are per billing cycle unit (monthly vs yearly plan).
 */
const paidAddonDefinitionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    /** Shown in merchant purchase modal */
    shortDescription: { type: String, default: '', trim: true },
    /** Longer HTML-safe text (line breaks preserved) */
    longDescription: { type: String, default: '', trim: true },
    /** Public URLs for preview screenshots (merchant purchase modal) */
    screenshotUrls: { type: [String], default: [] },
    /** Added when merchant is on a monthly-billed plan */
    monthlyAmount: { type: Number, required: true, min: 0 },
    /** Added when merchant is on a yearly-billed plan (falls back to monthly×12 if 0) */
    yearlyAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'LKR', trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PaidAddonDefinition', paidAddonDefinitionSchema);
