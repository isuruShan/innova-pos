import { useState, useEffect, useRef } from 'react';
import { getPublicWebUrl } from '@innovapos/app-urls';
import { useBranding } from '../../context/BrandingContext';
import { useStoreContext } from '../../context/StoreContext';
import { Package, Smartphone, Touchpad, CheckCircle2, User, Calendar, Mail, ArrowLeft, Monitor, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantPaidAddons } from '../../hooks/useTenantPaidAddons';
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
  const { user } = useAuth();
  const { selectedStoreId } = useStoreContext();
  const { data: paidAddons, isPending: isAddonsPending } = useTenantPaidAddons();
  const [orderState, setOrderState] = useState({
    items: [],
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    discountTotal: 0,
    customerSessionId: '',
    tenantId: '',
    storeId: '',
  });

  const [customerName, setCustomerName] = useState('');
  const [showInputScreen, setShowInputScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form States
  const [mobile, setMobile] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [activeField, setActiveField] = useState('mobile'); // 'mobile' | 'otp'

  const channelRef = useRef(null);

  function resetForm() {
    setMobile('');
    setSelectedCountry(COUNTRY_CODES[0]);
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
        } else {
          setCustomerName('');
        }
      } else if (type === 'CUSTOMER_CONNECTED') {
        const name = payload.name || 'Stranger';
        setCustomerName(name);
        setSuccessMessage(`Welcome back, ${name}!`);
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
    }
  };

  const handleTextSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (otpRequired) {
      if (otp.length < 4) {
        setErrorMessage('Please enter the verification code');
        return;
      }
      setLoading(true);
      try {
        const { data } = await axios.post(`/api/customer-checkin/verify`, {
          sessionId: orderState.customerSessionId,
          otp
        });
        if (data.success) {
          // Notify cashier screen
          if (channelRef.current) {
            channelRef.current.postMessage({
              type: 'CUSTOMER_CHECKED_IN_DIRECT',
              payload: {
                sessionId: orderState.customerSessionId,
                customer: data.customer
              }
            });
          }
          const customerDisplayName = data.customer?.name || 'Stranger';
          setCustomerName(customerDisplayName);
          if (customerDisplayName === 'Stranger') {
            setSuccessMessage('Hi there Stranger! Wanna sign up? Just ask your cashier.');
          } else {
            setSuccessMessage(`Welcome back, ${customerDisplayName}!`);
          }
          setShowInputScreen(false);
          setTimeout(() => setSuccessMessage(''), 6000);
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

    const fullMobile = `${selectedCountry.code}${cleanDigits}`;

    setLoading(true);
    try {
      const resolvedTenantId = orderState.tenantId || user?.tenantId || branding.tenantId || branding._id;
      const resolvedStoreId = orderState.storeId || selectedStoreId;
      const payload = {
        tenantId: resolvedTenantId,
        storeId: resolvedStoreId,
        sessionId: orderState.customerSessionId,
        mobile: fullMobile,
        name: '',
        email: '',
        birthday: undefined
      };

      const { data } = await axios.post(`/api/customer-checkin/initiate`, payload);

      if (data.otpRequired) {
        setOtpRequired(true);
        setActiveField('otp');
      } else {
        // Notify cashier screen directly that customer is resolved
        if (channelRef.current) {
          channelRef.current.postMessage({
            type: 'CUSTOMER_CHECKED_IN_DIRECT',
            payload: {
              sessionId: orderState.customerSessionId,
              customer: data.customer
            }
          });
        }
        const customerDisplayName = data.customer?.name || 'Stranger';
        setCustomerName(customerDisplayName);
        if (customerDisplayName === 'Stranger') {
          setSuccessMessage('Hi there Stranger! Wanna sign up? Just ask your cashier.');
        } else {
          setSuccessMessage(`Welcome back, ${customerDisplayName}!`);
        }
        setShowInputScreen(false);
        setTimeout(() => setSuccessMessage(''), 6000);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to submit check-in');
    } finally {
      setLoading(false);
    }
  };

  // Generate QR URL
  const resolvedTenantId = orderState.tenantId || user?.tenantId || branding.tenantId || branding._id || '';
  const resolvedStoreId = orderState.storeId || selectedStoreId || '';
  const qrTargetUrl = `${getPublicWebUrl() || 'http://localhost:5175'}/customer-checkin?tenantId=${resolvedTenantId}&storeId=${resolvedStoreId}&sessionId=${orderState.customerSessionId || ''}`;
  const qrCodeImgSrc = orderState.customerSessionId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}&color=ffffff&bgcolor=151f2e`
    : '';

  if (isAddonsPending) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center font-sans bg-[#0B1220] text-slate-200"
        style={{
          backgroundColor: branding.bodyColor || '#0B1220',
          color: branding.textColor || '#E2E8F0',
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium tracking-wide text-slate-400">Loading Customer Terminal...</p>
        </div>
      </div>
    );
  }

  if (paidAddons?.dualScreen !== true) {
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
          </div>
        </header>

        {/* Info/Subscribe Screen */}
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-950/20">
          <div className="max-w-2xl w-full bg-slate-900/60 border border-slate-800/60 backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Elegant glowing background elements */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Glowing Icon */}
            <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
              <Monitor className="w-10 h-10 text-amber-400" />
            </div>

            {/* Premium Addon Tag */}
            <span className="bg-amber-500/10 border border-amber-500/35 px-3 py-1 rounded-full text-xs font-semibold text-amber-400 uppercase tracking-widest mb-4">
              Premium Addon
            </span>

            {/* Title */}
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-4">
              Dual Screen Customer Terminal
            </h1>

            {/* Description */}
            <p className="text-slate-400 leading-relaxed max-w-md text-sm mb-8">
              Enable a beautiful secondary customer-facing display to show order breakdowns, display custom branding background images, run promotions, and let guests check in or sign up via QR code or phone number.
            </p>

            {/* Steps or details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left w-full max-w-lg mb-8">
              <div className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-2xl flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Interactive Check-In</h3>
                  <p className="text-xs text-slate-400 mt-1">Let customers sign up or scan to connect their loyalty account instantly.</p>
                </div>
              </div>
              <div className="p-4 bg-slate-800/40 border border-slate-700/40 rounded-2xl flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Custom Branding</h3>
                  <p className="text-xs text-slate-400 mt-1">Upload dynamic background images matching your store's style and vibe.</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-3 text-xs text-slate-400 max-w-md">
              <p>
                Go to the <span className="font-semibold text-white">Billing & Add-ons</span> tab in the Admin Portal to subscribe and unlock this feature instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              Greeting: Hello, {customerName === 'Stranger' ? 'Stranger' : customerName}!
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
                  <div className="flex justify-between text-sm text-emerald-400">
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
        <div 
          className="lg:col-span-5 flex flex-col justify-center p-6 relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: branding.customerTerminalBgUrl 
              ? `url(${branding.customerTerminalBgUrl})` 
              : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          }}
        >
          {/* Semi-transparent dark overlay for readability */}
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] z-0"></div>

          <div className="relative z-10 flex flex-col justify-center h-full items-center w-full">
            {successMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-center gap-2 mb-6 w-full max-w-[320px]">
                <CheckCircle2 size={18} />
                <span className="font-medium text-sm">{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm font-medium mb-6 w-full max-w-[320px]">
                {errorMessage}
              </div>
            )}

            {customerName || orderState.selectedCustomer ? (
              // Vivid, Glassmorphic Customer Greeting Card
              <div className="w-full max-w-[380px] bg-slate-900/60 border border-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-fade-in">
                {/* Subtle glowing elements */}
                <div className="absolute -top-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                  <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse" />
                </div>

                <span className="bg-emerald-500/15 border border-emerald-500/35 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                  Signed In
                </span>

                <p className="text-slate-450 text-xs uppercase tracking-widest font-bold mb-1">
                  Welcome back
                </p>

                <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)] truncate w-full px-2">
                  {customerName || orderState.selectedCustomer?.name || 'Stranger'}
                </h1>

                {customerName === 'Stranger' ? (
                  <p className="text-slate-300 text-sm leading-relaxed max-w-[260px] mb-6">
                    Hi there! Wanna sign up? Just ask your cashier.
                  </p>
                ) : (
                  <p className="text-slate-300 text-sm leading-relaxed max-w-[260px] mb-6">
                    You are earning loyalty points and active rewards on this order automatically!
                  </p>
                )}

                <button
                  onClick={() => {
                    if (channelRef.current) {
                      channelRef.current.postMessage({ type: 'CUSTOMER_DISCONNECTED' });
                    }
                    setCustomerName('');
                    resetForm();
                  }}
                  className="px-5 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-300 rounded-xl transition border border-white/5 hover:border-white/10 cursor-pointer"
                >
                  Not you? Disconnect
                </button>
              </div>
            ) : !orderState.customerSessionId ? (
              <div className="text-center py-12 text-slate-500 w-full">
                <Smartphone size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-slate-300">No Active Placement Session</p>
                <p className="text-xs opacity-70 mt-1 max-w-[200px] mx-auto text-slate-400">Start placing an order to link your account</p>
              </div>
            ) : !showInputScreen ? (
              <div className="flex flex-col items-center justify-center space-y-6 w-full">
                {/* QR Check-in Box - HIDDEN FOR NOW */}
                {/* <div className="bg-slate-800/50 border border-slate-800 p-5 rounded-2xl text-center flex flex-col items-center w-full max-w-[320px] shadow-lg backdrop-blur-sm">
                  <h3 className="text-sm font-semibold mb-3 text-slate-300">Scan QR Code to Check-in</h3>
                  <div className="w-[180px] h-[180px] bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-slate-700/50">
                    {qrCodeImgSrc && <img src={qrCodeImgSrc} alt="Check-in QR" className="w-[160px] h-[160px]" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-3.5 leading-relaxed">Use your mobile phone browser to earn points & rewards</p>
                </div>

                <div className="text-slate-500 text-xs font-bold tracking-wider">OR</div> */}

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
              <div className="flex flex-col space-y-5 w-full max-w-[320px] justify-between">
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
                      : 'Customer Check In'}
                  </h3>

                  {/* Form Input Blocks */}
                  <div className="space-y-3">
                    {!otpRequired && (
                      <>
                        {/* Mobile input with Country Selector */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-455">Mobile Number</label>
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

                {/* Numpad for Mobile / OTP */}
                <div className="bg-slate-800/35 border border-slate-800/80 p-3 rounded-xl">
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
    </div>
  );
}
