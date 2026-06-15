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
  Search,
} from 'lucide-react';
import {
  buildCategorySortMap,
  buildCategoryTabs,
  resolveMenuDisplayItems,
} from '../utils/menuItemUtils';

function apiBase() {
  return (import.meta.env.VITE_QR_ORDER_API_URL || '').replace(/\/$/, '');
}

const MENU_PAGE = 120;
const MENU_FETCH_LIMIT = 500;

function sessionPath(tenantId, storeId, tableId, query = {}) {
  const base = apiBase();
  let path = `/api/public/table/${encodeURIComponent(tenantId)}/${encodeURIComponent(storeId)}/${encodeURIComponent(tableId)}`;
  if (base.endsWith('/api') && path.startsWith('/api/')) {
    path = path.slice(4);
  }
  const qs = new URLSearchParams();
  if (query.menuSkip != null) qs.set('menuSkip', String(query.menuSkip));
  if (query.menuLimit != null) qs.set('menuLimit', String(query.menuLimit));
  const q = qs.toString();
  const full = q ? `${path}?${q}` : path;
  return base ? `${base}${full}` : full;
}

function resolveAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = apiBase();
  return `${base}/${url.replace(/^\//, '')}`;
}

function itemPhotoUrls(item) {
  const g = (item.images || []).map((x) => String(x.url || '').trim()).filter(Boolean);
  if (g.length) return g.map(resolveAssetUrl);
  if (item.image) return [resolveAssetUrl(item.image.trim())];
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

function VariantSelectorModal({ item, currencySymbol, onClose, onAdd }) {
  const [selections, setSelections] = useState({});

  useEffect(() => {
    setSelections({});
  }, [item?._id]);

  if (!item) return null;

  const options = item.variantOptions || [];
  const variants = item.variants || [];

  const handleSelect = (optionName, val) => {
    setSelections((p) => ({ ...p, [optionName]: val }));
  };

  const selectedVariant = variants.find((v) => {
    if (v.available === false) return false;
    return options.every((opt) => selections[opt.name] === v.attributes?.find((a) => a.name === opt.name)?.value);
  });

  const canConfirm = options.every((opt) => selections[opt.name] !== undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--qr-border)] shadow-2xl flex flex-col min-h-0 bg-[var(--qr-panel)] text-[var(--qr-body)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--qr-border)]">
          <div>
            <h3 className="text-base font-bold text-slate-800">{item.name}</h3>
            <p className="text-xs text-[var(--qr-muted)]">Select options to add to order</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-105 text-[var(--qr-muted)] hover:text-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {options.map((opt) => (
            <div key={opt.name} className="space-y-2">
              <span className="text-xs font-bold text-[var(--qr-muted)] uppercase tracking-wider">{opt.name}</span>
              <div className="flex flex-wrap gap-2">
                {opt.values?.map((val) => {
                  const active = selections[opt.name] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelect(opt.name, val)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 ${
                        active
                          ? 'ring-2 ring-[var(--qr-accent)] ring-offset-2 scale-105 shadow-md text-white font-extrabold border-transparent'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                      style={active ? { backgroundColor: 'var(--qr-accent, #f59e0b)' } : {}}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {selectedVariant ? (
            <div className="bg-slate-50 rounded-xl p-3 border border-[var(--qr-border)] flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                {selectedVariant.image ? (
                  <img src={resolveAssetUrl(selectedVariant.image)} alt="" className="w-full h-full object-cover" />
                ) : itemPhotoUrls(item)[0] ? (
                  <img src={itemPhotoUrls(item)[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl bg-slate-205">🍔</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{selectedVariant.name}</p>
                <p className="text-xs text-[var(--qr-muted)] truncate">{selectedVariant.description || 'Selected Option'}</p>
              </div>
              <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--qr-accent, #f59e0b)' }}>
                {currencySymbol}{Number(selectedVariant.price || 0).toFixed(2)}
              </span>
            </div>
          ) : (
            canConfirm && (
              <div className="p-3 bg-red-50/10 border border-red-500/20 text-red-650 text-xs font-medium rounded-xl">
                This combination is currently unavailable
              </div>
            )
          )}
        </div>

        <div className="p-4 border-t border-[var(--qr-border)] flex gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm border border-slate-205 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onAdd(item, selectedVariant);
              onClose();
            }}
            disabled={!selectedVariant}
            className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition"
            style={{
              backgroundColor: 'var(--qr-accent, #f59e0b)',
              color: 'var(--qr-on-accent, #ffffff)',
            }}
          >
            Add to order
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemDetailModal({ item, currencySymbol, onClose, onAdd }) {
  const urls = item ? itemPhotoUrls(item) : [];
  const [idx, setIdx] = useState(0);
  const [selections, setSelections] = useState({});

  useEffect(() => {
    setIdx(0);
    setSelections({});
  }, [item?._id]);

  if (!item) return null;

  const desc = String(item.description || '').trim();
  const canAdd = !!item.available;
  const options = item.variantOptions || [];
  const variants = item.variants || [];
  const hasVariants = item.hasVariants && variants.length > 0;

  const handleSelect = (optionName, val) => {
    setSelections((p) => ({ ...p, [optionName]: val }));
  };

  const selectedVariant = hasVariants
    ? variants.find((v) => {
        if (v.available === false) return false;
        return options.every((opt) => selections[opt.name] === v.attributes?.find((a) => a.name === opt.name)?.value);
      })
    : null;

  const canConfirm = hasVariants ? options.every((opt) => selections[opt.name] !== undefined) : true;
  const displayPrice = selectedVariant
    ? Number(selectedVariant.price || 0)
    : hasVariants
    ? Math.min(...variants.map((v) => Number(v.price || 0)))
    : Number(item.price || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl bg-[var(--qr-panel)] shadow-2xl flex flex-col min-h-0 border border-[var(--qr-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--qr-border)] shrink-0">
          <h2 id="item-detail-title" className="text-lg font-bold text-slate-800 pr-2 leading-tight">
            {item.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-[var(--qr-muted)] hover:text-slate-800"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {urls.length > 0 ? (
            <div className="relative bg-slate-50 aspect-[4/3] max-h-[42vh] shrink-0">
              <img src={urls[idx]} alt="" className="w-full h-full object-contain" />
              {urls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => setIdx((i) => Math.max(0, i - 1))}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white disabled:opacity-30"
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
                        className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-2 bg-white/40'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center text-5xl">🍽️</div>
          )}

          <div className="px-4 py-4 space-y-4">
            {/* Price display — updates dynamically with selected variant */}
            <div className="flex items-center gap-3">
              <p className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--qr-accent, #f59e0b)' }}>
                {hasVariants && !selectedVariant ? 'From ' : ''}
                {currencySymbol}{displayPrice.toFixed(2)}
              </p>
              {item.category && <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">{item.category}</p>}
            </div>

            {desc ? (
              <p className="text-sm text-slate-500 whitespace-pre-wrap leading-relaxed">{desc}</p>
            ) : null}

            {/* Variant Options */}
            {hasVariants && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-[var(--qr-muted)] uppercase tracking-wider">Choose options</p>
                {options.map((opt) => (
                  <div key={opt.name} className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-400">{opt.name}</span>
                    <div className="flex flex-wrap gap-2">
                      {opt.values?.map((val) => {
                        const active = selections[opt.name] === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleSelect(opt.name, val)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 ${active ? 'ring-2 ring-[var(--qr-accent)] ring-offset-2 scale-105 shadow-md text-white font-extrabold border-transparent' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-350'}`}
                            style={active ? { backgroundColor: 'var(--qr-accent, #f59e0b)', color: 'var(--qr-on-accent, #fff)' } : {}}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Selected variant preview */}
                {selectedVariant ? (
                  <div className="bg-slate-50 rounded-xl p-3 border border-[var(--qr-border)] flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                      {selectedVariant.image ? (
                        <img src={resolveAssetUrl(selectedVariant.image)} alt="" className="w-full h-full object-cover" />
                      ) : urls[0] ? (
                        <img src={urls[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg bg-slate-200">🍔</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{selectedVariant.name}</p>
                      <p className="text-xs text-[var(--qr-muted)] truncate">{selectedVariant.description || 'Selected option'}</p>
                    </div>
                  </div>
                ) : (
                  canConfirm && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-650 text-xs rounded-xl">
                      This combination is unavailable
                    </div>
                  )
                )}

                {/* All variants comparison */}
                <div className="pt-1">
                  <p className="text-xs font-bold text-[var(--qr-muted)] uppercase tracking-wider mb-2">Compare all options</p>
                  <div className="space-y-1.5">
                    {variants.map((v) => (
                      <div
                        key={v._id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border transition ${
                          v.available === false ? 'opacity-40 border-slate-200 bg-transparent' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-medium text-slate-200 truncate">{v.name}</span>
                        <span className="font-bold tabular-nums shrink-0" style={{ color: 'var(--qr-accent, #f59e0b)' }}>
                          {currencySymbol}{Number(v.price || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--qr-border)]/60 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!canAdd || (hasVariants && !selectedVariant)}
            onClick={() => {
              onAdd(item, selectedVariant || null);
              onClose();
            }}
            className="w-full py-3.5 rounded-xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition"
            style={{
              backgroundColor: 'var(--qr-accent, #f59e0b)',
              color: 'var(--qr-on-accent, #ffffff)',
            }}
          >
            {!canAdd ? 'Currently unavailable' : hasVariants && !selectedVariant ? 'Select options above' : 'Add to order'}
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
  const [menuSearch, setMenuSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [payload, setPayload] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterBlockedUntil, setWaiterBlockedUntil] = useState(null);
  const [waiterTick, setWaiterTick] = useState(0);
  const [detailItem, setDetailItem] = useState(null);
  const [variantSelectionItem, setVariantSelectionItem] = useState(null);
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
    const accent = branding?.qrOrdering?.accentColor || branding?.accentColor || '#fa7237';
    // Always use dynamic theme light styles
    return {
      '--qr-primary': '#ffffff',
      '--qr-accent': accent,
      '--qr-text': '#1e293b',
      '--qr-on-accent': branding?.selectionTextColor || '#ffffff',
      '--qr-page-bg': '#f8fafc',
      '--qr-panel': '#ffffff',
      '--qr-border': '#e2e8f0',
      '--qr-body': '#1e293b',
      '--qr-muted': '#64748b',
      '--qr-radius': '1rem',
    };
  }, [branding]);

  const fetchSession = useCallback(
    async (appendMenu = false) => {
      if (!tenantId || !storeId || !tableId) return;
      try {
        const menuSkip = appendMenu ? menuLenRef.current : 0;
        const menuLimit = appendMenu ? MENU_PAGE : MENU_FETCH_LIMIT;
        const { data } = await axios.get(
          sessionPath(tenantId, storeId, tableId, { menuSkip, menuLimit }),
        );
        if (appendMenu) {
          setPayload((prev) => ({
            ...data,
            menuItems: [...(prev?.menuItems || []), ...(data.menuItems || [])],
            categories: data.categories?.length ? data.categories : prev?.categories,
          }));
        } else {
          setPayload(data);
          const total = data.menuTotal != null ? Number(data.menuTotal) : (data.menuItems || []).length;
          if (total > (data.menuItems || []).length && total <= MENU_FETCH_LIMIT) {
            const full = await axios.get(
              sessionPath(tenantId, storeId, tableId, { menuSkip: 0, menuLimit: total }),
            );
            setPayload((prev) => ({
              ...full.data,
              categories: full.data.categories?.length ? full.data.categories : prev?.categories,
            }));
            menuLenRef.current = (full.data.menuItems || []).length;
            return;
          }
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
  const categoryRows = payload?.categories || [];

  const categorySortMap = useMemo(
    () => buildCategorySortMap(categoryRows),
    [categoryRows],
  );

  const categories = useMemo(
    () => buildCategoryTabs(categoryRows, menuItems),
    [categoryRows, menuItems],
  );

  const filteredMenu = useMemo(
    () => resolveMenuDisplayItems(menuItems, {
      activeCategory: activeCat,
      menuSearch,
      categorySortMap,
    }),
    [menuItems, activeCat, menuSearch, categorySortMap],
  );

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

  const addOne = (item, variant = null) => {
    setCart((prev) => {
      const id = String(item._id);
      const varId = variant ? String(variant._id) : null;
      const cartKey = varId ? `${id}::${varId}` : id;
      const found = prev.find((x) => x.cartKey === cartKey);
      const price = variant ? Number(variant.price || 0) : Number(item.price || 0);
      const displayName = variant ? `${item.name} – ${variant.name}` : item.name;
      if (found) {
        return prev.map((x) => (x.cartKey === cartKey ? { ...x, qty: x.qty + 1 } : x));
      }
      return [...prev, { cartKey, menuItem: id, variantId: varId || undefined, name: displayName, price, qty: 1 }];
    });
    showToast(`Added ${variant ? variant.name : item.name} to cart`);
  };

  const addWithVariant = (item) => {
    if (item.hasVariants && item.variants?.length > 0) {
      setVariantSelectionItem(item);
    } else {
      addOne(item);
    }
  };

  const changeQty = (cartKey, delta) => {
    setCart((prev) =>
      prev
        .map((x) => (x.cartKey === cartKey ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0),
    );
  };

  const removeLine = (cartKey) => {
    setCart((prev) => prev.filter((x) => x.cartKey !== cartKey));
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
        items: cart.map((c) => ({
          menuItem: c.menuItem,
          qty: c.qty,
          ...(c.variantId ? { variantId: c.variantId } : {}),
        })),
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
        className="shrink-0 px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-3.5 shadow-sm border-b border-[var(--qr-border)] z-20"
        style={{ backgroundColor: 'var(--qr-panel)', color: 'var(--qr-body)' }}
      >
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {branding?.logoUrl ? (
              <img 
                src={resolveAssetUrl(branding.logoUrl)} 
                alt={displayName} 
                className="h-12 w-12 rounded-xl object-cover border border-slate-100 shadow-sm shrink-0" 
              />
            ) : (
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center font-extrabold text-base text-white shadow-sm shrink-0"
                style={{ backgroundColor: 'var(--qr-accent)' }}
              >
                {String(displayName || 'M').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-805 leading-tight truncate">{displayName}</h1>
              {branding?.tagline ? (
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-normal">{branding.tagline}</p>
              ) : payload.storeName && payload.storeName !== displayName ? (
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{payload.storeName}</p>
              ) : null}
            </div>
          </div>
          
          <div className="shrink-0">
            <span 
              className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black shadow-sm border"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--qr-accent) 8%, #ffffff)',
                color: 'var(--qr-accent)',
                borderColor: 'color-mix(in srgb, var(--qr-accent) 20%, #ffffff)',
              }}
            >
              Table {payload.tableLabel}
            </span>
          </div>
        </div>
      </header>

      {msg && (
        <div className="shrink-0 mx-3 mt-3 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-800 text-sm px-4 py-3 shadow-sm font-medium animate-fadeIn">
          {msg}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {tab === 'order' && (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-4 pb-[calc(8rem+env(safe-area-inset-bottom))] space-y-4 max-w-lg mx-auto w-full animate-fadeIn">
            {order ? (
              <section className="rounded-2xl bg-[var(--qr-panel)] border border-[var(--qr-border)] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Your order</p>
                    <p className="font-mono font-bold text-slate-800">#{String(order.orderNumber).padStart(3, '0')}</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-805 border border-amber-205">
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {(order.items || []).map((line, idx) => (
                    <li key={idx} className="py-2.5 flex justify-between gap-2">
                      <span className="text-slate-805 min-w-0">
                        <span className="block font-semibold truncate">{line.name} × {line.qty}</span>
                        {line.variantName && (
                          <span className="block text-[11px] text-amber-600 truncate font-semibold">↳ {line.variantName}</span>
                        )}
                      </span>
                      <span className="text-slate-500 tabular-nums shrink-0 font-semibold">{fmtMoney(line.price * line.qty)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                  <span>Total</span>
                  <span className="tabular-nums" style={{ color: 'var(--qr-accent)' }}>{fmtMoney(order.totalAmount)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Pay with staff when you finish. You can add more from the <strong>Menu</strong> tab; you cannot reduce
                  confirmed quantities here.
                </p>
              </section>
            ) : (
              <section className="rounded-2xl bg-[var(--qr-panel)] border border-[var(--qr-border)] p-6 text-center text-slate-400 text-sm shadow-sm">
                No open order yet. Use <strong>Menu</strong> to choose items and send them to the kitchen.
              </section>
            )}
          </div>
        )}

        {tab === 'menu' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 px-3 pt-3 pb-2.5 bg-[var(--qr-panel)] border-b border-[var(--qr-border)] space-y-2.5">
              <div className="flex gap-2.5 overflow-x-auto pb-2 touch-pan-x max-w-lg mx-auto w-full category-scroll">
                {categories.map((c) => {
                  const catObj = categoryRows.find((row) => row.name === c);
                  const imageUrl = catObj?.imageUrl;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setActiveCat(c)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition active:scale-95 ${
                        activeCat === c
                          ? 'text-white'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-105'
                      }`}
                      style={
                        activeCat === c
                          ? {
                              backgroundColor: 'var(--qr-accent, #f59e0b)',
                              color: 'var(--qr-on-accent, #fff)',
                              border: '2px solid var(--qr-accent, #f59e0b)',
                              boxShadow: '0 0 12px 2px color-mix(in srgb, var(--qr-accent, #f59e0b) 55%, transparent)',
                            }
                          : {}
                      }
                    >
                      <div className={`w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[10px] ${
                        activeCat === c ? 'bg-white/20' : 'bg-slate-200'
                      }`}>
                        {c === 'All' ? (
                          '🍽️'
                        ) : imageUrl ? (
                          <img src={resolveAssetUrl(imageUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          '🏷️'
                        )}
                      </div>
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative max-w-lg mx-auto w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search menu…"
                  className="w-full bg-slate-50 border border-slate-205 text-slate-800 rounded-2xl pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--qr-accent)]/20 placeholder-slate-400 transition-all"
                />
                {menuSearch && (
                  <button
                    type="button"
                    onClick={() => setMenuSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg font-bold"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-3 py-4">
              <div className="max-w-lg mx-auto w-full space-y-3.5 pb-[calc(8rem+env(safe-area-inset-bottom))]">
                {filteredMenu.length === 0 ? (
                  <p className="text-center text-slate-505 text-sm py-16 bg-[var(--qr-panel)] border border-[var(--qr-border)] rounded-2xl shadow-sm">
                    {menuSearch.trim() ? 'No items match your search' : 'No items in this category'}
                  </p>
                ) : (
                  filteredMenu.map((item) => {
                    const photos = itemPhotoUrls(item);
                    const thumb = photos[0];
                    // Sum quantities for this menu item across all variants
                    const itemCartLines = cart.filter((x) => x.menuItem === String(item._id));
                    const qtyInCart = itemCartLines.reduce((s, x) => s + x.qty, 0);
                    // For single-variant or no-variant items, use the first matching line's cartKey
                    const singleCartKey = !item.hasVariants ? (itemCartLines[0]?.cartKey ?? String(item._id)) : null;

                    // Calculate display price for the product card listing
                    let displayPrice = Number(item.price || 0);
                    let pricePrefix = '';
                    const hasVariants = item.hasVariants && item.variants?.length > 0;
                    if (hasVariants) {
                      const availableVariants = item.variants.filter(v => v.available !== false);
                      if (availableVariants.length > 0) {
                        const defaultVariant = item.defaultVariantId 
                          ? availableVariants.find(v => String(v._id) === String(item.defaultVariantId))
                          : null;
                        if (defaultVariant) {
                          displayPrice = Number(defaultVariant.price || 0);
                        } else {
                          const prices = availableVariants.map(v => Number(v.price)).filter(p => !isNaN(p));
                          displayPrice = Math.min(...prices);
                          pricePrefix = 'from ';
                        }
                      }
                    }

                    return (
                      <div
                        key={item._id}
                        onClick={() => setDetailItem(item)}
                        className={`cursor-pointer rounded-2xl border shadow-sm overflow-hidden flex gap-0 transition-all hover:shadow-md duration-200 h-32 ${
                          item.available ? 'bg-[var(--qr-panel)] border-[var(--qr-border)]' : 'opacity-55 border-slate-200 bg-slate-100'
                        }`}
                      >
                        <div className="w-28 sm:w-32 shrink-0 bg-slate-50 self-stretch h-full overflow-hidden">
                          {thumb ? (
                            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl bg-slate-105">
                              🍽️
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 p-3 flex flex-col justify-between h-full">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <p className="font-bold text-slate-800 leading-snug truncate text-sm" title={item.name}>{item.name}</p>
                              {photos.length > 1 && (
                                <span className="text-[9px] text-slate-500 font-semibold shrink-0 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                  {photos.length} photos
                                </span>
                              )}
                            </div>
                            {item.category && <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">{item.category}</p>}
                            {item.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-1 leading-tight">
                                {item.description}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex flex-col">
                              <p className="text-sm font-extrabold text-slate-850 tabular-nums">
                                {pricePrefix && <span className="text-slate-450 font-normal text-[9px] uppercase tracking-wider">{pricePrefix}</span>}
                                {fmtMoney(displayPrice)}
                              </p>
                              {hasVariants && (
                                <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                  {item.variants.length} options
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setDetailItem(item)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-205 text-slate-500 bg-slate-50 hover:bg-slate-105 transition"
                                title="View details"
                              >
                                <Eye size={15} />
                              </button>
                              
                              {qtyInCart > 0 && !item.hasVariants ? (
                                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden h-8 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => changeQty(singleCartKey, -1)}
                                    className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition font-bold"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 text-xs font-bold text-slate-800 tabular-nums">
                                    {qtyInCart}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => changeQty(singleCartKey, 1)}
                                    className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 transition font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!item.available}
                                  onClick={() => addWithVariant(item)}
                                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-extrabold disabled:opacity-40 hover:brightness-110 active:scale-95 transition shrink-0 shadow-sm"
                                  style={{ backgroundColor: 'var(--qr-accent, #f59e0b)', color: 'var(--qr-on-accent, #fff)' }}
                                >
                                  <Plus size={13} />
                                  {item.hasVariants && qtyInCart > 0 ? `${qtyInCart} in cart` : 'Add'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {filteredMenu.length > 0 && menuItems.length < menuTotal && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      disabled={menuLoadingMore}
                      onClick={() => {
                        setMenuLoadingMore(true);
                        fetchSession(true);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-205 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 shadow-sm disabled:opacity-50 transition"
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
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden max-w-lg mx-auto w-full animate-fadeIn">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4">
              {cart.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-16">Your cart is empty. Add items from the Menu tab.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-450 uppercase tracking-wide">Your selection</p>
                  {cart.map((c) => (
                    <div
                      key={c.cartKey}
                      className="flex items-center justify-between gap-2 text-sm bg-[var(--qr-panel)] border border-[var(--qr-border)] rounded-xl px-3 py-2 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-855 font-bold truncate block">{c.name}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--qr-accent, #f59e0b)' }}>{fmtMoney(c.price)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 transition"
                          onClick={() => changeQty(c.cartKey, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-805">{c.qty}</span>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg border border-slate-205 text-slate-600 bg-slate-50 hover:bg-slate-100 transition"
                          onClick={() => changeQty(c.cartKey, 1)}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          title="Remove from cart"
                          className="p-1.5 rounded-lg border border-red-100 text-red-500 bg-red-50 hover:bg-red-100 hover:border-red-200 transition"
                          onClick={() => removeLine(c.cartKey)}
                          aria-label="Remove line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="shrink-0 border-t border-slate-200 bg-[var(--qr-panel)] px-4 py-3.5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] space-y-3.5 z-20 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="font-extrabold text-slate-800">Subtotal</span>
                  <span className="font-black text-lg tabular-nums" style={{ color: 'var(--qr-accent, #f59e0b)' }}>
                    {fmtMoney(cartTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onConfirm}
                  className="w-full py-3.5 rounded-xl disabled:opacity-60 font-bold text-base shadow-lg flex items-center justify-center gap-2 hover:brightness-110 transition cursor-pointer"
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

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-150 bg-[#ffffff] pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(15,23,42,0.06)]">
        {[
          { id: 'menu', label: 'Menu', Icon: ShoppingBag },
          { id: 'cart', label: 'Cart', Icon: ShoppingCart },
          { id: 'order', label: 'Order', Icon: ClipboardList },
        ].map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-bold transition-colors ${
                active ? 'text-slate-805' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-b-full"
                  style={{ backgroundColor: 'var(--qr-accent, #f59e0b)', boxShadow: '0 0 8px 1px color-mix(in srgb, var(--qr-accent, #f59e0b) 70%, transparent)' }}
                />
              )}
              <span className="relative inline-flex">
                <Icon size={20} style={active ? { color: 'var(--qr-accent, #f59e0b)' } : {}} />
                {id === 'cart' && cartCount > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                ) : null}
              </span>
              <span style={active ? { color: 'var(--qr-accent, #f59e0b)' } : {}}>{label}</span>
            </button>
          );
        })}
      </nav>

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          currencySymbol={currencySymbol}
          onClose={() => setDetailItem(null)}
          onAdd={addOne}
        />
      )}

      {variantSelectionItem && (
        <VariantSelectorModal
          item={variantSelectionItem}
          currencySymbol={currencySymbol}
          onClose={() => setVariantSelectionItem(null)}
          onAdd={addOne}
        />
      )}
    </div>
  );
}
