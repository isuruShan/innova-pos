import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, UserCircle, Settings, Store, ChevronDown, Check } from 'lucide-react';
import ProfileSlideOver, { AvatarDisplay } from './ProfileSlideOver';
import { useStoreContext, normalizeStoreId } from '../context/StoreContext';
import { useBranding, LIGHT_THEME_ACCENT_HEX, LIGHT_THEME_SIDEBAR_HEX } from '../context/BrandingContext';
import { useTheme } from '../context/ThemeContext';
import { navActiveLinkTextColor, tintedRowTextColor } from '../utils/colorContrast';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import CashierSessionNavButton from './cashier/CashierSessionNavButton';
import OfflineBanner from './OfflineBanner';
import WaiterCallBar from './WaiterCallBar';
import QrOrderUpdateBar from './QrOrderUpdateBar';

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
          <div className="absolute right-0 top-11 w-60 bg-[var(--pos-panel)] border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/50 z-[200] overflow-hidden">
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

              {user.role === 'manager' && (
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
                  href={import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'}
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

function StoreSwitcher({ stores, selectedStoreId, selectStore }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const storeListActiveFg = useMemo(
    () =>
      tintedRowTextColor(
        '#f59e0b',
        theme === 'light' ? LIGHT_THEME_SIDEBAR_HEX : '#151f2e',
        0.15,
      ),
    [theme],
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
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 min-h-[42px] rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 hover:border-amber-500/35 text-left transition shadow-sm max-w-[220px] sm:max-w-[280px]"
        style={{ color: 'var(--color-text)' }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
          <Store size={18} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] uppercase tracking-wider opacity-50 font-semibold">Store</span>
          <span className="block text-sm font-semibold truncate leading-tight">{selected?.name || 'Select'}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-[120] w-[min(calc(100vw-1.5rem),18rem)] rounded-xl border border-slate-600/80 bg-[var(--pos-panel)] shadow-2xl shadow-black/40 overflow-hidden py-1"
          role="listbox"
        >
          <div className="px-3 py-2 border-b border-slate-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Switch location</p>
          </div>
          <ul className="max-h-[min(60vh,16rem)] overflow-y-auto py-1">
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
                        ? 'bg-amber-500/15 text-[var(--pos-selection-text)]'
                        : 'text-slate-200 hover:bg-slate-700/60 active:bg-slate-700'
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
      )}
    </div>
  );
}

function NavLogo({ branding }) {
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

function filterLinksForRole(links, role) {
  return links.filter((l) => {
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
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = filterLinksForRole(items, userRole);

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
                backgroundColor: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
                color: navTabActiveFg,
              }
            : { color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }
        }
      >
        <span className="max-w-[8rem] sm:max-w-none truncate">{title}</span>
        <ChevronDown size={14} className={`shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 min-w-[12rem] max-w-[min(calc(100vw-2rem),18rem)] rounded-xl border border-slate-600/80 bg-[var(--pos-panel)] shadow-2xl shadow-black/40 z-[120] py-1 overflow-hidden"
          role="menu"
        >
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
      )}
    </div>
  );
}

export default function Navbar({ links = [], groups: groupsProp }) {
  const { user, logout } = useAuth();
  const { stores, selectedStoreId, selectStore } = useStoreContext();
  const branding = useBranding();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const accentResolved =
    theme === 'light' ? LIGHT_THEME_ACCENT_HEX : branding.accentColor || '#e94560';
  const sidebarResolved =
    theme === 'light' ? LIGHT_THEME_SIDEBAR_HEX : branding.sidebarColor || '#16213e';

  const navTabActiveFg = useMemo(
    () => navActiveLinkTextColor(accentResolved, sidebarResolved, 0.22),
    [accentResolved, sidebarResolved],
  );

  const navGroups = useMemo(() => {
    if (groupsProp?.length) return groupsProp;
    if (links.length) return [{ title: 'Menu', items: links }];
    return [];
  }, [groupsProp, links]);

  return (
    <>
    <OfflineBanner />
    <WaiterCallBar />
    <QrOrderUpdateBar />
    <nav
      className="border-b px-4 py-2.5 flex items-center justify-between sticky top-0 z-50"
      style={{
        backgroundColor: 'var(--color-sidebar)',
        borderColor: 'color-mix(in srgb, var(--color-text) 14%, transparent)',
      }}
    >
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2 mr-3">
          <NavLogo branding={branding} />
          <span
            className="font-bold text-sm hidden sm:block tracking-wide"
            style={{ color: 'var(--color-text)' }}
          >
            {branding.businessName || 'POS'}
          </span>
        </div>

        {navGroups.length > 0 && (
          <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
            {navGroups.map((group) => {
              const filteredItems = filterLinksForRole(group.items, user?.role);
              if (!filteredItems.length) return null;

              if (filteredItems.length === 1) {
                const link = filteredItems[0];
                const active = linkMatchesPath(location.pathname, link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? '' : 'hover:bg-white/10'}`}
                    style={
                      active
                        ? {
                            backgroundColor: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
                            color: navTabActiveFg,
                          }
                        : { color: 'color-mix(in srgb, var(--color-text) 55%, transparent)' }
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
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        {user?.tenantId ? (
          <div className="flex items-center shrink-0 z-[60]">
            <NotificationBell />
          </div>
        ) : null}
        <CashierSessionNavButton />
        {user?.tenantId && stores.length > 0 && (
          <StoreSwitcher
            stores={stores}
            selectedStoreId={selectedStoreId}
            selectStore={selectStore}
          />
        )}
        {user && <AvatarMenu user={user} onLogout={() => { logout(); navigate('/login'); }} />}
      </div>
    </nav>
    </>
  );
}
