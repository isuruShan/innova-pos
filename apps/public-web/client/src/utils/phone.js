/** Strip to digits only */
export function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

/** Max national digits for Sri Lanka mobiles (without country code, no leading 0). */
export const LK_NATIONAL_MOBILE_MAX = 9;

export function nationalMobileMaxDigits(countryIso) {
  return countryIso === 'LK' ? LK_NATIONAL_MOBILE_MAX : 15;
}

/**
 * Build E.164 string for uniqueness checks (+country national without leading 0 on national).
 */
export function buildMobileE164(countryDialDigits, nationalDigits, maxNationalDigits = 15) {
  const cc = digitsOnly(countryDialDigits);
  let nat = digitsOnly(nationalDigits);
  if (nat.startsWith('0')) nat = nat.slice(1);
  nat = nat.slice(0, maxNationalDigits);
  if (!cc || nat.length < 6 || nat.length > maxNationalDigits) return '';
  return `+${cc}${nat}`;
}

/** Format national part for display (groups of 3 digits) */
export function formatNationalInput(raw, maxDigits = 15) {
  const d = digitsOnly(raw).slice(0, maxDigits);
  const chunks = [];
  for (let i = 0; i < d.length; i += 3) {
    chunks.push(d.slice(i, i + 3));
  }
  return chunks.join(' ');
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}
