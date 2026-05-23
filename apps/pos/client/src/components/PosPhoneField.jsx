import { Phone } from 'lucide-react';
import { COUNTRIES } from '../constants/countries';
import { isValidPhoneNumber } from 'libphonenumber-js/min';

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function maxNationalDigits(countryIso) {
  return countryIso === 'LK' ? 9 : 15;
}

function formatNationalInput(raw, maxDigits) {
  const d = digitsOnly(raw).slice(0, maxDigits);
  const chunks = [];
  for (let i = 0; i < d.length; i += 3) chunks.push(d.slice(i, i + 3));
  return chunks.join(' ');
}

/**
 * Builds the E.164 representation from dial code + national digits.
 */
export function buildMobileE164FromParts(countryIso, nationalDigits) {
  const country = COUNTRIES.find((c) => c.code === countryIso) || COUNTRIES[0];
  let nat = digitsOnly(nationalDigits);
  if (nat.startsWith('0')) nat = nat.slice(1);
  const max = maxNationalDigits(countryIso);
  nat = nat.slice(0, max);
  if (!nat || nat.length < 5) return '';
  return `+${country.dial}${nat}`;
}

/**
 * Validate a national-digits input for the given country.
 * Returns an error string, or '' if valid.
 */
export function validatePosPhoneField(countryIso, nationalDigits) {
  const raw = digitsOnly(nationalDigits);
  if (!raw) return '';
  const e164 = buildMobileE164FromParts(countryIso, nationalDigits);
  if (!e164) return 'Enter a valid mobile number';
  try {
    if (!isValidPhoneNumber(e164, countryIso)) {
      return `Enter a valid ${countryIso} mobile number`;
    }
  } catch {
    return 'Enter a valid mobile number';
  }
  return '';
}

/**
 * Returns the stored E.164/display string from country + national digits.
 */
export function phoneDisplayFromParts(countryIso, nationalDigits) {
  const country = COUNTRIES.find((c) => c.code === countryIso) || COUNTRIES[0];
  const max = maxNationalDigits(countryIso);
  const fmt = formatNationalInput(nationalDigits, max);
  return fmt ? `+${country.dial} ${fmt}` : '';
}

/**
 * Parse a stored phone string into { countryIso, nationalDigits }.
 * Falls back to defaultCountryIso if the country can't be determined.
 */
export function parseStoredPhone(phoneStr, defaultCountryIso = 'LK') {
  const raw = String(phoneStr || '').trim();
  if (!raw) return { countryIso: defaultCountryIso, nationalDigits: '' };
  const digits = raw.replace(/\s/g, '');
  if (digits.startsWith('+')) {
    for (const c of COUNTRIES) {
      if (digits.startsWith(`+${c.dial}`)) {
        const nat = digits.slice(1 + c.dial.length);
        return { countryIso: c.code, nationalDigits: nat };
      }
    }
  }
  return { countryIso: defaultCountryIso, nationalDigits: digitsOnly(raw) };
}

/**
 * POS-themed phone input with country code selector.
 * Uses the dark POS design system CSS variables.
 */
export default function PosPhoneField({
  countryIso,
  nationalDigits,
  onCountryIsoChange,
  onNationalDigitsChange,
  error,
  label = 'Mobile number',
  required = false,
}) {
  const max = maxNationalDigits(countryIso);

  const handleNationalChange = (ev) => {
    const d = digitsOnly(ev.target.value).slice(0, max);
    onNationalDigitsChange(d);
  };

  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={countryIso}
          onChange={(ev) => {
            onCountryIsoChange(ev.target.value);
            onNationalDigitsChange('');
          }}
          className="w-36 shrink-0 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-2 py-2 text-[var(--pos-text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-0">
          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={formatNationalInput(nationalDigits, max)}
            onChange={handleNationalChange}
            placeholder={countryIso === 'LK' ? '77 123 4567' : 'national number'}
            className={`w-full bg-[var(--pos-surface-inset)] border rounded-xl pl-9 pr-3 py-2 text-[var(--pos-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
              error ? 'border-red-500' : 'border-slate-700'
            }`}
          />
        </div>
      </div>
      {error ? <p className="text-xs text-red-400 mt-1">{error}</p> : null}
    </div>
  );
}
