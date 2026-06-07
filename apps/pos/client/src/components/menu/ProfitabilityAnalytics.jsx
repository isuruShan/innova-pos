import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronDown, ChevronUp, AlertCircle, Info, Calculator } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency } from '../../utils/format';
import { useStoreContext } from '../../context/StoreContext';

const FORMULA_FIELDS = {
  wac: 'wacCost',
  fifo: 'fifoCost',
  lifo: 'lifoCost',
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
    if (margin < 0) return 'bg-red-500/10 text-red-400 border border-red-550/20';
    if (margin < 20) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    if (margin < 50) return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    return 'bg-green-500/10 text-green-405 border border-green-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Search & Costing Formula Selector Header */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[var(--pos-panel)] p-4 rounded-2xl border border-slate-700">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-550"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <span className="text-xs text-slate-400 whitespace-nowrap flex items-center gap-1">
            <Calculator size={13} /> Costing Formula:
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
      </div>

      {/* Info Warning */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-xs text-blue-400">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Dynamic Recipe Cost Estimation</p>
          <p className="mt-0.5 text-slate-400">
            Calculations are based on ingredient link recipes and current inventory unit costs calculated from Goods Receipt Notes (GRN).
            The configured accounting default is <strong className="text-blue-300 font-semibold">{FORMULA_LABELS[settings?.inventoryCostingMethod || 'wac']}</strong>.
          </p>
        </div>
      </div>

      {/* Profitability Table */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">
          Loading profitability analytics...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 bg-[var(--pos-panel)] rounded-2xl border border-slate-700 text-slate-400">
          <AlertCircle size={36} className="mx-auto opacity-35 mb-2" />
          <p className="text-sm">No recipe profitability records found</p>
        </div>
      ) : (
        <div className="bg-[var(--pos-panel)] border border-slate-700/65 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Menu Item / Variant</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Sell Price</th>
                  <th className="py-3.5 px-4 text-right">Recipe Cost</th>
                  <th className="py-3.5 px-4 text-right">Profit ($)</th>
                  <th className="py-3.5 px-4 text-right">Margin (%)</th>
                  <th className="py-3.5 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40 text-sm">
                {filteredRows.map(row => {
                  const isExpanded = !!expandedRows[row.id];
                  return (
                    <tr key={row.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--pos-text-primary)]">{row.name}</span>
                          {row.isVariant && (
                            <span className="text-[10px] text-purple-400 font-medium">Variant</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{row.category || '—'}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-[var(--pos-text-primary)]">
                        {formatCurrency(row.sellPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-300">
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
                          className="p-1 rounded text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition"
                          title="Toggle Recipe Breakdown"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Accordion content inside table or using expanded details */}
          {/* To maintain standard styling, we can render expanded items inline by injecting a row */}
        </div>
      )}

      {/* Custom Accordion Panels */}
      {filteredRows.map(row => {
        const isExpanded = !!expandedRows[row.id];
        if (!isExpanded) return null;
        return (
          <div
            key={`detail-${row.id}`}
            className="bg-[var(--pos-surface-inset)] border border-slate-700/60 rounded-2xl p-4 space-y-3 shadow-inner transform translate-y-[-8px] border-t-0 rounded-t-none"
          >
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recipe Breakdown</span>
              <span className="text-xs text-slate-500 font-mono">Ingredients: {row.breakdown.length}</span>
            </div>
            
            {row.breakdown.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">No ingredients linked to this item recipe.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-750 text-slate-500 font-semibold">
                      <th className="py-2 px-2">Ingredient</th>
                      <th className="py-2 px-2 text-right">Usage Quantity</th>
                      <th className="py-2 px-2 text-right">Wastage %</th>
                      <th className="py-2 px-2 text-right">Unit Cost</th>
                      <th className="py-2 px-2 text-right">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-350">
                    {row.breakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/10">
                        <td className="py-2 px-2 font-medium text-slate-200">{item.ingredientName}</td>
                        <td className="py-2 px-2 text-right">{item.usageQty} {item.unit}</td>
                        <td className="py-2 px-2 text-right">{item.wastage}%</td>
                        <td className="py-2 px-2 text-right">{formatCurrency(item.unitCost)}</td>
                        <td className="py-2 px-2 text-right font-semibold text-slate-300">
                          {formatCurrency(item.contribution)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-700 text-slate-200">
                      <td colSpan={4} className="py-2 px-2 font-bold text-right">Total Recipe Cost:</td>
                      <td className="py-2 px-2 text-right font-bold text-amber-400">
                        {formatCurrency(row.totalCogs)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
