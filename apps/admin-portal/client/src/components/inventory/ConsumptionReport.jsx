import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useListSort } from '../../hooks/useListSort';
import ResponsiveTable from '../ResponsiveTable';
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
  const { sort, order, toggleSort } = useListSort('itemName', 'asc');

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

  const sortedReportItems = useMemo(() => {
    if (!report?.items) return [];
    let result = [...report.items];
    const dir = order === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      if (sort === 'itemName') {
        return a.itemName.localeCompare(b.itemName) * dir;
      }
      if (sort === 'unit') {
        return (a.unit || '').localeCompare(b.unit || '') * dir;
      }
      if (sort === 'startingStock') {
        return (a.startingStock - b.startingStock) * dir;
      }
      if (sort === 'theoreticalUsage') {
        return (a.theoreticalUsage - b.theoreticalUsage) * dir;
      }
      if (sort === 'expectedStock') {
        return (a.expectedStock - b.expectedStock) * dir;
      }
      if (sort === 'currentStock') {
        return (a.currentStock - b.currentStock) * dir;
      }
      if (sort === 'variance') {
        return (a.variance - b.variance) * dir;
      }
      return 0;
    });
    return result;
  }, [report?.items, sort, order]);

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
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">From Date</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">To Date</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isFetching || !fromDate || !toDate || fromDate > toDate}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
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
              className="flex items-center gap-2 border border-gray-300 hover:border-amber-500 text-gray-700 hover:text-amber-600 font-medium px-4 py-2 rounded-lg transition text-sm bg-white"
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
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Items Tracked</p>
                <p className="text-2xl font-bold text-gray-900">{report.summary?.totalItems ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Completed Orders</p>
                <p className="text-2xl font-bold text-gray-900">{report.summary?.totalOrders ?? 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Items with Variance</p>
                <p className="text-2xl font-bold text-gray-900">{report.summary?.itemsWithVariance ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {isFetching && hasRun && (
        <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Loader2 size={24} className="animate-spin text-amber-500" />
        </div>
      )}

      {!isPending && !report && !hasRun && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Package size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-600">Select a date range and click Generate Report</p>
          <p className="text-xs text-gray-400 mt-1">This shows theoretical ingredient usage vs actual stock levels</p>
        </div>
      )}

      {!isPending && report?.items?.length === 0 && hasRun && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          <Package size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-600">No consumption data for this period</p>
          <p className="text-xs text-gray-400 mt-1">No completed orders with linked ingredients found</p>
        </div>
      )}

      {!isPending && report?.items?.length > 0 && (
        <ResponsiveTable
          rows={sortedReportItems}
          rowKey={(item) => item.inventoryItemId}
          loading={false}
          onSort={toggleSort}
          currentSort={sort}
          currentOrder={order}
          emptyState={
            <span className="flex flex-col items-center gap-2">
              <Package size={36} className="opacity-30" />
              No consumption data for this period
            </span>
          }
          columns={[
            {
              key: 'itemName',
              header: 'Item',
              mobilePrimary: true,
              sortField: 'itemName',
              render: (item) => (
                <div className="flex items-center gap-2">
                  <Package size={12} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-800 font-medium">{item.itemName}</span>
                </div>
              ),
            },
            {
              key: 'unit',
              header: 'Unit',
              sortField: 'unit',
              render: (item) => <span className="text-gray-500">{item.unit}</span>,
            },
            {
              key: 'startingStock',
              header: 'Starting Stock',
              className: 'text-right',
              headerClassName: 'text-right',
              sortField: 'startingStock',
              render: (item) => <span className="text-gray-700">{item.startingStock}</span>,
            },
            {
              key: 'theoreticalUsage',
              header: 'Theoretical Usage',
              className: 'text-right',
              headerClassName: 'text-right',
              sortField: 'theoreticalUsage',
              render: (item) => <span className="text-amber-600 font-semibold">{item.theoreticalUsage}</span>,
            },
            {
              key: 'expectedStock',
              header: 'Expected Stock',
              className: 'text-right',
              headerClassName: 'text-right',
              sortField: 'expectedStock',
              render: (item) => <span className="text-gray-700">{item.expectedStock}</span>,
            },
            {
              key: 'currentStock',
              header: 'Current Stock',
              className: 'text-right',
              headerClassName: 'text-right',
              sortField: 'currentStock',
              render: (item) => <span className="text-gray-900 font-semibold">{item.currentStock}</span>,
            },
            {
              key: 'variance',
              header: 'Variance',
              className: 'text-right',
              headerClassName: 'text-right',
              sortField: 'variance',
              render: (item) => {
                const hasVariance = Math.abs(item.variance) > 0.1;
                const isPositive = item.variance > 0;
                const varianceColor = !hasVariance
                  ? 'text-gray-400'
                  : isPositive
                    ? 'text-green-600'
                    : 'text-red-500';

                return (
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
                );
              },
            },
          ]}
        />
      )}

      {/* Help Text */}
      {report?.items?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-medium mb-1">Understanding Variance</p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <span className="text-green-600 font-medium">Positive variance</span> = More stock than expected (possible under-reporting of usage or restocking)</li>
            <li>• <span className="text-red-500 font-medium">Negative variance</span> = Less stock than expected (possible waste, theft, or over-usage)</li>
            <li>• Variance = Current Stock - (Starting Stock - Theoretical Usage)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
