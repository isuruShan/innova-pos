import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileCheck, Package, Edit2, Trash2, Calendar,
  CheckCircle, FileText, AlertCircle, TrendingUp, TrendingDown,
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

const TYPE_COLORS = {
  receipt: 'text-green-400 bg-green-500/10',
  return: 'text-red-400 bg-red-500/10',
};

const STATUS_COLORS = {
  draft: 'text-slate-400 bg-slate-500/10',
  confirmed: 'text-green-400 bg-green-500/10',
};

export default function GoodsReceipts() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [activeTab, setActiveTab] = useState('receipts');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createFromPO, setCreateFromPO] = useState(null);
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

  const filtered = useMemo(() => {
    const type = activeTab === 'receipts' ? 'receipt' : 'return';
    return receipts.filter((r) => r.type === type);
  }, [receipts, activeTab]);

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
        <div className="flex gap-2 mb-6 border-b border-slate-700/50 pb-0">
          {[
            { key: 'receipts', label: 'Receipts', count: stats.receipts.total },
            { key: 'returns', label: 'Returns', count: stats.returns.total },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
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
        ) : filtered.length === 0 ? (
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
        ) : (
          <div className="space-y-3">
            {filtered.map((receipt) => {
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
