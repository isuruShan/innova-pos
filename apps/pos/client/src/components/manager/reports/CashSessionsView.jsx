import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, DollarSign, Wallet, AlertTriangle, Search, X, BarChart2 } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency, formatDateTime } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';
import ListPagination from '../../ListPagination';

const formatPaymentTypeLabel = (type) => {
  if (!type) return 'Other';
  const t = String(type).trim().toLowerCase();
  if (t === 'cash') return 'Cash';
  if (t === 'card') return 'Credit / Debit Card';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export default function CashSessionsView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [search, setSearch] = useState('');
  const [cashierIdFilter, setCashierIdFilter] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [sortField, setSortField] = useState('closedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState(null);
  
  const limit = 10;

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

  // Reset pagination on filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedStoreId, dateFrom, dateTo, cashierIdFilter, showDiscrepanciesOnly, search]);

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
      const cashierName = s.cashierId?.name?.toLowerCase() || '';
      const cashierEmail = s.cashierId?.email?.toLowerCase() || '';
      const notes = s.varianceNotes?.toLowerCase() || '';
      
      const matchesSearch =
        search.trim() === '' ||
        cashierName.includes(search.toLowerCase()) ||
        cashierEmail.includes(search.toLowerCase()) ||
        notes.includes(search.toLowerCase());

      const matchesCashier = cashierIdFilter === '' || s.cashierId?._id === cashierIdFilter;
      const matchesDiscrepancy =
        !showDiscrepanciesOnly || (s.varianceAmount !== undefined && s.varianceAmount !== 0);

      return matchesSearch && matchesCashier && matchesDiscrepancy;
    });
  }, [data, search, cashierIdFilter, showDiscrepanciesOnly]);

  // Sort local dataset
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'closedAt' || sortField === 'openedAt') {
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

  // Paginated dataset
  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedData.slice(start, start + limit);
  }, [sortedData, page]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / limit));

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

  // Sort movements newest first for selected modal session
  const sortedMovements = useMemo(() => {
    if (!selectedSession?.cashMovements) return [];
    return [...selectedSession.cashMovements].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [selectedSession]);

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
        <div className="flex flex-col sm:flex-row gap-4 w-full md:max-w-2xl">
          {/* Keyword Search */}
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2 w-full sm:max-w-xs">
            <Search size={15} className="text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Search cashier or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 text-slate-200 text-xs focus:outline-none focus:ring-0 w-full placeholder-slate-650"
            />
          </div>

          {/* Cashier selection dropdown */}
          <div className="flex items-center gap-2 w-full sm:max-w-xs">
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
        </div>

        {/* Discrepancy toggle check */}
        <label className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer shrink-0">
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
          rows={paginatedData}
          rowKey={(d) => d._id}
          loading={isPending}
          skeletonRows={4}
          emptyState="No closed cashier sessions found."
          currentSort={sortField}
          currentOrder={sortOrder}
          onSort={handleSort}
          columns={[
            {
              key: 'cashier',
              header: 'Cashier',
              sortField: 'cashier',
              mobilePrimary: true,
              render: (d) => (
                <div>
                  <span className="font-medium text-slate-200">{d.cashierId?.name || 'Unknown'}</span>
                  <span className="text-[10px] text-slate-500 block leading-tight">{d.cashierId?.email || ''}</span>
                </div>
              ),
            },
            {
              key: 'openedAt',
              header: 'Opened At',
              sortField: 'openedAt',
              render: (d) => <span className="font-mono text-slate-400 text-xs">{formatDateTime(d.openedAt)}</span>,
            },
            {
              key: 'closedAt',
              header: 'Closed At',
              sortField: 'closedAt',
              render: (d) => <span className="font-mono text-slate-400 text-xs">{formatDateTime(d.closedAt)}</span>,
            },
            {
              key: 'expected',
              header: 'Expected',
              sortField: 'expectedCashInDrawer',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (d) => <span className="font-mono text-xs">{formatCurrency(d.expectedCashInDrawer || 0)}</span>,
            },
            {
              key: 'counted',
              header: 'Counted',
              sortField: 'closingCountedCash',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (d) => <span className="font-mono text-xs text-slate-200">{formatCurrency(d.closingCountedCash || 0)}</span>,
            },
            {
              key: 'variance',
              header: 'Variance',
              sortField: 'varianceAmount',
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
              key: 'notes',
              header: 'Notes',
              render: (d) => d.varianceNotes
                ? <span className="text-xs truncate max-w-[150px] block" title={d.varianceNotes}>{d.varianceNotes}</span>
                : <span className="text-slate-650 italic text-xs">No notes</span>,
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (d) => (
                <button
                  onClick={() => setSelectedSession(d)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white hover:border-slate-600 text-slate-300 transition cursor-pointer"
                >
                  View
                </button>
              ),
            },
          ]}
        />
        <div className="bg-slate-950/40 px-4 py-3 border-t border-slate-800 flex justify-between items-center text-xs font-semibold text-slate-500">
          <span>Row count: {filteredData.length} sessions</span>
          <span>Net Discrepancy: <span className={summary.netVariance < 0 ? 'text-red-400' : 'text-emerald-400'}>{formatCurrency(summary.netVariance)}</span></span>
        </div>

        {/* Client-side Pagination */}
        {sortedData.length > limit && (
          <div className="px-4 border-t border-slate-800 bg-slate-950/20">
            <ListPagination
              page={page}
              pages={totalPages}
              total={sortedData.length}
              onPageChange={setPage}
              isFetching={isPending}
            />
          </div>
        )}
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 animate-fade-in">
          <div className="bg-[var(--pos-panel)] border border-slate-700/80 rounded-2xl max-w-lg w-full shadow-2xl shadow-black/85 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--pos-text-primary)]">Session Breakdown</h3>
                  <p className="text-xs text-slate-500">{selectedSession.cashierId?.name || 'Cashier Shift'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Date & User Info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block mb-0.5">Opened</span>
                  <span className="font-mono text-slate-300">{formatDateTime(selectedSession.openedAt)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">Closed</span>
                  <span className="font-mono text-slate-300">{selectedSession.closedAt ? formatDateTime(selectedSession.closedAt) : '—'}</span>
                </div>
                {selectedSession.cashierId && (
                  <div className="col-span-2 border-t border-slate-800/50 pt-2 mt-1">
                    <span className="text-slate-500 block mb-0.5">Cashier Details</span>
                    <span className="text-slate-200 font-semibold">{selectedSession.cashierId.name}</span>
                    <span className="text-slate-400 font-mono text-[10px] block">{selectedSession.cashierId.email}</span>
                  </div>
                )}
              </div>

              {/* Expected vs Counted */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold block">Expected</span>
                  <span className="text-sm font-extrabold text-slate-300 font-mono">{formatCurrency(selectedSession.expectedCashInDrawer || 0)}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold block">Counted</span>
                  <span className="text-sm font-extrabold text-slate-200 font-mono">{formatCurrency(selectedSession.closingCountedCash || 0)}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold block">Variance</span>
                  <span className={`text-sm font-extrabold font-mono ${selectedSession.varianceAmount === 0 ? 'text-slate-400' : selectedSession.varianceAmount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedSession.varianceAmount > 0 ? '+' : ''}{formatCurrency(selectedSession.varianceAmount || 0)}
                  </span>
                </div>
              </div>

              {/* Cash Balance Breakdown */}
              <div className="rounded-xl border border-slate-800 bg-slate-955/20 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sales & Cash Summary</span>
                </div>
                <div className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opening Balance</span>
                    <span className="text-slate-300 font-mono">{formatCurrency(selectedSession.openingCashBalance || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cash Sales</span>
                    <span className="text-amber-400 font-mono font-semibold">+{formatCurrency(selectedSession.cashSalesDuringSession || 0)}</span>
                  </div>
                  {selectedSession.sessionCloseBreakdown?.cashRefunds > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cash Refunds</span>
                      <span className="text-rose-450 font-mono">−{formatCurrency(selectedSession.sessionCloseBreakdown.cashRefunds)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Card Sales</span>
                    <span className="text-slate-350 font-mono">{formatCurrency(selectedSession.sessionCloseBreakdown?.cardSales || 0)}</span>
                  </div>
                  {selectedSession.sessionCloseBreakdown?.cardRefunds > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Card Refunds</span>
                      <span className="text-rose-450 font-mono">−{formatCurrency(selectedSession.sessionCloseBreakdown.cardRefunds)}</span>
                    </div>
                  )}
                  {selectedSession.sessionCloseBreakdown?.totalDiscounts > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Discounts Given</span>
                      <span className="text-rose-350 font-mono">−{formatCurrency(selectedSession.sessionCloseBreakdown.totalDiscounts)}</span>
                    </div>
                  )}
                  {selectedSession.sessionCloseBreakdown?.salesByPaymentType?.length > 2 && (
                    <div className="border-t border-slate-800/60 pt-2 mt-2 space-y-1.5">
                      <span className="text-slate-500 block font-semibold">Other Channels Split:</span>
                      {selectedSession.sessionCloseBreakdown.salesByPaymentType
                        .filter(p => !['cash', 'card'].includes(p.paymentType.toLowerCase()))
                        .map(p => (
                          <div key={p.paymentType} className="flex justify-between pl-2">
                            <span className="text-slate-500 capitalize">{p.paymentType}</span>
                            <span className="text-slate-400 font-mono">{formatCurrency(p.revenue || 0)}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Cash Movements Log */}
              {selectedSession.cashMovements?.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-955/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cash Movements ({selectedSession.cashMovements.length})</span>
                  </div>
                  <div className="p-3.5 space-y-2 max-h-[140px] overflow-y-auto">
                    {sortedMovements.map((movement, idx) => {
                      const isIn = movement.kind === 'cash_in';
                      return (
                        <div key={idx} className={`flex items-start justify-between gap-2 text-xs rounded-lg px-3 py-2 border ${isIn ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-450' : 'bg-amber-500/5 border-amber-500/10 text-amber-450'}`}>
                          <div>
                            <span className="font-bold font-mono">{isIn ? '+' : '−'}{formatCurrency(movement.amount)}</span>
                            {movement.notes && <p className="text-[10px] text-slate-400 mt-0.5">{movement.notes}</p>}
                          </div>
                          <span className="text-slate-500 font-mono text-[9px] shrink-0 mt-0.5">{new Date(movement.createdAt).toLocaleTimeString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1 bg-slate-955/40 border border-slate-800 p-3.5 rounded-xl text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Opening / Closure Notes</span>
                <div className="space-y-1 mt-1 text-slate-350">
                  {selectedSession.openingNotes && <p><span className="text-amber-500/90 font-medium">Opening:</span> {selectedSession.openingNotes}</p>}
                  {selectedSession.varianceNotes && <p><span className="text-slate-400 font-medium">Closing:</span> {selectedSession.varianceNotes}</p>}
                  {!selectedSession.openingNotes && !selectedSession.varianceNotes && <p className="text-slate-500 italic">No session notes recorded.</p>}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/60 shrink-0">
              <button
                onClick={() => setSelectedSession(null)}
                className="w-full py-2.5 text-center font-bold text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition cursor-pointer"
              >
                Close Detail View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
