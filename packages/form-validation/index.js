'use strict';

const { parsePhoneNumberFromString } = require('libphonenumber-js');

const LIMITS = {
  personName: 80,
  businessName: 120,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  addressLine: 200,
  postalCodeMin: 2,
  postalCodeMax: 16,
  storeCode: 32,
  storeName: 120,
  notes: 2000,
  reason: 500,
  bankReference: 64,
  subject: 120,
  message: 5000,
  slug: 64,
};

const PLACEHOLDERS = {
  personName: 'e.g. John Silva',
  staffName: 'e.g. Sarah Smith',
  businessName: 'e.g. The Coffee Corner',
  ownerName: 'e.g. Jane Perera',
  email: 'e.g. name@yourbusiness.com',
  password: 'At least 8 characters',
  passwordNew: 'Enter new password',
  mobileLK: '77 123 4567',
  mobileGeneric: 'National number without country code',
  addressLine1: 'Building name and street',
  addressLine2: 'Suite, unit, or floor (optional)',
  city: 'e.g. Colombo',
  state: 'e.g. Western Province',
  postalCode: 'e.g. 00100',
  country: 'e.g. Sri Lanka',
  storeName: 'e.g. Main Street branch',
  storeCode: 'e.g. COL-01',
  notes: 'Optional notes',
  reason: 'Brief reason',
  bankReference: 'e.g. TXN-2026-001234',
  bankName: 'e.g. Commercial Bank',
  search: 'Search…',
  subject: 'e.g. Billing question',
  message: 'How can we help?',
};

const NAME_RE = /^[\p{L}\p{M}'\-\s.]+$/u;

function trim(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function ok() {
  return { ok: true, error: null };
}

function fail(error) {
  return { ok: false, error };
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

function validateNotes(value, { required = false, max = LIMITS.notes, label = 'Notes' } = {}) {
  const v = trim(value);
  if (!v) return required ? fail(`${label} is required`) : ok();
  if (v.length > max) return fail(`${label} must be at most ${max} characters`);
  return ok();
}

function fieldAttrs(type, options = {}) {
  const { countryIso = 'LK' } = options;
  const base = { maxLength: undefined, placeholder: '', inputMode: undefined, autoComplete: undefined };
  switch (type) {
    case 'personName':
      return { ...base, maxLength: LIMITS.personName, placeholder: PLACEHOLDERS.personName };
    case 'staffName':
      return { ...base, maxLength: LIMITS.personName, placeholder: PLACEHOLDERS.staffName };
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
      return { ...base, maxLength: LIMITS.addressLine, placeholder: PLACEHOLDERS.addressLine1 };
    case 'notes':
      return { ...base, maxLength: LIMITS.notes, placeholder: PLACEHOLDERS.notes };
    case 'bankReference':
      return { ...base, maxLength: LIMITS.bankReference, placeholder: PLACEHOLDERS.bankReference };
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
  validateRequired,
  validatePersonName,
  validateBusinessName,
  validateEmail,
  validatePassword,
  validateMobile,
  validateNotes,
  fieldAttrs,
};
