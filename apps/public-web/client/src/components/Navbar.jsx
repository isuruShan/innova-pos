import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Zap } from 'lucide-react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[#042f2c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand-orange">
              <Zap size={18} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">InnovaPOS</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[
              { label: 'Features', href: '#features' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Contact', href: '#contact' },
            ].map(link => (
              <a key={link.label} href={link.href}
                className="text-sm font-medium text-teal-100/85 hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a href="http://localhost:5173" target="_blank" rel="noreferrer"
              className="text-sm font-medium text-teal-100/85 hover:text-white px-4 py-2 rounded-lg transition-colors">
              Sign In
            </a>
            <Link to="/signup"
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
        <div className="md:hidden bg-[#042f2c] px-4 py-4 space-y-3">
          {['#features', '#pricing', '#contact'].map((href, i) => (
            <a key={i} href={href} onClick={() => setOpen(false)}
              className="block text-sm font-medium text-teal-100/90 py-2 hover:text-white">
              {['Features', 'Pricing', 'Contact'][i]}
            </a>
          ))}
          <Link to="/signup" onClick={() => setOpen(false)}
            className="block text-center text-sm font-semibold text-white px-4 py-2 rounded-lg mt-2 bg-brand-orange hover:bg-brand-orange-hover"
          >
            Get Started Free
          </Link>
        </div>
      )}
    </nav>
  );
}
