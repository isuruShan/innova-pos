import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package, TrendingDown, TrendingUp, Download, Calendar } from 'lucide-react';
import api from '../../api/axios';
import { useStoreContext } from '../../context/StoreContext';

// Helper to get date 7 days ago
const getDefaultFromDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split('T')[0];
};

const getDefaultToDate = () => {
  return new Date().toISOString().split('T')[0];
};

export default function ConsumptionReport() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [fromDate, setFromDate] = useState(getDefaultFromDate());
  const [toDate, setToDate] = useState(getDefaultToDate());
  const [hasRun, setHasRun] = useState(false);

  const { data: report, isFetching, refetch } = useQuery({
    queryKey: ['consumption-report', selectedStoreId, fromDate, toDate],
    queryFn: () => api.get('/inventory/consumption-report', { params: { from: fromDate, to: toDate } }).then(r => r.data),
    enabled: false, // Don't auto-run, wait for user to click Generate
  });

  const isPending = isFetching;

  const handleGenerate = () => {
    setHasRun(true);
    refetch();
  };

  const handleExportCSV = () => {
    if (!report?.items?.length) return;

    const headers = ['Item Name', 'Unit', 'Starting Stock', 'Theoretical Usage', 'Expected Stock', 'Current Stock', 'Variance', 'Variance %'];
    const rows = report.items.map(item => [
      item.itemName,
      item.unit,
      item.startingStock,
      item.theoreticalUsage,
      item.expectedStock,
      item.currentStock,
      item.variance,
      `${item.variancePercentage}%`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumption-report-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-400 mb-1.5">From Date</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFromDate(val);
                  if (toDate && val > toDate) {
                    setToDate(val);
                  }
                }}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-400 mb-1.5">To Date</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setToDate(val);
                  if (fromDate && val < fromDate) {
                    setFromDate(val);
                  }
                }}
                className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isFetching || !fromDate || !toDate || fromDate > toDate}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
          >
            {isFetching ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>Generate Report</>
            )}
          </button>

          {report?.items?.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 border border-slate-600 hover:border-amber-500 text-slate-300 hover:text-amber-400 font-medium px-4 py-2 rounded-lg transition text-sm"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Items Tracked</p>
                <p className="text-2xl font-bold text-[var(--pos-text-primary)]">{report.summary?.totalItems ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Completed Orders</p>
                <p className="text-2xl font-bold text-[var(--pos-text-primary)]">{report.summary?.totalOrders ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Items with Variance</p>
                <p className="text-2xl font-bold text-[var(--pos-text-primary)]">{report.summary?.itemsWithVariance ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {isFetching && hasRun && (
        <div className="flex items-center justify-center py-12 bg-[var(--pos-panel)] rounded-xl border border-slate-700/50">
          <Loader2 size={24} className="animate-spin text-amber-400" />
        </div>
      )}

      {!isPending && !report && !hasRun && (
        <div className="text-center py-12 bg-[var(--pos-panel)] rounded-xl border border-slate-700/50">
          <Package size={32} className="mx-auto mb-3 text-slate-500 opacity-50" />
          <p className="text-sm text-slate-400">Select a date range and click Generate Report</p>
          <p className="text-xs text-slate-600 mt-1">This shows theoretical ingredient usage vs actual stock levels</p>
        </div>
      )}

      {!isPending && report?.items?.length === 0 && hasRun && (
        <div className="text-center py-12 bg-[var(--pos-panel)] rounded-xl border border-slate-700/50">
          <Package size={32} className="mx-auto mb-3 text-slate-500 opacity-50" />
          <p className="text-sm text-slate-400">No consumption data for this period</p>
          <p className="text-xs text-slate-600 mt-1">No completed orders with linked ingredients found</p>
        </div>
      )}

      {!isPending && report?.items?.length > 0 && (
        <div className="bg-[var(--pos-panel)] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-[var(--pos-surface-inset)]/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Starting Stock
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Theoretical Usage
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Expected Stock
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Current Stock
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {report.items.map((item) => {
                  const hasVariance = Math.abs(item.variance) > 0.1;
                  const isPositive = item.variance > 0;
                  const varianceColor = !hasVariance 
                    ? 'text-slate-500' 
                    : isPositive 
                      ? 'text-green-400' 
                      : 'text-red-400';
                  
                  return (
                    <tr key={item.inventoryItemId} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package size={12} className="text-slate-500 flex-shrink-0" />
                          <span className="text-slate-200 font-medium">{item.itemName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{item.startingStock}</td>
                      <td className="px-4 py-3 text-right text-amber-400 font-medium">{item.theoreticalUsage}</td>
                      <td className="px-4 py-3 text-right text-slate-400">{item.expectedStock}</td>
                      <td className="px-4 py-3 text-right text-slate-200 font-medium">{item.currentStock}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end">
                          <div className={`flex items-center gap-1 font-semibold ${varianceColor}`}>
                            {hasVariance && (
                              isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />
                            )}
                            <span>{isPositive ? '+' : ''}{item.variance}</span>
                          </div>
                          {hasVariance && (
                            <span className={`text-xs ${varianceColor}`}>
                              ({isPositive ? '+' : ''}{item.variancePercentage}%)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Help Text */}
      {report?.items?.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-xs text-blue-400 font-medium mb-1">Understanding Variance</p>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• <span className="text-green-400">Positive variance</span> = More stock than expected (possible under-reporting of usage or restocking)</li>
            <li>• <span className="text-red-400">Negative variance</span> = Less stock than expected (possible waste, theft, or over-usage)</li>
            <li>• Variance = Current Stock - (Starting Stock - Theoretical Usage)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
