import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, ShoppingCart, BarChart3, Users, Layers, Shield,
  Clock, CheckCircle, Star, ArrowRight, ChefHat, Tablet, TrendingUp, Mail
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';

const FEATURES = [
  {
    icon: ShoppingCart,
    title: 'Smart Order Management',
    desc: 'Seamlessly manage dine-in, takeaway, Uber Eats, and PickMe orders from a single elegant interface.',
  },
  {
    icon: ChefHat,
    title: 'Kitchen Display System',
    desc: 'Real-time order updates for kitchen staff. No more paper tickets — reduce errors, speed up service.',
  },
  {
    icon: BarChart3,
    title: 'Sales Analytics & Reports',
    desc: 'Daily revenue, best sellers, category breakdowns, and trend charts. Understand your business at a glance.',
  },
  {
    icon: Layers,
    title: 'Menu & Inventory Control',
    desc: 'Manage your full menu with categories, combos, images, and pricing. Track inventory with automatic low-stock alerts.',
  },
  {
    icon: Zap,
    title: 'Smart Promotions Engine',
    desc: 'Bundle deals, buy-X-get-Y, flat discounts, and percentage off — applied automatically at checkout.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    desc: 'Cashier, Kitchen, Manager, and Admin roles with fine-grained permissions. Your staff only sees what they need.',
  },
  {
    icon: Users,
    title: 'Multi-User & Multi-Terminal',
    desc: 'Run multiple terminals simultaneously. Perfect for busy restaurants with dedicated cashier stations.',
  },
  {
    icon: TrendingUp,
    title: 'Flexible Tax & Fees',
    desc: 'Define multiple tax components per order type. Add service fees as percentage or fixed amounts.',
  },
];

const PLANS = [
  {
    name: 'Monthly',
    price: '4,990',
    period: '/month',
    highlight: false,
    badge: null,
    features: [
      'Unlimited orders',
      'Up to 5 staff accounts',
      'Sales analytics & reports',
      'Menu & inventory management',
      'Kitchen display system',
      'Email support',
    ],
    cta: 'Start 30-day trial',
  },
  {
    name: 'Yearly',
    price: '3,990',
    period: '/month, billed annually',
    highlight: true,
    badge: 'Save 20%',
    features: [
      'Everything in Monthly',
      'Unlimited staff accounts',
      'Priority support',
      'Custom integrations',
      'Advanced analytics',
      'Dedicated onboarding',
    ],
    cta: 'Start 30-day trial',
  },
  {
    name: 'Custom',
    price: 'Let\'s talk',
    period: '',
    highlight: false,
    badge: 'Enterprise',
    features: [
      'Multi-location support',
      'Custom feature development',
      'SLA guarantee',
      'On-site training',
      'White-label option',
      'Dedicated account manager',
    ],
    cta: 'Contact us',
  },
];

const STATS = [
  { value: '500+', label: 'Businesses served' },
  { value: '2M+', label: 'Orders processed' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '24/7', label: 'Support available' },
];

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
    <section className="py-20 bg-gray-50">
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
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero — teal layered gradient + soft motion (orange reserved for buttons) */}
      <section className="relative overflow-hidden pt-24 pb-20 px-4 sm:px-6 lg:px-8 text-white">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-br from-[#042f2c] via-brand-teal-deep to-[#0d9488]" />
          <div
            className="absolute -left-[20%] -top-[30%] h-[min(90vw,720px)] w-[min(90vw,720px)] rounded-full bg-teal-300/20 blur-3xl"
            style={{ animation: 'public-hero-blob-a 22s ease-in-out infinite' }}
          />
          <div
            className="absolute -right-[25%] top-1/3 h-[min(80vw,600px)] w-[min(80vw,600px)] rounded-full bg-cyan-200/15 blur-3xl"
            style={{ animation: 'public-hero-blob-b 18s ease-in-out infinite' }}
          />
          <div
            className="absolute -inset-[25%] bg-[radial-gradient(ellipse_80%_60%_at_50%_15%,rgba(94,234,212,0.18),transparent_55%)]"
            style={{ animation: 'public-hero-mesh 20s ease-in-out infinite' }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8 backdrop-blur-sm">
            <Star size={14} className="text-yellow-400" fill="#facc15" />
            <span>30-day free trial — no credit card required</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            The POS that grows
            <span className="block text-teal-100 drop-shadow-sm">with your business</span>
          </h1>

          <p className="text-lg sm:text-xl text-teal-100/90 max-w-2xl mx-auto mb-10 leading-relaxed">
            InnovaPOS is a cloud-based point of sale platform designed for restaurants, cafes, and food businesses.
            Manage orders, staff, inventory, and analytics from anywhere.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-brand-orange text-white font-semibold text-base transition-all hover:scale-105 hover:bg-brand-orange-hover"
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
                <div className="text-3xl font-bold text-teal-200">{s.value}</div>
                <div className="text-sm text-teal-100/70 mt-1">{s.label}</div>
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
              Everything you need to run your business
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              From the first order of the day to closing reports — InnovaPOS handles it all.
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Up and running in minutes</h2>
            <p className="text-gray-500">Simple onboarding, no technical knowledge required.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Mail, title: 'Apply online', desc: 'Fill out your business details. Our team reviews and approves within 1–2 business days.' },
              { step: '02', icon: Tablet, title: 'Get your account', desc: 'Receive your login credentials by email. Log in, customize your menu, and invite staff.' },
              { step: '03', icon: Zap, title: 'Start selling', desc: 'Your POS is live. Accept orders, track sales, and grow your business from day one.' },
            ].map(item => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-brand-brown-deep">
                  <item.icon size={24} className="text-brand-teal" />
                </div>
                <div className="text-xs font-bold tracking-widest text-brand-teal mb-2">{item.step}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-lg">All prices in LKR. Start with a 30-day free trial — no credit card required.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(plan => (
              <div key={plan.name}
                className={`relative rounded-2xl p-8 border transition-all ${
                  plan.highlight
                    ? 'border-brand-orange bg-brand-brown-deep shadow-xl shadow-brand-orange/10 scale-105'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold
                    ${plan.highlight ? 'bg-brand-orange text-white' : 'bg-gray-900 text-white'}`}>
                    {plan.badge}
                  </div>
                )}

                <div className={`text-sm font-semibold mb-2 ${plan.highlight ? 'text-gray-300' : 'text-gray-500'}`}>
                  {plan.name}
                </div>
                <div className={`text-3xl font-extrabold mb-1 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price === "Let's talk" ? plan.price : `Rs. ${plan.price}`}
                </div>
                {plan.period && (
                  <div className={`text-sm mb-6 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{plan.period}</div>
                )}

                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.highlight ? 'text-gray-300' : 'text-gray-600'}`}>
                      <CheckCircle size={15} className="shrink-0 mt-0.5 text-brand-teal" />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.name === 'Custom' ? (
                  <a href="#contact"
                    className="block text-center py-3 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:border-gray-400 transition-colors">
                    {plan.cta}
                  </a>
                ) : (
                  <Link to="/signup"
                    className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90
                      ${plan.highlight ? 'bg-brand-orange text-white' : 'bg-brand-brown-deep text-white'}`}>
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — teal panel; orange only on the button */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-teal-deep via-brand-teal to-[#0f766e]"
          aria-hidden
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Ready to grow your business?</h2>
          <p className="text-teal-50/90 text-lg mb-8">
            Join hundreds of restaurants already using InnovaPOS. Start your free 30-day trial today.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-brand-orange text-white font-semibold px-8 py-4 rounded-xl text-base shadow-lg shadow-black/20 transition-all hover:bg-brand-orange-hover hover:scale-[1.02]"
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
