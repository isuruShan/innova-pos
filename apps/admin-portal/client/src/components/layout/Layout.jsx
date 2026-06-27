import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPosUrl } from '@innovapos/app-urls';
import {
  LayoutDashboard, Users, Palette, CreditCard, Building2,
  ClipboardList, Receipt, Menu, X, LogOut, User, ChevronRight, Store, Wallet, Award, ContactRound, Tag, Bell, BarChart3, Sparkles, Landmark, Package, ShoppingBag, Percent, Search, MessageSquare, KeyRound, Table
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
      { label: 'Prospects', icon: ContactRound, to: '/prospects' },
      { label: 'Suspended Activities', icon: ClipboardList, to: '/superadmin/suspended-activities' },
      { label: 'Trial Banners', icon: Palette, to: '/superadmin/banners' },
      { label: 'Trial Conversion', icon: Percent, to: '/superadmin/trial-merchants' },
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
      { label: 'Orders', icon: ShoppingBag, to: '/orders' },
      { 
        label: 'Reports', 
        icon: ClipboardList, 
        to: '/reports',
        subItems: [
          { label: 'Menu Mix', to: '/reports/menu-mix' },
          { label: 'COGS & Margins', to: '/reports/cogs' },
          { label: 'Inventory Wastage', to: '/reports/wastage' },
          { label: 'Loyalty Report', to: '/reports/loyalty', requiresAddon: 'loyalty' },
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
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Menu Management', icon: ClipboardList, to: '/menu' },
      {
        label: 'Inventory',
        icon: Package,
        to: '/inventory',
        subItems: [
          { label: 'Stock Levels', to: '/inventory/stock' },
          { label: 'Prep & Recipes', to: '/inventory/prep-recipes', requiresAddon: 'advanced_inventory' },
          { label: 'Count Sheets', to: '/inventory/count-sheets', requiresAddon: 'advanced_inventory' },
          { label: 'Stock Transfers', to: '/inventory/transfers', requiresAddon: 'advanced_inventory' },
          { label: 'Wastage', to: '/inventory/wastage' },
          { label: 'Inventory Sessions', to: '/inventory/sessions' },
          { label: 'Suppliers', to: '/suppliers' },
          { label: 'Purchase Orders', to: '/purchase-orders' },
          { label: 'Goods Receipts', to: '/goods-receipts' },
        ],
      },
      {
        label: 'Table Management',
        icon: Table,
        to: '/reservations',
        subItems: [
          { label: 'Reservations', to: '/reservations' },
          { label: 'Floor Plan View', to: '/floor-plan' },
          { label: 'Table Analytics', to: '/table-analytics' },
        ],
      },
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
      { label: 'WhatsApp Config', icon: MessageSquare, to: '/whatsapp-config', requiresAddon: 'whatsapp_integration' },
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
  const { user, logout, isSuperAdmin, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [changePasswordDrawerOpen, setChangePasswordDrawerOpen] = useState(false);
  const subscriptionLocked = !isSuperAdmin && user?.subscriptionActive === false;

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaved, setPwSaved] = useState(false);
  const [pwPending, setPwPending] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwErrors({});
    if (!pwForm.currentPassword) return setPwErrors({ currentPassword: 'Current password is required' });
    if (!pwForm.newPassword || pwForm.newPassword.length < 8) return setPwErrors({ newPassword: 'Password must be at least 8 characters' });
    if (pwForm.newPassword !== pwForm.confirm) return setPwErrors({ confirm: 'Passwords do not match' });

    setPwPending(true);
    try {
      const { data } = await api.put('/auth/me', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      updateUser(data.user, data.token, data.refreshToken);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      setPwSaved(true);
      setTimeout(() => {
        setPwSaved(false);
        setChangePasswordDrawerOpen(false);
      }, 2000);
    } catch (err) {
      setPwErrors({ api: err.response?.data?.message || 'Failed to update password' });
    } finally {
      setPwPending(false);
    }
  };

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
      return [{
        title: 'Billing',
        items: [{
          label: 'Subscription',
          icon: CreditCard,
          to: '/subscription',
          subItems: [
            { label: 'Overview', to: '/subscription/overview' },
            { label: 'Breakdown', to: '/subscription/breakdown' },
            { label: 'Payment History', to: '/subscription/payments' },
          ],
        }],
      }];
    }
    
    const activeAddons = addonStatus?.activeAddons || [];
    const role = user?.role;
    
    return ADMIN_NAV_GROUPS.map((group) => {
      let filteredItems = group.items.filter((item) => {
        if (item.requiresAddon && !activeAddons.includes(item.requiresAddon)) return false;
        
        if (role === 'purchasing_officer') {
          return ['/inventory', '/suppliers', '/purchase-orders', '/goods-receipts'].includes(item.to);
        }
        if (role === 'inventory_clerk' || role === 'commissary_operator') {
          return ['/inventory'].includes(item.to);
        }
        return true;
      });

      filteredItems = filteredItems.map((item) => {
        if (item.subItems) {
          const sub = item.subItems.filter((subItem) => {
            if (subItem.requiresAddon && !activeAddons.includes(subItem.requiresAddon)) return false;
            
            if (role === 'purchasing_officer') {
              return ['/suppliers', '/purchase-orders', '/goods-receipts'].includes(subItem.to);
            }
            if (role === 'inventory_clerk' || role === 'commissary_operator') {
              return [
                '/inventory/stock',
                '/inventory/prep-recipes',
                '/inventory/count-sheets',
                '/inventory/transfers',
                '/inventory/wastage',
                '/inventory/sessions'
              ].includes(subItem.to);
            }
            return true;
          });
          return { ...item, subItems: sub };
        }
        return item;
      }).filter(item => !item.subItems || item.subItems.length > 0);

      return {
        ...group,
        items: filteredItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [subscriptionLocked, addonStatus?.activeAddons, user?.role]);

  const merchantNavGroups = isSuperAdmin ? SUPERADMIN_NAV_GROUPS : filteredAdminNavGroups;
  const navGroups = merchantNavGroups;
  const navItems = isSuperAdmin
    ? SUPERADMIN_NAV_FLAT
    : filteredAdminNavGroups.flatMap((g) => g.items);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (to) => location.pathname.startsWith(to);

  const isItemActive = (item) => {
    if (location.pathname === item.to) return true;
    if (item.subItems && item.subItems.some(sub => location.pathname === sub.to || (sub.to !== '/' && location.pathname.startsWith(sub.to)))) {
      return true;
    }
    if (item.to !== '/' && location.pathname.startsWith(item.to)) return true;
    return false;
  };

  const currentNavLabel = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.subItems) {
          const matchedSub = item.subItems.find(sub => location.pathname === sub.to);
          if (matchedSub) return matchedSub.label;
        }
        if (location.pathname === item.to) return item.label;
      }
    }
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.subItems) {
          const matchedSub = item.subItems.find(sub => sub.to !== '/' && location.pathname.startsWith(sub.to));
          if (matchedSub) return matchedSub.label;
        }
        if (item.to !== '/' && location.pathname.startsWith(item.to)) return item.label;
      }
    }
    if (location.pathname === '/profile') return 'My Profile';
    return 'My Profile';
  }, [navGroups, location.pathname]);

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
                  const active = isItemActive(item);
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
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
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
              {currentNavLabel}
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
            {/* Avatar Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-brand-orange overflow-hidden border border-gray-250 hover:scale-[1.03] transition-all cursor-pointer focus:outline-none"
              >
                {user?.profileImage ? (
                  <img src={user.profileImage} className="w-full h-full object-cover" alt="" />
                ) : (
                  user?.name?.[0]?.toUpperCase() || 'A'
                )}
              </button>
              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-250 rounded-xl shadow-xl z-50 py-1 text-sm text-gray-700">
                    <Link
                      to="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition"
                    >
                      <User size={15} className="text-gray-400" />
                      My Profile
                    </Link>
                    <button
                      onClick={() => {
                        setChangePasswordDrawerOpen(true);
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition"
                    >
                      <KeyRound size={15} className="text-gray-400" />
                      Change Password
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-red-650 hover:bg-red-50 transition font-semibold"
                    >
                      <LogOut size={15} className="text-red-500" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
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

      {/* Change Password Side Drawer */}
      {changePasswordDrawerOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setChangePasswordDrawerOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-[60] w-80 bg-white border-l border-gray-200 shadow-2xl p-6 flex flex-col transform transition-transform duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <h3 className="font-bold text-gray-900 text-base">Change Password</h3>
              <button onClick={() => setChangePasswordDrawerOpen(false)} className="text-gray-400 hover:text-gray-650">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdatePassword} className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Current Password</label>
                <input
                  type="password"
                  value={pwForm.currentPassword}
                  onChange={(e) => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                  required
                />
                {pwErrors.currentPassword && <p className="text-xs text-red-500 mt-1">{pwErrors.currentPassword}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">New Password</label>
                <input
                  type="password"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                  required
                />
                {pwErrors.newPassword && <p className="text-xs text-red-500 mt-1">{pwErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
                  required
                />
                {pwErrors.confirm && <p className="text-xs text-red-500 mt-1">{pwErrors.confirm}</p>}
              </div>

              {pwErrors.api && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{pwErrors.api}</p>}
              {pwSaved && <p className="text-sm text-green-650 bg-green-50 border border-green-200 rounded-lg p-3">Password changed successfully!</p>}

              <button
                type="submit"
                disabled={pwPending || pwSaved}
                className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold text-sm rounded-lg transition disabled:opacity-50"
              >
                {pwPending ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
}
