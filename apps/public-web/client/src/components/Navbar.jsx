import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-[#233d4d]/98 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo-1.png" alt="Cafinity" className="h-9 w-auto rounded-lg shadow-sm" />
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
        <div className="md:hidden bg-[#233d4d] px-4 py-4 space-y-3 border-t border-white/10">
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
