import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, ShoppingCart, BarChart3, Users, Layers, Shield,
  Clock, CheckCircle, Star, ArrowRight, ChefHat, Tablet, TrendingUp, Mail,
  ChevronLeft, ChevronRight, Laptop, Smartphone, Sparkles, Cpu, Activity,
  Smartphone as PhoneIcon, HeartHandshake, Check, WifiOff, Settings2, BarChart4
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';
import { buildPlanCardBackground, buildPlanTagBackground, planUsesLightText } from '../utils/planAppearance';
import { fieldAttrs, validateContactForm } from '../utils/formFields';

const COUNTRY_TO_CURRENCY = {
  LK: { code: 'LKR', symbol: 'Rs.' },
  IN: { code: 'INR', symbol: '₹' },
  GB: { code: 'GBP', symbol: '£' },
  US: { code: 'USD', symbol: '$' },
  CA: { code: 'CAD', symbol: 'C$' },
  AU: { code: 'AUD', symbol: 'A$' },
  SG: { code: 'SGD', symbol: 'S$' },
  AE: { code: 'AED', symbol: 'DH' },
  QA: { code: 'QAR', symbol: 'QR' },
  MY: { code: 'MYR', symbol: 'RM' },
  TH: { code: 'THB', symbol: '฿' },
  NZ: { code: 'NZD', symbol: 'NZ$' },
  JP: { code: 'JPY', symbol: '¥' },
  DE: { code: 'EUR', symbol: '€' },
  FR: { code: 'EUR', symbol: '€' },
  IT: { code: 'EUR', symbol: '€' },
  ES: { code: 'EUR', symbol: '€' },
  NL: { code: 'EUR', symbol: '€' },
  IE: { code: 'EUR', symbol: '€' },
  CH: { code: 'CHF', symbol: 'CHF' },
  ZA: { code: 'ZAR', symbol: 'R' },
  BR: { code: 'BRL', symbol: 'R$' },
};

const STATS = [
  { value: '500+', label: 'Active venues' },
  { value: '2M+', label: 'Orders rung' },
  { value: '99.99%', label: 'Cloud uptime' },
  { value: '< 2s', label: 'Average sync speed' },
];

/** Fallback when server geo is unavailable. */
function detectCatalogAudienceFallback() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Colombo') return 'local';
  } catch {
    /* ignore */
  }
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('si')) return 'local';
  return 'international';
}

function pricingLinesForPlan(plan) {
  if (Array.isArray(plan.featureLines) && plan.featureLines.length > 0) {
    return plan.featureLines;
  }
  const d = typeof plan.description === 'string' ? plan.description.trim() : '';
  if (d) return d.split('\n').map((s) => s.trim()).filter(Boolean);
  return [
    `${plan.durationDays} days validity`,
    'Assigned and managed by superadmin',
    'Merchant billing support included',
  ];
}

const ENTERPRISE_DISPLAY = {
  name: 'Enterprise',
  priceLabel: 'Custom',
  cycle: "Tailor-made for multi-location groups",
  lines: [
    'Bespoke loyalty workflows & customized branding',
    'Franchise routing and custom integrations',
    'Dedicated account director and priority SLA support',
    'Custom developer APIs & database export options',
  ],
};

// High-fidelity SVG Logos for Uber Eats and PickMe
function UberEatsLogo({ className = "h-8" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="20" fill="#06C167"/>
      <text x="50" y="45" fill="black" fontFamily="sans-serif" fontWeight="900" fontSize="18" textAnchor="middle">Uber</text>
      <text x="50" y="70" fill="black" fontFamily="sans-serif" fontWeight="900" fontSize="18" textAnchor="middle">Eats</text>
    </svg>
  );
}

function PickMeLogo({ className = "h-8" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="20" fill="#FFC61A"/>
      {/* PickMe Wave hand P representation */}
      <path d="M30 75V25H55C65 25 70 30 70 38C70 46 65 50 55 50H42V75H30Z" fill="black" stroke="black" strokeWidth="2"/>
      <circle cx="50" cy="22" r="5" fill="black"/>
      <text x="50" y="88" fill="black" fontFamily="sans-serif" fontWeight="900" fontSize="16" textAnchor="middle">Food</text>
    </svg>
  );
}

function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);

  const nameAttrs = fieldAttrs('personName');
  const emailAttrs = fieldAttrs('email');
  const subjectAttrs = fieldAttrs('subject');
  const messageAttrs = fieldAttrs('message');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrs = validateContactForm(form);
    if (Object.keys(fieldErrs).length) {
      setErrors(fieldErrs);
      return;
    }
    setErrors({});
    setStatus('loading');
    try {
      await api.post('/contact', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="py-20 bg-slate-900 border-t border-white/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-white mb-3">Let's talk operations</h2>
          <p className="text-slate-400">Have questions about migrating from your old POS system? We are here to help.</p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="font-semibold text-white">Message received!</p>
            <p className="text-slate-300 text-sm mt-1">We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { label: 'Full name', key: 'name', type: 'text', attrs: nameAttrs },
                { label: 'Email address', key: 'email', type: 'email', attrs: emailAttrs },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-300 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, [field.key]: e.target.value }));
                      if (errors[field.key]) setErrors((err) => ({ ...err, [field.key]: '' }));
                    }}
                    placeholder={field.attrs.placeholder}
                    maxLength={field.attrs.maxLength}
                    autoComplete={field.attrs.autoComplete}
                    className={`w-full border bg-slate-900 border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                      errors[field.key] ? 'border-red-500' : 'border-slate-700'
                    }`}
                  />
                  {errors[field.key] && <p className="text-xs text-red-400 mt-1">{errors[field.key]}</p>}
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => {
                  setForm((f) => ({ ...f, subject: e.target.value }));
                  if (errors.subject) setErrors((err) => ({ ...err, subject: '' }));
                }}
                placeholder={subjectAttrs.placeholder}
                maxLength={subjectAttrs.maxLength}
                className={`w-full border bg-slate-900 border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange ${
                  errors.subject ? 'border-red-500' : 'border-slate-700'
                }`}
              />
              {errors.subject && <p className="text-xs text-red-400 mt-1">{errors.subject}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Message</label>
              <textarea
                value={form.message}
                onChange={(e) => {
                  setForm((f) => ({ ...f, message: e.target.value }));
                  if (errors.message) setErrors((err) => ({ ...err, message: '' }));
                }}
                rows={4}
                placeholder={messageAttrs.placeholder}
                maxLength={messageAttrs.maxLength}
                className={`w-full border bg-slate-900 border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange resize-none ${
                  errors.message ? 'border-red-500' : 'border-slate-700'
                }`}
              />
              {errors.message && <p className="text-xs text-red-400 mt-1">{errors.message}</p>}
            </div>
            {status === 'error' && <p className="text-sm text-red-400">Failed to send. Please try again.</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 rounded-lg bg-brand-orange text-white text-sm font-semibold transition-all hover:bg-brand-orange-hover hover:scale-[1.01] disabled:opacity-60"
            >
              {status === 'loading' ? 'Sending message...' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [catalogAudience, setCatalogAudience] = useState('international');
  const [countryCode, setCountryCode] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  
  const pricingCarouselRef = useRef(null);
  const [pricingSlide, setPricingSlide] = useState(0);
  const [activeDeviceTab, setActiveDeviceTab] = useState('double_pos');

  const pricingSlideCount = useMemo(() => {
    if (plansLoading) return 3;
    return plans.length + 1;
  }, [plansLoading, plans.length]);

  const scrollPricingTo = (index) => {
    const el = pricingCarouselRef.current;
    const i = Math.max(0, Math.min(pricingSlideCount - 1, index));
    const child = el?.children[i];
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    setPricingSlide(i);
  };

  useEffect(() => {
    const el = pricingCarouselRef.current;
    if (!el) return undefined;

    const syncSlideFromScroll = () => {
      const { children } = el;
      if (!children?.length) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      for (let j = 0; j < children.length; j += 1) {
        const c = children[j];
        const cx = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(cx - mid);
        if (d < bestDist) {
          bestDist = d;
          best = j;
        }
      }
      setPricingSlide(best);
    };

    el.addEventListener('scroll', syncSlideFromScroll, { passive: true });
    return () => el.removeEventListener('scroll', syncSlideFromScroll);
  }, [pricingSlideCount]);

  useEffect(() => {
    setPricingSlide((prev) => Math.min(prev, Math.max(0, pricingSlideCount - 1)));
  }, [pricingSlideCount]);

  // Load geo-IP audience & country code
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/plans/public/audience');
        if (!cancelled) {
          const a = data?.audience;
          if (a === 'local' || a === 'international') setCatalogAudience(a);
          else setCatalogAudience(detectCatalogAudienceFallback());

          if (data?.countryCode) {
            setCountryCode(data.countryCode);
          }
        }
      } catch {
        if (!cancelled) setCatalogAudience(detectCatalogAudienceFallback());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch exchange rates when international catalog is active
  useEffect(() => {
    if (catalogAudience === 'international') {
      let cancelled = false;
      fetch('https://open.er-api.com/v6/latest/USD')
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data && data.rates) {
            setExchangeRates(data.rates);
          }
        })
        .catch((err) => console.warn('Failed to fetch exchange rates:', err));
      return () => {
        cancelled = true;
      };
    }
  }, [catalogAudience]);

  // Pricing loader
  useEffect(() => {
    let cancelled = false;
    const loadPlans = async () => {
      setPlansLoading(true);
      try {
        const { data } = await api.get('/plans/public', {
          params: { audience: catalogAudience },
        });
        if (!cancelled) setPlans(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setPlans([]);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    };
    loadPlans();
    return () => {
      cancelled = true;
    };
  }, [catalogAudience]);

  // Dynamic price display helper (Professional layout)
  const getFormattedPriceInfo = (plan) => {
    const amount = Number(plan.amount);
    if (catalogAudience === 'local' || !countryCode || countryCode === 'US' || !exchangeRates) {
      return {
        displayPrice: `${plan.currency} ${amount.toLocaleString()}`,
        subtitle: null
      };
    }
    const currencyInfo = COUNTRY_TO_CURRENCY[countryCode];
    if (currencyInfo) {
      const rate = exchangeRates[currencyInfo.code];
      if (rate) {
        const converted = Math.round(amount * rate);
        return {
          displayPrice: `${currencyInfo.symbol} ${converted.toLocaleString()}`,
          subtitle: `Equivalent to USD ${amount.toLocaleString()}`
        };
      }
    }
    return {
      displayPrice: `${plan.currency} ${amount.toLocaleString()}`,
      subtitle: null
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-brand-orange selection:text-white">
      <Navbar />

      {/* Hero Header */}
      <section className="relative overflow-hidden pt-32 pb-24 px-4 sm:px-6 lg:px-8 text-white">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
          <div className="absolute -left-[10%] -top-[20%] h-[500px] w-[500px] rounded-full bg-brand-orange/10 blur-[120px]" />
          <div className="absolute -right-[10%] top-[10%] h-[500px] w-[500px] rounded-full bg-orange-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-full px-4 py-1.5 text-xs sm:text-sm mb-8 text-slate-300 backdrop-blur-md">
            <Star size={12} className="text-brand-orange fill-brand-orange animate-pulse" />
            <span>14-day free trial — self-service setup in minutes</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            Run your venue without the chaos.
            <span className="block text-slate-300 font-medium text-2xl sm:text-3xl lg:text-4xl mt-3">Registers, kitchen routing, table maps, and delivery in sync.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            <strong className="font-semibold text-slate-200">Cafinity</strong> is the unified Point of Sale engineered for busy cafés, premium coffee spots, and full-size fine dining restaurants. Synchronize counter billing, table floor plan service, kitchen queues, and third-party delivery orders instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold text-base shadow-lg shadow-brand-orange/20 transition-all hover:scale-[1.02]"
            >
              Get started for free
              <ArrowRight size={18} />
            </Link>
            <a href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              Explore platform
            </a>
          </div>

          {/* Interactive Platform Live View Showcase */}
          <div className="mt-8 border border-slate-800 rounded-3xl bg-slate-900/60 backdrop-blur-lg overflow-hidden shadow-2xl">
            <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 overflow-x-auto gap-2">
              {[
                { id: 'double_pos', label: 'Double-Sided POS', icon: ShoppingCart },
                { id: 'kds', label: 'Barista & Kitchen KDS', icon: ChefHat },
                { id: 'admin', label: 'Admin Portal & Control', icon: Laptop },
                { id: 'mobile', label: 'Table Ordering & Mobile (Waiter)', icon: Smartphone },
                { id: 'ai_preview', label: 'AI Insights (Beta Preview)', icon: Sparkles }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDeviceTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    activeDeviceTab === tab.id
                      ? 'bg-slate-800 text-white border border-slate-700/50'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent border border-transparent'
                  }`}
                >
                  <tab.icon size={14} className={activeDeviceTab === tab.id ? 'text-brand-orange' : 'text-slate-400'} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Displaying Live Interactive Mockups */}
            <div className="p-4 sm:p-8 bg-slate-950/20 min-h-[380px] sm:min-h-[460px] flex items-center justify-center">
              {activeDeviceTab === 'double_pos' && (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                  {/* Left Screen: Register */}
                  <div className="border border-slate-800 rounded-2xl bg-slate-900 overflow-hidden shadow-lg">
                    <div className="bg-slate-950 px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 border-b border-slate-800 flex justify-between">
                      <span>POS Register · Counter A</span>
                      <span className="text-emerald-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Online</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {['Espresso', 'Flat White', 'Steak Frites', 'Iced Latte', 'Truffle Pasta', 'Croissant'].map((item, i) => (
                          <div key={item} className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            i === 2 ? 'border-brand-orange/40 bg-brand-orange/5' : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                          }`}>
                            <p className="text-xs font-semibold text-white">{item}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{i >= 2 && i <= 4 ? 'LKR 2,400' : 'LKR 650'}</p>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-800/80 pt-3 space-y-2">
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>1x Steak Frites (Medium Rare)</span>
                          <span>LKR 2,400</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-300">
                          <span>1x Truffle Pasta</span>
                          <span>LKR 2,200</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                          <span>Subtotal Due (Table 12)</span>
                          <span>LKR 4,600</span>
                        </div>
                      </div>
                      <button type="button" className="w-full py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold transition-all">
                        Pay & Print Receipt
                      </button>
                    </div>
                  </div>

                  {/* Right Screen: Customer Display */}
                  <div className="border border-slate-800 rounded-2xl bg-slate-900 overflow-hidden shadow-lg flex flex-col justify-between">
                    <div className="bg-slate-950 px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 border-b border-slate-800 text-center">
                      Customer Facing Display
                    </div>
                    <div className="p-6 text-center space-y-4 my-auto">
                      <p className="text-xs text-slate-400 uppercase tracking-widest">Total Amount Due</p>
                      <h3 className="text-4xl font-extrabold text-white tracking-tight">LKR 4,600</h3>
                      <div className="w-28 h-28 bg-white mx-auto p-2 rounded-xl flex items-center justify-center">
                        {/* Mock QR Code */}
                        <div className="grid grid-cols-5 gap-1 w-full h-full opacity-90">
                          {Array.from({ length: 25 }).map((_, i) => (
                            <div key={i} className={`rounded-xs ${i % 3 === 0 || i % 4 === 1 ? 'bg-slate-950' : 'bg-transparent'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">Scan QR to pay instantly or claim loyalty rewards</p>
                    </div>
                    <div className="bg-slate-950/50 p-3 text-center text-[10px] text-slate-500 border-t border-slate-800/60">
                      Powered by Cafinity Premium Terminal OS
                    </div>
                  </div>
                </div>
              )}

              {activeDeviceTab === 'kds' && (
                <div className="w-full max-w-4xl border border-slate-800 rounded-2xl bg-slate-900 overflow-hidden shadow-2xl animate-fade-in">
                  <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ChefHat className="text-brand-orange" size={16} />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Kitchen Display System (KDS)</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">Kitchen Line 1</span>
                      <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">Avg prep: 4m 12s</span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Order Item 1 */}
                    <div className="border border-brand-orange/30 bg-brand-orange/[0.02] rounded-xl p-3 flex flex-col justify-between min-h-[160px]">
                      <div>
                        <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                          <span className="text-xs font-bold text-white">#1249 · Dining Room</span>
                          <span className="text-[10px] text-brand-orange font-bold animate-pulse">4m ago</span>
                        </div>
                        <ul className="text-xs text-slate-300 space-y-1 text-left">
                          <li className="font-semibold text-white">1x Steak Frites</li>
                          <li className="text-[10px] text-slate-400 pl-3">· Medium Rare</li>
                          <li className="text-[10px] text-slate-400 pl-3">· Extra Garlic Butter</li>
                        </ul>
                      </div>
                      <button type="button" className="mt-3 w-full py-1.5 rounded-lg bg-brand-orange/20 text-brand-orange hover:bg-brand-orange hover:text-white text-xs font-bold transition-all">
                        Mark Ready
                      </button>
                    </div>

                    {/* Order Item 2 */}
                    <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-3 flex flex-col justify-between min-h-[160px]">
                      <div>
                        <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                          <span className="text-xs font-bold text-white">#1250 · Table 12</span>
                          <span className="text-[10px] text-slate-400">1m ago</span>
                        </div>
                        <ul className="text-xs text-slate-300 space-y-1 text-left">
                          <li className="font-semibold text-white">1x Truffle Pasta</li>
                          <li className="font-semibold text-white">1x Caesar Salad</li>
                        </ul>
                      </div>
                      <button type="button" className="mt-3 w-full py-1.5 rounded-lg bg-slate-850 text-slate-300 hover:bg-brand-orange hover:text-white text-xs font-bold transition-all">
                        Mark Ready
                      </button>
                    </div>

                    {/* Order Item 3 */}
                    <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-3 flex flex-col justify-between min-h-[160px] opacity-75">
                      <div>
                        <div className="flex justify-between border-b border-slate-800 pb-2 mb-2">
                          <span className="text-xs font-bold text-white">#1248 · Uber Eats</span>
                          <span className="text-[10px] text-emerald-400 font-bold">Completed</span>
                        </div>
                        <ul className="text-xs text-slate-400 space-y-1 text-left">
                          <li>1x Ribeye Steak</li>
                          <li>1x Grilled Asparagus</li>
                        </ul>
                      </div>
                      <div className="mt-3 text-center text-[10px] text-slate-500 font-medium py-1.5 bg-slate-900 rounded-lg">
                        Done in 8m 45s
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDeviceTab === 'admin' && (
                <div className="w-full max-w-4xl border border-slate-800 rounded-2xl bg-slate-900 overflow-hidden shadow-2xl flex flex-col md:flex-row animate-fade-in text-left">
                  {/* Left panel: Merchant Settings & Analytics */}
                  <div className="flex-1 p-5 border-r border-slate-800/80">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450">Admin Portal</h4>
                        <p className="text-lg font-extrabold text-white mt-0.5">Vivid Controls & Management</p>
                      </div>
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-700/50">
                        HQ Control
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Settings2 size={12} className="text-brand-orange" />
                          <span className="text-[10px] font-bold">Menu & Catalog Manager</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-normal">Override item layouts, tax tiers, variant rates, and delivery pricing globally.</p>
                      </div>
                      <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Users size={12} className="text-brand-orange" />
                          <span className="text-[10px] font-bold">Staff Roles & Shift Logs</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-normal">Delegate barista, kitchen, floor, and admin roles with strict security parameters.</p>
                      </div>
                    </div>

                    {/* Sales & Decisions Widget */}
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-850">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] text-slate-400 font-bold">Decision-Ready Reporting</p>
                        <span className="text-[9px] text-emerald-400 font-bold">+14.6% vs last week</span>
                      </div>
                      <div className="flex items-end justify-between h-20 pt-2 px-1">
                        {[40, 60, 30, 85, 95, 70, 50, 80, 110].map((val, idx) => (
                          <div key={idx} className="w-6 bg-slate-800 rounded-t-sm flex flex-col justify-end h-full">
                            <div className="bg-brand-orange rounded-t-sm" style={{ height: `${val / 1.2}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right panel: Live Actions */}
                  <div className="w-full md:w-72 bg-slate-950/60 p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                        <BarChart4 className="text-brand-orange" size={16} />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Unified Overview</span>
                      </div>
                      <div className="space-y-3">
                        <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-300">
                          <span className="font-bold text-white block mb-0.5">Real-time Stock Alert</span>
                          Oat milk inventory is running low. Average consumption predicts exhaustion by 4:00 PM.
                        </div>
                        <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-300">
                          <span className="font-bold text-white block mb-0.5">Sales Mix Shift</span>
                          Pasta and steaks comprise 64% of net profit during this Sunday dinner shift.
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <a href="/signup" className="block text-center py-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-[11px] font-bold rounded-lg transition-all">
                        Launch HQ Workspace
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {activeDeviceTab === 'mobile' && (
                <div className="w-full max-w-sm border-4 border-slate-800 rounded-[36px] bg-slate-950 p-3 shadow-2xl relative animate-fade-in overflow-hidden">
                  {/* Phone Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-800 h-4 w-28 rounded-b-xl z-20" />
                  
                  <div className="border border-slate-900 rounded-[28px] bg-slate-900 overflow-hidden text-left flex flex-col justify-between min-h-[360px]">
                    <div className="bg-slate-950 px-4 pt-4 pb-2 border-b border-slate-850 flex justify-between items-center">
                      <span className="text-xs font-bold text-white">Table-Side Ordering</span>
                      <span className="text-[10px] bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded-full font-bold">Table 12</span>
                    </div>

                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-center">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Active Table Cart</p>
                        <h4 className="text-sm font-bold text-white mt-1">Dining Room Floor B</h4>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>1x Ribeye (Medium)</span>
                          <span>LKR 3,400</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>1x Roasted Potato</span>
                          <span>LKR 450</span>
                        </div>
                      </div>

                      <button type="button" className="w-full py-2 bg-brand-orange text-white rounded-lg text-xs font-bold text-center">
                        Fire To Kitchen KDS
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeDeviceTab === 'ai_preview' && (
                <div className="w-full max-w-lg border border-slate-800 rounded-2xl bg-slate-900 p-6 shadow-2xl animate-fade-in text-left space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-brand-orange animate-pulse" size={18} />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">AI Insights & Forecasting</h4>
                    </div>
                    <span className="bg-slate-800 text-slate-400 border border-slate-700/50 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      Upcoming Feature Glimpse
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Here is a glimpse of the AI-native features we are building to help you manage your business decisions automatically:
                  </p>

                  <div className="space-y-2.5">
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850/60">
                      <p className="text-xs font-semibold text-white">📈 Automated Volume Forecasts</p>
                      <p className="text-[11px] text-slate-400 mt-1">Predicts next weekend's demand based on weather, holiday calendars, and historic sales, suggesting prep lists.</p>
                    </div>
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850/60">
                      <p className="text-xs font-semibold text-white">📅 Smart Staff Schedule Assistant</p>
                      <p className="text-[11px] text-slate-400 mt-1">Automatically generates shifts schedules matching predicted peak hours to reduce labor overhead.</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 italic text-center pt-2">
                    Note: Predictive modeling and smart schedule suggestions are currently in private developer testing.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery partner integrations - Uber Eats & PickMe */}
          <div className="mt-20 max-w-4xl mx-auto">
            <p className="text-xs uppercase font-bold tracking-widest text-slate-400 mb-8">Deep Integration With Sri Lanka's Leading Delivery Platforms</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-stretch justify-center max-w-2xl mx-auto text-left">
              {/* Uber Eats */}
              <div className="p-6 rounded-2xl border border-emerald-500/20 bg-[#000000]/40 flex gap-4 items-start">
                <UberEatsLogo className="w-14 h-14 shrink-0 rounded-xl overflow-hidden" />
                <div>
                  <h4 className="font-extrabold text-white text-base">Uber Eats Fully Fledged Integration</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Manage your delivery orders from start to finish directly on your POS terminal. Configure specific menu pricing and modifier rules for the Uber platform, and track incoming payouts natively.
                  </p>
                </div>
              </div>

              {/* PickMe */}
              <div className="p-6 rounded-2xl border border-yellow-500/20 bg-[#FFC61A]/5 flex gap-4 items-start">
                <PickMeLogo className="w-14 h-14 shrink-0 rounded-xl overflow-hidden" />
                <div>
                  <h4 className="font-extrabold text-white text-base">PickMe Food Integration</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Maintain PickMe delivery orders separately. Perform automatic commission splits, track payouts, and configure custom, dedicated menu listings specifically for PickMe buyers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* High-Fidelity Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Engineered for speed. Built for control.
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Essential kitchen KDS layouts, offline support, and deep configurations to take total control of your operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/30 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-6 text-brand-orange">
                  <WifiOff size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">Offline Register Support</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Internet dropouts shouldn't stall your business. Cafinity terminals run offline seamlessly. Ring orders, apply discounts, and print kitchen receipts natively. Transactions queue locally and sync to the cloud automatically once connection is restored.
                </p>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 text-left">
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Local transaction buffer queue</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Seamless auto-sync on reconnect</li>
              </ul>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/30 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-6 text-brand-orange">
                  <Settings2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">Vivid Admin Portal Controls</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Take full control of your venue. Modify menus, set taxes, configure loyalty points multipliers, track staff shift hours, and manage roles. Make data-driven decisions using comprehensive sales breakdown summaries.
                </p>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 text-left">
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Robust menu & taxes control</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Detailed shifts and security roles</li>
              </ul>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/30 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-6 text-brand-orange">
                  <Tablet size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-3">Mobile Order & KDS Sync</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  Give your waiters a fluid mobile ordering system. Send table selections and custom modifier rules directly from tablet handhelds to KDS barista screens in the kitchen. Keep the floor and the kitchen in perfect harmony.
                </p>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 text-left">
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Handheld table floorplan service</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Live ticket queue time metrics</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Business Transformation Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/40 border-t border-b border-slate-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-white mb-3">Concrete business transformation</h2>
            <p className="text-slate-400">Concrete improvements cafes and fine dining venues notice within the first 30 days of moving to Cafinity.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            {[
              { title: 'Zero order drift', desc: 'No lost tickets, no barista confusion. Direct cloud KDS routing ensures the coffee being poured is exactly what the customer ordered at the terminal.' },
              { title: 'Optimized margin insight', desc: 'Automatically track component costs down to single milk cartons, syrup bottles, and bean bags. Know instantly which products bring true profit.' },
              { title: 'Elevated customer retention', desc: 'Built-in loyalty programs sync from counter payments directly to mobile numbers. Keep customers returning for their morning brew habits.' }
            ].map((pillar, idx) => (
              <div key={idx} className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                <h3 className="font-bold text-base text-white mb-2">{pillar.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Catalog */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-[1400px] mx-auto flex flex-col items-center">
          <div className="text-center mb-16 w-full">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Transparent billing, zero hidden fees</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              {catalogAudience === 'local'
                ? 'LKR pricing specifically for Sri Lankan venues. 14 days of full feature access on us.'
                : 'International plans automatically localized for your local currency. Sri Lankan venues are billed natively in LKR.'}
            </p>
          </div>

          <div className="relative w-full">
            <button
              type="button"
              aria-label="Previous pricing plan"
              onClick={() => scrollPricingTo(pricingSlide - 1)}
              disabled={pricingSlide <= 0}
              className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-300 shadow-lg hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-35 sm:flex md:-left-1 lg:-left-2"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next pricing plan"
              onClick={() => scrollPricingTo(pricingSlide + 1)}
              disabled={pricingSlide >= pricingSlideCount - 1}
              className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-300 shadow-lg hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-35 sm:flex md:-right-1 lg:-right-2"
            >
              <ChevronRight size={22} strokeWidth={2} />
            </button>

            <div
              ref={pricingCarouselRef}
              className="flex min-h-[420px] flex-nowrap items-stretch gap-6 overflow-x-auto scroll-smooth pt-4 pb-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [padding-inline:max(0.5rem,calc(50%-140px))] [scroll-padding-inline:max(0.5rem,calc(50%-140px))] sm:justify-center sm:[padding-inline:2.5rem] sm:[scroll-padding-inline:2.5rem]"
            >
              {(plansLoading ? [1, 2, 3] : plans).map((plan, idx) => {
                if (plansLoading) {
                  return (
                    <div
                      key={`sk-${idx}`}
                      className="min-h-[380px] w-[min(100%,280px)] shrink-0 snap-center rounded-2xl border border-slate-850 bg-slate-900 animate-pulse sm:w-[260px]"
                    />
                  );
                }
                const bulletLines = pricingLinesForPlan(plan);
                const customCardBg = buildPlanCardBackground(plan);
                const builtInFeatured = plan.isDefault && !customCardBg;
                const lightOnCard = planUsesLightText(plan);
                const showRibbon = plan.planTagShow && String(plan.planTagText || '').trim();
                const ribbonBg = showRibbon ? buildPlanTagBackground(plan) : null;

                let cardShell =
                  'relative shrink-0 w-[min(100%,280px)] sm:w-[260px] rounded-2xl p-7 border flex flex-col min-h-[380px] transition-all snap-center ';
                let cardStyle = undefined;
                if (customCardBg) {
                  cardShell += lightOnCard ? 'shadow-lg border-white/25' : 'shadow-md border-slate-850';
                  cardStyle = { background: customCardBg };
                } else if (builtInFeatured) {
                  cardShell += 'border-brand-orange bg-slate-900 shadow-xl shadow-brand-orange/5';
                } else {
                  cardShell += 'border-slate-850 bg-slate-900/50 hover:border-slate-800';
                }

                const priceInfo = getFormattedPriceInfo(plan);

                return (
                  <div
                    key={plan._id || plan.code}
                    className={cardShell}
                    style={cardStyle}
                  >
                    {showRibbon && ribbonBg && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow-md max-w-[min(100%,220px)] truncate text-white"
                        style={{ background: ribbonBg }}
                      >
                        {plan.planTagText}
                      </div>
                    )}

                    <div className="text-sm font-semibold text-slate-300 mb-2">{plan.name}</div>
                    <div className="text-xl sm:text-2xl font-extrabold text-white mb-0.5 tracking-tight">
                      {priceInfo.displayPrice}
                    </div>
                    {priceInfo.subtitle && (
                      <div className="text-[10px] text-slate-400 font-semibold mb-1">
                        {priceInfo.subtitle}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mb-6 uppercase tracking-wider">
                      {plan.billingCycle === 'monthly'
                        ? 'per month'
                        : plan.billingCycle === 'yearly'
                          ? 'per year'
                          : `${plan.durationDays} day cycle`}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {bulletLines.map((f, i) => (
                        <li key={`${plan._id || plan.code}-${i}`} className="flex items-start gap-2 text-xs text-slate-300">
                          <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                          <span className="leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      to="/signup"
                      className="mt-auto block text-center py-3 rounded-xl text-xs font-bold transition-all bg-brand-orange hover:bg-brand-orange-hover text-white shadow-md shadow-brand-orange/10"
                    >
                      Start 14-day trial
                    </Link>
                  </div>
                );
              })}

              {!plansLoading && (
                <div className="relative flex min-h-[380px] w-[min(100%,280px)] shrink-0 snap-center flex-col rounded-2xl border border-slate-800 bg-slate-900 p-7 text-white shadow-lg sm:w-[260px]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-brand-orange text-white">
                    Tailor-made
                  </div>
                  <div className="text-sm font-semibold mb-2 text-slate-300">{ENTERPRISE_DISPLAY.name}</div>
                  <div className="text-2xl font-extrabold text-white mb-1 tracking-tight">{ENTERPRISE_DISPLAY.priceLabel}</div>
                  <div className="text-xs text-slate-500 mb-6 uppercase tracking-wider">{ENTERPRISE_DISPLAY.cycle}</div>
                  <ul className="space-y-3 mb-8 text-left flex-1">
                    {ENTERPRISE_DISPLAY.lines.map((f, i) => (
                      <li key={`ent-${i}`} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#contact"
                    className="mt-auto inline-flex justify-center w-full py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 transition-all"
                  >
                    Talk to sales
                  </a>
                </div>
              )}
            </div>

            {pricingSlideCount > 1 && (
              <div className="mt-8 flex justify-center gap-2" role="tablist" aria-label="Pricing plans">
                {Array.from({ length: pricingSlideCount }).map((_, i) => (
                  <button
                    key={`pricing-dot-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={pricingSlide === i}
                    aria-label={`Show plan ${i + 1} of ${pricingSlideCount}`}
                    onClick={() => scrollPricingTo(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      pricingSlide === i ? 'w-6 bg-brand-orange' : 'w-1.5 bg-slate-800 hover:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Final Action CTA */}
      <section className="relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="absolute inset-0 bg-slate-950" aria-hidden />
        <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Elevate your venue operations</h2>
          <p className="text-slate-400 text-base sm:text-lg mb-10 leading-relaxed max-w-xl mx-auto">
            Join specialty food venues and dining destinations running on Cafinity to supercharge registers, barista queues, and delivery streams.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-brand-orange/20 transition-all hover:scale-[1.02]"
          >
            Get started for free
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <ContactSection />
      <Footer />
    </div>
  );
}
