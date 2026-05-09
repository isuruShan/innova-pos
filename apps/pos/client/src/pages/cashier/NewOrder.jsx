import { useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Plus, Minus, Trash2, FileText, Hash, Link2, ChevronDown, ChevronUp, ClipboardList, Tag, ToggleLeft, ToggleRight, X, Zap } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { ORDER_TYPES, ORDER_TYPE_MAP } from '../../components/OrderTypeBadge';
import { formatCurrency } from '../../utils/format';

const formatPrice = formatCurrency;

// Normalize any value to a comparable string (handles ObjectId, string, null)
const sid = (v) => (v == null ? '' : v.toString());

/** Mirror of server/src/utils/applyPromotions.js — supports applicableCategories */
function inScope(item, promo) {
  const ids  = (promo.applicableItems      || []).map(sid);
  const cats =  promo.applicableCategories || [];
  if (!ids.length && !cats.length) return true;
  if (ids.includes(sid(item.menuItem))) return true;
  if (item.category && cats.includes(item.category)) return true;
  return false;
}

function calcPromotionDiscounts(cart, promotions) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const applied = [];
  for (const promo of promotions) {
    let disc = 0;
    switch (promo.type) {
      case 'bundle': {
        if (!promo.bundleItems?.length) break;
        // Guard: skip any bundle item whose menuItem is empty/null (malformed promo)
        const validItems = promo.bundleItems.filter(bi => bi.menuItem);
        if (validItems.length !== promo.bundleItems.length) break;
        const times = Math.min(...validItems.map(bi => {
          const ci = cart.find(i => sid(i.menuItem) === sid(bi.menuItem));
          return ci ? Math.floor(ci.qty / bi.qty) : 0;
        }));
        if (times <= 0) break;
        const normal = validItems.reduce((s, bi) => {
          const ci = cart.find(i => sid(i.menuItem) === sid(bi.menuItem));
          return s + (ci ? ci.price * bi.qty : 0);
        }, 0);
        disc = Math.max(0, (normal - promo.bundlePrice) * times);
        break;
      }
      case 'buyXgetY': {
        if (!promo.buyItem || !promo.getFreeItem) break;
        const buy  = cart.find(i => sid(i.menuItem) === sid(promo.buyItem));
        const free = cart.find(i => sid(i.menuItem) === sid(promo.getFreeItem));
        if (!buy || buy.qty < promo.buyQty || !free) break;
        disc = free.price * promo.getFreeQty * Math.floor(buy.qty / promo.buyQty);
        break;
      }
      case 'flatPrice': {
        const ids  = promo.applicableItems      || [];
        const cats = promo.applicableCategories || [];
        if (!ids.length && !cats.length) break;
        cart.filter(i => inScope(i, promo)).forEach(i => {
          const d = (i.price - promo.flatPrice) * i.qty;
          if (d > 0) disc += d;
        });
        break;
      }
      case 'flatDiscount': {
        if (promo.minOrderAmount > 0 && subtotal < promo.minOrderAmount) break;
        const ids  = promo.applicableItems      || [];
        const cats = promo.applicableCategories || [];
        const base = (ids.length || cats.length)
          ? cart.filter(i => inScope(i, promo)).reduce((s, i) => s + i.price * i.qty, 0)
          : subtotal;
        disc = Math.min(promo.discountAmount, base);
        break;
      }
      case 'percentageDiscount': {
        if (promo.minOrderAmount > 0 && subtotal < promo.minOrderAmount) break;
        const ids  = promo.applicableItems      || [];
        const cats = promo.applicableCategories || [];
        const base = (ids.length || cats.length)
          ? cart.filter(i => inScope(i, promo)).reduce((s, i) => s + i.price * i.qty, 0)
          : subtotal;
        disc = base * (promo.discountPercent / 100);
        break;
      }
    }
    if (disc > 0.001) applied.push({
      id: promo._id,
      name: promo.name,
      type: promo.type,
      discountAmount: Math.round(disc * 100) / 100,
    });
  }
  return applied;
}

/** IDs of cart items that a promotion "touches" (covers). */
function getPromoTouchedItemIds(promo, cart) {
  const ids  = (promo.applicableItems      || []).map(sid);
  const cats =  promo.applicableCategories || [];
  switch (promo.type) {
    case 'bundle':
      return new Set(
        (promo.bundleItems || [])
          .filter(bi => bi.menuItem && cart.some(i => sid(i.menuItem) === sid(bi.menuItem)))
          .map(bi => sid(bi.menuItem))
      );
    case 'buyXgetY':
      return new Set(
        [promo.buyItem, promo.getFreeItem]
          .filter(id => id && cart.some(i => sid(i.menuItem) === sid(id)))
          .map(sid)
      );
    default: {
      const hasScope = ids.length > 0 || cats.length > 0;
      if (!hasScope) return new Set(cart.map(i => sid(i.menuItem)));
      return new Set(
        cart
          .filter(i => ids.includes(sid(i.menuItem)) || cats.includes(i.category))
          .map(i => sid(i.menuItem))
      );
    }
  }
}

/** Greedy best-deal selection: highest-discount promo first, one promo per item. */
function autoSelectBestPromos(cart, promotions) {
  if (!cart.length) return [];
  const candidates = promotions
    .map(promo => {
      const result = calcPromotionDiscounts(cart, [promo]);
      if (!result.length) return null;
      // touched is already a Set of sid() strings from getPromoTouchedItemIds
      return { id: sid(promo._id), discount: result[0].discountAmount, touched: getPromoTouchedItemIds(promo, cart) };
    })
    .filter(Boolean)
    .sort((a, b) => b.discount - a.discount);

  const used = new Set();  // all contain sid()-normalised strings
  const selected = [];
  for (const c of candidates) {
    if ([...c.touched].some(id => used.has(id))) continue;
    selected.push(c.id);
    c.touched.forEach(id => used.add(id));
  }
  return selected;
}


function MenuCard({ item, onAdd }) {
  return (
    <button
      onClick={() => onAdd(item)}
      disabled={!item.available}
      className={`bg-[#1e293b] rounded-2xl overflow-hidden border hover:shadow-lg transition group disabled:opacity-40 disabled:cursor-not-allowed text-left w-full ${
        item.isCombo
          ? 'border-amber-500/30 hover:border-amber-500/60 hover:shadow-amber-500/10'
          : 'border-slate-700/50 hover:border-amber-500/50 hover:shadow-amber-500/5'
      }`}
    >
      <div className="relative h-32 bg-slate-800 overflow-hidden">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {item.isCombo ? '🍱' : '🍔'}
          </div>
        )}
        {item.isCombo && (
          <div className="absolute top-2 left-2">
            <span className="flex items-center gap-1 bg-amber-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <Link2 size={9} /> Combo
            </span>
          </div>
        )}
        {!item.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs text-red-400 font-semibold bg-red-500/20 border border-red-500/30 rounded-full px-2 py-0.5">Unavailable</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-white text-sm truncate">{item.name}</p>
        {item.isCombo && item.comboItems?.length > 0 && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {item.comboItems.map(c => c.name).join(' + ')}
          </p>
        )}
        <p className="text-amber-400 font-bold mt-0.5">{formatPrice(item.price)}</p>
      </div>
    </button>
  );
}

function CartItem({ item, onChangeQty }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-[#0f172a] rounded-xl p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-white truncate">{item.name}</p>
            {item.isCombo && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-amber-400/70 hover:text-amber-400 flex-shrink-0"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
          <p className="text-xs text-amber-400">{formatPrice(item.price)} each</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChangeQty(item.menuItem, -1)}
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-400 flex items-center justify-center transition"
          >
            <Minus size={11} />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-white">{item.qty}</span>
          <button
            onClick={() => onChangeQty(item.menuItem, 1)}
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-amber-500/30 text-slate-300 hover:text-amber-400 flex items-center justify-center transition"
          >
            <Plus size={11} />
          </button>
        </div>
        <span className="text-sm font-semibold text-white w-14 text-right">{formatPrice(item.price * item.qty)}</span>
      </div>
      {/* Combo sub-items expansion */}
      {item.isCombo && expanded && item.comboItems?.length > 0 && (
        <div className="mt-2 ml-2 pl-2 border-l border-amber-500/20 space-y-0.5">
          {item.comboItems.map((ci, i) => (
            <p key={i} className="text-xs text-slate-500">
              • {ci.name} ×{ci.qty * item.qty}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewOrder() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('dine-in');
  const [tableNumber, setTableNumber] = useState('');
  const [reference, setReference] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Promotion state
  const [autoApply, setAutoApply] = useState(true);
  const [selectedPromoIds, setSelectedPromoIds] = useState([]);
  const [showPromoList, setShowPromoList] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const qc = useQueryClient();

  const activeType = ORDER_TYPE_MAP[orderType];

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get('/menu').then(r => r.data),
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: activePromos = [] } = useQuery({
    queryKey: ['promotions-active'],
    queryFn: () => api.get('/promotions', { params: { active: 'true' } }).then(r => r.data),
    staleTime: 60_000,
  });

  const typeSetting = settings?.orderTypes?.[orderType];
  const taxRate = typeSetting?.taxRate ?? 0;
  const serviceFeeType = typeSetting?.serviceFeeType ?? 'percentage';
  const serviceFeeRate = typeSetting?.serviceFeeRate ?? 0;
  const serviceFeeFixed = typeSetting?.serviceFeeFixed ?? 0;

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const mutation = useMutation({
    mutationFn: (order) => api.post('/orders', order),
    onSuccess: () => {
      setCart([]);
      setTableNumber('');
      setReference('');
      setSelectedPromoIds([]);
      setShowPromoList(false);
      setSuccessMsg('Order placed successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category))].filter(Boolean).sort();
    return ['All', ...cats];
  }, [menuItems]);

  const filtered = useMemo(() =>
    activeCategory === 'All' ? menuItems : menuItems.filter(i => i.category === activeCategory),
    [menuItems, activeCategory]
  );

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem === item._id);
      if (existing) return prev.map(c => c.menuItem === item._id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        menuItem: item._id,
        name: item.name,
        price: item.price,
        qty: 1,
        category: item.category || '',
        isCombo: item.isCombo || false,
        comboItems: item.comboItems || [],
      }];
    });
  };

  const changeQty = (id, delta) => {
    setCart(prev => prev
      .map(c => c.menuItem === id ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0)
    );
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  // Which promo IDs are "active" based on mode (all IDs are sid()-normalised strings)
  const effectivePromoIds = useMemo(() => {
    if (!cart.length) return [];
    if (autoApply) return autoSelectBestPromos(cart, activePromos);
    // Manual: keep only promos that still produce a discount
    return selectedPromoIds.filter(id => {
      const p = activePromos.find(x => sid(x._id) === id);
      return p && calcPromotionDiscounts(cart, [p]).length > 0;
    });
  }, [cart, activePromos, autoApply, selectedPromoIds]);

  const appliedPromos = useMemo(() => {
    if (!effectivePromoIds.length) return [];
    const promos = effectivePromoIds.map(id => activePromos.find(p => sid(p._id) === id)).filter(Boolean);
    return calcPromotionDiscounts(cart, promos);
  }, [effectivePromoIds, cart, activePromos]);

  // For manual picker: all promos that give a discount for this cart
  const applicablePromos = useMemo(() => {
    if (autoApply || !cart.length) return [];
    return activePromos
      .map(promo => {
        const res = calcPromotionDiscounts(cart, [promo]);
        return res.length ? { promo, discount: res[0].discountAmount } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.discount - a.discount);
  }, [cart, activePromos, autoApply]);

  // Toggle a promo manually with conflict detection (all stored IDs are sid()-normalised)
  const togglePromoManually = useCallback((rawPromoId) => {
    const promoId = sid(rawPromoId);
    if (selectedPromoIds.includes(promoId)) {
      setSelectedPromoIds(prev => prev.filter(id => id !== promoId));
      return;
    }
    const promo = activePromos.find(p => sid(p._id) === promoId);
    if (!promo) return;
    const newTouched = getPromoTouchedItemIds(promo, cart);
    const conflictIds = selectedPromoIds.filter(existId => {
      const existing = activePromos.find(p => sid(p._id) === existId);
      if (!existing) return false;
      const exTouched = getPromoTouchedItemIds(existing, cart);
      return [...newTouched].some(id => exTouched.has(id));
    });
    if (conflictIds.length) {
      const names = conflictIds
        .map(id => activePromos.find(p => sid(p._id) === id)?.name)
        .filter(Boolean).join('", "');
      setSelectedPromoIds(prev => [...prev.filter(id => !conflictIds.includes(id)), promoId]);
      showToast(`Removed "${names}" — it conflicts with "${promo.name}"`);
    } else {
      setSelectedPromoIds(prev => [...prev, promoId]);
    }
  }, [activePromos, cart, selectedPromoIds, showToast]);

  const discountTotal = appliedPromos.reduce((s, p) => s + p.discountAmount, 0);
  const discountedSubtotal = Math.max(0, subtotal - discountTotal);
  const taxAmount = discountedSubtotal * (taxRate / 100);
  const serviceFeeAmount = serviceFeeType === 'fixed'
    ? serviceFeeFixed
    : discountedSubtotal * (serviceFeeRate / 100);
  const total = discountedSubtotal + taxAmount + serviceFeeAmount;

  const canPlace = cart.length > 0 && (orderType !== 'dine-in' || tableNumber.trim());

  const placeOrder = () => {
    if (!canPlace) return;
    mutation.mutate({
      orderType,
      tableNumber: orderType === 'dine-in' ? tableNumber.trim() : '',
      reference: orderType !== 'dine-in' ? reference.trim() : '',
      items: cart,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-[#0f172a]">
      <Navbar links={[
        { to: '/cashier/orders', label: 'Order Board', icon: ClipboardList },
        { to: '/cashier/report', label: 'Day-End Report', icon: FileText },
      ]} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Menu */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-slate-700/50">
          {/* Category tabs */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-slate-700/50 bg-[#1e293b]/50">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-slate-500">Loading menu...</div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">No items in this category</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filtered.map(item => (
                  <MenuCard key={item._id} item={item} onAdd={addToCart} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-80 xl:w-96 flex flex-col bg-[#1e293b]/30">
          <div className="p-4 border-b border-slate-700/50 flex items-center gap-2">
            <ShoppingCart size={18} className="text-amber-400" />
            <h2 className="font-semibold text-white">Current Order</h2>
            {cart.length > 0 && (
              <span className="ml-auto bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </div>

          {/* Order type selector */}
          <div className="px-4 pt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-400">Order Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ORDER_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => { setOrderType(type.id); setTableNumber(''); setReference(''); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition ${
                    orderType === type.id
                      ? `${type.activeBg} text-white border-transparent shadow-lg`
                      : `bg-[#0f172a] border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white`
                  }`}
                >
                  <span className="text-base">{type.icon}</span>
                  <span className="truncate">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Conditional input */}
            {orderType === 'dine-in' ? (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Table Number *</label>
                <div className="flex items-center gap-2 bg-[#0f172a] rounded-xl border border-slate-700 focus-within:border-blue-500 px-3 py-2.5 transition">
                  <Hash size={14} className="text-slate-500" />
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    placeholder="e.g. 7"
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-600"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{activeType.hint}</label>
                <div className={`flex items-center gap-2 bg-[#0f172a] rounded-xl border border-slate-700 focus-within:border-${activeType.color.split('-')[1]}-500 px-3 py-2.5 transition`}>
                  <span className="text-sm">{activeType.icon}</span>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder={activeType.placeholder}
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-slate-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                <ShoppingCart size={32} className="mb-2 opacity-40" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Tap menu items to add</p>
              </div>
            ) : (
              cart.map(item => (
                <CartItem key={item.menuItem} item={item} onChangeQty={changeQty} />
              ))
            )}
          </div>

          {/* ── Promotions panel ── */}
          {cart.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-700/50 bg-[#1e293b]/20">
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Tag size={12} className="text-amber-400" />
                  Promotions
                  {appliedPromos.length > 0 && (
                    <span className="bg-green-500/20 text-green-400 border border-green-500/25 text-xs px-1.5 py-0.5 rounded-full font-medium">
                      {appliedPromos.length}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Auto</span>
                  <button
                    onClick={() => { setAutoApply(v => !v); setSelectedPromoIds([]); setShowPromoList(false); }}
                    title={autoApply ? 'Auto-applying best deals' : 'Manual selection'}
                  >
                    {autoApply
                      ? <ToggleRight size={20} className="text-green-400" />
                      : <ToggleLeft  size={20} className="text-slate-600" />}
                  </button>
                </div>
              </div>

              {/* Auto-mode label */}
              {autoApply && appliedPromos.length === 0 && (
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <Zap size={10} /> No deals applicable to current cart
                </p>
              )}

              {/* Applied promos list */}
              {appliedPromos.length > 0 && (
                <div className="space-y-1">
                  {appliedPromos.map((p, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-xs text-green-400 min-w-0">
                        <Tag size={9} className="flex-shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-green-400 font-semibold">-{formatPrice(p.discountAmount)}</span>
                        {!autoApply && (
                          <button
                            onClick={() => togglePromoManually(p.id)}
                            className="text-slate-600 hover:text-red-400 transition leading-none"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual picker */}
              {!autoApply && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowPromoList(v => !v)}
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition"
                  >
                    <Plus size={11} />
                    {showPromoList ? 'Hide promotions' : 'Add promotion'}
                    <ChevronDown size={11} className={`transition-transform ${showPromoList ? 'rotate-180' : ''}`} />
                  </button>

                  {showPromoList && (
                    <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                      {applicablePromos.length === 0 ? (
                        <p className="text-xs text-slate-600 py-2 text-center">
                          No promotions applicable to this cart
                        </p>
                      ) : applicablePromos.map(({ promo, discount }) => {
                        const sel = selectedPromoIds.includes(sid(promo._id));
                        return (
                          <button
                            key={promo._id}
                            onClick={() => togglePromoManually(promo._id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition ${
                              sel
                                ? 'bg-green-500/15 border-green-500/30 text-green-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700/70'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              {sel && <span className="text-green-400">✓</span>}
                              <span className="truncate">{promo.name}</span>
                            </span>
                            <span className={`font-semibold flex-shrink-0 ${sel ? 'text-green-400' : 'text-slate-400'}`}>
                              -{formatPrice(discount)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Totals & place order ── */}
          <div className="p-4 border-t border-slate-700/50 space-y-2">
            {/* Toast for conflict notifications */}
            {toast && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl px-3 py-2 text-xs flex items-start gap-2">
                <Tag size={12} className="flex-shrink-0 mt-0.5" />
                <span>{toast}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl px-3 py-2 text-sm text-center">
                {successMsg}
              </div>
            )}
            {mutation.isError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-3 py-2 text-sm text-center">
                {mutation.error?.response?.data?.message || 'Failed to place order'}
              </div>
            )}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
              </div>
              {appliedPromos.map((p, i) => (
                <div key={i} className="flex justify-between text-green-400">
                  <span className="flex items-center gap-1 truncate text-xs">
                    <Tag size={9} className="flex-shrink-0" />{p.name}
                  </span>
                  <span>-{formatPrice(p.discountAmount)}</span>
                </div>
              ))}
              {taxRate > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Tax ({taxRate}%)</span><span>{formatPrice(taxAmount)}</span>
                </div>
              )}
              {serviceFeeAmount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>
                    Service Fee {serviceFeeType === 'fixed' ? `(${formatPrice(serviceFeeFixed)})` : `(${serviceFeeRate}%)`}
                  </span>
                  <span>{formatPrice(serviceFeeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-slate-700/50">
                <span>Total</span><span className="text-amber-400">{formatPrice(total)}</span>
              </div>
            </div>
            <button
              onClick={placeOrder}
              disabled={!canPlace || mutation.isPending}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-green-500/20 text-sm mt-1"
            >
              {mutation.isPending ? 'Placing Order...' : 'Place Order'}
            </button>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="w-full flex items-center justify-center gap-1.5 text-slate-500 hover:text-red-400 text-xs py-1.5 transition"
              >
                <Trash2 size={13} /> Clear cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
