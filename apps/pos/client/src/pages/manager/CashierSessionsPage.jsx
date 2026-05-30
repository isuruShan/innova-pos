import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Wallet, Search, X } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Badge from '../../components/Badge';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import PosDateField from '../../components/PosDateField';
import SortableTh from '../../components/SortableTh';
import { useListSort } from '../../hooks/useListSort';
import FilterPanel from '../../components/FilterPanel';

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

export default function CashierSessionsPage() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [datePreset, setDatePreset] = useState('7days');
  const [customFrom, setCustomFrom] = useState(sevenDaysAgo);
  const [customTo, setCustomTo] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState(['closed', 'open']);
  const [nameSearch, setNameSearch] = useState('');
  const { sort, order, toggleSort, sortParams } = useListSort('openedAt', 'desc');

  const { fromDate, toDate } = useMemo(() => {
    const today = todayStr();
    if (datePreset === 'today') return { fromDate: today, toDate: today };
    if (datePreset === '7days') return { fromDate: sevenDaysAgo(), toDate: today };
    if (datePreset === '30days') return { fromDate: thirtyDaysAgo(), toDate: today };
    if (datePreset === 'thisMonth') return { fromDate: thisMonthStart(), toDate: today };
    return { fromDate: customFrom || today, toDate: customTo || today };
  }, [datePreset, customFrom, customTo]);

  const params = useMemo(() => {
    const p = {};
    if (fromDate) p.from = `${fromDate}T00:00:00`;
    if (toDate) p.until = `${toDate}T23:59:59`;
    if (statusFilter.length > 0 && statusFilter.length < 2) {
      p.status = statusFilter.join(',');
    }
    p.sort = sort;
    p.order = order;
    return p;
  }, [fromDate, toDate, statusFilter, sort, order]);

  const { data: sessions = [], isPending, refetch, isFetching } = useQuery({
    queryKey: ['cashier-sessions-list', selectedStoreId, params, sortParams],
    queryFn: () => api.get('/cashier-sessions', { params }).then((r) => r.data),
    enabled: isStoreReady,
    staleTime: 15_000,
  });

  const filteredSessions = useMemo(() => {
    if (!nameSearch.trim()) return sessions;
    const q = nameSearch.trim().toLowerCase();
    return sessions.filter((row) => {
      const cashier = row.cashierId;
      const name = typeof cashier === 'object' && cashier?.name ? cashier.name : '';
      return name.toLowerCase().includes(q);
    });
  }, [sessions, nameSearch]);

  const toggleStatus = (s) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const showSkeleton = !isStoreReady || isPending;

  const filterSummary = `${DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? datePreset}${nameSearch.trim() ? ` · "${nameSearch.trim()}"` : ''}${statusFilter.length < 2 ? ` · ${statusFilter.join('/')} only` : ''}`;
  const filterBadge = (datePreset !== '7days' ? 1 : 0) + (nameSearch.trim() ? 1 : 0) + (statusFilter.length < 2 ? 1 : 0);

  return (
    <div className="min-h-screen bg-[var(--pos-page-bg)]">
      <Navbar groups={MANAGER_NAV_GROUPS} />

      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--pos-text-primary)] flex items-center gap-2">
              <Wallet size={22} className="text-amber-400" />
              Cashier sessions
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Opening balances, closing counts, and variance notes per cashier and store.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 self-start text-slate-400 hover:text-[var(--pos-text-primary)] text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl transition"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <FilterPanel summary={filterSummary} badge={filterBadge}>
        <div className="flex flex-wrap items-end gap-4 mb-5 p-4 rounded-2xl bg-[var(--pos-panel)] border border-slate-700/50">
          {/* Search by name */}
          <div className="flex-1 min-w-[200px]">
            <span className="block text-[11px] text-slate-500 mb-1.5">Cashier name</span>
            <div className="flex items-center gap-2 bg-[var(--pos-surface-inset)] border border-slate-600 rounded-lg px-2 py-1.5">
              <Search size={13} className="text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search by name…"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                className="flex-1 bg-transparent text-[var(--pos-text-primary)] text-xs focus:outline-none placeholder-slate-600"
              />
              {nameSearch && (
                <button type="button" onClick={() => setNameSearch('')}>
                  <X size={12} className="text-slate-500" />
                </button>
              )}
            </div>
          </div>

          {/* Date presets */}
          <div>
            <span className="block text-[11px] text-slate-500 mb-1.5">Date range</span>
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDatePreset(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    datePreset === key
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-[var(--pos-text-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <PosDateField
                  value={customFrom}
                  onChange={setCustomFrom}
                  max={customTo}
                  className="w-[140px] bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <span className="text-slate-500 text-xs">to</span>
                <PosDateField
                  value={customTo}
                  onChange={setCustomTo}
                  min={customFrom}
                  className="w-[140px] bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
            )}
          </div>

          {/* Status filter */}
          <div>
            <span className="block text-xs font-medium text-slate-500 mb-1.5">Status</span>
            <div className="flex gap-2">
              {['open', 'closed'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize border transition ${
                    statusFilter.includes(s)
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        </FilterPanel>

        {showSkeleton ? (
          <div className="rounded-2xl border border-slate-700/50 bg-[var(--pos-panel)] p-8 text-center text-slate-500">
            Loading sessions…
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/50 bg-[var(--pos-panel)] p-8 text-center text-slate-500">
            {nameSearch ? 'No sessions match your search.' : 'No cashier sessions in this range.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-[var(--pos-panel)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 text-left text-slate-400">
                  <th className="px-4 py-3 font-semibold">Cashier</th>
                  <SortableTh label="Opened" field="openedAt" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                  <SortableTh label="Closed" field="closedAt" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                  <th className="px-4 py-3 font-semibold text-right">Opening</th>
                  <th className="px-4 py-3 font-semibold text-right">Cash sales</th>
                  <th className="px-4 py-3 font-semibold text-right">Discounts</th>
                  <th className="px-4 py-3 font-semibold text-right">Net cash in/out</th>
                  <th className="px-4 py-3 font-semibold text-right">Expected</th>
                  <th className="px-4 py-3 font-semibold text-right">Counted</th>
                  <th className="px-4 py-3 font-semibold text-right">Variance</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                  <SortableTh label="Status" field="status" currentSort={sort} currentOrder={order} onSort={toggleSort} className="whitespace-nowrap" />
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((row) => {
                  const cashier = row.cashierId;
                  const name =
                    typeof cashier === 'object' && cashier?.name
                      ? cashier.name
                      : '—';
                  return (
                    <tr
                      key={row._id}
                      className="border-b border-slate-700/40 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 text-[var(--pos-text-primary)] font-medium">{name}</td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {formatDateTime(row.openedAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {row.closedAt ? formatDateTime(row.closedAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                        {formatCurrency(row.openingCashBalance ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                        {row.cashSalesDuringSession != null
                          ? formatCurrency(row.cashSalesDuringSession)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                        {row.sessionCloseBreakdown?.totalDiscounts != null
                          ? formatCurrency(row.sessionCloseBreakdown.totalDiscounts)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                        {row.sessionCloseBreakdown?.netCashMovements != null ? (
                          <span
                            className={
                              Math.abs(row.sessionCloseBreakdown.netCashMovements) < 0.005
                                ? 'text-slate-400'
                                : row.sessionCloseBreakdown.netCashMovements >= 0
                                  ? 'text-emerald-400'
                                  : 'text-amber-300'
                            }
                          >
                            {row.sessionCloseBreakdown.netCashMovements >= 0 ? '+' : ''}
                            {formatCurrency(row.sessionCloseBreakdown.netCashMovements)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                        {row.expectedCashInDrawer != null
                          ? formatCurrency(row.expectedCashInDrawer)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                        {row.closingCountedCash != null
                          ? formatCurrency(row.closingCountedCash)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.varianceAmount != null ? (
                          <span
                            className={
                              Math.abs(row.varianceAmount) < 0.005
                                ? 'text-emerald-400'
                                : 'text-amber-400 font-semibold'
                            }
                          >
                            {formatCurrency(row.varianceAmount)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] text-xs" title={`Opening Notes: ${row.openingNotes || '—'}\nVariance Notes: ${row.varianceNotes || '—'}`}>
                        {row.openingNotes && <div className="text-[11px] text-amber-400/90 font-medium">Start: {row.openingNotes}</div>}
                        {row.varianceNotes && <div className="text-[11px] text-slate-400">Close: {row.varianceNotes}</div>}
                        {!row.openingNotes && !row.varianceNotes && '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={row.status}
                          variant={row.status === 'open' ? 'pending' : 'completed'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
