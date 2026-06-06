import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getAdminUrl } from '@innovapos/app-urls';
import { useAuth } from '../context/AuthContext';
import { LogOut, UserCircle, Settings, Store, ChevronDown, Check, Sun, Moon, Menu, X, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ProfileSlideOver, { AvatarDisplay } from './ProfileSlideOver';
import { useStoreContext, normalizeStoreId } from '../context/StoreContext';
import { useBranding } from '../context/BrandingContext';
import { navActiveLinkTextColor, tintedRowTextColor } from '../utils/colorContrast';
import NotificationBell from './NotificationBell';
import CashierSessionNavButton from './cashier/CashierSessionNavButton';
import OfflineBanner from './OfflineBanner';
import WaiterCallBar from './WaiterCallBar';
import QrOrderUpdateBar from './QrOrderUpdateBar';
import UberOrdersBar from './uber/UberOrdersBar';
import TrialBanners from './TrialBanners';
import useSwipeDismiss from '../hooks/useSwipeDismiss';
import { useTenantPaidAddons } from '../hooks/useTenantPaidAddons';


const ROLE_BADGE = {
  cashier: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  kitchen: 'bg-green-500/20 text-green-400 border-green-500/30',
  manager: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  merchant_admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function AvatarMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef(null);
  const { style, bind } = useSwipeDismiss({ onClose: () => setOpen(false), open });

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
          <>
            {/* Backdrop on mobile */}
            <div className="fixed inset-0 z-[199] md:hidden bg-transparent" onClick={() => setOpen(false)} />
            <div
              className="fixed inset-x-0 bottom-0 z-[200] w-full rounded-t-3xl border-t border-slate-700/60 bg-[var(--pos-panel)] shadow-2xl shadow-black/50 overflow-y-auto max-h-[80vh] py-4 animate-slide-up md:absolute md:inset-auto md:right-0 md:top-11 md:w-60 md:rounded-2xl md:border md:border-slate-700/60 md:shadow-2xl md:max-h-none md:overflow-hidden md:py-0 md:animate-slide-down"
              {...bind}
              style={style}
            >
              <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-3 md:hidden shrink-0" />
              {/* User info header */}
              <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-3">
                <AvatarDisplay user={user} size="md" />
                <div className="min-w-0">
                  <p className="text-[var(--pos-text-primary)] font-semibold text-sm truncate">{user.name}</p>
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/50 rounded-lg transition"
                >
                  <UserCircle size={15} className="text-slate-500" />
                  My Profile
                </button>

                {(user.role === 'manager' || user.role === 'merchant_admin') && (
                  <Link
                    to="/manager/settings"
                    onClick={() => setOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/50 rounded-lg transition"
                  >
                    <Settings size={15} className="text-slate-500" />
                    Settings
                  </Link>
                )}
                {user.role === 'merchant_admin' && (
                  <a
                    href={getAdminUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/50 rounded-lg transition"
                  >
                    <Settings size={15} className="text-slate-500" />
                    Admin Portal
                  </a>
                )}

                <div className="border-t border-slate-700/40 pt-1 mt-1">
                  <button
                    onClick={() => { setOpen(false); onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-200 hover:bg-red-600/25 rounded-lg transition"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <ProfileSlideOver open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function StoreSwitcher({ stores, selectedStoreId, selectStore }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { style, bind } = useSwipeDismiss({ onClose: () => setOpen(false), open });


  const storeListActiveFg = useMemo(
    () => tintedRowTextColor('#f59e0b', '#151f2e', 0.15),
    [],
  );

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected =
    stores.find((s) => normalizeStoreId(s._id) === normalizeStoreId(selectedStoreId)) || stores[0];
  if (!stores.length) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 sm:gap-2 pl-2 pr-1.5 py-1.5 sm:pl-3 sm:pr-2.5 sm:py-2 min-h-[34px] sm:min-h-[42px] rounded-lg sm:rounded-xl border text-left transition shadow-sm max-w-[110px] xs:max-w-[150px] sm:max-w-[280px] bg-[var(--pos-surface-inset)] border-[color-mix(in_srgb,var(--pos-text-primary)_22%,transparent)] hover:bg-[var(--pos-panel)] hover:border-[color-mix(in_srgb,var(--color-accent)_55%,transparent)]"
        style={{ color: 'var(--color-text)' }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-6 w-6 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded bg-amber-500/15 text-amber-400 border-none sm:border sm:border-amber-500/25 sm:rounded-lg">
          <Store size={14} className="sm:hidden" strokeWidth={2} />
          <Store size={18} className="hidden sm:block" strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="hidden sm:block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Store</span>
          <span className="block text-xs sm:text-sm font-semibold truncate leading-tight">{selected?.name || 'Select'}</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 opacity-60 transition-transform sm:hidden ${open ? 'rotate-180' : ''}`} />
        <ChevronDown size={18} className={`shrink-0 opacity-60 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop on mobile */}
          <div className="fixed inset-0 z-[119] md:hidden bg-transparent" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[120] w-full rounded-t-3xl border-t border-slate-700/60 bg-[var(--pos-panel)] shadow-2xl shadow-black/40 overflow-y-auto max-h-[80vh] py-4 animate-slide-up md:absolute md:inset-auto md:right-0 md:top-full md:mt-1.5 md:w-[18rem] md:rounded-xl md:border md:border-slate-600/80 md:py-1 md:shadow-2xl md:max-h-none md:overflow-hidden md:animate-slide-down"
            role="listbox"
            {...bind}
            style={style}
          >
            <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-3 md:hidden shrink-0" />
            <div className="px-3 py-2 border-b border-slate-700/60">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Switch location</p>
            </div>
            <ul className="max-h-[50vh] md:max-h-[16rem] overflow-y-auto py-1">
              {stores.map((store) => {
                const active = normalizeStoreId(store._id) === normalizeStoreId(selectedStoreId);
                return (
                  <li key={store._id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        selectStore(store._id);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 text-left text-sm transition min-h-[48px] ${
                        active
                          ? 'bg-[color-mix(in_srgb,var(--color-selection)_22%,transparent)] text-[var(--pos-text-primary)]'
                          : 'text-[var(--pos-text-primary)] hover:bg-[color-mix(in_srgb,var(--pos-text-primary)_8%,transparent)]'
                      }`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-600/50">
                        <Store size={18} className={active ? 'text-amber-400' : 'text-slate-400'} />
                      </span>
                      <span className="flex-1 min-w-0 font-medium truncate">{store.name}</span>
                      {active && (
                        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export function NavLogo({ branding }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [branding.logoUrl]);
  const initial = (branding.businessName || 'P').slice(0, 1).toUpperCase();
  if (branding.logoUrl && !failed) {
    return (
      <img
        src={branding.logoUrl}
        alt=""
        className="w-8 h-8 rounded-lg object-contain bg-white/5"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
      style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 35%, transparent)', color: 'var(--color-text)' }}
    >
      {initial}
    </div>
  );
}

function filterLinksForRole(links, role, paidAddons = {}) {
  return links.filter((l) => {
    if (l.addon) {
      const active = paidAddons[l.addon] === true || paidAddons[l.addon]?.active === true;
      if (!active) return false;
    }
    if (!l.roles?.length) return true;
    return l.roles.includes(role);
  });
}

function linkMatchesPath(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavDropdown({
  title,
  items,
  userRole,
  location,
  navTabActiveFg,
  paidAddons,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { style, bind } = useSwipeDismiss({ onClose: () => setOpen(false), open });
  const filtered = filterLinksForRole(items, userRole, paidAddons);


  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!filtered.length) return null;

  const active = filtered.some((l) => linkMatchesPath(location.pathname, l.to));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition ${
          active ? '' : 'hover:bg-white/10'
        }`}
        style={
          active
            ? {
                backgroundColor: 'color-mix(in srgb, var(--color-selection) 72%, transparent)',
                color: navTabActiveFg,
              }
            : { color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }
        }
      >
        <span className="max-w-[8rem] sm:max-w-none truncate">{title}</span>
        <ChevronDown size={14} className={`shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop on mobile */}
          <div className="fixed inset-0 z-[119] md:hidden bg-transparent" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[120] w-full rounded-t-3xl border-t border-slate-700/60 bg-[var(--pos-panel)] shadow-2xl shadow-black/40 overflow-y-auto max-h-[80vh] py-4 animate-slide-up md:absolute md:inset-auto md:left-0 md:top-full md:mt-1.5 md:min-w-[12rem] md:max-w-[18rem] md:rounded-xl md:border md:border-slate-600/80 md:shadow-2xl md:max-h-none md:overflow-hidden md:py-1 md:animate-slide-down"
            role="menu"
            {...bind}
            style={style}
          >
            <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-3 md:hidden shrink-0" />
            {filtered.map((link) => {
              const itemActive = linkMatchesPath(location.pathname, link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition ${
                    itemActive
                      ? 'bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] text-[var(--pos-text-primary)]'
                      : 'text-slate-300 hover:bg-slate-700/60 hover:text-[var(--pos-text-primary)]'
                  }`}
                >
                  {link.icon && <link.icon size={15} className="shrink-0 opacity-80" />}
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar({ links = [], groups: groupsProp }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { stores, selectedStoreId, selectStore } = useStoreContext();
  const branding = useBranding();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const accentResolved = branding.accentColor || '#e94560';
  const sidebarResolved = branding.sidebarColor || '#16213e';

  const navTabActiveFg = useMemo(
    () => navActiveLinkTextColor(accentResolved, sidebarResolved, 0.55),
    [accentResolved, sidebarResolved],
  );

  const { data: paidAddons } = useTenantPaidAddons();
  const activePaidAddons = paidAddons || {};

  const selectedStore = useMemo(() => {
    return stores.find((s) => String(s._id) === String(selectedStoreId));
  }, [stores, selectedStoreId]);
  const tableMgmtEnabled = selectedStore?.tableManagementEnabled === true;

  const navGroups = useMemo(() => {
    let baseGroups = [];
    if (groupsProp?.length) {
      baseGroups = groupsProp;
    } else if (links.length) {
      baseGroups = [{ title: 'Menu', items: links }];
    }
    
    const isManagerOrAdmin = ['manager', 'merchant_admin'].includes(user?.role);

    return baseGroups
      .map(group => {
        // Filter out groups where group.addon is unsubscribed
        if (group.addon) {
          const active = activePaidAddons[group.addon] === true || activePaidAddons[group.addon]?.active === true;
          if (!active) return null;
        }
        


        const filteredItems = group.items.filter(item => {
          // Filter out items where item.addon is unsubscribed
          if (item.addon) {
            const active = activePaidAddons[item.addon] === true || activePaidAddons[item.addon]?.active === true;
            if (!active) return false;
          }

          return true;
        });

        if (!filteredItems.length) return null;

        return {
          ...group,
          items: filteredItems,
        };
      })
      .filter(Boolean);
  }, [groupsProp, links, activePaidAddons, tableMgmtEnabled, user?.role]);

  return (
    <>
    <OfflineBanner />
    <WaiterCallBar />
    <QrOrderUpdateBar />
    <UberOrdersBar />
    <nav
      className="border-b px-4 py-2.5 flex items-center justify-between sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--color-sidebar)',
        borderColor: 'color-mix(in srgb, var(--color-header-text, var(--color-text)) 14%, transparent)',
      }}
    >
      <div className="flex items-center gap-1">
        {/* Hamburger Menu Button for Mobile */}
        {navGroups.length > 0 && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="flex lg:hidden items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-[var(--pos-text-primary)] transition"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}

        <div className="hidden lg:flex items-center gap-2 mr-3">
          <NavLogo branding={branding} />
          <span
            className="font-bold text-sm tracking-wide"
            style={{ color: 'var(--color-header-text, var(--color-text))' }}
          >
            {branding.businessName || 'POS'}
          </span>
        </div>

        {navGroups.length > 0 && (
          <div className="hidden lg:flex items-center gap-0.5 sm:gap-1 flex-wrap">
            {navGroups.map((group) => {
              const filteredItems = filterLinksForRole(group.items, user?.role, activePaidAddons);
              if (!filteredItems.length) return null;

              if (filteredItems.length === 1) {
                const link = filteredItems[0];
                const active = linkMatchesPath(location.pathname, link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition"
                    style={
                      active
                        ? {
                            backgroundColor: 'color-mix(in srgb, var(--color-selection) 72%, transparent)',
                            color: navTabActiveFg,
                          }
                        : {
                            color: 'color-mix(in srgb, var(--color-header-text, var(--color-text)) 55%, transparent)',
                          }
                    }
                  >
                    {link.icon && <link.icon size={14} className="shrink-0" />}
                    <span className="hidden sm:inline truncate max-w-[7rem] md:max-w-none">{link.label}</span>
                  </Link>
                );
              }

              return (
                <NavDropdown
                  key={group.title}
                  title={group.title}
                  items={group.items}
                  userRole={user?.role}
                  location={location}
                  navTabActiveFg={navTabActiveFg}
                  paidAddons={activePaidAddons}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {user?.tenantId ? (
          <div className="flex items-center shrink-0 z-[60] gap-2 sm:gap-3">
            <NotificationBell />
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-700/40 bg-slate-800/30 text-[var(--color-header-text,var(--color-text))] hover:bg-slate-800/55 hover:border-amber-500/35 transition flex items-center justify-center shrink-0"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        ) : null}
        <div className="hidden md:block">
          <CashierSessionNavButton />
        </div>
        {user?.tenantId && stores.length > 0 && (
          <StoreSwitcher
            stores={stores}
            selectedStoreId={selectedStoreId}
            selectStore={selectStore}
          />
        )}
        {user && <AvatarMenu user={user} onLogout={() => { logout(); navigate('/login'); }} />}
      </div>

      {/* Mobile Navigation Dropdown Overlay */}
      {mobileMenuOpen && navGroups.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full bg-[var(--pos-panel)] border-b border-slate-700/60 shadow-2xl z-40 overflow-y-auto max-h-[calc(100vh-64px)] block lg:hidden"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-header-text, var(--color-text)) 14%, transparent)',
          }}
        >
          <div className="p-4 space-y-4">
            {/* Mobile Header with Logo & Business Name inside Hamburger Menu */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-700/40">
              <NavLogo branding={branding} />
              <span
                className="font-bold text-sm tracking-wide"
                style={{ color: 'var(--pos-text-primary)' }}
              >
                {branding.businessName || 'POS'}
              </span>
            </div>

            {navGroups.map((group) => {
              const filteredItems = filterLinksForRole(group.items, user?.role, activePaidAddons);
              if (!filteredItems.length) return null;

              return (
                <div key={group.title} className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500/80 px-2">
                    {group.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredItems.map((link) => {
                      const active = linkMatchesPath(location.pathname, link.to);
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition"
                          style={
                            active
                              ? {
                                  backgroundColor: 'color-mix(in srgb, var(--color-selection) 72%, transparent)',
                                  color: navTabActiveFg,
                                }
                              : {
                                  color: 'color-mix(in srgb, var(--pos-text-primary) 85%, transparent)',
                                }
                          }
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {link.icon && (
                              <link.icon
                                size={16}
                                className={`shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`}
                              />
                            )}
                            <span className="truncate">{link.label}</span>
                          </div>
                          <ChevronRight
                            size={14}
                            className={`shrink-0 ${active ? 'opacity-100' : 'opacity-40'}`}
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </nav>
    <TrialBanners />
    </>
  );
}
