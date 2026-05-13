import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Minus, Trash2, Hash, Link2, ChevronDown, ChevronUp,
  Tag, ToggleLeft, ToggleRight, X, Zap, Search, User, Gift, UserPlus, ChevronLeft,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import { CASHIER_NAV_GROUPS } from '../../constants/cashierLinks';
import CashierSessionGate, { CASHIER_SESSION_QUERY_KEY } from '../../components/cashier/CashierSessionGate';
import { ORDER_TYPES, ORDER_TYPE_MAP } from '../../components/OrderTypeBadge';
import { formatCurrency } from '../../utils/format';
import { useBranding } from '../../context/BrandingContext';
import { useStoreContext } from '../../context/StoreContext';
import { MenuGridSkeleton } from '../../components/StoreSkeletons';
import { printReceipt } from '../../utils/receiptPrint';
import { shouldPrintReceiptOnOrderCreated } from '../../utils/receiptPolicy';
import { validateMobile, validateEmail } from '../../utils/customerValidation';

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
        if (promo.maxDiscountAmount != null && Number(promo.maxDiscountAmount) > 0) {
          disc = Math.min(disc, Number(promo.maxDiscountAmount));
        }
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
        if (promo.maxDiscountAmount != null && Number(promo.maxDiscountAmount) > 0) {
          disc = Math.min(disc, Number(promo.maxDiscountAmount));
        }
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

function rewardAppliesToLine(item, reward) {
  const ids = (reward.applicableItems || []).map(sid);
  const cats = reward.applicableCategories || [];
  if (!ids.length && !cats.length) return true;
  if (ids.includes(sid(item.menuItem))) return true;
  if (item.category && cats.includes(item.category)) return true;
  return false;
}

function scopedSubtotal(cart, reward) {
  return cart
    .filter((i) => rewardAppliesToLine(i, reward))
    .reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 0), 0);
}

/** Match server lib/loyaltyTier.js */
function computeLoyaltyRewardDiscount(reward, cart, remainingOrderCap) {
  const cap = Math.max(0, remainingOrderCap);
  if (!reward || cap <= 0) return 0;
  const base = scopedSubtotal(cart, reward);
  if (base <= 0) return 0;
  const maxDisc =
    reward.maxDiscountAmount != null && Number(reward.maxDiscountAmount) > 0
      ? Number(reward.maxDiscountAmount)
      : Infinity;
  let raw = 0;
  switch (reward.rewardType) {
    case 'order_discount_amount':
      raw = Number(reward.discountAmount || 0);
      break;
    case 'order_discount_percent':
      raw = base * (Number(reward.discountPercent || 0) / 100);
      break;
    case 'free_item': {
      const mid = reward.freeMenuItem?.toString();
      if (!mid) return 0;
      const line = cart.find((i) => sid(i.menuItem) === mid && rewardAppliesToLine(i, reward));
      if (!line) return 0;
      raw = Number(line.price || 0);
      break;
    }
    default:
      return 0;
  }
  raw = Math.min(raw, base, maxDisc, cap);
  return Math.round(Math.max(0, raw) * 100) / 100;
}


function MenuCard({ item, onAdd }) {
  return (
    <button
      onClick={() => onAdd(item)}
      disabled={!item.available}
      className={`bg-[var(--pos-panel)] rounded-2xl overflow-hidden border hover:shadow-lg transition group disabled:opacity-40 disabled:cursor-not-allowed text-left w-full ${
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
        <p className="font-semibold text-[var(--pos-text-primary)] text-sm truncate">{item.name}</p>
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
    <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-[var(--pos-text-primary)] truncate">{item.name}</p>
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
          <span className="w-6 text-center text-sm font-semibold text-[var(--pos-text-primary)]">{item.qty}</span>
          <button
            onClick={() => onChangeQty(item.menuItem, 1)}
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-amber-500/30 text-slate-300 hover:text-amber-400 flex items-center justify-center transition"
          >
            <Plus size={11} />
          </button>
        </div>
        <span className="text-sm font-semibold text-[var(--pos-text-primary)] w-14 text-right">{formatPrice(item.price * item.qty)}</span>
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
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [orderType, setOrderType] = useState('dine-in');
  const [tableNumber, setTableNumber] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [reference, setReference] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState('cash');
  const [cashReceivedInput, setCashReceivedInput] = useState('');

  // Promotion state
  const [autoApply, setAutoApply] = useState(true);
  const [selectedPromoIds, setSelectedPromoIds] = useState([]);
  const [showPromoList, setShowPromoList] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedLoyaltyRewardId, setSelectedLoyaltyRewardId] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickMobile, setQuickMobile] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickFormError, setQuickFormError] = useState('');

  const qc = useQueryClient();
  const branding = useBranding();
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const selectedStore =
    stores.find((s) => String(s._id) === String(selectedStoreId)) || stores.find((s) => s.isDefault) || null;
  const tableMgmt = selectedStore?.tableManagementEnabled === true;
  const deferPayment = tableMgmt && orderType === 'dine-in';
  const availablePaymentMethods = (selectedStore?.paymentMethods?.length ? selectedStore.paymentMethods : ['cash']);

  useEffect(() => {
    if (deferPayment) setSelectedLoyaltyRewardId('');
  }, [deferPayment]);

  const prevStoreRef = useRef(selectedStoreId);
  useEffect(() => {
    if (prevStoreRef.current && prevStoreRef.current !== selectedStoreId) {
      setCart([]);
      setSelectedPromoIds([]);
      setShowPromoList(false);
      setActiveCategory('All');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setSelectedLoyaltyRewardId('');
      setShowCustomerForm(false);
      setQuickName('');
      setQuickMobile('');
      setQuickEmail('');
      setTableNumber('');
      setSelectedTableId('');
    }
    prevStoreRef.current = selectedStoreId;
  }, [selectedStoreId]);

  const activeType = ORDER_TYPE_MAP[orderType] ?? ORDER_TYPE_MAP['dine-in'];

  const referenceFocusRing =
    orderType === 'takeaway'
      ? 'focus-within:border-green-500'
      : orderType === 'uber-eats'
        ? 'focus-within:border-emerald-500'
        : orderType === 'pickme'
          ? 'focus-within:border-orange-500'
          : 'focus-within:border-slate-500';

  const { data: menuItems = [], isPending: menuPending } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: isStoreReady,
  });

  const { data: settings, isPending: settingsPending } = useQuery({
    queryKey: ['settings', selectedStoreId],
    queryFn: () => api.get('/settings').then(r => r.data),
    enabled: isStoreReady,
    staleTime: 60_000,
  });

  const { data: cafeTables = [] } = useQuery({
    queryKey: ['cafe-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: isStoreReady && tableMgmt,
  });

  const { data: tableOccupancy = [] } = useQuery({
    queryKey: ['table-occupancy', selectedStoreId],
    queryFn: () => api.get('/tables/occupancy').then((r) => r.data),
    enabled: isStoreReady && tableMgmt,
    refetchInterval: 12_000,
  });

  const occupancyByTable = useMemo(() => {
    const m = new Map();
    (tableOccupancy || []).forEach((o) => {
      if (o.tableId) m.set(String(o.tableId), o);
    });
    return m;
  }, [tableOccupancy]);

  const { data: activePromos = [] } = useQuery({
    queryKey: ['promotions-active', selectedStoreId],
    queryFn: () => api.get('/promotions', { params: { active: 'true' } }).then(r => r.data),
    enabled: isStoreReady,
    staleTime: 60_000,
  });

  const { data: loyaltyConfig } = useQuery({
    queryKey: ['loyalty-config'],
    queryFn: () => api.get('/loyalty/config').then((r) => r.data),
    enabled: isStoreReady,
    staleTime: 60_000,
  });

  const { data: loyaltyRewardsRaw = [] } = useQuery({
    queryKey: ['loyalty-rewards-co', selectedStoreId],
    queryFn: () => api.get('/loyalty/rewards').then((r) => r.data),
    enabled: isStoreReady,
    staleTime: 30_000,
  });

  const loyaltyRewards = useMemo(
    () => loyaltyRewardsRaw.filter((r) => r.approvalStatus === 'approved' && r.active),
    [loyaltyRewardsRaw],
  );

  const redeemableLoyaltyRewards = useMemo(
    () => loyaltyRewards.filter((r) => (r.redemptionType || 'points') === 'points'),
    [loyaltyRewards],
  );

  const automaticLoyaltyRewards = useMemo(
    () => loyaltyRewards.filter((r) => r.redemptionType === 'automatic'),
    [loyaltyRewards],
  );

  const searchQ = customerSearch.trim();
  const { data: customerHits = [] } = useQuery({
    queryKey: ['customers-search', searchQ, selectedStoreId],
    queryFn: () => api.get('/customers', { params: { search: searchQ } }).then((r) => r.data),
    enabled: isStoreReady && searchQ.length >= 2,
  });

  const { data: customerLoyalty } = useQuery({
    queryKey: ['customer-loyalty', selectedCustomer?._id],
    queryFn: () =>
      api.get(`/customers/${selectedCustomer._id}`, { params: { loyalty: '1' } }).then((r) => r.data),
    enabled: isStoreReady && !!selectedCustomer?._id,
  });

  const promoTierLevel =
    selectedCustomer?._id != null ? customerLoyalty?.loyalty?.effectiveTier?.level ?? null : null;

  const activePromosForCart = useMemo(() => {
    return activePromos.filter((p) => {
      const min = p.minTierLevel;
      if (min == null || Number(min) <= 0) return true;
      if (promoTierLevel == null) return false;
      return Number(promoTierLevel) >= Number(min);
    });
  }, [activePromos, promoTierLevel]);

  const menuLoading = !isStoreReady || menuPending || settingsPending;

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

  const upsertCustomerMutation = useMutation({
    mutationFn: (payload) => api.post('/customers', payload),
    onSuccess: (axiosRes) => {
      const c = axiosRes?.data;
      if (!c?._id) return;
      setSelectedCustomer(c);
      setCustomerSearch(c.name || c.email || c.mobile || '');
      setQuickName('');
      setQuickMobile('');
      setQuickEmail('');
      setShowCustomerForm(false);
      qc.invalidateQueries({ queryKey: ['customers-search'] });
      qc.invalidateQueries({ queryKey: ['customer-loyalty'] });
      if (c.reused) showToast('Existing customer matched — attached to order');
      else showToast('Customer saved');
    },
    onError: (e) => showToast(e.response?.data?.message || 'Could not save customer'),
  });

  const mutation = useMutation({
    mutationFn: (payload) => api.post('/orders', payload),
    onSuccess: (axiosRes, variables) => {
      const createdOrder = axiosRes?.data;
      qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['order-board'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['customer-loyalty'] });
      qc.invalidateQueries({ queryKey: ['customers-search'] });
      setCart([]);
      setTableNumber('');
      setReference('');
      setSelectedPromoIds([]);
      setShowPromoList(false);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setSelectedLoyaltyRewardId('');
      setShowCustomerForm(false);
      setQuickName('');
      setQuickMobile('');
      setQuickEmail('');
      setSuccessMsg('Order placed successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (
        createdOrder &&
        shouldPrintReceiptOnOrderCreated(branding) &&
        createdOrder.paymentCollected !== false
      ) {
        printReceipt(createdOrder, {
          branding,
          store: selectedStore,
          paymentType: variables?.paymentType,
          cashTender: variables?.cashTender,
        });
      }
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
    if (autoApply) return autoSelectBestPromos(cart, activePromosForCart);
    // Manual: keep only promos that still produce a discount
    return selectedPromoIds.filter(id => {
      const p = activePromosForCart.find(x => sid(x._id) === id);
      return p && calcPromotionDiscounts(cart, [p]).length > 0;
    });
  }, [cart, activePromosForCart, autoApply, selectedPromoIds]);

  const appliedPromos = useMemo(() => {
    if (!effectivePromoIds.length) return [];
    const promos = effectivePromoIds.map(id => activePromosForCart.find(p => sid(p._id) === id)).filter(Boolean);
    return calcPromotionDiscounts(cart, promos);
  }, [effectivePromoIds, cart, activePromosForCart]);

  // For manual picker: all promos that give a discount for this cart
  const applicablePromos = useMemo(() => {
    if (autoApply || !cart.length) return [];
    return activePromosForCart
      .map(promo => {
        const res = calcPromotionDiscounts(cart, [promo]);
        return res.length ? { promo, discount: res[0].discountAmount } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.discount - a.discount);
  }, [cart, activePromosForCart, autoApply]);

  // Toggle a promo manually with conflict detection (all stored IDs are sid()-normalised)
  const togglePromoManually = useCallback((rawPromoId) => {
    const promoId = sid(rawPromoId);
    if (selectedPromoIds.includes(promoId)) {
      setSelectedPromoIds(prev => prev.filter(id => id !== promoId));
      return;
    }
    const promo = activePromosForCart.find(p => sid(p._id) === promoId);
    if (!promo) return;
    const newTouched = getPromoTouchedItemIds(promo, cart);
    const conflictIds = selectedPromoIds.filter(existId => {
      const existing = activePromosForCart.find(p => sid(p._id) === existId);
      if (!existing) return false;
      const exTouched = getPromoTouchedItemIds(existing, cart);
      return [...newTouched].some(id => exTouched.has(id));
    });
    if (conflictIds.length) {
      const names = conflictIds
        .map(id => activePromosForCart.find(p => sid(p._id) === id)?.name)
        .filter(Boolean).join('", "');
      setSelectedPromoIds(prev => [...prev.filter(id => !conflictIds.includes(id)), promoId]);
      showToast(`Removed "${names}" — it conflicts with "${promo.name}"`);
    } else {
      setSelectedPromoIds(prev => [...prev, promoId]);
    }
  }, [activePromosForCart, cart, selectedPromoIds, showToast]);

  const promoDiscountOnly = appliedPromos.reduce((s, p) => s + p.discountAmount, 0);

  const automaticLoyaltyDiscount = useMemo(() => {
    if (!selectedCustomer || loyaltyConfig?.isEnabled === false || !automaticLoyaltyRewards.length) return 0;
    const eff = customerLoyalty?.loyalty?.effectiveTier;
    let remaining = Math.max(0, subtotal - promoDiscountOnly);
    let total = 0;
    const sorted = [...automaticLoyaltyRewards].sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
    );
    for (const reward of sorted) {
      if (eff && reward.minTierLevel != null && eff.level < reward.minTierLevel) continue;
      const d = computeLoyaltyRewardDiscount(reward, cart, remaining);
      if (d <= 0) continue;
      remaining -= d;
      total += d;
    }
    return Math.round(total * 100) / 100;
  }, [
    selectedCustomer,
    loyaltyConfig?.isEnabled,
    automaticLoyaltyRewards,
    customerLoyalty,
    cart,
    subtotal,
    promoDiscountOnly,
  ]);

  const loyaltyDiscountPoints = useMemo(() => {
    if (!selectedLoyaltyRewardId || !selectedCustomer || loyaltyConfig?.isEnabled === false) return 0;
    const reward = redeemableLoyaltyRewards.find((r) => sid(r._id) === sid(selectedLoyaltyRewardId));
    if (!reward) return 0;
    const eff = customerLoyalty?.loyalty?.effectiveTier;
    if (eff && reward.minTierLevel != null && eff.level < reward.minTierLevel) return 0;
    const pts = Number(customerLoyalty?.lifetimePoints ?? selectedCustomer?.lifetimePoints ?? 0);
    if (pts < Number(reward.pointsCost || 0)) return 0;
    const afterPromoAndAuto = Math.max(0, subtotal - promoDiscountOnly - automaticLoyaltyDiscount);
    return computeLoyaltyRewardDiscount(reward, cart, afterPromoAndAuto);
  }, [
    selectedLoyaltyRewardId,
    selectedCustomer,
    loyaltyConfig?.isEnabled,
    redeemableLoyaltyRewards,
    customerLoyalty,
    cart,
    subtotal,
    promoDiscountOnly,
    automaticLoyaltyDiscount,
  ]);

  const discountTotal = Math.round(
    (promoDiscountOnly + automaticLoyaltyDiscount + loyaltyDiscountPoints) * 100,
  ) / 100;
  const discountedSubtotal = Math.max(0, subtotal - discountTotal);
  const taxAmount = discountedSubtotal * (taxRate / 100);
  const serviceFeeAmount = serviceFeeType === 'fixed'
    ? serviceFeeFixed
    : discountedSubtotal * (serviceFeeRate / 100);
  const total = discountedSubtotal + taxAmount + serviceFeeAmount;

  useEffect(() => {
    if (paymentModalOpen) {
      setCashReceivedInput(total.toFixed(2));
    }
  }, [paymentModalOpen, total]);

  const canPlace =
    cart.length > 0 &&
    (orderType !== 'dine-in' ||
      (tableMgmt ? Boolean(selectedTableId) : tableNumber.trim()));

  const placeOrder = () => {
    if (!canPlace) return;
    const parsedTender = parseFloat(String(cashReceivedInput).replace(/,/g, ''));
    const cashTender =
      paymentType === 'cash' && Number.isFinite(parsedTender) ? parsedTender : undefined;
    mutation.mutate({
      orderType,
      ...(orderType === 'dine-in' && tableMgmt && selectedTableId ? { tableId: selectedTableId } : {}),
      tableNumber:
        orderType === 'dine-in' && !tableMgmt ? tableNumber.trim() : '',
      reference: orderType !== 'dine-in' ? reference.trim() : '',
      items: cart,
      paymentType,
      paymentAmount: total,
      cashTender,
      ...(selectedCustomer?._id ? { customerId: selectedCustomer._id } : {}),
      ...(selectedLoyaltyRewardId && selectedCustomer && loyaltyDiscountPoints > 0 && !deferPayment
        ? { loyaltyRewardId: selectedLoyaltyRewardId }
        : {}),
    });
    setPaymentModalOpen(false);
  };

  const sendTableTabOrder = () => {
    if (!canPlace) return;
    mutation.mutate({
      orderType,
      ...(orderType === 'dine-in' && tableMgmt && selectedTableId ? { tableId: selectedTableId } : {}),
      tableNumber: orderType === 'dine-in' && !tableMgmt ? tableNumber.trim() : '',
      reference: orderType !== 'dine-in' ? reference.trim() : '',
      items: cart,
      ...(selectedCustomer?._id ? { customerId: selectedCustomer._id } : {}),
      ...(selectedLoyaltyRewardId && selectedCustomer && loyaltyDiscountPoints > 0 && !deferPayment
        ? { loyaltyRewardId: selectedLoyaltyRewardId }
        : {}),
    });
  };

  const parsedReceiving = parseFloat(String(cashReceivedInput).replace(/,/g, ''));
  const receivingAmount = Number.isFinite(parsedReceiving) ? parsedReceiving : total;
  const cashChange =
    paymentType === 'cash' && receivingAmount >= total ? receivingAmount - total : null;
  const cashBalanceDue =
    paymentType === 'cash' && receivingAmount < total ? total - receivingAmount : null;

  return (
    <CashierSessionGate>
    <div className="h-screen flex flex-col bg-[var(--pos-surface-inset)]">
      <Navbar groups={CASHIER_NAV_GROUPS} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Menu */}
        <div className={`flex flex-col overflow-hidden border-slate-700/50 transition-all ${mobileCartOpen ? 'hidden' : 'flex-1 border-r'}`}>
          {/* Category tabs */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-slate-700/50 bg-[var(--pos-panel)]/50">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-[var(--pos-selection-text)] shadow-lg shadow-amber-500/20'
                    : 'text-slate-400 hover:text-[var(--pos-text-primary)] bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {menuLoading ? (
              <div className="p-1">
                <MenuGridSkeleton />
              </div>
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

        {/* Mobile floating cart button (hidden on md+) */}
        {!mobileCartOpen && (
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="md:hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white rounded-2xl px-4 py-3 shadow-xl shadow-amber-500/30 transition"
          >
            <ShoppingCart size={18} />
            <span className="font-semibold text-sm">
              {cart.reduce((s, i) => s + i.qty, 0)} items
            </span>
            <span className="font-bold text-sm">{formatPrice(total)}</span>
          </button>
        )}

        {/* Mobile cart backdrop */}
        {mobileCartOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/60"
            onClick={() => setMobileCartOpen(false)}
          />
        )}

        {/* Right: Cart — side panel on md+, bottom-sheet on mobile */}
        <div className={
          mobileCartOpen
            ? 'fixed inset-x-0 bottom-0 z-40 flex flex-col max-h-[90vh] rounded-t-2xl border-t border-slate-700/50 shadow-2xl bg-[var(--pos-panel)] overflow-hidden md:static md:max-h-none md:rounded-none md:border-t-0 md:shadow-none md:w-80 xl:w-96'
            : 'hidden md:flex md:flex-col bg-[var(--pos-panel)]/30 md:w-80 xl:w-96'
        }>
          <div className="p-4 border-b border-slate-700/50 flex items-center gap-2">
            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              className="md:hidden mr-1 p-1 rounded-lg text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/50 transition"
              aria-label="Close cart"
            >
              <ChevronLeft size={18} />
            </button>
            <ShoppingCart size={18} className="text-amber-400" />
            <h2 className="font-semibold text-[var(--pos-text-primary)]">Current Order</h2>
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
                      ? `${type.activeBg} text-[var(--pos-selection-text)] border-transparent shadow-lg`
                      : `bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:border-slate-600 hover:text-[var(--pos-text-primary)]`
                  }`}
                >
                  <span className="text-base">{type.icon}</span>
                  <span className="truncate">{type.label}</span>
                </button>
              ))}
            </div>

            {/* Conditional input */}
            {orderType === 'dine-in' && tableMgmt ? (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Table *</label>
                {!cafeTables.length ? (
                  <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                    No tables configured for this store. A manager can add tables under Manager → Café tables & QR after enabling table management.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {cafeTables
                      .filter((t) => t.active !== false)
                      .map((t) => {
                        const busy = occupancyByTable.has(String(t._id));
                        const sel = selectedTableId === String(t._id);
                        return (
                          <button
                            key={t._id}
                            type="button"
                            disabled={busy}
                            title={busy ? 'Table has an active order' : undefined}
                            onClick={() => setSelectedTableId(String(t._id))}
                            className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                              busy
                                ? 'border-slate-700 bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                : sel
                                  ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                  : 'border-slate-700 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] hover:border-slate-600'
                            }`}
                          >
                            {t.label}
                            {busy ? <span className="block text-[10px] text-slate-500 font-normal">In use</span> : null}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : orderType === 'dine-in' ? (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Table Number *</label>
                <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] rounded-xl border border-slate-700 focus-within:border-blue-500 px-3 py-2.5 transition">
                  <Hash size={14} className="text-slate-500" />
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    placeholder="e.g. 7"
                    className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{activeType.hint}</label>
                <div className={`flex items-center gap-2 bg-[var(--pos-surface-inset)] rounded-xl border border-slate-700 ${referenceFocusRing} px-3 py-2.5 transition`}>
                  <span className="text-sm">{activeType.icon}</span>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder={activeType.placeholder}
                    className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Customer & loyalty (optional) */}
          <div className="px-4 pb-3 space-y-3 border-b border-slate-700/40">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Customer (optional)</label>
              <div className="relative">
                <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] rounded-xl border border-slate-700 px-3 py-2">
                  <Search size={14} className="text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search name, email, mobile…"
                    className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600 min-w-0"
                  />
                </div>
                {searchQ.length >= 2 && customerHits.length > 0 && !selectedCustomer && (
                  <ul className="absolute left-0 right-0 top-full mt-1 z-[80] max-h-40 overflow-y-auto rounded-xl border border-slate-700 bg-[var(--pos-panel)] shadow-xl">
                    {customerHits.slice(0, 8).map((c) => (
                      <li key={c._id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch(c.name || c.email || c.mobile || '');
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800/80 border-b border-slate-800 last:border-0"
                        >
                          <span className="font-medium text-[var(--pos-text-primary)]">{c.name || 'Customer'}</span>
                          <span className="block text-slate-500 truncate">{c.email || c.mobile || ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!selectedCustomer && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowCustomerForm((v) => !v); setQuickFormError(''); }}
                    className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300"
                  >
                    <UserPlus size={13} />
                    {showCustomerForm ? 'Hide new customer' : 'New customer (optional)'}
                  </button>
                  {showCustomerForm && (
                    <div className="mt-2 space-y-2 rounded-xl border border-slate-700/80 bg-[var(--pos-panel)]/50 p-3">
                      <input
                        type="text"
                        value={quickName}
                        onChange={(e) => { setQuickName(e.target.value); setQuickFormError(''); }}
                        placeholder="Name"
                        className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-3 py-2 text-sm text-[var(--pos-text-primary)]"
                      />
                      <div>
                        <input
                          type="tel"
                          value={quickMobile}
                          onChange={(e) => { setQuickMobile(e.target.value); setQuickFormError(''); }}
                          placeholder={`Mobile (${branding.countryIso || 'LK'})`}
                          className={`w-full bg-[var(--pos-surface-inset)] border rounded-lg px-3 py-2 text-sm text-[var(--pos-text-primary)] ${
                            quickFormError && quickFormError.toLowerCase().includes('mobile')
                              ? 'border-red-500'
                              : 'border-slate-700'
                          }`}
                        />
                      </div>
                      <div>
                        <input
                          type="email"
                          value={quickEmail}
                          onChange={(e) => { setQuickEmail(e.target.value); setQuickFormError(''); }}
                          placeholder="Email"
                          className={`w-full bg-[var(--pos-surface-inset)] border rounded-lg px-3 py-2 text-sm text-[var(--pos-text-primary)] ${
                            quickFormError && quickFormError.toLowerCase().includes('email')
                              ? 'border-red-500'
                              : 'border-slate-700'
                          }`}
                        />
                      </div>
                      {quickFormError && (
                        <p className="text-xs text-red-400 leading-snug">{quickFormError}</p>
                      )}
                      <button
                        type="button"
                        disabled={upsertCustomerMutation.isPending}
                        onClick={() => {
                          const name = quickName.trim();
                          const mobile = quickMobile.trim();
                          const email = quickEmail.trim();
                          if (!name && !mobile && !email) {
                            showToast('Enter at least name, mobile, or email');
                            return;
                          }
                          const mobileErr = validateMobile(mobile, branding.countryIso || 'LK');
                          const emailErr = validateEmail(email);
                          if (mobileErr || emailErr) {
                            setQuickFormError(mobileErr || emailErr);
                            return;
                          }
                          setQuickFormError('');
                          upsertCustomerMutation.mutate({ name, mobile, email });
                        }}
                        className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold"
                      >
                        {upsertCustomerMutation.isPending ? 'Saving…' : 'Save & attach'}
                      </button>
                      <p className="text-[10px] text-slate-500 leading-snug">
                        If mobile or email matches an existing customer, that profile is used.
                      </p>
                    </div>
                  )}
                </>
              )}
              {selectedCustomer && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded-full px-2.5 py-1">
                    <User size={11} />
                    {customerLoyalty?.name || selectedCustomer.name || 'Customer'}
                    {customerLoyalty?.lifetimePoints != null && (
                      <span className="text-sky-200/90">
                        · {customerLoyalty.lifetimePoints} pts
                        {customerLoyalty?.loyalty?.effectiveTier?.name && (
                          <> · {customerLoyalty.loyalty.effectiveTier.name}</>
                        )}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                      setSelectedLoyaltyRewardId('');
                      setShowCustomerForm(false);
                      setQuickName('');
                      setQuickMobile('');
                      setQuickEmail('');
                    }}
                    className="text-xs text-slate-500 hover:text-red-400"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {loyaltyConfig?.isEnabled !== false && selectedCustomer && cart.length > 0 && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
                  <Gift size={12} className="text-amber-400" />
                  Loyalty reward (optional)
                </label>
                {deferPayment && (
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Point rewards are not available for pay-at-checkout table tabs — remove the reward or use a non-managed table number.
                  </p>
                )}
                <select
                  value={selectedLoyaltyRewardId}
                  onChange={(e) => setSelectedLoyaltyRewardId(e.target.value)}
                  disabled={deferPayment}
                  className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 rounded-xl px-3 py-2 text-sm text-[var(--pos-text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">None — earn points when order completes</option>
                  {redeemableLoyaltyRewards.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.name} ({r.pointsCost} pts)
                      {r.minTierLevel > 1 ? ` · tier ${r.minTierLevel}+` : ''}
                    </option>
                  ))}
                </select>
                {selectedLoyaltyRewardId && loyaltyDiscountPoints <= 0 && (
                  <p className="text-[11px] text-amber-400/90 mt-1">
                    Cannot apply this reward (tier, points, or cart does not qualify).
                  </p>
                )}
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
            <div className="px-4 py-3 border-t border-slate-700/50 bg-[var(--pos-panel)]/20">
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
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/70'
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
              {automaticLoyaltyDiscount > 0 && (
                <div className="flex justify-between text-sky-400">
                  <span className="flex items-center gap-1 truncate text-xs">
                    <Gift size={9} className="flex-shrink-0" />
                    Member savings
                  </span>
                  <span>-{formatPrice(automaticLoyaltyDiscount)}</span>
                </div>
              )}
              {loyaltyDiscountPoints > 0 && (
                <div className="flex justify-between text-purple-400">
                  <span className="flex items-center gap-1 truncate text-xs">
                    <Gift size={9} className="flex-shrink-0" />
                    Points reward
                  </span>
                  <span>-{formatPrice(loyaltyDiscountPoints)}</span>
                </div>
              )}
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
              <div className="flex justify-between text-[var(--pos-text-primary)] font-bold text-base pt-1 border-t border-slate-700/50">
                <span>Total</span><span className="text-amber-400">{formatPrice(total)}</span>
              </div>
            </div>
            <button
              onClick={() => {
                if (!canPlace) return;
                if (deferPayment) {
                  sendTableTabOrder();
                  return;
                }
                setPaymentType(availablePaymentMethods[0] || 'cash');
                setPaymentModalOpen(true);
              }}
              disabled={!canPlace || mutation.isPending}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-green-500/20 text-sm mt-1"
            >
              {mutation.isPending
                ? 'Placing Order...'
                : deferPayment
                  ? 'Send to kitchen (pay at checkout)'
                  : 'Place Order'}
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
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[var(--pos-panel)] border border-slate-600/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/50 max-h-[92vh] overflow-y-auto">
            <h3 className="text-[var(--pos-text-primary)] font-bold text-xl sm:text-2xl tracking-tight">Collect payment</h3>
            <p className="text-sm text-slate-400 mt-2">Choose a method and confirm. Large tap targets for counter use.</p>

            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-6 mb-2">Payment method</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availablePaymentMethods.map((method) => {
                const label = method.replace(/_/g, ' ');
                const pretty = label.charAt(0).toUpperCase() + label.slice(1);
                const active = paymentType === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setPaymentType(method);
                      if (method === 'cash') setCashReceivedInput(total.toFixed(2));
                    }}
                    className={`min-h-[52px] rounded-2xl px-4 text-base font-semibold border-2 transition active:scale-[0.99] ${
                      active
                        ? 'border-amber-500 bg-amber-500/15 text-[var(--pos-selection-text)] ring-2 ring-amber-500/40'
                        : 'border-slate-600 bg-[var(--pos-surface-inset)] text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {pretty}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl bg-[var(--pos-surface-inset)] border border-slate-700 p-4 space-y-3">
              <div className="flex justify-between items-baseline gap-3 text-slate-400 text-base">
                <span>Order total</span>
                <span className="text-[var(--pos-text-primary)] font-bold text-xl tabular-nums">{formatPrice(total)}</span>
              </div>

              {paymentType === 'cash' && (
                <div className="pt-2 border-t border-slate-700/80 space-y-3">
                  <label className="block text-sm font-semibold text-slate-300">Amount received</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashReceivedInput}
                    onChange={(e) => setCashReceivedInput(e.target.value)}
                    className="w-full min-h-[56px] rounded-2xl border-2 border-slate-600 bg-slate-900/80 text-[var(--pos-text-primary)] text-2xl font-bold text-center tracking-wide px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 tabular-nums"
                    placeholder={total.toFixed(2)}
                    autoComplete="off"
                  />
                  {cashChange != null && (
                    <div className="flex justify-between items-center text-lg bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
                      <span className="text-green-300 font-medium">Change due</span>
                      <span className="text-green-400 font-bold text-xl tabular-nums">{formatPrice(cashChange)}</span>
                    </div>
                  )}
                  {cashBalanceDue != null && (
                    <div className="flex justify-between items-center text-lg bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                      <span className="text-amber-200 font-medium">Balance due</span>
                      <span className="text-amber-300 font-bold text-xl tabular-nums">{formatPrice(cashBalanceDue)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 min-h-[54px] rounded-2xl border-2 border-slate-600 text-slate-200 text-lg font-semibold hover:bg-slate-800/80 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={placeOrder}
                disabled={mutation.isPending}
                className="flex-1 min-h-[54px] rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white text-lg font-bold shadow-lg shadow-green-500/25 transition"
              >
                {mutation.isPending ? 'Processing…' : 'Confirm & print'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CashierSessionGate>
  );
}
