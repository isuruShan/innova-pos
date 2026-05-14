import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Minus, Trash2, Save, Link2, Hash, AlertTriangle, Tag, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import { formatCurrency, formatDateTime as fmtDT } from '../utils/format';
import SlideOver from './SlideOver';
import Badge from './Badge';
import { ORDER_TYPES, ORDER_TYPE_MAP } from './OrderTypeBadge';
import { useStoreContext } from '../context/StoreContext';

const CACHEABLE_QUERIES = ['order-board', 'kitchen-orders', 'cashier-ready-orders', 'recent-orders', 'manager-orders', 'sales-report'];

const EDITABLE_STATUSES = ['pending', 'preparing', 'ready'];

const formatPrice = formatCurrency;
const formatDateTime = fmtDT;

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
  const [selectedId, setSelectedId] = useState('');
  const available = menuItems.filter(m => m.available && !existingIds.has(m._id));

  const add = () => {
    if (!selectedId) return;
    onAdd(menuItems.find(m => m._id === selectedId));
    setSelectedId('');
  };

  if (!available.length) return null;

  return (
    <div className="flex gap-2 mt-2">
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="flex-1 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <option value="">+ Add item…</option>
        {available.map(m => (
          <option key={m._id} value={m._id}>
            {m.name} — {formatPrice(m.price)}
          </option>
        ))}
      </select>
      <button
        onClick={add}
        disabled={!selectedId}
        className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-sm font-semibold transition"
      >
        Add
      </button>
    </div>
  );
}

export default function OrderDetailSlideOver({ order, onClose, canCancel = true, hidePricing = false }) {
  const qc = useQueryClient();
  const { selectedStoreId, isStoreReady, stores } = useStoreContext();
  const selectedStore =
    stores.find((s) => String(s._id) === String(selectedStoreId)) || stores.find((s) => s.isDefault) || null;
  const tableMgmt = selectedStore?.tableManagementEnabled === true;
  const isEditable = order && EDITABLE_STATUSES.includes(order.status);

  const [orderType, setOrderType] = useState(order?.orderType || 'dine-in');
  const [tableNumber, setTableNumber] = useState(order?.tableNumber || '');
  const [selectedTableId, setSelectedTableId] = useState(order?.tableId ? String(order.tableId) : '');
  const [reference, setReference] = useState(order?.reference || '');
  const [items, setItems] = useState(order?.items || []);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const waiterDismissPostedRef = useRef(new Set());

  useEffect(() => {
    if (order) {
      setOrderType(order.orderType || 'dine-in');
      setTableNumber(order.tableNumber || '');
      setSelectedTableId(order.tableId ? String(order.tableId) : '');
      setReference(order.reference || '');
      setItems(order.items || []);
      setDirty(false);
      setError('');
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

  const addItem = (menuItem) => {
    setItems(prev => [...prev, {
      menuItem: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      qty: 1,
      isCombo: menuItem.isCombo || false,
      comboItems: menuItem.comboItems || [],
    }]);
    setDirty(true);
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
            <AddItemRow menuItems={menuItems} existingIds={existingIds} onAdd={addItem} />
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
          {canCancel && order.status !== 'completed' && order.status !== 'cancelled' && (
            <button
              onClick={() => { if (confirm('Cancel this order?')) statusMutation.mutate('cancelled'); }}
              disabled={statusMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50"
            >
              {statusMutation.isPending ? 'Cancelling…' : '✕ Cancel Order'}
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-medium py-2.5 rounded-xl transition text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </SlideOver>
  );
}
