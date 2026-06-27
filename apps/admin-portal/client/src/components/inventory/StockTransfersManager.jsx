import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowRightLeft, CheckCircle, XCircle, Loader2, ArrowRight, Save, ShieldCheck, Search, X, SlidersHorizontal, ChevronDown, Calendar } from 'lucide-react';
import api from '../../api/axios';
import CenteredModal from '../CenteredModal';
import { useStoreContext } from '../../context/StoreContext';
import { useToast } from '../../hooks/useToast';
import ViewModeToggle from '../ViewModeToggle';

export default function StockTransfersManager({ storeId }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { stores } = useStoreContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(null);
  const [targetStoreId, setTargetStoreId] = useState('');
  const [itemsToSend, setItemsToSend] = useState([]);
  
  const [newTransferItemId, setNewTransferItemId] = useState('');
  const [newTransferQty, setNewTransferQty] = useState('');
  const [formError, setFormError] = useState('');
  
  // Receive counts tracking state
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
      const todayStr = today.toISOString().split('T')[0];
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (type === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setFromDate(yesterdayStr);
      setToDate(yesterdayStr);
    } else if (type === '7days') {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 6);
      setFromDate(lastWeek.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    } else if (type === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(startOfMonth.toISOString().split('T')[0]);
      setToDate(today.toISOString().split('T')[0]);
    }
    setShowFilters(false);
  };

  // Fetch all inventory items for current store
  const { data: inventoryItems = [], isPending: itemsLoading } = useQuery({
    queryKey: ['inventory', storeId],
    queryFn: () => api.get('/inventory').then((r) => r.data),
    enabled: !!storeId,
  });

  // Fetch Transfers
  const { data: transfers = [], isPending: transfersLoading } = useQuery({
    queryKey: ['transfers', storeId],
    queryFn: () => api.get('/advanced-inventory/transfers', { params: { storeId } }).then((r) => r.data),
    enabled: !!storeId,
  });

  const filteredAndSortedTransfers = useMemo(() => {
    let items = [...transfers];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((t) => {
        const sourceName = stores.find((s) => s._id === t.sourceStoreId)?.name || '';
        const targetName = stores.find((s) => s._id === t.targetStoreId)?.name || '';
        const status = t.status || '';
        const matchesItems = (t.items || []).some((item) => {
          const match = inventoryItems.find((i) => i._id === (item.inventoryItemId?._id || item.inventoryItemId));
          return match?.itemName?.toLowerCase().includes(q);
        });
        return (
          sourceName.toLowerCase().includes(q) ||
          targetName.toLowerCase().includes(q) ||
          status.toLowerCase().includes(q) ||
          matchesItems
        );
      });
    }

    // Date range filter
    if (fromDate) {
      const fDate = new Date(fromDate);
      fDate.setHours(0, 0, 0, 0);
      items = items.filter((t) => new Date(t.shippedAt || t.createdAt) >= fDate);
    }
    if (toDate) {
      const tDate = new Date(toDate);
      tDate.setHours(23, 59, 59, 999);
      items = items.filter((t) => new Date(t.shippedAt || t.createdAt) <= tDate);
    }

    // Sorting
    items.sort((a, b) => {
      const dateA = new Date(a.shippedAt || a.createdAt);
      const dateB = new Date(b.shippedAt || b.createdAt);
      if (sortBy === 'date-desc') {
        return dateB - dateA;
      } else if (sortBy === 'date-asc') {
        return dateA - dateB;
      } else if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });

    return items;
  }, [transfers, searchQuery, fromDate, toDate, sortBy, stores, inventoryItems]);

  // Mutations
  const createTransferMutation = useMutation({
    mutationFn: (data) => api.post('/advanced-inventory/transfers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', storeId] });
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Stock transfer shipped', 'success');
      closeModal();
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || 'Failed to dispatch transfer');
    },
  });

  const receiveTransferMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/advanced-inventory/transfers/${id}/receive`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', storeId] });
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Stock transfer received successfully', 'success');
      setReceiveModalOpen(null);
      setReceivedQtys({});
    },
  });

  const rejectTransferMutation = useMutation({
    mutationFn: (id) => api.post(`/advanced-inventory/transfers/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', storeId] });
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Stock transfer rejected and returned', 'warning');
      setReceiveModalOpen(null);
    },
  });

  const otherStores = useMemo(() => {
    return stores.filter((s) => String(s._id) !== String(storeId));
  }, [stores, storeId]);

  const openCreate = () => {
    setTargetStoreId('');
    setItemsToSend([]);
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setItemsToSend([]);
    setNewTransferItemId('');
    setNewTransferQty('');
  };

  const handleAddItem = () => {
    if (!newTransferItemId) return;
    const qty = parseFloat(newTransferQty);
    if (isNaN(qty) || qty <= 0) return;

    const match = inventoryItems.find((i) => i._id === newTransferItemId);
    if (!match) return;

    if (itemsToSend.some((i) => i.inventoryItemId === newTransferItemId)) {
      showToast('Item already added to transfer', 'warning');
      return;
    }

    setItemsToSend((prev) => [
      ...prev,
      {
        inventoryItemId: newTransferItemId,
        itemName: match.itemName,
        qtySent: qty,
        unit: match.unit,
      },
    ]);

    setNewTransferItemId('');
    setNewTransferQty('');
  };

  const handleRemoveItem = (itemId) => {
    setItemsToSend((prev) => prev.filter((i) => i.inventoryItemId !== itemId));
  };

  const handleSendTransfer = (e) => {
    e.preventDefault();
    setFormError('');

    if (!targetStoreId) {
      setFormError('Please select a target store');
      return;
    }
    if (itemsToSend.length === 0) {
      setFormError('Please add at least one item to transfer');
      return;
    }

    createTransferMutation.mutate({
      sourceStoreId: storeId,
      targetStoreId,
      items: itemsToSend,
    });
  };

  const openReceive = (t) => {
    setReceiveModalOpen(t);
    const qtys = {};
    t.items.forEach((i) => {
      qtys[String(i.inventoryItemId?._id || i.inventoryItemId)] = i.qtySent;
    });
    setReceivedQtys(qtys);
  };

  const handleCommitReceipt = () => {
    if (!receiveModalOpen) return;
    const payloadItems = Object.keys(receivedQtys).map((k) => ({
      inventoryItemId: k,
      qtyReceived: receivedQtys[k],
    }));

    receiveTransferMutation.mutate({
      id: receiveModalOpen._id,
      data: { items: payloadItems },
    });
  };

  if (itemsLoading || transfersLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading stock transfers...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Store Stock Transfers</h4>
          <p className="text-xs text-gray-500">Move inventory items securely between retail store locations or central kitchens.</p>
        </div>
        {otherStores.length > 0 && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            <ArrowRightLeft size={14} /> New Transfer Request
          </button>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search transfers (store, item)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-450"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-655" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />

          <div className="relative" ref={filterContainerRef}>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                (fromDate || toDate)
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
              {(fromDate || toDate) && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {fromDate || toDate ? 1 : 0}
                </span>
              )}
              <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {showFilters && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="text-xs font-semibold text-gray-400">Date Range</span>
                  {(fromDate || toDate) && (
                    <button
                      onClick={() => { setFromDate(''); setToDate(''); }}
                      className="text-[10px] text-amber-600 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">From</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">To</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={e => setToDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-150">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Quick Ranges</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button onClick={() => handleQuickFilter('today')} className="px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-700">Today</button>
                    <button onClick={() => handleQuickFilter('yesterday')} className="px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-700">Yesterday</button>
                    <button onClick={() => handleQuickFilter('7days')} className="px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-700">Last 7 Days</button>
                    <button onClick={() => handleQuickFilter('month')} className="px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-[10px] font-medium text-gray-700">This Month</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-550">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listing transfers */}
      {filteredAndSortedTransfers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <ArrowRightLeft size={36} className="mx-auto opacity-35 mb-2 animate-pulse" />
          <p className="text-sm">No stock transfers processed or matching search query</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Transfer ID</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Partner Store</th>
                  <th className="px-6 py-4">Shipped Date</th>
                  <th className="px-6 py-4">Items Count</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredAndSortedTransfers.map((t) => {
                  const isOutgoing = String(t.sourceStoreId?._id || t.sourceStoreId) === String(storeId);
                  const partnerStore = isOutgoing ? t.targetStoreId?.name : t.sourceStoreId?.name;
                  return (
                    <tr key={t._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{t.transferNumber}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOutgoing ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {isOutgoing ? 'Outgoing' : 'Incoming'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold">{partnerStore}</td>
                      <td className="px-6 py-4 text-gray-500">{new Date(t.shippedAt || t.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                          {t.items?.length || 0} items
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                          t.status === 'received' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : t.status === 'rejected'
                            ? 'bg-red-50 text-red-655 border-red-200'
                            : 'bg-yellow-50 text-yellow-750 border-yellow-250'
                        }`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {!isOutgoing && t.status === 'shipped' ? (
                          <button
                            type="button"
                            onClick={() => openReceive(t)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg shadow-sm transition"
                          >
                            Receive Stock
                          </button>
                        ) : (
                          <span className="text-gray-400 font-medium">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-150 overflow-hidden">
          {filteredAndSortedTransfers.map((t) => {
            const isOutgoing = String(t.sourceStoreId?._id || t.sourceStoreId) === String(storeId);
            const partnerStore = isOutgoing ? t.targetStoreId?.name : t.sourceStoreId?.name;

            return (
              <div key={t._id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold ${
                    isOutgoing 
                      ? 'bg-amber-50 border-amber-250 text-amber-700' 
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}>
                    {isOutgoing ? 'OUT' : 'IN'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-gray-800 text-xs block truncate">
                      {t.transferNumber} · {isOutgoing ? `To: ${partnerStore}` : `From: ${partnerStore}`}
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Items: {t.items?.length || 0} · Shipped: {new Date(t.shippedAt || t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                  {/* Status badge */}
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                    t.status === 'received' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : t.status === 'rejected'
                      ? 'bg-red-50 text-red-655 border-red-200'
                      : 'bg-yellow-50 text-yellow-750 border-yellow-250'
                  }`}>
                    {t.status.toUpperCase()}
                  </span>

                  {/* Actions */}
                  {!isOutgoing && t.status === 'shipped' && (
                    <button
                      type="button"
                      onClick={() => openReceive(t)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      Receive Stock
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE TRANSFER MODAL */}
      <CenteredModal
        open={modalOpen}
        onClose={closeModal}
        title="Ship Stock Transfer"
        maxWidth="max-w-xl"
        footer={
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-bold py-2.5 rounded-xl transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="transfer-form"
              disabled={createTransferMutation.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm flex items-center justify-center gap-1"
            >
              <Save size={14} />
              {createTransferMutation.isPending ? 'Sending…' : 'Ship Transfer'}
            </button>
          </div>
        }
      >
        <form id="transfer-form" onSubmit={handleSendTransfer} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Destination Store *</label>
            <select
              value={targetStoreId}
              onChange={(e) => setTargetStoreId(e.target.value)}
              required
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select store...</option>
              {otherStores.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Items to Send List */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-4">
            <h5 className="text-xs font-bold text-amber-600 uppercase tracking-wide">Shipment Items</h5>

            {itemsToSend.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {itemsToSend.map((item) => (
                  <div key={item.inventoryItemId} className="flex justify-between items-center bg-white border border-gray-200 rounded-xl p-2.5 shadow-sm text-xs">
                    <span className="font-bold text-gray-800 truncate">{item.itemName}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-600">
                        {item.qtySent} {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.inventoryItemId)}
                        className="text-gray-400 hover:text-red-655 p-1 ml-1"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-2 text-center bg-white border border-dashed border-gray-250 rounded-xl">
                Add stock items to dispatch below.
              </p>
            )}

            {/* Inputs */}
            <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-end shadow-sm">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Select Item</label>
                <select
                  value={newTransferItemId}
                  onChange={(e) => setNewTransferItemId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Select...</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv._id} value={inv._id}>
                      {inv.itemName} (Available: {inv.quantity} {inv.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-[10px] text-gray-500 font-bold mb-1">Ship Qty</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newTransferQty}
                  onChange={(e) => setNewTransferQty(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!newTransferItemId || !newTransferQty}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg transition text-xs shrink-0 h-[30px]"
              >
                Add
              </button>
            </div>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-750 rounded-xl px-4 py-3 text-xs font-semibold">
              {formError}
            </div>
          )}
        </form>
      </CenteredModal>

      {/* RECEIVE TRANFER SHEET MODAL */}
      {receiveModalOpen && (
        <CenteredModal
          open={!!receiveModalOpen}
          onClose={() => setReceiveModalOpen(null)}
          title={`Receive Stock Transfer: ${receiveModalOpen.transferNumber}`}
          maxWidth="max-w-xl"
          footer={
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => rejectTransferMutation.mutate(receiveModalOpen._id)}
                disabled={rejectTransferMutation.isPending || receiveTransferMutation.isPending}
                className="px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-655 font-bold rounded-xl transition text-sm flex-1"
              >
                Reject & Return
              </button>
              <button
                type="button"
                onClick={handleCommitReceipt}
                disabled={receiveTransferMutation.isPending || rejectTransferMutation.isPending}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm flex-1 flex items-center justify-center gap-1"
              >
                {receiveTransferMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                Confirm Receipt
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Verify incoming stock items. Record any shortages in the actual count inputs.</p>
            
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-150">
              <div className="px-3 py-2 bg-gray-50 text-[10px] font-bold text-gray-550 grid grid-cols-12 gap-2">
                <span className="col-span-6">Item Name</span>
                <span className="col-span-3 text-right">Shipped Qty</span>
                <span className="col-span-3 text-center">Received Qty</span>
              </div>

              {receiveModalOpen.items?.map((item) => {
                const itemIdStr = String(item.inventoryItemId?._id || item.inventoryItemId);
                const val = receivedQtys[itemIdStr];
                
                return (
                  <div key={itemIdStr} className="px-3 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50">
                    <span className="col-span-6 text-xs font-bold text-gray-800 truncate">{item.itemName}</span>
                    <span className="col-span-3 text-right text-xs font-semibold text-gray-600">
                      {item.qtySent} {item.unit}
                    </span>
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={val !== undefined ? val : ''}
                        onChange={(e) => setReceivedQtys(prev => ({
                          ...prev,
                          [itemIdStr]: e.target.value === '' ? '' : parseFloat(e.target.value)
                        }))}
                        className="w-16 bg-gray-55 border border-gray-300 text-gray-900 rounded-lg px-2 py-0.5 text-xs text-right focus:outline-none"
                      />
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
