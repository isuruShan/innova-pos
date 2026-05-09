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

    // Colors (hex)
    primaryColor: { type: String, default: '#1a1a2e' },
    accentColor: { type: String, default: '#e94560' },
    sidebarColor: { type: String, default: '#16213e' },
    textColor: { type: String, default: '#ffffff' },

    // Contact
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },

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

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TenantSettings', tenantSettingsSchema);
