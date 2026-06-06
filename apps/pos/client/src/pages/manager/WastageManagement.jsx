import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Calendar, Package, Trash2, SlidersHorizontal, ChevronDown, X,
  Search, FileText, AlertTriangle, Eye, CheckCircle, List, LayoutGrid
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Toast from '../../components/Toast';
import SlideOver from '../../components/SlideOver';
import PageHeader from '../../components/PageHeader';
import PosDateField from '../../components/PosDateField';
import InventorySearchSelect from '../../components/inventory/InventorySearchSelect';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';
import Badge from '../../components/Badge';
import ResponsiveTable from '../../components/ResponsiveTable';
import ViewModeToggle from '../../components/ViewModeToggle';

const REASON_LABELS = {
  expiry: 'Expired Product',
  damage: 'Damaged Goods',
  spillage: 'Spillage / Prep Loss',
  other: 'Other Waste',
};

const TYPE_LABELS = {
  end_of_day: 'End of Day Waste',
  spill_expiry_damage: 'Spill / Expiry / Damage',
};

export default function WastageManagement() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [slideOpen, setSlideOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeReport, setActiveReport] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_wastage_management');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_wastage_management', mode);
  };
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'end_of_day', 'spill_expiry_damage'

  // New Wastage Report Form State
  const [notes, setNotes] = useState('');
  const [wastageType, setWastageType] = useState('spill_expiry_damage');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]); // Array of { inventoryItemId: '', quantity: 0, reason: 'spillage' }

  const qc = useQueryClient();
  const { toast, showToast, clearToast } = useToast();

  const { data: reports = [], isPending: reportsPending } = useQuery({
    queryKey: ['wastage-reports', selectedStoreId],
    queryFn: () => api.get('/wastage').then((r) => r.data),
    enabled: isStoreReady,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', selectedStoreId],
    queryFn: () => api.get('/inventory').then((r) => r.data),
    enabled: isStoreReady,
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/wastage', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wastage-reports'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      closeWastageForm();
      showToast('Wastage report submitted successfully', 'success');
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to submit wastage report'));
    },
  });

  const sortedAndFiltered = useMemo(() => {
    let result = [...reports];

    // 1. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => 
        (r.notes || '').toLowerCase().includes(q) ||
        (r.createdBy?.name || '').toLowerCase().includes(q) ||
        r.items.some(item => (item.inventoryItemId?.itemName || '').toLowerCase().includes(q))
      );
    }

    // 2. Date Range Filter
    if (fromDate) {
      const from = new Date(`${fromDate}T00:00:00`);
      result = result.filter(r => new Date(r.date) >= from);
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      result = result.filter(r => new Date(r.date) <= to);
    }

    // 3. Type Filter
    if (typeFilter !== 'all') {
      result = result.filter(r => r.type === typeFilter);
    }

    return result;
  }, [reports, search, fromDate, toDate, typeFilter]);

  const openLogWastage = () => {
    setNotes('');
    setWastageType('spill_expiry_damage');
    setReportDate(new Date().toISOString().split('T')[0]);
    setItems([{ inventoryItemId: '', quantity: 1, reason: 'spillage' }]);
    setSlideOpen(true);
  };

  const closeWastageForm = () => {
    setSlideOpen(false);
    setItems([]);
  };

  const handleAddItemRow = () => {
    setItems(prev => [...prev, { inventoryItemId: '', quantity: 1, reason: 'spillage' }]);
  };

  const handleRemoveItemRow = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: val };
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.some(item => !item.inventoryItemId)) {
      showToast('Select an inventory item for all rows', 'error');
      return;
    }
    if (items.some(item => Number(item.quantity) <= 0)) {
      showToast('Wastage quantity must be greater than 0', 'error');
      return;
    }
    createMutation.mutate({
      date: reportDate,
      type: wastageType,
      notes,
      items
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <PageHeader
          title={<span className="flex items-center gap-2"><AlertTriangle size={20} className="text-red-400" />Wastage Management</span>}
          subtitle={`${reports.length} report${reports.length !== 1 ? 's' : ''} logged`}
          actions={[
            { label: 'Log Wastage', icon: Plus, onClick: openLogWastage, primary: true },
          ]}
        />

        {/* Search + Filter controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-[var(--pos-panel)] p-3 rounded-xl border border-slate-700/50 items-center justify-between">
          <div className="flex-1 w-full flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-700 rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search wastage notes, items, user..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-sm focus:outline-none placeholder-slate-650"
            />
            {search && (
              <button onClick={() => setSearch('')}><X size={13} className="text-slate-500 hover:text-white" /></button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            {/* View toggle */}
            <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />

            <div className="relative">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  (fromDate || toDate || typeFilter !== 'all')
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 font-semibold'
                    : 'bg-[var(--pos-surface-inset)] border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Filters</span>
                {(fromDate || toDate || typeFilter !== 'all') && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--pos-panel)]">
                    {(fromDate || toDate ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)}
                  </span>
                )}
                <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-[var(--pos-panel)] border border-slate-700 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <span className="text-xs font-semibold text-slate-350">Filters</span>
                    {(fromDate || toDate || typeFilter !== 'all') && (
                      <button
                        onClick={() => { setFromDate(''); setToDate(''); setTypeFilter('all'); }}
                        className="text-[10px] text-amber-450 hover:underline"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {/* Type Filter */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-450 uppercase tracking-wider mb-2">Wastage Type</p>
                    <div className="flex flex-col gap-1">
                      {[
                        { key: 'all', label: 'All Types' },
                        { key: 'spill_expiry_damage', label: 'Spill/Expiry/Damage' },
                        { key: 'end_of_day', label: 'End of Day Waste' },
                      ].map((t) => {
                        const active = typeFilter === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => { setTypeFilter(t.key); setShowFilters(false); }}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition ${
                              active
                                ? 'bg-amber-500/15 text-amber-400 font-semibold border-l-2 border-amber-500'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <span>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="pt-2 border-t border-slate-800/60">
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
          </div>
        </div>

        {/* List of Wastage Reports */}
        {reportsPending ? (
          <div className="text-center py-16 text-slate-550">Loading wastage reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle size={48} className="mx-auto mb-4 text-slate-650 opacity-40" />
            <p className="text-slate-500 text-lg mb-2">No wastage reports logged yet</p>
            <p className="text-slate-600 text-sm mb-6">Create a report to document spillage, expiry, or damage</p>
            <button
              type="button"
              onClick={openLogWastage}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              <Plus size={16} />
              Log wastage
            </button>
          </div>
        ) : sortedAndFiltered.length === 0 ? (
          <div className="text-center py-16">
            <Search size={48} className="mx-auto mb-4 text-slate-650 opacity-40" />
            <p className="text-slate-555 text-lg mb-2">No reports match your search</p>
            <p className="text-slate-600 text-sm">Try adjusting your filters or query</p>
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
                    key: 'date', header: 'Date',
                    mobilePrimary: true,
                    render: (r) => (
                      <span className="font-semibold text-[var(--pos-text-primary)]">
                        {formatDate(r.date)}
                      </span>
                    ),
                  },
                  {
                    key: 'type', header: 'Wastage Type',
                    render: (r) => (
                      <Badge
                        label={TYPE_LABELS[r.type] || r.type}
                        variant={r.type === 'end_of_day' ? 'info' : 'critical'}
                      />
                    ),
                  },
                  {
                    key: 'items', header: 'Wasted Items',
                    mobileSecondary: true,
                    render: (r) => (
                      <div className="space-y-1">
                        {r.items.slice(0, 2).map((item, idx) => (
                          <div key={idx} className="text-slate-350">
                            {item.inventoryItemId?.itemName || 'Unknown Item'}{' '}
                            <span className="text-rose-455 font-bold">({item.quantity} {item.inventoryItemId?.unit})</span>
                          </div>
                        ))}
                        {r.items.length > 2 && (
                          <p className="text-slate-500 text-[10px]">+{r.items.length - 2} more items</p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'notes', header: 'Notes',
                    render: (r) => (
                      <span className="text-slate-450 italic truncate max-w-xs block" title={r.notes}>
                        {r.notes || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'createdBy', header: 'Logged By',
                    render: (r) => <span className="text-slate-305">{r.createdBy?.name || 'Staff'}</span>,
                  },
                  {
                    key: 'actions', header: '',
                    render: (r) => (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setActiveReport(r)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-450 hover:text-white transition"
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sortedAndFiltered.map((report) => (
                  <div key={report._id} className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-600 transition">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Badge
                            label={TYPE_LABELS[report.type] || report.type}
                            variant={report.type === 'end_of_day' ? 'info' : 'critical'}
                            className="text-[10px] px-1.5 py-0.5"
                          />
                          <h4 className="text-[var(--pos-text-primary)] font-bold text-sm mt-1.5 flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-500" />
                            {formatDate(report.date)}
                          </h4>
                        </div>
                        <button
                          onClick={() => setActiveReport(report)}
                          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </div>

                      <div className="space-y-1.5 border-t border-slate-800/40 pt-3">
                        <p className="text-slate-500 text-xs font-medium">Wasted Items ({report.items.length})</p>
                        <div className="space-y-1">
                          {report.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-slate-300 bg-slate-800/20 px-2 py-1 rounded">
                              <span>{item.inventoryItemId?.itemName || 'Unknown Item'}</span>
                              <span className="font-semibold text-rose-400">{item.quantity} {item.inventoryItemId?.unit}</span>
                            </div>
                          ))}
                          {report.items.length > 3 && (
                            <p className="text-slate-600 text-[10px] italic">+{report.items.length - 3} more items...</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {report.notes && (
                      <p className="text-xs text-slate-500 italic mt-3 bg-slate-800/30 px-3 py-1.5 rounded line-clamp-2">
                        {report.notes}
                      </p>
                    )}

                    <div className="text-[10px] text-slate-600 flex justify-between items-center mt-3 pt-2 border-t border-slate-800/20">
                      <span>Logged by: {report.createdBy?.name || 'Staff'}</span>
                      <span>{new Date(report.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Wastage Form SlideOver */}
      <SlideOver open={slideOpen} onClose={closeWastageForm} title="Log Wastage">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Wastage Type</label>
            <select
              value={wastageType}
              onChange={e => setWastageType(e.target.value)}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="spill_expiry_damage">Spillage / Expiry / Damage</option>
              <option value="end_of_day">End of Day Waste</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Date</label>
            <PosDateField
              value={reportDate}
              onChange={setReportDate}
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-300">Wasted Items</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="bg-slate-800/40 p-3 rounded-xl border border-slate-800 space-y-2 relative">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="absolute right-2 top-2 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Item</label>
                    <InventorySearchSelect
                      value={item.inventoryItemId}
                      inventory={inventory}
                      onChange={val => handleItemChange(idx, 'inventoryItemId', val)}
                      onAddNewClick={() => showToast('Create item in Suppliers/Inventory management first', 'info')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Qty</label>
                      <input
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Reason</label>
                      <select
                        value={item.reason}
                        onChange={e => handleItemChange(idx, 'reason', e.target.value)}
                        className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                      >
                        <option value="spillage">Spillage</option>
                        <option value="expiry">Expiry</option>
                        <option value="damage">Damage</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="E.g., Batch of buns expired; container spillage details..."
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeWastageForm}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {createMutation.isPending ? 'Saving…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </SlideOver>

      {/* View Details Modal SlideOver */}
      <SlideOver open={!!activeReport} onClose={() => setActiveReport(null)} title="Wastage Details">
        {activeReport && (
          <div className="space-y-4">
            <div className="bg-slate-800/40 p-4 rounded-xl space-y-2">
              <p className="text-xs text-slate-500">Report Type</p>
              <p className="text-sm font-bold text-[var(--pos-text-primary)]">{TYPE_LABELS[activeReport.type]}</p>

              <p className="text-xs text-slate-500 pt-2">Logged Date</p>
              <p className="text-sm font-bold text-[var(--pos-text-primary)] flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-500" />
                {formatDate(activeReport.date)}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wasted Items</h4>
              <div className="space-y-2">
                {activeReport.items.map((item, idx) => (
                  <div key={idx} className="bg-[var(--pos-surface-inset)] border border-slate-700/60 p-3 rounded-xl flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-200">{item.inventoryItemId?.itemName || 'Unknown Item'}</p>
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded capitalize">
                        Reason: {REASON_LABELS[item.reason] || item.reason}
                      </span>
                    </div>
                    <span className="text-rose-400 font-bold tabular-nums">
                      {item.quantity} {item.inventoryItemId?.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {activeReport.notes && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notes</h4>
                <div className="bg-slate-800/20 text-xs text-slate-300 p-3 rounded-xl border border-slate-800 italic">
                  {activeReport.notes}
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 space-y-1 bg-slate-800/10 p-3 rounded-xl border border-slate-800/40">
              <p>Logged by: <span className="text-slate-400 font-medium">{activeReport.createdBy?.name || 'Staff'}</span></p>
              <p>Created at: <span className="text-slate-400 font-medium">{new Date(activeReport.createdAt).toLocaleString()}</span></p>
            </div>

            <button
              onClick={() => setActiveReport(null)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl transition text-sm mt-4"
            >
              Close
            </button>
          </div>
        )}
      </SlideOver>

      <Toast toast={toast} onDismiss={clearToast} />
    </div>
  );
}
