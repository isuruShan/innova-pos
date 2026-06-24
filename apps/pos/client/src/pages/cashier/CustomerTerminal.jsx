import { useState, useEffect, useRef } from 'react';
import { getPublicWebUrl } from '@innovapos/app-urls';
import { useBranding } from '../../context/BrandingContext';
import { useStoreContext } from '../../context/StoreContext';
import { Package, Smartphone, Touchpad, CheckCircle2, ArrowLeft, Monitor, Sparkles } from 'lucide-react';
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
        const prevSelectedCustomer = orderState.selectedCustomer;
        setOrderState(payload);
        if (payload.customerSessionId !== orderState.customerSessionId) {
          // New session started, reset terminal local customer state
          setCustomerName(payload.selectedCustomer?.name || '');
          resetForm();
        } else if (payload.selectedCustomer) {
          setCustomerName(payload.selectedCustomer.name);
        } else {
          // Only clear customerName if the cashier explicitly deselected/removed the customer
          if (prevSelectedCustomer && !payload.selectedCustomer) {
            setCustomerName('');
          }
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
  }, [orderState.customerSessionId, orderState.selectedCustomer]);

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
  const qrTargetUrl = `${getPublicWebUrl() || 'https://cafinity.io'}/customer-checkin?tenantId=${resolvedTenantId}&storeId=${resolvedStoreId}&sessionId=${orderState.customerSessionId || ''}`;
  const qrCodeImgSrc = orderState.customerSessionId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrTargetUrl)}&color=000000&bgcolor=ffffff`
    : '';

  if (isAddonsPending) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center font-sans bg-[var(--pos-page-bg)] text-[var(--pos-text-primary)]"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium tracking-wide text-[var(--pos-text-secondary)]">Loading Customer Terminal...</p>
        </div>
      </div>
    );
  }

  if (paidAddons?.dualScreen !== true) {
    return (
      <div 
        className="min-h-screen flex flex-col font-sans bg-[var(--pos-page-bg)] text-[var(--pos-text-primary)]"
      >
        {/* Header bar */}
        <header 
          className="px-6 py-4 flex items-center justify-between border-b border-[var(--pos-grid-line)] bg-[var(--pos-panel)]"
        >
          <div className="flex items-center gap-4">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="logo" className="h-10 object-contain" />
            ) : (
              <span className="text-xl font-bold tracking-wide text-[var(--pos-text-primary)]">{branding.businessName}</span>
            )}
          </div>
        </header>

        {/* Info/Subscribe Screen */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[var(--pos-surface-inset)]/30">
          <div className="max-w-2xl w-full bg-[var(--pos-panel)] border border-[var(--pos-grid-line)] p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Glowing background */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${branding.buttonColor || '#E94560'}20` }}></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: `${branding.buttonColor || '#E94560'}20` }}></div>

            {/* Glowing Icon */}
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-md border border-[var(--pos-grid-line)] bg-[var(--pos-surface-inset)]"
            >
              <Monitor className="w-10 h-10" style={{ color: branding.buttonColor || '#E94560' }} />
            </div>

            {/* Premium Addon Tag */}
            <span 
              className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4 border border-[var(--pos-grid-line)] bg-[var(--pos-surface-inset)]"
              style={{ color: branding.buttonColor || '#E94560' }}
            >
              Premium Addon
            </span>

            {/* Title */}
            <h1 className="text-3xl font-extrabold text-[var(--pos-text-primary)] tracking-tight mb-4">
              Dual Screen Customer Terminal
            </h1>

            {/* Description */}
            <p className="text-[var(--pos-text-secondary)] leading-relaxed max-w-md text-sm mb-8">
              Enable a beautiful secondary customer-facing display to show order breakdowns, display custom branding background images, run promotions, and let guests check in or sign up via QR code or phone number.
            </p>

            {/* Steps or details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left w-full max-w-lg mb-8">
              <div className="p-4 bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)] rounded-2xl flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--pos-text-primary)]">Interactive Check-In</h3>
                  <p className="text-xs text-[var(--pos-text-secondary)] mt-1">Let customers sign up or scan to connect their loyalty account instantly.</p>
                </div>
              </div>
              <div className="p-4 bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)] rounded-2xl flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--pos-text-primary)]">Custom Branding</h3>
                  <p className="text-xs text-[var(--pos-text-secondary)] mt-1">Upload dynamic background images matching your store's style and vibe.</p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)] rounded-xl px-5 py-3 text-xs text-[var(--pos-text-secondary)] max-w-md">
              <p>
                Go to the <span className="font-semibold text-[var(--pos-text-primary)]">Billing &amp; Add-ons</span> tab in the Admin Portal to subscribe and unlock this feature instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col font-sans bg-[var(--pos-page-bg)] text-[var(--pos-text-primary)]"
    >
      {/* Header bar */}
      <header 
        className="px-6 py-4 flex items-center justify-between border-b border-[var(--pos-grid-line)] bg-[var(--pos-panel)]"
      >
        <div className="flex items-center gap-4">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="logo" className="h-10 object-contain" />
          ) : (
            <span className="text-xl font-bold tracking-wide text-[var(--pos-text-primary)]">{branding.businessName}</span>
          )}
          {customerName && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400 animate-pulse">
              Hello, {customerName === 'Stranger' ? 'Stranger' : customerName}!
            </div>
          )}
        </div>
        <div className="text-sm font-medium text-[var(--pos-text-secondary)]">
          Customer Terminal
        </div>
      </header>

      {/* Main content grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Side: Order items */}
        <div className="lg:col-span-7 flex flex-col border-r border-[var(--pos-grid-line)] p-6 overflow-y-auto lg:overflow-hidden lg:h-full bg-[var(--pos-surface-inset)]/30">
          <div className="max-w-xl mx-auto w-full flex-1 flex flex-col bg-[var(--pos-panel)] border border-[var(--pos-grid-line)] rounded-3xl shadow-2xl p-6 relative overflow-hidden max-h-full">
            {/* Glowing top line */}
            <div 
              className="absolute top-0 inset-x-0 h-1.5"
              style={{ backgroundColor: branding.buttonColor || '#E94560' }}
            ></div>

            {/* Receipt Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--pos-grid-line)] mb-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)]">
                  <Sparkles size={16} style={{ color: branding.buttonColor || '#E94560' }} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--pos-text-primary)] tracking-wide uppercase">Your Selection</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[9px] text-[var(--pos-text-muted)] font-bold uppercase tracking-wider">Live Sync Active</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-[var(--pos-text-muted)] font-bold uppercase tracking-wider block">Items</span>
                <span className="text-xs font-black text-[var(--pos-text-primary)] bg-[var(--pos-surface-inset)] px-2.5 py-0.5 rounded-md border border-[var(--pos-grid-line)]">
                  {orderState.items.reduce((acc, it) => acc + it.qty, 0)}
                </span>
              </div>
            </div>

            {orderState.items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-[var(--pos-text-secondary)]">
                {/* Cute visual welcome card for empty state */}
                <div className="w-16 h-16 rounded-2xl bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)] flex items-center justify-center mb-6 shadow-sm">
                  <Package size={28} className="opacity-80 text-[var(--pos-text-muted)]" />
                </div>
                
                <h3 className="text-xl font-extrabold text-[var(--pos-text-primary)] tracking-tight">
                  Welcome to {branding.businessName}
                </h3>
                <p className="text-xs text-[var(--pos-text-muted)] mt-1.5 max-w-[280px] text-center leading-relaxed font-medium">
                  Start ordering with our cashier. Your live cart details and totals will appear here in real-time.
                </p>

                {/* Cute features banner */}
                <div className="mt-8 grid grid-cols-1 gap-3 w-full max-w-sm">
                  <div className="p-3.5 bg-[var(--pos-surface-inset)]/50 border border-[var(--pos-grid-line)] rounded-2xl flex gap-3">
                    <span className="text-lg">⭐</span>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--pos-text-primary)]">Loyalty Rewards</h4>
                      <p className="text-[10px] text-[var(--pos-text-muted)] mt-0.5">Collect points on every purchase and redeem them for free food/drinks.</p>
                    </div>
                  </div>
                  <div className="p-3.5 bg-[var(--pos-surface-inset)]/50 border border-[var(--pos-grid-line)] rounded-2xl flex gap-3">
                    <span className="text-lg">📱</span>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--pos-text-primary)]">Instant Check-In</h4>
                      <p className="text-[10px] text-[var(--pos-text-muted)] mt-0.5">Scan the QR code on the right with your phone to instantly link your account.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                {/* Scrollable Items list */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                  {orderState.items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-center bg-[var(--pos-surface-inset)]/30 border border-[var(--pos-grid-line)] p-3.5 rounded-2xl shadow-sm hover:border-[var(--pos-text-muted)]/20 transition-all"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="font-semibold text-sm text-[var(--pos-text-primary)] truncate">{item.name}</div>
                        {item.variantName && (
                          <div className="text-[11px] text-[var(--pos-text-muted)] font-medium mt-0.5">{item.variantName}</div>
                        )}
                        <div className="text-xs text-[var(--pos-text-secondary)] mt-1 font-medium">
                          Qty: <span className="font-bold" style={{ color: branding.buttonColor || '#E94560' }}>{item.qty}</span> × {branding.currencySymbol}{Number(item.price).toFixed(2)}
                        </div>
                      </div>
                      <div className="font-extrabold text-[var(--pos-text-primary)] text-base shrink-0">
                        {branding.currencySymbol}{(item.qty * item.price).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scalloped Dotted Divider (Cute Ticket Cutouts) */}
                <div className="relative flex items-center my-4 shrink-0">
                  {/* Left Circle cutout */}
                  <div className="absolute -left-[30px] w-4 h-4 bg-[var(--pos-page-bg)] rounded-full border-r border-[var(--pos-grid-line)]"></div>
                  {/* Dashed line */}
                  <div className="w-full border-t-2 border-dashed border-[var(--pos-grid-line)]"></div>
                  {/* Right Circle cutout */}
                  <div className="absolute -right-[30px] w-4 h-4 bg-[var(--pos-page-bg)] rounded-full border-l border-[var(--pos-grid-line)]"></div>
                </div>

                {/* Totals panel */}
                <div className="space-y-2 shrink-0 bg-[var(--pos-surface-inset)]/45 p-4 rounded-2xl border border-[var(--pos-grid-line)]">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--pos-text-secondary)]">Subtotal</span>
                    <span className="text-[var(--pos-text-primary)]">{branding.currencySymbol}{Number(orderState.subtotal).toFixed(2)}</span>
                  </div>
                  {orderState.discountTotal > 0 && (
                    <div className="flex justify-between text-xs text-emerald-500 font-bold">
                      <span>Discount</span>
                      <span>-{branding.currencySymbol}{Number(orderState.discountTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {orderState.taxAmount > 0 && (
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-[var(--pos-text-secondary)]">Tax</span>
                      <span className="text-[var(--pos-text-primary)]">{branding.currencySymbol}{Number(orderState.taxAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm font-extrabold text-[var(--pos-text-primary)] pt-2.5 border-t border-[var(--pos-grid-line)] mt-2">
                    <span className="text-[var(--pos-text-secondary)]">Total Amount</span>
                    <span 
                      className="font-black text-2xl tracking-tight"
                      style={{ color: branding.buttonColor || '#E94560' }}
                    >
                      {branding.currencySymbol}{Number(orderState.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Customer Check-in / QR / Touchpad */}
        <div 
          className="lg:col-span-5 flex flex-col justify-center p-6 relative overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage: branding.customerTerminalBgUrl 
              ? `url(${branding.customerTerminalBgUrl})` 
              : 'linear-gradient(135deg, var(--pos-page-bg) 0%, var(--pos-panel) 100%)',
          }}
        >
          {/* Semi-transparent dark overlay for readability */}
          <div className="absolute inset-0 bg-black/60 z-0"></div>

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
              <div className="w-full max-w-[380px] bg-[var(--pos-panel)]/95 backdrop-blur-xl border border-[var(--pos-grid-line)] p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-fade-in">
                {/* Subtle glowing elements */}
                <div className="absolute -top-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                  <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse" />
                </div>

                <span className="bg-emerald-500/15 border border-emerald-500/35 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                  Signed In
                </span>

                <p className="text-[var(--pos-text-secondary)] text-xs uppercase tracking-widest font-bold mb-1">
                  Welcome back
                </p>

                <h1 className="text-4xl sm:text-5xl font-extrabold text-[var(--pos-text-primary)] tracking-tight mb-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)] truncate w-full px-2">
                  {customerName || orderState.selectedCustomer?.name || 'Stranger'}
                </h1>

                {customerName === 'Stranger' ? (
                  <p className="text-[var(--pos-text-secondary)] text-sm leading-relaxed max-w-[260px] mb-6 font-medium">
                    Hi there! Wanna sign up? Just ask your cashier.
                  </p>
                ) : (
                  paidAddons?.loyalty === true && (
                    <p className="text-[var(--pos-text-secondary)] text-sm leading-relaxed max-w-[260px] mb-6 font-medium">
                      You are earning loyalty points and active rewards on this order automatically!
                    </p>
                  )
                )}

                <button
                  onClick={() => {
                    if (channelRef.current) {
                      channelRef.current.postMessage({ type: 'CUSTOMER_DISCONNECTED' });
                    }
                    setCustomerName('');
                    resetForm();
                  }}
                  className="px-5 py-2.5 bg-[var(--pos-surface-inset)] hover:bg-[var(--pos-page-bg)] text-xs font-semibold text-[var(--pos-text-secondary)] rounded-xl transition border border-[var(--pos-grid-line)] cursor-pointer"
                >
                  Not you? Disconnect
                </button>
              </div>
            ) : !orderState.customerSessionId ? (
              <div className="text-center py-12 text-[var(--pos-text-secondary)] w-full">
                <Smartphone size={32} className="mx-auto mb-3 opacity-60 text-[var(--pos-text-secondary)]" />
                <p className="text-sm font-semibold text-[var(--pos-text-primary)]">No Active Placement Session</p>
                <p className="text-xs mt-1 max-w-[200px] mx-auto text-[var(--pos-text-muted)]">Start placing an order to link your account</p>
              </div>
            ) : !showInputScreen ? (
              <div className="flex flex-col items-center justify-center space-y-6 w-full animate-fade-in">
                {/* QR Check-in Box */}
                <div className="bg-[var(--pos-panel)] border border-[var(--pos-grid-line)] p-5 rounded-3xl text-center flex flex-col items-center w-full max-w-[320px] shadow-lg">
                  <h3 className="text-sm font-bold mb-4 text-[var(--pos-text-primary)]">Scan to Check-in</h3>
                  <div className="w-[180px] h-[180px] bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-inner border border-gray-100">
                    {qrCodeImgSrc && <img src={qrCodeImgSrc} alt="Check-in QR" className="w-[155px] h-[155px]" />}
                  </div>
                  <p className="text-xs text-[var(--pos-text-secondary)] mt-4 leading-relaxed font-medium">
                    Use your phone browser to earn points &amp; redeem active rewards
                  </p>
                </div>

                <div className="text-[var(--pos-text-muted)] text-xs font-bold tracking-wider">OR</div>

                {/* On-screen Input Button */}
                <button
                  onClick={() => setShowInputScreen(true)}
                  className="w-full max-w-[320px] py-3.5 text-sm font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  style={{ backgroundColor: branding.buttonColor || '#E94560', color: branding.buttonTextColor || '#F8FAFC' }}
                >
                  <Touchpad size={18} />
                  Enter Mobile on Screen
                </button>
              </div>
            ) : (
              // On screen Form & Keypad Input Screen
              <div className="flex flex-col space-y-5 w-full max-w-[320px] justify-between animate-fade-in">
                <div>
                  <button
                    onClick={() => {
                      if (otpRequired) setOtpRequired(false);
                      else setShowInputScreen(false);
                    }}
                    className="flex items-center gap-1.5 text-xs text-[var(--pos-text-secondary)] hover:text-[var(--pos-text-primary)] mb-4 transition cursor-pointer font-bold"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>

                  <h3 className="text-base font-bold text-[var(--pos-text-primary)] mb-3">
                    {otpRequired 
                      ? 'Enter Verification Code' 
                      : 'Customer Check In'}
                  </h3>

                  {/* Form Input Blocks */}
                  <div className="space-y-3">
                    {!otpRequired && (
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-[var(--pos-text-secondary)]">Mobile Number</label>
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
                              className="bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)] text-[var(--pos-text-primary)] rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[var(--color-accent)] cursor-pointer"
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
                            className={`flex-1 p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                              activeField === 'mobile' 
                                ? 'border-[var(--color-accent)] bg-[var(--pos-surface-inset)]' 
                                : 'border-[var(--pos-grid-line)] bg-[var(--pos-surface-inset)]/40'
                            }`}
                          >
                            <Smartphone size={16} className="text-[var(--pos-text-muted)]" />
                            <input
                              type="text"
                              placeholder="771234567"
                              value={mobile}
                              readOnly
                              className="bg-transparent border-none outline-none text-sm w-full text-[var(--pos-text-primary)] pointer-events-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {otpRequired && (
                      <div 
                        onClick={() => setActiveField('otp')}
                        className={`p-3 rounded-xl border text-center cursor-pointer transition ${
                          activeField === 'otp' 
                            ? 'border-[var(--color-accent)] bg-[var(--pos-surface-inset)]' 
                            : 'border-[var(--pos-grid-line)] bg-[var(--pos-surface-inset)]/40'
                        }`}
                      >
                        <input
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          value={otp}
                          readOnly
                          style={{ color: branding.buttonColor || '#E94560' }}
                          className="bg-transparent border-none outline-none text-lg tracking-widest text-center w-full font-black"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Numpad for Mobile / OTP */}
                <div className="bg-[var(--pos-panel)]/40 border border-[var(--pos-grid-line)] p-3 rounded-2xl shadow-inner">
                  <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        onClick={() => handleKeyPress(num.toString())}
                        className="py-3.5 bg-[var(--pos-panel)] hover:bg-[var(--pos-surface-inset)] active:bg-[var(--color-accent)] border border-[var(--pos-grid-line)] rounded-xl text-lg font-bold text-[var(--pos-text-primary)] transition cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => handleKeyPress('+')}
                      className="py-3.5 bg-[var(--pos-panel)] hover:bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)] rounded-xl text-lg font-bold text-[var(--pos-text-secondary)] transition cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleKeyPress('0')}
                      className="py-3.5 bg-[var(--pos-panel)] hover:bg-[var(--pos-surface-inset)] active:bg-[var(--color-accent)] border border-[var(--pos-grid-line)] rounded-xl text-lg font-bold text-[var(--pos-text-primary)] transition cursor-pointer"
                    >
                      0
                    </button>
                    <button
                      onClick={() => handleKeyPress('BACK')}
                      className="py-3.5 bg-red-950/15 hover:bg-red-900/25 border border-red-500/10 rounded-xl text-xs font-semibold text-red-400 transition cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleKeyPress('CLEAR')}
                      className="col-span-3 py-2 bg-[var(--pos-panel)] hover:bg-[var(--pos-surface-inset)] border border-[var(--pos-grid-line)] rounded-xl text-xs font-semibold text-[var(--pos-text-secondary)] transition cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleTextSubmit}
                  disabled={loading}
                  className="w-full py-3.5 disabled:opacity-60 text-sm font-bold rounded-xl shadow-lg transition cursor-pointer"
                  style={{ backgroundColor: branding.buttonColor || '#E94560', color: branding.buttonTextColor || '#F8FAFC' }}
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
