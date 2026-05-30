import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileCheck, Package, Edit2, Trash2, Calendar,
  CheckCircle, FileText, AlertCircle, TrendingUp, TrendingDown,
  Search, SlidersHorizontal, ChevronDown, X, ArrowDown, ArrowUp
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Toast from '../../components/Toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import GoodsReceiptFormModal from '../../components/inventory/GoodsReceiptFormModal';
import { useStoreContext } from '../../context/StoreContext';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { formatCurrency } from '../../utils/format';
import PosDateField from '../../components/PosDateField';

const TYPE_COLORS = {
  receipt: 'text-green-400 bg-green-500/10',
  return: 'text-red-400 bg-red-500/10',
};

const STATUS_COLORS = {
  draft: 'text-slate-400 bg-slate-500/10',
  confirmed: 'text-green-400 bg-green-500/10',
};

const GRN_SORT_OPTIONS = [
  { value: 'receiptDate', label: 'Date' },
  { value: 'receiptNumber', label: 'Number' },
  { value: 'totalAmount', label: 'Total Amount' },
  { value: 'status', label: 'Status' },
];

export default function GoodsReceipts() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [activeTab, setActiveTab] = useState('receipts');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
    setFormOpen(true);
  };

  const openEdit = (receipt) => {
    setEditing(receipt);
    setCreateFromPO(null);
    setFormOpen(true);
  };

  const openCreateFromPO = (po) => {
    setCreateFromPO(po);
    setEditing(null);
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
    return purchaseOrders.filter((po) => ['sent', 'partial'].includes(po.status));
  }, [purchaseOrders]);

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--pos-text-primary)]">Goods Receipts & Returns</h1>
            <p className="text-slate-500 text-sm mt-1">
              {stats.receipts.total} receipt{stats.receipts.total !== 1 ? 's' : ''} · {stats.returns.total} return{stats.returns.total !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20 text-sm"
          >
            <Plus size={16} />
            New GRN
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700/50 overflow-x-auto no-scrollbar">
          {[
            { key: 'receipts', label: 'Receipts', count: stats.receipts.total },
            { key: 'returns', label: 'Returns', count: stats.returns.total },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Search + Filter button + Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 flex items-center gap-2 bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl px-3 py-2">
            <Search size={15} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder={`Search by number, supplier, notes, PO...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-600"
            />
            {search && (
              <button onClick={() => setSearch('')}><X size={13} className="text-slate-500 hover:text-white" /></button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                showFilters || fromDate || toDate || statusFilter.length > 0
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'bg-[var(--pos-panel)] border-slate-700/50 text-slate-400 hover:text-[var(--pos-text-primary)]'
              }`}
            >
              <SlidersHorizontal size={14} />
              Filters
              {(fromDate || toDate || statusFilter.length > 0) && (
                <span className="bg-amber-500 text-white text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {(fromDate || toDate ? 1 : 0) + (statusFilter.length > 0 ? 1 : 0)}
                </span>
              )}
              <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            <label htmlFor="grn-sort" className="text-xs text-slate-500 shrink-0 ml-2">Sort</label>
            <select
              id="grn-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-[var(--pos-panel)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {GRN_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-2 rounded-xl bg-[var(--pos-panel)] border border-slate-700 text-slate-400 hover:text-[var(--pos-text-primary)] transition"
              title={order === 'asc' ? 'Ascending' : 'Descending'}
            >
              {order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 mb-6 space-y-4">
            {/* Status Filter */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {['draft', 'confirmed'].map((status) => {
                  const active = statusFilter.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(prev => 
                        active ? prev.filter(s => s !== status) : [...prev, status]
                      )}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition ${
                        active
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-400">Date Range</p>
                {(fromDate || toDate) && (
                  <button
                    onClick={() => { setFromDate(''); setToDate(''); }}
                    className="text-xs text-amber-500 hover:text-amber-400"
                  >
                    Clear Range
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setQuickDateRange(1)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-[var(--pos-surface-inset)] text-slate-400 hover:text-[var(--pos-text-primary)] transition"
                >
                  Last 24 Hours
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDateRange(3)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-[var(--pos-surface-inset)] text-slate-400 hover:text-[var(--pos-text-primary)] transition"
                >
                  Last 3 Days
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDateRange(7)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-[var(--pos-surface-inset)] text-slate-400 hover:text-[var(--pos-text-primary)] transition"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDateRange(30)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-slate-700 bg-[var(--pos-surface-inset)] text-slate-400 hover:text-[var(--pos-text-primary)] transition"
                >
                  Last 30 Days
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">From</label>
                  <PosDateField
                    value={fromDate}
                    onChange={setFromDate}
                    max={toDate}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500 block mb-1">To</label>
                  <PosDateField
                    value={toDate}
                    onChange={setToDate}
                    min={fromDate}
                    className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending POs Quick Create */}
        {activeTab === 'receipts' && pendingPOs.length > 0 && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={18} className="text-sky-400" />
                  <h3 className="text-sm font-semibold text-sky-400">Pending Purchase Orders</h3>
                </div>
                <p className="text-xs text-slate-400 mb-3">
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
                    <span className="text-xs text-slate-500 flex items-center px-2">
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
          <div className="text-center py-16 text-slate-500">Loading...</div>
        ) : receipts.filter((r) => r.type === (activeTab === 'receipts' ? 'receipt' : 'return')).length === 0 ? (
          <div className="text-center py-16">
            <Package size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500 text-lg mb-2">
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
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              <Plus size={16} />
              Create {activeTab === 'receipts' ? 'Receipt' : 'Return'}
            </button>
          </div>
        ) : sortedAndFiltered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto mb-4 text-slate-600" />
            <p className="text-slate-500 text-lg mb-2">No results match your filters</p>
            <p className="text-slate-600 text-sm mb-6">Try adjusting your search query, status, or date range</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAndFiltered.map((receipt) => {

              const totalItems = receipt.items.length;
              const totalQty = receipt.items.reduce((sum, i) => {
                return sum + (receipt.type === 'receipt' ? i.acceptedQty : i.receivedQty);
              }, 0);

              return (
                <div
                  key={receipt._id}
                  className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--pos-text-primary)]">
                          {receipt.receiptNumber}
                        </h3>
                        <span
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[receipt.status]
                          }`}
                        >
                          {receipt.status === 'draft' ? <FileText size={12} /> : <CheckCircle size={12} />}
                          {receipt.status.charAt(0).toUpperCase() + receipt.status.slice(1)}
                        </span>
                        <span
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            TYPE_COLORS[receipt.type]
                          }`}
                        >
                          {receipt.type === 'receipt' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {receipt.type === 'receipt' ? 'Receipt' : 'Return'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Package size={14} />
                          {receipt.supplierId?.name || 'Unknown Supplier'}
                        </span>
                        {receipt.purchaseOrderId && (
                          <span className="flex items-center gap-1">
                            <FileCheck size={14} />
                            PO: {receipt.purchaseOrderId.orderNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(receipt.receiptDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {receipt.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget(receipt)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-xs font-medium transition"
                        >
                          <CheckCircle size={13} />
                          Confirm
                        </button>
                      )}
                      {receipt.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => openEdit(receipt)}
                          className="w-8 h-8 bg-slate-700/50 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {receipt.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(receipt)}
                          className="w-8 h-8 bg-slate-700/50 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div className="bg-[var(--pos-surface-inset)] rounded-lg p-3 mb-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Items</p>
                        <p className="text-sm font-medium text-[var(--pos-text-primary)]">
                          {totalItems} item{totalItems !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Total Quantity</p>
                        <p className="text-sm font-medium text-[var(--pos-text-primary)]">{totalQty} units</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Total Amount</p>
                        <p className="text-sm font-medium text-amber-400">{formatCurrency(receipt.totalAmount)}</p>
                      </div>
                    </div>

                    {/* Items List (collapsed) */}
                    <details className="group">
                      <summary className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer font-medium list-none flex items-center gap-1">
                        <span className="group-open:rotate-90 transition">▶</span>
                        View {totalItems} item{totalItems !== 1 ? 's' : ''}
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {receipt.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1.5"
                          >
                            <span className="text-slate-300">{item.itemName}</span>
                            <div className="flex items-center gap-3">
                              {receipt.type === 'receipt' ? (
                                <>
                                  <span className="text-slate-500">Received: {item.receivedQty}</span>
                                  <span className="text-green-400">Accepted: {item.acceptedQty}</span>
                                  {item.rejectedQty > 0 && (
                                    <span className="text-red-400">Rejected: {item.rejectedQty}</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-red-400">Returned: {item.receivedQty}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>

                  {receipt.notes && (
                    <div className="text-xs text-slate-500 bg-slate-800/30 rounded px-3 py-2 mb-2">
                      <span className="font-medium">Notes:</span> {receipt.notes}
                    </div>
                  )}
                  {receipt.type === 'return' && receipt.returnReason && (
                    <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                      <span className="font-medium">Return Reason:</span> {receipt.returnReason}
                    </div>
                  )}
                </div>
              );
            })}
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
        }}
        editing={editing}
        createFromPO={createFromPO}
        type={activeTab === 'receipts' ? 'receipt' : 'return'}
        suppliers={suppliers}
        inventory={inventory}
        purchaseOrders={purchaseOrders}
        onSubmit={(data) => {
          if (editing) {
            updateMutation.mutate({ id: editing._id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
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
