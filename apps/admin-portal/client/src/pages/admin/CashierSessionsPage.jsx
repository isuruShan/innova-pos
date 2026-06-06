import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Wallet, Search, X } from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';
import ListPagination from '../../components/common/ListPagination';
import SortableTh from '../../components/common/SortableTh';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useListSort } from '../../hooks/useListSort';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency } from '../../utils/format';
import ViewModeToggle from '../../components/common/ViewModeToggle';

const money = formatCurrency;

function todayStr() {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return d.toISOString().split('T')[0];
}

function thisMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 days' },
  { key: '30days', label: 'Last 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

function formatDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CashierSessionsPage() {
  const { stores, selectedStoreId } = useStoreContext();
  const [datePreset, setDatePreset] = useState('7days');
  const [customFrom, setCustomFrom] = useState(sevenDaysAgo);
  const [customTo, setCustomTo] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState(['closed', 'open']);
  const [nameSearch, setNameSearch] = useState('');
  const [page, setPage] = useState(1);
  const { sort, order, toggleSort, sortParams } = useListSort('openedAt', 'desc');
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_admin_cashier_sessions');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const { fromDate, toDate } = useMemo(() => {
    const today = todayStr();
    if (datePreset === 'today') return { fromDate: today, toDate: today };
    if (datePreset === '7days') return { fromDate: sevenDaysAgo(), toDate: today };
    if (datePreset === '30days') return { fromDate: thirtyDaysAgo(), toDate: today };
    if (datePreset === 'thisMonth') return { fromDate: thisMonthStart(), toDate: today };
    return { fromDate: customFrom || today, toDate: customTo || today };
  }, [datePreset, customFrom, customTo]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, statusFilter.join(','), selectedStoreId, nameSearch, sort, order]);

  const params = useMemo(() => {
    const p = {};
    if (fromDate) p.from = `${fromDate}T00:00:00`;
    if (toDate) p.until = `${toDate}T23:59:59`;
    if (statusFilter.length > 0 && statusFilter.length < 2) {
      p.status = statusFilter.join(',');
    }
    return p;
  }, [fromDate, toDate, statusFilter]);

  const { data: sessionList = { items: [], page: 1, pages: 1, total: 0 }, isPending, refetch, isFetching } = useQuery({
    queryKey: ['admin-cashier-sessions', selectedStoreId, params, page, sortParams],
    queryFn: async () => {
      const { data } = await api.get('/cashier-sessions', { params: { ...params, page, limit: 25, sort, order } });
      return unwrapPagedList(data);
    },
    enabled: Boolean(stores.length),
    staleTime: 15_000,
  });
  const allSessions = sessionList.items || [];

  const sessions = useMemo(() => {
    if (!nameSearch.trim()) return allSessions;
    const q = nameSearch.trim().toLowerCase();
    return allSessions.filter((row) => {
      const cashier = row.cashierId;
      const name = typeof cashier === 'object' && cashier?.name ? cashier.name : '';
      return name.toLowerCase().includes(q);
    });
  }, [allSessions, nameSearch]);

  const pageMeta = sessionList;

  const toggleStatus = (s) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const selectedStoreLabel = stores.find((s) => s._id === selectedStoreId)?.name || 'All assigned';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet size={22} className="text-brand-teal" />
            Cashier sessions
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review drawer openings, closings, and variance notes from POS (store: {selectedStoreLabel}).
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <ViewModeToggle mode={viewMode} setMode={(m) => { setViewMode(m); localStorage.setItem('view_mode_admin_cashier_sessions', m); }} />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-start gap-4">
        {/* Search by cashier name */}
        <div className="flex-1 min-w-[200px]">
          <span className="block text-xs text-gray-500 mb-1">Cashier name</span>
          <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name…"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="flex-1 text-sm text-gray-900 focus:outline-none placeholder-gray-400"
            />
            {nameSearch && (
              <button type="button" onClick={() => setNameSearch('')}>
                <X size={12} className="text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Date presets */}
        <div>
          <span className="block text-xs text-gray-500 mb-1">Date range</span>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {DATE_PRESETS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDatePreset(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  datePreset === key
                    ? 'bg-brand-teal/10 border-brand-teal text-brand-teal'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <AdminDateField
                value={customFrom}
                max={customTo}
                onChange={setCustomFrom}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 min-w-[10rem]"
              />
              <span className="text-xs text-gray-400">to</span>
              <AdminDateField
                value={customTo}
                min={customFrom}
                onChange={setCustomTo}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 min-w-[10rem]"
              />
            </div>
          )}
        </div>

        {/* Status filter */}
        <div>
          <span className="block text-xs text-gray-500 mb-1">Status</span>
          <div className="flex gap-2">
            {['open', 'closed'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                  statusFilter.includes(s)
                    ? 'bg-brand-teal/10 border-brand-teal text-brand-teal'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!stores.length ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          Create a store first to view cashier sessions.
        </div>
      ) : isPending ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
          No sessions in this range.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sessions.map((row) => {
            const cashier = row.cashierId;
            const store = row.storeId;
            const cashierName = typeof cashier === 'object' && cashier?.name ? cashier.name : '—';
            const storeName = typeof store === 'object' && store?.name ? store.name : '—';
            return (
              <div key={row._id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-gray-900 block truncate">{cashierName}</span>
                      <span className="text-xs text-gray-500 block truncate">{storeName}</span>
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize shrink-0 ${
                        row.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex justify-between">
                      <span>Opened:</span>
                      <span className="text-gray-900 font-medium">{formatDt(row.openedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Closed:</span>
                      <span className="text-gray-900 font-medium">{row.closedAt ? formatDt(row.closedAt) : '—'}</span>
                    </div>
                    <div className="border-t border-gray-200 my-1 pt-1" />
                    <div className="flex justify-between">
                      <span>Opening Cash:</span>
                      <span className="text-gray-900 font-semibold">{money(row.openingCashBalance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Sales:</span>
                      <span className="text-gray-900 font-semibold">{row.cashSalesDuringSession != null ? money(row.cashSalesDuringSession) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected:</span>
                      <span className="text-gray-900 font-semibold">{row.expectedCashInDrawer != null ? money(row.expectedCashInDrawer) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Counted:</span>
                      <span className="text-gray-900 font-semibold">{row.closingCountedCash != null ? money(row.closingCountedCash) : '—'}</span>
                    </div>
                    <div className="border-t border-gray-200 my-1 pt-1" />
                    <div className="flex justify-between">
                      <span>Variance:</span>
                      <span className="tabular-nums font-bold">
                        {row.varianceAmount != null ? (
                          <span className={Math.abs(row.varianceAmount) < 0.005 ? 'text-green-700' : 'text-amber-700'}>
                            {money(row.varianceAmount)}
                          </span>
                        ) : '—'}
                      </span>
                    </div>
                  </div>
                  {(row.openingNotes || row.varianceNotes) && (
                    <div className="text-[11px] text-gray-500 bg-amber-50/30 border border-amber-100 rounded-lg p-2 space-y-1">
                      {row.openingNotes && <p><span className="font-semibold text-amber-700">Start:</span> {row.openingNotes}</p>}
                      {row.varianceNotes && <p><span className="font-semibold text-gray-700">Close:</span> {row.varianceNotes}</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Store</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cashier</th>
                <SortableTh label="Opened" field="openedAt" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                <SortableTh label="Closed" field="closedAt" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Opening</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Cash sales</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Expected</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Counted</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Variance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Notes</th>
                <SortableTh label="Status" field="status" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((row) => {
                const cashier = row.cashierId;
                const store = row.storeId;
                const cashierName =
                  typeof cashier === 'object' && cashier?.name ? cashier.name : '—';
                const storeName =
                  typeof store === 'object' && store?.name ? store.name : '—';
                return (
                  <tr key={row._id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{storeName}</td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap">{cashierName}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDt(row.openedAt)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {row.closedAt ? formatDt(row.closedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800">{money(row.openingCashBalance)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                      {row.cashSalesDuringSession != null ? money(row.cashSalesDuringSession) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                      {row.expectedCashInDrawer != null ? money(row.expectedCashInDrawer) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                      {row.closingCountedCash != null ? money(row.closingCountedCash) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.varianceAmount != null ? (
                        <span
                          className={
                            Math.abs(row.varianceAmount) < 0.005 ? 'text-green-700' : 'text-amber-700 font-semibold'
                          }
                        >
                          {money(row.varianceAmount)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[220px] text-xs" title={`Opening Notes: ${row.openingNotes || '—'}\nVariance Notes: ${row.varianceNotes || '—'}`}>
                      {row.openingNotes && <div className="text-[11px] text-amber-600 font-medium">Start: {row.openingNotes}</div>}
                      {row.varianceNotes && <div className="text-[11px] text-gray-500">Close: {row.varianceNotes}</div>}
                      {!row.openingNotes && !row.varianceNotes && '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          row.status === 'open'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isPending && sessions.length > 0 && (
        <ListPagination
          page={pageMeta.page}
          pages={pageMeta.pages}
          total={pageMeta.total}
          onPageChange={setPage}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}
