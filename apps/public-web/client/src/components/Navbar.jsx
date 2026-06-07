import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, LogIn } from 'lucide-react';
import SignInPortalModal from './SignInPortalModal';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[#233d4d]/98 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-1.png" alt="Cafinity" className="h-9 w-auto rounded-lg shadow-sm" />
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {[
              { label: 'Features', href: '/#features' },
              { label: 'Pricing', href: '/#pricing' },
              { label: 'Contact', href: '/#contact' },
              { label: 'WhatsApp', href: 'https://wa.me/94773539443', target: '_blank', rel: 'noreferrer' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.target}
                rel={link.rel}
                className="text-sm font-medium text-teal-100/85 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
            <span className="h-5 w-px bg-white/20 shrink-0" aria-hidden />
  
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="text-sm font-semibold text-teal-100/90 px-4 py-2 rounded-lg border border-white/25 hover:bg-white/10 hover:text-white transition-colors inline-flex items-center gap-1.5"
            >
              <LogIn size={16} />
              Sign in
            </button>
            <Link
              to="/signup"
              className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors bg-brand-orange hover:bg-brand-orange-hover"
            >
              Get Started Free
            </Link>
          </div>

          <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg text-teal-100/85 hover:text-white">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[#233d4d] px-4 py-4 space-y-3 border-t border-white/10">
          {[
            { href: '/#features', label: 'Features' },
            { href: '/#pricing', label: 'Pricing' },
            { href: '/#contact', label: 'Contact' },
            { href: 'https://wa.me/94773539443', label: 'WhatsApp', target: '_blank', rel: 'noreferrer' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.target}
              rel={link.rel}
              onClick={() => setOpen(false)}
              className="block text-sm font-medium text-teal-100/90 py-2 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <div className="border-t border-white/10 pt-3 mt-1">
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSignInOpen(true);
            }}
            className="block w-full text-center text-sm font-semibold text-teal-100/90 px-4 py-2 rounded-lg border border-white/25 hover:bg-white/10"
          >
            Sign in
          </button>
          <Link
            to="/signup"
            onClick={() => setOpen(false)}
            className="block text-center text-sm font-semibold text-white px-4 py-2 rounded-lg mt-2 bg-brand-orange hover:bg-brand-orange-hover"
          >
            Get Started Free
          </Link>
        </div>
      )}

      <SignInPortalModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </nav>
  );
}
