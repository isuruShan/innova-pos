import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Zap, LayoutDashboard, Users, Palette, CreditCard, Building2,
  ClipboardList, Receipt, Menu, X, LogOut, User, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const SUPERADMIN_NAV = [
  { label: 'Merchants', icon: Building2, to: '/merchants' },
  { label: 'Applications', icon: ClipboardList, to: '/applications' },
  { label: 'Payments', icon: Receipt, to: '/payments' },
];

const ADMIN_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Branding & Settings', icon: Palette, to: '/branding' },
  { label: 'Users', icon: Users, to: '/users' },
  { label: 'Subscription', icon: CreditCard, to: '/subscription' },
];

export default function Layout({ children }) {
  const { user, logout, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = isSuperAdmin ? SUPERADMIN_NAV : ADMIN_NAV;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (to) => location.pathname.startsWith(to);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-brand-brown-deep transition-transform duration-200
        lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-brand-orange">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">InnovaPOS</p>
            <p className="text-gray-400 text-xs">
              {isSuperAdmin ? 'Super Admin' : 'Admin Portal'}
            </p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-gray-400 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Tenant badge (merchant admin) */}
        {!isSuperAdmin && user?.name && (
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs text-gray-400 truncate">{user.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(item => {
            const active = isActive(item.to);
            return (
              <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-teal text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}>
                <item.icon size={17} className="shrink-0" />
                {item.label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3 space-y-0.5">
          <Link to="/profile" onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive('/profile') ? 'bg-brand-teal text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}>
            <User size={17} className="shrink-0" />
            My Profile
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut size={17} className="shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center px-4 sm:px-6 gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-800 truncate">
              {navItems.find(n => isActive(n.to))?.label || 'My Profile'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {user?.isTemporaryPassword && (
              <Link to="/profile?changePassword=1"
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
                Change temporary password
              </Link>
            )}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-brand-orange"
            >
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
