import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, MapPin, FileText, Upload, X, ArrowLeft, ArrowRight, Loader, CheckCircle } from 'lucide-react';
import { COUNTRIES } from '../constants/countries';
import api from '../api';
import SignupShell from '../components/SignupShell';
import { fieldAttrs, validateEmail, validateSignupBusiness } from '../utils/formFields';

const ENTERPRISE_DISPLAY = {
  name: 'Custom',
  priceLabel: 'Tailored',
  cycle: 'custom pricing',
  lines: [
    'Custom registers limit',
    'Unlimited KDS screens',
    'Multi-branch HQ analytics',
    'Dedicated support manager',
    'API access integrations',
  ]
};

const pricingLinesForPlan = (plan) => {
  if (plan.featureLines?.length) return plan.featureLines;
  if (plan.code?.includes('standard')) {
    return [
      'Counter & Table POS registers',
      'Barista & Kitchen KDS screens',
      'Inventory cost mix insights',
      'Multi-terminal syncing',
    ];
  }
  return [
    'Counter & Table POS registers',
    'Barista & Kitchen KDS screens',
    'Inventory cost mix insights',
    'Multi-terminal syncing',
    'Premium features included',
  ];
};

const buildPlanCardBackground = (plan) => {
  if (plan.planCardBgMode === 'solid') return plan.planCardSolidColor || '#ffffff';
  if (plan.planCardBgMode === 'gradient') {
    const from = plan.planCardGradFrom || '#ffffff';
    const to = plan.planCardGradTo || '#f1f5f9';
    const angle = plan.planCardGradAngle || 145;
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  return null;
};

const planUsesLightText = (plan) => {
  return plan.planCardBgMode !== 'default' && plan.planCardUseLightText;
};

const buildPlanTagBackground = (plan) => {
  if (plan.planTagBgMode === 'solid') return plan.planTagSolidColor || '#fa7237';
  if (plan.planTagBgMode === 'gradient') {
    const from = plan.planTagGradFrom || '#fa7237';
    const to = plan.planTagGradTo || '#233d4d';
    const angle = plan.planTagGradAngle || 135;
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }
  return '#fa7237';
};

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
  const [step, setStep] = useState(2); // 2 = Business details, 3 = Plan selection
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(''); // planId or 'custom'
  const [selectedCycle, setSelectedCycle] = useState('monthly'); // 'monthly' or 'yearly'

  useEffect(() => {
    if (step === 3 && plans.length === 0) {
      let cancelled = false;
      const audience = form.businessCountry === 'Sri Lanka' ? 'local' : 'international';
      api.get('/plans/public', { params: { audience } })
        .then(({ data }) => {
          if (!cancelled) {
            const planList = Array.isArray(data) ? data : [];
            setPlans(planList);
            if (planList.length > 0) {
              setSelectedPlanId(planList[0]._id);
            } else {
              setSelectedPlanId('custom');
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load plans:', err);
        })
        .finally(() => {
          if (!cancelled) setPlansLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [step, form.businessCountry, plans.length]);

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
    const bizStored = sessionStorage.getItem('signup_business');
    if (bizStored) {
      try {
        const b = JSON.parse(bizStored);
        setForm((f) => ({
          ...f,
          businessName: b.businessName ?? f.businessName,
          ownerName: b.ownerName ?? f.ownerName,
          street1: b.street1 ?? f.street1,
          street2: b.street2 ?? f.street2,
          zipCode: b.zipCode ?? f.zipCode,
          city: b.city ?? f.city,
          state: b.state ?? f.state,
          businessCountry: b.businessCountry ?? f.businessCountry,
          isRegistered: Boolean(b.isRegistered),
          registrationNumber: b.registrationNumber ?? f.registrationNumber,
        }));
      } catch {
        /* ignore */
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (!personal) return;
    sessionStorage.setItem('signup_business', JSON.stringify(form));
  }, [form, personal]);

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
    const e = validateSignupBusiness(form, { isRegistered: form.isRegistered });
    if (form.isRegistered && !brFile) e.brFile = 'BR certificate image is required';
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

  const handleNextStep = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (step === 2) {
      return handleNextStep(e);
    }

    if (!selectedPlanId) {
      setErrors({ plan: 'Please select a subscription plan to continue' });
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
      if (personal.countryIso) fd.append('countryIso', personal.countryIso);
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

      // Append plan fields
      fd.append('requestedPlanId', selectedPlanId);
      fd.append('requestedBillingCycle', selectedPlanId === 'custom' ? 'custom' : selectedCycle);

      // Let axios set multipart boundary — explicit Content-Type breaks file uploads
      await api.post('/applications', fd);

      sessionStorage.removeItem('signup_personal');
      sessionStorage.removeItem('signup_business');
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

  const businessAttrs = fieldAttrs('businessName');
  const ownerAttrs = fieldAttrs('ownerName');
  const street1Attrs = fieldAttrs('addressLine1');
  const street2Attrs = fieldAttrs('addressLine2');
  const zipAttrs = fieldAttrs('postalCode');
  const cityAttrs = fieldAttrs('city');
  const stateAttrs = fieldAttrs('region');
  const regAttrs = fieldAttrs('registrationNumber');  return (
    <SignupShell>
      <div className="flex items-start justify-center px-4 py-12">
        <div className={`w-full transition-all duration-300 ${step === 3 ? 'max-w-4xl' : 'max-w-2xl'}`}>
          <div className="flex items-center gap-3 mb-8">
            {[
              { n: 1, label: 'Personal details', done: true },
              { n: 2, label: 'Business details', done: step > 2, active: step === 2 },
              { n: 3, label: 'Choose plan', active: step === 3 },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    s.done ? 'bg-green-500 text-white' : s.active ? 'bg-brand-orange text-white' : 'bg-gray-250 text-gray-400 border border-gray-200'
                  }`}
                >
                  {s.done ? '✓' : s.n}
                </div>
                <span
                  className={`text-sm ${
                    s.active ? 'font-semibold text-gray-900' : s.done ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
                {i < 2 && <div className="flex-1 h-px bg-gray-200 ml-2" />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-xs">
            {step === 2 ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Tell us about your business</h1>
                <p className="text-gray-500 text-sm mb-7">This information will be used to verify your merchant account.</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Select your subscription plan</h1>
                <p className="text-gray-500 text-sm mb-7">Choose the plan you want to start with when your 14-day free trial ends. No payment is required now.</p>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 2 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={form.businessName}
                        onChange={set('businessName')}
                        placeholder={businessAttrs.placeholder}
                        maxLength={businessAttrs.maxLength}
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
                      placeholder={ownerAttrs.placeholder}
                      maxLength={ownerAttrs.maxLength}
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
                        placeholder={street1Attrs.placeholder}
                        maxLength={street1Attrs.maxLength}
                        autoComplete={street1Attrs.autoComplete}
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
                        placeholder={street2Attrs.placeholder}
                        maxLength={street2Attrs.maxLength}
                        autoComplete={street2Attrs.autoComplete}
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
                          placeholder={zipAttrs.placeholder}
                          maxLength={zipAttrs.maxLength}
                          autoComplete={zipAttrs.autoComplete}
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
                          placeholder={cityAttrs.placeholder}
                          maxLength={cityAttrs.maxLength}
                          autoComplete={cityAttrs.autoComplete}
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
                          placeholder={stateAttrs.placeholder}
                          maxLength={stateAttrs.maxLength}
                          autoComplete={stateAttrs.autoComplete}
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
                              placeholder={regAttrs.placeholder}
                              maxLength={regAttrs.maxLength}
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
                </>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  {/* Billing cycle toggle */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="inline-flex rounded-xl border border-gray-250 p-1 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setSelectedCycle('monthly')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                          selectedCycle === 'monthly'
                            ? 'bg-brand-orange text-white shadow-md'
                            : 'text-gray-550 hover:text-gray-700 bg-transparent'
                        }`}
                      >
                        Monthly billing
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCycle('yearly')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                          selectedCycle === 'yearly'
                            ? 'bg-brand-orange text-white shadow-md'
                            : 'text-gray-550 hover:text-gray-700 bg-transparent'
                        }`}
                      >
                        Yearly billing (Save)
                      </button>
                    </div>
                  </div>

                  {plansLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="min-h-[350px] rounded-2xl border border-gray-200 bg-gray-50 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                      {plans.map((plan) => {
                        const bulletLines = pricingLinesForPlan(plan);
                        const customCardBg = buildPlanCardBackground(plan);
                        const builtInFeatured = plan.isDefault && !customCardBg;
                        const lightOnCard = planUsesLightText(plan);
                        const showRibbon = plan.planTagShow && String(plan.planTagText || '').trim();
                        const ribbonBg = showRibbon ? buildPlanTagBackground(plan) : null;

                        const isSelected = selectedPlanId === plan._id;
                        const price = selectedCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                        const displayPrice = `${plan.currency} ${price.toLocaleString()}`;

                        let cardClass = `relative rounded-2xl p-6 border flex flex-col min-h-[385px] transition-all cursor-pointer hover:shadow-md ${
                          isSelected
                            ? 'ring-2 ring-brand-orange border-transparent scale-[1.01]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`;
                        let cardStyle = undefined;
                        if (customCardBg) {
                          cardStyle = { background: customCardBg };
                        }

                        return (
                          <div
                            key={plan._id}
                            className={cardClass}
                            style={cardStyle}
                            onClick={() => setSelectedPlanId(plan._id)}
                          >
                            {showRibbon && ribbonBg && (
                              <div
                                className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold shadow-sm max-w-[90%] truncate text-white"
                                style={{ background: ribbonBg }}
                              >
                                {plan.planTagText}
                              </div>
                            )}

                            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${lightOnCard ? 'text-white/80' : 'text-gray-450'}`}>
                              {plan.name}
                            </div>
                            <div className={`text-2xl font-extrabold tracking-tight ${lightOnCard ? 'text-white' : 'text-gray-900'}`}>
                              {displayPrice}
                            </div>
                            <div className={`text-[10px] uppercase tracking-wider mb-6 ${lightOnCard ? 'text-white/60' : 'text-gray-400'}`}>
                              {selectedCycle === 'yearly' ? 'per 365 days' : 'per 30 days'}
                            </div>

                            <ul className="space-y-2.5 mb-6 flex-1">
                              {bulletLines.map((line, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs">
                                  <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                                  <span className={lightOnCard ? 'text-white/90' : 'text-gray-650'}>{line}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}

                      {/* Enterprise/Custom Plan */}
                      <div
                        className={`relative rounded-2xl p-6 border flex flex-col min-h-[385px] transition-all cursor-pointer hover:shadow-md ${
                          selectedPlanId === 'custom'
                            ? 'ring-2 ring-brand-orange border-transparent scale-[1.01]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedPlanId('custom')}
                      >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-brand-orange text-white">
                          Tailor-made
                        </div>
                        <div className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-450">
                          {ENTERPRISE_DISPLAY.name}
                        </div>
                        <div className="text-2xl font-extrabold tracking-tight text-gray-900">
                          {ENTERPRISE_DISPLAY.priceLabel}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider mb-6 text-gray-400">
                          {ENTERPRISE_DISPLAY.cycle}
                        </div>

                        <ul className="space-y-2.5 mb-6 flex-1">
                          {ENTERPRISE_DISPLAY.lines.map((line, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs">
                              <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                              <span className="text-gray-650">{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  {errors.plan && <p className="text-xs text-red-500 mt-2 text-center">{errors.plan}</p>}
                </div>
              )}

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{apiError}</div>
              )}

              {step === 2 ? (
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
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-orange text-white text-sm font-semibold transition-all hover:bg-brand-orange-hover"
                  >
                    Continue to Plan Selection <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
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
                        Submit Application & Start Trial <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </SignupShell>
  );
}
