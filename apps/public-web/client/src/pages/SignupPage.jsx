import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Phone, Loader } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY_CODE } from '../constants/countries';
import {
  buildMobileE164,
  formatNationalInput,
  digitsOnly,
  validateEmail,
  nationalMobileMaxDigits,
} from '../utils/phone';
import api from '../api';

export default function SignupPage() {
  const navigate = useNavigate();
  const [countryIso, setCountryIso] = useState(DEFAULT_COUNTRY_CODE);
  const [nationalDigits, setNationalDigits] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);

  const dialEntry = COUNTRIES.find((c) => c.code === countryIso) || COUNTRIES[0];
  const dial = dialEntry.dial;
  const nationalMax = nationalMobileMaxDigits(countryIso);
  const mobileE164 = buildMobileE164(dial, nationalDigits, nationalMax);

  const validateFields = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    else if (form.firstName.trim().length > 80) e.firstName = 'First name is too long';
    if (!form.lastName.trim()) e.lastName = 'Last name is required';
    else if (form.lastName.trim().length > 80) e.lastName = 'Last name is too long';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!validateEmail(form.email)) e.email = 'Enter a valid email address';
    const natLen = digitsOnly(nationalDigits).length;
    if (countryIso === 'LK') {
      if (natLen !== 9) {
        e.mobile = 'Enter your 9-digit mobile number (without the leading 0)';
      }
    } else if (!nationalDigits || natLen < 6) {
      e.mobile = 'Enter a valid mobile number';
    } else if (!mobileE164 || mobileE164.length < 10) {
      e.mobile = 'Mobile number looks incomplete for this country';
    }
    return e;
  };

  const handleNationalChange = (ev) => {
    const raw = ev.target.value;
    const max = nationalMobileMaxDigits(countryIso);
    const d = digitsOnly(raw).slice(0, max);
    setNationalDigits(d);
    if (errors.mobile) setErrors((err) => ({ ...err, mobile: '' }));
  };

  const handleNext = async (e) => {
    e.preventDefault();
    const fieldErrs = validateFields();
    if (Object.keys(fieldErrs).length) {
      setErrors(fieldErrs);
      return;
    }

    setChecking(true);
    setErrors({});
    try {
      const { data } = await api.get('/applications/availability', {
        params: {
          email: form.email.trim().toLowerCase(),
          mobileE164,
        },
      });

      const nextErr = {};
      if (!data.emailAvailable) {
        nextErr.email =
          data.reasons?.find((r) => r.field === 'email')?.code === 'account_exists'
            ? 'This email is already registered'
            : 'An application with this email already exists';
      }
      if (!data.mobileAvailable) {
        nextErr.mobile = 'An application with this mobile number already exists';
      }
      if (Object.keys(nextErr).length) {
        setErrors(nextErr);
        setChecking(false);
        return;
      }

      const mobileDisplay = `+${dial} ${formatNationalInput(nationalDigits, nationalMax)}`.trim();

      sessionStorage.setItem(
        'signup_personal',
        JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          countryDialCode: dial,
          countryIso,
          mobileNational: digitsOnly(nationalDigits),
          mobileE164,
          mobileDisplay,
        })
      );
      navigate('/signup/business');
    } catch {
      setErrors({ api: 'Could not verify availability. Check your connection and try again.' });
    } finally {
      setChecking(false);
    }
  };

  const set = (k) => (ev) => {
    setForm((f) => ({ ...f, [k]: ev.target.value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="px-4 py-5 border-b bg-white">
        <Link to="/" className="flex items-center w-fit">
          <img src="/cafinity-logo.png" alt="Cafinity" className="h-10 w-auto rounded-lg shadow-sm" />
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            {[
              { n: 1, label: 'Personal details', active: true },
              { n: 2, label: 'Business details', active: false },
            ].map((step, i) => (
              <div key={step.n} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step.active ? 'bg-brand-orange text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {step.n}
                </div>
                <span className={`text-sm ${step.active ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {i < 1 && <div className="flex-1 h-px bg-gray-200 ml-2" />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-500 text-sm mb-7">Start your 30-day free trial. No credit card required.</p>

            <form onSubmit={handleNext} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'First name', key: 'firstName', placeholder: 'John' },
                  { label: 'Last name', key: 'lastName', placeholder: 'Silva' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={form[f.key]}
                      onChange={set(f.key)}
                      placeholder={f.placeholder}
                      autoComplete="given-name"
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                        errors[f.key] ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {errors[f.key] && <p className="text-xs text-red-500 mt-1">{errors[f.key]}</p>}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile number</label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <select
                    value={countryIso}
                    onChange={(ev) => {
                      setCountryIso(ev.target.value);
                      setNationalDigits('');
                      if (errors.mobile) setErrors((e) => ({ ...e, mobile: '' }));
                    }}
                    className="sm:w-44 border border-gray-300 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white"
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
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={formatNationalInput(nationalDigits, nationalMax)}
                      onChange={handleNationalChange}
                      placeholder={countryIso === 'LK' ? '77 123 4567' : 'National number'}
                      maxLength={countryIso === 'LK' ? 11 : undefined}
                      className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                        errors.mobile ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {countryIso === 'LK'
                    ? 'Enter 9 digits without the country code or leading 0 (e.g. 771234567).'
                    : 'Enter your number without the country code.'}
                </p>
                {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="john@yourbusiness.com"
                    autoComplete="email"
                    className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                      errors.email ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {errors.api && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{errors.api}</div>
              )}

              <button
                type="submit"
                disabled={checking}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold transition-all hover:bg-brand-orange-hover disabled:opacity-60"
              >
                {checking ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Checking…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
