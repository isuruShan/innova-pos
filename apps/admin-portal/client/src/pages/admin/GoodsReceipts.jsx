import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileCheck, Package, Edit2, Trash2, Calendar,
  CheckCircle, FileText, AlertCircle, TrendingUp, TrendingDown,
  Search, SlidersHorizontal, ChevronDown, X, ArrowDown, ArrowUp,
  List, LayoutGrid, Eye
} from 'lucide-react';
import api from '../../api/axios';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import GoodsReceiptFormModal from '../../components/inventory/GoodsReceiptFormModal';
import { useStoreContext } from '../../context/StoreContext';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import { formatCurrency } from '../../utils/format';
import PosDateField from '../../components/PosDateField';
import Badge from '../../components/Badge';
import ResponsiveTable from '../../components/ResponsiveTable';
import ViewModeToggle from '../../components/ViewModeToggle';

const TYPE_COLORS = {
  receipt: 'text-green-400 bg-green-500/10',
  return: 'text-red-400 bg-red-500/10',
};

const STATUS_COLORS = {
  draft: 'text-gray-500 bg-slate-500/10',
  confirmed: 'text-green-400 bg-green-500/10',
};

const GRN_SORT_OPTIONS = [
  { value: 'receiptDate', label: 'Date' },
  { value: 'receiptNumber', label: 'Number' },
  { value: 'totalAmount', label: 'Total Amount' },
  { value: 'status', label: 'Status' },
];
export default function GoodsReceipts() {
  const { selectedStoreId, isStoreReady, stores, selectStore } = useStoreContext();
  const [activeTab, setActiveTab] = useState('receipts');
  const filterContainerRef = useRef(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createFromPO, setCreateFromPO] = useState(null);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('receiptDate');
  const [order, setOrder] = useState('desc');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_goods_receipts');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

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

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_goods_receipts', mode);
  };

  const qc = useQueryClient();
  const { toast, showToast, clearToast } = useToast();

  const { data: receipts = [], isPending: receiptsPending } = useQuery({
    queryKey: ['goods-receipts', selectedStoreId],
    queryFn: () => api.get('/goods-receipts').then((r) => r.data),
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

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders', selectedStoreId],
    queryFn: () => api.get('/purchase-orders').then((r) => r.data),
    enabled: isStoreReady,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/goods-receipts', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] });
      setFormOpen(false);
      setCreateFromPO(null);
      showToast('Goods receipt created successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to create goods receipt'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/goods-receipts/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] });
      setFormOpen(false);
      setEditing(null);
      showToast('Goods receipt updated successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to update goods receipt'));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id) => api.post(`/goods-receipts/${id}/confirm`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      setConfirmTarget(null);
      showToast('Goods receipt confirmed successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to confirm goods receipt'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/goods-receipts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] });
      setDeleteTarget(null);
      showToast('Goods receipt deleted successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to delete goods receipt'));
    },
  });

  const sortedAndFiltered = useMemo(() => {
    const type = activeTab === 'receipts' ? 'receipt' : 'return';
    let result = receipts.filter((r) => r.type === type);

    // 1. Status Filter
    if (statusFilter.length > 0) {
      result = result.filter((r) => statusFilter.includes(r.status));
    }

    // 2. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.receiptNumber?.toLowerCase().includes(q) ||
        r.supplierId?.name?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q) ||
        r.purchaseOrderId?.orderNumber?.toLowerCase().includes(q)
      );
    }

    // 3. Date Range Filter
    if (fromDate) {
      const from = new Date(`${fromDate}T00:00:00`);
      result = result.filter((r) => new Date(r.receiptDate) >= from);
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      result = result.filter((r) => new Date(r.receiptDate) <= to);
    }

    // 4. Sorting
    result.sort((a, b) => {
      let aVal = a[sort];
      let bVal = b[sort];

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
  }, [receipts, activeTab, search, fromDate, toDate, statusFilter, sort, order]);

  const stats = useMemo(() => {
    const receiptsList = receipts.filter((r) => r.type === 'receipt');
    const returnsList = receipts.filter((r) => r.type === 'return');
    return {
      receipts: {
        total: receiptsList.length,
        draft: receiptsList.filter((r) => r.status === 'draft').length,
        confirmed: receiptsList.filter((r) => r.status === 'confirmed').length,
      },
      returns: {
        total: returnsList.length,
        draft: returnsList.filter((r) => r.status === 'draft').length,
        confirmed: returnsList.filter((r) => r.status === 'confirmed').length,
      },
    };
  }, [receipts]);


  const openAdd = () => {
    setEditing(null);
    setCreateFromPO(null);
    setIsReadOnly(false);
    setFormOpen(true);
  };

  const openEdit = (receipt) => {
    setEditing(receipt);
    setCreateFromPO(null);
    setIsReadOnly(false);
    setFormOpen(true);
  };

  const openCreateFromPO = (po) => {
    setCreateFromPO(po);
    setEditing(null);
    setIsReadOnly(false);
    setFormOpen(true);
  };

  const openView = (receipt) => {
    setEditing(receipt);
    setCreateFromPO(null);
    setIsReadOnly(true);
    setFormOpen(true);
  };

  const handleConfirm = () => {
    if (confirmTarget) {
      confirmMutation.mutate(confirmTarget._id);
    }
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget._id);
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

  const pendingPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (!['sent', 'partial'].includes(po.status)) return false;
      const receivedCount = po.items?.reduce((sum, i) => sum + (i.receivedQty || 0), 0) || 0;
      const orderedCount = po.items?.reduce((sum, i) => sum + (i.orderedQty || 0), 0) || 0;
      if (receivedCount >= orderedCount && orderedCount > 0) return false;
      const hasDraftGRN = receipts.some(
        (r) => r.purchaseOrderId && (r.purchaseOrderId._id === po._id || r.purchaseOrderId === po._id) && r.status === 'draft'
      );
      if (hasDraftGRN) return false;
      return true;
    });
  }, [purchaseOrders, receipts]);

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Goods Receipts & Returns</h1>
            <p className="text-gray-400 text-sm mt-1">
              {stats.receipts.total} receipt{stats.receipts.total !== 1 ? 's' : ''} · {stats.returns.total} return{stats.returns.total !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm"
          >
            <Plus size={16} />
            {activeTab === 'receipts' ? 'New GRN' : 'Add Return'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200/50 overflow-x-auto no-scrollbar">
          {[
            { key: 'receipts', label: 'Receipts', count: stats.receipts.total },
            { key: 'returns', label: 'Returns', count: stats.returns.total },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-amber-500 text-brand-orange'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>
        {/* Search + Filter button + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200/50 items-center justify-between">
          {stores.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
              <span className="text-xs text-gray-500 font-semibold">Store:</span>
              <select
                value={selectedStoreId || ''}
                onChange={(e) => selectStore(e.target.value)}
                className="bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer w-full sm:w-auto"
              >
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by number, supplier, notes, PO..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-gray-900 text-sm focus:outline-none placeholder-slate-650"
            />
            {search && (
              <button onClick={() => setSearch('')}><X size={13} className="text-gray-400 hover:text-white" /></button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            {/* View toggle */}
            <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />

            <div className="relative" ref={filterContainerRef}>
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  (fromDate || toDate || statusFilter.length > 0)
                    ? 'bg-brand-orange/15 border-amber-500/30 text-brand-orange font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Filters</span>
                {(fromDate || toDate || statusFilter.length > 0) && (
                  <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--pos-panel)]">
                    {(fromDate || toDate ? 1 : 0) + statusFilter.length}
                  </span>
                )}
                <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="text-xs font-semibold text-slate-350">Filters</span>
                    {(fromDate || toDate || statusFilter.length > 0) && (
                      <button
                        onClick={() => { setFromDate(''); setToDate(''); setStatusFilter([]); }}
                        className="text-[10px] text-amber-450 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {/* Status Filter */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-450 uppercase tracking-wider mb-2">Status</p>
                    <div className="flex flex-col gap-1">
                      {['draft', 'confirmed'].map((status) => {
                        const active = statusFilter.includes(status);
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(prev => 
                              active ? prev.filter(s => s !== status) : [...prev, status]
                            )}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition ${
                              active
                                ? 'bg-brand-orange/15 text-brand-orange font-semibold border-l-2 border-amber-500'
                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                          >
                            <span className="capitalize">{status}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-[11px] font-semibold text-slate-455 uppercase tracking-wider mb-2">Date Range</p>
                    <div className="space-y-2">
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

            <label htmlFor="grn-sort" className="text-xs text-slate-550 shrink-0 ml-1">Sort</label>
            <select
              id="grn-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {GRN_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
              title={order === 'asc' ? 'Ascending' : 'Descending'}
            >
              {order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>
        </div>

        {/* Pending POs Quick Create */}
        {activeTab === 'receipts' && pendingPOs.length > 0 && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={18} className="text-sky-400" />
                  <h3 className="text-sm font-semibold text-sky-400">Pending Purchase Orders</h3>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {pendingPOs.length} order{pendingPOs.length !== 1 ? 's' : ''} awaiting goods receipt
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingPOs.slice(0, 3).map((po) => (
                    <button
                      key={po._id}
                      type="button"
                      onClick={() => openCreateFromPO(po)}
                      className="flex items-center gap-2 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                    >
                      <FileText size={12} />
                      {po.orderNumber}
                    </button>
                  ))}
                  {pendingPOs.length > 3 && (
                    <span className="text-xs text-gray-400 flex items-center px-2">
                      +{pendingPOs.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Receipts/Returns List */}
        {receiptsPending ? (
          <div className="text-center py-16 text-slate-550">Loading...</div>
        ) : receipts.filter((r) => r.type === (activeTab === 'receipts' ? 'receipt' : 'return')).length === 0 ? (
          <div className="text-center py-16">
            <Package size={48} className="mx-auto mb-4 text-slate-650 opacity-40" />
            <p className="text-gray-400 text-lg mb-2">
              No {activeTab === 'receipts' ? 'receipts' : 'returns'} found
            </p>
            <p className="text-slate-600 text-sm mb-6">
              {activeTab === 'receipts'
                ? 'Create a goods receipt to record incoming stock'
                : 'Create a goods return to record returned items'}
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              <Plus size={16} />
              Create {activeTab === 'receipts' ? 'Receipt' : 'Return'}
            </button>
          </div>
        ) : sortedAndFiltered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto mb-4 text-slate-650 opacity-40" />
            <p className="text-slate-555 text-lg mb-2">No results match your filters</p>
            <p className="text-slate-600 text-sm mb-6">Try adjusting your search query, status, or date range</p>
          </div>
        ) : (
          <div>
            {viewMode === 'table' ? (
              <ResponsiveTable
                rows={sortedAndFiltered}
                rowKey={(r) => r._id}
                loading={false}
                columns={[
                  {
                    key: 'receiptNumber', header: 'GRN Number',
                    mobilePrimary: true,
                    render: (r) => <span className="font-semibold text-gray-900">{r.receiptNumber}</span>,
                  },
                  {
                    key: 'status', header: 'Status',
                    render: (r) => (
                      <Badge label={r.status} variant={r.status === 'confirmed' ? 'ok' : 'low'} />
                    ),
                  },
                  {
                    key: 'supplier', header: 'Supplier',
                    mobileSecondary: true,
                    render: (r) => <span className="text-gray-700 font-medium">{r.supplierId?.name || 'Unknown Supplier'}</span>,
                  },
                  {
                    key: 'po', header: 'PO Ref',
                    render: (r) => <span className="text-gray-500 font-medium">{r.purchaseOrderId?.orderNumber || '—'}</span>,
                  },
                  {
                    key: 'date', header: 'Date',
                    render: (r) => <span className="text-gray-500">{formatDate(r.receiptDate)}</span>,
                  },
                  {
                    key: 'items', header: 'Items / Qty',
                    render: (r) => {
                      const totalQty = r.items.reduce((sum, item) => sum + (r.type === 'receipt' ? item.acceptedQty : item.receivedQty), 0);
                      return (
                        <span className="text-gray-500 text-xs">
                          {r.items.length} items ({totalQty} units)
                        </span>
                      );
                    },
                  },
                  {
                    key: 'amount', header: 'Total Amount',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    render: (r) => <span className="text-amber-450 font-bold">{formatCurrency(r.totalAmount)}</span>,
                  },
                  {
                    key: 'actions', header: '',
                    render: (r) => (
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => openView(r)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-205 rounded-lg text-gray-700 transition"
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                        {r.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setConfirmTarget(r)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-455 border border-green-500/20 rounded-lg text-xs font-semibold transition"
                          >
                            Confirm
                          </button>
                        )}
                        {r.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-205 rounded-lg text-gray-700 transition"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {r.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(r)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-red-500 transition"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedAndFiltered.map((receipt) => {
                  const totalItems = receipt.items.length;
                  const totalQty = receipt.items.reduce((sum, i) => {
                    return sum + (receipt.type === 'receipt' ? i.acceptedQty : i.receivedQty);
                  }, 0);
                  return (
                    <div
                      key={receipt._id}
                      className="bg-white border border-gray-200/50 rounded-xl p-3.5 hover:border-gray-300 transition flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="text-base font-semibold text-gray-900">
                              {receipt.receiptNumber}
                            </h3>
                            <Badge label={receipt.status} variant={receipt.status === 'confirmed' ? 'ok' : 'low'} className="text-[10px] px-1.5 py-0.5" />
                          </div>
                          <div className="space-y-1 text-xs text-gray-500">
                            <p className="flex items-center gap-1 font-medium text-slate-350">
                              <Package size={12} className="text-purple-400 shrink-0" />
                              {receipt.supplierId?.name || 'Unknown Supplier'}
                            </p>
                            {receipt.purchaseOrderId && (
                              <p className="flex items-center gap-1 text-[11px]">
                                <FileCheck size={12} className="text-sky-400 shrink-0" />
                                PO: {receipt.purchaseOrderId.orderNumber}
                              </p>
                            )}
                            <p className="flex items-center gap-1 text-[11px]">
                              <Calendar size={12} className="text-gray-400 shrink-0" />
                              {formatDate(receipt.receiptDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openView(receipt)}
                            className="p-1 bg-gray-50 hover:bg-gray-100 border border-gray-205 rounded-lg text-gray-700 transition"
                            title="View Details"
                          >
                            <Eye size={12} />
                          </button>
                          {receipt.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => setConfirmTarget(receipt)}
                              className="p-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-lg text-[10px] font-semibold transition"
                            >
                              Confirm
                            </button>
                          )}
                          {receipt.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => openEdit(receipt)}
                              className="p-1 bg-gray-50 hover:bg-gray-100 border border-gray-205 rounded-lg text-gray-700 transition"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                          {receipt.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(receipt)}
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
                            <p className="font-semibold text-slate-300">{totalItems}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Quantity</p>
                            <p className="font-semibold text-slate-300">{totalQty}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Total</p>
                            <p className="font-bold text-amber-455">{formatCurrency(receipt.totalAmount)}</p>
                          </div>
                        </div>

                        {/* Items List (collapsed) */}
                        <details className="group border-t border-slate-800/40 pt-1.5">
                          <summary className="text-[10px] text-amber-450 hover:text-brand-orange cursor-pointer font-medium list-none flex items-center gap-1 justify-between">
                            <span>Details ({totalItems} items)</span>
                            <span className="group-open:rotate-90 transition">▶</span>
                          </summary>
                          <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto pr-1">
                            {receipt.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[10px] bg-slate-800/40 rounded px-1.5 py-1"
                              >
                                <span className="text-slate-350 truncate max-w-[120px]">{item.itemName}</span>
                                <div className="flex items-center gap-2">
                                  {receipt.type === 'receipt' ? (
                                    <>
                                      <span className="text-gray-400">Rcvd: {item.receivedQty}</span>
                                      <span className="text-green-455">Acpt: {item.acceptedQty}</span>
                                    </>
                                  ) : (
                                    <span className="text-red-400">Ret: {item.receivedQty}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <GoodsReceiptFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setCreateFromPO(null);
          setIsReadOnly(false);
        }}
        editing={editing}
        createFromPO={createFromPO}
        type={editing ? editing.type : (activeTab === 'receipts' ? 'receipt' : 'return')}
        suppliers={suppliers}
        inventory={inventory}
        purchaseOrders={activeTab === 'receipts' ? pendingPOs : purchaseOrders}
        receipts={receipts}
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmTarget}
        title={`Confirm ${confirmTarget?.type === 'receipt' ? 'Goods Receipt' : 'Goods Return'}`}
        message={
          confirmTarget
            ? `Are you sure you want to confirm ${confirmTarget.receiptNumber}? This will update inventory levels and cannot be undone.`
            : ''
        }
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant="confirm"
        isLoading={confirmMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Goods Receipt"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.receiptNumber}? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="delete"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast toast={toast} onDismiss={clearToast} />
    </div>
  );
}
