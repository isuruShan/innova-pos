import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

const COLORS = {
  expiry: '#ef4444',
  damage: '#f97316',
  spillage: '#3b82f6',
  other: '#6b7280',
};

const REASON_LABELS = {
  expiry: 'Expiry',
  damage: 'Damage',
  spillage: 'Spillage / Prep Waste',
  other: 'Other',
};

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

export default function WastageReportView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [search, setSearch] = useState('');
  const [selectedReason, setSelectedReason] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch wastage report data
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-wastage', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/wastage', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
          headers: { 'x-store-id': selectedStoreId }
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });

  const byReason = useMemo(() => rawData?.byReason || [], [rawData]);
  const items = useMemo(() => rawData?.items || [], [rawData]);

  // Filter & Search
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.itemName.toLowerCase().includes(search.toLowerCase());
      const matchesReason = selectedReason === 'all' || item.reason === selectedReason;
      return matchesSearch && matchesReason;
    });
  }, [items, search, selectedReason]);

  // Sort
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Expose export function to parent ReportsPortal
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        const headers = [
          'Date',
          'Item Name',
          'Type',
          'Quantity',
          'Unit',
          'Reason',
          'Unit Cost ($)',
          'Total Loss ($)',
          'Reported By'
        ];
        const rows = sortedItems.map((d) => [
          new Date(d.date).toLocaleDateString(),
          d.itemName,
          d.itemType,
          d.quantity,
          d.unit || 'pcs',
          d.reason,
          d.unitCost.toFixed(2),
          d.totalLoss.toFixed(2),
          d.createdBy
        ]);
        exportToCsv('inventory_wastage_report', headers, rows);
      });
    }
  }, [sortedItems, registerExport]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    return byReason
      .map((r) => ({
        name: REASON_LABELS[r.reason] || r.reason,
        value: r.cost,
        reasonKey: r.reason,
      }))
      .filter((d) => d.value > 0);
  }, [byReason]);

  const totalLoss = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.totalLoss, 0);
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      {/* Visual Chart & Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pie Chart Card */}
        <div className="lg:col-span-2 bg-white border border-gray-250 rounded-xl p-5 flex flex-col items-center">
          <div className="w-full text-left mb-4">
            <h3 className="font-semibold text-gray-800">Wastage Breakdown</h3>
            <p className="text-xs text-gray-450">Financial loss by category reason</p>
          </div>

          {chartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-405">
              No wastage records in date range
            </div>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.reasonKey] || '#ccc'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    labelStyle={{ color: '#475569', fontSize: 11 }}
                    itemStyle={{ fontSize: 11 }}
                    formatter={(val) => [formatCurrency(val), 'Loss']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={10}
                    iconType="circle"
                    formatter={(value) => <span className="text-[11px] text-gray-500 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Audit filter & summary cards */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-4">
          <div className="bg-white border border-gray-255 rounded-xl p-5 flex-1 flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total Financial Loss</span>
            <div className="text-3xl font-black text-red-650 mt-1 tabular-nums">
              {formatCurrency(totalLoss)}
            </div>
            <p className="text-xs text-gray-450 mt-2">
              Based on the store's active inventory costing method configuration.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {Object.keys(REASON_LABELS).map((reasonKey) => {
              const item = byReason.find((r) => r.reason === reasonKey);
              const cost = item ? item.cost : 0;
              return (
                <div
                  key={reasonKey}
                  onClick={() => setSelectedReason(selectedReason === reasonKey ? 'all' : reasonKey)}
                  className={`cursor-pointer rounded-xl border p-3 transition flex items-center justify-between ${
                    selectedReason === reasonKey
                      ? 'bg-gray-100 border-brand-orange'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-gray-450 block truncate">{REASON_LABELS[reasonKey]}</span>
                    <span className="text-base font-extrabold text-gray-800 tabular-nums">{formatCurrency(cost)}</span>
                  </div>
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[reasonKey] }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 w-full max-w-md">
          <Search size={15} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search audited items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-0 text-gray-800 text-sm focus:outline-none focus:ring-0 w-full placeholder-gray-400"
          />
        </div>

        {selectedReason !== 'all' && (
          <button
            onClick={() => setSelectedReason('all')}
            className="text-xs text-brand-orange font-semibold hover:underline"
          >
            Clear Reason Filter ({REASON_LABELS[selectedReason]})
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <th className="px-4 py-3 sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Date"
                    field="date"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Item Name"
                    field="itemName"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Type"
                    field="itemType"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Quantity"
                    field="quantity"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Reason"
                    field="reason"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10 text-gray-450">
                  <SortHeader
                    label="Unit Cost"
                    field="unitCost"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Total Loss"
                    field="totalLoss"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Reported By"
                    field="createdBy"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-12" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-12 ml-auto" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-12 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                  </tr>
                ))
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 font-medium">
                    No wastage records match the filters.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item, idx) => (
                  <tr key={`${item.date}_${item.itemName}_${idx}`} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-gray-500">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.itemName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.itemType === 'menu' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {item.itemType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {item.quantity} <span className="text-[10px] text-gray-405">{item.unit || 'pcs'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${COLORS[item.reason || 'other']}15`,
                          color: COLORS[item.reason || 'other'],
                          border: `1px solid ${COLORS[item.reason || 'other']}20`,
                        }}
                      >
                        {REASON_LABELS[item.reason] || item.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{formatCurrency(item.unitCost)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-650 font-mono">
                      {formatCurrency(item.totalLoss)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.createdBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500">
          <span>Row count: {filteredItems.length} entries</span>
          <span>Wastage Cost sum: <span className="text-red-650 font-bold">{formatCurrency(totalLoss)}</span></span>
        </div>
      </div>
    </div>
  );
}
