import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';

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
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col items-center">
          <div className="w-full text-left mb-4">
            <h3 className="font-semibold text-slate-200">Wastage Breakdown</h3>
            <p className="text-xs text-slate-500">Financial loss by category reason</p>
          </div>

          {chartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-600">
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
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                    labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                    itemStyle={{ fontSize: 11 }}
                    formatter={(val) => [formatCurrency(val), 'Loss']}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconSize={10}
                    iconType="circle"
                    formatter={(value) => <span className="text-[11px] text-slate-400 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Audit filter & summary cards */}
        <div className="lg:col-span-3 flex flex-col justify-between gap-4">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex-1 flex flex-col justify-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Financial Loss</span>
            <div className="text-3xl sm:text-4xl font-black text-red-400 mt-1 tabular-nums">
              {formatCurrency(totalLoss)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
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
                      ? 'bg-slate-800 border-amber-500/60'
                      : 'bg-slate-900/30 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 block truncate">{REASON_LABELS[reasonKey]}</span>
                    <span className="text-base font-extrabold text-slate-200 tabular-nums">{formatCurrency(cost)}</span>
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
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 flex items-center gap-2 bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2 w-full max-w-md">
          <Search size={15} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search audited items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-0 text-slate-200 text-sm focus:outline-none focus:ring-0 w-full placeholder-slate-600"
          />
        </div>

        {selectedReason !== 'all' && (
          <button
            onClick={() => setSelectedReason('all')}
            className="text-xs text-amber-500 font-semibold hover:underline"
          >
            Clear Reason Filter ({REASON_LABELS[selectedReason]})
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="flex flex-col gap-3">
        <style>{`
          .wastage-scroll-table .hidden.sm\\:block {
            max-height: 480px;
            overflow-y: auto;
          }
          .wastage-scroll-table th {
            position: sticky !important;
            top: 0 !important;
            z-index: 10;
          }
        `}</style>
        <ResponsiveTable
          className="wastage-scroll-table"
          rows={sortedItems}
          rowKey={(item, index) => `${item.date}_${item.itemName}_${index}`}
          loading={isPending}
          skeletonRows={5}
          emptyState="No wastage records match the filters."
          currentSort={sortField}
          currentOrder={sortOrder}
          onSort={handleSort}
          columns={[
            {
              key: 'date',
              header: 'Date',
              sortField: 'date',
              mobilePrimary: true,
              render: (item) => (
                <span className="text-slate-400 tabular-nums">
                  {new Date(item.date).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: 'itemName',
              header: 'Item Name',
              sortField: 'itemName',
              render: (item) => <span className="font-medium text-slate-200">{item.itemName}</span>,
            },
            {
              key: 'itemType',
              header: 'Type',
              sortField: 'itemType',
              render: (item) => (
                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${
                  item.itemType === 'menu' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                  {item.itemType}
                </span>
              ),
            },
            {
              key: 'quantity',
              header: 'Quantity',
              sortField: 'quantity',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => (
                <span className="tabular-nums font-semibold">
                  {item.quantity} <span className="text-[10px] text-slate-500">{item.unit || 'pcs'}</span>
                </span>
              ),
            },
            {
              key: 'reason',
              header: 'Reason',
              sortField: 'reason',
              render: (item) => (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: `${COLORS[item.reason || 'other']}15`,
                    color: COLORS[item.reason || 'other'],
                    border: `1px solid ${COLORS[item.reason || 'other']}30`,
                  }}
                >
                  {REASON_LABELS[item.reason] || item.reason}
                </span>
              ),
            },
            {
              key: 'unitCost',
              header: 'Unit Cost',
              sortField: 'unitCost',
              className: 'text-right text-slate-400',
              headerClassName: 'text-right',
              render: (item) => <span className="tabular-nums">{formatCurrency(item.unitCost)}</span>,
            },
            {
              key: 'totalLoss',
              header: 'Total Loss',
              sortField: 'totalLoss',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => (
                <span className="font-bold text-red-400 tabular-nums">
                  {formatCurrency(item.totalLoss)}
                </span>
              ),
            },
            {
              key: 'createdBy',
              header: 'Reported By',
              sortField: 'createdBy',
              render: (item) => <span className="text-slate-400 text-xs">{item.createdBy}</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
