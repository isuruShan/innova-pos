import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FileText, Send, Edit2, Trash2, Calendar, Package,
  DollarSign, AlertCircle, CheckCircle, XCircle, Clock,
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

export default function PurchaseOrders() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [activeStatus, setActiveStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sendTarget, setSendTarget] = useState(null);
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

  const filtered = useMemo(() => {
    if (activeStatus === 'all') return orders;
    return orders.filter((o) => o.status === activeStatus);
  }, [orders, activeStatus]);

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
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
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

        {/* Orders List */}
        {ordersPending ? (
          <div className="text-center py-16 text-slate-500">Loading orders...</div>
        ) : filtered.length === 0 ? (
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
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const StatusIcon = STATUS_ICONS[order.status];
              const receivedCount = order.items.reduce((sum, i) => sum + i.receivedQty, 0);
              const orderedCount = order.items.reduce((sum, i) => sum + i.orderedQty, 0);
              const isFullyReceived = receivedCount >= orderedCount && orderedCount > 0;

              return (
                <div
                  key={order._id}
                  className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[var(--pos-text-primary)]">
                          {order.orderNumber}
                        </h3>
                        <span
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_COLORS[order.status]
                          }`}
                        >
                          <StatusIcon size={12} />
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Package size={14} />
                          {order.supplierId?.name || 'Unknown Supplier'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(order.createdAt)}
                        </span>
                        {order.expectedDate && (
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            Expected: {formatDate(order.expectedDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => setSendTarget(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-lg text-xs font-medium transition"
                        >
                          <Send size={13} />
                          Send
                        </button>
                      )}
                      {['draft', 'sent'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => openEdit(order)}
                          className="w-8 h-8 bg-slate-700/50 hover:bg-slate-600 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      {order.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(order)}
                          className="w-8 h-8 bg-slate-700/50 hover:bg-red-500/20 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div className="bg-[var(--pos-surface-inset)] rounded-lg p-3 mb-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Items</p>
                        <p className="text-sm font-medium text-[var(--pos-text-primary)]">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Total Ordered</p>
                        <p className="text-sm font-medium text-[var(--pos-text-primary)]">
                          {orderedCount} units
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Total Amount</p>
                        <p className="text-sm font-medium text-amber-400 flex items-center gap-1">
                          <DollarSign size={14} />
                          {formatCurrency(order.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Items List (collapsed) */}
                    <details className="group">
                      <summary className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer font-medium list-none flex items-center gap-1">
                        <span className="group-open:rotate-90 transition">▶</span>
                        View {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1.5"
                          >
                            <span className="text-slate-300">{item.itemName}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">
                                {item.orderedQty} {item.unit}
                              </span>
                              {item.receivedQty > 0 && (
                                <span className="text-green-400">
                                  ✓ {item.receivedQty} received
                                </span>
                              )}
                              <span className="text-amber-400 font-medium">
                                {formatCurrency(item.unitPrice * item.orderedQty)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>

                  {order.notes && (
                    <div className="text-xs text-slate-500 bg-slate-800/30 rounded px-3 py-2">
                      <span className="font-medium">Notes:</span> {order.notes}
                    </div>
                  )}
                </div>
              );
            })}
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
