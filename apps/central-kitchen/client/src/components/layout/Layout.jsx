import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, ClipboardList, Receipt, Menu, X, LogOut, User,
  ChevronRight, BarChart3, Package, Truck, ArrowLeftRight, Settings
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

export default function Layout({ children, ckName = 'Central Kitchen Hub' }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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
    if (location.pathname === '/profile') return 'My Profile';
    return 'Dashboard';
  }, [location.pathname]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return 'Operator';
    return user.role
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }, [user]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-200
        lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800 shrink-0 bg-slate-950">
          <img src="/logo-2.png" alt="Cafinity" className="h-8 w-auto shrink-0 rounded-md" />
          <div className="min-w-0">
            <p className="text-white text-sm font-bold tracking-tight">Central Kitchen</p>
            <p className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider">{roleLabel}</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Store Title */}
        <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800">
          <p className="text-xs text-slate-400 font-medium truncate">Active Entity:</p>
          <p className="text-sm font-semibold text-slate-200 truncate">{ckName}</p>
        </div>

        {/* Nav */}
        <nav className="admin-sidebar-scroll flex-1 overflow-y-auto py-4 px-3 space-y-1 bg-slate-900">
          {CK_NAV_GROUPS.map((group) => (
            <details key={group.title} open className="group mb-1">
              <summary className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold cursor-pointer list-none flex items-center justify-between select-none">
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
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <item.icon size={17} className="shrink-0" />
                        {item.label}
                        {active && !hasSubItems && <ChevronRight size={14} className="ml-auto opacity-80" />}
                        {hasSubItems && <ChevronRight size={14} className={`ml-auto opacity-60 transition-transform ${active ? 'rotate-90' : ''}`} />}
                      </Link>

                      {/* Sub-items */}
                      {hasSubItems && active && (
                        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-slate-800 pl-2">
                          {item.subItems.map((subItem) => {
                            const subActive = location.pathname === subItem.to;
                            return (
                              <Link
                                key={subItem.to}
                                to={subItem.to}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  subActive
                                    ? 'bg-slate-800 text-teal-400 font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
        </nav>

        {/* Footer User Info */}
        <div className="border-t border-slate-800 p-3 space-y-0.5 bg-slate-950">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-teal-600">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.name || 'Operator'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LogOut size={17} className="shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-250 flex items-center px-4 sm:px-6 gap-4 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">
              {currentNavLabel}
            </h1>
          </div>
        </header>

        {/* View content container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
