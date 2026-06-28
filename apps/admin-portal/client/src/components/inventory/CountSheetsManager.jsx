import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Play, CheckCircle2, XCircle, AlertTriangle, Loader2, Calendar, FileText, Settings, Search, X } from 'lucide-react';
import api from '../../api/axios';
import CenteredModal from '../CenteredModal';
import ConfirmDialog from '../ConfirmDialog';
import { formatCurrency } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import ViewModeToggle from '../ViewModeToggle';

export default function CountSheetsManager({ storeId }) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [editingSheet, setEditingSheet] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Fetch all inventory items
  const { data: inventoryItems = [], isPending: itemsLoading } = useQuery({
    queryKey: ['inventory', storeId],
    queryFn: () => api.get('/inventory').then((r) => r.data),
    enabled: !!storeId,
  });

  // Fetch Count Sheets
  const { data: countSheets = [], isPending: sheetsLoading } = useQuery({
    queryKey: ['count-sheets', storeId],
    queryFn: () => api.get('/advanced-inventory/count-sheets').then((r) => r.data),
    enabled: !!storeId,
  });

  // Fetch Active Stocktake Session
  const { data: activeSession, isPending: activeSessionLoading } = useQuery({
    queryKey: ['count-sessions-active', storeId],
    queryFn: () => api.get('/advanced-inventory/count-sessions/active').then((r) => r.data),
    enabled: !!storeId,
  });

  // Fetch Session History
  const { data: sessionHistory = [] } = useQuery({
    queryKey: ['count-sessions-history', storeId],
    queryFn: () => api.get('/advanced-inventory/count-sessions/history').then((r) => r.data),
    enabled: !!storeId && !activeSession,
  });

  // Filter & Sort state for templates
  const [sheetSearchQuery, setSheetSearchQuery] = useState('');
  const [sheetSortBy, setSheetSortBy] = useState('name-asc');
  const [sheetViewMode, setSheetViewMode] = useState(() => localStorage.getItem('view_mode_count_sheets') || 'grid');

  const handleSetSheetViewMode = (mode) => {
    setSheetViewMode(mode);
    localStorage.setItem('view_mode_count_sheets', mode);
  };

  // Filter & Sort state for history
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historySortBy, setHistorySortBy] = useState('date-desc');
  const [historyViewMode, setHistoryViewMode] = useState(() => localStorage.getItem('view_mode_count_sessions_history') || 'table');

  const handleSetHistoryViewMode = (mode) => {
    setHistoryViewMode(mode);
    localStorage.setItem('view_mode_count_sessions_history', mode);
  };

  const filteredAndSortedCountSheets = useMemo(() => {
    let items = [...countSheets];
    if (sheetSearchQuery.trim()) {
      const q = sheetSearchQuery.toLowerCase();
      items = items.filter(s => s.name.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      if (sheetSortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (sheetSortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      } else if (sheetSortBy === 'items-count') {
        return (b.items?.length || 0) - (a.items?.length || 0);
      }
      return 0;
    });
    return items;
  }, [countSheets, sheetSearchQuery, sheetSortBy]);

  const filteredAndSortedHistory = useMemo(() => {
    let items = [...sessionHistory];
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      items = items.filter(s => 
        (s.countSheetId?.name || '').toLowerCase().includes(q) ||
        (s.userId?.name || '').toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      if (historySortBy === 'date-desc') {
        return new Date(b.endedAt) - new Date(a.endedAt);
      } else if (historySortBy === 'date-asc') {
        return new Date(a.endedAt) - new Date(b.endedAt);
      }
      return 0;
    });
    return items;
  }, [sessionHistory, historySearchQuery, historySortBy]);

  // Mutations
  const createSheetMutation = useMutation({
    mutationFn: (data) => api.post('/advanced-inventory/count-sheets', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['count-sheets', storeId] });
      showToast('Count sheet created', 'success');
      closeModal();
    },
  });

  const updateSheetMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/advanced-inventory/count-sheets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['count-sheets', storeId] });
      showToast('Count sheet updated', 'success');
      closeModal();
    },
  });

  const deleteSheetMutation = useMutation({
    mutationFn: (id) => api.delete(`/advanced-inventory/count-sheets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['count-sheets', storeId] });
      showToast('Count sheet deleted', 'success');
      setDeleteTarget(null);
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: (countSheetId) => api.post('/advanced-inventory/count-sessions/start', { countSheetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['count-sessions-active', storeId] });
      showToast('Stocktake count session started', 'success');
    },
  });

  const adjustQtyMutation = useMutation({
    mutationFn: ({ inventoryItemId, countedQty }) =>
      api.post('/advanced-inventory/count-sessions/active/adjust', { inventoryItemId, countedQty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['count-sessions-active', storeId] });
    },
  });

  const submitSessionMutation = useMutation({
    mutationFn: (data) => api.post('/advanced-inventory/count-sessions/active/submit', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['count-sessions-active', storeId] });
      qc.invalidateQueries({ queryKey: ['count-sessions-history', storeId] });
      qc.invalidateQueries({ queryKey: ['inventory', storeId] });
      showToast('Stocktake committed successfully', 'success');
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: () => api.post('/advanced-inventory/count-sessions/active/cancel'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['count-sessions-active', storeId] });
      setCancelConfirm(false);
      showToast('Stocktake session discarded', 'warning');
    },
  });

  const openCreate = () => {
    setEditingSheet(null);
    setSheetName('');
    setSelectedItems([]);
    setModalOpen(true);
  };

  const openEdit = (sheet) => {
    setEditingSheet(sheet);
    setSheetName(sheet.name);
    setSelectedItems(sheet.items.map((i) => i.inventoryItemId?._id || i.inventoryItemId));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSheet(null);
    setSheetName('');
    setSelectedItems([]);
  };

  const handleToggleItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSaveSheet = (e) => {
    e.preventDefault();
    if (!sheetName.trim()) return;

    const payload = {
      name: sheetName.trim(),
      items: selectedItems.map((id, idx) => ({ inventoryItemId: id, displayOrder: idx })),
    };

    if (editingSheet) {
      updateSheetMutation.mutate({ id: editingSheet._id, data: payload });
    } else {
      createSheetMutation.mutate(payload);
    }
  };

  // Active Session rendering helper
  const renderActiveSession = () => {
    if (!activeSession) return null;

    return (
      <div className="space-y-6">
        {/* Session Header banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-amber-50 border border-amber-250 p-5 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
              <h4 className="font-bold text-gray-900 text-sm">
                Stocktake In Progress: {activeSession.countSheetId?.name}
              </h4>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Started by {activeSession.userId?.name} on {new Date(activeSession.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              className="px-3.5 py-2 border border-red-200 hover:bg-red-50 text-red-700 text-xs font-bold rounded-xl transition"
            >
              Discard Count
            </button>
            <button
              type="button"
              onClick={() => submitSessionMutation.mutate({ notes: 'Committed count' })}
              className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              <CheckCircle2 size={14} /> Commit stocktake
            </button>
          </div>
        </div>

        {/* Count Sheet input panel */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-150">
          <div className="px-4 py-3 bg-gray-50 text-xs font-bold text-gray-600 grid grid-cols-12 gap-2">
            <span className="col-span-5 sm:col-span-6">Inventory Item</span>
            <span className="col-span-3 sm:col-span-2 text-right">Theoretical Stock</span>
            <span className="col-span-4 sm:col-span-4 text-center">Actual Counted Qty</span>
          </div>

          {(activeSession.items || []).map((sessionItem) => {
            const inv = sessionItem.inventoryItemId;
            if (!inv) return null;

            const theoretical = sessionItem.theoreticalQty;
            const counted = sessionItem.countedQty;
            const variance = counted !== null ? counted - theoretical : 0;
            const cost = sessionItem.costPrice || 0;
            const lossValue = variance * cost;

            return (
              <div key={inv._id} className="px-4 py-3.5 grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50">
                <div className="col-span-5 sm:col-span-6 min-w-0">
                  <span className="font-bold text-gray-800 text-xs block truncate">{inv.itemName}</span>
                  {inv.storageAreas?.length > 0 && (
                    <span className="text-[10px] text-purple-700 font-medium block mt-0.5">
                      📍 {inv.storageAreas.join(', ')}
                    </span>
                  )}
                </div>

                <div className="col-span-3 sm:col-span-2 text-right">
                  <span className="font-semibold text-gray-800 text-xs">
                    {theoretical} {inv.unit}
                  </span>
                </div>

                <div className="col-span-4 sm:col-span-4 flex items-center justify-center gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter qty..."
                    value={counted !== null ? counted : ''}
                    onChange={(e) =>
                      adjustQtyMutation.mutate({
                        inventoryItemId: inv._id,
                        countedQty: e.target.value === '' ? null : parseFloat(e.target.value),
                      })
                    }
                    className="w-24 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm"
                  />
                  <span className="text-[10px] text-gray-500 w-8 truncate shrink-0">{inv.unit}</span>

                  {/* Variance Indicators */}
                  {counted !== null && (
                    <span
                      className={`text-[10px] font-bold w-24 text-right shrink-0 ${
                        variance === 0
                          ? 'text-gray-400'
                          : variance > 0
                          ? 'text-green-600'
                          : 'text-red-500'
                      }`}
                    >
                      {variance === 0 ? 'Match' : `${variance > 0 ? '+' : ''}${variance} (${formatCurrency(lossValue)})`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Cancel confirm Dialog */}
        <ConfirmDialog
          open={cancelConfirm}
          title="Discard Count Session?"
          message="Are you sure you want to discard this count session? All recorded values will be lost and inventory levels will remain unchanged."
          confirmLabel="Discard"
          cancelLabel="Continue Counting"
          variant="delete"
          isLoading={cancelSessionMutation.isPending}
          onConfirm={() => cancelSessionMutation.mutate()}
          onCancel={() => setCancelConfirm(false)}
        />
      </div>
    );
  };

  const loading = itemsLoading || sheetsLoading || activeSessionLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading stocktake data...
      </div>
    );
  }

  // If there is an active session, render it immediately
  if (activeSession) {
    return renderActiveSession();
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Count Sheets & Audits</h4>
          <p className="text-xs text-gray-500">Organize items by shelf placement to count physical stock levels easily.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition"
        >
          <Plus size={14} /> Add Count Sheet
        </button>
      </div>

      {/* Templates Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search templates..."
            value={sheetSearchQuery}
            onChange={(e) => setSheetSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-500"
          />
          {sheetSearchQuery && (
            <button
              onClick={() => setSheetSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-gray-600">Sort by:</label>
            <select
              value={sheetSortBy}
              onChange={(e) => setSheetSortBy(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold cursor-pointer"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="items-count">Most Items</option>
            </select>
          </div>

          <ViewModeToggle mode={sheetViewMode} setMode={handleSetSheetViewMode} />
        </div>
      </div>

      {/* Grid listing templates */}
      {filteredAndSortedCountSheets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <FileText size={36} className="mx-auto opacity-35 mb-2" />
          <p className="text-sm">No count sheets configured or matching search query</p>
          <button type="button" onClick={openCreate} className="text-xs text-amber-600 font-semibold underline mt-1">
            Create your first count sheet template
          </button>
        </div>
      ) : sheetViewMode === 'table' ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Sheet Name</th>
                  <th className="px-6 py-4">Items Count</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                {filteredAndSortedCountSheets.map((sheet) => (
                  <tr key={sheet._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">{sheet.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                        {sheet.items?.length || 0} items
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startSessionMutation.mutate(sheet._id)}
                          disabled={startSessionMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-amber-700 font-bold transition text-[10px]"
                        >
                          <Play size={10} className="fill-amber-700" /> Start Count
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(sheet)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-955 border border-gray-200"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(sheet)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 border border-gray-200"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedCountSheets.map((sheet) => (
            <div key={sheet._id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h5 className="font-bold text-gray-900 text-sm truncate">{sheet.name}</h5>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {sheet.items?.length || 0} items configured
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(sheet)}
                      className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-950 border border-gray-200"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(sheet)}
                      className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-700 border border-gray-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Start Audit Trigger */}
                <button
                  type="button"
                  onClick={() => startSessionMutation.mutate(sheet._id)}
                  disabled={startSessionMutation.isPending}
                  className="w-full mt-4 flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-700 font-bold py-2 rounded-xl transition text-xs"
                >
                  <Play size={12} className="fill-amber-700" /> Start Stocktake Count
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HISTORICAL STOCKTAKE LIST */}
      {sessionHistory.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h4 className="font-bold text-gray-900 text-sm">Stocktake Audit History</h4>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-end">
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </span>
                <input
                  type="text"
                  placeholder="Search history..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 text-gray-900 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-500"
                />
                {historySearchQuery && (
                  <button
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-700" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-xs font-semibold text-gray-600">Sort:</label>
                <select
                  value={historySortBy}
                  onChange={(e) => setHistorySortBy(e.target.value)}
                  className="bg-white border border-gray-200 text-gray-900 text-xs rounded-xl px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold cursor-pointer"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                </select>
              </div>
              <ViewModeToggle mode={historyViewMode} setMode={handleSetHistoryViewMode} />
            </div>
          </div>

          {filteredAndSortedHistory.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-200 text-gray-400 text-xs">
              No matching audit history records found
            </div>
          ) : historyViewMode === 'table' ? (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Audit Name</th>
                      <th className="px-6 py-4">Completed By</th>
                      <th className="px-6 py-4">Date Committed</th>
                      <th className="px-6 py-4 text-right">Variance Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                    {filteredAndSortedHistory.map((sess) => {
                      const totalVarianceValue = sess.items.reduce((sum, i) => {
                        if (i.countedQty === null) return sum;
                        return sum + (i.countedQty - i.theoreticalQty) * i.costPrice;
                      }, 0);
                      return (
                        <tr key={sess._id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {sess.countSheetId?.name || 'Custom Session'}
                          </td>
                          <td className="px-6 py-4 text-gray-700">{sess.userId?.name || 'Unknown User'}</td>
                          <td className="px-6 py-4 text-gray-500">{new Date(sess.endedAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right font-bold">
                            <span className={totalVarianceValue === 0 ? 'text-gray-500' : totalVarianceValue > 0 ? 'text-green-600' : 'text-red-500'}>
                              {totalVarianceValue >= 0 ? '+' : ''}
                              {formatCurrency(totalVarianceValue)}
                            </span>
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
              {filteredAndSortedHistory.map((sess) => {
                const totalVarianceValue = sess.items.reduce((sum, i) => {
                  if (i.countedQty === null) return sum;
                  return sum + (i.countedQty - i.theoreticalQty) * i.costPrice;
                }, 0);

                return (
                  <div key={sess._id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center shrink-0 border border-gray-200 text-gray-500">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <span className="font-bold text-gray-800 text-xs block">
                          Audit: {sess.countSheetId?.name || 'Custom Session'}
                        </span>
                        <span className="text-[10px] text-gray-600 block mt-0.5">
                          By {sess.userId?.name} · {new Date(sess.endedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-bold block ${
                          totalVarianceValue === 0
                            ? 'text-gray-600'
                            : totalVarianceValue > 0
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}
                      >
                        Discrepancy: {totalVarianceValue >= 0 ? '+' : ''}
                        {formatCurrency(totalVarianceValue)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT TEMPLATE MODAL */}
      <CenteredModal
        open={modalOpen}
        onClose={closeModal}
        title={editingSheet ? 'Edit Count Sheet' : 'Create Count Sheet'}
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
              form="count-sheet-form"
              disabled={createSheetMutation.isPending || updateSheetMutation.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-sm"
            >
              {createSheetMutation.isPending || updateSheetMutation.isPending ? 'Saving…' : 'Save Count Sheet'}
            </button>
          </div>
        }
      >
        <form id="count-sheet-form" onSubmit={handleSaveSheet} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Sheet Name *</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder="e.g. Weekly Kitchen Audit, Daily Bar Count"
              required
              className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-gray-400"
            />
          </div>

          {/* Select Items checklist */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3">
            <h5 className="text-xs font-bold text-amber-600 uppercase tracking-wide">Configure Sheet Items</h5>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {inventoryItems.map((inv) => {
                const isChecked = selectedItems.includes(inv._id);
                return (
                  <label
                    key={inv._id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                      isChecked
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-350'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleItem(inv._id)}
                      className="w-4 h-4 rounded text-amber-500 border-gray-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{inv.itemName}</p>
                      <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                        Unit: {inv.recipeUnit || inv.unit} · Type: {inv.itemType}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </CenteredModal>

      {/* DELETE CONFIRM */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Count Sheet?"
        message={deleteTarget ? `Are you sure you want to delete count sheet template "${deleteTarget.name}"?` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="delete"
        isLoading={deleteSheetMutation.isPending}
        onConfirm={() => deleteSheetMutation.mutate(deleteTarget._id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
