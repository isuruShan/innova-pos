import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPosUrl } from '@innovapos/app-urls';
import {
  LayoutDashboard, Users, Palette, CreditCard, Building2,
  ClipboardList, Receipt, Menu, X, LogOut, User, ChevronRight, Store, Wallet, Award, ContactRound, Tag, Bell, BarChart3, Sparkles, Landmark, Package, ShoppingBag, Percent, Search
} from 'lucide-react';
import api from '../../api/axios';
import NotificationBell from '../NotificationBell';
import SubscriptionDueBanner from '../SubscriptionDueBanner';
import SubscriptionEndedBanner from '../SubscriptionEndedBanner';
import TrialBanners from '../TrialBanners';
import ExpiryWarningBanner from '../ExpiryWarningBanner';
import { useAuth } from '../../context/AuthContext';
import GlobalSearchModal from './GlobalSearchModal';

const SUPERADMIN_NAV_GROUPS = [
  {
    title: 'Platform',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/superadmin/dashboard' },
      { label: 'Merchants', icon: Building2, to: '/merchants' },
      { label: 'Applications', icon: ClipboardList, to: '/applications' },
      { label: 'Suspended Activities', icon: ClipboardList, to: '/superadmin/suspended-activities' },
      { label: 'Trial Banners', icon: Palette, to: '/superadmin/banners' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Payments', icon: Receipt, to: '/payments' },
      { label: 'Plans', icon: CreditCard, to: '/plans' },
      { label: 'Paid add-ons', icon: Tag, to: '/paid-addons' },
      { label: 'Payment setup', icon: Wallet, to: '/payment-setup' },
      { label: 'Uber Eats Setup', icon: Sparkles, to: '/uber-setup' },
    ],
  },
];

const ADMIN_NAV_GROUPS = [
  {
    title: 'Business',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
      { label: 'Analytics', icon: BarChart3, to: '/analytics' },
      { 
        label: 'Reports', 
        icon: ClipboardList, 
        to: '/reports',
        subItems: [
          { label: 'Menu Mix', to: '/reports/menu-mix' },
          { label: 'Order Distribution', to: '/reports/order-distribution' },
          { label: 'Hourly Trends', to: '/reports/hourly-sales' },
          { label: 'Payment Reconciliation', to: '/reports/payment-reconciliation' },
          { label: 'Returns & Refunds', to: '/reports/refunds' },
          { label: 'Drawer Cash Sessions', to: '/reports/cash-sessions' },
        ],
      },
      { label: 'Notifications', icon: Bell, to: '/notifications' },
      { label: 'Branding & Settings', icon: Palette, to: '/branding' },
      { 
        label: 'Users', 
        icon: Users, 
        to: '/users',
        subItems: [
          { label: 'Active Users', to: '/users/active' },
          { label: 'Pending Approvals', to: '/users/pending' },
        ],
      },
      { 
        label: 'Stores', 
        icon: Store, 
        to: '/stores',
        subItems: [
          { label: 'Active Stores', to: '/stores/active' },
          { label: 'Pending Stores', to: '/stores/pending' },
        ],
      },
      { label: 'Inventory Sessions', icon: Package, to: '/inventory-sessions' },
    ],
  },
  {
    title: 'Customers & marketing',
    items: [
      { 
        label: 'Loyalty admin', 
        icon: Award, 
        to: '/loyalty', 
        requiresAddon: 'loyalty',
        subItems: [
          { label: 'Program & Tiers', to: '/loyalty/program' },
          { label: 'Rewards', to: '/loyalty/rewards' },
        ],
      },
      { label: 'Customers', icon: ContactRound, to: '/customers' },
      { label: 'Promotions', icon: Tag, to: '/promotions' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { 
        label: 'Accounting', 
        icon: Landmark, 
        to: '/accounting', 
        requiresAddon: 'accounting',
        subItems: [
          { label: 'Chart of Accounts', to: '/accounting/coa' },
          { label: 'General Ledger', to: '/accounting/ledger' },
          { label: 'Contacts', to: '/accounting/contacts' },
          { label: 'Payroll', to: '/accounting/payroll' },
          { label: 'Reports', to: '/accounting/reports' },
        ],
      },
      { label: 'Channel Commissions', icon: Percent, to: '/foodmarket-commissions' },
    ],
  },
  {
    title: 'Operations & billing',
    items: [
      { label: 'Cashier sessions', icon: Wallet, to: '/cashier-sessions' },
      { label: 'Foodmarket Partners', icon: ShoppingBag, to: '/foodmarket-partners' },
      { label: 'Add-ons', icon: Sparkles, to: '/addons' },
      { label: 'Uber Eats Config', icon: Sparkles, to: '/uber-config', requiresAddon: 'uber_eats' },
      { 
        label: 'Subscription', 
        icon: CreditCard, 
        to: '/subscription',
        subItems: [
          { label: 'Overview', to: '/subscription/overview' },
          { label: 'Breakdown', to: '/subscription/breakdown' },
          { label: 'Payment History', to: '/subscription/payments' },
        ],
      },
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
  const [searchOpen, setSearchOpen] = useState(false);
  const subscriptionLocked = !isSuperAdmin && user?.subscriptionActive === false;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch tenant's active addons (only for merchant admins)
  const { data: addonStatus } = useQuery({
    queryKey: ['tenant-addon-status'],
    queryFn: async () => {
      const { data } = await api.get('/paid-addons/status');
      return data;
    },
    enabled: !isSuperAdmin && !subscriptionLocked,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Filter nav items based on addon subscriptions
  const filteredAdminNavGroups = useMemo(() => {
    if (subscriptionLocked) {
      return [{ title: 'Billing', items: [{ label: 'Subscription', icon: CreditCard, to: '/subscription' }] }];
    }
    
    const activeAddons = addonStatus?.activeAddons || [];
    
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        // Show items that don't require an addon
        if (!item.requiresAddon) return true;
        // Show items only if the addon is active
        return activeAddons.includes(item.requiresAddon);
      }),
    })).filter((group) => group.items.length > 0); // Remove empty groups
  }, [subscriptionLocked, addonStatus?.activeAddons]);

  const merchantNavGroups = isSuperAdmin ? SUPERADMIN_NAV_GROUPS : filteredAdminNavGroups;
  const navGroups = merchantNavGroups;
  const navItems = isSuperAdmin
    ? SUPERADMIN_NAV_FLAT
    : (subscriptionLocked ? [{ label: 'Subscription', to: '/subscription' }] : filteredAdminNavGroups.flatMap((g) => g.items));

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
          <img src="/logo-2.png" alt="Cafinity" className="h-8 w-auto shrink-0 rounded-md" />
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
        <nav className="admin-sidebar-scroll flex-1 overflow-y-auto overscroll-contain py-4 px-3 space-y-1">
          {navGroups.map((group) => (
            <details key={group.title} open className="group mb-1">
              <summary className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold cursor-pointer list-none flex items-center justify-between select-none [&::-webkit-details-marker]:hidden">
                {group.title}
                <ChevronRight size={12} className="opacity-60 shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.to);
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  
                  return (
                    <div key={item.to}>
                      <Link
                        to={hasSubItems ? item.subItems[0].to : item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? 'bg-brand-teal text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <item.icon size={17} className="shrink-0" />
                        {item.label}
                        {active && !hasSubItems ? <ChevronRight size={14} className="ml-auto opacity-80" /> : null}
                        {hasSubItems && <ChevronRight size={14} className={`ml-auto opacity-60 transition-transform ${active ? 'rotate-90' : ''}`} />}
                      </Link>
                      
                      {/* Sub-items */}
                      {hasSubItems && active && (
                        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                          {item.subItems.map((subItem) => {
                            const subActive = location.pathname === subItem.to;
                            return (
                              <Link
                                key={subItem.to}
                                to={subItem.to}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  subActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                {subItem.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
          {!isSuperAdmin && (
            <a
              href={getPosUrl()}
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
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600 bg-gray-50/50 hover:bg-gray-50 text-xs transition-all cursor-pointer font-medium"
              title="Search the portal (Ctrl+K)"
            >
              <Search size={14} className="text-gray-400" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline-block text-[9px] bg-white border border-gray-200 rounded px-1 shadow-sm font-sans font-semibold">Ctrl + K</kbd>
            </button>
            {user && <NotificationBell />}
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
          {!isSuperAdmin && <ExpiryWarningBanner />}
          {!isSuperAdmin && (subscriptionLocked ? <SubscriptionEndedBanner /> : <SubscriptionDueBanner />)}
          {!isSuperAdmin && <TrialBanners />}
          {children}
        </main>
      </div>
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
