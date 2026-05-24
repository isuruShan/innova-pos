import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Minus, Trash2, Save, Link2, Hash, AlertTriangle, Tag, CheckCircle, Loader2, Clock, XCircle, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import { formatCurrency, formatDateTime as fmtDT } from '../utils/format';
import SlideOver from './SlideOver';
import Badge from './Badge';
import { ORDER_TYPES, ORDER_TYPE_MAP } from './OrderTypeBadge';
import { useStoreContext } from '../context/StoreContext';
import { buildCategorySortMap, resolveMenuDisplayItems } from '../utils/menuItemSearch';
import OptionPickerModal, { MenuItemPickerModal } from './OptionPickerModal';

const CACHEABLE_QUERIES = ['order-board', 'kitchen-orders', 'cashier-ready-orders', 'recent-orders', 'manager-orders', 'sales-report'];

const EDITABLE_STATUSES = ['pending', 'preparing', 'ready'];

const formatPrice = formatCurrency;
const formatDateTime = fmtDT;

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
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
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
                <img src={selectedVariant.image} alt="" className="w-full h-full object-cover" />
              ) : item.images?.[0]?.url || item.image ? (
                <img src={item.images?.[0]?.url || item.image} alt="" className="w-full h-full object-cover" />
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
            Add to Order
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  index,
  onQtyChange,
  onRemove,
  editable,
  hidePricing,
  showDelivered,
  onDeliveredToggle,
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-700/40 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {item.isCombo && <Link2 size={11} className="text-amber-400 flex-shrink-0" />}
          <span className={`text-sm truncate ${item.isCombo ? 'text-amber-300 font-medium' : 'text-slate-200'}`}>
            {item.name}
          </span>
        </div>
        {item.variantName && (
          <p className="text-xs text-amber-400/90 font-medium mt-0.5 truncate">↳ {item.variantName}</p>
        )}
        {item.isCombo && item.comboItems?.length > 0 && (
          <div className="ml-3 mt-0.5">
            {item.comboItems.map((ci, i) => (
              <p key={i} className="text-xs text-slate-600">↳ {ci.name} ×{ci.qty}</p>
            ))}
          </div>
        )}
        {!hidePricing && (
          <p className="text-xs text-slate-500 mt-0.5">{formatPrice(item.price)} each</p>
        )}
      </div>
      {editable ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onQtyChange(index, -1)}
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-400 flex items-center justify-center transition"
          >
            <Minus size={11} />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-[var(--pos-text-primary)]">{item.qty}</span>
          <button
            type="button"
            onClick={() => onQtyChange(index, 1)}
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-amber-500/30 text-slate-300 hover:text-amber-400 flex items-center justify-center transition"
          >
            <Plus size={11} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="w-6 h-6 rounded-full text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition ml-1"
          >
            <Trash2 size={11} />
          </button>
          {showDelivered && item._id ? (
            <button
              type="button"
              title={item.deliveredToTable ? 'Mark not delivered' : 'Mark delivered to table'}
              onClick={() => onDeliveredToggle(index)}
              className={`ml-1 p-1.5 rounded-lg transition ${
                item.deliveredToTable
                  ? 'text-green-400 bg-green-500/15'
                  : 'text-slate-500 hover:text-green-400 hover:bg-green-500/10'
              }`}
            >
              <CheckCircle size={14} />
            </button>
          ) : null}
        </div>
      ) : (
        <span className="text-sm font-semibold text-slate-400 ml-2">×{item.qty}</span>
      )}
      {!hidePricing && (
        <span className="text-sm font-semibold text-[var(--pos-text-primary)] w-14 text-right">
          {formatPrice(item.price * item.qty)}
        </span>
      )}
    </div>
  );
}

function AddItemRow({ menuItems, existingIds, onAdd }) {
  const [showPicker, setShowPicker] = useState(false);
  const available = menuItems.filter(m => m.available && !existingIds.has(m._id));

  if (!available.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setShowPicker(true)}
        className="w-full flex items-center justify-center gap-2 mt-3 bg-[var(--pos-surface-inset)] hover:bg-slate-800/60 border-2 border-dashed border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-300 font-medium py-3 rounded-xl transition text-sm"
      >
        <Plus size={16} />
        Add Item
      </button>
      <MenuItemPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        menuItems={menuItems}
        existingIds={existingIds}
        onSelect={onAdd}
        formatPrice={formatPrice}
      />
    </>
  );
}

export default function OrderDetailSlideOver({ order, onClose, canCancel = true, hidePricing = false }) {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const selectedStore =
    stores.find((s) => String(s._id) === String(selectedStoreId)) || stores.find((s) => s.isDefault) || null;
  const tableMgmt = selectedStore?.tableManagementEnabled === true;
  const isEditable = order && EDITABLE_STATUSES.includes(order.status) && order.orderType !== 'uber-eats';

  const [orderType, setOrderType] = useState(order?.orderType || 'dine-in');
  const [tableNumber, setTableNumber] = useState(order?.tableNumber || '');
  const [selectedTableId, setSelectedTableId] = useState(order?.tableId ? String(order.tableId) : '');
  const [reference, setReference] = useState(order?.reference || '');
  const [items, setItems] = useState(order?.items || []);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [variantSelectionItem, setVariantSelectionItem] = useState(null);
  const waiterDismissPostedRef = useRef(new Set());

  // Uber Eats actions state
  const [showUberDeny, setShowUberDeny] = useState(false);
  const [uberPrepTime, setUberPrepTime] = useState('15');
  const [uberDenyReason, setUberDenyReason] = useState('OUT_OF_ITEMS');
  const [showPrepTimePicker, setShowPrepTimePicker] = useState(false);
  const [showDenyReasonPicker, setShowDenyReasonPicker] = useState(false);

  useEffect(() => {
    if (order) {
      setOrderType(order.orderType || 'dine-in');
      setTableNumber(order.tableNumber || '');
      setSelectedTableId(order.tableId ? String(order.tableId) : '');
      setReference(order.reference || '');
      setItems(order.items || []);
      setDirty(false);
      setError('');
      setShowUberDeny(false);
      setUberPrepTime('15');
      setUberDenyReason('OUT_OF_ITEMS');
    }
  }, [order?._id]);

  useEffect(() => {
    if (!order?._id) return;
    const oid = String(order._id);
    if (waiterDismissPostedRef.current.has(oid)) return;
    waiterDismissPostedRef.current.add(oid);
    if (waiterDismissPostedRef.current.size > 200) {
      waiterDismissPostedRef.current.clear();
      waiterDismissPostedRef.current.add(oid);
    }
    api
      .post('/notifications/dismiss-waiter-calls-for-order', { orderId: oid })
      .then(() => {
        qc.invalidateQueries({ queryKey: ['waiter-call-notifications'] });
        qc.invalidateQueries({ queryKey: ['qr-order-update-notifications'] });
      })
      .catch(() => {});
  }, [order?._id, qc]);

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: !!order && isEditable && isStoreReady,
  });

  const { data: categoryRows = [] } = useQuery({
    queryKey: ['categories', selectedStoreId],
    queryFn: () => api.get('/categories').then((r) => r.data),
    enabled: !!order && isEditable && isStoreReady,
  });

  const sortedMenuItems = useMemo(() => {
    const categorySortMap = buildCategorySortMap(categoryRows);
    return resolveMenuDisplayItems(menuItems, {
      activeCategory: 'All',
      menuSearch: '',
      categorySortMap,
    });
  }, [menuItems, categoryRows]);

  const { data: cafeTables = [] } = useQuery({
    queryKey: ['cafe-tables', selectedStoreId],
    queryFn: () => api.get('/tables').then((r) => r.data),
    enabled: !!order && isStoreReady && tableMgmt,
  });

  const { data: tableOccupancy = [] } = useQuery({
    queryKey: ['table-occupancy', selectedStoreId],
    queryFn: () => api.get('/tables/occupancy').then((r) => r.data),
    enabled: !!order && isStoreReady && tableMgmt,
    refetchInterval: 12_000,
  });

  const occupancyByTable = useMemo(() => {
    const m = new Map();
    (tableOccupancy || []).forEach((o) => {
      if (o.tableId && String(o.orderId) !== String(order?._id)) m.set(String(o.tableId), o);
    });
    return m;
  }, [tableOccupancy, order?._id]);

  const invalidateAll = () => {
    CACHEABLE_QUERIES.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  };

  const saveMutation = useMutation({
    mutationFn: (data) => api.put(`/orders/${encodeURIComponent(order._id)}`, data),
    onSuccess: () => { invalidateAll(); setDirty(false); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to save changes'),
  });

  const deliveredMutation = useMutation({
    mutationFn: ({ itemId, delivered }) =>
      api.put(`/orders/${encodeURIComponent(order._id)}/items/${encodeURIComponent(itemId)}/delivered`, {
        delivered,
      }),
    onSuccess: () => invalidateAll(),
    onError: (e) => setError(e.response?.data?.message || 'Could not update line'),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.put(`/orders/${encodeURIComponent(order._id)}/status`, { status }),
    onSuccess: () => { invalidateAll(); onClose(); },
    onError: (e) => setError(e.response?.data?.message || 'Failed to update status'),
  });

  const uberAcceptMutation = useMutation({
    mutationFn: (prepTime) =>
      api.put(`/uber/orders/${encodeURIComponent(order._id)}/uber-accept`, { prepTime }),
    onSuccess: () => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['uber-active-orders'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to accept order'),
  });

  const uberDenyMutation = useMutation({
    mutationFn: (reason) =>
      api.put(`/uber/orders/${encodeURIComponent(order._id)}/uber-deny`, { reason }),
    onSuccess: () => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['uber-active-orders'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to deny order'),
  });

  const uberReadyMutation = useMutation({
    mutationFn: () =>
      api.put(`/uber/orders/${encodeURIComponent(order._id)}/uber-ready`),
    onSuccess: () => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['uber-active-orders'] });
      onClose();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to mark ready'),
  });

  const changeQty = (index, delta) => {
    setItems((prev) => {
      const row = prev[index];
      if (!row) return prev;
      const q = row.qty + delta;
      if (q <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((r, i) => (i === index ? { ...r, qty: q } : r));
    });
    setDirty(true);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const toggleDelivered = (index) => {
    const line = items[index];
    if (!line) return;
    const next = !line.deliveredToTable;
    if (line._id) {
      deliveredMutation.mutate({ itemId: line._id, delivered: next });
    } else {
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, deliveredToTable: next } : it)));
      setDirty(true);
    }
  };

  const addItem = (menuItem, selectedVariant = null) => {
    if (menuItem.hasVariants && !selectedVariant) {
      setVariantSelectionItem(menuItem);
      return;
    }

    const price = selectedVariant ? selectedVariant.price : menuItem.price;
    const variantId = selectedVariant ? selectedVariant._id : null;
    const variantName = selectedVariant ? selectedVariant.name : '';
    const variantAttributes = selectedVariant ? selectedVariant.attributes || [] : [];

    setItems(prev => [...prev, {
      menuItem: menuItem._id,
      name: menuItem.name,
      price,
      qty: 1,
      isCombo: menuItem.isCombo || false,
      comboItems: menuItem.comboItems || [],
      variantId,
      variantName,
      variantAttributes,
    }]);
    setDirty(true);
    setVariantSelectionItem(null);
  };

  const handleSave = () => {
    setError('');
    if (items.length === 0) return setError('Order must have at least one item');
    if (orderType === 'dine-in' && tableMgmt && !selectedTableId)
      return setError('Select a table for dine-in');
    if (orderType === 'dine-in' && !tableMgmt && !tableNumber.trim())
      return setError('Table number is required for dine-in orders');
    saveMutation.mutate({
      orderType,
      ...(orderType === 'dine-in' && tableMgmt ? { tableId: selectedTableId } : {}),
      ...(orderType === 'dine-in' && !tableMgmt ? { tableNumber: tableNumber.trim() } : {}),
      reference,
      items: items.map((i) => ({
        menuItem: i.menuItem,
        qty: i.qty,
        variantId: i.variantId || null,
        variantName: i.variantName || '',
        variantAttributes: i.variantAttributes || [],
        ...(i._id ? { _id: i._id } : {}),
        ...(typeof i.deliveredToTable === 'boolean' ? { deliveredToTable: i.deliveredToTable } : {}),
      })),
    });
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const existingIds = new Set(items.map(i => i.menuItem));
  const activeType = ORDER_TYPE_MAP[orderType] || ORDER_TYPE_MAP['dine-in'];

  if (!order) return null;

  const title = (
    <div className="flex items-center gap-3">
      <span className="font-mono text-amber-400 font-bold">
        #{String(order.orderNumber).padStart(3, '0')}
      </span>
      <Badge label={order.status} variant={order.status} />
    </div>
  );

  return (
    <SlideOver open={!!order} onClose={onClose} title={title}>
      <div className="space-y-5">
        {/* Meta info */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Placed by {order.createdBy?.name || 'Guest / cashier'}</span>
          <span>{formatDateTime(order.createdAt)}</span>
        </div>

        {/* Uber Eats Details */}
        {order.orderType === 'uber-eats' && order.uberDetails && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 space-y-2 text-sm text-[var(--pos-text-primary)]">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <span>🛵</span> Uber Eats Integration
              </span>
              {order.uberDetails.uberDisplayId && (
                <span className="font-mono text-emerald-300 font-bold bg-emerald-950/50 px-2 py-0.5 rounded-lg border border-emerald-500/25 text-xs">
                  ID: {order.uberDetails.uberDisplayId}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Uber Status:</span>{' '}
                <span className="font-semibold capitalize text-slate-200">{order.uberDetails.uberStatus || 'New'}</span>
              </div>
              <div>
                <span className="text-slate-400">Est. Prep Time:</span>{' '}
                <span className="font-semibold text-slate-200">{order.uberDetails.estimatedPrepTime} mins</span>
              </div>
              {order.uberDetails.denyReason && (
                <div className="col-span-2 text-red-400">
                  <span className="text-slate-400">Deny Reason:</span> {order.uberDetails.denyReason}
                </div>
              )}
              {order.uberDetails.cancelReason && (
                <div className="col-span-2 text-red-400">
                  <span className="text-slate-400">Cancel Reason:</span> {order.uberDetails.cancelReason}
                </div>
              )}
            </div>
            {order.uberDetails.riderInfo && order.uberDetails.riderInfo.name && (
              <div className="border-t border-emerald-500/20 pt-2 space-y-1 text-xs">
                <p className="font-bold text-slate-300">Rider Information</p>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400">
                  <div>Name: <span className="text-slate-200 font-semibold">{order.uberDetails.riderInfo.name}</span></div>
                  {order.uberDetails.riderInfo.phone && (
                    <div>Phone: <span className="text-slate-200 font-semibold">{order.uberDetails.riderInfo.phone}</span></div>
                  )}
                  {order.uberDetails.riderInfo.vehicle && (
                    <div>Vehicle: <span className="text-slate-200 font-semibold">{order.uberDetails.riderInfo.vehicle}</span></div>
                  )}
                  {order.uberDetails.riderInfo.eta && (
                    <div>ETA: <span className="text-slate-200 font-semibold">{new Date(order.uberDetails.riderInfo.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {order.paymentCollected === false && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-sm px-3 py-2">
            Tab open — collect payment when you complete this order on the order board (guest QR orders also show here).
          </div>
        )}

        {/* Order type */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Order Type</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ORDER_TYPES.map(type => (
              <button
                key={type.id}
                disabled={!isEditable}
                onClick={() => { setOrderType(type.id); setTableNumber(''); setReference(''); setDirty(true); }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition ${
                  orderType === type.id
                    ? `${type.activeBg} text-[var(--pos-selection-text)] border-transparent`
                    : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400'
                } ${!isEditable ? 'opacity-60 cursor-not-allowed' : 'hover:border-slate-600'}`}
              >
                <span>{type.icon}</span>
                <span className="truncate">{type.label}</span>
              </button>
            ))}
          </div>

          {/* Table / reference input */}
          <div className="mt-2">
            {orderType === 'dine-in' && tableMgmt ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Transfer moves the whole order; occupied tables are disabled.</p>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {cafeTables
                    .filter((t) => t.active !== false)
                    .map((t) => {
                      const busy = occupancyByTable.has(String(t._id));
                      const sel = selectedTableId === String(t._id);
                      return (
                        <button
                          key={t._id}
                          type="button"
                          disabled={!isEditable || busy}
                          title={busy ? 'Another active order is using this table' : undefined}
                          onClick={() => {
                            setSelectedTableId(String(t._id));
                            setTableNumber(t.label || '');
                            setDirty(true);
                          }}
                          className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                            busy
                              ? 'border-slate-700 bg-slate-800/40 text-slate-600 cursor-not-allowed'
                              : sel
                                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                                : 'border-slate-700 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] hover:border-slate-600'
                          }`}
                        >
                          {t.label}
                          {busy ? <span className="block text-[10px] font-normal text-slate-500">In use</span> : null}
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : orderType === 'dine-in' ? (
              <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] rounded-xl border border-slate-700 px-3 py-2.5">
                <Hash size={14} className="text-slate-500" />
                <input
                  type="text"
                  value={tableNumber}
                  onChange={e => { setTableNumber(e.target.value); setDirty(true); }}
                  disabled={!isEditable}
                  placeholder="Table number"
                  className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600 disabled:opacity-50"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] rounded-xl border border-slate-700 px-3 py-2.5">
                <span className="text-sm">{activeType.icon}</span>
                <input
                  type="text"
                  value={reference}
                  onChange={e => { setReference(e.target.value); setDirty(true); }}
                  disabled={!isEditable}
                  placeholder={activeType.placeholder}
                  className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600 disabled:opacity-50"
                />
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">Items</p>
          <div className="bg-[var(--pos-surface-inset)] rounded-xl px-3">
            {items.length === 0 ? (
              <p className="text-slate-600 text-sm py-4 text-center">No items</p>
            ) : (
              items.map((item, index) => (
                <ItemRow
                  key={item._id || `line-${index}`}
                  item={item}
                  index={index}
                  editable={isEditable}
                  hidePricing={hidePricing}
                  showDelivered={orderType === 'dine-in'}
                  onQtyChange={changeQty}
                  onRemove={removeItem}
                  onDeliveredToggle={toggleDelivered}
                />
              ))
            )}
          </div>

          {isEditable && (
            <AddItemRow menuItems={sortedMenuItems} existingIds={existingIds} onAdd={addItem} />
          )}
        </div>

        {/* Financial breakdown — hidden in kitchen / no-price views */}
        {!hidePricing && (
          <div className="space-y-1 pt-1 border-t border-slate-700/50 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{formatPrice(isEditable ? subtotal : (order.subtotal ?? subtotal))}</span>
            </div>
            {!isEditable && (order.appliedPromotions || []).map((ap, i) => (
              <div key={i} className="flex justify-between text-green-400">
                <span className="flex items-center gap-1 truncate">
                  <Tag size={10} className="flex-shrink-0" />{ap.name}
                </span>
                <span>-{formatPrice(ap.discountAmount)}</span>
              </div>
            ))}
            {!isEditable && (order.discountTotal > 0) && (
              <div className="flex justify-between text-green-300 font-medium">
                <span>Total Discount</span>
                <span>-{formatPrice(order.discountTotal)}</span>
              </div>
            )}
            {!isEditable && order.taxAmount > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Tax ({order.taxRate}%)</span>
                <span>{formatPrice(order.taxAmount)}</span>
              </div>
            )}
            {!isEditable && order.serviceFeeAmount > 0 && (
              <div className="flex justify-between text-slate-400">
                <span>Service Fee</span>
                <span>{formatPrice(order.serviceFeeAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--pos-text-primary)] font-bold text-base pt-1 border-t border-slate-700/40">
              <span>Total</span>
              <span className="text-amber-400">
                {formatPrice(isEditable ? subtotal : order.totalAmount)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          {/* Save edits */}
          {isEditable && dirty && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              <Save size={15} />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          )}

          {/* Cancel order */}
          {canCancel && order.status !== 'completed' && order.status !== 'cancelled' && order.orderType !== 'uber-eats' && (
            <button
              onClick={() => { if (confirm('Cancel this order?')) statusMutation.mutate('cancelled'); }}
              disabled={statusMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50"
            >
              {statusMutation.isPending ? 'Cancelling…' : '✕ Cancel Order'}
            </button>
          )}

          {/* Uber Eats Actions */}
          {order.orderType === 'uber-eats' && (
            <div className="space-y-3 p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl mt-2">
              <p className="text-xs font-semibold text-emerald-400">Uber Actions</p>
              {order.status === 'pending' && (
                <>
                  {!showUberDeny ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowPrepTimePicker(true)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-700 hover:border-slate-600 transition"
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-slate-400" />
                          <span className="text-xs text-slate-400">Prep Time</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-amber-400">{uberPrepTime} mins</span>
                          <ChevronRight size={14} className="text-slate-500" />
                        </div>
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowUberDeny(true)}
                          className="flex-1 py-3 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold text-sm transition"
                        >
                          Deny Order
                        </button>
                        <button
                          type="button"
                          onClick={() => uberAcceptMutation.mutate(uberPrepTime)}
                          disabled={uberAcceptMutation.isPending}
                          className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-white font-bold text-sm transition flex justify-center items-center gap-1.5"
                        >
                          {uberAcceptMutation.isPending && <Loader2 className="animate-spin" size={14} />}
                          Accept Order
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowDenyReasonPicker(true)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--pos-surface-inset)] border border-slate-700 hover:border-slate-600 transition"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle size={16} className="text-red-400" />
                          <span className="text-xs text-slate-400">Denial Reason</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-red-400">
                            {uberDenyReason === 'OUT_OF_ITEMS' && 'Out of Items'}
                            {uberDenyReason === 'KITCHEN_CLOSED' && 'Kitchen Closed'}
                            {uberDenyReason === 'TOO_BUSY' && 'Store Too Busy'}
                            {uberDenyReason === 'CUSTOMER_REQUEST' && 'Customer Request'}
                          </span>
                          <ChevronRight size={14} className="text-slate-500" />
                        </div>
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowUberDeny(false)}
                          className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold text-sm transition"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => uberDenyMutation.mutate(uberDenyReason)}
                          disabled={uberDenyMutation.isPending}
                          className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-450 text-white font-bold text-sm transition flex justify-center items-center gap-1.5"
                        >
                          {uberDenyMutation.isPending && <Loader2 className="animate-spin" size={14} />}
                          Confirm Deny
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {order.status === 'preparing' && (
                <button
                  type="button"
                  onClick={() => uberReadyMutation.mutate()}
                  disabled={uberReadyMutation.isPending}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-white font-bold text-sm transition flex justify-center items-center gap-2"
                >
                  {uberReadyMutation.isPending && <Loader2 className="animate-spin" size={14} />}
                  Mark Ready for Pickup
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-medium py-2.5 rounded-xl transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
      {/* Variant Selector Modal */}
      <VariantSelectorModal
        item={variantSelectionItem}
        onClose={() => setVariantSelectionItem(null)}
        onConfirm={addItem}
      />

      {/* Prep Time Picker Modal */}
      <OptionPickerModal
        open={showPrepTimePicker}
        onClose={() => setShowPrepTimePicker(false)}
        title="Prep Time"
        subtitle="How long to prepare the order"
        options={[
          { value: '10', label: '10 mins', icon: '⏱️' },
          { value: '15', label: '15 mins', icon: '⏱️', badge: 'Default' },
          { value: '20', label: '20 mins', icon: '⏱️' },
          { value: '30', label: '30 mins', icon: '⏱️' },
        ]}
        value={uberPrepTime}
        onChange={setUberPrepTime}
      />

      {/* Deny Reason Picker Modal */}
      <OptionPickerModal
        open={showDenyReasonPicker}
        onClose={() => setShowDenyReasonPicker(false)}
        title="Denial Reason"
        subtitle="Select why you're denying this order"
        options={[
          { value: 'OUT_OF_ITEMS', label: 'Out of Items', icon: '📦', description: 'Ingredient unavailable' },
          { value: 'KITCHEN_CLOSED', label: 'Kitchen Closed', icon: '🔒', description: 'No longer accepting orders' },
          { value: 'TOO_BUSY', label: 'Store Too Busy', icon: '🏃', description: 'Cannot fulfill in time' },
          { value: 'CUSTOMER_REQUEST', label: 'Customer Request', icon: '👤', description: 'Customer asked to cancel' },
        ]}
        value={uberDenyReason}
        onChange={setUberDenyReason}
        columns={1}
      />
    </SlideOver>
  );
}
