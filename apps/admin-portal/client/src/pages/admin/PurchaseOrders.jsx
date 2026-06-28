import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileText, Send, Edit2, Trash2, Calendar, Package,
  DollarSign, AlertCircle, CheckCircle, XCircle, Clock,
  Search, SlidersHorizontal, ChevronDown, X, ArrowDown, ArrowUp, Eye
} from 'lucide-react';
import api from '../../api/axios';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import PurchaseOrderFormModal from '../../components/inventory/PurchaseOrderFormModal';
import { useStoreContext } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/format';
import PosDateField from '../../components/PosDateField';
import ResponsiveTable from '../../components/ResponsiveTable';
import ViewModeToggle from '../../components/ViewModeToggle';
import Badge from '../../components/Badge';
import PageHeader from '../../components/PageHeader';

const STATUS_COLORS = {
  draft: 'text-gray-500 bg-slate-500/10',
  sent: 'text-sky-400 bg-sky-500/10',
  partial: 'text-brand-orange bg-brand-orange/10',
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

export default function PurchaseOrders({ embedded = false }) {
  const { selectedStoreId, isStoreReady, stores, selectStore } = useStoreContext();
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/tenant-settings').then((r) => r.data),
  });
  const isCentralKitchenEnabled = settings?.centralKitchenEnabled === true;

  const activeStore = useMemo(() => {
    return stores.find((s) => String(s._id) === String(selectedStoreId));
  }, [stores, selectedStoreId]);

  const isStoreUnderCentralKitchen = useMemo(() => {
    return activeStore && activeStore.replenishmentModel === 'central_kitchen' && isCentralKitchenEnabled;
  }, [activeStore, isCentralKitchenEnabled]);

  const isWriteLocked = useMemo(() => {
    if (!isStoreUnderCentralKitchen) return false;
    const restrictedRoles = ['manager', 'inventory_clerk'];
    return restrictedRoles.includes(user?.role);
  }, [isStoreUnderCentralKitchen, user]);

  const [activeStatus, setActiveStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sendTarget, setSendTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const filterContainerRef = useRef(null);

  useEffect(() => {
    if (!showFilters) return;
    const handleClickOutside = (e) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilters]);

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
    setIsReadOnly(false);
    setFormOpen(true);
  };

  const openEdit = (order) => {
    setEditing(order);
    setIsReadOnly(false);
    setFormOpen(true);
  };

  const openView = (order) => {
    setEditing(order);
    setIsReadOnly(true);
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

  const handleQuickFilter = (type) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (type === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (type === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setFromDate(yesterday.toISOString().split('T')[0]);
      setToDate(yesterday.toISOString().split('T')[0]);
    } else if (type === '7days') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      setFromDate(start.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (type === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const offset = start.getTimezoneOffset();
      const localStart = new Date(start.getTime() - (offset * 60 * 1000));
      setFromDate(localStart.toISOString().split('T')[0]);
      setToDate(todayStr);
    }
  };

  const statusTabs = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'draft', label: 'Draft', count: stats.draft },
    { key: 'sent', label: 'Sent', count: stats.sent },
    { key: 'partial', label: 'Partial', count: stats.partial },
    { key: 'completed', label: 'Completed', count: stats.completed },
  ];


  if (!isStoreReady) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md max-w-sm w-full text-center space-y-4">
          <FileText size={40} className="mx-auto text-brand-orange animate-pulse" />
          <h2 className="text-lg font-bold text-gray-900">Select a Store</h2>
          <p className="text-sm text-gray-500">Please select a store to view and manage purchase orders.</p>
          <select
            value={selectedStoreId || ''}
            onChange={(e) => selectStore(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
          >
            <option value="" disabled>Select Store...</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const storeSelector = stores.length > 0 ? (
    <select
      value={selectedStoreId || ''}
      onChange={(e) => selectStore(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer w-full sm:w-56"
    >
      <option value="" disabled>Select Store...</option>
      {stores.map((s) => (
        <option key={s._id} value={s._id}>
          {s.name}
        </option>
      ))}
    </select>
  ) : null;

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-50'}>
      
      <div className={embedded ? '' : 'max-w-7xl mx-auto p-4 sm:p-6'}>
        <PageHeader
          title="Purchase Orders"
          subtitle={`${orders.length} order${orders.length !== 1 ? 's' : ''} · ${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}`}
          storeSelector={storeSelector}
          actions={[
            !isWriteLocked && {
              label: 'Create PO',
              icon: Plus,
              onClick: openAdd,
              primary: true,
            },
          ].filter(Boolean)}
        />

        {isWriteLocked && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs font-semibold text-amber-800 flex items-center gap-2">
            <span>Direct purchase orders are disabled for stores under Central Kitchen replenishment. You must request stock transfers instead.</span>
          </div>
        )}

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveStatus(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                activeStatus === tab.key
                  ? 'bg-brand-orange text-white shadow-lg shadow-amber-500/20'
                  : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Search + Filter button + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200/50 items-center justify-between">
          <div className="flex-1 w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by PO number, supplier, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-gray-900 text-sm focus:outline-none placeholder-slate-600"
            />
            {search && (
              <button onClick={() => setSearch('')}><X size={13} className="text-gray-400 hover:text-gray-900" /></button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />
            <div className="relative" ref={filterContainerRef}>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  (fromDate || toDate)
                    ? 'bg-brand-orange/15 border-amber-500/30 text-brand-orange font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Filters</span>
                {(fromDate || toDate) && (
                  <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--pos-panel)]">
                    1
                  </span>
                )}
                <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="text-xs font-semibold text-gray-700">Filters</span>
                    {(fromDate || toDate) && (
                      <button
                        onClick={() => { setFromDate(''); setToDate(''); }}
                        className="text-[10px] text-amber-500 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {/* Date Range */}
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Date Range</p>
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      <button
                        type="button"
                        onClick={() => handleQuickFilter('today')}
                        className="text-[10px] text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors font-medium"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFilter('yesterday')}
                        className="text-[10px] text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors font-medium"
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFilter('7days')}
                        className="text-[10px] text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors font-medium"
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFilter('month')}
                        className="text-[10px] text-left px-2 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors font-medium"
                      >
                        This Month
                      </button>
                    </div>
                    <div className="space-y-2 border-t border-gray-100 pt-2">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">From</label>
                        <PosDateField
                          value={fromDate}
                          onChange={setFromDate}
                          max={toDate}
                          className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">To</label>
                        <PosDateField
                          value={toDate}
                          onChange={setToDate}
                          min={fromDate}
                          className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 border border-gray-200 rounded-lg bg-gray-50 px-2 py-1">
              <label htmlFor="po-sort" className="text-xs text-slate-500 shrink-0">Sort</label>
              <select
                id="po-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-gray-900 text-xs focus:outline-none cursor-pointer"
              >
                {PO_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                className="text-gray-500 hover:text-gray-900 transition"
                title={order === 'asc' ? 'Ascending' : 'Descending'}
              >
                {order === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {ordersPending ? (
          <div className="text-center py-16 text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-gray-400 text-lg mb-2">No purchase orders found</p>
            <p className="text-slate-600 text-sm mb-6">Create your first purchase order to get started</p>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              <Plus size={16} />
              Create Purchase Order
            </button>
          </div>
        ) : sortedAndFiltered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-gray-400 text-lg mb-2">No purchase orders match your filters</p>
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
                    render: (o) => <span className="font-semibold text-gray-900">{o.orderNumber}</span>,
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
                    render: (o) => <span className="text-slate-400">{o.supplierId?.name || 'Unknown Supplier'}</span>,
                  },
                  {
                    key: 'date', header: 'Date Created',
                    render: (o) => <span className="text-gray-500">{formatDate(o.createdAt)}</span>,
                  },
                  {
                    key: 'expected', header: 'Expected Date',
                    render: (o) => <span className="text-gray-500">{formatDate(o.expectedDate)}</span>,
                  },
                  {
                    key: 'items', header: 'Items / Qty',
                    render: (o) => {
                      const totalQty = o.items.reduce((sum, item) => sum + item.orderedQty, 0);
                      return (
                        <span className="text-gray-500 text-xs">
                          {o.items.length} items ({totalQty} units)
                        </span>
                      );
                    },
                  },
                  {
                    key: 'amount', header: 'Total Amount',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    render: (o) => <span className="text-amber-500 font-bold">{formatCurrency(o.totalAmount)}</span>,
                  },
                  {
                    key: 'actions', header: '',
                    render: (o) => (
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => openView(o)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 transition"
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                        {!isWriteLocked && o.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setSendTarget(o)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg text-xs font-semibold transition"
                          >
                            Send
                          </button>
                        )}
                        {!isWriteLocked && ['draft', 'sent'].includes(o.status) && (
                          <button
                            type="button"
                            onClick={() => openEdit(o)}
                            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 transition"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {!isWriteLocked && o.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(o)}
                            className="p-1.5 bg-slate-805 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition"
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
                      className="bg-white border border-gray-200/50 rounded-xl p-4 hover:border-gray-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-base font-semibold text-gray-900">
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
                            <div className="space-y-1.5 text-xs text-gray-500">
                              <p className="flex items-center gap-1.5 font-medium text-slate-400">
                                <Package size={13} className="text-purple-400 shrink-0" />
                                {order.supplierId?.name || 'Unknown Supplier'}
                              </p>
                              <p className="flex items-center gap-1.5">
                                <Calendar size={13} className="text-gray-400 shrink-0" />
                                {formatDate(order.createdAt)}
                              </p>
                              {order.expectedDate && (
                                <p className="flex items-center gap-1.5 text-[11px]">
                                  <Clock size={13} className="text-gray-400 shrink-0" />
                                  Expected: {formatDate(order.expectedDate)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openView(order)}
                              className="p-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-707 transition"
                              title="View Details"
                            >
                              <Eye size={12} />
                            </button>
                            {!isWriteLocked && order.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => setSendTarget(order)}
                                className="flex items-center gap-1 px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 rounded-lg text-[10px] font-semibold transition"
                              >
                                <Send size={11} />
                                Send
                              </button>
                            )}
                            {!isWriteLocked && ['draft', 'sent'].includes(order.status) && (
                              <button
                                type="button"
                                onClick={() => openEdit(order)}
                                className="p-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 transition"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            {!isWriteLocked && order.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(order)}
                                className="p-1 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-500 transition"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Items Summary */}
                        <div className="bg-gray-50 rounded-lg p-2.5 mt-2">
                          <div className="grid grid-cols-3 gap-2 text-[11px] mb-2">
                            <div>
                              <p className="text-gray-400">Items</p>
                              <p className="font-semibold text-slate-300">{order.items.length}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Quantity</p>
                              <p className="font-semibold text-slate-300">{orderedCount}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Total</p>
                              <p className="font-bold text-amber-500">{formatCurrency(order.totalAmount)}</p>
                            </div>
                          </div>

                          {/* Items List (collapsed) */}
                          <details className="group border-t border-slate-800/40 pt-1.5">
                            <summary className="text-[10px] text-amber-500 hover:text-brand-orange cursor-pointer font-medium list-none flex items-center gap-1 justify-between">
                              <span>Details ({order.items.length} items)</span>
                              <span className="group-open:rotate-90 transition">▶</span>
                            </summary>
                            <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto pr-1">
                              {order.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[10px] bg-slate-800/40 rounded px-1.5 py-1"
                                >
                                  <span className="text-slate-400 truncate max-w-[120px]">{item.itemName}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-400">{item.orderedQty} {item.unit}</span>
                                    {item.receivedQty > 0 && <span className="text-green-455 font-bold">✓ {item.receivedQty}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      </div>

                      {order.notes && (
                        <div className="text-[11px] text-gray-400 bg-slate-800/30 rounded px-2.5 py-1.5 mt-3 italic line-clamp-1">
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
          setIsReadOnly(false);
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
        readOnly={isReadOnly}
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
