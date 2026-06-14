import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronUp, AlertCircle, Info, Calculator } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';
import ViewModeToggle from '../ViewModeToggle';

const FORMULA_FIELDS = {
  wac: 'wacCost',
  fifo: 'lifoCost',
  lifo: 'fifoCost',
  last_cost: 'lastCost',
};

const FORMULA_LABELS = {
  wac: 'Weighted Average Cost (WAC)',
  fifo: 'First-In, First-Out (FIFO)',
  lifo: 'Last-In, First-Out (LIFO)',
  last_cost: 'Last Purchase Cost (Last Cost)',
};

export default function ProfitabilityAnalytics() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormulaState, setSelectedFormulaState] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('view_mode_recipe_profitability');
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode_recipe_profitability', mode);
  };

  // 1. Fetch Tenant Settings to load default costing method
  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/tenant-settings').then(r => r.data),
  });

  const selectedFormula = selectedFormulaState || settings?.inventoryCostingMethod || 'wac';

  // 2. Fetch all Menu Items
  const { data: items = [], isPending: menuPending } = useQuery({
    queryKey: ['menu', selectedStoreId],
    queryFn: () => api.get('/menu').then(r => r.data),
    enabled: isStoreReady,
  });

  // 3. Fetch all Ingredient Links (with populated costing fields)
  const { data: ingredientLinks = [], isPending: linksPending } = useQuery({
    queryKey: ['ingredient-links', selectedStoreId],
    queryFn: () => api.get('/ingredient-links').then(r => r.data),
    enabled: isStoreReady,
  });

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 4. Map and Calculate profit per menu item / variant
  const calculatedRows = useMemo(() => {
    const list = [];
    const costField = FORMULA_FIELDS[selectedFormula];

    items.forEach(menuItem => {
      // Find all ingredient links for this menu item
      const itemLinks = ingredientLinks.filter(
        link => String(link.menuItemId?._id || link.menuItemId) === String(menuItem._id)
      );

      const buildRowData = (variant = null) => {
        const name = variant ? `${menuItem.name} (${variant.name})` : menuItem.name;
        const sellPrice = variant ? (variant.price || 0) : (menuItem.price || 0);
        const id = variant ? `${menuItem._id}-${variant._id}` : menuItem.id || menuItem._id;

        // Filter links: general ingredients (no variantId) OR matches current variant
        const links = itemLinks.filter(link => {
          if (!variant) return !link.variantId;
          return !link.variantId || String(link.variantId) === String(variant._id);
        });

        // Compute cost breakdown and total COGS
        let totalCogs = 0;
        const breakdown = links.map(link => {
          const invItem = link.inventoryItemId;
          const unitCost = invItem ? (invItem[costField] || 0) : 0;
          const usageQty = link.quantity || 0;
          const wastage = link.wastagePercentage || 0;
          const finalQty = usageQty * (1 + wastage / 100);
          const contribution = unitCost * finalQty;
          totalCogs += contribution;

          return {
            ingredientName: invItem?.itemName || link.itemName || 'Unknown Ingredient',
            unit: link.unit || invItem?.unit || 'pcs',
            usageQty,
            wastage,
            unitCost,
            contribution,
          };
        });

        const profit = sellPrice - totalCogs;
        const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

        return {
          id,
          name,
          category: menuItem.category,
          sellPrice,
          totalCogs,
          profit,
          margin,
          breakdown,
          isVariant: !!variant,
          variantName: variant?.name || '',
        };
      };

      if (menuItem.hasVariants && menuItem.variants?.length > 0) {
        menuItem.variants.forEach(variant => {
          list.push(buildRowData(variant));
        });
      } else {
        list.push(buildRowData());
      }
    });

    return list;
  }, [items, ingredientLinks, selectedFormula]);

  // Filter calculated rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return calculatedRows;
    const q = searchQuery.toLowerCase();
    return calculatedRows.filter(row =>
      row.name.toLowerCase().includes(q) ||
      (row.category || '').toLowerCase().includes(q)
    );
  }, [calculatedRows, searchQuery]);

  const loading = menuPending || linksPending;

  // Render margin badges based on value
  const getMarginBadgeVariant = (margin) => {
    if (margin < 0) return 'bg-red-50 text-red-750 border border-red-200';
    if (margin < 20) return 'bg-orange-50 text-orange-750 border border-orange-200';
    if (margin < 50) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-green-55 text-green-750 border border-green-200';
  };

  return (
    <div className="space-y-6">
      {/* Search & Costing Formula Selector Header */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        {/* Row 1: Search — always full width */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-gray-400"
          />
        </div>

        {/* Row 2: Formula + toggle — flex-wrap so they never overflow */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
              <Calculator size={13} /> Costing Formula:
            </span>
            <select
              value={selectedFormula}
              onChange={(e) => setSelectedFormulaState(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-750 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {Object.keys(FORMULA_LABELS).map(key => (
                <option key={key} value={key}>{FORMULA_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />
        </div>
      </div>

      {/* Info Warning */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Dynamic Recipe Cost Estimation</p>
          <p className="mt-0.5 text-gray-650">
            Calculations are based on ingredient link recipes and current inventory unit costs calculated from Goods Receipt Notes (GRN).
            The configured accounting default is <strong className="text-blue-900 font-semibold">{FORMULA_LABELS[settings?.inventoryCostingMethod || 'wac']}</strong>.
          </p>
        </div>
      </div>

      {/* Profitability Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">
          Loading profitability analytics...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <AlertCircle size={36} className="mx-auto opacity-35 mb-2" />
          <p className="text-sm">No recipe profitability records found</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRows.map(row => {
            const isExpanded = !!expandedRows[row.id];
            return (
              <div key={row.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm truncate">{row.name}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{row.category || '—'}</p>
                    </div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${getMarginBadgeVariant(row.margin)}`}>
                      {row.margin.toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-150 text-xs">
                    <div>
                      <p className="text-gray-400">Sell Price</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{formatCurrency(row.sellPrice)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Recipe Cost</p>
                      <p className="font-semibold text-gray-650 mt-0.5">{formatCurrency(row.totalCogs)}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-gray-400">Estimated Profit</p>
                        <p className={`font-bold mt-0.5 ${row.profit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(row.profit)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRow(row.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-orange hover:underline px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100/80 transition cursor-pointer"
                      >
                        {isExpanded ? 'Hide Recipe' : 'View Recipe'}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>Ingredient</span>
                      <span>Contribution</span>
                    </div>
                    {row.breakdown.length === 0 ? (
                      <p className="text-xs text-gray-450 italic py-1">No ingredients linked.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                        {row.breakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 truncate">{item.ingredientName}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{item.usageQty} {item.unit} (+{item.wastage}% waste)</p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="font-semibold text-gray-700">{formatCurrency(item.contribution)}</p>
                              <p className="text-[9px] text-gray-400 mt-0.5">@{formatCurrency(item.unitCost)}/{item.unit}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Menu Item / Variant</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-right">Sell Price</th>
                    <th className="py-3.5 px-4 text-right">Recipe Cost</th>
                    <th className="py-3.5 px-4 text-right">Profit</th>
                    <th className="py-3.5 px-4 text-right">Margin</th>
                    <th className="py-3.5 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-sm">
                  {filteredRows.map(row => {
                    const isExpanded = !!expandedRows[row.id];
                    return (
                      <>
                        <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900">{row.name}</span>
                              {row.isVariant && (
                                <span className="text-[10px] text-purple-600 font-medium">Variant</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-gray-500">{row.category || '—'}</td>
                          <td className="py-3.5 px-4 text-right font-medium text-gray-900">
                            {formatCurrency(row.sellPrice)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-gray-650">
                            {formatCurrency(row.totalCogs)}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-bold ${row.profit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(row.profit)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${getMarginBadgeVariant(row.margin)}`}>
                              {row.margin.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => toggleRow(row.id)}
                              className="p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
                              title="Toggle Recipe Breakdown"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50/30 px-6 py-4 border-t border-gray-150">
                              <div className="space-y-3 max-w-3xl">
                                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Recipe Breakdown</span>
                                  <span className="text-xs text-gray-400">Ingredients: {row.breakdown.length}</span>
                                </div>
                                {row.breakdown.length === 0 ? (
                                  <p className="text-xs text-gray-500 italic py-2">No ingredients linked.</p>
                                ) : (
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-gray-200 text-gray-500 font-semibold">
                                        <th className="py-2 px-2">Ingredient</th>
                                        <th className="py-2 px-2 text-right">Usage Quantity</th>
                                        <th className="py-2 px-2 text-right">Wastage %</th>
                                        <th className="py-2 px-2 text-right">Unit Cost</th>
                                        <th className="py-2 px-2 text-right">Contribution</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-150 text-gray-650">
                                      {row.breakdown.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-100/50">
                                          <td className="py-2 px-2 font-medium text-gray-900">{item.ingredientName}</td>
                                          <td className="py-2 px-2 text-right">{item.usageQty} {item.unit}</td>
                                          <td className="py-2 px-2 text-right">{item.wastage}%</td>
                                          <td className="py-2 px-2 text-right">{formatCurrency(item.unitCost)}</td>
                                          <td className="py-2 px-2 text-right font-semibold text-gray-700">
                                            {formatCurrency(item.contribution)}
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="border-t border-gray-250 text-gray-900 font-bold">
                                        <td colSpan={4} className="py-2 px-2 text-right">Total Recipe Cost:</td>
                                        <td className="py-2 px-2 text-right text-brand-orange">
                                          {formatCurrency(row.totalCogs)}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
