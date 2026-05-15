import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Wallet } from 'lucide-react';
import api from '../../api/axios';
import AdminDateField from '../../components/AdminDateField';
import ListPagination from '../../components/common/ListPagination';
import { unwrapPagedList } from '../../utils/unwrapPagedList';
import { useStoreContext } from '../../context/StoreContext';

function todayStr() {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
}

function money(n) {
  return `Rs ${Number(n ?? 0).toFixed(2)}`;
}

function formatDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CashierSessionsPage() {
  const { stores, selectedStoreId } = useStoreContext();
  const [fromDate, setFromDate] = useState(sevenDaysAgo());
  const [toDate, setToDate] = useState(todayStr());
  const [statusFilter, setStatusFilter] = useState(['closed', 'open']);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, statusFilter.join(','), selectedStoreId]);

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
    queryKey: ['admin-cashier-sessions', selectedStoreId, params, page],
    queryFn: async () => {
      const { data } = await api.get('/cashier-sessions', { params: { ...params, page, limit: 25 } });
      return unwrapPagedList(data);
    },
    enabled: Boolean(stores.length),
    staleTime: 15_000,
  });
  const sessions = sessionList.items || [];
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
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 self-start px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <label className="text-xs text-gray-500 block">
          From
          <AdminDateField
            value={fromDate}
            max={toDate}
            onChange={setFromDate}
            className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 w-full sm:w-auto min-w-[10rem]"
          />
        </label>
        <label className="text-xs text-gray-500 block">
          To
          <AdminDateField
            value={toDate}
            min={fromDate}
            onChange={setToDate}
            className="block mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 w-full sm:w-auto min-w-[10rem]"
          />
        </label>
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
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Store', 'Cashier', 'Opened', 'Closed', 'Opening', 'Cash sales', 'Expected', 'Counted', 'Variance', 'Notes', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
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
                    <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate" title={row.varianceNotes || ''}>
                      {row.varianceNotes || '—'}
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
