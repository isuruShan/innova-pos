import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, LogIn, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import SignInPortalModal from './SignInPortalModal';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-theme-bg-card/90 backdrop-blur-md border-b border-theme-border/60 transition-colors duration-250">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 relative">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            {/* Adaptive logo container */}
            <div className="bg-theme-bg-surface/40 p-1 rounded-lg border border-theme-border/50">
              <img src="/logo-1.png" alt="Cafinity" className="h-9 w-auto rounded-md shadow-xs" />
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {[
              { label: 'Features', href: '/#features' },
              { label: 'Pricing', href: '/#pricing' },
              { label: 'Guide', href: '/merchant-guide', isRouterLink: true },
              { label: 'Contact', href: '/#contact' },
            ].map((link) => link.isRouterLink ? (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-medium text-theme-text-muted hover:text-theme-text-header transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-theme-text-muted hover:text-theme-text-header transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">


            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="text-sm font-semibold text-theme-text-main px-4 py-2 rounded-lg border border-theme-border/80 hover:bg-theme-bg-surface/60 hover:text-theme-text-header transition-colors inline-flex items-center gap-1.5 cursor-pointer"
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

          <button onClick={() => setOpen(!open)} className="md:hidden p-2 rounded-lg text-theme-text-muted hover:text-theme-text-header">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-theme-bg-card px-4 py-4 space-y-3 border-t border-theme-border/80">
          {[
            { href: '/#features', label: 'Features' },
            { href: '/#pricing', label: 'Pricing' },
            { href: '/merchant-guide', label: 'Guide', isRouterLink: true },
            { href: '/#contact', label: 'Contact' },
          ].map((link) => link.isRouterLink ? (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setOpen(false)}
              className="block text-sm font-medium text-theme-text-muted py-2 hover:text-theme-text-header"
            >
              {link.label}
            </Link>
          ) : (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block text-sm font-medium text-theme-text-muted py-2 hover:text-theme-text-header"
            >
              {link.label}
            </a>
          ))}
          


          <div className="border-t border-theme-border/60 pt-3 mt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSignInOpen(true);
              }}
              className="block w-full text-center text-sm font-semibold text-theme-text-main px-4 py-2 rounded-lg border border-theme-border hover:bg-theme-bg-surface"
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
        </div>
      )}

      <SignInPortalModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </nav>
  );
}
