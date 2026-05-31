const mongoose = require('mongoose');

const tenantSettingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },

    // Branding
    businessName: { type: String, default: '', trim: true },
    tagline: { type: String, default: '', trim: true },
    logoUrl: { type: String, default: '' },
    logoKey: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },

    /** POS theme preset id (see @innovapos/pos-theme-presets) */
    themePresetId: { type: String, default: 'default', trim: true },
    themePresetName: { type: String, default: 'Default / Base', trim: true },
    themeBaseColor: { type: String, default: '#0B1220' },
    bodyColor: { type: String, default: '#0B1220' },
    headerBarColor: { type: String, default: '#151F2E' },
    buttonColor: { type: String, default: '#E94560' },
    selectionHighlightColor: { type: String, default: '#2A3548' },
    hoverColor: { type: String, default: '#F06B82' },
    buttonTextColor: { type: String, default: '#F8FAFC' },
    headerBarTextColor: { type: String, default: '#F8FAFC' },
    bodyTextColor: { type: String, default: '#E2E8F0' },
    // Legacy aliases (kept in sync when applying a preset)
    primaryColor: { type: String, default: '#0B1220' },
    accentColor: { type: String, default: '#e94560' },
    sidebarColor: { type: String, default: '#16213e' },
    textColor: { type: String, default: '#E2E8F0' },
    selectionTextColor: { type: String, default: '#ffffff' },

    // Contact
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: '', trim: true },

    // Payment methods available in POS
    paymentMethods: {
      type: [String],
      default: ['cash'],
    },

    // Currency
    currency: { type: String, default: 'LKR' },
    currencySymbol: { type: String, default: 'Rs.' },
    timezone: { type: String, default: 'Asia/Colombo' },

    // Receipt settings
    receiptHeader: { type: String, default: '' },
    receiptFooter: { type: String, default: 'Thank you for your visit!' },
    printReceiptByDefault: { type: Boolean, default: false },
    /** When POS auto-opens the receipt printer: placement | preparing | ready | completed | none */
    receiptPrintAtStatus: {
      type: String,
      enum: ['placement', 'preparing', 'ready', 'completed', 'none'],
      default: 'placement',
    },
    /** Per order type: when POS auto-prints (placement | preparing | ready | completed | none). */
    receiptPrintAtByOrderType: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /** POS order returns */
    returnsEnabled: { type: Boolean, default: false },
    returnsRequireManagerApproval: { type: Boolean, default: true },

    qrOrdering: {
      categoryImageFirst: { type: Boolean, default: true },
      accentColor: { type: String, default: '' },
    },
    customerOtpVerificationEnabled: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TenantSettings', tenantSettingsSchema);
