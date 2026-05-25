import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, Tag } from 'lucide-react';
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
      className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-gray-900 transition-colors ${
        active ? 'text-brand-orange' : 'text-gray-455'
      }`}
    >
      <span>{label}</span>
      {active ? (
        currentOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
      ) : (
        <ArrowUpDown size={12} className="opacity-40" />
      )}
    </button>
  );
}

export default function MenuMixView({ dateFrom, dateTo, registerExport }) {
  const { selectedStoreId } = useStoreContext();
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortField, setSortField] = useState('qty');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch report data
  const { data: rawData, isPending } = useQuery({
    queryKey: ['report-menu-mix', selectedStoreId, dateFrom, dateTo],
    queryFn: () =>
      api
        .get('/reports/extended/menu-mix', {
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
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  // Filter & Search
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
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

  // Top Items for Chart (always sorted by quantity sold desc)
  const chartData = useMemo(() => {
    return [...filteredData]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
      .map((item) => ({
        name: item.name,
        qty: item.qty,
        revenue: item.revenue,
      }));
  }, [filteredData]);

  // Expose export function to parent
  useEffect(() => {
    if (registerExport) {
      registerExport(() => {
        const headers = ['Item Name', 'Category', 'Quantity Sold', 'Total Revenue ($)'];
        const rows = sortedData.map((d) => [d.name, d.category, d.qty, d.revenue.toFixed(2)]);
        exportToCsv('menu_mix_report', headers, rows);
      });
    }
  }, [sortedData, registerExport]);

  const totalQty = filteredData.reduce((sum, item) => sum + item.qty, 0);
  const totalRev = filteredData.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-6">
      {/* Search & Category filter */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 w-full max-w-md">
          <Search size={15} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
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

      {/* Main Grid: Chart & Table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Table representation */}
        <div className="xl:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                  <th className="px-4 py-3">
                    <SortHeader
                      label="Item Name"
                      field="name"
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3">
                    <SortHeader
                      label="Category"
                      field="category"
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Qty Sold"
                      field="qty"
                      currentSort={sortField}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader
                      label="Revenue"
                      field="revenue"
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
                      <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-32" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-100 rounded w-12 ml-auto" /></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-100 rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-400 text-sm">
                      No items matched your filters.
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item) => (
                    <tr key={item._id || item.name} className="hover:bg-gray-50/50 text-sm">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs font-semibold">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{item.qty}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 font-mono">
                        {formatCurrency(item.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Summary Row */}
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-500">
            <span>Total Filtered: {filteredData.length} items</span>
            <div className="flex gap-4">
              <span>Qty: <span className="text-gray-800">{totalQty}</span></span>
              <span>Sales: <span className="text-brand-orange">{formatCurrency(totalRev)}</span></span>
            </div>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800">Top Selling Products</h3>
            <p className="text-xs text-gray-450">Ranked by unit sales volume</p>
          </div>
          {chartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              No sales data in range
            </div>
          ) : (
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: '#475569', fontSize: 9 }}
                    width={90}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    labelStyle={{ color: '#475569', fontWeight: 'bold', fontSize: 11 }}
                    itemStyle={{ color: '#f97316', fontSize: 11 }}
                    formatter={(val) => [val, 'Sold']}
                  />
                  <Bar dataKey="qty" fill="#fa7237" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
