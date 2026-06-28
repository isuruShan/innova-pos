import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft, CheckCircle, XCircle, Loader2, Save,
  Eye, Truck, SendHorizontal, Clock
} from 'lucide-react';
import api from '../../api/axios';
import CenteredModal from '../CenteredModal';
import { useStoreContext } from '../../context/StoreContext';
import { useToast } from '../../hooks/useToast';

export default function StockTransfersManager({ storeId }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { stores } = useStoreContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(null);
  const [detailTransfer, setDetailTransfer] = useState(null);
  const [targetStoreId, setTargetStoreId] = useState('');
  const [itemsToSend, setItemsToSend] = useState([]);
  const [newTransferItemId, setNewTransferItemId] = useState('');
  const [newTransferQty, setNewTransferQty] = useState('');
  const [formError, setFormError] = useState('');
  const [receivedQtys, setReceivedQtys] = useState({});

  const { data: inventoryItems = [], isPending: itemsLoading } = useQuery({
    queryKey: ['inventory', storeId],
    queryFn: () => api.get('/inventory').then((r) => r.data),
    enabled: !!storeId,
  });

  const { data: transfers = [], isPending: transfersLoading } = useQuery({
    queryKey: ['transfers', storeId],
    queryFn: () => api.get('/advanced-inventory/transfers', { params: { storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  // Request transfer with pending status (no stock deduction yet)
  const createTransferMutation = useMutation({
    mutationFn: (data) => api.post('/advanced-inventory/transfers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', storeId] });
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Transfer request sent to central kitchen', 'success');
      closeModal();
    },
    onError: (err) => setFormError(err.response?.data?.message || 'Failed to send request'),
  });

  // Cancel a pending request
  const cancelRequestMutation = useMutation({
    mutationFn: (id) => api.post(`/advanced-inventory/transfers/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', storeId] });
      showToast('Transfer request cancelled', 'warning');
      setDetailTransfer(null);
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to cancel request', 'error'),
  });

  const receiveTransferMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/advanced-inventory/transfers/${id}/receive`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', storeId] });
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Stock received and added to inventory', 'success');
      setReceiveModalOpen(null);
      setDetailTransfer(null);
      setReceivedQtys({});
    },
  });

  const rejectTransferMutation = useMutation({
    mutationFn: (id) => api.post(`/advanced-inventory/transfers/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', storeId] });
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Transfer rejected and stock returned', 'warning');
      setReceiveModalOpen(null);
      setDetailTransfer(null);
    },
  });

  const otherStores = useMemo(() => stores.filter((s) => String(s._id) !== String(storeId)), [stores, storeId]);

  const selectedStore = useMemo(() => {
    return stores.find((s) => String(s._id) === String(storeId));
  }, [stores, storeId]);

  const isStoreUnderCentralKitchen = useMemo(() => {
    return selectedStore && selectedStore.replenishmentModel === 'central_kitchen';
  }, [selectedStore]);

  const centralKitchenStore = useMemo(() => {
    return stores.find((s) => s.isCentralKitchen === true);
  }, [stores]);

  const openCreate = () => {
    setTargetStoreId(isStoreUnderCentralKitchen && centralKitchenStore ? String(centralKitchenStore._id) : '');
    setItemsToSend([]);
    setFormError('');
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setItemsToSend([]); setNewTransferItemId(''); setNewTransferQty(''); };

  const handleAddItem = () => {
    if (!newTransferItemId) return;
    const qty = parseFloat(newTransferQty);
    if (isNaN(qty) || qty <= 0) return;
    const match = inventoryItems.find((i) => i._id === newTransferItemId);
    if (!match) return;
    if (itemsToSend.some((i) => i.inventoryItemId === newTransferItemId)) { showToast('Item already added', 'warning'); return; }
    setItemsToSend((prev) => [...prev, { inventoryItemId: newTransferItemId, itemName: match.itemName, qtySent: qty, unit: match.unit }]);
    setNewTransferItemId(''); setNewTransferQty('');
  };

  const handleRemoveItem = (itemId) => setItemsToSend((prev) => prev.filter((i) => i.inventoryItemId !== itemId));

  const handleSendRequest = (e) => {
    e.preventDefault(); setFormError('');
    if (!targetStoreId) { setFormError('Please select the destination store'); return; }
    if (itemsToSend.length === 0) { setFormError('Please add at least one item'); return; }
    createTransferMutation.mutate({ sourceStoreId: targetStoreId, targetStoreId: storeId, items: itemsToSend, status: 'pending' });
  };

  const openReceive = (t) => {
    setReceiveModalOpen(t);
    const qtys = {};
    t.items.forEach((i) => { qtys[String(i.inventoryItemId?._id || i.inventoryItemId)] = i.qtySent; });
    setReceivedQtys(qtys);
  };

  const handleCommitReceipt = () => {
    if (!receiveModalOpen) return;
    receiveTransferMutation.mutate({
      id: receiveModalOpen._id,
      data: { items: Object.keys(receivedQtys).map((k) => ({ inventoryItemId: k, qtyReceived: receivedQtys[k] })) }
    });
  };

  const getStatusBadge = (status) => ({
    received: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
    shipped: 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  }[status] || 'bg-gray-50 text-gray-600 border-gray-200');

  if (itemsLoading || transfersLoading) {
    return (<div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="animate-spin mr-2" size={20} />Loading stock transfers...</div>);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center bg-[var(--pos-panel)] p-4 rounded-2xl border border-[var(--pos-border)] shadow-sm">
        <div>
          <h4 className="font-bold text-[var(--pos-text-primary)] text-sm">Stock Transfers</h4>
          <p className="text-xs text-[var(--pos-text-secondary)] mt-0.5">Request stock from the central kitchen or another store.</p>
        </div>
        {otherStores.length > 0 && (
          <button type="button" onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition">
            <ArrowRightLeft size={14} /> Request Transfer
          </button>
        )}
      </div>

      {/* Transfer List */}
      {transfers.length === 0 ? (
        <div className="text-center py-12 bg-[var(--pos-panel)] rounded-2xl border border-[var(--pos-border)] text-[var(--pos-text-secondary)]">
          <ArrowRightLeft size={36} className="mx-auto opacity-35 mb-2 animate-pulse" />
          <p className="text-sm">No stock transfers yet</p>
          <p className="text-xs opacity-60 mt-1">Request stock from the central kitchen using the button above</p>
        </div>
      ) : (
        <div className="bg-[var(--pos-panel)] border border-[var(--pos-border)] rounded-2xl shadow-sm divide-y divide-[var(--pos-border)] overflow-hidden">
          {transfers.map((t) => {
            const isOutgoing = String(t.sourceStoreId?._id || t.sourceStoreId) === String(storeId);
            const partnerStore = isOutgoing ? t.targetStoreId?.name : t.sourceStoreId?.name;
            const isPendingIncoming = !isOutgoing && t.status === 'pending';
            const isShippedIncoming = !isOutgoing && t.status === 'shipped';
            const isPendingOutgoing = isOutgoing && t.status === 'pending';

            return (
              <div key={t._id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-[var(--pos-surface-hover,rgba(255,255,255,0.04))] transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold ${isOutgoing ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                    {isOutgoing ? 'OUT' : 'IN'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-[var(--pos-text-primary)] text-xs block truncate">
                      {t.transferNumber}
                      {isOutgoing ? ` \u2192 ${partnerStore}` : ` \u2190 ${partnerStore}`}
                    </span>
                    <span className="text-[10px] text-[var(--pos-text-secondary)] block mt-0.5">
                      {t.items?.length || 0} items
                      {t.shippedAt ? ` \u00b7 ${new Date(t.shippedAt).toLocaleDateString()}` : t.createdAt ? ` \u00b7 Requested ${new Date(t.createdAt).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${getStatusBadge(t.status)}`}>
                    {t.status === 'pending' ? (
                      <span className="flex items-center gap-1"><Clock size={9} /> PENDING</span>
                    ) : t.status.toUpperCase()}
                  </span>

                  {/* Incoming shipped: receive */}
                  {isShippedIncoming && (
                    <button type="button" onClick={() => openReceive(t)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1">
                      <CheckCircle size={11} /> Receive
                    </button>
                  )}

                  {/* Pending incoming (from our request): shows awaiting */}
                  {isPendingIncoming && (
                    <span className="px-2.5 py-1 text-[10px] text-amber-400 font-semibold animate-pulse">Awaiting dispatch...</span>
                  )}

                  {/* Pending outgoing (this store requested): can cancel */}
                  {isPendingOutgoing && (
                    <button type="button" onClick={() => setDetailTransfer(t)}
                      className="px-3 py-1.5 bg-[var(--pos-surface-inset,#1e293b)] hover:bg-red-500/10 border border-[var(--pos-border)] hover:border-red-400 text-[var(--pos-text-secondary)] hover:text-red-400 text-[10px] font-bold rounded-lg transition">
                      Cancel
                    </button>
                  )}

                  {/* View details for all */}
                  <button type="button" onClick={() => setDetailTransfer(t)}
                    className="px-3 py-1.5 bg-[var(--pos-surface-inset,#1e293b)] border border-[var(--pos-border)] text-[var(--pos-text-secondary)] text-[10px] font-bold rounded-lg transition hover:bg-[var(--pos-border)] flex items-center gap-1">
                    <Eye size={11} /> View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- DETAIL MODAL ---- */}
      {detailTransfer && (() => {
        const t = detailTransfer;
        const isOutgoing = String(t.sourceStoreId?._id || t.sourceStoreId) === String(storeId);
        const sourceName = t.sourceStoreId?.name || 'Unknown';
        const targetName = t.targetStoreId?.name || 'Unknown';
        const isShippedIncoming = !isOutgoing && t.status === 'shipped';
        const isPendingIncoming = !isOutgoing && t.status === 'pending';

        return (
          <CenteredModal open={!!detailTransfer} onClose={() => setDetailTransfer(null)}
            title={`Transfer: ${t.transferNumber}`} maxWidth="max-w-lg"
            footer={
              <div className="flex gap-3 w-full flex-wrap">
                {isShippedIncoming && (
                  <>
                    <button type="button" onClick={() => { openReceive(t); setDetailTransfer(null); }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-1">
                      <CheckCircle size={14} /> Receive Stock
                    </button>
                    <button type="button" onClick={() => rejectTransferMutation.mutate(t._id)} disabled={rejectTransferMutation.isPending}
                      className="flex-1 border border-red-200 hover:bg-red-50 text-red-600 font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-1">
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
                {isPendingIncoming && (
                  <button type="button" onClick={() => cancelRequestMutation.mutate(t._id)} disabled={cancelRequestMutation.isPending}
                    className="flex-1 border border-red-200 hover:bg-red-50 text-red-600 font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-1">
                    {cancelRequestMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    Cancel Request
                  </button>
                )}
                <button type="button" onClick={() => setDetailTransfer(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl transition text-sm">
                  Close
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className={`rounded-xl p-3 flex items-center justify-between border ${getStatusBadge(t.status)}`}>
                <span className="font-bold text-sm capitalize">{t.status}</span>
                <span className="text-xs font-semibold opacity-70">{new Date(t.shippedAt || t.createdAt).toLocaleString()}</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 flex items-center gap-2 text-xs text-gray-700">
                <Truck size={13} className="text-purple-500 shrink-0" />
                <span className="font-semibold">{sourceName}</span>
                <span className="text-gray-400">&#8594;</span>
                <span className="font-semibold">{targetName}</span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="px-3 py-2 bg-gray-50 grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-200">
                    <span className="col-span-5">Item</span>
                    <span className="col-span-2 text-right">Sent</span>
                    <span className="col-span-2 text-right">Recvd</span>
                    <span className="col-span-3 text-right">Variance</span>
                  </div>
                  {t.items?.map((item, idx) => {
                    const itemName = item.inventoryItemId?.itemName || item.itemName || `Item ${idx + 1}`;
                    const sent = item.qtySent || 0;
                    const received = item.qtyReceived ?? null;
                    const variance = received !== null ? received - sent : null;
                    return (
                      <div key={idx} className="px-3 py-2.5 grid grid-cols-12 gap-2 items-center border-b border-gray-100 last:border-0 text-xs">
                        <span className="col-span-5 font-semibold text-gray-800 truncate">{itemName}</span>
                        <span className="col-span-2 text-right text-gray-600">{sent} <span className="text-[9px] text-gray-400">{item.unit}</span></span>
                        <span className="col-span-2 text-right font-semibold text-gray-700">{received !== null ? received : <span className="text-gray-300">&#8212;</span>}</span>
                        <span className={`col-span-3 text-right font-bold ${variance === null ? 'text-gray-300' : variance === 0 ? 'text-gray-400' : variance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {variance === null ? '&#8212;' : variance === 0 ? 'Match' : `${variance > 0 ? '+' : ''}${variance}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CenteredModal>
        );
      })()}

      {/* ---- REQUEST TRANSFER MODAL ---- */}
      <CenteredModal open={modalOpen} onClose={closeModal} title="Request Stock Transfer" maxWidth="max-w-xl"
        footer={
          <div className="flex gap-3 w-full">
            <button type="button" onClick={closeModal} className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm">Cancel</button>
            <button type="submit" form="request-form" disabled={createTransferMutation.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm flex items-center justify-center gap-1">
              <SendHorizontal size={14} />
              {createTransferMutation.isPending ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        }
      >
        <form id="request-form" onSubmit={handleSendRequest} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
            <strong>Stock Request:</strong> This will send a request to the central kitchen or another store. Stock will only be deducted once the request is approved and dispatched.
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Request Stock From *</label>
            {isStoreUnderCentralKitchen && centralKitchenStore ? (
              <div className="w-full bg-gray-100 border border-gray-350 text-gray-700 rounded-xl px-4 py-2.5 text-sm font-semibold">
                {centralKitchenStore.name} (Central Kitchen)
              </div>
            ) : (
              <select value={targetStoreId} onChange={(e) => setTargetStoreId(e.target.value)} required
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="">Select source store...</option>
                {otherStores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            )}
          </div>

          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-4">
            <h5 className="text-xs font-bold text-amber-600 uppercase tracking-wide">Items Requested</h5>
            {itemsToSend.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {itemsToSend.map((item) => (
                  <div key={item.inventoryItemId} className="flex justify-between items-center bg-white border border-gray-200 rounded-xl p-2.5 shadow-sm text-xs">
                    <span className="font-bold text-gray-800 truncate">{item.itemName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-600">{item.qtySent} {item.unit}</span>
                      <button type="button" onClick={() => handleRemoveItem(item.inventoryItemId)} className="text-gray-400 hover:text-red-500 p-1 ml-1"><XCircle size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400 italic py-2 text-center bg-white border border-dashed border-gray-200 rounded-xl">Add items you need below.</p>}

            <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-end shadow-sm">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Select Item</label>
                <select value={newTransferItemId} onChange={(e) => setNewTransferItemId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                  <option value="">Select...</option>
                  {inventoryItems.map((inv) => <option key={inv._id} value={inv._id}>{inv.itemName} ({inv.unit})</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Qty Needed</label>
                <input type="number" step="0.01" min="0.01" value={newTransferQty} onChange={(e) => setNewTransferQty(e.target.value)} placeholder="0.00"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right" />
              </div>
              <button type="button" onClick={handleAddItem} disabled={!newTransferItemId || !newTransferQty}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg transition text-xs shrink-0 h-[30px]">
                Add
              </button>
            </div>
          </div>

          {formError && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs font-semibold">{formError}</div>}
        </form>
      </CenteredModal>

      {/* RECEIVE MODAL */}
      {receiveModalOpen && (
        <CenteredModal open={!!receiveModalOpen} onClose={() => setReceiveModalOpen(null)}
          title={`Receive: ${receiveModalOpen.transferNumber}`} maxWidth="max-w-xl"
          footer={
            <div className="flex gap-3 w-full">
              <button type="button" onClick={() => rejectTransferMutation.mutate(receiveModalOpen._id)} disabled={rejectTransferMutation.isPending || receiveTransferMutation.isPending}
                className="px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-xl transition text-sm flex-1">
                Reject &amp; Return
              </button>
              <button type="button" onClick={handleCommitReceipt} disabled={receiveTransferMutation.isPending || rejectTransferMutation.isPending}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm flex-1 flex items-center justify-center gap-1">
                {receiveTransferMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                Confirm Receipt
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Verify incoming stock. Adjust received quantities if there are shortages.</p>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
              <div className="px-3 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 grid grid-cols-12 gap-2 border-b border-gray-200">
                <span className="col-span-5">Item Name</span>
                <span className="col-span-2 text-right">Shipped</span>
                <span className="col-span-3 text-center">Received</span>
                <span className="col-span-2 text-right">Status</span>
              </div>
              {receiveModalOpen.items?.map((item) => {
                const itemIdStr = String(item.inventoryItemId?._id || item.inventoryItemId);
                const val = receivedQtys[itemIdStr];
                const receivedNum = val !== undefined && val !== '' ? parseFloat(val) : item.qtySent;
                const difference = isNaN(receivedNum) ? 0 : receivedNum - item.qtySent;

                return (
                  <div key={itemIdStr} className="px-3 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50">
                    <span className="col-span-5 text-xs font-bold text-gray-800 truncate" title={item.inventoryItemId?.itemName || item.itemName}>
                      {item.inventoryItemId?.itemName || item.itemName}
                    </span>
                    <span className="col-span-2 text-right text-xs font-semibold text-gray-600">
                      {item.qtySent} <span className="text-[9px] text-gray-400">{item.unit}</span>
                    </span>
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <input type="number" step="0.01" min="0" value={val !== undefined ? val : ''} 
                        onChange={(e) => setReceivedQtys(prev => ({ ...prev, [itemIdStr]: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className="w-16 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500" />
                      <span className="text-[10px] text-gray-400 w-6 truncate">{item.unit}</span>
                    </div>
                    <span className={`col-span-2 text-right text-xs font-bold ${difference === 0 ? 'text-green-600' : difference < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                      {difference === 0 ? 'Match' : difference > 0 ? `+${difference.toFixed(2)}` : difference.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CenteredModal>
      )}
    </div>
  );
}
