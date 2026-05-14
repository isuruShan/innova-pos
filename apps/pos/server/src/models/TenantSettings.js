const mongoose = require('mongoose');

/** Mirrors admin-portal TenantSettings for direct DB reads (e.g. public QR session). */
const tenantSettingsSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      unique: true,
      index: true,
    },
    businessName: { type: String, default: '', trim: true },
    tagline: { type: String, default: '', trim: true },
    logoUrl: { type: String, default: '' },
    logoKey: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#1a1a2e' },
    accentColor: { type: String, default: '#e94560' },
    sidebarColor: { type: String, default: '#16213e' },
    textColor: { type: String, default: '#ffffff' },
    selectionTextColor: { type: String, default: '#ffffff' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    paymentMethods: { type: [String], default: ['cash'] },
    currency: { type: String, default: 'LKR' },
    currencySymbol: { type: String, default: 'Rs.' },
    timezone: { type: String, default: 'Asia/Colombo' },
    receiptHeader: { type: String, default: '' },
    receiptFooter: { type: String, default: 'Thank you for your visit!' },
    printReceiptByDefault: { type: Boolean, default: false },
    receiptPrintAtStatus: {
      type: String,
      enum: ['placement', 'preparing', 'ready', 'completed', 'none'],
      default: 'placement',
    },
    receiptPrintAtByOrderType: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model('TenantSettings', tenantSettingsSchema);
