'use strict';

const mongoose = require('mongoose');
const { getCachedContact, setCachedContact, invalidateContactCache } = require('./cache');
const { wrapEmailHtml, buildEmailFooterHtml, buildEmailHeaderHtml } = require('./footer');
const emailTheme = require('./emailTheme');
const { getPlatformContactModel, SINGLETON_ID, DEFAULT_CONTACT } = require('./model');

function toPlain(doc) {
  if (!doc) return { ...DEFAULT_CONTACT };
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    brandName: o.brandName || DEFAULT_CONTACT.brandName,
    addressLine1: o.addressLine1 || '',
    addressLine2: o.addressLine2 || '',
    city: o.city || '',
    region: o.region || '',
    postalCode: o.postalCode || '',
    country: o.country || '',
    supportEmail: o.supportEmail || '',
    salesEmail: o.salesEmail || '',
    phonePrimary: o.phonePrimary || '',
    phoneSecondary: o.phoneSecondary || '',
    websiteUrl: o.websiteUrl || '',
    publicWebsiteUrl: o.publicWebsiteUrl || DEFAULT_CONTACT.publicWebsiteUrl,
    social: {
      facebook: o.social?.facebook || '',
      instagram: o.social?.instagram || '',
      linkedin: o.social?.linkedin || '',
      twitter: o.social?.twitter || '',
      youtube: o.social?.youtube || '',
      tiktok: o.social?.tiktok || '',
    },
  };
}

async function loadContactFromDb() {
  const PlatformContact = getPlatformContactModel(mongoose);
  let doc = await PlatformContact.findById(SINGLETON_ID).lean();
  if (!doc) {
    await PlatformContact.create({ _id: SINGLETON_ID, ...DEFAULT_CONTACT });
    doc = await PlatformContact.findById(SINGLETON_ID).lean();
  }
  return toPlain(doc);
}

/** Cached platform contact for email footers and public pages. */
async function getPlatformContact({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = await getCachedContact();
    if (cached) return cached;
  }
  const plain = await loadContactFromDb();
  await setCachedContact(plain);
  return plain;
}

async function savePlatformContact(payload, userId) {
  const PlatformContact = getPlatformContactModel(mongoose);
  const update = {
    brandName: trim(payload.brandName) || DEFAULT_CONTACT.brandName,
    addressLine1: trim(payload.addressLine1),
    addressLine2: trim(payload.addressLine2),
    city: trim(payload.city),
    region: trim(payload.region),
    postalCode: trim(payload.postalCode),
    country: trim(payload.country),
    supportEmail: trim(payload.supportEmail),
    salesEmail: trim(payload.salesEmail),
    phonePrimary: trim(payload.phonePrimary),
    phoneSecondary: trim(payload.phoneSecondary),
    websiteUrl: trim(payload.websiteUrl),
    publicWebsiteUrl: trim(payload.publicWebsiteUrl) || DEFAULT_CONTACT.publicWebsiteUrl,
    social: {
      facebook: trim(payload.social?.facebook),
      instagram: trim(payload.social?.instagram),
      linkedin: trim(payload.social?.linkedin),
      twitter: trim(payload.social?.twitter),
      youtube: trim(payload.social?.youtube),
      tiktok: trim(payload.social?.tiktok),
    },
    updatedBy: userId || undefined,
  };
  const doc = await PlatformContact.findByIdAndUpdate(
    SINGLETON_ID,
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const plain = toPlain(doc);
  await setCachedContact(plain);
  return plain;
}

function trim(v) {
  return typeof v === 'string' ? v.trim() : '';
}

module.exports = {
  getPlatformContact,
  savePlatformContact,
  invalidateContactCache,
  wrapEmailHtml,
  buildEmailFooterHtml,
  buildEmailHeaderHtml,
  getPlatformContactModel,
  toPlain,
  SINGLETON_ID,
  DEFAULT_CONTACT,
  BRAND: emailTheme.BRAND,
  emailHeading: emailTheme.emailHeading,
  emailParagraph: emailTheme.emailParagraph,
  emailButton: emailTheme.emailButton,
  emailPanel: emailTheme.emailPanel,
  emailAlert: emailTheme.emailAlert,
  emailLabelValue: emailTheme.emailLabelValue,
  esc: emailTheme.esc,
};
