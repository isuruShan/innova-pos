import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, Plus, Minus, Trash2, Hash, Link2, ChevronDown, ChevronUp,
  Tag, ToggleLeft, ToggleRight, X, Zap, Search, User, Gift, ChevronLeft, ChevronRight,
  AlertTriangle, Monitor,
} from 'lucide-react';
import { getPublicWebUrl } from '@innovapos/app-urls';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import OfflineBanner from '../../components/OfflineBanner';
import CashierSessionGate from '../../components/cashier/CashierSessionGate';
import CollectPaymentModal from '../../components/cashier/CollectPaymentModal';
import CashierDraftTabs from '../../components/cashier/CashierDraftTabs';
import { useCashierDraftOrders } from '../../context/CashierDraftOrdersContext';
import { useFohrMode } from '../../hooks/useFohrMode';
import { CASHIER_SESSION_QUERY_KEY } from '../../components/cashier/cashierSessionContext';
import OrderTypeBadge, { ORDER_TYPES, ORDER_TYPE_MAP } from '../../components/OrderTypeBadge';
import OrderDetailSlideOver from '../../components/OrderDetailSlideOver';
import OptionPickerModal, { TablePickerModal, CustomerPickerModal } from '../../components/OptionPickerModal';
import { mergeOrderLists } from '../../offline/mergeOrders.js';
import { listPendingOrders } from '../../offline/idb.js';
import { resolveLiveOrder, useSyncOfflineOrderSelection } from '../../offline/orderSelection.js';
import { formatCurrency } from '../../utils/format';
import { compareSortValues, buildCategorySortMap, buildCategoryTabs, resolveMenuDisplayItems } from '../../utils/menuItemSearch';
import { useBranding } from '../../context/BrandingContext';
import { useStoreContext } from '../../context/StoreContext';
import { MenuGridSkeleton } from '../../components/StoreSkeletons';
import { printReceipt } from '../../utils/receiptPrint';
import { shouldPrintReceiptOnOrderCreated } from '../../utils/receiptPolicy';
import { validateMobile, validateEmail } from '../../utils/customerValidation';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuth } from '../../context/AuthContext';
import useSwipeDismiss from '../../hooks/useSwipeDismiss';
import MobileBottomBar from '../../components/cashier/MobileBottomBar';

const formatPrice = formatCurrency;

// Normalize any value to a comparable string (handles ObjectId, string, null)
const sid = (v) => (v == null ? '' : v.toString());

/** Mirror of server/src/utils/applyPromotions.js — supports applicableCategories and variants */
function inScope(item, promo) {
  const ids  = promo.applicableItems || [];
  const cats = promo.applicableCategories || [];
  const varIds = promo.applicableVariantIds || [];

  if (!ids.length && !cats.length) return true;
  if (item.category && cats.includes(item.category)) return true;

  // Check item ID with optional variant matching
  for (let i = 0; i < ids.length; i++) {
    if (sid(ids[i]) === sid(item.menuItem)) {
      const targetVarId = varIds[i];
      // Match if no variant specified OR variant IDs match
      if (!targetVarId || sid(targetVarId) === sid(item.variantId)) {
        return true;
      }
    }
  }
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
          const ci = cart.find(i => {
            const itemMatch = sid(i.menuItem) === sid(bi.menuItem);
            const variantMatch = !bi.variantId || sid(i.variantId) === sid(bi.variantId);
            return itemMatch && variantMatch;
          });
          return ci ? Math.floor(ci.qty / bi.qty) : 0;
        }));
        if (times <= 0) break;
        const normal = validItems.reduce((s, bi) => {
          const ci = cart.find(i => {
            const itemMatch = sid(i.menuItem) === sid(bi.menuItem);
            const variantMatch = !bi.variantId || sid(i.variantId) === sid(bi.variantId);
            return itemMatch && variantMatch;
          });
          return s + (ci ? ci.price * bi.qty : 0);
        }, 0);
        disc = Math.max(0, (normal - promo.bundlePrice) * times);
        break;
      }
      case 'buyXgetY': {
        if (!promo.buyItem || !promo.getFreeItem) break;
        const buy = cart.find(i => {
          const itemMatch = sid(i.menuItem) === sid(promo.buyItem);
          const variantMatch = !promo.buyVariantId || sid(i.variantId) === sid(promo.buyVariantId);
          return itemMatch && variantMatch;
        });
        const free = cart.find(i => {
          const itemMatch = sid(i.menuItem) === sid(promo.getFreeItem);
          const variantMatch = !promo.getFreeVariantId || sid(i.variantId) === sid(promo.getFreeVariantId);
          return itemMatch && variantMatch;
        });
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

/** IDs of cart items that a promotion "touches" (covers). 
 * Returns composite keys: "menuItemId:variantId" for proper variant-level tracking.
 */
function getPromoTouchedItemIds(promo, cart) {
  const makeKey = (item) => `${sid(item.menuItem)}:${sid(item.variantId || '')}`;
  
  switch (promo.type) {
    case 'bundle': {
      const touched = new Set();
      (promo.bundleItems || []).forEach(bi => {
        if (!bi.menuItem) return;
        const cartItem = cart.find(i => {
          const itemMatch = sid(i.menuItem) === sid(bi.menuItem);
          const variantMatch = !bi.variantId || sid(i.variantId) === sid(bi.variantId);
          return itemMatch && variantMatch;
        });
        if (cartItem) touched.add(makeKey(cartItem));
      });
      return touched;
    }
    case 'buyXgetY': {
      const touched = new Set();
      // Check buy item with variant
      const buyItem = cart.find(i => {
        const itemMatch = sid(i.menuItem) === sid(promo.buyItem);
        const variantMatch = !promo.buyVariantId || sid(i.variantId) === sid(promo.buyVariantId);
        return itemMatch && variantMatch;
      });
      if (buyItem) touched.add(makeKey(buyItem));
      // Check free item with variant
      const freeItem = cart.find(i => {
        const itemMatch = sid(i.menuItem) === sid(promo.getFreeItem);
        const variantMatch = !promo.getFreeVariantId || sid(i.variantId) === sid(promo.getFreeVariantId);
        return itemMatch && variantMatch;
      });
      if (freeItem) touched.add(makeKey(freeItem));
      return touched;
    }
    default: {
      // flatPrice, flatDiscount, percentageDiscount - use inScope which now checks variants
      const ids  = promo.applicableItems || [];
      const cats = promo.applicableCategories || [];
      const hasScope = ids.length > 0 || cats.length > 0;
      
      if (!hasScope) {
        // Applies to whole order - touch all cart items
        return new Set(cart.map(makeKey));
      }
      // Filter by inScope which properly checks variants
      return new Set(
        cart.filter(i => inScope(i, promo)).map(makeKey)
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
  const ids = reward.applicableItems || [];
  const cats = reward.applicableCategories || [];
  const varIds = reward.applicableVariantIds || [];
  
  if (!ids.length && !cats.length) return true;
  if (item.category && cats.includes(item.category)) return true;
  
  // Check item ID with optional variant matching
  for (let i = 0; i < ids.length; i++) {
    if (sid(ids[i]) === sid(item.menuItem)) {
      const targetVarId = varIds[i];
      // Match if no variant specified OR variant IDs match
      if (!targetVarId || sid(targetVarId) === sid(item.variantId)) {
        return true;
      }
    }
  }
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


function MenuCard({ item, onAdd, compact = false }) {
  const imageUrl = item.images?.[0]?.url || item.image;
  
  // Get display price: use default variant price if set, otherwise show "from" lowest price
  let displayPrice = item.price;
  let hasMultipleVariants = false;
  let pricePrefix = '';
  
  if (item.hasVariants && item.variants?.length > 0) {
    hasMultipleVariants = true;
    const availableVariants = item.variants.filter(v => v.available !== false);
    if (availableVariants.length > 0) {
      // Check for default variant
      const defaultVariant = item.defaultVariantId 
        ? availableVariants.find(v => String(v._id) === String(item.defaultVariantId))
        : null;
      
      if (defaultVariant) {
        displayPrice = defaultVariant.price;
      } else {
        // Show lowest price with "from" prefix
        const prices = availableVariants.map(v => Number(v.price)).filter(p => !isNaN(p));
        displayPrice = Math.min(...prices);
        pricePrefix = 'from ';
      }
    }
  }

  return (
    <button
      onClick={() => onAdd(item)}
      disabled={!item.available}
      className={`bg-[var(--pos-panel)] overflow-hidden border hover:shadow-lg transition group disabled:opacity-40 disabled:cursor-not-allowed text-left w-full ${
        compact ? 'rounded-xl' : 'rounded-2xl'
      } ${
        item.isCombo
          ? 'border-amber-500/30 hover:border-amber-500/60 hover:shadow-amber-500/10'
          : 'border-slate-700/50 hover:border-amber-500/50 hover:shadow-amber-500/5'
      }`}
    >
      <div className={`relative bg-slate-800 overflow-hidden ${compact ? 'h-20' : 'h-28'}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${compact ? 'text-2xl' : 'text-4xl'}`}>
            {item.isCombo ? '🍱' : '🍔'}
          </div>
        )}
        {/* Tags container - left top */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {item.isCombo && (
            <span className="flex items-center gap-0.5 bg-amber-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              <Link2 size={8} />{compact ? '' : ' Combo'}
            </span>
          )}
          {hasMultipleVariants && (
            <span className="bg-sky-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              {item.variants.length} options
            </span>
          )}
        </div>
        {!item.available && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-xs text-red-400 font-semibold bg-red-500/20 border border-red-500/30 rounded-full px-2 py-0.5">Unavailable</span>
          </div>
        )}
      </div>
      <div className={compact ? 'px-2 py-1.5' : 'p-3'}>
        <p className={`font-semibold text-[var(--pos-text-primary)] truncate leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>{item.name}</p>
        {!compact && item.isCombo && item.comboItems?.length > 0 && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {item.comboItems.map(c => c.name).join(' + ')}
          </p>
        )}
        <p className={`text-amber-400 font-bold ${compact ? 'text-[11px] mt-0.5' : 'mt-0.5'}`}>
          {pricePrefix && <span className="text-slate-500 font-normal text-[10px]">{pricePrefix}</span>}
          {formatPrice(displayPrice)}
        </p>
      </div>
    </button>
  );
}

function CartItem({ item, onChangeQty, showImage = false, isWarning = false }) {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = item.images?.[0]?.url || item.image;
  return (
    <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3">
      <div className="flex items-center gap-3">
        {showImage && (
          <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0 border border-slate-700">
            {imageUrl ? (
              <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-base">
                {item.isCombo ? '🍱' : '🍔'}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-[var(--pos-text-primary)] truncate">{item.name}</p>
            {isWarning && (
              <span className="text-red-400 flex-shrink-0 cursor-help" title="No channel price override set. Falling back to default price.">
                <AlertTriangle size={14} className="animate-pulse" />
              </span>
            )}
            {item.isCombo && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-amber-400/70 hover:text-amber-400 flex-shrink-0"
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
          {item.variantName && (
            <p className="text-xs text-amber-400/95 font-medium mt-0.5 truncate">↳ {item.variantName}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">{formatPrice(item.price)} each</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChangeQty(item.menuItem, item.variantId, -1)}
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-400 flex items-center justify-center transition"
          >
            <Minus size={11} />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-[var(--pos-text-primary)]">{item.qty}</span>
          <button
            onClick={() => onChangeQty(item.menuItem, item.variantId, 1)}
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

function VariantSelectorModal({ item, onClose, onConfirm }) {
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
    if (!v.available) return false;
    return options.every((opt) => selections[opt.name] === v.attributes?.find((a) => a.name === opt.name)?.value);
  });

  const canConfirm = options.every((opt) => selections[opt.name] !== undefined);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--pos-panel)] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--pos-text-primary)]">{item.name}</h3>
            <p className="text-xs text-slate-500">Please choose options</p>
          </div>
          <button onClick={onClose} className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {options.map((opt) => (
            <div key={opt.name} className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{opt.name}</span>
              <div className="flex flex-wrap gap-2">
                {opt.values?.map((val) => {
                  const active = selections[opt.name] === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleSelect(opt.name, val)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                        active
                          ? 'bg-amber-500 border-amber-500 text-[var(--pos-selection-text)] shadow-lg'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {selectedVariant ? (
          <div className="bg-[var(--pos-surface-inset)] rounded-xl p-3 border border-slate-800 flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shrink-0">
              {selectedVariant.image ? (
                <img src={selectedVariant.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
              ) : item.images?.[0]?.url || item.image ? (
                <img src={item.images?.[0]?.url || item.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">🍔</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{selectedVariant.name}</p>
              <p className="text-xs text-slate-500 truncate">{selectedVariant.description || item.description || 'No description'}</p>
            </div>
            <span className="text-sm font-bold text-amber-400 shrink-0">
              {formatPrice(selectedVariant.price)}
            </span>
          </div>
        ) : (
          canConfirm && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
              Selected combination is currently unavailable
            </div>
          )
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold py-2.5 rounded-xl transition text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(item, selectedVariant)}
            disabled={!selectedVariant}
            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm flex justify-center items-center"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NewOrder() {
  const fohr = useFohrMode();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [variantSelectionItem, setVariantSelectionItem] = useState(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { bind: cartBind } = useSwipeDismiss({
    onClose: () => setMobileCartOpen(false),
    open: mobileCartOpen,
  });
  const hasBottomBar = user?.tenantId && (user?.role === 'cashier' || user?.role === 'manager');
  const [showOrderTypePicker, setShowOrderTypePicker] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [showPromoList, setShowPromoList] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [readySlideOrder, setReadySlideOrder] = useState(null);

  const qc = useQueryClient();
  const branding = useBranding();
  const { stores, selectedStoreId, isStoreReady } = useStoreContext();
  const online = useOnlineStatus();
  const selectedStore =
    stores.find((s) => String(s._id) === String(selectedStoreId)) || stores.find((s) => s.isDefault) || null;

  const {
    activeDraft,
    patchActiveDraft,
    drafts,
    activeDraftId,
    selectDraft,
    addDraft,
    removeDraft,
    clearActiveDraftAfterSubmit,
  } = useCashierDraftOrders(selectedStoreId);

  const cart = activeDraft.cart;
  const orderType = activeDraft.orderType;
  const tableNumber = activeDraft.tableNumber;
  const selectedTableId = activeDraft.selectedTableId;
  const reference = activeDraft.reference;
  const selectedCustomer = activeDraft.selectedCustomer;
  const customerSearch = activeDraft.customerSearch;
  const selectedPromoIds = activeDraft.selectedPromoIds;
  const autoApply = activeDraft.autoApply;
  const selectedLoyaltyRewardId = activeDraft.selectedLoyaltyRewardId;

  const patchField = useCallback((field, value) => {
    patchActiveDraft((d) => ({
      [field]: typeof value === 'function' ? value(d[field]) : value,
    }));
  }, [patchActiveDraft]);

  const setCart = useCallback((value) => patchField('cart', value), [patchField]);
  const setOrderType = useCallback((value) => patchField('orderType', value), [patchField]);
  const setTableNumber = useCallback((value) => patchField('tableNumber', value), [patchField]);
  const setSelectedTableId = useCallback((value) => patchField('selectedTableId', value), [patchField]);
  const setReference = useCallback((value) => patchField('reference', value), [patchField]);
  const setSelectedCustomer = useCallback((value) => patchField('selectedCustomer', value), [patchField]);
  const setCustomerSearch = useCallback((value) => patchField('customerSearch', value), [patchField]);
  const setSelectedPromoIds = useCallback((value) => patchField('selectedPromoIds', value), [patchField]);
  const setAutoApply = useCallback((value) => patchField('autoApply', value), [patchField]);
  const setSelectedLoyaltyRewardId = useCallback((value) => patchField('selectedLoyaltyRewardId', value), [patchField]);

  const clearCurrentDraft = useCallback(() => {
    patchActiveDraft({
      cart: [],
      tableNumber: '',
      selectedTableId: '',
      reference: '',
      selectedCustomer: null,
      customerSearch: '',
      selectedPromoIds: [],
      selectedLoyaltyRewardId: '',
    });
  }, [patchActiveDraft]);

  const tableMgmt = selectedStore?.tableManagementEnabled === true;
  const posMenuLayout = selectedStore?.posMenuLayout || 'default';
  const isCompact = posMenuLayout === 'compact';
  const deferPayment = tableMgmt && orderType === 'dine-in';
  const availablePaymentMethods = (selectedStore?.paymentMethods?.length ? selectedStore.paymentMethods : ['cash']);

  useEffect(() => {
    if (deferPayment) setSelectedLoyaltyRewardId('');
  }, [deferPayment]);

  const prevStoreRef = useRef(selectedStoreId);
  useEffect(() => {
    if (prevStoreRef.current && prevStoreRef.current !== selectedStoreId) {
      setShowPromoList(false);
      setActiveCategory('All');
      setMenuSearch('');
      setReadySlideOrder(null);
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

  const { data: categoryRows = [] } = useQuery({
    queryKey: ['categories', selectedStoreId],
    queryFn: () => api.get('/categories').then((r) => r.data),
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

  const { data: readyOrders = [] } = useQuery({
    queryKey: ['cashier-ready-orders', selectedStoreId],
    queryFn: async () => {
      const remote = await api.get('/orders?status=ready').then((r) => r.data);
      const pendingLocal = await listPendingOrders();
      const merged = mergeOrderLists(remote, pendingLocal, selectedStoreId);
      return merged.filter((o) => o.status === 'ready');
    },
    enabled: isStoreReady,
    refetchInterval: 6_000,
  });

  const liveReadyOrder = useMemo(
    () => resolveLiveOrder(readyOrders, readySlideOrder),
    [readyOrders, readySlideOrder],
  );
  useSyncOfflineOrderSelection(readyOrders, readySlideOrder, setReadySlideOrder);

  useEffect(() => {
    const bump = () => {
      qc.invalidateQueries({ queryKey: ['cashier-ready-orders'] });
      qc.invalidateQueries({ queryKey: ['order-board'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
    };
    window.addEventListener('pos-offline-sync-done', bump);
    window.addEventListener('pos-offline-queue', bump);
    return () => {
      window.removeEventListener('pos-offline-sync-done', bump);
      window.removeEventListener('pos-offline-queue', bump);
    };
  }, [qc]);


  const { data: paidAddons } = useQuery({
    queryKey: ['tenant-paid-addons'],
    queryFn: () => api.get('/tenant/paid-addons').then((r) => r.data),
    enabled: isStoreReady,
    staleTime: 60_000,
  });
  const loyaltyAddonActive = paidAddons?.loyalty === true;

  const { data: loyaltyConfig } = useQuery({
    queryKey: ['loyalty-config'],
    queryFn: () => api.get('/loyalty/config').then((r) => r.data),
    enabled: isStoreReady && loyaltyAddonActive,
    staleTime: 60_000,
  });

  const { data: loyaltyRewardsRaw = [] } = useQuery({
    queryKey: ['loyalty-rewards-co', selectedStoreId],
    queryFn: () => api.get('/loyalty/rewards').then((r) => r.data),
    enabled: isStoreReady && loyaltyAddonActive,
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
    enabled: isStoreReady && loyaltyAddonActive && !!selectedCustomer?._id,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['foodmarket-partners'],
    queryFn: () => api.get('/foodmarket-partners').then((r) => r.data),
    enabled: isStoreReady,
  });

  const getPartnerForOrderType = (type, partnerList) => {
    if (type === 'uber-eats') {
      return partnerList.find(p => p.isActive && p.name?.toLowerCase().includes('uber'));
    }
    if (type === 'pickme') {
      return partnerList.find(p => p.isActive && (p.name?.toLowerCase().includes('pickme') || p.name?.toLowerCase().includes('pick me')));
    }
    return null;
  };

  const getItemPrice = (menuItem, variant, type, partnerList) => {
    const partner = getPartnerForOrderType(type, partnerList);
    if (partner) {
      const channelPrices = menuItem.channelPrices || {};
      const override = channelPrices[partner._id];
      if (override) {
        if (variant) {
          const vOverride = override.variants?.[variant._id];
          if (vOverride != null && vOverride !== '') {
            return Math.round(Number(vOverride) * 100) / 100;
          }
        } else if (override.price != null && override.price !== '') {
          return Math.round(Number(override.price) * 100) / 100;
        }
      }
    }
    return variant ? Math.round(Number(variant.price) * 100) / 100 : Math.round(Number(menuItem.price) * 100) / 100;
  };

  const isMissingPartnerPrice = (menuItem, variant, type, partnerList) => {
    const partner = getPartnerForOrderType(type, partnerList);
    if (!partner) return false;
    const channelPrices = menuItem.channelPrices || {};
    const override = channelPrices[partner._id];
    if (!override) return true;
    if (variant) {
      const vOverride = override.variants?.[variant._id];
      return vOverride == null || vOverride === '';
    }
    return override.price == null || override.price === '';
  };

  const promoTierLevel =
    selectedCustomer?._id != null ? customerLoyalty?.loyalty?.effectiveTier?.level ?? null : null;

  const activePromosForCart = useMemo(() => {
    return activePromos.filter((p) => {
      const min = p.minTierLevel;
      if (min != null && Number(min) > 0 && !loyaltyAddonActive) return false;
      if (min == null || Number(min) <= 0) return true;
      if (promoTierLevel == null) return false;
      return Number(promoTierLevel) >= Number(min);
    });
  }, [activePromos, promoTierLevel, loyaltyAddonActive]);

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
      const isOfflineOrder = createdOrder?._offlinePending === true;
      
      console.log('[Order Placement] Success:', { isOfflineOrder, order: createdOrder });
      
      // Invalidate queries - React Query handles offline gracefully
      qc.invalidateQueries({ queryKey: [CASHIER_SESSION_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ['order-board'] });
      qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
      qc.invalidateQueries({ queryKey: ['cashier-ready-orders'] });
      qc.invalidateQueries({ queryKey: ['customer-loyalty'] });
      qc.invalidateQueries({ queryKey: ['customers-search'] });
      
      clearActiveDraftAfterSubmit();
      setShowPromoList(false);
      
      // Show success message
      const msg = isOfflineOrder 
        ? 'Order saved offline. Will sync when online.'
        : 'Order placed successfully!';
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), isOfflineOrder ? 4000 : 3000);
      
      // Print receipt (skip for offline orders to avoid popup blocker issues)
      if (
        createdOrder &&
        !isOfflineOrder &&
        shouldPrintReceiptOnOrderCreated(branding, createdOrder) &&
        createdOrder.paymentCollected !== false
      ) {
        try {
          printReceipt(createdOrder, {
            branding,
            store: selectedStore,
            paymentType: variables?.paymentType,
            cashTender: variables?.cashTender,
          });
        } catch (err) {
          console.warn('[Receipt Print] Failed:', err);
          // Don't block order placement if printing fails
        }
      }
    },
    onError: (error) => {
      console.error('[Order Placement] Failed:', error);
      // Error will be shown via mutation.error in UI
    },
    onSettled: () => {
      console.log('[Order Placement] Settled, closing modal');
      // Always close payment modal when mutation completes (success or error)
      setPaymentModalOpen(false);
    },
  });

  const categorySortMap = useMemo(
    () => buildCategorySortMap(categoryRows),
    [categoryRows],
  );

  const categories = useMemo(
    () => buildCategoryTabs(categoryRows, menuItems),
    [categoryRows, menuItems],
  );

  const filtered = useMemo(
    () => resolveMenuDisplayItems(menuItems, {
      activeCategory,
      menuSearch,
      categorySortMap,
    }),
    [menuItems, activeCategory, menuSearch, categorySortMap],
  );

  const addToCart = (item, selectedVariant = null) => {
    if (item.hasVariants && !selectedVariant) {
       setVariantSelectionItem(item);
       return;
     }

    const price = getItemPrice(item, selectedVariant, orderType, partners);
    const variantId = selectedVariant ? selectedVariant._id : null;
    const variantName = selectedVariant ? selectedVariant.name : '';
    const variantAttributes = selectedVariant ? selectedVariant.attributes || [] : [];
    const images = selectedVariant?.images?.length ? selectedVariant.images : item.images || [];
    const image = selectedVariant?.image || item.image || '';

    setCart(prev => {
      const existing = prev.find(c => c.menuItem === item._id && c.variantId === variantId);
      if (existing) {
        return prev.map(c => (c.menuItem === item._id && c.variantId === variantId) ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, {
        menuItem: item._id,
        variantId,
        variantName,
        variantAttributes,
        name: item.name,
        price,
        qty: 1,
        category: item.category || '',
        isCombo: item.isCombo || false,
        comboItems: item.comboItems || [],
        images,
        image,
      }];
    });
    setVariantSelectionItem(null);
  };

  const changeQty = (id, variantId, delta) => {
    setCart(prev => prev
      .map(c => (c.menuItem === id && c.variantId === variantId) ? { ...c, qty: c.qty + delta } : c)
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
    if (!loyaltyAddonActive || !selectedCustomer || loyaltyConfig?.isEnabled === false || !automaticLoyaltyRewards.length) return 0;
    let remaining = Math.max(0, subtotal - promoDiscountOnly);
    let total = 0;
    const sorted = [...automaticLoyaltyRewards].sort((a, b) =>
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')),
    );
    for (const reward of sorted) {
      const tierLv = Number(customerLoyalty?.loyalty?.effectiveTier?.level ?? 1);
      if (reward.minTierLevel != null && tierLv < reward.minTierLevel) continue;
      const d = computeLoyaltyRewardDiscount(reward, cart, remaining);
      if (d <= 0) continue;
      remaining -= d;
      total += d;
    }
    return Math.round(total * 100) / 100;
  }, [
    selectedCustomer,
    loyaltyAddonActive,
    loyaltyConfig?.isEnabled,
    automaticLoyaltyRewards,
    customerLoyalty,
    cart,
    subtotal,
    promoDiscountOnly,
  ]);

  const loyaltyDiscountPoints = useMemo(() => {
    if (!loyaltyAddonActive || !selectedLoyaltyRewardId || !selectedCustomer || loyaltyConfig?.isEnabled === false) return 0;
    const reward = redeemableLoyaltyRewards.find((r) => sid(r._id) === sid(selectedLoyaltyRewardId));
    if (!reward) return 0;
    const tierLv = Number(customerLoyalty?.loyalty?.effectiveTier?.level ?? 1);
    if (reward.minTierLevel != null && tierLv < reward.minTierLevel) return 0;
    const pts = Number(customerLoyalty?.lifetimePoints ?? selectedCustomer?.lifetimePoints ?? 0);
    if (pts < Number(reward.pointsCost || 0)) return 0;
    const afterPromoAndAuto = Math.max(0, subtotal - promoDiscountOnly - automaticLoyaltyDiscount);
    return computeLoyaltyRewardDiscount(reward, cart, afterPromoAndAuto);
  }, [
    loyaltyAddonActive,
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

  const canPlace =
    cart.length > 0 &&
    (orderType !== 'dine-in' || !tableMgmt || Boolean(selectedTableId));

  const nonDineInReference =
    orderType === 'takeaway' ? customerSearch.trim() : reference.trim();

  const handlePaymentConfirm = ({ paymentType, paymentAmount, cashTender }) => {
    if (!canPlace) return;
    mutation.mutate({
      orderType,
      ...(orderType === 'dine-in' && tableMgmt && selectedTableId ? { tableId: selectedTableId } : {}),
      tableNumber: orderType === 'dine-in' && !tableMgmt ? tableNumber.trim() : '',
      reference: orderType !== 'dine-in' ? nonDineInReference : '',
      items: cart,
      paymentType,
      paymentAmount,
      cashTender,
      ...(selectedCustomer?._id ? { customerId: selectedCustomer._id } : {}),
      ...(selectedLoyaltyRewardId && selectedCustomer && loyaltyDiscountPoints > 0 && !deferPayment
        ? { loyaltyRewardId: selectedLoyaltyRewardId }
        : {}),
      customerSessionId: activeDraft.customerSessionId,
    });
  };

  const sendTableTabOrder = () => {
    if (!canPlace) return;
    mutation.mutate({
      orderType,
      ...(orderType === 'dine-in' && tableMgmt && selectedTableId ? { tableId: selectedTableId } : {}),
      tableNumber: orderType === 'dine-in' && !tableMgmt ? tableNumber.trim() : '',
      reference: orderType !== 'dine-in' ? nonDineInReference : '',
      items: cart,
      ...(selectedCustomer?._id ? { customerId: selectedCustomer._id } : {}),
      ...(selectedLoyaltyRewardId && selectedCustomer && loyaltyDiscountPoints > 0 && !deferPayment
        ? { loyaltyRewardId: selectedLoyaltyRewardId }
        : {}),
      customerSessionId: activeDraft.customerSessionId,
    });
  };

  const tableLabelByDraftId = useMemo(() => {
    const map = {};
    for (const draft of drafts) {
      if (draft.selectedTableId) {
        const table = cafeTables.find((t) => String(t._id) === String(draft.selectedTableId));
        if (table?.label) map[draft.id] = table.label;
      }
    }
    return map;
  }, [drafts, cafeTables]);

  // Broadcast order updates to dual monitor screen
  useEffect(() => {
    const channel = new BroadcastChannel('pos-dual-monitor');
    channel.postMessage({
      type: 'ORDER_UPDATE',
      payload: {
        items: cart,
        subtotal,
        taxAmount,
        totalAmount: total,
        discountTotal,
        serviceFeeAmount,
        customerSessionId: activeDraft.customerSessionId,
        selectedCustomer,
        tenantId: user?.tenantId || branding.tenantId || branding._id || '',
        storeId: selectedStoreId || '',
      }
    });

    const onChannelMessage = (e) => {
      if (e.data.type === 'CUSTOMER_CHECKED_IN_DIRECT') {
        const { sessionId, customer } = e.data.payload || {};
        if (customer) {
          console.log('[BroadcastChannel] Received customer details directly from terminal payload:', customer);
          setSelectedCustomer(customer);
          setCustomerSearch(customer.name || customer.mobile || '');
          qc.invalidateQueries({ queryKey: ['customers-search'] });
          qc.invalidateQueries({ queryKey: ['customer-loyalty'] });
          showToast(`User ${customer.name} added to the order!`);
        } else if (sessionId) {
          // Fallback to fetch from backend if customer was not included
          api.get(`/customer-checkin/session-status/${sessionId}`)
            .then(({ data }) => {
              if (data && data.customer) {
                console.log('[BroadcastChannel] Loaded customer details via session-status fallback:', data.customer);
                setSelectedCustomer(data.customer);
                setCustomerSearch(data.customer.name || data.customer.mobile || '');
                qc.invalidateQueries({ queryKey: ['customers-search'] });
                qc.invalidateQueries({ queryKey: ['customer-loyalty'] });
                showToast(`User ${data.customer.name} added to the order!`);
              }
            })
            .catch(err => {
              console.error('[BroadcastChannel] Failed to load customer details:', err);
            });
        }
      }
    };
    channel.addEventListener('message', onChannelMessage);

    return () => {
      channel.removeEventListener('message', onChannelMessage);
      channel.close();
    };
  }, [cart, subtotal, taxAmount, total, discountTotal, serviceFeeAmount, activeDraft.customerSessionId, selectedCustomer, user?.tenantId, branding.tenantId, branding._id, selectedStoreId]);

  // SSE listener for customer check-in events (separate effect to avoid reconnection on cart changes)
  useEffect(() => {
    if (!activeDraft.customerSessionId) return;

    console.log(`[SSE] Connecting to session: ${activeDraft.customerSessionId}`);
    const eventSource = new EventSource(`/api/customers/session-checkin-sse/${activeDraft.customerSessionId}`);
    
    eventSource.onopen = () => {
      console.log(`[SSE] Connected successfully to session: ${activeDraft.customerSessionId}`);
    };

    eventSource.onmessage = (event) => {
      console.log(`[SSE] Received message:`, event.data);
      try {
        const data = JSON.parse(event.data);
        console.log(`[SSE] Parsed data:`, data);
        if (data.type === 'CHECKIN_COMPLETE' && data.customer) {
          console.log(`[SSE] Customer check-in complete:`, data.customer);
          setSelectedCustomer(data.customer);
          setCustomerSearch(data.customer.name || data.customer.mobile || '');
          qc.invalidateQueries({ queryKey: ['customers-search'] });
          qc.invalidateQueries({ queryKey: ['customer-loyalty'] });
          showToast(`User ${data.customer.name} added to the order!`);
          
          // Forward connection notification to the customer screen
          const channel = new BroadcastChannel('pos-dual-monitor');
          channel.postMessage({
            type: 'CUSTOMER_CONNECTED',
            payload: data.customer
          });
          channel.close();
        } else {
          console.log(`[SSE] Ignoring message type:`, data.type);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse SSE checkin event:', err, 'Raw data:', event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
    };

    return () => {
      console.log(`[SSE] Disconnecting from session: ${activeDraft.customerSessionId}`);
      eventSource.close();
    };
  }, [activeDraft.customerSessionId, setSelectedCustomer, setCustomerSearch, qc, showToast]);


  useEffect(() => {
    if (activeDraft.customerSessionId && (user?.tenantId || branding.tenantId || branding._id) && selectedStoreId) {
      const resolvedTenantId = user?.tenantId || branding.tenantId || branding._id;
      api.post('/customer-checkin/register-session', {
        sessionId: activeDraft.customerSessionId,
        tenantId: resolvedTenantId,
        storeId: selectedStoreId,
      }).catch(err => {
        console.error('Failed to register checkin session with backend:', err);
      });
    }
  }, [activeDraft.customerSessionId, user?.tenantId, branding.tenantId, branding._id, selectedStoreId]);

  useEffect(() => {
    setPaymentModalOpen(false);
    setShowPromoList(false);
  }, [activeDraftId]);

  return (
    <CashierSessionGate requireSession={fohr.requireCashierSession}>
    <div className={`h-[100dvh] pb-[68px] md:pb-0 flex flex-col bg-[var(--pos-surface-inset)]`}>
      <Navbar groups={fohr.navGroups} />
      <OfflineBanner />
      <div className="shrink-0 border-b border-slate-700/50 bg-[var(--pos-panel)]/90 px-3 py-2 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 shrink-0">Ready</span>
        <div className="flex-1 min-w-0 overflow-x-auto flex items-center gap-2 no-scrollbar">
          {!isStoreReady ? (
            <span className="text-xs text-slate-500">Select a store…</span>
          ) : readyOrders.length === 0 ? (
            <span className="text-xs text-slate-500">No orders ready for pickup</span>
          ) : (
            readyOrders.map((o) => (
              <button
                key={o._id}
                type="button"
                onClick={() => setReadySlideOrder(o)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-green-500/35 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-[var(--pos-text-primary)] hover:bg-green-500/20 transition"
              >
                <span className="font-mono text-amber-400 font-semibold">
                  {o._offlinePending ? '#' : `#${String(o.orderNumber).padStart(3, '0')}`}
                </span>
                <OrderTypeBadge
                  orderType={o.orderType}
                  tableNumber={o.tableNumber}
                  reference={o.reference}
                  size="xs"
                />
              </button>
            ))
          )}
        </div>
        <Link
          to={fohr.ordersPath}
          className="text-xs font-semibold text-amber-400 shrink-0 whitespace-nowrap hover:text-amber-300"
        >
          Order board →
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Menu */}
        <div className={`flex flex-col overflow-hidden border-slate-700/50 transition-all ${mobileCartOpen ? 'hidden' : 'flex-1 border-r'}`}>
          {/* Category tabs + search */}
          <div className="border-b border-slate-700/50 bg-[var(--pos-panel)]/50">
            <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
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
            <div className="px-4 pb-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search menu items…"
                  className="w-full bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
                />
                {menuSearch && (
                  <button
                    type="button"
                    onClick={() => setMenuSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Menu grid */}
          <div className={`flex-1 overflow-y-auto ${isCompact ? 'p-2' : 'p-4'}`}>
            {menuLoading ? (
              <div className="p-1">
                <MenuGridSkeleton />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                {menuSearch.trim() ? 'No items match your search' : 'No items in this category'}
              </div>
            ) : (
              <div className={isCompact
                ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2'
                : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-3'
              }>
                {filtered.map(item => (
                  <MenuCard key={item._id} item={item} onAdd={addToCart} compact={isCompact} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile cart backdrop */}
        {mobileCartOpen && (
          <div
            className="md:hidden fixed inset-0 z-[119] bg-black/60"
            onClick={() => setMobileCartOpen(false)}
          />
        )}

        {/* Right: Cart — side panel on md+, bottom-sheet on mobile */}
        <div
          className={
            mobileCartOpen
              ? `fixed inset-x-0 bottom-0 z-[120] flex flex-col max-h-[90vh] rounded-t-2xl border-t border-slate-700/50 shadow-2xl bg-[var(--pos-panel)] overflow-hidden touch-none md:static md:max-h-none md:h-full md:min-h-0 md:rounded-none md:border-t-0 md:shadow-none md:touch-auto ${isCompact ? 'md:w-[33.333%]' : 'md:w-96 xl:w-[28rem]'}`
              : `hidden md:flex md:h-full md:min-h-0 md:flex-col bg-[var(--pos-panel)]/30 ${isCompact ? 'md:w-[33.333%]' : 'md:w-96 xl:w-[28rem]'}`
          }
          {...cartBind}
        >
          <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mt-3 mb-1 md:hidden shrink-0 cursor-grab active:cursor-grabbing" />
          <div className="shrink-0 p-4 border-b border-slate-700/50 flex items-center gap-2">
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
              <span className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
            <button
              type="button"
              onClick={() => window.open('/customer-terminal', 'customer_terminal', 'width=1024,height=768')}
              className="ml-auto bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-2 py-1 rounded text-xs transition flex items-center gap-1 border border-slate-700 cursor-pointer"
              title="Open Customer-Facing Screen"
            >
              <Monitor size={12} />
              <span>Customer Screen</span>
            </button>
          </div>

          <CashierDraftTabs
            drafts={drafts}
            activeDraftId={activeDraftId}
            onSelect={selectDraft}
            onAdd={addDraft}
            onRemove={removeDraft}
            tableLabelByDraftId={tableLabelByDraftId}
          />

          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {/* Order type — touch-friendly picker */}
              <div className="px-4 pt-4 pb-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Order type
                </label>
                <button
                  type="button"
                  onClick={() => setShowOrderTypePicker(true)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[var(--pos-surface-inset)] px-4 py-3 text-sm font-medium text-[var(--pos-text-primary)] hover:border-slate-600 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{activeType.icon}</span>
                    <span>{activeType.label}</span>
                  </div>
                  <ChevronRight size={16} className="text-slate-500" />
                </button>
              </div>

              {/* Customer + table / delivery ref (takeaway: full-width customer line only) */}
              <div className="px-4 pb-3 space-y-2 border-b border-slate-700/40">
                <div className={orderType === 'takeaway' ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-3 items-start'}>
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Customer (optional)</label>
                    <button
                      type="button"
                      onClick={() => setShowCustomerPicker(true)}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[var(--pos-surface-inset)] px-4 py-3 text-sm text-[var(--pos-text-primary)] hover:border-slate-600 transition"
                    >
                      {selectedCustomer ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">👤</span>
                          <span className="font-semibold truncate text-left">
                            {selectedCustomer.name || 'Customer'}
                            {(selectedCustomer.mobile || selectedCustomer.email) && ` (${selectedCustomer.mobile || selectedCustomer.email})`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Select customer…</span>
                      )}
                      <ChevronRight size={16} className="text-slate-500 shrink-0" />
                    </button>
                  </div>

                  {orderType !== 'takeaway' && (
                  <div className="min-w-0">
                {orderType === 'dine-in' && tableMgmt ? (
                  <>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Table *</label>
                    {!cafeTables.length ? (
                      <p className="text-[10px] leading-snug text-amber-400/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2 py-1.5">
                        No tables configured. Add tables under Manager → Café tables &amp; QR.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowTablePicker(true)}
                        className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[var(--pos-surface-inset)] px-4 py-3 text-sm text-[var(--pos-text-primary)] hover:border-slate-600 transition"
                      >
                        <span className={selectedTableId ? 'font-semibold' : 'text-slate-500'}>
                          {selectedTableId
                            ? cafeTables.find((t) => String(t._id) === selectedTableId)?.label || 'Table'
                            : 'Select table…'}
                        </span>
                        <ChevronRight size={16} className="text-slate-500" />
                      </button>
                    )}
                  </>
                ) : orderType === 'dine-in' ? (
                  <>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Table {tableMgmt ? '*' : '(optional)'}
                    </label>
                    <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] rounded-xl border border-slate-700 focus-within:border-blue-500 px-4 py-3 transition">
                      <Hash size={14} className="text-slate-500 shrink-0" />
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="e.g. 7"
                        className="flex-1 min-w-0 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 truncate" title={activeType.hint}>
                      {activeType.hint}
                    </label>
                    <div className={`flex items-center gap-2 bg-[var(--pos-surface-inset)] rounded-xl border border-slate-700 ${referenceFocusRing} px-3 py-2 transition`}>
                      <span className="text-sm shrink-0">{activeType.icon}</span>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder={activeType.placeholder}
                        className="flex-1 min-w-0 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
                      />
                    </div>
                  </>
                )}
                  </div>
                  )}
            </div>

            {/* Loyalty info badge when customer is selected */}
            {selectedCustomer && customerLoyalty?.lifetimePoints != null && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded-full px-2.5 py-1">
                  <User size={11} />
                  {customerLoyalty.lifetimePoints} pts
                  {customerLoyalty?.loyalty?.effectiveTier?.name && (
                    <> · {customerLoyalty.loyalty.effectiveTier.name}</>
                  )}
                </span>
              </div>
            )}

            {loyaltyAddonActive && loyaltyConfig?.isEnabled !== false && selectedCustomer && cart.length > 0 && (
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
              <div className="px-4 py-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center min-h-[10rem] text-slate-600">
                    <ShoppingCart size={32} className="mb-2 opacity-40" />
                    <p className="text-sm">Cart is empty</p>
                    <p className="text-xs mt-1">Tap menu items to add</p>
                  </div>
                ) : (
                  cart.map(item => {
                    const mItem = menuItems.find(m => m._id === item.menuItem);
                    const variant = item.variantId && mItem ? mItem.variants?.find(v => v._id === item.variantId) : null;
                    const isWarning = mItem ? isMissingPartnerPrice(mItem, variant, orderType, partners) : false;
                    return (
                      <CartItem key={`${item.menuItem}-${item.variantId || 'base'}`} item={item} onChangeQty={changeQty} showImage={isCompact} isWarning={isWarning} />
                    );
                  })
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
                  <span className="text-sm text-slate-500">Auto</span>
                  <button
                    onClick={() => { setAutoApply(v => !v); setSelectedPromoIds([]); setShowPromoList(false); }}
                    title={autoApply ? 'Auto-applying best deals' : 'Manual selection'}
                  >
                    {autoApply
                      ? <ToggleRight size={28} className="text-green-400" />
                      : <ToggleLeft  size={28} className="text-slate-600" />}
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

              {/* Order summary — scrolls with line items */}
              <div className="p-4 border-t border-slate-700/50 space-y-2">
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
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-700/50 bg-[var(--pos-panel)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_36px_rgba(0,0,0,0.4)] space-y-2 z-20">
              <div className="flex justify-between text-[var(--pos-text-primary)] font-bold text-base">
                <span>Total</span>
                <span className="text-amber-400">{formatPrice(total)}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!canPlace) return;
                  if (deferPayment) {
                    sendTableTabOrder();
                    return;
                  }
                  setPaymentModalOpen(true);
                  setMobileCartOpen(false);
                }}
                disabled={!canPlace || mutation.isPending}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-green-500/20 text-sm"
              >
                {mutation.isPending
                  ? 'Placing Order...'
                  : deferPayment
                    ? 'Send to kitchen (pay at checkout)'
                    : 'Place Order'}
              </button>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearCurrentDraft()}
                  className="w-full flex items-center justify-center gap-1.5 text-slate-500 hover:text-red-400 text-xs py-2 rounded-lg hover:bg-red-500/10 transition"
                >
                  <Trash2 size={13} /> Cancel order
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <OrderDetailSlideOver
        order={liveReadyOrder}
        onClose={() => setReadySlideOrder(null)}
        canCancel
      />
      {/* Mobile bottom bar — session summary + cart toggle (hidden on md+) */}
      {!mobileCartOpen && (
        <MobileBottomBar
          onOpenCart={() => setMobileCartOpen(true)}
          cartCount={cart.reduce((s, i) => s + i.qty, 0)}
          cartTotal={formatPrice(total)}
        />
      )}
      <CollectPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handlePaymentConfirm}
        total={total}
        availablePaymentMethods={availablePaymentMethods}
        confirmLabel="Confirm & print"
        isPending={mutation.isPending}
        orderType={orderType}
        tableNumber={tableNumber}
        reference={nonDineInReference}
        items={cart}
        subtotal={subtotal}
        discountTotal={discountTotal}
        taxAmount={taxAmount}
        serviceFeeAmount={serviceFeeAmount}
        cashDenominations={selectedStore?.cashDenominations}
      />
      {/* Variant Selection Modal */}
      <VariantSelectorModal
        item={variantSelectionItem}
        onClose={() => setVariantSelectionItem(null)}
        onConfirm={addToCart}
      />

      {/* Order Type Picker Modal */}
      <OptionPickerModal
        open={showOrderTypePicker}
        onClose={() => setShowOrderTypePicker(false)}
        title="Order Type"
        subtitle="Select how the customer will receive their order"
        options={(() => {
          const activePartners = partners.filter((p) => p.isActive);
          return ORDER_TYPES.filter((type) => {
            if (type.id === 'dine-in' || type.id === 'takeaway') return true;
            if (type.id === 'uber-eats') {
              return activePartners.some((p) => p.name?.toLowerCase().includes('uber'));
            }
            if (type.id === 'pickme') {
              return activePartners.some((p) => p.name?.toLowerCase().includes('pickme') || p.name?.toLowerCase().includes('pick me'));
            }
            return false;
          }).map((type) => ({
            value: type.id,
            label: type.label,
            icon: type.icon,
          }));
        })()}
        value={orderType}
        onChange={(v) => {
          setOrderType(v);
          setTableNumber('');
          setReference('');
          setSelectedTableId('');
          setCart((prevCart) =>
            prevCart.map((c) => {
              const mItem = menuItems.find((m) => m._id === c.menuItem);
              if (!mItem) return c;
              const variant = c.variantId ? mItem.variants?.find((varObj) => varObj._id === c.variantId) : null;
              const newPrice = getItemPrice(mItem, variant, v, partners);
              return { ...c, price: newPrice };
            })
          );
        }}
        columns={2}
      />

      {/* Table Picker Modal */}
      <TablePickerModal
        open={showTablePicker}
        onClose={() => setShowTablePicker(false)}
        tables={cafeTables}
        occupancyMap={occupancyByTable}
        selectedTableId={selectedTableId}
        onSelect={(tableId) => setSelectedTableId(tableId)}
      />

      {/* Customer Picker Modal */}
      <CustomerPickerModal
        open={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        customerHits={customerHits}
        searchQuery={customerSearch}
        onSearchChange={setCustomerSearch}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(c) => {
          setSelectedCustomer(c);
          if (c) {
            setCustomerSearch(c.name || c.email || c.mobile || '');
          } else {
            setCustomerSearch('');
            setSelectedLoyaltyRewardId('');
          }
        }}
        onCreateCustomer={(data, onSuccess) => {
          upsertCustomerMutation.mutate(data, {
            onSuccess: () => onSuccess?.(),
          });
        }}
        createPending={upsertCustomerMutation.isPending}
        countryIso={branding.countryIso || 'LK'}
        validateMobileFn={validateMobile}
        validateEmailFn={validateEmail}
      />
    </div>
    </CashierSessionGate>
  );
}
