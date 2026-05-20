'use strict';

const SINGLETON_ID = 'platform';

function getPlatformContactModel(mongoose) {
  if (mongoose.models.PlatformContact) {
    return mongoose.models.PlatformContact;
  }

  const schema = new mongoose.Schema(
    {
      _id: { type: String, default: SINGLETON_ID },
      brandName: { type: String, default: 'Cafinity POS' },
      addressLine1: { type: String, default: '' },
      addressLine2: { type: String, default: '' },
      city: { type: String, default: '' },
      region: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: '' },
      supportEmail: { type: String, default: '' },
      salesEmail: { type: String, default: '' },
      phonePrimary: { type: String, default: '' },
      phoneSecondary: { type: String, default: '' },
      websiteUrl: { type: String, default: '' },
      publicWebsiteUrl: { type: String, default: '' },
      social: {
        facebook: { type: String, default: '' },
        instagram: { type: String, default: '' },
        linkedin: { type: String, default: '' },
        twitter: { type: String, default: '' },
        youtube: { type: String, default: '' },
        tiktok: { type: String, default: '' },
      },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true, collection: 'platform_contacts' },
  );

  return mongoose.model('PlatformContact', schema);
}

const DEFAULT_CONTACT = {
  _id: SINGLETON_ID,
  brandName: 'Cafinity POS',
  publicWebsiteUrl: 'https://cafinity.com',
  supportEmail: process.env.EMAIL_FROM || '',
};

module.exports = {
  SINGLETON_ID,
  getPlatformContactModel,
  DEFAULT_CONTACT,
};
