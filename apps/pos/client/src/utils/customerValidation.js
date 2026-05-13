import { isValidPhoneNumber } from 'libphonenumber-js/min';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Validates a mobile/phone number string for the given ISO 3166-1 alpha-2 country.
 * Returns an error message string, or '' if valid / empty (field is optional).
 *
 * @param {string} mobile
 * @param {string} countryIso - e.g. 'LK', 'US', 'GB'
 * @returns {string}
 */
export function validateMobile(mobile, countryIso = 'LK') {
  const v = (mobile ?? '').trim();
  if (!v) return '';
  try {
    if (!isValidPhoneNumber(v, countryIso)) {
      return `Enter a valid ${countryIso} mobile number (e.g. ${mobileExample(countryIso)})`;
    }
  } catch {
    return 'Enter a valid mobile number';
  }
  return '';
}

/**
 * Validates an email address string.
 * Returns an error message string, or '' if valid / empty (field is optional).
 *
 * @param {string} email
 * @returns {string}
 */
export function validateEmail(email) {
  const v = (email ?? '').trim();
  if (!v) return '';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
  return '';
}

/** Returns a locale-appropriate example number for error hint text. */
function mobileExample(iso) {
  const examples = {
    LK: '077 123 4567',
    US: '+1 202 555 0123',
    GB: '07700 900123',
    AU: '0412 345 678',
    IN: '98765 43210',
    SG: '9123 4567',
    MY: '012-345 6789',
    AE: '050 123 4567',
    CA: '+1 613 555 0123',
    NZ: '021 123 4567',
  };
  return examples[iso] ?? 'valid local number';
}
