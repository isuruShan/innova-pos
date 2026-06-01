import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useListSort } from '../../hooks/useListSort';
import {
  ClipboardList, Search, RefreshCw, Save, Loader2, Package, Check, X,
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Toast from '../../components/Toast';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable from '../../components/ResponsiveTable';
import ConsumptionReport from '../../components/inventory/ConsumptionReport';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { useToast, getApiErrorMessage } from '../../hooks/useToast';

export default function StockAudit() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const qc = useQueryClient();
  const { toast, showToast, clearToast } = useToast();

  const [activeTab, setActiveTab] = useState('audit');
  const [searchTerm, setSearchTerm] = useState('');
  const [physicalCounts, setPhysicalCounts] = useState({}); // inventoryItemId -> countString

  const { sort, order, toggleSort } = useListSort('itemName', 'asc');

  // 1. Fetch inventory items
  const { data: items = [], isPending: itemsLoading, refetch } = useQuery({
    queryKey: ['inventory', 'audit', selectedStoreId],
    queryFn: () => api.get('/inventory').then(r => r.data),
    enabled: isStoreReady && activeTab === 'audit',
  });

  // 2. Submit Audit Mutation
  const auditMutation = useMutation({
    mutationFn: (payload) => api.post('/api/inventory/audit', payload),
    onSuccess: (data) => {
      showToast('Stock audit adjustments submitted successfully', 'success');
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setPhysicalCounts({});
    },
    onError: (err) => {
      showToast(getApiErrorMessage(err, 'Failed to submit stock audit'), 'error');
    },
  });

  const handleCountChange = (itemId, val) => {
    setPhysicalCounts(prev => ({
      ...prev,
      [itemId]: val,
    }));
  };

  const handleClearRow = (itemId) => {
    setPhysicalCounts(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  const filteredItems = items.filter(item =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedItems = useMemo(() => {
    let result = [...filteredItems];
    const dir = order === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      if (sort === 'itemName') {
        return a.itemName.localeCompare(b.itemName) * dir;
      }
      if (sort === 'unit') {
        return (a.unit || '').localeCompare(b.unit || '') * dir;
      }
      if (sort === 'systemQty') {
        return (a.quantity - b.quantity) * dir;
      }
      if (sort === 'physicalCount') {
        const valA = physicalCounts[a._id] !== undefined && physicalCounts[a._id] !== '' ? parseFloat(physicalCounts[a._id]) : -1;
        const valB = physicalCounts[b._id] !== undefined && physicalCounts[b._id] !== '' ? parseFloat(physicalCounts[b._id]) : -1;
        return (valA - valB) * dir;
      }
      if (sort === 'variance') {
        const valA = physicalCounts[a._id] !== undefined && physicalCounts[a._id] !== '' ? parseFloat(physicalCounts[a._id]) - a.quantity : 0;
        const valB = physicalCounts[b._id] !== undefined && physicalCounts[b._id] !== '' ? parseFloat(physicalCounts[b._id]) - b.quantity : 0;
        return (valA - valB) * dir;
      }
      return 0;
    });
    return result;
  }, [filteredItems, sort, order, physicalCounts]);

  const pendingAdjustments = Object.entries(physicalCounts).filter(([_, count]) => count !== '').map(([itemId, count]) => {
    const item = items.find(i => i._id === itemId);
    const prev = item ? item.quantity : 0;
    const phys = parseFloat(count);
    return {
      inventoryItemId: itemId,
      physicalCount: phys,
      variance: phys - prev,
    };
  });

  const handleSubmitAudit = () => {
    if (pendingAdjustments.length === 0) {
      showToast('Please enter at least one physical count adjustment first', 'info');
      return;
    }

    auditMutation.mutate({
      items: pendingAdjustments.map(adj => ({
        inventoryItemId: adj.inventoryItemId,
        physicalCount: adj.physicalCount,
      })),
    });
  };

  const pageLoading = !isStoreReady || itemsLoading;

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <ClipboardList className="text-amber-500" size={24} />
              {activeTab === 'audit' ? 'Stock Audit' : 'Consumption Report'}
            </span>
          }
          subtitle={
            activeTab === 'audit'
              ? 'Conduct physical stock counts and submit adjustments to correct quantities.'
              : 'View theoretical vs actual inventory usage based on sales.'
          }
          actions={
            activeTab === 'audit'
              ? [
                  {
                    label: 'Submit Audit',
                    icon: Save,
                    onClick: handleSubmitAudit,
                    primary: true,
                    disabled: pendingAdjustments.length === 0 || auditMutation.isPending,
                  },
                ]
              : []
          }
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700 overflow-x-auto no-scrollbar">
          {[
            { key: 'audit', label: 'Stock Audit' },
            { key: 'consumption', label: 'Consumption Report' },
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
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'consumption' ? (
          <ConsumptionReport />
        ) : (
          <>
            {/* Search Bar / Refresh */}
            <div className="flex items-center gap-3 mb-6 bg-[var(--pos-panel)] rounded-xl border border-slate-700 p-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search inventory items..."
                  className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-500"
                />
              </div>
              <button
                onClick={() => refetch()}
                className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-800 transition"
                title="Refresh List"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Overview of Adjustments Bar */}
            {pendingAdjustments.length > 0 && (
              <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-300">
                  You have <span className="font-semibold text-amber-400">{pendingAdjustments.length}</span> unsaved item count adjustments.
                </div>
                <button
                  onClick={() => setPhysicalCounts({})}
                  className="text-xs text-slate-450 hover:text-slate-200 underline"
                >
                  Reset All
                </button>
              </div>
            )}

            {/* Audit Table */}
            {pageLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-amber-400" />
              </div>
            ) : (
              <ResponsiveTable
                rows={sortedItems}
                rowKey={(item) => item._id}
                loading={false}
                onSort={toggleSort}
                currentSort={sort}
                currentOrder={order}
                emptyState={
                  <span className="flex flex-col items-center gap-2">
                    <Package size={36} className="opacity-30" />
                    No inventory items found
                  </span>
                }
                columns={[
                  {
                    key: 'itemName',
                    header: 'Item Name',
                    mobilePrimary: true,
                    sortField: 'itemName',
                    render: (item) => <span className="font-medium text-[var(--pos-text-primary)]">{item.itemName}</span>,
                  },
                  {
                    key: 'unit',
                    header: 'Unit',
                    sortField: 'unit',
                    render: (item) => <span className="text-slate-400">{item.unit}</span>,
                  },
                  {
                    key: 'systemQty',
                    header: 'System Qty',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    sortField: 'systemQty',
                    render: (item) => <span className="text-slate-300 font-semibold">{item.quantity}</span>,
                  },
                  {
                    key: 'physicalCount',
                    header: 'Physical Count',
                    sortField: 'physicalCount',
                    render: (item) => {
                      const val = physicalCounts[item._id] !== undefined ? physicalCounts[item._id] : '';
                      return (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Enter count"
                            value={val}
                            onChange={(e) => handleCountChange(item._id, e.target.value)}
                            className="w-28 bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 text-right"
                          />
                          {val !== '' && (
                            <button
                              onClick={() => handleClearRow(item._id)}
                              className="text-slate-500 hover:text-slate-300 transition"
                              title="Clear Count"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    key: 'variance',
                    header: 'Variance',
                    className: 'text-right',
                    headerClassName: 'text-right',
                    sortField: 'variance',
                    render: (item) => {
                      const val = physicalCounts[item._id];
                      if (val === undefined || val === '') return <span className="text-slate-500">—</span>;
                      const variance = parseFloat(val) - item.quantity;
                      const color = variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-green-400' : 'text-red-400';
                      return (
                        <span className={`font-semibold ${color}`}>
                          {variance > 0 ? '+' : ''}{Math.round(variance * 100) / 100}
                        </span>
                      );
                    },
                  },
                ]}
              />
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} variant={toast.variant} onClose={clearToast} />}
    </div>
  );
}
