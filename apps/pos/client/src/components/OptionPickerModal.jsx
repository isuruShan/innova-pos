import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { filterMenuItems } from '../utils/menuItemSearch';

/**
 * Touch-friendly option picker modal for POS.
 * Displays options in a grid with large touch targets.
 * 
 * @param {boolean} open - Whether modal is visible
 * @param {function} onClose - Close handler
 * @param {string} title - Modal title
 * @param {string} subtitle - Optional subtitle text
 * @param {Array} options - Array of { value, label, icon?, description?, disabled?, badge? }
 * @param {string} value - Currently selected value
 * @param {function} onChange - (value) => void
 * @param {number} columns - Grid columns (default 2)
 * @param {boolean} closeOnSelect - Close modal after selection (default true)
 */
export default function OptionPickerModal({
  open,
  onClose,
  title,
  subtitle,
  options = [],
  value,
  onChange,
  columns = 2,
  closeOnSelect = true,
}) {
  if (!open) return null;

  const handleSelect = (optionValue) => {
    onChange?.(optionValue);
    if (closeOnSelect) {
      onClose?.();
    }
  };

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns] || 'grid-cols-2';

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[var(--pos-panel)] border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--pos-text-primary)]">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options grid */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          <div className={`grid ${gridCols} gap-2.5`}>
            {options.map((opt) => {
              const isSelected = value === opt.value;
              const isDisabled = opt.disabled;

              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(opt.value)}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 text-center transition-all min-h-[5rem] ${
                    isDisabled
                      ? 'border-slate-800 bg-slate-800/40 text-slate-600 cursor-not-allowed'
                      : isSelected
                        ? 'border-amber-500 bg-amber-500/20 text-[var(--pos-text-primary)] shadow-lg shadow-amber-500/10'
                        : 'border-slate-700 bg-[var(--pos-surface-inset)] text-slate-300 hover:border-slate-600 hover:bg-slate-800/60 active:scale-[0.98]'
                  }`}
                >
                  {/* Badge */}
                  {opt.badge && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {opt.badge}
                    </span>
                  )}

                  {/* Icon */}
                  {opt.icon && (
                    <span className="text-xl leading-none">{opt.icon}</span>
                  )}

                  {/* Label */}
                  <span className={`text-sm font-semibold leading-tight ${isSelected ? 'text-amber-300' : ''}`}>
                    {opt.label}
                  </span>

                  {/* Description */}
                  {opt.description && (
                    <span className="text-[10px] text-slate-500 leading-snug">
                      {opt.description}
                    </span>
                  )}

                  {/* Selection indicator */}
                  {isSelected && (
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cancel footer */}
        <div className="px-4 pb-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold text-sm transition active:scale-[0.99]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Touch-friendly menu item picker modal for adding items to orders.
 * Displays menu items in a scrollable list with search.
 */
export function MenuItemPickerModal({
  open,
  onClose,
  menuItems = [],
  existingIds = new Set(),
  onSelect,
  formatPrice,
}) {
  const [search, setSearch] = useState('');

  const available = useMemo(
    () => menuItems.filter((m) => m.available && !existingIds.has(m._id)),
    [menuItems, existingIds],
  );

  const filtered = useMemo(
    () => filterMenuItems(available, search),
    [available, search],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[var(--pos-panel)] border border-slate-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/60 shrink-0">
          <div>
            <h3 className="text-base font-bold text-[var(--pos-text-primary)]">Add Item</h3>
            <p className="text-xs text-slate-500 mt-0.5">Tap to add to order</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu items…"
              className="w-full bg-[var(--pos-surface-inset)] border border-slate-700 text-[var(--pos-text-primary)] rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder-slate-600"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3">
          {available.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No additional items available
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No items match your search
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-700 bg-[var(--pos-surface-inset)] hover:border-slate-600 hover:bg-slate-800/60 transition active:scale-[0.99] text-left"
                >
                  {/* Item image */}
                  <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                    {item.images?.[0]?.url || item.image ? (
                      <img
                        src={item.images?.[0]?.url || item.image}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                    )}
                  </div>

                  {/* Item details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--pos-text-primary)] truncate">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <span className="text-sm font-bold text-amber-400 shrink-0">
                    {formatPrice?.(item.price) || item.price}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cancel footer */}
        <div className="px-4 pb-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Touch-friendly table picker modal.
 * Shows tables in a grid with availability status.
 */
export function TablePickerModal({
  open,
  onClose,
  tables = [],
  occupancyMap = new Map(),
  selectedTableId,
  onSelect,
  currentOrderId,
}) {
  if (!open) return null;

  const activeTables = tables.filter((t) => t.active !== false);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[var(--pos-panel)] border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/60 shrink-0">
          <div>
            <h3 className="text-base font-bold text-[var(--pos-text-primary)]">Select Table</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Occupied tables are disabled
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-[var(--pos-text-primary)] hover:bg-slate-700 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tables grid */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {activeTables.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No tables configured
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {activeTables.map((table) => {
                const tableId = String(table._id);
                const occupancy = occupancyMap.get(tableId);
                const isBusy = occupancy && String(occupancy.orderId) !== String(currentOrderId);
                const isSelected = selectedTableId === tableId;

                return (
                  <button
                    key={tableId}
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      onSelect(tableId, table.label || '');
                      onClose();
                    }}
                    className={`flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 transition-all min-h-[4.5rem] ${
                      isBusy
                        ? 'border-red-500/30 bg-red-500/5 text-slate-600 cursor-not-allowed'
                        : isSelected
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300 shadow-lg shadow-amber-500/10'
                          : 'border-slate-700 bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] hover:border-slate-600 hover:bg-slate-800/60 active:scale-[0.98]'
                    }`}
                  >
                    <span className={`text-lg font-bold ${isSelected ? 'text-amber-300' : ''}`}>
                      {table.label}
                    </span>
                    {isBusy && (
                      <span className="text-[10px] text-red-400 font-medium">In use</span>
                    )}
                    {isSelected && !isBusy && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 shrink-0 space-y-2">
          {selectedTableId && (
            <button
              type="button"
              onClick={() => {
                onSelect('', '');
                onClose();
              }}
              className="w-full py-2.5 rounded-xl border border-slate-600 text-slate-400 font-medium text-sm transition hover:bg-slate-800"
            >
              Clear Selection
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-[var(--pos-text-primary)] font-semibold text-sm transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
