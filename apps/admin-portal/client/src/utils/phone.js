import { COUNTRIES } from '../constants/countries';

export function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

export const LK_NATIONAL_MOBILE_MAX = 9;

export function nationalMobileMaxDigits(countryIso) {
  return countryIso === 'LK' ? LK_NATIONAL_MOBILE_MAX : 15;
}

export function buildMobileE164(countryDialDigits, nationalDigits, maxNationalDigits = 15) {
  const cc = digitsOnly(countryDialDigits);
  let nat = digitsOnly(nationalDigits);
  if (nat.startsWith('0')) nat = nat.slice(1);
  nat = nat.slice(0, maxNationalDigits);
  if (!cc || nat.length < 6) return '';
  return `+${cc}${nat}`;
}

export function formatNationalInput(raw, maxDigits = 15) {
  const d = digitsOnly(raw).slice(0, maxDigits);
  const chunks = [];
  for (let i = 0; i < d.length; i += 3) chunks.push(d.slice(i, i + 3));
  return chunks.join(' ');
}

/** Parse stored phone display/E.164 into country + national for the mobile field. */
export function parsePhoneForField(phoneStr, defaultCountryIso = 'LK') {
  const raw = String(phoneStr || '').trim();
  if (!raw) {
    return { countryIso: defaultCountryIso, nationalDigits: '', display: '' };
  }
  const digits = raw.replace(/\s/g, '');
  if (digits.startsWith('+')) {
    const e164 = digits;
    for (const c of COUNTRIES) {
      if (e164.startsWith(`+${c.dial}`)) {
        const nat = e164.slice(1 + c.dial.length);
        return { countryIso: c.code, nationalDigits: nat, display: raw };
      }
    }
    const m = e164.match(/^\+(\d{1,3})(\d+)$/);
    if (m) {
      return { countryIso: defaultCountryIso, nationalDigits: m[2], display: raw };
    }
  }
  const nat = digitsOnly(raw);
  return { countryIso: defaultCountryIso, nationalDigits: nat, display: raw };
}

export function formatPhoneDisplay(countryIso, nationalDigits) {
  const country = COUNTRIES.find((c) => c.code === countryIso) || { dial: '94' };
  const max = nationalMobileMaxDigits(countryIso);
  const e164 = buildMobileE164(country.dial, nationalDigits, max);
  if (!e164) return '';
  return `+${country.dial} ${formatNationalInput(nationalDigits, max)}`.trim();
}
