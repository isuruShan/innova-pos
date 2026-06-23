import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User, DollarSign, Wallet, AlertTriangle, Search, X,
  ShoppingBag, CornerDownLeft,
} from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency, formatDateTime } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';
import ListPagination from '../../common/ListPagination';

export default function CashSessionsView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [search, setSearch] = useState('');
  const [cashierIdFilter, setCashierIdFilter] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
  const [sortField, setSortField] = useState('closedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [modalTab, setModalTab] = useState('summary');

  const limit = 10;

  // Fetch detailed session on click
  const { data: sessionDetail, isPending: isPendingDetail } = useQuery({
    queryKey: ['report-cash-session-detail-admin', selectedSessionId],
    queryFn: () =>
      api
        .get(`/reports/extended/cashier-sessions/${selectedSessionId}/detail`)
        .then((r) => r.data),
    enabled: Boolean(selectedSessionId),
  });

  const selectedSession = sessionDetail?.session;
  const sessionOrders = sessionDetail?.orders || [];
  const sessionReturns = sessionDetail?.returns || [];

  // Reset tab when opening a new session
  useEffect(() => {
    if (selectedSessionId) setModalTab('summary');
  }, [selectedSessionId]);

  // Fetch session list
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-cash-sessions', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/cashier-sessions', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
          headers: { 'x-store-id': selectedStoreId },
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });
  const data = Array.isArray(rawData) ? rawData : [];

  // Reset pagination on filter change
  useEffect(() => {
    setPage(1);
  }, [selectedStoreId, dateFrom, dateTo, cashierIdFilter, showDiscrepanciesOnly, search]);

  // Unique cashiers list
  const cashiersList = useMemo(() => {
    const list = data.map((d) => d.cashierId).filter(Boolean);
    const map = new Map(list.map((c) => [c._id.toString(), c]));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter
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

  // Sort
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

  // Paginate
  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedData.slice(start, start + limit);
  }, [sortedData, page]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / limit));

  // Export CSV
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        const headers = [
          'Cashier Name', 'Opened At', 'Closed At',
          'Opening Cash ($)', 'Expected Cash ($)', 'Counted Cash ($)',
          'Variance ($)', 'Variance Notes',
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

  // Summary metrics
  const summary = useMemo(() => {
    let totalExpected = 0, totalCounted = 0, netVariance = 0, discrepancyCount = 0;
    filteredData.forEach((s) => {
      totalExpected += s.expectedCashInDrawer || 0;
      totalCounted += s.closingCountedCash || 0;
      netVariance += s.varianceAmount || 0;
      if (s.varianceAmount !== undefined && s.varianceAmount !== 0) discrepancyCount++;
    });
    return { totalExpected, totalCounted, netVariance, discrepancyCount };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-brand-orange/10 text-brand-orange rounded-lg"><Wallet size={18} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Shift Sessions</p>
            <p className="text-lg font-bold text-gray-900">{filteredData.length}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">Closed registers in range</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg"><DollarSign size={18} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Expected Drawer Cash</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalExpected)}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">Audit book target sum</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-lg"><DollarSign size={18} /></div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Counted Drawer Cash</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalCounted)}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">Physical counted sum</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${summary.netVariance === 0 ? 'bg-gray-100 text-gray-500' : summary.netVariance < 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Cumulative Variance</p>
            <p className={`text-lg font-bold ${summary.netVariance === 0 ? 'text-gray-700' : summary.netVariance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {summary.netVariance > 0 ? '+' : ''}{formatCurrency(summary.netVariance)}
            </p>
            <p className="text-[10px] text-gray-450 mt-0.5">{summary.discrepancyCount} shifts with variance</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-2xl">
          {/* Keyword Search */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 w-full sm:max-w-xs">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search cashier or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-0 text-gray-800 text-xs focus:outline-none focus:ring-0 w-full placeholder-gray-400"
            />
          </div>

          {/* Cashier dropdown */}
          <div className="flex items-center gap-2 w-full sm:max-w-xs">
            <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
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
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900 cursor-pointer shrink-0">
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
      <div className="flex flex-col gap-3">
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
                  <span className="font-medium text-gray-800">{d.cashierId?.name || 'Unknown'}</span>
                  <span className="text-[10px] text-gray-400 block leading-tight">{d.cashierId?.email || ''}</span>
                </div>
              ),
            },
            {
              key: 'openedAt',
              header: 'Opened At',
              sortField: 'openedAt',
              render: (d) => <span className="text-gray-500 text-xs">{formatDateTime(d.openedAt)}</span>,
            },
            {
              key: 'closedAt',
              header: 'Closed At',
              sortField: 'closedAt',
              render: (d) => <span className="text-gray-500 text-xs">{formatDateTime(d.closedAt)}</span>,
            },
            {
              key: 'expected',
              header: 'Expected',
              sortField: 'expectedCashInDrawer',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (d) => <span className="text-xs text-gray-500">{formatCurrency(d.expectedCashInDrawer || 0)}</span>,
            },
            {
              key: 'counted',
              header: 'Counted',
              sortField: 'closingCountedCash',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (d) => <span className="text-xs text-gray-800 font-medium">{formatCurrency(d.closingCountedCash || 0)}</span>,
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
                  <span className={`font-bold ${varVal === 0 ? 'text-gray-400' : varVal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
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
                : <span className="text-gray-400 italic text-xs">No notes</span>,
            },
            {
              key: 'actions',
              header: '',
              render: (d) => (
                <button
                  onClick={() => setSelectedSessionId(d._id)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 border border-gray-200 hover:bg-brand-orange/10 hover:text-brand-orange hover:border-brand-orange/20 text-gray-600 transition cursor-pointer"
                >
                  View
                </button>
              ),
            },
          ]}
        />
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500">
          <span>Row count: {filteredData.length} sessions</span>
          <span>Net Discrepancy: <span className={summary.netVariance < 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(summary.netVariance)}</span></span>
        </div>

        {sortedData.length > limit && (
          <div className="px-4">
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

      {/* Session Detail Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-orange/10 text-brand-orange rounded-xl">
                  <Wallet size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Session Breakdown</h3>
                  <p className="text-xs text-gray-500">
                    {isPendingDetail ? 'Loading session details...' : selectedSession?.cashierId?.name || 'Cashier Shift'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {isPendingDetail ? (
              <div className="flex-1 p-6 space-y-4 animate-pulse">
                <div className="h-20 bg-gray-100 rounded-xl" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-14 bg-gray-100 rounded-xl" />
                  <div className="h-14 bg-gray-100 rounded-xl" />
                  <div className="h-14 bg-gray-100 rounded-xl" />
                </div>
                <div className="h-44 bg-gray-100 rounded-xl" />
              </div>
            ) : !selectedSession ? (
              <div className="flex-1 p-10 text-center text-gray-400">Session data could not be retrieved.</div>
            ) : (
              <>
                {/* Tab Switcher */}
                <div className="flex border-b border-gray-200 bg-gray-50 px-4 py-2 gap-1.5 shrink-0 overflow-x-auto">
                  {[
                    { key: 'summary', label: 'Summary', icon: Wallet },
                    { key: 'orders', label: `Orders (${sessionOrders.length})`, icon: ShoppingBag },
                    { key: 'returns', label: `Returns (${sessionReturns.length})`, icon: CornerDownLeft },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setModalTab(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                        modalTab === key
                          ? 'bg-brand-orange text-white'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                  {modalTab === 'summary' && (
                    <div className="space-y-4">
                      {/* Date & user info */}
                      <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                        <div>
                          <span className="text-gray-400 block mb-0.5">Opened</span>
                          <span className="text-gray-700 font-medium">{formatDateTime(selectedSession.openedAt)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5">Closed</span>
                          <span className="text-gray-700 font-medium">{selectedSession.closedAt ? formatDateTime(selectedSession.closedAt) : '—'}</span>
                        </div>
                        {selectedSession.cashierId && (
                          <div className="col-span-2 border-t border-gray-200 pt-2 mt-1">
                            <span className="text-gray-400 block mb-0.5">Cashier Details</span>
                            <span className="text-gray-800 font-semibold">{selectedSession.cashierId.name}</span>
                            <span className="text-gray-400 text-[10px] block">{selectedSession.cashierId.email}</span>
                          </div>
                        )}
                      </div>

                      {/* Expected vs Counted vs Variance */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block">Expected</span>
                          <span className="text-sm font-extrabold text-gray-700">{formatCurrency(selectedSession.expectedCashInDrawer || 0)}</span>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block">Counted</span>
                          <span className="text-sm font-extrabold text-gray-800">{formatCurrency(selectedSession.closingCountedCash || 0)}</span>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide font-bold block">Variance</span>
                          <span className={`text-sm font-extrabold ${selectedSession.varianceAmount === 0 ? 'text-gray-400' : selectedSession.varianceAmount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {selectedSession.varianceAmount > 0 ? '+' : ''}{formatCurrency(selectedSession.varianceAmount || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Sales & Cash Summary */}
                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 bg-gray-50">
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Sales & Cash Summary</span>
                        </div>
                        <div className="p-4 space-y-2.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Opening Balance</span>
                            <span className="text-gray-700">{formatCurrency(selectedSession.openingCashBalance || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Cash Sales</span>
                            <span className="text-brand-orange font-semibold">+{formatCurrency(selectedSession.cashSalesDuringSession || 0)}</span>
                          </div>
                          {selectedSession.sessionCloseBreakdown?.cashRefunds > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Cash Refunds</span>
                              <span className="text-red-600">−{formatCurrency(selectedSession.sessionCloseBreakdown.cashRefunds)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-400">Card Sales</span>
                            <span className="text-gray-600">{formatCurrency(selectedSession.sessionCloseBreakdown?.cardSales || 0)}</span>
                          </div>
                          {selectedSession.sessionCloseBreakdown?.cardRefunds > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Card Refunds</span>
                              <span className="text-red-600">−{formatCurrency(selectedSession.sessionCloseBreakdown.cardRefunds)}</span>
                            </div>
                          )}
                          {selectedSession.sessionCloseBreakdown?.totalDiscounts > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Discounts Given</span>
                              <span className="text-red-600">−{formatCurrency(selectedSession.sessionCloseBreakdown.totalDiscounts)}</span>
                            </div>
                          )}
                          {selectedSession.sessionCloseBreakdown?.salesByPaymentType?.length > 2 && (
                            <div className="border-t border-gray-100 pt-2 mt-2 space-y-1.5">
                              <span className="text-gray-500 block font-semibold">Other Channels Split:</span>
                              {selectedSession.sessionCloseBreakdown.salesByPaymentType
                                .filter((p) => !['cash', 'card'].includes(p.paymentType.toLowerCase()))
                                .map((p) => (
                                  <div key={p.paymentType} className="flex justify-between pl-2">
                                    <span className="text-gray-400 capitalize">{p.paymentType}</span>
                                    <span className="text-gray-600">{formatCurrency(p.revenue || 0)}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-1 bg-gray-50 border border-gray-200 p-3.5 rounded-xl text-xs">
                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Opening / Closure Notes</span>
                        <div className="space-y-1 mt-1 text-gray-600">
                          {selectedSession.openingNotes && <p><span className="text-brand-orange font-medium">Opening:</span> {selectedSession.openingNotes}</p>}
                          {selectedSession.varianceNotes && <p><span className="text-gray-500 font-medium">Closing:</span> {selectedSession.varianceNotes}</p>}
                          {!selectedSession.openingNotes && !selectedSession.varianceNotes && <p className="text-gray-400 italic">No session notes recorded.</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === 'orders' && (
                    <div className="space-y-3">
                      {sessionOrders.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-xs italic">No orders processed during this session.</div>
                      ) : (
                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10">
                                <th className="px-4 py-2.5 bg-gray-50">Order No</th>
                                <th className="px-4 py-2.5 bg-gray-50">Time</th>
                                <th className="px-4 py-2.5 bg-gray-50">Payment</th>
                                <th className="px-4 py-2.5 bg-gray-50 text-right">Discounts</th>
                                <th className="px-4 py-2.5 bg-gray-50 text-right">Total</th>
                                <th className="px-4 py-2.5 bg-gray-50 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                              {sessionOrders.map((o) => (
                                <tr key={o._id} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2.5">
                                    <a
                                      href={`/orders?order=${o._id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold text-brand-orange hover:underline"
                                    >
                                      #{o.orderNumber}
                                    </a>
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-400 text-[10px]">{new Date(o.createdAt).toLocaleTimeString()}</td>
                                  <td className="px-4 py-2.5 capitalize text-gray-600">{o.paymentType}</td>
                                  <td className="px-4 py-2.5 text-right text-red-600">
                                    {o.discountTotal > 0 ? `-${formatCurrency(o.discountTotal)}` : '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-gray-800">{formatCurrency(o.totalAmount)}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                      o.status === 'completed'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : o.status === 'cancelled'
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                      {o.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {modalTab === 'returns' && (
                    <div className="space-y-3">
                      {sessionReturns.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-xs italic">No refund transactions recorded.</div>
                      ) : (
                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 z-10">
                                <th className="px-4 py-2.5 bg-gray-50">Order No</th>
                                <th className="px-4 py-2.5 bg-gray-50">Refund Time</th>
                                <th className="px-4 py-2.5 bg-gray-50">Method</th>
                                <th className="px-4 py-2.5 bg-gray-50">Reason / Notes</th>
                                <th className="px-4 py-2.5 bg-gray-50 text-right">Refunded Amt</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                              {sessionReturns.map((r, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                  <td className="px-4 py-2.5">
                                    <a
                                      href={`/orders?order=${r.orderId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold text-brand-orange hover:underline"
                                    >
                                      #{r.orderNumber}
                                    </a>
                                  </td>
                                  <td className="px-4 py-2.5 text-gray-400 text-[10px]">{new Date(r.returnedAt).toLocaleTimeString()}</td>
                                  <td className="px-4 py-2.5 capitalize text-gray-600">{r.paymentType}</td>
                                  <td className="px-4 py-2.5 text-gray-400 max-w-[150px] truncate" title={r.notes}>
                                    {r.notes || <span className="italic text-gray-300">No notes</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-bold text-red-600">
                                    −{formatCurrency(r.refundAmount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button
                onClick={() => setSelectedSessionId(null)}
                className="w-full py-2.5 text-center font-bold text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl transition cursor-pointer"
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
