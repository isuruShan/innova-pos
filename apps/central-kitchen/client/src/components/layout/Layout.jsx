import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Receipt, Menu, X, LogOut, User,
  ChevronRight, BarChart3, Package, Truck, ArrowLeftRight, KeyRound, UtensilsCrossed
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const CK_NAV_GROUPS = [
  {
    title: 'Commissary Operations',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
      {
        label: 'Central Inventory',
        icon: Package,
        to: '/inventory',
        subItems: [
          { label: 'Stock Levels', to: '/inventory/stock' },
          { label: 'Count Sheets', to: '/inventory/count-sheets' },
          { label: 'Stocktakes', to: '/inventory/sessions' },
        ],
      },
      {
        label: 'Stock Transfers',
        icon: ArrowLeftRight,
        to: '/transfers',
        subItems: [
          { label: 'Transfer Requests', to: '/transfers/requests' },
          { label: 'Transfer Logs', to: '/transfers/logs' },
        ],
      },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { label: 'Suppliers', icon: Truck, to: '/suppliers' },
      { label: 'Purchase Orders', icon: Receipt, to: '/purchase-orders' },
      { label: 'Goods Receipts (GRN)', icon: ClipboardList, to: '/goods-receipts' },
    ],
  },
  {
    title: 'Auditing',
    items: [
      { label: 'Variance Analytics', icon: BarChart3, to: '/variance-analytics' },
    ],
  },
];

export default function Layout({ children }) {
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [changePasswordDrawerOpen, setChangePasswordDrawerOpen] = useState(false);

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
      if (updateUser) updateUser(data.user, data.token, data.refreshToken);
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
    for (const group of CK_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.subItems) {
          const matchedSub = item.subItems.find(sub => location.pathname === sub.to);
          if (matchedSub) return matchedSub.label;
        }
        if (location.pathname === item.to) return item.label;
      }
    }
    for (const group of CK_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.subItems) {
          const matchedSub = item.subItems.find(sub => sub.to !== '/' && location.pathname.startsWith(sub.to));
          if (matchedSub) return matchedSub.label;
        }
        if (item.to !== '/' && location.pathname.startsWith(item.to)) return item.label;
      }
    }
    if (location.pathname === '/profile') return 'My Profile';
    return 'Dashboard';
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — identical to admin portal: bg-brand-brown-deep */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-brand-brown-deep transition-transform duration-200
        lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10 shrink-0">
          <img src="/logo-2.png" alt="Cafinity" className="h-8 w-auto shrink-0 rounded-md" />
          <div className="min-w-0">
            <p className="text-gray-400 text-xs leading-tight">Central Kitchen</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-gray-400 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Tenant / user name badge */}
        {user?.name && (
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs text-gray-400 truncate">{user.name}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="admin-sidebar-scroll flex-1 overflow-y-auto overscroll-contain py-4 px-3 space-y-1">
          {CK_NAV_GROUPS.map((group) => (
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

          {/* Link back to Admin Portal */}
          <a
            href={import.meta.env.VITE_ADMIN_URL || 'https://admin.cafinity.io'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <UtensilsCrossed size={17} className="shrink-0" />
            Admin Portal
          </a>
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
        {/* Top bar — identical to admin portal */}
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
            {/* Avatar Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-brand-orange overflow-hidden border border-gray-200 hover:scale-[1.03] transition-all cursor-pointer focus:outline-none"
              >
                {user?.profileImage ? (
                  <img src={user.profileImage} className="w-full h-full object-cover" alt="" />
                ) : (
                  user?.name?.[0]?.toUpperCase() || 'U'
                )}
              </button>
              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 text-sm text-gray-700">
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
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition font-semibold"
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
          {children}
        </main>
      </div>

      {/* Change Password Side Drawer */}
      {changePasswordDrawerOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setChangePasswordDrawerOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-[60] w-80 bg-white border-l border-gray-200 shadow-2xl p-6 flex flex-col transform transition-transform duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
              <h3 className="font-bold text-gray-900 text-base">Change Password</h3>
              <button onClick={() => setChangePasswordDrawerOpen(false)} className="text-gray-400 hover:text-gray-600">
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
              {pwSaved && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">Password changed successfully!</p>}

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
