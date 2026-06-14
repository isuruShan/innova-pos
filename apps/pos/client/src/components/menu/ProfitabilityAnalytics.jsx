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

const STORAGE_KEY = 'view_mode_pos_recipe_profitability';

export default function ProfitabilityAnalytics() {
  const { selectedStoreId, isStoreReady } = useStoreContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormulaState, setSelectedFormulaState] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    return window.innerWidth < 768 ? 'grid' : 'table';
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem(STORAGE_KEY, mode);
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
      const itemLinks = ingredientLinks.filter(
        link => String(link.menuItemId?._id || link.menuItemId) === String(menuItem._id)
      );

      const buildRowData = (variant = null) => {
        const name = variant ? `${menuItem.name} (${variant.name})` : menuItem.name;
        const sellPrice = variant ? (variant.price || 0) : (menuItem.price || 0);
        const id = variant ? `${menuItem._id}-${variant._id}` : menuItem.id || menuItem._id;

        const links = itemLinks.filter(link => {
          if (!variant) return !link.variantId;
          return !link.variantId || String(link.variantId) === String(variant._id);
        });

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

        return { id, name, category: menuItem.category, sellPrice, totalCogs, profit, margin, breakdown, isVariant: !!variant };
      };

      if (menuItem.hasVariants && menuItem.variants?.length > 0) {
        menuItem.variants.forEach(variant => list.push(buildRowData(variant)));
      } else {
        list.push(buildRowData());
      }
    });

    return list;
  }, [items, ingredientLinks, selectedFormula]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return calculatedRows;
    const q = searchQuery.toLowerCase();
    return calculatedRows.filter(row =>
      row.name.toLowerCase().includes(q) ||
      (row.category || '').toLowerCase().includes(q)
    );
  }, [calculatedRows, searchQuery]);

  const loading = menuPending || linksPending;

  const getMarginBadgeVariant = (margin) => {
    if (margin < 0) return 'bg-red-500/10 text-red-400 border border-red-500/20';
    if (margin < 20) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    if (margin < 50) return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    return 'bg-green-500/10 text-green-400 border border-green-500/20';
  };

  const RecipeBreakdown = ({ row }) => (
    <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <span>Ingredient</span>
        <span>Contribution</span>
      </div>
      {row.breakdown.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-1">No ingredients linked.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {row.breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs bg-slate-800/40 border border-slate-700/50 p-2.5 rounded-xl">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-200 truncate">{item.ingredientName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{item.usageQty} {item.unit} (+{item.wastage}% waste)</p>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="font-semibold text-slate-300">{formatCurrency(item.contribution)}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">@{formatCurrency(item.unitCost)}/{item.unit}</p>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-slate-700/50 text-slate-200">
            <span>Total Recipe Cost</span>
            <span className="text-amber-400">{formatCurrency(row.totalCogs)}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search & Controls Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[var(--pos-panel)] p-4 rounded-2xl border border-slate-700">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-550"
          />
        </div>

        <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1 whitespace-nowrap">
              <Calculator size={13} /> Formula:
            </span>
            <select
              value={selectedFormula}
              onChange={(e) => setSelectedFormulaState(e.target.value)}
              className="bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {Object.keys(FORMULA_LABELS).map(key => (
                <option key={key} value={key}>{FORMULA_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <ViewModeToggle mode={viewMode} setMode={handleSetViewMode} />
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-xs text-blue-400">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Dynamic Recipe Cost Estimation</p>
          <p className="mt-0.5 text-slate-400">
            Calculations are based on ingredient link recipes and current inventory unit costs from GRNs.
            Default accounting method: <strong className="text-blue-300 font-semibold">{FORMULA_LABELS[settings?.inventoryCostingMethod || 'wac']}</strong>.
          </p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">Loading profitability analytics...</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 bg-[var(--pos-panel)] rounded-2xl border border-slate-700 text-slate-400">
          <AlertCircle size={36} className="mx-auto opacity-35 mb-2" />
          <p className="text-sm">No recipe profitability records found</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRows.map(row => {
            const isExpanded = !!expandedRows[row.id];
            return (
              <div key={row.id} className="bg-[var(--pos-panel)] border border-slate-700/65 rounded-2xl p-4 shadow-sm flex flex-col hover:border-slate-600 transition">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-[var(--pos-text-primary)] text-sm truncate">{row.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{row.category || '—'}</p>
                      {row.isVariant && <span className="text-[10px] text-purple-400 font-medium">Variant</span>}
                    </div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${getMarginBadgeVariant(row.margin)}`}>
                      {row.margin.toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-700/50 text-xs">
                    <div>
                      <p className="text-slate-500">Sell Price</p>
                      <p className="font-semibold text-[var(--pos-text-primary)] mt-0.5">{formatCurrency(row.sellPrice)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Recipe Cost</p>
                      <p className="font-semibold text-slate-300 mt-0.5">{formatCurrency(row.totalCogs)}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-700/40 flex items-center justify-between">
                      <div>
                        <p className="text-slate-500">Estimated Profit</p>
                        <p className={`font-bold mt-0.5 ${row.profit < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {formatCurrency(row.profit)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRow(row.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:underline px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition cursor-pointer"
                      >
                        {isExpanded ? 'Hide Recipe' : 'View Recipe'}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && <RecipeBreakdown row={row} />}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-[var(--pos-panel)] border border-slate-700/65 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Menu Item / Variant</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Category</th>
                  <th className="py-3.5 px-4 text-right">Sell Price</th>
                  <th className="py-3.5 px-4 text-right hidden md:table-cell">Recipe Cost</th>
                  <th className="py-3.5 px-4 text-right">Profit</th>
                  <th className="py-3.5 px-4 text-right">Margin</th>
                  <th className="py-3.5 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30 text-sm">
                {filteredRows.map(row => {
                  const isExpanded = !!expandedRows[row.id];
                  return (
                    <>
                      <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-[var(--pos-text-primary)]">{row.name}</span>
                            {row.isVariant && <span className="text-[10px] text-purple-400 font-medium">Variant</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 hidden sm:table-cell">{row.category || '—'}</td>
                        <td className="py-3.5 px-4 text-right font-medium text-[var(--pos-text-primary)]">
                          {formatCurrency(row.sellPrice)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-300 hidden md:table-cell">
                          {formatCurrency(row.totalCogs)}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-bold ${row.profit < 0 ? 'text-red-400' : 'text-green-400'}`}>
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
                            className="p-1 rounded text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition cursor-pointer"
                            title="Toggle Recipe Breakdown"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${row.id}-detail`}>
                          <td colSpan={7} className="bg-slate-800/20 px-6 py-4 border-t border-slate-700/30">
                            <div className="space-y-3 max-w-3xl">
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recipe Breakdown</span>
                                <span className="text-xs text-slate-500">Ingredients: {row.breakdown.length}</span>
                              </div>
                              {row.breakdown.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">No ingredients linked.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-700/50 text-slate-500 font-semibold">
                                        <th className="py-2 px-2">Ingredient</th>
                                        <th className="py-2 px-2 text-right">Usage Qty</th>
                                        <th className="py-2 px-2 text-right hidden sm:table-cell">Wastage %</th>
                                        <th className="py-2 px-2 text-right hidden sm:table-cell">Unit Cost</th>
                                        <th className="py-2 px-2 text-right">Contribution</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/30 text-slate-350">
                                      {row.breakdown.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30">
                                          <td className="py-2 px-2 font-medium text-slate-200">{item.ingredientName}</td>
                                          <td className="py-2 px-2 text-right">{item.usageQty} {item.unit}</td>
                                          <td className="py-2 px-2 text-right hidden sm:table-cell">{item.wastage}%</td>
                                          <td className="py-2 px-2 text-right hidden sm:table-cell">{formatCurrency(item.unitCost)}</td>
                                          <td className="py-2 px-2 text-right font-semibold text-slate-300">
                                            {formatCurrency(item.contribution)}
                                          </td>
                                        </tr>
                                      ))}
                                      <tr className="border-t border-slate-600/50 text-slate-200 font-bold">
                                        <td colSpan={4} className="py-2 px-2 text-right">Total Recipe Cost:</td>
                                        <td className="py-2 px-2 text-right text-amber-400">
                                          {formatCurrency(row.totalCogs)}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
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
      )}
    </div>
  );
}
