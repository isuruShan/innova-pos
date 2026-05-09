import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Building2, MapPin, FileText, Upload, X, ArrowLeft, ArrowRight, Loader } from 'lucide-react';
import { COUNTRIES } from '../constants/countries';
import { validateEmail } from '../utils/phone';
import api from '../api';

export default function SignupBusinessPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [personal, setPersonal] = useState(null);
  const [form, setForm] = useState({
    businessName: '',
    ownerName: '',
    street1: '',
    street2: '',
    zipCode: '',
    city: '',
    state: '',
    businessCountry: 'Sri Lanka',
    isRegistered: false,
    registrationNumber: '',
  });
  const [brFile, setBrFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('signup_personal');
    if (!stored) {
      navigate('/signup');
      return;
    }
    const p = JSON.parse(stored);
    if (!p.mobileE164 || !validateEmail(p.email)) {
      navigate('/signup');
      return;
    }
    setPersonal(p);
  }, [navigate]);

  const set =
    (k) =>
    (ev) => {
      const val = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
      setForm((f) => ({ ...f, [k]: val }));
      if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
      if (k === 'isRegistered' && !val) {
        setForm((f) => ({ ...f, registrationNumber: '' }));
        setBrFile(null);
      }
    };

  const validate = () => {
    const e = {};
    if (!form.businessName.trim()) e.businessName = 'Business name is required';
    else if (form.businessName.length > 120) e.businessName = 'Business name is too long';

    if (!form.ownerName.trim()) e.ownerName = 'Owner name is required';
    else if (form.ownerName.length > 120) e.ownerName = 'Owner name is too long';

    if (!form.street1.trim()) e.street1 = 'Street line 1 is required';
    const zip = form.zipCode.trim();
    if (!zip) e.zipCode = 'ZIP / postal code is required';
    else if (zip.length < 2 || zip.length > 16) e.zipCode = 'Enter a valid postal code (2–16 characters)';

    if (!form.city.trim()) e.city = 'City is required';
    if (!form.state.trim()) e.state = 'State / province is required';
    if (!form.businessCountry.trim()) e.businessCountry = 'Country is required';

    if (form.isRegistered) {
      if (!form.registrationNumber.trim()) e.registrationNumber = 'Registration number is required';
      if (!brFile) e.brFile = 'BR certificate image is required';
    }

    return e;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((err) => ({ ...err, brFile: 'Only JPEG, PNG, or WebP images allowed' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors((err) => ({ ...err, brFile: 'File must be under 10MB' }));
      return;
    }
    setBrFile(file);
    setErrors((err) => ({ ...err, brFile: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setApiError('');

    try {
      const fd = new FormData();
      fd.append('firstName', personal.firstName);
      fd.append('lastName', personal.lastName);
      fd.append('email', personal.email);
      fd.append('countryDialCode', personal.countryDialCode);
      fd.append('mobileNational', personal.mobileNational);
      fd.append('mobileDisplay', personal.mobileDisplay || '');

      fd.append('businessName', form.businessName.trim());
      fd.append('ownerName', form.ownerName.trim());
      fd.append('street1', form.street1.trim());
      fd.append('street2', form.street2.trim());
      fd.append('zipCode', form.zipCode.trim());
      fd.append('city', form.city.trim());
      fd.append('state', form.state.trim());
      fd.append('businessCountry', form.businessCountry.trim());

      fd.append('isRegistered', form.isRegistered);
      fd.append('registrationNumber', form.registrationNumber.trim());
      if (brFile) fd.append('brFile', brFile);

      // Let axios set multipart boundary — explicit Content-Type breaks file uploads
      await api.post('/applications', fd);

      sessionStorage.removeItem('signup_personal');
      navigate('/signup/complete');
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      if (err.response?.status === 409) {
        setApiError(`${msg}${err.response.data.status ? ` (${err.response.data.status})` : ''}`);
      } else {
        setApiError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!personal) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="px-4 py-5 border-b bg-white">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-orange">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-lg text-brand-brown-deep">InnovaPOS</span>
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-3 mb-8">
            {[
              { n: 1, label: 'Personal details', done: true },
              { n: 2, label: 'Business details', active: true },
            ].map((step, i) => (
              <div key={step.n} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step.done ? 'bg-green-500 text-white' : step.active ? 'bg-brand-orange text-white' : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {step.done ? '✓' : step.n}
                </div>
                <span
                  className={`text-sm ${
                    step.active ? 'font-semibold text-gray-900' : step.done ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
                {i < 1 && <div className="flex-1 h-px bg-gray-200 ml-2" />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Tell us about your business</h1>
            <p className="text-gray-500 text-sm mb-7">This information will be used to verify your merchant account.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={form.businessName}
                    onChange={set('businessName')}
                    placeholder="The Coffee Corner"
                    className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                      errors.businessName ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.businessName && <p className="text-xs text-red-500 mt-1">{errors.businessName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner name</label>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={set('ownerName')}
                  placeholder="Legal owner name as on registration"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                    errors.ownerName ? 'border-red-400' : 'border-gray-300'
                  }`}
                />
                {errors.ownerName && <p className="text-xs text-red-500 mt-1">{errors.ownerName}</p>}
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <MapPin size={16} className="text-brand-teal" />
                  Business address
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street line 1</label>
                  <input
                    type="text"
                    value={form.street1}
                    onChange={set('street1')}
                    placeholder="Building / street"
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
                      errors.street1 ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {errors.street1 && <p className="text-xs text-red-500 mt-1">{errors.street1}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street line 2 <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.street2}
                    onChange={set('street2')}
                    placeholder="Suite, unit, floor"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP / postal code</label>
                    <input
                      type="text"
                      value={form.zipCode}
                      onChange={set('zipCode')}
                      placeholder="00100"
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
                        errors.zipCode ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {errors.zipCode && <p className="text-xs text-red-500 mt-1">{errors.zipCode}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={set('city')}
                      placeholder="Colombo"
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
                        errors.city ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State / province</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={set('state')}
                      placeholder="Western Province"
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 ${
                        errors.state ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select
                      value={form.businessCountry}
                      onChange={set('businessCountry')}
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 bg-white ${
                        errors.businessCountry ? 'border-red-400' : 'border-gray-300'
                      }`}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {errors.businessCountry && <p className="text-xs text-red-500 mt-1">{errors.businessCountry}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRegistered}
                    onChange={set('isRegistered')}
                    className="w-4 h-4 rounded accent-brand-orange"
                  />
                  <span className="text-sm font-medium text-gray-700">This is a registered business</span>
                </label>

                {form.isRegistered && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Registration number</label>
                      <div className="relative">
                        <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={form.registrationNumber}
                          onChange={set('registrationNumber')}
                          placeholder="BR 12345678"
                          className={`w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                            errors.registrationNumber ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                      </div>
                      {errors.registrationNumber && (
                        <p className="text-xs text-red-500 mt-1">{errors.registrationNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Upload BR certificate <span className="text-gray-400 font-normal">(JPEG, PNG, or WebP)</span>
                      </label>
                      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                      {brFile ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                          <FileText size={16} className="text-green-600 shrink-0" />
                          <span className="text-sm text-green-700 flex-1 truncate">{brFile.name}</span>
                          <button type="button" onClick={() => setBrFile(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 hover:border-brand-orange hover:text-brand-orange transition-colors flex items-center justify-center gap-2"
                        >
                          <Upload size={16} />
                          Upload BR document (stored securely)
                        </button>
                      )}
                      {errors.brFile && <p className="text-xs text-red-500 mt-1">{errors.brFile}</p>}
                    </div>
                  </div>
                )}
              </div>

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{apiError}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="flex items-center gap-1 px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold transition-all hover:bg-brand-orange-hover disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader size={16} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      Submit application <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
