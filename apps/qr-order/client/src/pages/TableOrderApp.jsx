import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ShoppingBag,
  Plus,
  Minus,
  Loader2,
  BellRing,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
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
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--qr-accent, #0d9488)' }}>
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
              backgroundColor: 'var(--qr-accent, #0d9488)',
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
  const [tab, setTab] = useState('new');
  const [cart, setCart] = useState([]);
  const [activeCat, setActiveCat] = useState('All');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [menuLoadingMore, setMenuLoadingMore] = useState(false);
  const menuLenRef = useRef(0);

  const branding = payload?.branding;
  const currencySymbol = branding?.currencySymbol || '$';

  const rootStyle = useMemo(() => {
    if (!branding) {
      return {
        '--qr-primary': '#0f172a',
        '--qr-accent': '#0d9488',
        '--qr-text': '#ffffff',
        '--qr-on-accent': '#ffffff',
      };
    }
    return {
      '--qr-primary': branding.primaryColor || '#0f172a',
      '--qr-accent': branding.accentColor || '#0d9488',
      '--qr-text': branding.textColor || '#ffffff',
      '--qr-on-accent': branding.selectionTextColor || '#ffffff',
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

  const addOne = (item) => {
    setCart((prev) => {
      const id = String(item._id);
      const found = prev.find((x) => x.menuItem === id);
      if (found) {
        return prev.map((x) => (x.menuItem === id ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { menuItem: id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const changeQty = (menuItemId, delta) => {
    if (delta < 0 && order) return;
    setCart((prev) =>
      prev
        .map((x) => (x.menuItem === menuItemId ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0),
    );
  };

  const cartTotal = cart.reduce((s, i) => s + Number(i.price || 0) * i.qty, 0);

  const onCallWaiter = async () => {
    if (!tenantId || !storeId || !tableId) return;
    setMsg('');
    setCallingWaiter(true);
    try {
      await axios.post(`${sessionPath(tenantId, storeId, tableId)}/call-waiter`, {});
      setMsg('A team member has been notified. Someone will come to your table shortly.');
      setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      const code = e.response?.status;
      setMsg(
        code === 429
          ? (e.response?.data?.message || 'Please wait a moment before calling again.')
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
      className="h-[100dvh] flex flex-col bg-slate-50 text-slate-900 overflow-hidden"
      style={rootStyle}
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

      <nav className="shrink-0 flex border-b border-slate-200 bg-white z-10">
        <button
          type="button"
          onClick={() => setTab('new')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition border-b-2 ${
            tab === 'new' ? 'border-current' : 'border-transparent text-slate-500'
          }`}
          style={tab === 'new' ? { color: 'var(--qr-accent, #0d9488)', borderBottomColor: 'var(--qr-accent, #0d9488)' } : {}}
        >
          <ShoppingBag size={18} />
          New order
        </button>
        <button
          type="button"
          onClick={() => setTab('order')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition border-b-2 ${
            tab === 'order' ? 'border-current' : 'border-transparent text-slate-500'
          }`}
          style={tab === 'order' ? { color: 'var(--qr-accent, #0d9488)', borderBottomColor: 'var(--qr-accent, #0d9488)' } : {}}
        >
          <ClipboardList size={18} />
          Your table
        </button>
      </nav>

      {msg && (
        <div className="shrink-0 mx-3 mt-3 rounded-xl border border-teal-200 bg-teal-50 text-teal-950 text-sm px-4 py-3">
          {msg}
        </div>
      )}

      {tab === 'order' && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4 max-w-lg mx-auto w-full">
          {order ? (
            <section className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Your order</p>
                  <p className="font-mono font-bold text-slate-900">#{String(order.orderNumber).padStart(3, '0')}</p>
                </div>
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-100">
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {(order.items || []).map((line, idx) => (
                  <li key={idx} className="py-2 flex justify-between gap-2">
                    <span className="text-slate-800">
                      {line.name} × {line.qty}
                    </span>
                    <span className="text-slate-500 tabular-nums">{fmtMoney(line.price * line.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between font-semibold text-slate-900">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(order.totalAmount)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Pay with staff when you finish. You can add more from the <strong>New order</strong> tab; you cannot
                reduce confirmed quantities here.
              </p>
            </section>
          ) : (
            <section className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-slate-600 text-sm">
              No open order yet. Use <strong>New order</strong> to choose items and send them to the kitchen.
            </section>
          )}

          <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <BellRing size={18} className="text-amber-600 shrink-0" />
                  Need help at the table?
                </p>
                <p className="text-xs text-slate-600 mt-1">Notify staff — they will see your table number.</p>
              </div>
              <button
                type="button"
                disabled={callingWaiter}
                onClick={onCallWaiter}
                className="shrink-0 px-4 py-2.5 rounded-xl disabled:opacity-60 text-white text-sm font-bold shadow flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--qr-accent, #d97706)' }}
              >
                {callingWaiter ? (
                  <>
                    <Loader2 className="animate-spin w-4 h-4" /> Sending…
                  </>
                ) : (
                  <>
                    <BellRing size={16} /> Call waiter
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === 'new' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-3 pt-3 pb-2 bg-slate-50 border-b border-slate-200/80">
            <div className="flex gap-2 overflow-x-auto pb-1 touch-pan-x max-w-lg mx-auto w-full">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCat(c)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border shrink-0 transition ${
                    activeCat === c
                      ? 'text-white shadow-md border-transparent'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                  style={
                    activeCat === c
                      ? { backgroundColor: 'var(--qr-accent, #0d9488)', color: 'var(--qr-on-accent, #fff)' }
                      : {}
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-3 pb-2">
            <div className="max-w-lg mx-auto w-full space-y-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              {filteredMenu.map((item) => {
                const photos = itemPhotoUrls(item);
                const thumb = photos[0];
                return (
                  <div
                    key={item._id}
                    className={`rounded-2xl border bg-white shadow-sm overflow-hidden flex gap-0 ${
                      item.available ? 'border-slate-200' : 'opacity-55 border-slate-100'
                    }`}
                  >
                    <div className="w-28 sm:w-32 shrink-0 bg-slate-100 self-stretch min-h-[7rem]">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-full h-full min-h-[7rem] object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full min-h-[7rem] flex items-center justify-center text-3xl bg-slate-100">
                          🍽️
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 p-3 flex flex-col">
                      <p className="font-semibold text-slate-900 leading-snug">{item.name}</p>
                      {item.category && <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>}
                      <p className="text-base font-bold tabular-nums mt-1" style={{ color: 'var(--qr-accent, #0d9488)' }}>
                        {fmtMoney(item.price)}
                      </p>
                      {photos.length > 1 && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{photos.length} photos</p>
                      )}
                      <div className="mt-auto pt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold bg-slate-50 hover:bg-slate-100"
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          type="button"
                          disabled={!item.available}
                          onClick={() => addOne(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                          style={{ backgroundColor: 'var(--qr-accent, #0d9488)' }}
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
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 bg-white shadow-sm disabled:opacity-50"
                  >
                    {menuLoadingMore ? 'Loading…' : 'Load more items'}
                  </button>
                </div>
              )}
              {filteredMenu.length === 0 && (
                <p className="text-center text-slate-500 py-12 text-sm">No items in this category.</p>
              )}
            </div>
          </div>

          {cart.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 bg-white shadow-[0_-6px_24px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="max-w-lg mx-auto space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your selection</p>
                {cart.map((c) => (
                  <div key={c.menuItem} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-800 truncate">{c.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!!order}
                        title={
                          order
                            ? 'Confirmed orders cannot be reduced from this page. Ask staff if you need a change.'
                            : undefined
                        }
                        className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-35 disabled:cursor-not-allowed"
                        onClick={() => changeQty(c.menuItem, -1)}
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-semibold">{c.qty}</span>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg border border-slate-200"
                        onClick={() => changeQty(c.menuItem, 1)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Subtotal</span>
                  <span className="font-bold tabular-nums" style={{ color: 'var(--qr-accent, #0d9488)' }}>
                    {fmtMoney(cartTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onConfirm}
                  className="w-full py-3.5 rounded-xl disabled:opacity-60 font-bold text-base shadow-lg flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--qr-accent, #0d9488)',
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
            </div>
          )}
        </div>
      )}

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
