import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Calendar, Package, Trash2, SlidersHorizontal, ChevronDown, X,
  Search, FileText, AlertTriangle, Eye, CheckCircle, List, LayoutGrid, UtensilsCrossed,
  ArrowUp, ArrowDown
} from 'lucide-react';
import api from '../../api/axios';
import Toast from '../../components/Toast';
import CenteredModal from '../../components/CenteredModal';
import PageHeader from '../../components/PageHeader';
import PosDateField from '../../components/PosDateField';
import InventorySearchSelect from '../../components/inventory/InventorySearchSelect';
import MenuSearchSelect from '../../components/inventory/MenuSearchSelect';
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
  const { selectedStoreId, isStoreReady, stores, selectStore } = useStoreContext();
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
  const [items, setItems] = useState([]); // Array of { itemType: 'inventory', inventoryItemId: '', menuItemId: '', variantId: '', quantity: 1, reason: 'spillage' }
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

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

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then((r) => r.data),
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
        r.items.some(item => {
          const itemName = item.itemType === 'menu'
            ? item.menuItemId?.name
            : item.inventoryItemId?.itemName;
          return (itemName || '').toLowerCase().includes(q);
        })
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

    // 4. Sorting (default: createdAt descending)
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Handle nested or custom fields
      if (sortField === 'itemsCount') {
        valA = a.items?.length || 0;
        valB = b.items?.length || 0;
      } else if (sortField === 'createdBy') {
        valA = a.createdBy?.name || '';
        valB = b.createdBy?.name || '';
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [reports, search, fromDate, toDate, typeFilter, sortField, sortOrder]);

  const openLogWastage = () => {
    setNotes('');
    setWastageType('spill_expiry_damage');
    setReportDate(new Date().toISOString().split('T')[0]);
    setItems([{ itemType: 'inventory', inventoryItemId: '', menuItemId: '', variantId: '', quantity: 1, reason: 'spillage' }]);
    setSlideOpen(true);
  };

  const closeWastageForm = () => {
    setSlideOpen(false);
    setItems([]);
  };

  const handleAddItemRow = () => {
    setItems(prev => [...prev, { itemType: 'inventory', inventoryItemId: '', menuItemId: '', variantId: '', quantity: 1, reason: 'spillage' }]);
  };

  const handleRemoveItemRow = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updatedItem = { ...item, [field]: val };
      // Reset values if item type changes
      if (field === 'itemType') {
        updatedItem.inventoryItemId = '';
        updatedItem.menuItemId = '';
        updatedItem.variantId = '';
      }
      return updatedItem;
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (items.some(item => item.itemType === 'inventory' && !item.inventoryItemId)) {
      showToast('Select an inventory item for all inventory rows', 'error');
      return;
    }
    if (items.some(item => item.itemType === 'menu' && !item.menuItemId)) {
      showToast('Select a menu item for all menu rows', 'error');
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
      items: items.map(item => ({
        itemType: item.itemType || 'inventory',
        inventoryItemId: item.itemType === 'inventory' ? item.inventoryItemId : undefined,
        menuItemId: item.itemType === 'menu' ? item.menuItemId : undefined,
        variantId: item.itemType === 'menu' ? item.variantId || null : undefined,
        quantity: Number(item.quantity),
        reason: item.reason,
      }))
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
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <PageHeader
          title={<span className="flex items-center gap-2"><AlertTriangle size={20} className="text-red-400" />Wastage Management</span>}
          subtitle={`${reports.length} report${reports.length !== 1 ? 's' : ''} logged`}
          actions={[
            { label: 'Log Wastage', icon: Plus, onClick: openLogWastage, primary: true },
          ]}
        />

        {/* Search + Filter controls */}
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
              placeholder="Search wastage notes, items, user..."
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

            <div className="relative">
              <button
                onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition ${
                  (fromDate || toDate || typeFilter !== 'all')
                    ? 'bg-brand-orange/15 border-amber-500/30 text-brand-orange font-semibold'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Filters</span>
                {(fromDate || toDate || typeFilter !== 'all') && (
                  <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[var(--pos-panel)]">
                    {(fromDate || toDate ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)}
                  </span>
                )}
                <ChevronDown size={13} className={`transition ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span className="text-xs font-semibold text-slate-350">Filters</span>
                    {(fromDate || toDate || typeFilter !== 'all') && (
                      <button
                        onClick={() => { setFromDate(''); setToDate(''); setTypeFilter('all'); }}
                        className="text-[10px] text-amber-455 hover:underline"
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
                                ? 'bg-brand-orange/15 text-brand-orange font-semibold border-l-2 border-amber-500'
                                : 'text-gray-500 hover:bg-slate-800 hover:text-white'
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

            <label htmlFor="wastage-sort" className="text-xs text-gray-400 shrink-0 ml-2">Sort</label>
            <select
              id="wastage-sort"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="createdAt">Created Date</option>
              <option value="date">Logged Date</option>
              <option value="type">Wastage Type</option>
              <option value="itemsCount">Items Count</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-white transition"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>
        </div>

        {/* List of Wastage Reports */}
        {reportsPending ? (
          <div className="text-center py-16 text-slate-550">Loading wastage reports...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle size={48} className="mx-auto mb-4 text-slate-650 opacity-40" />
            <p className="text-gray-400 text-lg mb-2">No wastage reports logged yet</p>
            <p className="text-slate-600 text-sm mb-6">Create a report to document spillage, expiry, or damage</p>
            <button
              type="button"
              onClick={openLogWastage}
              className="inline-flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white font-semibold px-5 py-2.5 rounded-xl transition"
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
                      <span className="font-semibold text-gray-900">
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
                        {r.items.slice(0, 2).map((item, idx) => {
                          const name = item.itemType === 'menu'
                            ? (item.menuItemId?.name + (item.variantId ? ` (${item.menuItemId.variants?.find(v => String(v._id) === String(item.variantId))?.name || ''})` : ''))
                            : (item.inventoryItemId?.itemName || 'Unknown Item');
                          const unit = item.itemType === 'menu' ? 'unit' : (item.inventoryItemId?.unit || '');
                          return (
                            <div key={idx} className="text-slate-355">
                              {item.itemType === 'menu' ? <UtensilsCrossed size={11} className="inline mr-1 text-amber-500" /> : <Package size={11} className="inline mr-1 text-gray-400" />}
                              {name}{' '}
                              <span className="text-rose-455 font-bold">({item.quantity} {unit})</span>
                            </div>
                          );
                        })}
                        {r.items.length > 2 && (
                          <p className="text-gray-400 text-[10px]">+{r.items.length - 2} more items</p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'notes', header: 'Notes',
                    render: (r) => (
                      <span className="text-slate-455 italic truncate max-w-xs block" title={r.notes}>
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
                  <div key={report._id} className="bg-white border border-gray-200/50 rounded-xl p-3.5 flex flex-col justify-between hover:border-gray-300 transition">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Badge
                            label={TYPE_LABELS[report.type] || report.type}
                            variant={report.type === 'end_of_day' ? 'info' : 'critical'}
                            className="text-[10px] px-1.5 py-0.5"
                          />
                          <h4 className="text-gray-900 font-bold text-sm mt-1.5 flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            {formatDate(report.date)}
                          </h4>
                        </div>
                        <button
                          onClick={() => setActiveReport(report)}
                          className="p-1.5 rounded-lg bg-slate-800 text-gray-500 hover:text-white transition"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                      </div>

                      <div className="space-y-1.5 border-t border-slate-800/40 pt-3">
                        <p className="text-gray-400 text-xs font-medium">Wasted Items ({report.items.length})</p>
                        <div className="space-y-1">
                          {report.items.slice(0, 3).map((item, idx) => {
                            const name = item.itemType === 'menu'
                              ? (item.menuItemId?.name + (item.variantId ? ` (${item.menuItemId.variants?.find(v => String(v._id) === String(item.variantId))?.name || ''})` : ''))
                              : (item.inventoryItemId?.itemName || 'Unknown Item');
                            const unit = item.itemType === 'menu' ? 'unit' : (item.inventoryItemId?.unit || '');
                            return (
                              <div key={idx} className="flex justify-between text-xs text-slate-300 bg-slate-800/20 px-2 py-1 rounded">
                                <span className="flex items-center gap-1 truncate">
                                  {item.itemType === 'menu' ? <UtensilsCrossed size={11} className="text-amber-500 shrink-0" /> : <Package size={11} className="text-gray-400 shrink-0" />}
                                  <span className="truncate">{name}</span>
                                </span>
                                <span className="font-semibold text-rose-400 shrink-0">{item.quantity} {unit}</span>
                              </div>
                            );
                          })}
                          {report.items.length > 3 && (
                            <p className="text-slate-600 text-[10px] italic">+{report.items.length - 3} more items...</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {report.notes && (
                      <p className="text-xs text-gray-400 italic mt-3 bg-slate-800/30 px-3 py-1.5 rounded line-clamp-2">
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

      {/* Log Wastage Form Popup Modal */}
      <CenteredModal open={slideOpen} onClose={closeWastageForm} title="Log Wastage" maxWidth="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Wastage Type</label>
            <select
              value={wastageType}
              onChange={e => setWastageType(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-300">Wasted Items</label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-amber-500 hover:text-brand-orange font-semibold flex items-center gap-1"
              >
                <Plus size={12} /> Add Item
              </button>
            </div>

            {/* Set a larger max-height and bottom padding pb-24 so absolute dropdown searches have plenty of space to overlay without being cut off */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 pb-24 relative overflow-visible">
              {items.map((item, idx) => (
                <div key={idx} className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 relative overflow-visible">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="absolute -top-2 -right-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 border border-red-500/25 rounded-full transition shadow-lg z-10"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  <div className="grid grid-cols-12 gap-3 items-end">
                    {/* Item Type selection */}
                    <div className="col-span-12 sm:col-span-3">
                      <label className="block text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Type</label>
                      <select
                        value={item.itemType || 'inventory'}
                        onChange={e => handleItemChange(idx, 'itemType', e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="inventory">Inventory Item</option>
                        <option value="menu">Menu Item</option>
                      </select>
                    </div>

                    {/* Conditional Select Search input with more width */}
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Select Item</label>
                      {item.itemType === 'menu' ? (
                        <MenuSearchSelect
                          menuItemId={item.menuItemId}
                          variantId={item.variantId}
                          menuItems={menuItems}
                          onChange={(menuId, varId) => {
                            handleItemChange(idx, 'menuItemId', menuId);
                            handleItemChange(idx, 'variantId', varId);
                          }}
                        />
                      ) : (
                        <InventorySearchSelect
                          value={item.inventoryItemId}
                          inventory={inventory}
                          onChange={val => handleItemChange(idx, 'inventoryItemId', val)}
                          onAddNewClick={() => showToast('Create item in Suppliers/Inventory management first', 'info')}
                        />
                      )}
                    </div>

                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Qty</label>
                      <input
                        type="number"
                        step="any"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2.5 py-2 focus:outline-none"
                      />
                    </div>

                    <div className="col-span-6 sm:col-span-2">
                      <label className="block text-[10px] text-gray-400 mb-1 font-semibold uppercase tracking-wider">Reason</label>
                      <select
                        value={item.reason}
                        onChange={e => handleItemChange(idx, 'reason', e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg px-2 py-2 focus:outline-none"
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
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600 resize-none"
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
              className="flex-1 bg-brand-orange hover:bg-brand-orange-hover disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {createMutation.isPending ? 'Saving…' : 'Submit Report'}
            </button>
          </div>
        </form>
      </CenteredModal>

      {/* View Details Popup Modal */}
      <CenteredModal open={!!activeReport} onClose={() => setActiveReport(null)} title="Wastage Details" maxWidth="max-w-2xl">
        {activeReport && (
          <div className="space-y-4">
            <div className="bg-slate-800/40 p-4 rounded-xl space-y-2">
              <p className="text-xs text-gray-400">Report Type</p>
              <p className="text-sm font-bold text-gray-900">{TYPE_LABELS[activeReport.type]}</p>

              <p className="text-xs text-gray-400 pt-2">Logged Date</p>
              <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar size={14} className="text-gray-400" />
                {formatDate(activeReport.date)}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Wasted Items</h4>
              <div className="space-y-2">
                {activeReport.items.map((item, idx) => {
                  const name = item.itemType === 'menu'
                    ? (item.menuItemId?.name + (item.variantId ? ` (${item.menuItemId.variants?.find(v => String(v._id) === String(item.variantId))?.name || ''})` : ''))
                    : (item.inventoryItemId?.itemName || 'Unknown Item');
                  const unit = item.itemType === 'menu' ? 'unit' : (item.inventoryItemId?.unit || '');
                  return (
                    <div key={idx} className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {item.itemType === 'menu' ? <UtensilsCrossed size={14} className="text-amber-500" /> : <Package size={14} className="text-gray-400" />}
                        <div>
                          <p className="font-semibold text-slate-200">{name}</p>
                          <span className="text-[10px] text-gray-400 bg-slate-800 px-1.5 py-0.5 rounded capitalize">
                            Reason: {REASON_LABELS[item.reason] || item.reason}
                          </span>
                        </div>
                      </div>
                      <span className="text-rose-400 font-bold tabular-nums">
                        {item.quantity} {unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {activeReport.notes && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Notes</h4>
                <div className="bg-slate-800/20 text-xs text-slate-300 p-3 rounded-xl border border-slate-800 italic">
                  {activeReport.notes}
                </div>
              </div>
            )}

            <div className="text-xs text-gray-400 space-y-1 bg-slate-800/10 p-3 rounded-xl border border-slate-800/40">
              <p>Logged by: <span className="text-gray-500 font-medium">{activeReport.createdBy?.name || 'Staff'}</span></p>
              <p>Created at: <span className="text-gray-500 font-medium">{new Date(activeReport.createdAt).toLocaleString()}</span></p>
            </div>

            <button
              onClick={() => setActiveReport(null)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl transition text-sm mt-4"
            >
              Close
            </button>
          </div>
        )}
      </CenteredModal>

      <Toast toast={toast} onDismiss={clearToast} />
    </div>
  );
}
