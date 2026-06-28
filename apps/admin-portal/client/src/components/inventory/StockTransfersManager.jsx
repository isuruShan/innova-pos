import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRightLeft, CheckCircle, XCircle, Loader2, Save,
  Search, X, SlidersHorizontal, ChevronDown, Eye, Truck, SendHorizontal
} from 'lucide-react';
import api from '../../api/axios';
import CenteredModal from '../CenteredModal';
import SlideOver from '../SlideOver';
import { useStoreContext } from '../../context/StoreContext';
import { useToast } from '../../hooks/useToast';
import ViewModeToggle from '../ViewModeToggle';

export default function StockTransfersManager({ storeId }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { stores } = useStoreContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [targetStoreId, setTargetStoreId] = useState('');
  const [itemsToSend, setItemsToSend] = useState([]);
  const [newTransferItemId, setNewTransferItemId] = useState('');
  const [newTransferQty, setNewTransferQty] = useState('');
  const [formError, setFormError] = useState('');
  const [receivedQtys, setReceivedQtys] = useState({});

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode_stock_transfers') || 'table');
  const [showFilters, setShowFilters] = useState(false);
  const filterContainerRef = useRef(null);

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_stock_transfers', mode);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterContainerRef.current && !filterContainerRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickFilter = (type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (type === 'today') {
      const s = today.toISOString().split('T')[0];
      setFromDate(s); setToDate(s);
    } else if (type === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const s = y.toISOString().split('T')[0];
      setFromDate(s); setToDate(s);
    } else if (type === '7days') {
      const w = new Date(today);
      w.setDate(today.getDate() - 6);
      setFromDate(w.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const som = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(som.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    }
    setShowFilters(false);
  };

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => { const { data } = await api.get('/tenant-settings'); return data; },
  });
  const isCentralKitchenEnabled = settings?.centralKitchenEnabled === true;

  const isStoreUnderCentralKitchen = useMemo(() => {
    const activeStore = stores.find((s) => String(s._id) === String(storeId));
    return activeStore && activeStore.replenishmentModel === 'central_kitchen' && isCentralKitchenEnabled;
  }, [stores, storeId, isCentralKitchenEnabled]);

  const centralKitchenStore = useMemo(() => {
    return stores.find((s) => s.isCentralKitchen === true);
  }, [stores]);

  const { data: inventoryItems = [], isPending: itemsLoading } = useQuery({
    queryKey: ['inventory', isStoreUnderCentralKitchen && centralKitchenStore ? String(centralKitchenStore._id) : storeId],
    queryFn: () => {
      const targetId = isStoreUnderCentralKitchen && centralKitchenStore ? String(centralKitchenStore._id) : storeId;
      return api.get('/inventory', { headers: { 'x-store-id': targetId } }).then((r) => r.data);
    },
    enabled: !!storeId && (!isStoreUnderCentralKitchen || !!centralKitchenStore),
  });

  const { data: transfers = [], isPending: transfersLoading } = useQuery({
    queryKey: ['transfers', storeId],
    queryFn: () => api.get('/advanced-inventory/transfers', { params: { storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const filteredAndSortedTransfers = useMemo(() => {
    let items = [...transfers];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((t) => {
        const matchesItems = (t.items || []).some((item) => item.inventoryItemId?.itemName?.toLowerCase().includes(q));
        return (
          (t.sourceStoreId?.name || '').toLowerCase().includes(q) ||
          (t.targetStoreId?.name || '').toLowerCase().includes(q) ||
          (t.status || '').toLowerCase().includes(q) ||
          (t.transferNumber || '').toLowerCase().includes(q) ||
          matchesItems
        );
      });
    }
    if (fromDate) {
      const fDate = new Date(fromDate); fDate.setHours(0, 0, 0, 0);
      items = items.filter((t) => new Date(t.shippedAt || t.createdAt) >= fDate);
    }
    if (toDate) {
      const tDate = new Date(toDate); tDate.setHours(23, 59, 59, 999);
      items = items.filter((t) => new Date(t.shippedAt || t.createdAt) <= tDate);
    }
    items.sort((a, b) => {
      const dA = new Date(a.shippedAt || a.createdAt), dB = new Date(b.shippedAt || b.createdAt);
      if (sortBy === 'date-desc') return dB - dA;
      if (sortBy === 'date-asc') return dA - dB;
      if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
      return 0;
    });
    return items;
  }, [transfers, searchQuery, fromDate, toDate, sortBy]);

  const createTransferMutation = useMutation({
    mutationFn: (data) => api.post('/advanced-inventory/transfers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers', storeId] }); qc.invalidateQueries({ queryKey: ['inventory', storeId] }); showToast('Stock transfer dispatched', 'success'); closeModal(); },
    onError: (err) => setFormError(err.response?.data?.message || 'Failed to dispatch transfer'),
  });

  const shipTransferMutation = useMutation({
    mutationFn: (id) => api.post(`/advanced-inventory/transfers/${id}/ship`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers', storeId] }); qc.invalidateQueries({ queryKey: ['inventory', storeId] }); showToast('Transfer shipped successfully', 'success'); setSelectedTransfer(null); },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to ship transfer', 'error'),
  });

  const receiveTransferMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/advanced-inventory/transfers/${id}/receive`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers', storeId] }); qc.invalidateQueries({ queryKey: ['inventory', storeId] }); showToast('Transfer received', 'success'); setReceiveModalOpen(null); setSelectedTransfer(null); setReceivedQtys({}); },
  });

  const rejectTransferMutation = useMutation({
    mutationFn: (id) => api.post(`/advanced-inventory/transfers/${id}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers', storeId] }); qc.invalidateQueries({ queryKey: ['inventory', storeId] }); showToast('Transfer rejected', 'warning'); setReceiveModalOpen(null); setSelectedTransfer(null); },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to reject', 'error'),
  });

  const otherStores = useMemo(() => stores.filter((s) => String(s._id) !== String(storeId)), [stores, storeId]);

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

  const handleSendTransfer = (e) => {
    e.preventDefault(); setFormError('');
    if (isStoreUnderCentralKitchen) {
      if (!centralKitchenStore) { setFormError('No Central Kitchen store configured.'); return; }
      if (itemsToSend.length === 0) { setFormError('Please add at least one item'); return; }
      createTransferMutation.mutate({ sourceStoreId: String(centralKitchenStore._id), targetStoreId: storeId, items: itemsToSend, status: 'pending' });
    } else {
      if (!targetStoreId) { setFormError('Please select a target store'); return; }
      if (itemsToSend.length === 0) { setFormError('Please add at least one item'); return; }
      createTransferMutation.mutate({ sourceStoreId: storeId, targetStoreId, items: itemsToSend });
    }
  };

  const openReceive = (t) => {
    setReceiveModalOpen(t);
    const qtys = {};
    t.items.forEach((i) => { qtys[String(i.inventoryItemId?._id || i.inventoryItemId)] = i.qtySent; });
    setReceivedQtys(qtys);
  };

  const handleCommitReceipt = () => {
    if (!receiveModalOpen) return;
    receiveTransferMutation.mutate({ id: receiveModalOpen._id, data: { items: Object.keys(receivedQtys).map((k) => ({ inventoryItemId: k, qtyReceived: receivedQtys[k] })) } });
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Store Stock Transfers</h4>
          <p className="text-xs text-gray-500">Move inventory between store locations or central kitchens.</p>
        </div>
        {otherStores.length > 0 && (
          <button type="button" onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition">
            <ArrowRightLeft size={14} /> New Transfer
          </button>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by store, item, or transfer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-700" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />

          <div className="relative" ref={filterContainerRef}>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${(fromDate || toDate) ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {(fromDate || toDate) && <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">1</span>}
              <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {showFilters && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="text-xs font-semibold text-gray-400">Date Range</span>
                  {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-[10px] text-amber-600 hover:underline">Clear All</button>}
                </div>
                <div className="space-y-2">
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">From</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none" /></div>
                  <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">To</label><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none" /></div>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Quick Ranges</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[['today','Today'],['yesterday','Yesterday'],['7days','Last 7 Days'],['month','This Month']].map(([k,l]) => (
                      <button key={k} onClick={() => handleQuickFilter(k)} className="px-2 py-1 bg-gray-50 hover:bg-amber-50 hover:text-amber-700 rounded text-[10px] font-medium text-gray-700 transition">{l}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Sort:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold cursor-pointer">
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listing */}
      {filteredAndSortedTransfers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <ArrowRightLeft size={36} className="mx-auto opacity-35 mb-2 animate-pulse" />
          <p className="text-sm">No stock transfers matching your search</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-4">Transfer ID</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Partner Store</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Items</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredAndSortedTransfers.map((t) => {
                  const isOutgoing = String(t.sourceStoreId?._id || t.sourceStoreId) === String(storeId);
                  const partnerStore = isOutgoing ? t.targetStoreId?.name : t.sourceStoreId?.name;
                  return (
                    <tr key={t._id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setSelectedTransfer(t)}>
                      <td className="px-5 py-4 font-bold text-gray-900">{t.transferNumber}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${isOutgoing ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{isOutgoing ? 'Outgoing' : 'Incoming'}</span>
                      </td>
                      <td className="px-5 py-4 font-semibold">{partnerStore}</td>
                      <td className="px-5 py-4 text-gray-500">{new Date(t.shippedAt || t.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">{t.items?.length || 0} items</span></td>
                      <td className="px-5 py-4"><span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${getStatusBadge(t.status)}`}>{t.status?.toUpperCase()}</span></td>
                      <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setSelectedTransfer(t)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-lg transition flex items-center gap-1 mx-auto">
                          <Eye size={11} /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {filteredAndSortedTransfers.map((t) => {
            const isOutgoing = String(t.sourceStoreId?._id || t.sourceStoreId) === String(storeId);
            const partnerStore = isOutgoing ? t.targetStoreId?.name : t.sourceStoreId?.name;
            return (
              <div key={t._id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-gray-50/60 cursor-pointer transition" onClick={() => setSelectedTransfer(t)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold ${isOutgoing ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>{isOutgoing ? 'OUT' : 'IN'}</div>
                  <div className="min-w-0">
                    <span className="font-bold text-gray-800 text-xs block truncate">{t.transferNumber} · {isOutgoing ? `To: ${partnerStore}` : `From: ${partnerStore}`}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">{t.items?.length || 0} items · {new Date(t.shippedAt || t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${getStatusBadge(t.status)}`}>{t.status?.toUpperCase()}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedTransfer(t); }} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-bold rounded-lg transition flex items-center gap-1">
                    <Eye size={11} /> Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TRANSFER DETAIL SLIDEOVER */}
      {selectedTransfer && (() => {
        const t = selectedTransfer;
        const isOutgoing = String(t.sourceStoreId?._id || t.sourceStoreId) === String(storeId);
        const sourceName = t.sourceStoreId?.name || 'Unknown';
        const targetName = t.targetStoreId?.name || 'Unknown';
        const isIncomingShipped = !isOutgoing && t.status === 'shipped';
        const isOutgoingPending = isOutgoing && t.status === 'pending';
        const isIncomingPending = !isOutgoing && t.status === 'pending';

        return (
          <SlideOver open={!!selectedTransfer} onClose={() => setSelectedTransfer(null)} title={`Transfer: ${t.transferNumber}`}>
            <div className="space-y-5">
              <div className={`rounded-xl p-3 flex items-center justify-between border ${getStatusBadge(t.status)}`}>
                <span className="font-bold text-sm capitalize">{t.status}</span>
                <span className="text-xs font-semibold opacity-70">{new Date(t.shippedAt || t.createdAt).toLocaleString()}</span>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Truck size={13} className="text-purple-500 shrink-0" />
                  <span className="font-semibold text-gray-900">{sourceName}</span>
                  <span className="text-gray-400">&#8594;</span>
                  <span className="font-semibold text-gray-900">{targetName}</span>
                </div>
                {t.createdBy?.name && <p className="text-xs text-gray-400">Created by: <span className="font-medium text-gray-600">{t.createdBy.name}</span></p>}
                {t.receivedBy?.name && <p className="text-xs text-gray-400">Received by: <span className="font-medium text-green-600">{t.receivedBy.name}</span></p>}
                {t.notes && <p className="text-xs text-gray-500 italic border-t border-gray-200 pt-2 mt-2">{t.notes}</p>}
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Items Breakdown</h4>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-500 uppercase">
                    <span className="col-span-5">Item</span>
                    <span className="col-span-2 text-right">Sent</span>
                    <span className="col-span-2 text-right">Received</span>
                    <span className="col-span-3 text-right">Variance</span>
                  </div>
                  {t.items?.map((item, idx) => {
                    const itemName = item.inventoryItemId?.itemName || item.itemName || `Item ${idx + 1}`;
                    const sent = item.qtySent || 0;
                    const received = item.qtyReceived ?? null;
                    const variance = received !== null ? received - sent : null;
                    return (
                      <div key={idx} className="px-4 py-2.5 grid grid-cols-12 gap-2 items-center border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                        <span className="col-span-5 text-xs font-semibold text-gray-800 truncate">{itemName}</span>
                        <span className="col-span-2 text-right text-xs text-gray-600 font-medium">{sent} <span className="text-gray-400 text-[9px]">{item.unit}</span></span>
                        <span className="col-span-2 text-right text-xs font-semibold text-gray-700">{received !== null ? received : <span className="text-gray-300">&#8212;</span>}</span>
                        <span className={`col-span-3 text-right text-xs font-bold ${variance === null ? 'text-gray-300' : variance === 0 ? 'text-gray-400' : variance > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {variance === null ? '&#8212;' : variance === 0 ? 'Match' : `${variance > 0 ? '+' : ''}${variance}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-200">
                {isOutgoingPending && (
                  <button type="button" onClick={() => shipTransferMutation.mutate(t._id)} disabled={shipTransferMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold rounded-xl transition text-sm shadow-sm">
                    {shipTransferMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <SendHorizontal size={14} />}
                    Approve &amp; Ship
                  </button>
                )}
                {isIncomingPending && (
                  <button type="button" onClick={() => rejectTransferMutation.mutate(t._id)} disabled={rejectTransferMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-xl transition text-sm">
                    {rejectTransferMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    Reject Request
                  </button>
                )}
                {isIncomingShipped && (
                  <>
                    <button type="button" onClick={() => openReceive(t)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition text-sm shadow-sm">
                      <CheckCircle size={14} />
                      Receive &amp; Confirm
                    </button>
                    <button type="button" onClick={() => rejectTransferMutation.mutate(t._id)} disabled={rejectTransferMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-xl transition text-sm">
                      <XCircle size={14} />
                      Reject &amp; Return Stock
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setSelectedTransfer(null)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-sm">
                  Close
                </button>
              </div>
            </div>
          </SlideOver>
        );
      })()}

      {/* CREATE TRANSFER MODAL */}
      <CenteredModal open={modalOpen} onClose={closeModal} title={isStoreUnderCentralKitchen ? "Request Stock from Central Kitchen" : "Dispatch Stock Transfer"} maxWidth="max-w-xl"
        footer={
          <div className="flex gap-3 w-full">
            <button type="button" onClick={closeModal} className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm">Cancel</button>
            <button type="submit" form="transfer-form" disabled={createTransferMutation.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm flex items-center justify-center gap-1">
              <Save size={14} />
              {createTransferMutation.isPending ? 'Sending...' : (isStoreUnderCentralKitchen ? 'Send Request' : 'Dispatch Transfer')}
            </button>
          </div>
        }
      >
        <form id="transfer-form" onSubmit={handleSendTransfer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              {isStoreUnderCentralKitchen ? "Source Central Kitchen *" : "Destination Store *"}
            </label>
            {isStoreUnderCentralKitchen ? (
              <input
                type="text"
                value={centralKitchenStore?.name || 'Central Kitchen'}
                disabled
                className="w-full bg-gray-100 border border-gray-300 text-gray-500 rounded-xl px-4 py-2.5 text-sm cursor-not-allowed font-medium"
              />
            ) : (
              <select value={targetStoreId} onChange={(e) => setTargetStoreId(e.target.value)} required
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="">Select store...</option>
                {otherStores.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-4">
            <h5 className="text-xs font-bold text-amber-600 uppercase tracking-wide">
              {isStoreUnderCentralKitchen ? "Requested Items" : "Shipment Items"}
            </h5>
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
            ) : <p className="text-xs text-gray-400 italic py-2 text-center bg-white border border-dashed border-gray-200 rounded-xl">Add items to request below.</p>}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-end shadow-sm">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Select Item</label>
                <select value={newTransferItemId} onChange={(e) => setNewTransferItemId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                  <option value="">Select...</option>
                  {inventoryItems.map((inv) => <option key={inv._id} value={inv._id}>{inv.itemName} (Avail: {inv.quantity} {inv.unit})</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Qty</label>
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

      {/* RECEIVE TRANSFER MODAL */}
      {receiveModalOpen && (
        <CenteredModal open={!!receiveModalOpen} onClose={() => setReceiveModalOpen(null)} title={`Receive Transfer: ${receiveModalOpen.transferNumber}`} maxWidth="max-w-xl"
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
                <span className="col-span-6">Item Name</span>
                <span className="col-span-3 text-right">Shipped Qty</span>
                <span className="col-span-3 text-center">Received Qty</span>
              </div>
              {receiveModalOpen.items?.map((item) => {
                const itemIdStr = String(item.inventoryItemId?._id || item.inventoryItemId);
                const val = receivedQtys[itemIdStr];
                return (
                  <div key={itemIdStr} className="px-3 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50">
                    <span className="col-span-6 text-xs font-bold text-gray-800 truncate">{item.inventoryItemId?.itemName || item.itemName}</span>
                    <span className="col-span-3 text-right text-xs font-semibold text-gray-600">{item.qtySent} {item.unit}</span>
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <input type="number" step="0.01" min="0" value={val !== undefined ? val : ''} onChange={(e) => setReceivedQtys(prev => ({ ...prev, [itemIdStr]: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                        className="w-16 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500" />
                      <span className="text-[10px] text-gray-400 w-6 truncate">{item.unit}</span>
                    </div>
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
