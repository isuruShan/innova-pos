import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, DollarSign, Wallet, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency, formatDateTime } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

function SortHeader({ label, field, currentSort, currentOrder, onSort }) {
  const active = currentSort === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider hover:text-gray-900 transition-colors ${
        active ? 'text-brand-orange' : 'text-gray-500'
      }`}
    >
      <span>{label}</span>
      {active ? (
        currentOrder === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
      ) : (
        <ArrowUpDown size={11} className="opacity-40" />
      )}
    </button>
  );
}

export default function CashSessionsView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [cashierIdFilter, setCashierIdFilter] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [sortField, setSortField] = useState('closedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch session data
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-cash-sessions', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/cashier-sessions', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
          headers: { 'x-store-id': selectedStoreId }
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });
  const data = Array.isArray(rawData) ? rawData : [];

  // Extract unique cashiers for filter dropdown
  const cashiersList = useMemo(() => {
    const list = data.map((d) => d.cashierId).filter(Boolean);
    const map = new Map(list.map((c) => [c._id.toString(), c]));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Handle sort header
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter local dataset
  const filteredData = useMemo(() => {
    return data.filter((s) => {
      const matchesCashier = cashierIdFilter === '' || s.cashierId?._id === cashierIdFilter;
      const matchesDiscrepancy =
        !showDiscrepanciesOnly || (s.varianceAmount !== undefined && s.varianceAmount !== 0);
      return matchesCashier && matchesDiscrepancy;
    });
  }, [data, cashierIdFilter, showDiscrepanciesOnly]);

  // Sort local dataset
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'closedAt') {
        valA = new Date(valA || 0);
        valB = new Date(valB || 0);
      } else if (sortField === 'cashier') {
        valA = a.cashierId?.name?.toLowerCase() || '';
        valB = b.cashierId?.name?.toLowerCase() || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortOrder]);

  // Export CSV mapping
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        const headers = [
          'Cashier Name',
          'Opened At',
          'Closed At',
          'Opening Cash ($)',
          'Expected Cash ($)',
          'Counted Cash ($)',
          'Variance ($)',
          'Variance Notes',
        ];
        const rows = sortedData.map((d) => [
          d.cashierId?.name || 'Unknown',
          formatDateTime(d.openedAt),
          formatDateTime(d.closedAt),
          d.openingCashBalance.toFixed(2),
          (d.expectedCashInDrawer || 0).toFixed(2),
          (d.closingCountedCash || 0).toFixed(2),
          (d.varianceAmount || 0).toFixed(2),
          d.varianceNotes || 'N/A',
        ]);
        exportToCsv('cash_sessions_discrepancy_report', headers, rows);
      });
    }
  }, [sortedData, registerExport]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalExpected = 0;
    let totalCounted = 0;
    let netVariance = 0;
    let discrepancyCount = 0;

    filteredData.forEach((s) => {
      totalExpected += s.expectedCashInDrawer || 0;
      totalCounted += s.closingCountedCash || 0;
      netVariance += s.varianceAmount || 0;
      if (s.varianceAmount !== undefined && s.varianceAmount !== 0) {
        discrepancyCount += 1;
      }
    });

    return {
      totalExpected,
      totalCounted,
      netVariance,
      discrepancyCount,
    };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-brand-orange/10 text-brand-orange rounded-lg">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Shift Sessions</p>
            <p className="text-lg font-bold text-gray-900">{filteredData.length}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">Closed registers in range</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Expected Drawer Cash</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalExpected)}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">Audit book target sum</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-lg">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Counted Drawer Cash</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalCounted)}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">Physical counted sum</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg ${
              summary.netVariance === 0
                ? 'bg-gray-100 text-gray-500'
                : summary.netVariance < 0
                ? 'bg-red-500/10 text-red-500'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}
          >
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Cumulative Variance</p>
            <p
              className={`text-lg font-bold ${
                summary.netVariance === 0
                  ? 'text-gray-700'
                  : summary.netVariance < 0
                  ? 'text-red-650'
                  : 'text-emerald-650'
              }`}
            >
              {summary.netVariance > 0 ? '+' : ''}
              {formatCurrency(summary.netVariance)}
            </p>
            <p className="text-[10px] text-gray-450 mt-0.5">
              {summary.discrepancyCount} shifts with variance
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Cashier selection dropdown */}
        <div className="flex items-center gap-2 w-full max-w-sm">
          <span className="text-xs text-gray-550 flex items-center gap-1 flex-shrink-0">
            <User size={14} /> Cashier:
          </span>
          <select
            value={cashierIdFilter}
            onChange={(e) => setCashierIdFilter(e.target.value)}
            className="bg-white border border-gray-300 text-gray-800 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 w-full"
          >
            <option value="">All Cashiers</option>
            {cashiersList.map((cashier) => (
              <option key={cashier._id} value={cashier._id}>
                {cashier.name} ({cashier.email})
              </option>
            ))}
          </select>
        </div>

        {/* Discrepancy toggle check */}
        <label className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={showDiscrepanciesOnly}
            onChange={(e) => setShowDiscrepanciesOnly(e.target.checked)}
            className="rounded border-gray-300 text-brand-orange focus:ring-brand-orange/20"
          />
          <span>Show Discrepancies Only (Variance ≠ 0)</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3">
                  <SortHeader
                    label="Cashier Name"
                    field="cashier"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3">Opened At</th>
                <th className="px-4 py-3">
                  <SortHeader
                    label="Closed At"
                    field="closedAt"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Expected Cash"
                    field="expectedCashInDrawer"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Counted Cash"
                    field="closingCountedCash"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Variance"
                    field="varianceAmount"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 max-w-[200px]">Discrepancy Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {isPending ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-16" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-20" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-20" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-3.5 bg-gray-100 rounded w-12 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-3.5 bg-gray-100 rounded w-12 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-3.5 bg-gray-100 rounded w-10 ml-auto" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-28" /></td>
                  </tr>
                ))
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">
                    No closed cashier sessions found.
                  </td>
                </tr>
              ) : (
                sortedData.map((d) => {
                  const varVal = d.varianceAmount || 0;
                  return (
                    <tr key={d._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3.5 font-medium text-gray-800">
                        {d.cashierId?.name || 'Unknown'}
                        <span className="text-[10px] text-gray-400 block leading-tight">
                          {d.cashierId?.email || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-500">
                        {formatDateTime(d.openedAt)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-gray-500">
                        {formatDateTime(d.closedAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-gray-500">
                        {formatCurrency(d.expectedCashInDrawer || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-gray-800">
                        {formatCurrency(d.closingCountedCash || 0)}
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-bold font-mono ${
                          varVal === 0
                            ? 'text-gray-400'
                            : varVal < 0
                            ? 'text-red-500 font-semibold'
                            : 'text-emerald-500 font-semibold'
                        }`}
                      >
                        {varVal > 0 ? '+' : ''}
                        {formatCurrency(varVal)}
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px] truncate text-gray-500" title={d.varianceNotes}>
                        {d.varianceNotes || <span className="text-gray-400 italic">No notes</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500">
          <span>Row count: {filteredData.length} sessions</span>
          <span>Net Discrepancy: <span className={summary.netVariance < 0 ? 'text-red-650' : 'text-emerald-650'}>{formatCurrency(summary.netVariance)}</span></span>
        </div>
      </div>
    </div>
  );
}
