import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, UserCircle, Settings } from 'lucide-react';
import ProfileSlideOver, { AvatarDisplay } from './ProfileSlideOver';

const ROLE_BADGE = {
  cashier: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  kitchen: 'bg-green-500/20 text-green-400 border-green-500/30',
  manager: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

export function AvatarMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const openProfile = () => { setOpen(false); setProfileOpen(true); };

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="ring-2 ring-transparent hover:ring-white/20 rounded-full transition"
          title={user.name}
        >
          <AvatarDisplay user={user} size="sm" />
        </button>

        {open && (
          <div className="absolute right-0 top-11 w-60 bg-[#1e293b] border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 z-[200] overflow-hidden">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-3">
              <AvatarDisplay user={user} size="md" />
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{user.name}</p>
                <p className="text-slate-500 text-xs truncate">{user.email}</p>
                <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${ROLE_BADGE[user.role]}`}>
                  {user.role}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-2 space-y-0.5">
              <button
                onClick={openProfile}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition"
              >
                <UserCircle size={15} className="text-slate-500" />
                My Profile
              </button>

              {user.role === 'manager' && (
                <Link
                  to="/manager/settings"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition"
                >
                  <Settings size={15} className="text-slate-500" />
                  Settings
                </Link>
              )}

              <div className="border-t border-slate-700/40 pt-1 mt-1">
                <button
                  onClick={() => { setOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ProfileSlideOver open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

export default function Navbar({ links = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bg-[#1e293b] border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 mr-3">
          <img src="/logo.png" alt="Burger Joint" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-bold text-white text-sm hidden sm:block tracking-wide">Burger Joint</span>
        </div>

        {links.length > 0 && (
          <div className="flex items-center gap-0.5">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  location.pathname === link.to
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {link.icon && <link.icon size={14} />}
                <span className="hidden md:block">{link.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {user && <AvatarMenu user={user} onLogout={() => { logout(); navigate('/login'); }} />}
    </nav>
  );
}
