import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Tag } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';
import ResponsiveTable from '../../ResponsiveTable';

export default function CogsView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortField, setSortField] = useState('quantitySold');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch COGS report data
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-cogs', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/cogs', {
          params: { since: `${dateFrom}T00:00:00`, until: `${dateTo}T23:59:59` },
        })
        .then((r) => r.data),
    enabled: Boolean(selectedStoreId && dateFrom && dateTo),
  });
  const data = Array.isArray(rawData) ? rawData : [];

  // Extract unique categories for filter chips
  const categoriesList = useMemo(() => {
    const cats = data.map((d) => d.category).filter(Boolean);
    return [...new Set(cats)].sort();
  }, [data]);

  // Handle category chip toggles
  const handleToggleCategory = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Filter & Search
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = item.itemName.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(item.category);
      return matchesSearch && matchesCategory;
    });
  }, [data, search, selectedCategories]);

  // Sort
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
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
  }, [filteredData, sortField, sortOrder]);

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
          'Item Name',
          'Category',
          'Quantity Sold',
          'Total Revenue ($)',
          'Recipe Unit Cost ($)',
          'Total Cost (COGS) ($)',
          'Gross Profit ($)',
          'Margin (%)'
        ];
        const rows = sortedData.map((d) => [
          d.itemName,
          d.category,
          d.quantitySold,
          d.totalRevenue.toFixed(2),
          d.unitCost.toFixed(2),
          d.totalCost.toFixed(2),
          d.grossProfit.toFixed(2),
          d.marginPercentage.toFixed(1)
        ]);
        exportToCsv('cogs_report', headers, rows);
      });
    }
  }, [sortedData, registerExport]);

  // Summary Totals
  const totals = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let qty = 0;
    filteredData.forEach((item) => {
      revenue += item.totalRevenue;
      cost += item.totalCost;
      qty += item.quantitySold;
    });
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { qty, revenue, cost, profit, margin };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      {/* Search & Category Filter */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 flex items-center gap-2 bg-slate-950/80 border border-slate-700/50 rounded-xl px-3 py-2 w-full max-w-md">
          <Search size={15} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search sold items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-0 text-slate-200 text-sm focus:outline-none focus:ring-0 w-full placeholder-slate-600"
          />
        </div>

        {/* Category chips list */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
            <Tag size={12} /> Categories:
          </span>
          {categoriesList.length === 0 ? (
            <span className="text-xs text-slate-600 italic">No categories found</span>
          ) : (
            categoriesList.map((cat) => {
              const active = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => handleToggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    active
                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-950 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              );
            })
          )}
          {selectedCategories.length > 0 && (
            <button
              onClick={() => setSelectedCategories([])}
              className="text-xs text-red-450 hover:underline ml-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Itemized Table */}
      <div className="flex flex-col gap-3">
        <style>{`
          .cogs-scroll-table .hidden.sm\\:block {
            max-height: 480px;
            overflow-y: auto;
          }
          .cogs-scroll-table th {
            position: sticky !important;
            top: 0 !important;
            z-index: 10;
          }
        `}</style>
        <ResponsiveTable
          className="cogs-scroll-table"
          rows={sortedData}
          rowKey={(item) => `${item.menuItemId}_${item.variantId || 'base'}`}
          loading={isPending}
          skeletonRows={5}
          emptyState="No items found."
          currentSort={sortField}
          currentOrder={sortOrder}
          onSort={handleSort}
          columns={[
            {
              key: 'itemName',
              header: 'Item Name',
              sortField: 'itemName',
              mobilePrimary: true,
              render: (item) => <span className="font-medium text-slate-200">{item.itemName}</span>,
            },
            {
              key: 'category',
              header: 'Category',
              sortField: 'category',
              render: (item) => (
                <span className="bg-slate-800/60 text-slate-400 px-2 py-0.5 rounded-md text-xs">{item.category}</span>
              ),
            },
            {
              key: 'quantitySold',
              header: 'Qty Sold',
              sortField: 'quantitySold',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => <span className="tabular-nums">{item.quantitySold}</span>,
            },
            {
              key: 'totalRevenue',
              header: 'Revenue',
              sortField: 'totalRevenue',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => <span className="font-medium text-slate-200 tabular-nums">{formatCurrency(item.totalRevenue)}</span>,
            },
            {
              key: 'unitCost',
              header: 'Unit Cost (Recipe)',
              sortField: 'unitCost',
              className: 'text-right text-slate-400',
              headerClassName: 'text-right',
              render: (item) => <span className="tabular-nums">{formatCurrency(item.unitCost)}</span>,
            },
            {
              key: 'totalCost',
              header: 'Total Cost (COGS)',
              sortField: 'totalCost',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => <span className="font-medium text-slate-300 tabular-nums">{formatCurrency(item.totalCost)}</span>,
            },
            {
              key: 'grossProfit',
              header: 'Gross Profit',
              sortField: 'grossProfit',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => {
                const isPositive = item.grossProfit >= 0;
                return (
                  <span className={`font-semibold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(item.grossProfit)}
                  </span>
                );
              },
            },
            {
              key: 'marginPercentage',
              header: 'Margin %',
              sortField: 'marginPercentage',
              className: 'text-right',
              headerClassName: 'text-right',
              render: (item) => {
                const isPositive = item.marginPercentage >= 0;
                return (
                  <span className={`font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.marginPercentage.toFixed(1)}%
                  </span>
                );
              },
            },
          ]}
        />

        {/* Summary Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Qty Sold</span>
            <div className="text-xl font-extrabold text-slate-200 tabular-nums">{totals.qty}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Gross Revenue</span>
            <div className="text-xl font-extrabold text-amber-400 tabular-nums">{formatCurrency(totals.revenue)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total COGS</span>
            <div className="text-xl font-extrabold text-slate-300 tabular-nums">{formatCurrency(totals.cost)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Gross Profit</span>
            <div className={`text-xl font-extrabold tabular-nums ${totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(totals.profit)}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Avg. Margin</span>
            <div className={`text-xl font-extrabold tabular-nums ${totals.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totals.margin.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
