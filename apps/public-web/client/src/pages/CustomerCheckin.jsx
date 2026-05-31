import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Smartphone, Mail, User, Calendar, CheckCircle2, ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import axios from 'axios';

const COUNTRY_CODES = [
  { code: '+94', name: 'LK', flag: '🇱🇰' },
  { code: '+1', name: 'US/CA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+61', name: 'AU', flag: '🇦🇺' },
  { code: '+971', name: 'AE', flag: '🇦🇪' },
  { code: '+65', name: 'SG', flag: '🇸🇬' },
];

export default function CustomerCheckin() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId');
  const storeId = searchParams.get('storeId');
  const sessionId = searchParams.get('sessionId');

  // Merchant Branding Config (dynamic from API)
  const [branding, setBranding] = useState({
    businessName: 'Cafinity',
    logoUrl: '',
    primaryColor: '#0B1220',
    accentColor: '#e94560',
    bodyColor: '#0B1220',
    textColor: '#E2E8F0',
    buttonColor: '#E94560',
    buttonTextColor: '#F8FAFC',
    otpRequired: false,
  });

  const [loadingBrand, setLoadingBrand] = useState(true);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form Fields
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  // Custom Birthday Dropdowns (Year/Month/Day)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' },
  ];
  
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [days, setDays] = useState([]);

  // Calculate days in selected month & year
  useEffect(() => {
    if (birthMonth !== '' && birthYear !== '') {
      const daysInMonth = new Date(parseInt(birthYear), parseInt(birthMonth) + 1, 0).getDate();
      setDays(Array.from({ length: daysInMonth }, (_, i) => i + 1));
      if (birthDay > daysInMonth) setBirthDay('');
    } else {
      setDays(Array.from({ length: 31 }, (_, i) => i + 1));
    }
  }, [birthYear, birthMonth]);

  // OTP Fields
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Load merchant settings
  useEffect(() => {
    if (!tenantId) {
      setErrorMessage('Invalid URL: Merchant tenant ID is missing');
      setLoadingBrand(false);
      return;
    }

    axios
      .get(`/api/customer-checkin/tenant-info`, { params: { tenantId, storeId } })
      .then((res) => {
        setBranding((prev) => ({ ...prev, ...res.data }));
      })
      .catch((err) => {
        console.error('Failed to load branding', err);
      })
      .finally(() => {
        setLoadingBrand(false);
      });
  }, [tenantId, storeId]);

  const formatPhoneNumber = (value, countryCode) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) return '';
    
    if (countryCode === '+1') {
      if (clean.length <= 3) return clean;
      if (clean.length <= 6) return `(${clean.slice(0, 3)}) ${clean.slice(3)}`;
      return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6, 10)}`;
    } else if (countryCode === '+94') {
      if (clean.length <= 2) return clean;
      if (clean.length <= 5) return `${clean.slice(0, 2)} ${clean.slice(2)}`;
      return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 9)}`;
    } else if (countryCode === '+61') {
      if (clean.length <= 3) return clean;
      if (clean.length <= 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`;
      return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
    } else if (countryCode === '+44') {
      if (clean.length <= 4) return clean;
      return `${clean.slice(0, 4)} ${clean.slice(4, 10)}`;
    }
    
    const parts = [];
    for (let i = 0; i < clean.length; i += 4) {
      parts.push(clean.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  // Mobile format helper
  const handleMobileChange = (val) => {
    const formatted = formatPhoneNumber(val, selectedCountry.code);
    setMobileNumber(formatted);
  };

  const handleCountryChange = (country) => {
    setSelectedCountry(country);
    const cleanDigits = mobileNumber.replace(/\D/g, '');
    setMobileNumber(formatPhoneNumber(cleanDigits, country.code));
  };

  const handleInitiate = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanDigits = mobileNumber.replace(/\D/g, '');
    if (!cleanDigits) {
      setErrorMessage('Please enter a mobile number');
      return;
    }

    // Specific country validations
    let isValidMobile = false;
    let expectedFormat = '';
    if (selectedCountry.code === '+1') {
      isValidMobile = cleanDigits.length === 10;
      expectedFormat = '10 digits (e.g. 555-555-5555)';
    } else if (selectedCountry.code === '+94') {
      isValidMobile = cleanDigits.length === 9;
      expectedFormat = '9 digits (e.g. 771234567)';
    } else if (selectedCountry.code === '+61') {
      isValidMobile = cleanDigits.length === 9;
      expectedFormat = '9 digits (e.g. 412345678)';
    } else if (selectedCountry.code === '+44') {
      isValidMobile = cleanDigits.length === 10;
      expectedFormat = '10 digits';
    } else {
      isValidMobile = cleanDigits.length >= 7 && cleanDigits.length <= 15;
      expectedFormat = '7 to 15 digits';
    }

    if (!isValidMobile) {
      setErrorMessage(`Please enter a valid mobile number for ${selectedCountry.name} - expected ${expectedFormat}`);
      return;
    }

    if (isRegisterMode) {
      if (!name.trim()) {
        setErrorMessage('Name is required');
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrorMessage('Please enter a valid email address');
        return;
      }
    }

    const fullMobile = `${selectedCountry.code}${cleanDigits}`;
    let bdayString = undefined;
    if (isRegisterMode && birthYear && birthMonth !== '' && birthDay) {
      bdayString = new Date(parseInt(birthYear), parseInt(birthMonth), parseInt(birthDay)).toISOString();
    }

    setLoading(true);
    try {
      const payload = {
        tenantId,
        storeId,
        sessionId,
        mobile: fullMobile,
        name: isRegisterMode ? name : '',
        email: isRegisterMode ? email : '',
        birthday: bdayString,
      };

      const { data } = await axios.post('/api/customer-checkin/initiate', payload);

      if (data.otpRequired) {
        setOtpRequired(true);
      } else {
        setFormSubmitted(true);
        setSuccessMessage('Successfully checked into the order!');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Check-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (otpCode.length < 4) {
      setErrorMessage('Please enter a valid verification code');
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post('/api/customer-checkin/verify', {
        sessionId,
        otp: otpCode,
      });

      if (data.success) {
        setFormSubmitted(true);
        setSuccessMessage('Successfully verified and checked into order!');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Invalid or expired OTP code');
    } finally {
      setLoading(false);
    }
  };

  if (loadingBrand) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center text-slate-300">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300"
      style={{ backgroundColor: branding.bodyColor, color: branding.textColor }}
    >
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden p-6 flex flex-col space-y-6">
        {/* Merchant logo / title branding */}
        <div className="text-center">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Merchant Logo" className="h-14 mx-auto object-contain mb-3" />
          ) : (
            <h1 className="text-2xl font-bold tracking-wide text-white mb-2">{branding.businessName}</h1>
          )}
          <p className="text-xs text-slate-400">Order Check-in &amp; Loyalty Portal</p>
        </div>

        {formSubmitted ? (
          /* Success Screen */
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/35">
              <CheckCircle2 size={36} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Check-in Complete</h2>
            <p className="text-sm text-slate-300 px-4">
              Your contact info has been added to the ongoing order. The cashier will finalize it.
            </p>
            <p className="text-xs text-slate-500">You can safely close this browser window now.</p>
          </div>
        ) : otpRequired ? (
          /* OTP Form */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <button
              type="button"
              onClick={() => setOtpRequired(false)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">Enter OTP Verification Code</label>
              <p className="text-xs text-slate-500">We have sent a verification code to your phone number.</p>
              <input
                type="text"
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="w-full text-center tracking-widest font-mono text-xl font-bold bg-slate-800/40 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs flex items-center gap-1.5">
                <ShieldAlert size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otpCode.length < 4}
              style={{ backgroundColor: branding.buttonColor, color: branding.buttonTextColor }}
              className="w-full py-3.5 hover:opacity-90 disabled:opacity-60 font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verify & Check In'}
            </button>
          </form>
        ) : (
          /* Sign In / Register Form */
          <form onSubmit={handleInitiate} className="space-y-4">
            {/* Toggle tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-800/40 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => { setIsRegisterMode(false); setErrorMessage(''); }}
                className={`py-2 text-xs font-semibold rounded-md transition cursor-pointer ${!isRegisterMode ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegisterMode(true); setErrorMessage(''); }}
                className={`py-2 text-xs font-semibold rounded-md transition cursor-pointer ${isRegisterMode ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                New Register
              </button>
            </div>

            <div className="space-y-3.5">
              {isRegisterMode && (
                <>
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-350">Full Name</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-350">Email Address (Optional)</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Birthday (Custom Year/Month/Day Picker) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-350">Birthday (Optional)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={birthYear}
                        onChange={(e) => setBirthYear(e.target.value)}
                        className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-2 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Year</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>

                      <select
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(e.target.value)}
                        className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-2 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Month</option>
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>

                      <select
                        value={birthDay}
                        onChange={(e) => setBirthDay(e.target.value)}
                        className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-2 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">Day</option>
                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Mobile Input with Custom Country Selector */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-350">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="relative shrink-0">
                    <select
                      value={selectedCountry.code}
                      onChange={(e) => handleCountryChange(COUNTRY_CODES.find(c => c.code === e.target.value))}
                      className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative flex-1">
                    <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="tel"
                      placeholder="771234567"
                      value={mobileNumber}
                      onChange={(e) => handleMobileChange(e.target.value)}
                      className="w-full bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs flex items-center gap-1.5">
                <ShieldAlert size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !mobileNumber}
              style={{ backgroundColor: branding.buttonColor, color: branding.buttonTextColor }}
              className="w-full py-3.5 hover:opacity-90 disabled:opacity-60 font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : isRegisterMode ? 'Register & Check In' : 'Sign In & Check In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
