import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, DollarSign, Wallet, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency, formatDateTime } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';

function SortHeader({ label, field, currentSort, currentOrder, onSort }) {
  const active = currentSort === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider hover:text-gray-200 transition-colors ${
        active ? 'text-amber-500' : 'text-slate-500'
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
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Shift Sessions</p>
            <p className="text-lg font-bold text-slate-200">{filteredData.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Closed registers in range</p>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Expected Drawer Cash</p>
            <p className="text-lg font-bold text-slate-200">{formatCurrency(summary.totalExpected)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Audit book target sum</p>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-xl">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Counted Drawer Cash</p>
            <p className="text-lg font-bold text-slate-200">{formatCurrency(summary.totalCounted)}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Physical counted sum</p>
          </div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              summary.netVariance === 0
                ? 'bg-slate-500/10 text-slate-400'
                : summary.netVariance < 0
                ? 'bg-red-500/10 text-red-500'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}
          >
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Cumulative Variance</p>
            <p
              className={`text-lg font-bold ${
                summary.netVariance === 0
                  ? 'text-slate-350'
                  : summary.netVariance < 0
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}
            >
              {summary.netVariance > 0 ? '+' : ''}
              {formatCurrency(summary.netVariance)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {summary.discrepancyCount} shifts with variance
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Cashier selection dropdown */}
        <div className="flex items-center gap-2 w-full max-w-sm">
          <span className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0">
            <User size={14} /> Cashier:
          </span>
          <select
            value={cashierIdFilter}
            onChange={(e) => setCashierIdFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-700/50 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 w-full"
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
        <label className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={showDiscrepanciesOnly}
            onChange={(e) => setShowDiscrepanciesOnly(e.target.checked)}
            className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 focus:outline-none"
          />
          <span>Show Discrepancies Only (Variance ≠ 0)</span>
        </label>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border border-slate-800">
        <ResponsiveTable
          rows={sortedData}
          rowKey={(d) => d._id}
          loading={isPending}
          skeletonRows={4}
          emptyState="No closed cashier sessions found."
          columns={[
            {
              key: 'cashier', header: 'Cashier',
              mobilePrimary: true,
              render: (d) => (
                <div>
                  <span className="font-medium text-slate-200">{d.cashierId?.name || 'Unknown'}</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">{d.cashierId?.email || ''}</span>
                </div>
              ),
            },
            {
              key: 'variance', header: 'Variance',
              mobileRight: true,
              className: 'text-right',
              headerClassName: 'text-right',
              render: (d) => {
                const varVal = d.varianceAmount || 0;
                return (
                  <span className={`font-bold font-mono ${varVal === 0 ? 'text-slate-400' : varVal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {varVal > 0 ? '+' : ''}{formatCurrency(varVal)}
                  </span>
                );
              },
            },
            {
              key: 'openedAt', header: 'Opened At',
              render: (d) => <span className="font-mono text-slate-400 text-xs">{formatDateTime(d.openedAt)}</span>,
            },
            {
              key: 'closedAt', header: 'Closed At',
              render: (d) => <span className="font-mono text-slate-400 text-xs">{formatDateTime(d.closedAt)}</span>,
            },
            {
              key: 'expected', header: 'Expected',
              className: 'text-right', headerClassName: 'text-right',
              render: (d) => <span className="font-mono text-xs">{formatCurrency(d.expectedCashInDrawer || 0)}</span>,
            },
            {
              key: 'counted', header: 'Counted',
              className: 'text-right', headerClassName: 'text-right',
              render: (d) => <span className="font-mono text-xs text-slate-200">{formatCurrency(d.closingCountedCash || 0)}</span>,
            },
            {
              key: 'notes', header: 'Notes',
              render: (d) => d.varianceNotes
                ? <span className="text-xs truncate max-w-[180px] block" title={d.varianceNotes}>{d.varianceNotes}</span>
                : <span className="text-slate-600 italic text-xs">No notes</span>,
            },
          ]}
        />
        <div className="bg-slate-950/40 px-4 py-3 border-t border-slate-800 flex justify-between items-center text-xs font-semibold text-slate-500">
          <span>Row count: {filteredData.length} sessions</span>
          <span>Net Discrepancy: <span className={summary.netVariance < 0 ? 'text-red-400' : 'text-emerald-400'}>{formatCurrency(summary.netVariance)}</span></span>
        </div>
      </div>
    </div>
  );
}
