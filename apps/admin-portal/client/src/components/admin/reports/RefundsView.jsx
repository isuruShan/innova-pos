import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RotateCcw, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
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
        active ? 'text-brand-teal' : 'text-gray-500'
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

export default function RefundsView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortField, setSortField] = useState('returnedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch refund data
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-refunds', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/refunds', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
          headers: { 'x-store-id': selectedStoreId }
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });
  const data = Array.isArray(rawData) ? rawData : [];

  // Unique reason options compiled dynamically from data
  const uniqueReasons = useMemo(() => {
    const reasons = data.map((d) => d.reason).filter(Boolean);
    return [...new Set(reasons)].sort();
  }, [data]);

  // Handle column sort
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
    return data.filter((ref) => {
      // Search matches Cashier Name, Approver Name, or Item Names
      const cashierName = ref.returnedBy?.name?.toLowerCase() || '';
      const approverName = ref.approvedBy?.name?.toLowerCase() || '';
      const itemNames = ref.items.map((i) => i.name.toLowerCase()).join(' ');
      const searchLower = search.toLowerCase();
      
      const matchesSearch =
        search === '' ||
        cashierName.includes(searchLower) ||
        approverName.includes(searchLower) ||
        itemNames.includes(searchLower);

      // Reason filter
      const matchesReason =
        reasonFilter === '' || ref.reason.toLowerCase() === reasonFilter.toLowerCase();

      // Amount ranges
      const matchesMin = minAmount === '' || ref.refundAmount >= parseFloat(minAmount);
      const matchesMax = maxAmount === '' || ref.refundAmount <= parseFloat(maxAmount);

      return matchesSearch && matchesReason && matchesMin && matchesMax;
    });
  }, [data, search, reasonFilter, minAmount, maxAmount]);

  // Sort local dataset
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'returnedAt') {
        valA = new Date(valA);
        valB = new Date(valB);
      } else if (sortField === 'cashier') {
        valA = a.returnedBy?.name?.toLowerCase() || '';
        valB = b.returnedBy?.name?.toLowerCase() || '';
      } else if (sortField === 'itemCount') {
        valA = a.items.length;
        valB = b.items.length;
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
          'Order #',
          'Returned At',
          'Cashier Name',
          'Approved By',
          'Returned Items',
          'Reason',
          'Refunded Amount ($)',
        ];
        const rows = sortedData.map((d) => [
          `#${String(d.orderNumber).padStart(3, '0')}`,
          formatDateTime(d.returnedAt),
          d.returnedBy?.name || 'Unknown',
          d.approvedBy?.name || 'System Auto',
          d.items.map((i) => `${i.name} (x${i.qty})`).join('; '),
          d.reason,
          d.refundAmount.toFixed(2),
        ]);
        exportToCsv('refunds_audit_report', headers, rows);
      });
    }
  }, [sortedData, registerExport]);

  const totalRefunded = filteredData.reduce((s, d) => s + d.refundAmount, 0);
  const averageRefund = filteredData.length > 0 ? totalRefunded / filteredData.length : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-red-500/10 text-red-500 rounded-lg">
            <RotateCcw size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Total Refunded Amount</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRefunded)}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">From completed refunds</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-brand-orange/10 text-brand-orange rounded-lg">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Refund Actions</p>
            <p className="text-lg font-bold text-gray-900">{filteredData.length}</p>
            <p className="text-[10px] text-gray-455 mt-0.5">Total transaction count</p>
          </div>
        </div>
        <div className="bg-white border border-gray-250 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-lg">
            <RotateCcw size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Average Refund size</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(averageRefund)}</p>
            <p className="text-[10px] text-gray-450 mt-0.5">Per return ticket</p>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white border border-gray-205 rounded-xl p-5 space-y-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Filters</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Search Details</label>
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5">
              <Search size={14} className="text-gray-405" />
              <input
                type="text"
                placeholder="Cashier/approver/item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-0 text-gray-800 text-xs focus:outline-none focus:ring-0 w-full placeholder-gray-400"
              />
            </div>
          </div>

          {/* Refund Reason */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-500 uppercase">Return Reason</label>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="bg-white border border-gray-300 text-gray-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
            >
              <option value="">All Reasons</option>
              {uniqueReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Amount range */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] font-semibold text-gray-550 uppercase">Refund Value ($)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Min"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="bg-white border border-gray-300 text-gray-850 text-xs rounded-lg px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
              <span className="text-gray-450 text-xs">to</span>
              <input
                type="number"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="bg-white border border-gray-300 text-gray-850 text-xs rounded-lg px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
              />
            </div>
          </div>
        </div>

        {/* Clear filters shortcut */}
        {(search || reasonFilter || minAmount || maxAmount) && (
          <button
            onClick={() => {
              setSearch('');
              setReasonFilter('');
              setMinAmount('');
              setMaxAmount('');
            }}
            className="text-[11px] text-red-500 hover:underline"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Refunds Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3">
                  <SortHeader
                    label="Order #"
                    field="orderNumber"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3">
                  <SortHeader
                    label="Date/Time"
                    field="returnedAt"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3">
                  <SortHeader
                    label="Refunded By"
                    field="cashier"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3">Approved By</th>
                <th className="px-4 py-3">
                  <SortHeader
                    label="Items Returned"
                    field="itemCount"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-right">
                  <SortHeader
                    label="Refund Amount"
                    field="refundAmount"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {isPending ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-8" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-20" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-16" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-16" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-28" /></td>
                    <td className="px-4 py-3.5"><div className="h-3.5 bg-gray-100 rounded w-24" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-3.5 bg-gray-100 rounded w-10 ml-auto" /></td>
                  </tr>
                ))
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">
                    No matching refund records found.
                  </td>
                </tr>
              ) : (
                sortedData.map((d) => (
                  <tr key={`${d.orderId}_${d.returnedAt}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3.5 font-bold text-brand-orange">
                      #{String(d.orderNumber).padStart(3, '0')}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {formatDateTime(d.returnedAt)}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-gray-800">
                      {d.returnedBy?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {d.approvedBy?.name || <span className="text-gray-400 italic">System</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        {d.items.map((i, idx) => (
                          <div key={idx} className="truncate max-w-[200px]" title={i.name}>
                            <span className="text-gray-700 font-semibold">{i.name}</span>
                            <span className="text-gray-450 text-[10px] ml-1">x{i.qty}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="bg-red-50 text-red-650 px-2 py-0.5 rounded border border-red-150 max-w-[120px] inline-block truncate" title={d.reason}>
                        {d.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-800">
                      {formatCurrency(d.refundAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500">
          <span>Row count: {filteredData.length} entries</span>
          <span>Refunded sum: <span className="text-red-650">{formatCurrency(totalRefunded)}</span></span>
        </div>
      </div>
    </div>
  );
}
