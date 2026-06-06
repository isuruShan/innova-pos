import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileText, Send, Edit2, Trash2, Calendar, Package,
  DollarSign, AlertCircle, CheckCircle, XCircle, Clock,
  Search, SlidersHorizontal, ChevronDown, X, ArrowDown, ArrowUp
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import PurchaseOrderFormModal from '../../components/inventory/PurchaseOrderFormModal';
import { useStoreContext } from '../../context/StoreContext';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { formatCurrency } from '../../utils/format';
import PosDateField from '../../components/PosDateField';
import ResponsiveTable from '../../components/ResponsiveTable';
import ViewModeToggle from '../../components/ViewModeToggle';
import Badge from '../../components/Badge';

const STATUS_COLORS = {
  draft: 'text-slate-400 bg-slate-500/10',
  sent: 'text-sky-400 bg-sky-500/10',
  partial: 'text-amber-400 bg-amber-500/10',
  completed: 'text-green-400 bg-green-500/10',
  cancelled: 'text-red-400 bg-red-500/10',
};

const STATUS_ICONS = {
  draft: FileText,
  sent: Send,
  partial: AlertCircle,
  completed: CheckCircle,
  cancelled: XCircle,
};

const PO_SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'orderNumber', label: 'PO Number' },
  { value: 'expectedDate', label: 'Expected Date' },
  { value: 'totalAmount', label: 'Total Amount' },
  { value: 'supplierName', label: 'Supplier' },
];

export default function PurchaseOrders() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [activeStatus, setActiveStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sendTarget, setSendTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_purchase_orders');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_purchase_orders', mode);
  };

  const qc = useQueryClient();
  const { toast, showToast, clearToast } = useToast();

  const { data: orders = [], isPending: ordersPending } = useQuery({
    queryKey: ['purchase-orders', selectedStoreId],
    queryFn: () => api.get('/purchase-orders').then((r) => r.data),
    enabled: isStoreReady,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', selectedStoreId],
    queryFn: () => api.get('/suppliers').then((r) => r.data),
    enabled: isStoreReady,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', selectedStoreId],
    queryFn: () => api.get('/inventory').then((r) => r.data),
    enabled: isStoreReady,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/purchase-orders', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setFormOpen(false);
      showToast('Purchase order created successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to create purchase order'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/purchase-orders/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setFormOpen(false);
      setEditing(null);
      showToast('Purchase order updated successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to update purchase order'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/purchase-orders/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setDeleteTarget(null);
      showToast('Purchase order deleted successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to delete purchase order'));
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id) => api.post(`/purchase-orders/${id}/send`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setSendTarget(null);
      showToast('Purchase order sent successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to send purchase order'));
    },
  });

  const sortedAndFiltered = useMemo(() => {
    let result = [...orders];

    // 1. Status Filter
    if (activeStatus !== 'all') {
      result = result.filter((o) => o.status === activeStatus);
    }

    // 2. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.supplierId?.name?.toLowerCase().includes(q) ||
        o.notes?.toLowerCase().includes(q)
      );
    }

    // 3. Date Range Filter
    if (fromDate) {
      const from = new Date(`${fromDate}T00:00:00`);
      result = result.filter((o) => new Date(o.createdAt) >= from);
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      result = result.filter((o) => new Date(o.createdAt) <= to);
    }

    // 4. Sorting
    result.sort((a, b) => {
      let aVal = a[sort];
      let bVal = b[sort];

      if (sort === 'supplierName') {
        aVal = a.supplierId?.name || '';
        bVal = b.supplierId?.name || '';
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === 'string') {
        return order === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return order === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }
    });

    return result;
  }, [orders, activeStatus, search, fromDate, toDate, sort, order]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      draft: orders.filter((o) => o.status === 'draft').length,
      sent: orders.filter((o) => o.status === 'sent').length,
      partial: orders.filter((o) => o.status === 'partial').length,
      completed: orders.filter((o) => o.status === 'completed').length,
    };
  }, [orders]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (order) => {
    setEditing(order);
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget._id);
    }
  };

  const handleSend = () => {
    if (sendTarget) {
      sendMutation.mutate(sendTarget._id);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const setQuickDateRange = (days) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    setToDate(todayStr);

    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().split('T')[0];
    setFromDate(startStr);
  };

  const statusTabs = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'draft', label: 'Draft', count: stats.draft },
    { key: 'sent', label: 'Sent', count: stats.sent },
    { key: 'partial', label: 'Partial', count: stats.partial },
    { key: 'completed', label: 'Completed', count: stats.completed },
  ];


  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)]">Purchase Orders</h1>
            <p className="text-slate-500 text-sm mt-1">
              {orders.length} order{orders.length !== 1 ? 's' : ''} · {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm"
          >
            <Plus size={16} />
            Create PO
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveStatus(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeStatus === tab.key
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>
        {/* Search + Filter button + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-[var(--pos-panel)] p-3 rounded-xl border border-slate-700/50 items-center justify-between">
          <div className="flex-1 w-full flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by PO number, supplier, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-650"
            />
            {search && (
              <button onClick={() => setSearch('')}><X size={13} className="text-slate-500 hover:text-white" /></button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />
            <div className="relative">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  (fromDate || toDate)
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 font-semibold'
                    : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Filters</span>
                {(fromDate || toDate) && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--pos-panel)]">
                    1
                  </span>
                )}
                <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-[var(--pos-panel)] border border-slate-700 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="text-xs font-semibold text-slate-355">Filters</span>
                    {(fromDate || toDate) && (
                      <button
                        onClick={() => { setFromDate(''); setToDate(''); }}
                        className="text-[10px] text-amber-450 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {/* Date Range */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-455 uppercase tracking-wider mb-2">Date Range</p>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">From</label>
                        <PosDateField
                          value={fromDate}
                          onChange={setFromDate}
                          max={toDate}
                          className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">To</label>
                        <PosDateField
                          value={toDate}
                          onChange={setToDate}
                          min={fromDate}
                          className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <label htmlFor="po-sort" className="text-xs text-slate-550 shrink-0">Sort</label>
            <select
              id="po-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {PO_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 rounded-lg bg-[var(--pos-surface-inset)] border border-slate-700 text-slate-400 hover:text-white transition"
              title={order === 'asc' ? 'Ascending' : 'Descending'}
            >
              {order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>
        </div>

        {/* Orders List */}
        {ordersPending ? (
          <div className="text-center py-16 text-slate-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500 text-lg mb-2">No purchase orders found</p>
            <p className="text-slate-600 text-sm mb-6">Create your first purchase order to get started</p>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              <Plus size={16} />
              Create Purchase Order
            </button>
          </div>
        ) : sortedAndFiltered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500 text-lg mb-2">No purchase orders match your filters</p>
            <p className="text-slate-600 text-sm mb-6">Try adjusting your search terms or date range</p>
          </div>
        ) : (
          <div>
            {viewMode === 'table' ? (
              <ResponsiveTable
                rows={sortedAndFiltered}
                rowKey={(o) => o._id}
                loading={false}
                columns={[
                  {
                    key: 'orderNumber', header: 'PO Number',
                    mobilePrimary: true,
                    render: (o) => <span className="font-semibold text-[var(--pos-text-primary)]">{o.orderNumber}</span>,
                  },
                  {
                    key: 'status', header: 'Status',
                    render: (o) => {
                      const StatusIcon = STATUS_ICONS[o.status];
                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                          <StatusIcon size={12} />
                          <span className="capitalize">{o.status}</span>
                        </span>
                      );
                    },
                  },
                  {
                    key: 'supplier', header: 'Supplier',
                    mobileSecondary: true,
                    render: (o) => <span className="text-slate-350">{o.supplierId?.name || 'Unknown Supplier'}</span>,
                  },
                  {
                    key: 'date', header: 'Date Created',
                    render: (o) => <span className="text-slate-400">{formatDate(o.createdAt)}</span>,
                  },
                  {
                    key: 'expected', header: 'Expected Date',
                    render: (o) => <span className="text-slate-400">{formatDate(o.expectedDate)}</span>,
                  },
                  {
                    key: 'items', header: 'Items / Qty',
                    render: (o) => {
                      const totalQty = o.items.reduce((sum, item) => sum + item.orderedQty, 0);
                      return (
                        <span className="text-slate-400 text-xs">
                          {o.items.length} items ({totalQty} units)
                        </span>
                      );
                    },
                  },
                  {
                    key: 'amount', header: 'Total Amount',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    render: (o) => <span className="text-amber-450 font-bold">{formatCurrency(o.totalAmount)}</span>,
                  },
                  {
                    key: 'actions', header: '',
                    render: (o) => (
                      <div className="flex items-center gap-1.5 justify-end">
                        {o.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setSendTarget(o)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-semibold transition"
                          >
                            Send
                          </button>
                        )}
                        {['draft', 'sent'].includes(o.status) && (
                          <button
                            type="button"
                            onClick={() => openEdit(o)}
                            className="p-1.5 bg-slate-805 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {o.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(o)}
                            className="p-1.5 bg-slate-805 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedAndFiltered.map((order) => {
                  const StatusIcon = STATUS_ICONS[order.status];
                  const receivedCount = order.items.reduce((sum, i) => sum + i.receivedQty, 0);
                  const orderedCount = order.items.reduce((sum, i) => sum + i.orderedQty, 0);
                  const isFullyReceived = receivedCount >= orderedCount && orderedCount > 0;

                  return (
                    <div
                      key={order._id}
                      className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-base font-semibold text-[var(--pos-text-primary)]">
                                {order.orderNumber}
                              </h3>
                              <span
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  STATUS_COLORS[order.status]
                                }`}
                              >
                                <StatusIcon size={10} />
                                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                              </span>
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-400">
                              <p className="flex items-center gap-1.5 font-medium text-slate-350">
                                <Package size={13} className="text-purple-400 shrink-0" />
                                {order.supplierId?.name || 'Unknown Supplier'}
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-slate-500 shrink-0" />
                                {formatDate(order.createdAt)}
                              </p>
                              {order.expectedDate && (
                                <p className="flex items-center gap-1.5 text-[11px]">
                                  <Clock size={13} className="text-slate-500 shrink-0" />
                                  Expected: {formatDate(order.expectedDate)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {order.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => setSendTarget(order)}
                                className="flex items-center gap-1 px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg text-[10px] font-semibold transition"
                              >
                                <Send size={11} />
                                Send
                              </button>
                            )}
                            {['draft', 'sent'].includes(order.status) && (
                              <button
                                type="button"
                                onClick={() => openEdit(order)}
                                className="p-1 bg-slate-700/50 hover:bg-slate-650 rounded-lg text-slate-300 hover:text-white transition"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            {order.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(order)}
                                className="p-1 bg-slate-700/50 hover:bg-red-500/20 rounded-lg text-slate-300 hover:text-red-400 transition"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Items Summary */}
                        <div className="bg-[var(--pos-surface-inset)] rounded-lg p-2.5 mt-2">
                          <div className="grid grid-cols-3 gap-2 text-[11px] mb-2">
                            <div>
                              <p className="text-slate-500">Items</p>
                              <p className="font-semibold text-slate-300">{order.items.length}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Quantity</p>
                              <p className="font-semibold text-slate-300">{orderedCount}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Total</p>
                              <p className="font-bold text-amber-455">{formatCurrency(order.totalAmount)}</p>
                            </div>
                          </div>

                          {/* Items List (collapsed) */}
                          <details className="group border-t border-slate-800/40 pt-1.5">
                            <summary className="text-[10px] text-amber-450 hover:text-amber-400 cursor-pointer font-medium list-none flex items-center gap-1 justify-between">
                              <span>Details ({order.items.length} items)</span>
                              <span className="group-open:rotate-90 transition">▶</span>
                            </summary>
                            <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto pr-1">
                              {order.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[10px] bg-slate-800/40 rounded px-1.5 py-1"
                                >
                                  <span className="text-slate-350 truncate max-w-[120px]">{item.itemName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500">{item.orderedQty} {item.unit}</span>
                                    {item.receivedQty > 0 && <span className="text-green-455 font-bold">✓ {item.receivedQty}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      </div>

                      {order.notes && (
                        <div className="text-[11px] text-slate-500 bg-slate-800/30 rounded px-2.5 py-1.5 mt-3 italic line-clamp-1">
                          {order.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <PurchaseOrderFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
        suppliers={suppliers}
        inventory={inventory}
        onSubmit={(data) => {
          if (editing) {
            updateMutation.mutate({ id: editing._id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Purchase Order"
        message={
          deleteTarget
            ? `Are you sure you want to delete order ${deleteTarget.orderNumber}? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="delete"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Send Confirmation */}
      <ConfirmDialog
        open={!!sendTarget}
        title="Send Purchase Order"
        message={
          sendTarget
            ? `Are you sure you want to mark order ${sendTarget.orderNumber} as sent? You can still edit it after sending.`
            : ''
        }
        confirmLabel="Send Order"
        cancelLabel="Cancel"
        variant="confirm"
        isLoading={sendMutation.isPending}
        onConfirm={handleSend}
        onCancel={() => setSendTarget(null)}
      />

      <Toast toast={toast} onDismiss={clearToast} />
    </div>
  );
}
