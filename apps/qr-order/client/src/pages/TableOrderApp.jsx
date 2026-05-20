import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Loader2,
  BellRing,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Trash2,
} from 'lucide-react';

function apiBase() {
  return (import.meta.env.VITE_QR_ORDER_API_URL || '').replace(/\/$/, '');
}

const MENU_PAGE = 60;

function sessionPath(tenantId, storeId, tableId, query = {}) {
  const base = apiBase();
  const path = `/api/public/table/${encodeURIComponent(tenantId)}/${encodeURIComponent(storeId)}/${encodeURIComponent(tableId)}`;
  const qs = new URLSearchParams();
  if (query.menuSkip != null) qs.set('menuSkip', String(query.menuSkip));
  if (query.menuLimit != null) qs.set('menuLimit', String(query.menuLimit));
  const q = qs.toString();
  const full = q ? `${path}?${q}` : path;
  return base ? `${base}${full}` : full;
}

function itemPhotoUrls(item) {
  const g = (item.images || []).map((x) => String(x.url || '').trim()).filter(Boolean);
  if (g.length) return g;
  if (item.image) return [String(item.image).trim()];
  return [];
}

function formatWaiterCooldown(totalSeconds) {
  if (totalSeconds >= 60) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return `${totalSeconds}s`;
}

const STATUS_LABEL = {
  pending: 'Received',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function ItemDetailModal({ item, currencySymbol, onClose, onAdd }) {
  const urls = item ? itemPhotoUrls(item) : [];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [item?._id]);

  if (!item) return null;

  const desc = String(item.description || '').trim();
  const canAdd = !!item.available;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl bg-white shadow-xl flex flex-col min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <h2 id="item-detail-title" className="text-lg font-bold text-slate-900 pr-2 leading-tight">
            {item.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {urls.length > 0 ? (
            <div className="relative bg-slate-100 aspect-[4/3] max-h-[45vh] shrink-0">
              <img src={urls[idx]} alt="" className="w-full h-full object-contain" />
              {urls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white disabled:opacity-30"
                    disabled={idx === urls.length - 1}
                    onClick={() => setIdx((i) => Math.min(urls.length - 1, i + 1))}
                    aria-label="Next photo"
                  >
                    <ChevronRight size={22} />
                  </button>
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {urls.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Photo ${i + 1}`}
                        onClick={() => setIdx(i)}
                        className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center text-5xl">🍽️</div>
          )}

          <div className="px-4 py-4 space-y-3">
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--qr-accent, #f59e0b)' }}>
              {currencySymbol}
              {Number(item.price || 0).toFixed(2)}
            </p>
            {item.category && <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{item.category}</p>}
            {desc ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{desc}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No description for this item.</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => {
              onAdd(item);
              onClose();
            }}
            className="w-full py-3.5 rounded-xl font-bold text-base disabled:opacity-45 disabled:cursor-not-allowed shadow-lg"
            style={{
              backgroundColor: 'var(--qr-accent, #f59e0b)',
              color: 'var(--qr-on-accent, #ffffff)',
            }}
          >
            {canAdd ? 'Add to order' : 'Currently unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TableOrderApp() {
  const { tenantId, storeId, tableId } = useParams();
  const [tab, setTab] = useState('menu');
  const [cart, setCart] = useState([]);
  const [activeCat, setActiveCat] = useState('All');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterBlockedUntil, setWaiterBlockedUntil] = useState(null);
  const [waiterTick, setWaiterTick] = useState(0);
  const [detailItem, setDetailItem] = useState(null);
  const [menuLoadingMore, setMenuLoadingMore] = useState(false);
  const menuLenRef = useRef(0);

  const branding = payload?.branding;
  const currencySymbol = branding?.currencySymbol || '$';

  useEffect(() => {
    const fav = branding?.faviconUrl || branding?.logoUrl;
    if (!fav) return;
    let link = document.querySelector("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = fav;
  }, [branding?.faviconUrl, branding?.logoUrl]);

  useEffect(() => {
    const id = setInterval(() => setWaiterTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const iso = payload?.nextWaiterCallAt;
    if (!iso) return;
    const t = new Date(iso).getTime();
    if (t > Date.now()) setWaiterBlockedUntil(t);
    else setWaiterBlockedUntil(null);
  }, [payload?.nextWaiterCallAt]);

  const waiterSecondsLeft = useMemo(() => {
    void waiterTick;
    if (!waiterBlockedUntil) return 0;
    return Math.max(0, Math.ceil((waiterBlockedUntil - Date.now()) / 1000));
  }, [waiterBlockedUntil, waiterTick]);

  useEffect(() => {
    if (waiterBlockedUntil && waiterSecondsLeft === 0) setWaiterBlockedUntil(null);
  }, [waiterBlockedUntil, waiterSecondsLeft]);

  const rootStyle = useMemo(() => {
    if (!branding) {
      return {
        '--qr-primary': '#151f2e',
        '--qr-accent': '#f59e0b',
        '--qr-text': '#f8fafc',
        '--qr-on-accent': '#ffffff',
        '--qr-page-bg': '#0b1220',
        '--qr-panel': '#151f2e',
        '--qr-body': '#e2e8f0',
        '--qr-muted': '#94a3b8',
      };
    }
    return {
      '--qr-primary': branding.primaryColor || '#151f2e',
      '--qr-accent': branding.accentColor || '#f59e0b',
      '--qr-text': branding.textColor || '#f8fafc',
      '--qr-on-accent': branding.selectionTextColor || '#ffffff',
      '--qr-page-bg': '#0b1220',
      '--qr-panel': '#151f2e',
      '--qr-body': '#e2e8f0',
      '--qr-muted': '#94a3b8',
    };
  }, [branding]);

  const fetchSession = useCallback(
    async (appendMenu = false) => {
      if (!tenantId || !storeId || !tableId) return;
      try {
        const menuSkip = appendMenu ? menuLenRef.current : 0;
        const { data } = await axios.get(
          sessionPath(tenantId, storeId, tableId, { menuSkip, menuLimit: MENU_PAGE }),
        );
        if (appendMenu) {
          setPayload((prev) => ({
            ...data,
            menuItems: [...(prev?.menuItems || []), ...(data.menuItems || [])],
          }));
        } else {
          setPayload(data);
        }
        const chunkLen = (data.menuItems || []).length;
        menuLenRef.current = appendMenu ? menuLenRef.current + chunkLen : chunkLen;
        setLoadError(null);
      } catch (e) {
        setLoadError(e);
        if (!appendMenu) setPayload(null);
      } finally {
        setLoading(false);
        setMenuLoadingMore(false);
      }
    },
    [tenantId, storeId, tableId],
  );

  useEffect(() => {
    fetchSession(false);
  }, [fetchSession]);

  useEffect(() => {
    if (!tenantId || !storeId || !tableId) return undefined;
    const id = setInterval(() => fetchSession(false), 12_000);
    return () => clearInterval(id);
  }, [tenantId, storeId, tableId, fetchSession]);

  const menuItems = payload?.menuItems || [];
  const menuTotal = payload?.menuTotal != null ? Number(payload.menuTotal) : menuItems.length;
  const categories = useMemo(() => {
    const c = [...new Set(menuItems.map((m) => m.category).filter(Boolean))].sort();
    return ['All', ...c];
  }, [menuItems]);

  const filteredMenu = useMemo(() => {
    if (activeCat === 'All') return menuItems;
    return menuItems.filter((m) => m.category === activeCat);
  }, [menuItems, activeCat]);

  const order = payload?.order;

  const fmtMoney = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return `${currencySymbol}${x.toFixed(2)}`;
  };

  const showToast = (text, ms = 2200) => {
    setMsg(text);
    const t = setTimeout(() => setMsg(''), ms);
    return () => clearTimeout(t);
  };

  const addOne = (item) => {
    setCart((prev) => {
      const id = String(item._id);
      const found = prev.find((x) => x.menuItem === id);
      if (found) {
        return prev.map((x) => (x.menuItem === id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { menuItem: id, name: item.name, price: item.price, qty: 1 }];
    });
    showToast(`Added ${item.name} to cart`);
  };

  const changeQty = (menuItemId, delta) => {
    setCart((prev) =>
      prev
        .map((x) => (x.menuItem === menuItemId ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0),
    );
  };

  const removeLine = (menuItemId) => {
    setCart((prev) => prev.filter((x) => x.menuItem !== menuItemId));
  };

  const cartTotal = cart.reduce((s, i) => s + Number(i.price || 0) * i.qty, 0);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const onCallWaiter = async () => {
    if (!tenantId || !storeId || !tableId) return;
    setMsg('');
    setCallingWaiter(true);
    try {
      await axios.post(`${sessionPath(tenantId, storeId, tableId)}/call-waiter`, {});
      setMsg('A team member has been notified. Someone will come to your table shortly.');
      setTimeout(() => setMsg(''), 5000);
      const coolSec = payload?.guestWaiterCallCooldownSeconds || 300;
      setWaiterBlockedUntil(Date.now() + coolSec * 1000);
      fetchSession(false);
    } catch (e) {
      const code = e.response?.status;
      if (code === 429) {
        const retry = e.response?.data?.retryAt;
        if (retry) setWaiterBlockedUntil(new Date(retry).getTime());
      }
      setMsg(
        code === 429
          ? e.response?.data?.message || 'Please wait a moment before calling again.'
          : e.response?.data?.message || 'Could not send request',
      );
    } finally {
      setCallingWaiter(false);
    }
  };

  const onConfirm = async () => {
    if (!cart.length || !tenantId || !storeId || !tableId) return;
    setMsg('');
    setSubmitting(true);
    try {
      await axios.post(`${sessionPath(tenantId, storeId, tableId)}/items`, {
        items: cart.map((c) => ({ menuItem: c.menuItem, qty: c.qty })),
      });
      setCart([]);
      setMsg('Sent to the kitchen. Thank you!');
      fetchSession(false);
      setTab('order');
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsg(e.response?.data?.message || 'Could not send order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tenantId || !storeId || !tableId) {
    return <p className="text-center text-gray-500 py-16 px-4">Invalid link.</p>;
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500 px-4">
        <Loader2 className="animate-spin w-10 h-10" />
        <p>Loading your table…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-600 font-medium">
          {loadError.response?.data?.message || 'Unable to load this table.'}
        </p>
      </div>
    );
  }

  const displayName = branding?.businessName || payload.storeName;

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden"
      style={{
        ...rootStyle,
        backgroundColor: 'var(--qr-page-bg, #0b1220)',
        color: 'var(--qr-body, #e2e8f0)',
      }}
    >
      <header
        className="shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shadow-md z-20"
        style={{ backgroundColor: 'var(--qr-primary)', color: 'var(--qr-text)' }}
      >
        <div className="flex items-start gap-3 max-w-lg mx-auto">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover border border-white/20 shrink-0" />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold leading-tight truncate">{displayName}</h1>
            <p className="text-sm opacity-90 mt-0.5">
              {payload.storeName !== displayName && <span className="opacity-75">{payload.storeName} · </span>}
              Table <span className="font-semibold">{payload.tableLabel}</span>
            </p>
            {branding?.tagline ? <p className="text-xs opacity-80 mt-1 line-clamp-2">{branding.tagline}</p> : null}
          </div>
        </div>
      </header>

      {msg && (
        <div className="shrink-0 mx-3 mt-3 rounded-xl border border-teal-700/50 bg-teal-950/40 text-teal-100 text-sm px-4 py-3">
          {msg}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {tab === 'order' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-4 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-4 max-w-lg mx-auto w-full">
            {order ? (
              <section className="rounded-2xl bg-[var(--qr-panel)] border border-slate-600/60 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Your order</p>
                    <p className="font-mono font-bold text-slate-100">#{String(order.orderNumber).padStart(3, '0')}</p>
                  </div>
                  <span className="text-sm font-semibold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-slate-600/50 text-sm">
                  {(order.items || []).map((line, idx) => (
                    <li key={idx} className="py-2 flex justify-between gap-2">
                      <span className="text-slate-200">
                        {line.name} × {line.qty}
                      </span>
                      <span className="text-slate-400 tabular-nums">{fmtMoney(line.price * line.qty)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t border-slate-600/50 flex justify-between font-semibold text-slate-100">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtMoney(order.totalAmount)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Pay with staff when you finish. You can add more from the <strong>Menu</strong> tab; you cannot reduce
                  confirmed quantities here.
                </p>
              </section>
            ) : (
              <section className="rounded-2xl bg-[var(--qr-panel)] border border-slate-600/60 p-6 text-center text-slate-400 text-sm">
                No open order yet. Use <strong>Menu</strong> to choose items and send them to the kitchen.
              </section>
            )}
          </div>
        )}

        {tab === 'menu' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3 pt-3 pb-2 bg-[var(--qr-panel)] border-b border-slate-700/80">
              <div className="flex gap-2 overflow-x-auto pb-1 touch-pan-x max-w-lg mx-auto w-full">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveCat(c)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border shrink-0 transition ${
                      activeCat === c
                        ? 'text-white shadow-md border-transparent'
                        : 'bg-slate-800/80 text-slate-300 border-slate-600'
                    }`}
                    style={
                      activeCat === c
                        ? { backgroundColor: 'var(--qr-accent, #f59e0b)', color: 'var(--qr-on-accent, #fff)' }
                        : {}
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-3">
              <div className="max-w-lg mx-auto w-full space-y-3 pb-[calc(8rem+env(safe-area-inset-bottom))]">
                {filteredMenu.map((item) => {
                  const photos = itemPhotoUrls(item);
                  const thumb = photos[0];
                  return (
                    <div
                      key={item._id}
                      className={`rounded-2xl border shadow-sm overflow-hidden flex gap-0 ${
                        item.available ? 'bg-[var(--qr-panel)] border-slate-600/60' : 'opacity-55 border-slate-700 bg-slate-900/50'
                      }`}
                    >
                      <div className="w-28 sm:w-32 shrink-0 bg-slate-800 self-stretch min-h-[7rem]">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full min-h-[7rem] object-cover" loading="lazy" />
                        ) : (
                        <div className="w-full h-full min-h-[7rem] flex items-center justify-center text-3xl bg-slate-800">
                          🍽️
                        </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 p-3 flex flex-col">
                        <p className="font-semibold text-slate-100 leading-snug">{item.name}</p>
                        {item.category && <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>}
                        <p className="text-base font-bold tabular-nums mt-1" style={{ color: 'var(--qr-accent, #f59e0b)' }}>
                          {fmtMoney(item.price)}
                        </p>
                        {photos.length > 1 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{photos.length} photos</p>
                        )}
                        <div className="mt-auto pt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 text-xs font-semibold bg-slate-800/80 hover:bg-slate-700"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            type="button"
                            disabled={!item.available}
                            onClick={() => addOne(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                            style={{ backgroundColor: 'var(--qr-accent, #f59e0b)' }}
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredMenu.length > 0 && menuItems.length < menuTotal && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      disabled={menuLoadingMore}
                      onClick={() => {
                        setMenuLoadingMore(true);
                        fetchSession(true);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-600 text-sm font-semibold text-slate-200 bg-slate-800/80 shadow-sm disabled:opacity-50"
                    >
                      {menuLoadingMore ? 'Loading…' : 'Load more items'}
                    </button>
                  </div>
                )}
                {filteredMenu.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-16">No items in this category.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'cart' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden max-w-lg mx-auto w-full">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4">
              {cart.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-16">Your cart is empty. Add items from the Menu tab.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your selection</p>
                  {cart.map((c) => (
                    <div
                      key={c.menuItem}
                      className="flex items-center justify-between gap-2 text-sm bg-[var(--qr-panel)] border border-slate-600/60 rounded-xl px-3 py-2"
                    >
                      <span className="text-slate-200 truncate min-w-0 flex-1">{c.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg border border-slate-600 text-slate-200"
                          onClick={() => changeQty(c.menuItem, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-semibold text-slate-100">{c.qty}</span>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg border border-slate-600 text-slate-200"
                          onClick={() => changeQty(c.menuItem, 1)}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          type="button"
                          title="Remove from cart"
                          className="p-1.5 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10"
                          onClick={() => removeLine(c.menuItem)}
                          aria-label="Remove line"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="shrink-0 border-t border-slate-700/80 bg-[var(--qr-panel)] px-4 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] space-y-3 z-20 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between pt-1 border-t border-slate-600/50">
                  <span className="font-semibold text-slate-100">Subtotal</span>
                  <span className="font-bold tabular-nums" style={{ color: 'var(--qr-accent, #f59e0b)' }}>
                    {fmtMoney(cartTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onConfirm}
                  className="w-full py-3.5 rounded-xl disabled:opacity-60 font-bold text-base shadow-lg flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--qr-accent, #f59e0b)',
                    color: 'var(--qr-on-accent, #ffffff)',
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" /> Sending…
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> Confirm & send to kitchen
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {tab !== 'cart' && (
        <button
          type="button"
          className="fixed z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed right-3 max-w-[min(100vw-1.5rem,20rem)]"
          style={{
            bottom: 'calc(4.25rem + env(safe-area-inset-bottom, 0px))',
            backgroundColor: 'var(--qr-accent, #f59e0b)',
          }}
          disabled={callingWaiter || waiterSecondsLeft > 0}
          onClick={onCallWaiter}
          aria-label="Call waiter"
        >
          {callingWaiter ? (
            <>
              <Loader2 className="animate-spin w-4 h-4" /> Sending…
            </>
          ) : waiterSecondsLeft > 0 ? (
            <>
              <BellRing size={16} /> Wait {formatWaiterCooldown(waiterSecondsLeft)}
            </>
          ) : (
            <>
              <BellRing size={16} /> Call waiter
            </>
          )}
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-700 bg-[#151f2e] pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.35)]">
        <button
          type="button"
          onClick={() => setTab('menu')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ${
            tab === 'menu' ? 'text-[var(--qr-accent,#f59e0b)]' : 'text-slate-400'
          }`}
        >
          <ShoppingBag size={20} />
          Menu
        </button>
        <button
          type="button"
          onClick={() => setTab('cart')}
          className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ${
            tab === 'cart' ? 'text-[var(--qr-accent,#f59e0b)]' : 'text-slate-400'
          }`}
        >
          <span className="relative inline-flex">
            <ShoppingCart size={20} />
            {cartCount > 0 ? (
              <span className="absolute -top-1.5 -right-2 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </span>
          Cart
        </button>
        <button
          type="button"
          onClick={() => setTab('order')}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold ${
            tab === 'order' ? 'text-[var(--qr-accent,#f59e0b)]' : 'text-slate-400'
          }`}
        >
          <ClipboardList size={20} />
          Order
        </button>
      </nav>

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          currencySymbol={currencySymbol}
          onClose={() => setDetailItem(null)}
          onAdd={addOne}
        />
      )}
    </div>
  );
}
