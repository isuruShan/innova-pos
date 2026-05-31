import { useState, useEffect, useRef } from 'react';
import { getPublicWebUrl } from '@innovapos/app-urls';
import { useBranding } from '../../context/BrandingContext';
import { useStoreContext } from '../../context/StoreContext';
import { Package, Smartphone, Touchpad, CheckCircle2, User, Calendar, Mail, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const COUNTRY_CODES = [
  { code: '+94', name: 'LK', flag: '🇱🇰' },
  { code: '+1', name: 'US/CA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+61', name: 'AU', flag: '🇦🇺' },
  { code: '+971', name: 'AE', flag: '🇦🇪' },
  { code: '+65', name: 'SG', flag: '🇸🇬' },
];

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

export default function CustomerTerminal() {
  const branding = useBranding();
  const { selectedStoreId } = useStoreContext();
  const [orderState, setOrderState] = useState({
    items: [],
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    discountTotal: 0,
    customerSessionId: '',
  });

  const [customerName, setCustomerName] = useState('');
  const [showInputScreen, setShowInputScreen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form States
  const [mobile, setMobile] = useState('');
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

  useEffect(() => {
    if (birthMonth !== '' && birthYear !== '') {
      const daysInMonth = new Date(parseInt(birthYear), parseInt(birthMonth) + 1, 0).getDate();
      setDays(Array.from({ length: daysInMonth }, (_, i) => i + 1));
      if (birthDay > daysInMonth) setBirthDay('');
    } else {
      setDays(Array.from({ length: 31 }, (_, i) => i + 1));
    }
  }, [birthYear, birthMonth]);

  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [activeField, setActiveField] = useState('mobile'); // 'mobile' | 'name' | 'email' | 'otp'

  const channelRef = useRef(null);

  function resetForm() {
    setMobile('');
    setSelectedCountry(COUNTRY_CODES[0]);
    setName('');
    setEmail('');
    setBirthYear('');
    setBirthMonth('');
    setBirthDay('');
    setOtp('');
    setOtpRequired(false);
    setShowInputScreen(false);
    setErrorMessage('');
    setSuccessMessage('');
    setActiveField('mobile');
  }

  useEffect(() => {
    // Connect to the dual monitor BroadcastChannel
    const channel = new BroadcastChannel('pos-dual-monitor');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'ORDER_UPDATE') {
        setOrderState(payload);
        if (payload.customerSessionId !== orderState.customerSessionId) {
          // New session started, reset terminal local customer state
          setCustomerName(payload.selectedCustomer?.name || '');
          resetForm();
        } else if (payload.selectedCustomer) {
          setCustomerName(payload.selectedCustomer.name);
        }
      } else if (type === 'CUSTOMER_CONNECTED') {
        setCustomerName(payload.name);
        setSuccessMessage(`Welcome back, ${payload.name}!`);
        setTimeout(() => setSuccessMessage(''), 4000);
        setShowInputScreen(false);
      } else if (type === 'ORDER_COMPLETED' || type === 'ORDER_CANCELLED') {
        setOrderState({
          items: [],
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
          discountTotal: 0,
          customerSessionId: '',
        });
        setCustomerName('');
        resetForm();
      }
    };

    return () => {
      channel.close();
    };
  }, [orderState.customerSessionId]);

  // Keyboard/Numpad inputs handler
  const handleKeyPress = (key) => {
    setErrorMessage('');
    if (activeField === 'mobile') {
      let clean = mobile.replace(/\D/g, '');
      if (key === 'BACK') {
        clean = clean.slice(0, -1);
      } else if (key === 'CLEAR') {
        clean = '';
      } else if (/^[0-9]$/.test(key) && clean.length < 15) {
        clean = clean + key;
      }
      setMobile(formatPhoneNumber(clean, selectedCountry.code));
    } else if (activeField === 'otp') {
      if (key === 'BACK') setOtp(prev => prev.slice(0, -1));
      else if (key === 'CLEAR') setOtp('');
      else if (/^[0-9]$/.test(key) && otp.length < 6) setOtp(prev => prev + key);
    } else if (activeField === 'name') {
      if (key === 'BACK') setName(prev => prev.slice(0, -1));
      else if (key === 'CLEAR') setName('');
      else if (key === 'SPACE') setName(prev => prev + ' ');
      else if (key.length === 1) setName(prev => prev + key);
    } else if (activeField === 'email') {
      if (key === 'BACK') setEmail(prev => prev.slice(0, -1));
      else if (key === 'CLEAR') setEmail('');
      else if (key.length === 1) setEmail(prev => prev + key);
    }
  };

  const handleTextSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const publicWebUrl = getPublicWebUrl() || 'http://localhost:5002';

    if (otpRequired) {
      if (otp.length < 4) {
        setErrorMessage('Please enter the verification code');
        return;
      }
      setLoading(true);
      try {
        const { data } = await axios.post(`${publicWebUrl}/api/customer-checkin/verify`, {
          sessionId: orderState.customerSessionId,
          otp
        });
        if (data.success) {
          // Notify cashier screen
          if (channelRef.current) {
            channelRef.current.postMessage({
              type: 'CUSTOMER_CHECKED_IN_DIRECT',
              payload: { sessionId: orderState.customerSessionId }
            });
          }
          setSuccessMessage('Check-in successful!');
          setTimeout(() => resetForm(), 3000);
        }
      } catch (err) {
        setErrorMessage(err.response?.data?.message || 'Verification failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Validation
    const cleanDigits = mobile.replace(/\D/g, '');
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
        tenantId: branding.tenantId || branding._id,
        storeId: selectedStoreId,
        sessionId: orderState.customerSessionId,
        mobile: fullMobile,
        name: isRegisterMode ? name : '',
        email: isRegisterMode ? email : '',
        birthday: bdayString
      };

      const { data } = await axios.post(`${publicWebUrl}/api/customer-checkin/initiate`, payload);

      if (data.otpRequired) {
        setOtpRequired(true);
        setActiveField('otp');
      } else {
        // Notify cashier screen directly that customer is resolved
        if (channelRef.current) {
          channelRef.current.postMessage({
            type: 'CUSTOMER_CHECKED_IN_DIRECT',
            payload: { sessionId: orderState.customerSessionId }
          });
        }
        setSuccessMessage('Check-in complete!');
        setTimeout(() => resetForm(), 3000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to submit check-in');
    } finally {
      setLoading(false);
    }
  };

  // Generate QR URL
  const tenantId = branding.tenantId || branding._id || '';
  const qrTargetUrl = `${getPublicWebUrl() || 'http://localhost:5175'}/customer-checkin?tenantId=${tenantId}&storeId=${selectedStoreId || ''}&sessionId=${orderState.customerSessionId || ''}`;
  const qrCodeImgSrc = orderState.customerSessionId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}&color=ffffff&bgcolor=151f2e`
    : '';

  return (
    <div 
      className="min-h-screen flex flex-col font-sans"
      style={{
        backgroundColor: branding.bodyColor || '#0B1220',
        color: branding.textColor || '#E2E8F0',
      }}
    >
      {/* Header bar */}
      <header 
        className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80"
        style={{ backgroundColor: branding.headerBarColor || '#151F2E' }}
      >
        <div className="flex items-center gap-4">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="logo" className="h-10 object-contain" />
          ) : (
            <span className="text-xl font-bold tracking-wide text-white">{branding.businessName}</span>
          )}
          {customerName && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400 animate-pulse">
              Greeting: Hello, {customerName}!
            </div>
          )}
        </div>
        <div className="text-sm font-medium text-slate-400">
          Customer Terminal
        </div>
      </header>

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Side: Order items */}
        <div className="lg:col-span-7 flex flex-col border-r border-slate-800/80 p-6 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
            <Package size={18} className="text-amber-500" />
            Your Order Details
          </h2>

          {orderState.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-500">
              <Package size={48} className="opacity-30 mb-3" />
              <p className="text-base font-medium">Ready to take your order</p>
              <p className="text-xs opacity-70 mt-1">Order details will appear here as items are added</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                {orderState.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-800/30 border border-slate-800/60 p-3 rounded-lg">
                    <div>
                      <div className="font-semibold text-slate-200">{item.name}</div>
                      {item.variantName && (
                        <div className="text-xs text-slate-500">{item.variantName}</div>
                      )}
                      <div className="text-xs text-slate-400 mt-0.5">
                        Qty: {item.qty} × {branding.currencySymbol}{Number(item.price).toFixed(2)}
                      </div>
                    </div>
                    <div className="font-semibold text-white">
                      {branding.currencySymbol}{(item.qty * item.price).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals panel */}
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-2.5">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Subtotal</span>
                  <span>{branding.currencySymbol}{Number(orderState.subtotal).toFixed(2)}</span>
                </div>
                {orderState.discountTotal > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Discount</span>
                    <span>-{branding.currencySymbol}{Number(orderState.discountTotal).toFixed(2)}</span>
                  </div>
                )}
                {orderState.taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Tax</span>
                    <span>{branding.currencySymbol}{Number(orderState.taxAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-slate-800/50">
                  <span>Total Amount</span>
                  <span className="text-amber-400">{branding.currencySymbol}{Number(orderState.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Customer Check-in / QR / Touchpad */}
        <div className="lg:col-span-5 flex flex-col justify-center p-6 bg-slate-900/40">
          {successMessage && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-center gap-2 mb-6">
              <CheckCircle2 size={18} />
              <span className="font-medium text-sm">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm font-medium mb-6">
              {errorMessage}
            </div>
          )}

          {!orderState.customerSessionId ? (
            <div className="text-center py-12 text-slate-500">
              <Smartphone size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No Active Placement Session</p>
              <p className="text-xs opacity-70 mt-1">Start placing an order to link your account</p>
            </div>
          ) : !showInputScreen ? (
            <div className="flex flex-col items-center justify-center space-y-6">
              {/* QR Check-in Box */}
              <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-2xl text-center flex flex-col items-center w-full max-w-[320px]">
                <h3 className="text-sm font-semibold mb-3 text-slate-300">Scan QR Code to Check-in</h3>
                <div className="w-[180px] h-[180px] bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-700/50">
                  {qrCodeImgSrc && <img src={qrCodeImgSrc} alt="Check-in QR" className="w-[160px] h-[160px]" />}
                </div>
                <p className="text-xs text-slate-400 mt-3.5">Use your mobile phone browser to earn points & rewards</p>
              </div>

              <div className="text-slate-600 text-xs">OR</div>

              {/* On-screen Input Button */}
              <button
                onClick={() => setShowInputScreen(true)}
                className="w-full max-w-[320px] py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                <Touchpad size={18} />
                Enter Mobile on Screen
              </button>
            </div>
          ) : (
            // On screen Form & Keypad Input Screen
            <div className="flex flex-col space-y-5 h-full justify-between">
              <div>
                <button
                  onClick={() => {
                    if (otpRequired) setOtpRequired(false);
                    else setShowInputScreen(false);
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4 transition cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>

                <h3 className="text-base font-semibold text-white mb-3">
                  {otpRequired 
                    ? 'Enter Verification Code' 
                    : isRegisterMode 
                      ? 'New Customer Registration' 
                      : 'Customer Sign In'}
                </h3>

                {/* Form Input Blocks */}
                <div className="space-y-3">
                  {!otpRequired && (
                    <>
                      {/* Sign in / Register Toggle */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-800/40 p-1 rounded-lg border border-slate-800">
                        <button
                          onClick={() => { setIsRegisterMode(false); setActiveField('mobile'); }}
                          className={`py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${!isRegisterMode ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Sign In
                        </button>
                        <button
                          onClick={() => { setIsRegisterMode(true); setActiveField('name'); }}
                          className={`py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${isRegisterMode ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Register
                        </button>
                      </div>

                      {isRegisterMode && (
                        <>
                          <div 
                            onClick={() => setActiveField('name')}
                            className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${activeField === 'name' ? 'border-amber-500 bg-slate-800/40' : 'border-slate-800 bg-slate-800/10'}`}
                          >
                            <User size={16} className="text-slate-400" />
                            <input
                              type="text"
                              placeholder="Customer Name"
                              value={name}
                              readOnly
                              className="bg-transparent border-none outline-none text-sm w-full text-slate-200"
                            />
                          </div>

                          <div 
                            onClick={() => setActiveField('email')}
                            className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition ${activeField === 'email' ? 'border-amber-500 bg-slate-800/40' : 'border-slate-800 bg-slate-800/10'}`}
                          >
                            <Mail size={16} className="text-slate-400" />
                            <input
                              type="email"
                              placeholder="Email Address"
                              value={email}
                              readOnly
                              className="bg-transparent border-none outline-none text-sm w-full text-slate-200"
                            />
                          </div>

                          {/* Birthday Dropdowns */}
                          <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-400">Birthday (Optional)</label>
                            <div className="grid grid-cols-3 gap-2">
                              <select
                                value={birthYear}
                                onChange={(e) => setBirthYear(e.target.value)}
                                className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-2 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                              >
                                <option value="">Year</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>

                              <select
                                value={birthMonth}
                                onChange={(e) => setBirthMonth(e.target.value)}
                                className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-2 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                              >
                                <option value="">Month</option>
                                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>

                              <select
                                value={birthDay}
                                onChange={(e) => setBirthDay(e.target.value)}
                                className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-2 py-2.5 text-xs outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                              >
                                <option value="">Day</option>
                                {days.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Mobile input with Country Selector */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-450">Mobile Number</label>
                        <div className="flex gap-2">
                          <div className="relative shrink-0">
                            <select
                              value={selectedCountry.code}
                              onChange={(e) => {
                                const country = COUNTRY_CODES.find(c => c.code === e.target.value);
                                setSelectedCountry(country);
                                const cleanDigits = mobile.replace(/\D/g, '');
                                setMobile(formatPhoneNumber(cleanDigits, country.code));
                              }}
                              className="bg-slate-850 border border-slate-700/60 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                            >
                              {COUNTRY_CODES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.flag} {c.code}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div 
                            onClick={() => setActiveField('mobile')}
                            className={`flex-1 p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${activeField === 'mobile' ? 'border-amber-500 bg-slate-800/40' : 'border-slate-800 bg-slate-800/10'}`}
                          >
                            <Smartphone size={16} className="text-slate-400" />
                            <input
                              type="text"
                              placeholder="771234567"
                              value={mobile}
                              readOnly
                              className="bg-transparent border-none outline-none text-sm w-full text-slate-200 pointer-events-none"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {otpRequired && (
                    <div 
                      onClick={() => setActiveField('otp')}
                      className={`p-3 rounded-lg border text-center cursor-pointer transition ${activeField === 'otp' ? 'border-amber-500 bg-slate-800/40' : 'border-slate-800 bg-slate-800/10'}`}
                    >
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        readOnly
                        className="bg-transparent border-none outline-none text-lg tracking-widest text-center w-full font-bold text-amber-400"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic keyboard/numpad display */}
              <div className="bg-slate-800/35 border border-slate-800/80 p-3 rounded-xl">
                {activeField === 'name' || activeField === 'email' ? (
                  // QWERTY on-screen keyboard
                  <div className="grid grid-cols-10 gap-1 text-xs">
                    {['q','w','e','r','t','y','u','i','o','p'].map(k => (
                      <button key={k} onClick={() => handleKeyPress(k)} className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 rounded font-semibold text-white transition cursor-pointer">{k}</button>
                    ))}
                    {['a','s','d','f','g','h','j','k','l','@'].map(k => (
                      <button key={k} onClick={() => handleKeyPress(k)} className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 rounded font-semibold text-white transition cursor-pointer">{k}</button>
                    ))}
                    <button onClick={() => handleKeyPress('.com')} className="col-span-2 py-2.5 bg-slate-850 hover:bg-slate-750 rounded text-slate-300 font-semibold cursor-pointer">.com</button>
                    {['z','x','c','v','b','n','m','.','_','-'].map(k => (
                      <button key={k} onClick={() => handleKeyPress(k)} className="py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 rounded font-semibold text-white transition cursor-pointer">{k}</button>
                    ))}
                    <button onClick={() => handleKeyPress('SPACE')} className="col-span-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded font-semibold text-white transition cursor-pointer">Space</button>
                    <button onClick={() => handleKeyPress('BACK')} className="col-span-3 py-2.5 bg-red-950/60 hover:bg-red-900/60 text-red-400 rounded font-semibold transition cursor-pointer">Backspace</button>
                    <button onClick={() => handleKeyPress('CLEAR')} className="col-span-3 py-2.5 bg-slate-850 hover:bg-slate-750 text-slate-400 rounded font-semibold transition cursor-pointer">Clear</button>
                  </div>
                ) : (
                  // Numpad for Mobile / OTP
                  <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleKeyPress(num.toString())}
                        className="py-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 rounded-lg text-lg font-bold text-white transition cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => handleKeyPress('+')}
                      className="py-3 bg-slate-850 hover:bg-slate-800 rounded-lg text-lg font-bold text-slate-400 transition cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleKeyPress('0')}
                      className="py-3 bg-slate-800 hover:bg-slate-700 active:bg-amber-500 rounded-lg text-lg font-bold text-white transition cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      onClick={() => handleKeyPress('BACK')}
                      className="py-3 bg-red-950/50 hover:bg-red-900/50 rounded-lg text-xs font-semibold text-red-400 transition cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleKeyPress('CLEAR')}
                      className="col-span-3 py-2 bg-slate-850 hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-400 transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleTextSubmit}
                disabled={loading}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-900 font-bold rounded-xl shadow-lg transition text-sm cursor-pointer"
              >
                {loading ? 'Processing...' : otpRequired ? 'Verify OTP' : 'Check In'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
