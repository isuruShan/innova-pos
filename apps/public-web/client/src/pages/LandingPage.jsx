import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, ShoppingCart, BarChart3, Users, Layers, Shield,
  Clock, CheckCircle, Star, ArrowRight, ChefHat, Tablet, TrendingUp, Mail,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';
import { buildPlanCardBackground, buildPlanTagBackground, planUsesLightText } from '../utils/planAppearance';

const FEATURES = [
  {
    icon: ShoppingCart,
    title: 'Counter & table orders',
    desc: 'Ring dine-in, takeaway, and delivery tickets from one calm screen — split tabs, modifiers, and rush-hour queues without the chaos.',
  },
  {
    icon: ChefHat,
    title: 'Kitchen display that keeps pace',
    desc: 'Fire drinks and plates straight to the barista line or pass — fewer missed shots, clearer handoffs during the morning rush.',
  },
  {
    icon: BarChart3,
    title: 'Shift-aware sales insight',
    desc: 'See hourly sales, bestsellers, and category mix so you know what moved during brunch versus late espresso.',
  },
  {
    icon: Layers,
    title: 'Menus, beans & syrups under control',
    desc: 'Manage brew methods, add-ons, sizes, and retail items with stock hints before you run out of oat milk mid-shift.',
  },
  {
    icon: Zap,
    title: 'Promos that fit café habits',
    desc: 'Happy-hour bundles, pastry pairings, and loyalty-friendly discounts — applied automatically so cashiers stay fast.',
  },
  {
    icon: Shield,
    title: 'Roles for bar, floor & back office',
    desc: 'Barista, kitchen, shift lead, and owner views — everyone sees the right tools without touching pricing or payouts.',
  },
  {
    icon: Users,
    title: 'Multi-terminal coffee bars',
    desc: 'Run the register, pickup counter, and handhelds together when the line wraps around the block.',
  },
  {
    icon: TrendingUp,
    title: 'Taxes & service charges',
    desc: 'Configure VAT, service, and card fees the way your municipality and venue actually bill.',
  },
];

const STATS = [
  { value: '500+', label: 'Cafés & venues' },
  { value: '2M+', label: 'Orders rung' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '24/7', label: 'Support when you need it' },
];

/** Public pricing catalogue: Sri Lanka vs international (no login). */
function detectCatalogAudience() {
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

/** Lines shown under each API-driven pricing card (admin: Subscription plan highlights). */
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

/** Display-only tier — not loaded from /plans/public. */
const ENTERPRISE_DISPLAY = {
  name: 'Enterprise',
  priceLabel: 'Custom',
  cycle: "Tailor-made for your operation",
  lines: [
    'Bespoke workflows, branding, and integrations',
    'Multi-location & franchise rollouts',
    'Dedicated onboarding and priority support',
    'Volume pricing and SLA options',
  ],
};

function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await api.post('/contact', form);
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Get in touch</h2>
          <p className="text-gray-500">Have questions? We'd love to hear from you.</p>
        </div>

        {status === 'success' ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-green-800">Message sent!</p>
            <p className="text-green-600 text-sm mt-1">We'll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { label: 'Full name', key: 'name', type: 'text', placeholder: 'John Silva' },
                { label: 'Email address', key: 'email', type: 'email', placeholder: 'john@example.com' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="How can we help?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={4}
                required
                placeholder="Tell us about your business and what you need..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange resize-none"
              />
            </div>
            {status === 'error' && <p className="text-sm text-red-600">Failed to send. Please try again.</p>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3 rounded-lg bg-brand-orange text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 hover:bg-brand-orange-hover"
            >
              {status === 'loading' ? 'Sending...' : 'Send message'}
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
  const catalogAudience = useMemo(() => detectCatalogAudience(), []);
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

  useEffect(() => {
    let cancelled = false;
    const loadPlans = async () => {
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

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero — navy (#233d4d) + coral (#fa7237) accents */}
      <section className="relative overflow-hidden pt-24 pb-20 px-4 sm:px-6 lg:px-8 text-white">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-[#233d4d] via-[#1a3244] to-[#152a38]" />
          <div
            className="absolute -left-[20%] -top-[30%] h-[min(90vw,720px)] w-[min(90vw,720px)] rounded-full bg-[#fa7237]/25 blur-3xl"
            style={{ animation: 'public-hero-blob-a 22s ease-in-out infinite' }}
          />
          <div
            className="absolute -right-[25%] top-1/3 h-[min(80vw,600px)] w-[min(80vw,600px)] rounded-full bg-[#233d4d]/40 blur-3xl"
            style={{ animation: 'public-hero-blob-b 18s ease-in-out infinite' }}
          />
          <div
            className="absolute -inset-[25%] bg-[radial-gradient(ellipse_80%_60%_at_50%_15%,rgba(250,114,55,0.22),transparent_55%)]"
            style={{ animation: 'public-hero-mesh 20s ease-in-out infinite' }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8 backdrop-blur-sm">
            <Star size={14} className="text-[#fa7237]" fill="#fa7237" />
            <span>30-day free trial — no credit card required</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Keep every pour, plate, and tab
            <span className="block text-white/95 drop-shadow-sm">in sync — from counter to kitchen.</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/85 max-w-2xl mx-auto mb-10 leading-relaxed">
            <strong className="font-semibold text-white">Cafinity</strong> is cloud POS for cafés and counter-service venues:
            ring sales, fire tickets, manage modifiers and retail, and close the shift — without spreadsheet headaches.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#fa7237] text-white font-semibold text-base transition-all hover:scale-105 hover:bg-[#e85f2c]"
            >
              Get started for free
              <ArrowRight size={18} />
            </Link>
            <a href="#features"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all">
              See features
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 pt-10 border-t border-white/10">
            {STATS.map(s => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-[#fa7237]">{s.value}</div>
                <div className="text-sm text-white/75 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Built for how cafés actually run
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              From first espresso pull to last table — menus, modifiers, kitchen handoffs, and daily totals in one workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(feat => (
              <div key={feat.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-brand-orange/30 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-brand-brown-deep/5 group-hover:bg-brand-orange/10 transition-colors">
                  <feat.icon size={20} className="text-brand-teal" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">{feat.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#233d4d]/[0.06] via-[#fa7237]/[0.04] to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">From first login to first latte</h2>
            <p className="text-gray-600">A focused setup for busy owners — no IT degree required.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Mail, title: 'Tell us about your spot', desc: 'Share a few details about your café or counter. We review and confirm within 1–2 business days.' },
              { step: '02', icon: Tablet, title: 'Load your menu & team', desc: 'Get your logins, add drinks, food, and add-ons, then invite baristas and floor staff.' },
              { step: '03', icon: Zap, title: 'Open for service', desc: 'Take real orders, route to kitchen or bar, and watch sales roll in — same day when you are ready.' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-[#233d4d] shadow-lg shadow-[#233d4d]/25">
                  <item.icon size={24} className="text-[#fa7237]" />
                </div>
                <div className="text-xs font-bold tracking-widest text-[#233d4d] mb-2">{item.step}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — carousel (snap scroll, arrows, dots) */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-[1400px] mx-auto flex flex-col items-center">
          <div className="text-center mb-14 w-full">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              {catalogAudience === 'local'
                ? 'Plans for Sri Lanka — amounts in LKR unless noted. Start with a 30-day free trial; no credit card required.'
                : 'International plans — currency shown per tier. Start with a 30-day free trial; no credit card required.'}
            </p>
            {!plansLoading && plans.length === 0 && (
              <p className="text-gray-600 text-sm mt-4 max-w-xl mx-auto">
                Listed tiers are managed by your administrator. Enterprise is always available for custom agreements.
              </p>
            )}
          </div>

          <div className="relative w-full">
            <button
              type="button"
              aria-label="Previous pricing plan"
              onClick={() => scrollPricingTo(pricingSlide - 1)}
              disabled={pricingSlide <= 0}
              className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-35 sm:flex md:-left-1 lg:-left-2"
            >
              <ChevronLeft size={22} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next pricing plan"
              onClick={() => scrollPricingTo(pricingSlide + 1)}
              disabled={pricingSlide >= pricingSlideCount - 1}
              className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-35 sm:flex md:-right-1 lg:-right-2"
            >
              <ChevronRight size={22} strokeWidth={2} />
            </button>

            <div
              ref={pricingCarouselRef}
              className="flex min-h-[min(420px,70vh)] flex-nowrap items-stretch gap-6 overflow-x-auto scroll-smooth py-1 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [padding-inline:max(0.5rem,calc(50%-140px))] [scroll-padding-inline:max(0.5rem,calc(50%-140px))] sm:[padding-inline:2.5rem] sm:[scroll-padding-inline:2.5rem] md:[padding-inline:3.5rem] md:[scroll-padding-inline:3.5rem]"
            >
              {(plansLoading ? [1, 2, 3] : plans).map((plan, idx) => {
                if (plansLoading) {
                  return (
                    <div
                      key={`sk-${idx}`}
                      className="min-h-[380px] w-[min(100%,280px)] shrink-0 snap-center rounded-2xl border border-gray-200 bg-gray-50 animate-pulse sm:w-[260px]"
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
                  cardShell += lightOnCard ? 'shadow-lg border-white/25' : 'shadow-md border-gray-200';
                  cardStyle = { background: customCardBg };
                } else if (builtInFeatured) {
                  cardShell += 'border-[#fa7237] bg-gradient-to-b from-[#233d4d] to-[#1a2f3f] shadow-xl shadow-[#fa7237]/15';
                } else {
                  cardShell += 'border-gray-200 bg-white hover:border-gray-300';
                }

                const muted = customCardBg
                  ? lightOnCard
                    ? 'text-white/70'
                    : 'text-gray-600'
                  : builtInFeatured
                    ? 'text-white/65'
                    : 'text-gray-600';
                const titleCls = customCardBg
                  ? lightOnCard
                    ? 'text-white/85'
                    : 'text-gray-600'
                  : builtInFeatured
                    ? 'text-white/80'
                    : 'text-gray-600';
                const priceCls = customCardBg
                  ? lightOnCard
                    ? 'text-white'
                    : 'text-gray-900'
                  : builtInFeatured
                    ? 'text-white'
                    : 'text-gray-900';
                const lineCls = customCardBg
                  ? lightOnCard
                    ? 'text-white/85'
                    : 'text-gray-700'
                  : builtInFeatured
                    ? 'text-white/85'
                    : 'text-gray-700';
                const iconCls =
                  customCardBg || builtInFeatured
                    ? lightOnCard || builtInFeatured
                      ? 'text-[#fa7237]'
                      : 'text-[#233d4d]'
                    : 'text-[#233d4d]';
                const primaryCta =
                  builtInFeatured || lightOnCard
                    ? 'bg-[#fa7237] text-white hover:opacity-95'
                    : 'bg-[#233d4d] text-white hover:bg-[#1b3244]';

                return (
                  <div
                    key={plan._id || plan.code}
                    className={cardShell}
                    style={cardStyle}
                  >
                    {showRibbon && ribbonBg && (
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow-md max-w-[min(100%,220px)] truncate"
                        style={{
                          background: ribbonBg,
                          color: plan.planTagTextColor || '#ffffff',
                        }}
                        title={plan.planTagText}
                      >
                        {plan.planTagText}
                      </div>
                    )}

                    <div className={`text-sm font-semibold mb-2 ${titleCls}`}>{plan.name}</div>
                    <div className={`text-2xl sm:text-3xl font-extrabold mb-1 ${priceCls}`}>
                      {plan.currency} {Number(plan.amount).toLocaleString()}
                    </div>
                    <div className={`text-sm mb-6 ${muted}`}>
                      {plan.billingCycle === 'monthly'
                        ? '/month'
                        : plan.billingCycle === 'yearly'
                          ? '/year'
                          : `${plan.durationDays} day cycle`}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {bulletLines.map((f, i) => (
                        <li key={`${plan._id || plan.code}-${i}`} className={`flex items-start gap-2 text-sm ${lineCls}`}>
                          <CheckCircle size={15} className={`shrink-0 mt-0.5 ${iconCls}`} />
                          <span className="leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      to="/signup"
                      className={`mt-auto block text-center py-3 rounded-xl text-sm font-semibold transition-all ${primaryCta}`}
                    >
                      Start 30-day trial
                    </Link>
                  </div>
                );
              })}

              {!plansLoading && (
                <div className="relative flex min-h-[380px] w-[min(100%,280px)] shrink-0 snap-center flex-col rounded-2xl border border-[#233d4d]/35 bg-gradient-to-b from-[#233d4d] to-[#152a38] p-7 text-white shadow-lg sm:w-[260px]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-[#fa7237] text-white">
                    Tailor-made
                  </div>
                  <div className="text-sm font-semibold mb-2 text-white/85">{ENTERPRISE_DISPLAY.name}</div>
                  <div className="text-3xl font-extrabold mb-1">{ENTERPRISE_DISPLAY.priceLabel}</div>
                  <div className="text-sm mb-6 text-white/65">{ENTERPRISE_DISPLAY.cycle}</div>
                  <ul className="space-y-3 mb-8 text-left flex-1">
                    {ENTERPRISE_DISPLAY.lines.map((f, i) => (
                      <li key={`ent-${i}`} className="flex items-start gap-2 text-sm text-white/90">
                        <CheckCircle size={15} className="shrink-0 mt-0.5 text-[#fa7237]" />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#contact"
                    className="mt-auto inline-flex justify-center w-full py-3 rounded-xl text-sm font-semibold bg-white/12 border border-white/25 text-white hover:bg-white/18 transition-all"
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
                    className={`h-2 rounded-full transition-all ${
                      pricingSlide === i ? 'w-8 bg-[#fa7237]' : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA — navy + coral */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#233d4d] via-[#1e3648] to-[#fa7237]/35"
          aria-hidden
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Ready for calmer café shifts?</h2>
          <p className="text-white/90 text-lg mb-8">
            Teams use Cafinity to tame busy counters and keep the pass moving. Start your free 30-day trial today.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-[#fa7237] text-white font-semibold px-8 py-4 rounded-xl text-base shadow-lg shadow-black/25 transition-all hover:bg-[#e85f2c] hover:scale-[1.02]"
          >
            Start free trial
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <ContactSection />
      <Footer />
    </div>
  );
}
