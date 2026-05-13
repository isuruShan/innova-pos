import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Palette, CreditCard, Building2,
  ClipboardList, Receipt, Menu, X, LogOut, User, ChevronRight, Store, Wallet, Award, ContactRound, Tag, Bell,
} from 'lucide-react';
import NotificationBell from '../NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';

const SUPERADMIN_NAV_GROUPS = [
  {
    title: 'Platform',
    items: [
      { label: 'Merchants', icon: Building2, to: '/merchants' },
      { label: 'Applications', icon: ClipboardList, to: '/applications' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Payments', icon: Receipt, to: '/payments' },
      { label: 'Plans', icon: CreditCard, to: '/plans' },
    ],
  },
];

const ADMIN_NAV_GROUPS = [
  {
    title: 'Business',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
      { label: 'Notifications', icon: Bell, to: '/notifications' },
      { label: 'Branding & Settings', icon: Palette, to: '/branding' },
      { label: 'Users', icon: Users, to: '/users' },
      { label: 'Stores', icon: Store, to: '/stores' },
    ],
  },
  {
    title: 'Customers & marketing',
    items: [
      { label: 'Loyalty admin', icon: Award, to: '/loyalty' },
      { label: 'Customers', icon: ContactRound, to: '/customers' },
      { label: 'Promotions', icon: Tag, to: '/promotions' },
    ],
  },
  {
    title: 'Operations & billing',
    items: [
      { label: 'Cashier sessions', icon: Wallet, to: '/cashier-sessions' },
      { label: 'Subscription', icon: CreditCard, to: '/subscription' },
    ],
  },
];

const ADMIN_NAV_FLAT = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
const SUPERADMIN_NAV_FLAT = SUPERADMIN_NAV_GROUPS.flatMap((g) => g.items);

export default function Layout({ children }) {
  const { user, logout, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { stores, selectedStoreId, selectStore } = useStoreContext();

  const navItems = isSuperAdmin ? SUPERADMIN_NAV_FLAT : ADMIN_NAV_FLAT;

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
          <img src="/cafinity-logo.png" alt="Cafinity" className="h-8 w-auto shrink-0 rounded-md" />
          <div className="min-w-0">
            <p className="text-gray-400 text-xs leading-tight">
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
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {(isSuperAdmin ? SUPERADMIN_NAV_GROUPS : ADMIN_NAV_GROUPS).map((group) => (
            <details key={group.title} open className="group mb-1">
              <summary className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold cursor-pointer list-none flex items-center justify-between select-none [&::-webkit-details-marker]:hidden">
                {group.title}
                <ChevronRight size={12} className="opacity-60 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-brand-teal text-white'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon size={17} className="shrink-0" />
                      {item.label}
                      {active ? <ChevronRight size={14} className="ml-auto opacity-80" /> : null}
                    </Link>
                  );
                })}
              </div>
            </details>
          ))}
          {!isSuperAdmin && (
            <a
              href={import.meta.env.VITE_POS_URL || 'http://localhost:5173'}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LayoutDashboard size={17} className="shrink-0" />
              Open POS App
            </a>
          )}
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
            {user && <NotificationBell />}
            {!isSuperAdmin && (
              <select
                value={selectedStoreId}
                onChange={(e) => selectStore(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-2.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              >
                {stores.map((store) => (
                  <option key={store._id} value={store._id}>{store.name}</option>
                ))}
              </select>
            )}
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
