import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Wallet } from 'lucide-react';
import api from '../../api/axios';
import Navbar from '../../components/Navbar';
import Badge from '../../components/Badge';
import { MANAGER_NAV_GROUPS } from '../../constants/managerLinks';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import PosDateField from '../../components/PosDateField';

function todayStr() {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

export default function CashierSessionsPage() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [fromDate, setFromDate] = useState(sevenDaysAgo());
  const [toDate, setToDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState(['closed', 'open']);

  const params = useMemo(() => {
    const p = {};
    if (fromDate) p.from = `${fromDate}T00:00:00`;
    if (toDate) p.until = `${toDate}T23:59:59`;
    if (statusFilter.length > 0 && statusFilter.length < 2) {
      p.status = statusFilter.join(',');
    }
    return p;
  }, [fromDate, toDate, statusFilter]);

  const { data: sessions = [], isPending, refetch, isFetching } = useQuery({
    queryKey: ['cashier-sessions-list', selectedStoreId, params],
    queryFn: () => api.get('/cashier-sessions', { params }).then((r) => r.data),
    enabled: isStoreReady,
    staleTime: 15_000,
  });

  const toggleStatus = (s) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const showSkeleton = !isStoreReady || isPending;

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

        <div className="flex flex-wrap items-end gap-4 mb-5 p-4 rounded-2xl bg-[var(--pos-panel)] border border-slate-700/50">
          <label className="text-[11px] text-slate-500 leading-tight">
            From
            <div className="mt-0.5">
              <PosDateField
                value={fromDate}
                onChange={setFromDate}
                max={toDate}
                className="w-[160px] bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </label>
          <label className="text-[11px] text-slate-500 leading-tight">
            To
            <div className="mt-0.5">
              <PosDateField
                value={toDate}
                onChange={setToDate}
                min={fromDate}
                className="w-[160px] bg-[var(--pos-surface-inset)] border border-slate-600 text-[var(--pos-text-primary)] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>
          </label>
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

        {showSkeleton ? (
          <div className="rounded-2xl border border-slate-700/50 bg-[var(--pos-panel)] p-8 text-center text-slate-500">
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/50 bg-[var(--pos-panel)] p-8 text-center text-slate-500">
            No cashier sessions in this range.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-[var(--pos-panel)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 text-left text-slate-400">
                  <th className="px-4 py-3 font-semibold">Cashier</th>
                  <th className="px-4 py-3 font-semibold">Opened</th>
                  <th className="px-4 py-3 font-semibold">Closed</th>
                  <th className="px-4 py-3 font-semibold text-right">Opening</th>
                  <th className="px-4 py-3 font-semibold text-right">Cash sales</th>
                  <th className="px-4 py-3 font-semibold text-right">Expected</th>
                  <th className="px-4 py-3 font-semibold text-right">Counted</th>
                  <th className="px-4 py-3 font-semibold text-right">Variance</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((row) => {
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
                      <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate" title={row.varianceNotes || ''}>
                        {row.varianceNotes || '—'}
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
