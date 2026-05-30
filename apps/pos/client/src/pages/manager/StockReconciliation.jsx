import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, Search, RefreshCw, BarChart3, AlertTriangle, ArrowUpDown, ChevronDown, CheckCircle
} from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import PageHeader from '../../components/PageHeader';
import PosDateField from '../../components/PosDateField';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency } from '../../utils/format';

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function StockReconciliation() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [startDate, setStartDate] = useState(sevenDaysAgo());
  const [endDate, setEndDate] = useState(todayStr());
  const [search, setSearch] = useState('');

  const { data: reconciliationReport = [], isPending, refetch, isFetching } = useQuery({
    queryKey: ['stock-reconciliation', selectedStoreId, startDate, endDate],
    queryFn: () => api.get('/inventory/reconciliation', { params: { startDate, endDate } }).then((r) => r.data),
    enabled: isStoreReady && !!startDate && !!endDate,
  });

  const filteredReport = useMemo(() => {
    if (!search.trim()) return reconciliationReport;
    const q = search.toLowerCase();
    return reconciliationReport.filter(item => 
      (item.itemName || '').toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q)
    );
  }, [reconciliationReport, search]);

  const stats = useMemo(() => {
    let totalNegativeVarianceVal = 0;
    let totalPositiveVarianceVal = 0;
    let itemsWithDiscrepancies = 0;

    reconciliationReport.forEach(item => {
      if (item.variance < -0.001) {
        totalNegativeVarianceVal += Math.abs(item.varianceValue);
        itemsWithDiscrepancies++;
      } else if (item.variance > 0.001) {
        totalPositiveVarianceVal += item.varianceValue;
        itemsWithDiscrepancies++;
      }
    });

    return {
      totalNegativeVarianceVal,
      totalPositiveVarianceVal,
      itemsWithDiscrepancies,
    };
  }, [reconciliationReport]);

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <PageHeader
          title={<span className="flex items-center gap-2"><BarChart3 size={20} className="text-amber-400" />Stock Reconciliation</span>}
          subtitle="Compare theoretical stock levels based on sales/waste against actual stock on hand"
          actions={[
            {
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => refetch(),
              disabled: isPending || isFetching
            }
          ]}
        />

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unaccounted Losses</p>
            <p className="text-xl font-bold text-red-400 mt-1 tabular-nums">{formatCurrency(stats.totalNegativeVarianceVal)}</p>
            <p className="text-[10px] text-slate-600 mt-1">Value of missing inventory items</p>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Surplus Variance</p>
            <p className="text-xl font-bold text-green-400 mt-1 tabular-nums">{formatCurrency(stats.totalPositiveVarianceVal)}</p>
            <p className="text-[10px] text-slate-600 mt-1">Unlogged gains or count excesses</p>
          </div>
          <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flagged Items</p>
            <p className="text-xl font-bold text-amber-400 mt-1 tabular-nums">
              {stats.itemsWithDiscrepancies} / {reconciliationReport.length}
            </p>
            <p className="text-[10px] text-slate-600 mt-1">Ingredients showing variance levels</p>
          </div>
        </div>

        {/* Date Filter & Search Row */}
        <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl p-4 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Start Date</label>
              <PosDateField
                value={startDate}
                onChange={setStartDate}
                max={endDate}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">End Date</label>
              <PosDateField
                value={endDate}
                onChange={setEndDate}
                min={startDate}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex-1 flex flex-col justify-end">
              <label className="text-xs text-slate-500 block mb-1">Filter Item</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search ingredient by name or SKU..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] text-sm rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table view */}
        <div className="bg-[var(--pos-panel)] border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/40 text-slate-400 font-semibold border-b border-slate-700/60">
                  <th className="p-4">Item Name / SKU</th>
                  <th className="p-4 text-center">Unit</th>
                  <th className="p-4 text-right">Start Stock</th>
                  <th className="p-4 text-right text-green-400">GRN In</th>
                  <th className="p-4 text-right text-red-400">Return Out</th>
                  <th className="p-4 text-right text-sky-400">Sales Cons.</th>
                  <th className="p-4 text-right text-amber-500">Proc. Loss</th>
                  <th className="p-4 text-right text-rose-400">Direct Waste</th>
                  <th className="p-4 text-right font-medium text-slate-300">Theoretical</th>
                  <th className="p-4 text-right font-medium text-slate-300">Actual (Now)</th>
                  <th className="p-4 text-right font-bold text-slate-300">Variance</th>
                  <th className="p-4 text-right">Cost</th>
                  <th className="p-4 text-right font-bold">Variance Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {isPending ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-500">Calculating reconciliation data...</td>
                  </tr>
                ) : filteredReport.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-500">No inventory items found</td>
                  </tr>
                ) : (
                  filteredReport.map((item) => {
                    const hasLoss = item.variance < -0.001;
                    const hasSurplus = item.variance > 0.001;
                    
                    return (
                      <tr key={item._id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-slate-200">{item.itemName}</p>
                          {item.sku && <p className="text-[10px] text-slate-500">{item.sku}</p>}
                        </td>
                        <td className="p-4 text-center text-slate-500">{item.unit}</td>
                        <td className="p-4 text-right tabular-nums">{item.startingStock.toFixed(2)}</td>
                        <td className="p-4 text-right text-green-400 tabular-nums">+{item.grnReceived.toFixed(2)}</td>
                        <td className="p-4 text-right text-red-400/80 tabular-nums">-{Math.abs(item.returns).toFixed(2)}</td>
                        <td className="p-4 text-right text-sky-400/80 tabular-nums">-{Math.abs(item.salesConsumption).toFixed(2)}</td>
                        <td className="p-4 text-right text-amber-500/80 tabular-nums">-{Math.abs(item.processingLoss).toFixed(2)}</td>
                        <td className="p-4 text-right text-rose-400/80 tabular-nums">-{Math.abs(item.directWastage).toFixed(2)}</td>
                        <td className="p-4 text-right font-medium text-slate-300 tabular-nums">{item.theoreticalStock.toFixed(2)}</td>
                        <td className="p-4 text-right font-medium text-slate-300 tabular-nums">{item.actualStock.toFixed(2)}</td>
                        <td className={`p-4 text-right font-bold tabular-nums ${
                          hasLoss ? 'text-red-400' : hasSurplus ? 'text-green-400' : 'text-slate-500'
                        }`}>
                          {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}
                        </td>
                        <td className="p-4 text-right text-slate-500 tabular-nums">{formatCurrency(item.costPrice)}</td>
                        <td className={`p-4 text-right font-bold tabular-nums ${
                          hasLoss ? 'text-red-400' : hasSurplus ? 'text-green-400' : 'text-slate-500'
                        }`}>
                          {item.varianceValue > 0 ? '+' : ''}{formatCurrency(item.varianceValue)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
