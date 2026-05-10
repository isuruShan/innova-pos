import { useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import api from '../api';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    try {
      await api.post('/newsletter', { email });
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <footer id="contact" className="bg-brand-brown-deep text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/cafinity-logo.png" alt="Cafinity" className="h-9 w-auto rounded-lg" />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-sm">
              Cafinity is cafe-focused POS software — built for espresso bars, brunch counters, and busy service floors.
            </p>
            {/* Newsletter */}
            <div>
              <p className="text-sm font-semibold mb-3">Stay updated</p>
              {status === 'success' ? (
                <p className="text-sm text-green-400">Subscribed! Thanks for joining.</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:border-brand-orange"
                  />
                  <button type="submit"
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 bg-brand-orange hover:bg-brand-orange-hover"
                  >
                    Subscribe
                  </button>
                </form>
              )}
              {status === 'error' && <p className="text-sm text-red-400 mt-1">Something went wrong. Try again.</p>}
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="text-sm font-semibold mb-4 text-gray-300">Platform</p>
            <ul className="space-y-2">
              {['Features', 'Pricing', 'Documentation', 'Status'].map(l => (
                <li key={l}><a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm font-semibold mb-4 text-gray-300">Contact</p>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <Mail size={14} className="shrink-0" />
                innovasolutionslk@gmail.com
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-400">
                <Phone size={14} className="shrink-0" />
                +94 77 000 0000
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-400">
                <MapPin size={14} className="shrink-0 mt-0.5" />
                Colombo, Sri Lanka
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Cafinity. All rights reserved.</p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service'].map(l => (
              <a key={l} href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
