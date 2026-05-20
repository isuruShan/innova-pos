'use strict';

const { parsePhoneNumberFromString } = require('libphonenumber-js');

const LIMITS = {
  personName: 80,
  businessName: 120,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  addressLine: 200,
  city: 80,
  region: 80,
  postalCodeMin: 2,
  postalCodeMax: 16,
  storeCode: 32,
  storeName: 120,
  notes: 2000,
  reason: 500,
  bankReference: 64,
  bankLabel: 80,
  bankName: 120,
  accountNumber: 34,
  swiftCode: 11,
  subject: 120,
  message: 5000,
  slug: 64,
  tagline: 160,
  phoneDisplay: 32,
  website: 200,
  registrationNumber: 64,
  receiptLine: 500,
  currencyCode: 8,
  currencySymbol: 8,
};

const PLACEHOLDERS = {
  firstName: 'e.g. John',
  lastName: 'e.g. Doe',
  personName: 'e.g. John Doe',
  staffName: 'e.g. John Doe',
  businessName: 'e.g. The Coffee Corner',
  ownerName: 'e.g. John Doe',
  email: 'e.g. name@yourbusiness.com',
  password: 'At least 8 characters',
  passwordNew: 'Enter new password',
  mobileLK: '77 123 4567',
  mobileGeneric: 'National number without country code',
  addressLine1: 'Building name and street',
  addressLine2: 'Suite, unit, or floor (optional)',
  city: 'e.g. Austin',
  state: 'e.g. Texas',
  postalCode: 'e.g. 00100',
  country: 'e.g. Sri Lanka',
  storeName: 'e.g. Main Street branch',
  storeCode: 'e.g. COL-01',
  notes: 'Optional notes',
  reason: 'Brief reason',
  bankReference: 'e.g. TXN-2026-001234',
  bankName: 'e.g. Commercial Bank',
  bankLabel: 'e.g. Main LKR account',
  search: 'Search…',
  subject: 'e.g. Billing question',
  message: 'How can we help?',
  tagline: 'Great coffee, every time',
  phoneDisplay: '+94 77 000 0000',
  website: 'https://yourbusiness.com',
  registrationNumber: 'BR 12345678',
  receiptHeader: 'Thank you for dining with us',
  receiptFooter: 'Visit us again soon',
};

const NAME_RE = /^[\p{L}\p{M}'\-\s.]+$/u;
const POSTAL_RE = /^[\p{L}\p{N}\s\-]+$/u;

function trim(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function ok() {
  return { ok: true, error: null };
}

function fail(error) {
  return { ok: false, error };
}

function pickErrors(entries) {
  const errors = {};
  for (const [key, result] of entries) {
    if (result && !result.ok) errors[key] = result.error;
  }
  return errors;
}

function validateRequired(value, label = 'This field') {
  if (!trim(value)) return fail(`${label} is required`);
  return ok();
}

function validatePersonName(value, { required = true, label = 'Name' } = {}) {
  const v = trim(value);
  if (!v) return required ? fail(`${label} is required`) : ok();
  if (v.length > LIMITS.personName) return fail(`${label} must be at most ${LIMITS.personName} characters`);
  if (!NAME_RE.test(v)) return fail(`${label} contains invalid characters`);
  return ok();
}

function validateBusinessName(value, { required = true } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('Business name is required') : ok();
  if (v.length > LIMITS.businessName) return fail(`Business name must be at most ${LIMITS.businessName} characters`);
  return ok();
}

function validateEmail(value, { required = true } = {}) {
  const v = trim(value).toLowerCase();
  if (!v) return required ? fail('Email is required') : ok();
  if (v.length > LIMITS.email) return fail(`Email must be at most ${LIMITS.email} characters`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v)) return fail('Enter a valid email address');
  return ok();
}

function validatePassword(value, { required = true, min = LIMITS.passwordMin } = {}) {
  const v = String(value || '');
  if (!v) return required ? fail('Password is required') : ok();
  if (v.length < min) return fail(`Password must be at least ${min} characters`);
  if (v.length > LIMITS.passwordMax) return fail(`Password must be at most ${LIMITS.passwordMax} characters`);
  return ok();
}

function validateMobile(value, countryIso = 'LK', { required = true } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('Mobile number is required') : ok();
  try {
    const phone = parsePhoneNumberFromString(v, countryIso || 'LK');
    if (!phone || !phone.isValid()) return fail('Enter a valid mobile number');
    return ok();
  } catch {
    return fail('Enter a valid mobile number');
  }
}

function validateAddressLine(value, { required = true, label = 'Address' } = {}) {
  const v = trim(value);
  if (!v) return required ? fail(`${label} is required`) : ok();
  if (v.length > LIMITS.addressLine) return fail(`${label} must be at most ${LIMITS.addressLine} characters`);
  return ok();
}

function validateCity(value, { required = true } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('City is required') : ok();
  if (v.length > LIMITS.city) return fail(`City must be at most ${LIMITS.city} characters`);
  if (!NAME_RE.test(v)) return fail('City contains invalid characters');
  return ok();
}

function validateRegion(value, { required = true, label = 'State / province' } = {}) {
  const v = trim(value);
  if (!v) return required ? fail(`${label} is required`) : ok();
  if (v.length > LIMITS.region) return fail(`${label} must be at most ${LIMITS.region} characters`);
  if (!NAME_RE.test(v)) return fail(`${label} contains invalid characters`);
  return ok();
}

function validatePostalCode(value, { required = true } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('ZIP / postal code is required') : ok();
  if (v.length < LIMITS.postalCodeMin || v.length > LIMITS.postalCodeMax) {
    return fail(`Enter a valid postal code (${LIMITS.postalCodeMin}–${LIMITS.postalCodeMax} characters)`);
  }
  if (!POSTAL_RE.test(v)) return fail('Postal code contains invalid characters');
  return ok();
}

function validateRegistrationNumber(value, { required = false } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('Registration number is required') : ok();
  if (v.length > LIMITS.registrationNumber) {
    return fail(`Registration number must be at most ${LIMITS.registrationNumber} characters`);
  }
  return ok();
}

function validateSubject(value, { required = false } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('Subject is required') : ok();
  if (v.length > LIMITS.subject) return fail(`Subject must be at most ${LIMITS.subject} characters`);
  return ok();
}

function validateMessage(value, { required = true, label = 'Message' } = {}) {
  const v = trim(value);
  if (!v) return required ? fail(`${label} is required`) : ok();
  if (v.length > LIMITS.message) return fail(`${label} must be at most ${LIMITS.message} characters`);
  return ok();
}

function validateNotes(value, { required = false, max = LIMITS.notes, label = 'Notes' } = {}) {
  const v = trim(value);
  if (!v) return required ? fail(`${label} is required`) : ok();
  if (v.length > max) return fail(`${label} must be at most ${max} characters`);
  return ok();
}

function validateTagline(value, { required = false } = {}) {
  const v = trim(value);
  if (!v) return ok();
  if (v.length > LIMITS.tagline) return fail(`Tagline must be at most ${LIMITS.tagline} characters`);
  return ok();
}

function validatePhoneDisplay(value, { required = false } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('Phone is required') : ok();
  if (v.length > LIMITS.phoneDisplay) return fail(`Phone must be at most ${LIMITS.phoneDisplay} characters`);
  return ok();
}

function validateWebsite(value, { required = false } = {}) {
  const v = trim(value);
  if (!v) return ok();
  if (v.length > LIMITS.website) return fail(`Website must be at most ${LIMITS.website} characters`);
  return ok();
}

function validateStoreName(value, { required = true } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('Store name is required') : ok();
  if (v.length > LIMITS.storeName) return fail(`Store name must be at most ${LIMITS.storeName} characters`);
  return ok();
}

function validateStoreCode(value, { required = true } = {}) {
  const v = trim(value);
  if (!v) return required ? fail('Store code is required') : ok();
  if (v.length > LIMITS.storeCode) return fail(`Store code must be at most ${LIMITS.storeCode} characters`);
  return ok();
}

function validateSignupPersonal({ firstName, lastName, email }) {
  return pickErrors([
    ['firstName', validatePersonName(firstName, { label: 'First name' })],
    ['lastName', validatePersonName(lastName, { label: 'Last name' })],
    ['email', validateEmail(email)],
  ]);
}

function validateSignupBusiness(form, { isRegistered = false } = {}) {
  const f = form || {};
  const errors = pickErrors([
    ['businessName', validateBusinessName(f.businessName)],
    ['ownerName', validatePersonName(f.ownerName, { label: 'Owner name' })],
    ['street1', validateAddressLine(f.street1, { label: 'Street line 1' })],
    ['street2', validateAddressLine(f.street2, { required: false, label: 'Street line 2' })],
    ['zipCode', validatePostalCode(f.zipCode)],
    ['city', validateCity(f.city)],
    ['state', validateRegion(f.state)],
    ['registrationNumber', validateRegistrationNumber(f.registrationNumber, { required: isRegistered })],
  ]);
  const country = trim(f.businessCountry);
  if (!country) errors.businessCountry = 'Country is required';
  else if (country.length > LIMITS.city) errors.businessCountry = `Country must be at most ${LIMITS.city} characters`;
  return errors;
}

function validateContactForm({ name, email, subject, message }) {
  return pickErrors([
    ['name', validatePersonName(name, { label: 'Full name' })],
    ['email', validateEmail(email)],
    ['subject', validateSubject(subject)],
    ['message', validateMessage(message)],
  ]);
}

function fieldAttrs(type, options = {}) {
  const { countryIso = 'LK' } = options;
  const base = { maxLength: undefined, placeholder: '', inputMode: undefined, autoComplete: undefined };
  switch (type) {
    case 'firstName':
      return { ...base, maxLength: LIMITS.personName, placeholder: PLACEHOLDERS.firstName, autoComplete: 'given-name' };
    case 'lastName':
      return { ...base, maxLength: LIMITS.personName, placeholder: PLACEHOLDERS.lastName, autoComplete: 'family-name' };
    case 'personName':
      return { ...base, maxLength: LIMITS.personName, placeholder: PLACEHOLDERS.personName, autoComplete: 'given-name' };
    case 'staffName':
      return { ...base, maxLength: LIMITS.personName, placeholder: PLACEHOLDERS.staffName };
    case 'ownerName':
      return { ...base, maxLength: LIMITS.personName, placeholder: PLACEHOLDERS.ownerName };
    case 'businessName':
      return { ...base, maxLength: LIMITS.businessName, placeholder: PLACEHOLDERS.businessName };
    case 'email':
      return { ...base, maxLength: LIMITS.email, placeholder: PLACEHOLDERS.email, autoComplete: 'email' };
    case 'password':
      return { ...base, maxLength: LIMITS.passwordMax, placeholder: PLACEHOLDERS.password, autoComplete: 'new-password' };
    case 'mobile':
      return {
        ...base,
        maxLength: countryIso === 'LK' ? 11 : 15,
        placeholder: countryIso === 'LK' ? PLACEHOLDERS.mobileLK : PLACEHOLDERS.mobileGeneric,
        inputMode: 'tel',
      };
    case 'addressLine1':
      return { ...base, maxLength: LIMITS.addressLine, placeholder: PLACEHOLDERS.addressLine1, autoComplete: 'address-line1' };
    case 'addressLine2':
      return { ...base, maxLength: LIMITS.addressLine, placeholder: PLACEHOLDERS.addressLine2, autoComplete: 'address-line2' };
    case 'city':
      return { ...base, maxLength: LIMITS.city, placeholder: PLACEHOLDERS.city, autoComplete: 'address-level2' };
    case 'region':
      return { ...base, maxLength: LIMITS.region, placeholder: PLACEHOLDERS.state, autoComplete: 'address-level1' };
    case 'postalCode':
      return { ...base, maxLength: LIMITS.postalCodeMax, placeholder: PLACEHOLDERS.postalCode, autoComplete: 'postal-code' };
    case 'registrationNumber':
      return { ...base, maxLength: LIMITS.registrationNumber, placeholder: PLACEHOLDERS.registrationNumber };
    case 'notes':
      return { ...base, maxLength: LIMITS.notes, placeholder: PLACEHOLDERS.notes };
    case 'reason':
      return { ...base, maxLength: LIMITS.reason, placeholder: PLACEHOLDERS.reason };
    case 'bankReference':
      return { ...base, maxLength: LIMITS.bankReference, placeholder: PLACEHOLDERS.bankReference };
    case 'bankLabel':
      return { ...base, maxLength: LIMITS.bankLabel, placeholder: PLACEHOLDERS.bankLabel };
    case 'bankName':
      return { ...base, maxLength: LIMITS.bankName, placeholder: PLACEHOLDERS.bankName };
    case 'accountNumber':
      return { ...base, maxLength: LIMITS.accountNumber, placeholder: 'Account number' };
    case 'swiftCode':
      return { ...base, maxLength: LIMITS.swiftCode, placeholder: 'SWIFT / BIC' };
    case 'subject':
      return { ...base, maxLength: LIMITS.subject, placeholder: PLACEHOLDERS.subject };
    case 'message':
      return { ...base, maxLength: LIMITS.message, placeholder: PLACEHOLDERS.message };
    case 'tagline':
      return { ...base, maxLength: LIMITS.tagline, placeholder: PLACEHOLDERS.tagline };
    case 'phoneDisplay':
      return { ...base, maxLength: LIMITS.phoneDisplay, placeholder: PLACEHOLDERS.phoneDisplay, inputMode: 'tel' };
    case 'website':
      return { ...base, maxLength: LIMITS.website, placeholder: PLACEHOLDERS.website, autoComplete: 'url' };
    case 'storeName':
      return { ...base, maxLength: LIMITS.storeName, placeholder: PLACEHOLDERS.storeName };
    case 'storeCode':
      return { ...base, maxLength: LIMITS.storeCode, placeholder: PLACEHOLDERS.storeCode };
    case 'receiptLine':
      return { ...base, maxLength: LIMITS.receiptLine, placeholder: PLACEHOLDERS.receiptHeader };
    default:
      return base;
  }
}

module.exports = {
  LIMITS,
  PLACEHOLDERS,
  trim,
  ok,
  fail,
  pickErrors,
  validateRequired,
  validatePersonName,
  validateBusinessName,
  validateEmail,
  validatePassword,
  validateMobile,
  validateAddressLine,
  validateCity,
  validateRegion,
  validatePostalCode,
  validateRegistrationNumber,
  validateSubject,
  validateMessage,
  validateNotes,
  validateTagline,
  validatePhoneDisplay,
  validateWebsite,
  validateStoreName,
  validateStoreCode,
  validateSignupPersonal,
  validateSignupBusiness,
  validateContactForm,
  fieldAttrs,
};
