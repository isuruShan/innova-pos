import { Phone } from 'lucide-react';
import { COUNTRIES } from '../constants/countries';
import {
  buildMobileE164,
  digitsOnly,
  formatNationalInput,
  nationalMobileMaxDigits,
} from '../utils/phone';
import { fieldAttrs } from '../utils/formFields';

/**
 * Same mobile UX as public-web signup (country + national number).
 */
export default function MobilePhoneField({
  countryIso,
  nationalDigits,
  onCountryIsoChange,
  onNationalDigitsChange,
  error,
  label = 'Phone',
  required = false,
}) {
  const dialEntry = COUNTRIES.find((c) => c.code === countryIso) || COUNTRIES[0];
  const nationalMax = nationalMobileMaxDigits(countryIso);
  const mobileAttrs = fieldAttrs('mobile', { countryIso });

  const handleNationalChange = (ev) => {
    const d = digitsOnly(ev.target.value).slice(0, nationalMax);
    onNationalDigitsChange(d);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="flex gap-2 flex-col sm:flex-row">
        <select
          value={countryIso}
          onChange={(ev) => {
            onCountryIsoChange(ev.target.value);
            onNationalDigitsChange('');
          }}
          className="sm:w-44 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-0">
          <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="tel"
            inputMode={mobileAttrs.inputMode}
            autoComplete="tel-national"
            value={formatNationalInput(nationalDigits, nationalMax)}
            onChange={handleNationalChange}
            placeholder={mobileAttrs.placeholder}
            className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
              error ? 'border-red-400' : 'border-gray-300'
            }`}
          />
        </div>
      </div>
      {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
    </div>
  );
}

export function validateMobileField(countryIso, nationalDigits) {
  const dialEntry = COUNTRIES.find((c) => c.code === countryIso) || COUNTRIES[0];
  const nationalMax = nationalMobileMaxDigits(countryIso);
  const natLen = digitsOnly(nationalDigits).length;
  const e164 = buildMobileE164(dialEntry.dial, nationalDigits, nationalMax);
  if (countryIso === 'LK') {
    if (natLen !== 9) return 'Enter your 9-digit mobile number (without the leading 0)';
  } else if (!nationalDigits || natLen < 6) {
    return 'Enter a valid mobile number';
  } else if (!e164 || e164.length < 10) {
    return 'Mobile number looks incomplete for this country';
  }
  return '';
}

export function phoneValueFromField(countryIso, nationalDigits) {
  const dialEntry = COUNTRIES.find((c) => c.code === countryIso) || COUNTRIES[0];
  const nationalMax = nationalMobileMaxDigits(countryIso);
  const e164 = buildMobileE164(dialEntry.dial, nationalDigits, nationalMax);
  if (!e164) return '';
  return `+${dialEntry.dial} ${formatNationalInput(nationalDigits, nationalMax)}`.trim();
}
