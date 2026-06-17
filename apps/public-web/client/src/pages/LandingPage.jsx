import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, ShoppingCart, BarChart3, Users, Layers, Shield,
  Clock, CheckCircle, Star, ArrowRight, ChefHat, Tablet, TrendingUp, Mail,
  ChevronLeft, ChevronRight, Laptop, Smartphone, Sparkles, Cpu, Activity,
  Smartphone as PhoneIcon, HeartHandshake, Check, WifiOff, Settings2, BarChart4, X,
  Database, ArrowLeftRight
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SocialShareWidget from '../components/SocialShareWidget';
import api from '../api';
import { useTheme } from '../context/ThemeContext';
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
    <section id="contact" className="py-20 bg-theme-bg-card border-t border-theme-border/60 transition-colors duration-250">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-theme-text-header mb-3">Let's talk operations</h2>
          <p className="text-theme-text-muted mb-6">Have custom development requirements, migration requests, or questions about migrating from your old POS system? We are here to help.</p>
          <a
            href="https://wa.me/94723539443"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-950/20 hover:shadow-emerald-950/30 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm group"
          >
            <svg
              className="w-5 h-5 fill-current text-white group-hover:animate-pulse"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.968C16.528 1.97 14.076.945 11.472.945c-5.442 0-9.866 4.372-9.87 9.802 0 1.814.504 3.58 1.46 5.176l-.99 3.616 3.731-.97c1.554.846 3.176 1.291 4.254 1.291zm10.222-7.042c-.282-.141-1.666-.822-1.924-.916-.258-.094-.446-.141-.634.141-.188.282-.728.916-.893 1.1-.164.185-.328.207-.61.066-.282-.141-1.19-.439-2.268-1.4c-.838-.747-1.403-1.671-1.567-1.953-.164-.282-.018-.434.122-.574.127-.127.282-.328.423-.493.141-.164.188-.282.282-.47.094-.188.047-.353-.023-.493-.07-.141-.634-1.527-.868-2.09-.228-.549-.459-.475-.634-.484-.164-.008-.352-.01-.54-.01s-.493.07-.751.353c-.258.282-.986.963-.986 2.348s1.009 2.72 1.15 2.908c.141.188 1.984 3.03 4.81 4.25 2.827 1.22 2.827.813 3.344.765.517-.047 1.667-.68 1.902-1.338.235-.658.235-1.22.164-1.338-.07-.117-.258-.211-.54-.353z" />
          </svg>
          Chat with us on WhatsApp
        </a>
      </div>

      {status === 'success' ? (
        <div className="bg-green-500/10 border border-green-550/20 rounded-2xl p-8 text-center">
          <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-theme-text-header">Message received!</p>
          <p className="text-theme-text-muted text-sm mt-1">We'll get back to you within 24 hours.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-theme-bg-surface/25 backdrop-blur-md rounded-2xl border border-theme-border p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { label: 'Full name', key: 'name', type: 'text', attrs: nameAttrs },
              { label: 'Email address', key: 'email', type: 'email', attrs: emailAttrs },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-theme-text-muted mb-1">{field.label}</label>
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
                  className={`w-full border bg-theme-bg-surface/30 border-theme-border text-theme-text-main rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all ${
                    errors[field.key] ? 'border-red-500' : 'border-theme-border'
                  }`}
                />
                {errors[field.key] && <p className="text-xs text-red-500 mt-1">{errors[field.key]}</p>}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-text-muted mb-1">Subject / Requirement type</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => {
                setForm((f) => ({ ...f, subject: e.target.value }));
                if (errors.subject) setErrors((err) => ({ ...err, subject: '' }));
              }}
              placeholder="e.g. Custom Integration / Migration Inquiry"
              maxLength={subjectAttrs.maxLength}
              className={`w-full border bg-theme-bg-surface/30 border-theme-border text-theme-text-main rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange transition-all ${
                errors.subject ? 'border-red-500' : 'border-theme-border'
              }`}
            />
            {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-text-muted mb-1">Tell us your requirements</label>
            <textarea
              value={form.message}
              onChange={(e) => {
                setForm((f) => ({ ...f, message: e.target.value }));
                if (errors.message) setErrors((err) => ({ ...err, message: '' }));
              }}
              rows={4}
              placeholder="Describe what specific feature, report, integration, or custom data migration you need us to handle..."
              maxLength={messageAttrs.maxLength}
              className={`w-full border bg-theme-bg-surface/30 border-theme-border text-theme-text-main rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange resize-none transition-all ${
                errors.message ? 'border-red-500' : 'border-theme-border'
              }`}
            />
            {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
          </div>
          {status === 'error' && <p className="text-sm text-red-550">Failed to send. Please try again.</p>}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 rounded-lg bg-brand-orange text-white text-sm font-semibold transition-all hover:bg-brand-orange-hover hover:scale-[1.01] disabled:opacity-60 cursor-pointer"
          >
            {status === 'loading' ? 'Sending message...' : 'Send custom request'}
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
  const [selectedCycle, setSelectedCycle] = useState('monthly');
  const [showCycleBanner, setShowCycleBanner] = useState(false);
  const { theme } = useTheme();
  
  const pricingCarouselRef = useRef(null);
  const [pricingSlide, setPricingSlide] = useState(0);

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

  // Dynamic price display helper
  const getFormattedPriceInfo = (plan, cycle = selectedCycle) => {
    const amount = Number(cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice) || 0;
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
    <div className="min-h-screen bg-theme-bg-main text-theme-text-main font-sans antialiased selection:bg-brand-orange selection:text-white transition-colors duration-250">
      <Navbar />

      {/* Hero Header */}
      <section className="relative overflow-hidden pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-theme-hero-gradient transition-colors duration-250" />
          {/* High prominence pulsing orange glow circles */}
          <div className="absolute -left-[10%] -top-[25%] h-[600px] w-[600px] rounded-full bg-brand-orange/20 blur-[130px] animate-pulse-slow" />
          <div className="absolute -right-[10%] top-[5%] h-[600px] w-[600px] rounded-full bg-brand-orange/20 blur-[130px] animate-pulse-slow" />
          {/* Animated geometric shapes - Enlarged */}
          <div className="absolute top-[15%] left-[8%] w-20 h-20 rounded-full border-[4px] border-brand-orange/25 animate-float-slow" />
          <div className="absolute top-[40%] right-[10%] w-28 h-28 rounded-2xl border-[3px] border-brand-teal/20 rotate-12 animate-float-reverse" />
          <div className="absolute bottom-[8%] left-[20%] w-14 h-14 bg-brand-orange/15 rotate-45 animate-pulse-slow" />
          <div className="absolute top-[22%] right-[24%] w-24 h-24 rounded-full bg-brand-teal/10 blur-[4px] animate-float-slow" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-theme-bg-card/80 border border-theme-border/80 rounded-full px-4 py-1.5 text-xs sm:text-sm mb-8 text-theme-text-muted backdrop-blur-md">
            <Star size={12} className="text-brand-orange fill-brand-orange animate-pulse" />
            <span>14-day free trial, self-service setup in minutes</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-theme-text-header">
            Run your venue without the chaos.
            <span className="block text-theme-text-muted font-medium text-2xl sm:text-3xl lg:text-4xl mt-3">Registers, kitchen routing, table maps, and business metrics in sync.</span>
          </h1>

          <p className="text-base sm:text-lg text-theme-text-muted max-w-3xl mx-auto mb-10 leading-relaxed">
            <strong className="font-semibold text-theme-text-header">Cafinity</strong> is the unified Point of Sale engineered for busy cafes, premium coffee spots, and full-size fine dining restaurants. Synchronize counter speed billing, live table floor plan service, kitchen KDS queues, and automated reporting.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold text-base shadow-lg shadow-brand-orange/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              Get started for free
              <ArrowRight size={18} />
            </Link>
            <a href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-theme-bg-surface hover:bg-theme-bg-surface/80 text-theme-text-main border border-theme-border transition-all cursor-pointer"
            >
              Explore platform
            </a>
          </div>
        </div>
      </section>

      {/* Alternate Features Showcases with Contextual AI Images */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-theme-border/60 bg-theme-bg-surface/10 relative transition-colors duration-250">
        {/* Floating shapes inside features section - Enlarged */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <div className="absolute top-[8%] right-[6%] w-24 h-24 rounded-full border-[4px] border-brand-teal/15 animate-float-slow" />
          <div className="absolute top-[32%] left-[4%] w-20 h-20 bg-brand-orange/5 rounded-2xl rotate-12 animate-float-reverse" />
          <div className="absolute top-[60%] right-[4%] w-28 h-28 rounded-full border-[3px] border-brand-orange/15 animate-pulse-slow" />
          <div className="absolute bottom-[8%] left-[6%] w-16 h-16 border-[3px] border-brand-teal/15 rotate-45 animate-float-slow" />
        </div>

        <div className="max-w-6xl mx-auto space-y-28 relative z-10">
          
          {/* Section 1: Table Plans & Seating Selections (Full-Service Restaurant) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 bg-brand-orange/15 text-brand-orange px-4 py-1.5 rounded-full text-xs font-bold border border-brand-orange/20">
                <Layers size={14} />
                <span>Full-Service Dining</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-text-header tracking-tight">
                Transform restaurant experiences with Table Management.
              </h2>
              <p className="text-theme-text-muted text-sm sm:text-base leading-relaxed">
                Elevate your service with our advanced **Table Plan** controls. Designed to bring total operational control to sit-down dining spots, Cafinity bridges the gap between customer convenience and kitchen execution.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Stewards App</h4>
                  <p className="text-xs text-theme-text-muted">Waiters ring orders directly at tables, customize modifier rules, and fire them immediately to kitchen display queues.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Table Management</h4>
                  <p className="text-xs text-theme-text-muted">Design interactive table floorplans, monitor live occupancy indicators, and organize layout sections easily.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Reservation Management</h4>
                  <p className="text-xs text-theme-text-muted">Log guest bookings, allocate specific table seating options, and manage arrival times without paper sheets.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Analytics Suite</h4>
                  <p className="text-xs text-theme-text-muted">Track **Table Performance Analytics** and study **Menu Profitability Analytics** to identify high-margin dishes.</p>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-5 relative group">
              <div className="absolute inset-0 bg-brand-orange/5 rounded-2xl filter blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-theme-border/80 rounded-2xl overflow-hidden bg-theme-bg-card shadow-lg p-2">
                <img src="/restaurant-floor-plan.png" alt="Seasons Floor Plan" className="w-full h-auto object-cover rounded-xl transition-all duration-300 group-hover:scale-[1.01]" />
              </div>
            </div>
          </div>

          {/* Section 2: Counter Plans & Cafe Growth (Cafe & Coffee Shops) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 lg:order-2 space-y-6">
              <div className="inline-flex items-center gap-2 bg-brand-orange/15 text-brand-orange px-4 py-1.5 rounded-full text-xs font-bold border border-brand-orange/20">
                <Zap size={14} />
                <span>Fast-Casual Counter Plan</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-text-header tracking-tight">
                Accelerate checkout lines and customer satisfaction.
              </h2>
              <p className="text-theme-text-muted text-sm sm:text-base leading-relaxed">
                Speed up espresso bars, bakeries, and counter-service spots. The Cafinity Counter POS features a quick-tap grid interface to handle high customer checkout volume with maximum velocity.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Phone Number Loyalty</h4>
                  <p className="text-xs text-theme-text-muted">Link customer points directly to mobile numbers at checkout to drive morning brew habits.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Receipt Customization</h4>
                  <p className="text-xs text-theme-text-muted">Format print templates, customize headers and footers, and design perfect physical receipts for your brand.</p>
                </div>
              </div>

              <div className="p-3.5 bg-theme-bg-surface/50 border border-theme-border rounded-xl text-xs text-theme-text-muted flex items-start gap-2.5">
                <Sparkles size={16} className="text-brand-orange shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold text-theme-text-header block mb-0.5">Upcoming Add-on Release</span>
                  The WhatsApp Catalog sync integration is currently under active future development.
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:order-1 relative group">
              <div className="absolute inset-0 bg-brand-orange/5 rounded-2xl filter blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-theme-border/80 rounded-2xl overflow-hidden bg-theme-bg-card shadow-lg p-2">
                <img src="/cafe-counter-pos.png" alt="Daily Grind POS" className="w-full h-auto object-cover rounded-xl transition-all duration-300 group-hover:scale-[1.01]" />
              </div>
            </div>
          </div>

          {/* Section 3: Dedicated Inventory Management features */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 bg-brand-orange/15 text-brand-orange px-4 py-1.5 rounded-full text-xs font-bold border border-brand-orange/20">
                <Settings2 size={14} />
                <span>Dedicated Inventory Controls</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-text-header tracking-tight">
                Control recipe margins and ingredient tracking.
              </h2>
              <p className="text-theme-text-muted text-sm sm:text-base leading-relaxed">
                Cafinity maps menu ingredients directly to physical stock. Prevent leakage and calculate profit margins accurately by monitoring real-time stock logs and cost structures.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Recipe Cost Mapping</h4>
                  <p className="text-xs text-theme-text-muted">Track exact component costs down to single milk cartons, syrup bottles, and coffee bean bags per order.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Wastage Management</h4>
                  <p className="text-xs text-theme-text-muted">Log expired ingredients, spilled drinks, or preparation mistakes to evaluate structural losses.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Purchase Orders</h4>
                  <p className="text-xs text-theme-text-muted">Issue structured purchase requests to registered vendors and track supply statuses natively.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Goods Receipts</h4>
                  <p className="text-xs text-theme-text-muted">Log received items into stock, auto-update item costs, and detect vendor quantity variations.</p>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-5 relative group">
              <div className="absolute inset-0 bg-brand-orange/5 rounded-2xl filter blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-theme-border/80 rounded-2xl overflow-hidden bg-theme-bg-card shadow-lg p-2">
                <img src="/inventory-dashboard.png" alt="Stockflow Inventory" className="w-full h-auto object-cover rounded-xl transition-all duration-300 group-hover:scale-[1.01]" />
              </div>
            </div>
          </div>

          {/* Section 4: Restaurant Support Plus (Guest QR ordering app) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 lg:order-2 space-y-6">
              <div className="inline-flex items-center gap-2 bg-brand-orange/15 text-brand-orange px-4 py-1.5 rounded-full text-xs font-bold border border-brand-orange/20">
                <Tablet size={14} />
                <span>Restaurant Support Plus</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-text-header tracking-tight">
                Guest self-ordering app via smart table QR codes.
              </h2>
              <p className="text-theme-text-muted text-sm sm:text-base leading-relaxed">
                Transform ordering efficiency. Guests scan table-specific QR codes, browse your digital menu catalog, add items, and fire orders straight to the kitchen without waiter delays.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Guest Self-Ordering</h4>
                  <p className="text-xs text-theme-text-muted">Allow guests to browse and place orders directly from their tables, streamlining operations without phone payment complexity.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Automatic Table Mapping</h4>
                  <p className="text-xs text-theme-text-muted">QR codes associate tickets with the exact table, preventing routing errors to the kitchen KDS.</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 lg:order-1 relative group">
              <div className="absolute inset-0 bg-brand-orange/5 rounded-2xl filter blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-theme-border/80 rounded-2xl overflow-hidden bg-theme-bg-card shadow-lg p-2 max-w-lg mx-auto">
                <img src="/qr-ordering-app.png" alt="Guest QR Ordering" className="w-full h-auto object-cover rounded-xl transition-all duration-300 group-hover:scale-[1.01]" />
              </div>
            </div>
          </div>

          {/* Section 5: Smooth and Quick Migration */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 bg-brand-orange/15 text-brand-orange px-4 py-1.5 rounded-full text-xs font-bold border border-brand-orange/20">
                <ArrowLeftRight size={14} />
                <span>Seamless Data Porting</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-text-header tracking-tight">
                Migrate from your existing POS, hassle-free.
              </h2>
              <p className="text-theme-text-muted text-sm sm:text-base leading-relaxed">
                Switching systems shouldn't mean losing your history. We provide a **smooth and quick migration** service from legacy platforms to Cafinity.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Historical Sales Migration</h4>
                  <p className="text-xs text-theme-text-muted">We port over your legacy transactions and cash logs so you keep your multi-year sales charts and reporting indicators.</p>
                </div>
                <div className="p-4 rounded-xl border border-theme-border bg-theme-bg-card/45">
                  <h4 className="font-bold text-sm text-theme-text-header mb-1">Catalog & Menu Imports</h4>
                  <p className="text-xs text-theme-text-muted">Upload your inventory files, menu categories, and recipe records to go live in minutes.</p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-theme-text-muted/80 italic">
                  * Note: Historical transaction data porting is subject to technical review and data compatibility check. Some conditions may apply.
                </p>
              </div>
            </div>
            
            <div className="lg:col-span-5 relative group">
              <div className="absolute inset-0 bg-brand-orange/5 rounded-2xl filter blur-xl opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative border border-theme-border/80 rounded-2xl overflow-hidden bg-theme-bg-card shadow-lg p-2">
                <img src="/pos-migration.png" alt="POS Database Migration" className="w-full h-auto object-cover rounded-xl transition-all duration-300 group-hover:scale-[1.01]" />
              </div>
            </div>
          </div>

          {/* Near-Future Roadmap / Upcoming features */}
          <div className="border border-theme-border rounded-3xl bg-theme-bg-card/80 p-8 sm:p-12 relative overflow-hidden shadow-xl">
            <div className="absolute right-0 top-0 w-[300px] h-[300px] rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
            
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-brand-orange/15 text-brand-orange px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 border border-brand-orange/10">
                <Sparkles size={12} className="animate-pulse" />
                <span>Upcoming Features Roadmap</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-theme-text-header mb-4">
                What's coming next to Cafinity.
              </h3>
              <p className="text-theme-text-muted text-sm sm:text-base leading-relaxed mb-8">
                We are building tools to automate more of your operations. Here are the features coming **very soon** to our platform:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-theme-bg-surface flex items-center justify-center text-brand-orange border border-theme-border">
                    <BarChart3 size={16} />
                  </div>
                  <h4 className="font-bold text-sm text-theme-text-header">Comprehensive Accounting Module</h4>
                  <p className="text-xs text-theme-text-muted">Natively manage operational finances, balance sheets, and tax reports directly linked to your daily sales logs.</p>
                </div>
                
                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-theme-bg-surface flex items-center justify-center text-brand-orange border border-theme-border">
                    <PhoneIcon size={16} />
                  </div>
                  <h4 className="font-bold text-sm text-theme-text-header">WhatsApp Ordering Integration</h4>
                  <p className="text-xs text-theme-text-muted">Allow customers to browse menus, select items, and place direct orders entirely inside their WhatsApp chat.</p>
                </div>

                <div className="space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-theme-bg-surface flex items-center justify-center text-brand-orange border border-theme-border">
                    <ArrowLeftRight size={16} />
                  </div>
                  <h4 className="font-bold text-sm text-theme-text-header">Direct Food Partner Integrations</h4>
                  <p className="text-xs text-theme-text-muted">Establish direct API synchronization with major food delivery platforms like Uber Eats and PickMe Foods.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bespoke Custom Requirements */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border border-theme-border rounded-3xl bg-theme-bg-surface/25 p-8">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center gap-2 text-brand-orange">
                <HeartHandshake size={20} />
                <h4 className="font-extrabold text-sm uppercase tracking-wider">Bespoke Options</h4>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-theme-text-header">
                Have specific custom requirements? We are flexible for you.
              </h3>
              <p className="text-theme-text-muted text-xs sm:text-sm leading-relaxed">
                Every dining venue runs on distinct operational habits. Whether you need a bespoke accounting API integration, unique table checkout flows, localized taxation layouts, or custom reporting cards, our engineering team is ready to build tailored extensions matching your needs. Reach out to discuss how we can help.
              </p>
            </div>
            <div className="lg:col-span-4 text-left lg:text-right">
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white font-bold text-sm shadow-md shadow-brand-orange/10 transition-all hover:scale-[1.02] cursor-pointer"
              >
                Discuss custom needs
                <ArrowRight size={16} />
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Resilience Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-theme-bg-main relative transition-colors duration-250">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-text-header mb-4">
              Engineered for speed. Built for control.
            </h2>
            <p className="text-theme-text-muted text-lg max-w-2xl mx-auto">
              Essential kitchen KDS layouts, offline resilience, and deep configurations to take total control of your operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-theme-border bg-theme-bg-card/45 hover:border-brand-orange/45 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-6 text-brand-orange border border-brand-orange/20">
                  <WifiOff size={24} />
                </div>
                <h3 className="text-lg font-bold text-theme-text-header mb-3">Offline Register Support</h3>
                <p className="text-theme-text-muted text-sm leading-relaxed mb-6">
                  Internet dropouts shouldn't stall your business. Cafinity terminals run offline seamlessly. Ring orders, apply discounts, and print kitchen receipts natively. Transactions queue locally and sync to the cloud automatically once connection is restored.
                </p>
              </div>
              <ul className="text-xs text-theme-text-muted space-y-2 text-left">
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Local transaction buffer queue</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Seamless auto-sync on reconnect</li>
              </ul>
            </div>

            <div className="p-8 rounded-3xl border border-theme-border bg-theme-bg-card/45 hover:border-brand-orange/45 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-6 text-brand-orange border border-brand-orange/20">
                  <Settings2 size={24} />
                </div>
                <h3 className="text-lg font-bold text-theme-text-header mb-3">HQ Admin Control Portal</h3>
                <p className="text-theme-text-muted text-sm leading-relaxed mb-6">
                  Take full control of your venue. Modify menus, set taxes, configure loyalty points multipliers, track staff shift hours, and manage roles. Make data-driven decisions using comprehensive sales breakdown summaries.
                </p>
              </div>
              <ul className="text-xs text-theme-text-muted space-y-2 text-left">
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Robust menu & taxes control</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Detailed shifts and security roles</li>
              </ul>
            </div>

            <div className="p-8 rounded-3xl border border-theme-border bg-theme-bg-card/45 hover:border-brand-orange/45 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center mb-6 text-brand-orange border border-brand-orange/20">
                  <Tablet size={24} />
                </div>
                <h3 className="text-lg font-bold text-theme-text-header mb-3">Mobile Order & KDS Sync</h3>
                <p className="text-theme-text-muted text-sm leading-relaxed mb-6">
                  Give your waiters a fluid mobile ordering system. Send table selections and custom modifier rules directly from tablet handhelds to KDS barista screens in the kitchen. Keep the floor and the kitchen in perfect harmony.
                </p>
              </div>
              <ul className="text-xs text-theme-text-muted space-y-2 text-left">
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Handheld table floorplan service</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-brand-orange" /> Live ticket queue time metrics</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Business Transformation Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-theme-bg-surface/10 border-t border-b border-theme-border/60 transition-colors duration-250">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-theme-text-header mb-3">Operational transformation you can measure</h2>
            <p className="text-theme-text-muted">Clear improvements specialty food venues and busy restaurants experience within their first 30 days of switching to Cafinity.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            {[
              { title: 'Zero order drift', desc: 'Direct KDS routing fires counter register and table orders straight to the kitchen baristas. Zero lost kitchen tickets, zero prep errors.' },
              { title: 'Offline operational resilience', desc: 'Never stop ringing or serving. Terminals cache orders locally during outages, auto-syncing with your database the moment the connection returns.' },
              { title: 'Elevated customer retention', desc: 'Link loyalty points to phone numbers at checkout. Bring morning regulars back for their daily coffee habits automatically.' }
            ].map((pillar, idx) => (
              <div key={idx} className="p-6 bg-theme-bg-card/60 border border-theme-border rounded-2xl">
                <h3 className="font-bold text-base text-theme-text-header mb-2">{pillar.title}</h3>
                <p className="text-xs text-theme-text-muted leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Catalog */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-theme-bg-main transition-colors duration-250">
        <div className="max-w-[1400px] mx-auto flex flex-col items-center">
          <div className="text-center mb-16 w-full">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-theme-text-header mb-4">Transparent billing, zero hidden fees</h2>
            <p className="text-theme-text-muted text-lg max-w-2xl mx-auto mb-8">
              {catalogAudience === 'local'
                ? 'LKR pricing specifically for Sri Lankan venues. 14 days of full feature access on us.'
                : 'International plans automatically localized for your local currency. Sri Lankan venues are billed natively in LKR.'}
            </p>

            {/* Billing Toggle */}
            <div className="flex flex-col items-center gap-4">
              <div className="inline-flex rounded-xl border border-theme-border p-1 bg-theme-bg-card/50 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => { setSelectedCycle('monthly'); setShowCycleBanner(true); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                    selectedCycle === 'monthly'
                      ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20'
                      : 'text-theme-text-muted hover:text-theme-text-header bg-transparent'
                  }`}
                >
                  Monthly billing (30 days)
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedCycle('yearly'); setShowCycleBanner(true); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                    selectedCycle === 'yearly'
                      ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20'
                      : 'text-theme-text-muted hover:text-theme-text-header bg-transparent'
                  }`}
                >
                  Yearly billing (365 days)
                </button>
              </div>

              {showCycleBanner && (
                <div className="bg-theme-bg-card border border-theme-border rounded-2xl p-4 max-w-xl text-center text-xs text-theme-text-muted animate-fade-in relative mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCycleBanner(false)}
                    className="absolute right-3 top-3 text-theme-text-muted hover:text-theme-text-header border-0 bg-transparent cursor-pointer"
                    aria-label="Dismiss"
                  >
                    <X size={14} />
                  </button>
                  <p className="font-semibold text-theme-text-header mb-1">
                    {selectedCycle === 'yearly' ? 'Yearly Plan Option: 365 days validity' : 'Monthly Plan Option: 30 days validity'}
                  </p>
                  <p>
                    {selectedCycle === 'yearly'
                      ? 'Yearly subscriptions run on a strict 365-day billing period, offering a massive discount over the monthly rate.'
                      : 'Monthly subscriptions run on a strict 30-day billing period, offering max flexibility to add or remove venues as you grow.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="relative w-full">
            <button
              type="button"
              aria-label="Previous pricing plan"
              onClick={() => scrollPricingTo(pricingSlide - 1)}
              disabled={pricingSlide <= 0}
              className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-theme-border bg-theme-bg-card text-theme-text-main shadow-lg hover:bg-theme-bg-surface disabled:pointer-events-none disabled:opacity-35 sm:flex md:-left-1 lg:-left-2 cursor-pointer"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next pricing plan"
              onClick={() => scrollPricingTo(pricingSlide + 1)}
              disabled={pricingSlide >= pricingSlideCount - 1}
              className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-theme-border bg-theme-bg-card text-theme-text-main shadow-lg hover:bg-theme-bg-surface disabled:pointer-events-none disabled:opacity-35 sm:flex md:-right-1 lg:-right-2 cursor-pointer"
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
                      className="min-h-[380px] w-[min(100%,280px)] shrink-0 snap-center rounded-2xl border border-theme-border bg-theme-bg-card animate-pulse sm:w-[260px]"
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
                  cardShell += lightOnCard ? 'shadow-lg border-white/20' : 'shadow-md border-slate-200';
                  cardStyle = { background: customCardBg };
                } else if (builtInFeatured) {
                  cardShell += 'border-brand-orange bg-theme-bg-card shadow-xl shadow-brand-orange/5';
                } else {
                  cardShell += 'border-theme-border bg-theme-bg-card/50 hover:border-theme-border';
                }

                const priceInfo = getFormattedPriceInfo(plan);

                // Define plan text classes dynamically to support admin-configured plan text colors
                const textMutedClass = customCardBg
                  ? (lightOnCard ? 'text-white/70' : 'text-slate-500')
                  : 'text-theme-text-muted';
                const textHeaderClass = customCardBg
                  ? (lightOnCard ? 'text-white' : 'text-slate-900')
                  : 'text-theme-text-header';
                const textMainClass = customCardBg
                  ? (lightOnCard ? 'text-white/90' : 'text-slate-700')
                  : 'text-theme-text-main';
                const textSubtitleClass = customCardBg
                  ? (lightOnCard ? 'text-white/75' : 'text-slate-500')
                  : 'text-theme-text-muted';
                const textDurationClass = customCardBg
                  ? (lightOnCard ? 'text-white/60' : 'text-slate-400')
                  : 'text-theme-text-muted/70';
                const checkColorClass = customCardBg && lightOnCard
                  ? 'text-white'
                  : 'text-brand-orange';

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

                    <div className={`text-sm font-semibold mb-2 ${textMutedClass}`}>{plan.name}</div>
                    <div className={`text-xl sm:text-2xl font-extrabold mb-0.5 tracking-tight ${textHeaderClass}`}>
                      {priceInfo.displayPrice}
                    </div>
                    {priceInfo.subtitle && (
                      <div className={`text-[10px] font-semibold mb-1 ${textSubtitleClass}`}>
                        {priceInfo.subtitle}
                      </div>
                    )}
                    <div className={`text-xs mb-6 uppercase tracking-wider ${textDurationClass}`}>
                      {selectedCycle === 'yearly' ? 'per 365 days' : 'per 30 days'}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {bulletLines.map((f, i) => (
                        <li key={`${plan._id || plan.code}-${i}`} className={`flex items-start gap-2 text-xs ${textMutedClass}`}>
                          <CheckCircle size={14} className={`shrink-0 mt-0.5 ${checkColorClass}`} />
                          <span className={`leading-snug ${textMainClass}`}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      to="/signup"
                      className="mt-auto block text-center py-3 rounded-xl text-xs font-bold transition-all bg-brand-orange hover:bg-brand-orange-hover text-white shadow-md shadow-brand-orange/10 cursor-pointer"
                    >
                      Start 14-day trial
                    </Link>
                  </div>
                );
              })}

              {!plansLoading && (
                <div className="relative flex min-h-[380px] w-[min(100%,280px)] shrink-0 snap-center flex-col rounded-2xl border border-theme-border bg-theme-bg-card p-7 text-theme-text-main shadow-lg sm:w-[260px]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-brand-orange text-white">
                    Tailor-made
                  </div>
                  <div className="text-sm font-semibold mb-2 text-theme-text-muted">{ENTERPRISE_DISPLAY.name}</div>
                  <div className="text-2xl font-extrabold text-theme-text-header mb-1 tracking-tight">{ENTERPRISE_DISPLAY.priceLabel}</div>
                  <div className="text-xs text-theme-text-muted/75 mb-6 uppercase tracking-wider">{ENTERPRISE_DISPLAY.cycle}</div>
                  <ul className="space-y-3 mb-8 text-left flex-1">
                    {ENTERPRISE_DISPLAY.lines.map((f, i) => (
                      <li key={`ent-${i}`} className="flex items-start gap-2 text-xs text-theme-text-muted">
                        <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand-orange" />
                        <span className="leading-snug text-theme-text-main">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#contact"
                    className="mt-auto inline-flex justify-center w-full py-3 rounded-xl text-xs font-bold bg-theme-bg-surface hover:bg-theme-bg-surface/80 text-theme-text-main border border-theme-border transition-all cursor-pointer"
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
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      pricingSlide === i ? 'w-6 bg-brand-orange' : 'w-1.5 bg-theme-bg-surface hover:bg-theme-bg-surface/80'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Final Action CTA */}
      <section className="relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8 border-t border-theme-border/60 transition-colors duration-250">
        <div className="absolute inset-0 bg-theme-bg-main" aria-hidden />
        <div className="absolute -bottom-1/2 left-1/2 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto text-center text-theme-text-header">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Elevate your venue operations</h2>
          <p className="text-theme-text-muted text-base sm:text-lg mb-10 leading-relaxed max-w-xl mx-auto">
            Join specialty food venues and dining destinations running on Cafinity to supercharge counter registers, table-side floorplans, and dashboard insights.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-brand-orange/20 transition-all hover:scale-[1.02] cursor-pointer"
          >
            Get started for free
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <ContactSection />
      <Footer />
      <SocialShareWidget />
    </div>
  );
}
