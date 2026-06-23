import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Tag, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../../../api/axios';
import { formatCurrency } from '../../../utils/format';
import { useStoreContext } from '../../../context/StoreContext';
import { exportToCsv } from '../../../utils/exportCsv';

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
          headers: { 'x-store-id': selectedStoreId }
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
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 w-full max-w-md">
          <Search size={15} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search sold items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-0 text-gray-800 text-sm focus:outline-none focus:ring-0 w-full placeholder-gray-400"
          />
        </div>

        {/* Category chips list */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-500 flex items-center gap-1 mr-1">
            <Tag size={12} /> Categories:
          </span>
          {categoriesList.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No categories found</span>
          ) : (
            categoriesList.map((cat) => {
              const active = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => handleToggleCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    active
                      ? 'bg-brand-orange border-brand-orange text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
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
              className="text-xs text-red-500 hover:underline ml-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI Totals Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Qty Sold</span>
          <div className="text-lg font-black text-gray-850 mt-1 tabular-nums">{totals.qty}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Gross Revenue</span>
          <div className="text-lg font-black text-brand-orange mt-1 tabular-nums">{formatCurrency(totals.revenue)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Total COGS</span>
          <div className="text-lg font-black text-gray-850 mt-1 tabular-nums">{formatCurrency(totals.cost)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Gross Profit</span>
          <div className={`text-lg font-black mt-1 tabular-nums ${totals.profit >= 0 ? 'text-emerald-600' : 'text-red-650'}`}>
            {formatCurrency(totals.profit)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold block">Avg. Margin</span>
          <div className={`text-lg font-black mt-1 tabular-nums ${totals.margin >= 0 ? 'text-emerald-600' : 'text-red-650'}`}>
            {totals.margin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
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
                    label="Category"
                    field="category"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Qty Sold"
                    field="quantitySold"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Revenue"
                    field="totalRevenue"
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
                    label="Total COGS"
                    field="totalCost"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Gross Profit"
                    field="grossProfit"
                    currentSort={sortField}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                  />
                </th>
                <th className="px-4 py-3 text-right sticky top-0 bg-gray-50 z-10">
                  <SortHeader
                    label="Margin %"
                    field="marginPercentage"
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
                    <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-12 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 bg-gray-100 rounded w-12 ml-auto" /></td>
                  </tr>
                ))
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 font-medium">
                    No items found.
                  </td>
                </tr>
              ) : (
                sortedData.map((item) => {
                  const isPositive = item.grossProfit >= 0;
                  return (
                    <tr key={`${item.menuItemId}_${item.variantId || 'base'}`} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.itemName}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{item.quantitySold}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono">
                        {formatCurrency(item.totalRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-450 font-mono">{formatCurrency(item.unitCost)}</td>
                      <td className="px-4 py-3 text-right text-gray-600 font-semibold font-mono">{formatCurrency(item.totalCost)}</td>
                      <td className={`px-4 py-3 text-right font-semibold font-mono ${isPositive ? 'text-emerald-600' : 'text-red-650'}`}>
                        {formatCurrency(item.grossProfit)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold font-mono ${isPositive ? 'text-emerald-600' : 'text-red-650'}`}>
                        {item.marginPercentage.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500">
          <span>Row count: {filteredData.length} items</span>
          <span>Filtered Sales: <span className="text-brand-orange">{formatCurrency(totals.revenue)}</span></span>
        </div>
      </div>
    </div>
  );
}
