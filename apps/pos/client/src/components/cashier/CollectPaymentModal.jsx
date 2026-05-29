import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '../../utils/format';
import OrderTypeBadge from '../OrderTypeBadge';
import { useBranding } from '../../context/BrandingContext';

function formatMethodLabel(method) {
  const label = String(method || '').replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function SummaryRow({ label, value, accent = false }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between items-baseline gap-3 text-sm text-slate-400">
      <span>{label}</span>
      <span className={`tabular-nums ${accent ? 'text-green-400' : 'text-slate-300'}`}>{value}</span>
    </div>
  );
}

export default function CollectPaymentModal({
  open,
  onClose,
  onConfirm,
  total,
  availablePaymentMethods = ['cash'],
  confirmLabel = 'Confirm & print',
  isPending = false,
  orderNumber = null,
  orderType = null,
  tableNumber = '',
  reference = '',
  items = [],
  subtotal = null,
  discountTotal = null,
  taxAmount = null,
  serviceFeeAmount = null,
  contextNote = null,
  initialPaymentType = null,
  cashDenominations = null,
}) {
  const branding = useBranding();
  const [paymentType, setPaymentType] = useState(initialPaymentType || availablePaymentMethods[0] || 'cash');
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [addedNotes, setAddedNotes] = useState([]);

  useEffect(() => {
    if (!open) return;
    setPaymentType(initialPaymentType || availablePaymentMethods[0] || 'cash');
    setCashReceivedInput(Number(total || 0).toFixed(2));
    setAddedNotes([]);
  }, [open, total, availablePaymentMethods, initialPaymentType]);

  const resolvedDenominations = useMemo(() => {
    if (cashDenominations && cashDenominations.length > 0) {
      return cashDenominations;
    }
    if (branding?.countryIso === 'LK' || branding?.currency === 'LKR') {
      return [5000, 2000, 1000, 500, 200, 100, 50, 20];
    }
    return [100, 50, 20, 10, 5, 1];
  }, [cashDenominations, branding?.countryIso, branding?.currency]);

  const handleAddNote = (val) => {
    const next = [...addedNotes, val];
    setAddedNotes(next);
    const sum = next.reduce((a, b) => a + b, 0);
    setCashReceivedInput(sum.toFixed(2));
  };

  const handleRemoveNote = (idx) => {
    const next = addedNotes.filter((_, i) => i !== idx);
    setAddedNotes(next);
    const sum = next.reduce((a, b) => a + b, 0);
    setCashReceivedInput(next.length > 0 ? sum.toFixed(2) : '');
  };

  const handleInputChange = (e) => {
    setCashReceivedInput(e.target.value);
    setAddedNotes([]);
  };

  const parsedReceiving = parseFloat(String(cashReceivedInput).replace(/,/g, ''));
  const receivingAmount = Number.isFinite(parsedReceiving) ? parsedReceiving : Number(total || 0);
  const cashChange =
    paymentType === 'cash' && receivingAmount >= Number(total || 0)
      ? receivingAmount - Number(total || 0)
      : null;
  const cashBalanceDue =
    paymentType === 'cash' && receivingAmount < Number(total || 0)
      ? Number(total || 0) - receivingAmount
      : null;

  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    [items],
  );

  if (!open) return null;

  const handleConfirm = () => {
    const cashTender =
      paymentType === 'cash' && Number.isFinite(parsedReceiving) ? parsedReceiving : undefined;
    onConfirm?.({
      paymentType,
      paymentAmount: Number(total || 0),
      cashTender,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-[var(--pos-panel)] border border-slate-600/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/50 max-h-[92vh] overflow-y-auto">
        <h3 className="text-[var(--pos-text-primary)] font-bold text-xl sm:text-2xl tracking-tight">
          Collect payment
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          {orderNumber != null && (
            <span className="font-mono text-amber-400 font-bold">
              #{String(orderNumber).padStart(3, '0')}
            </span>
          )}
          {orderType && (
            <OrderTypeBadge
              orderType={orderType}
              tableNumber={tableNumber}
              reference={reference}
              size="xs"
            />
          )}
          {itemCount > 0 && (
            <span className="text-slate-500">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {contextNote && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{contextNote}</p>
        )}

        {items.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-700/80 bg-[var(--pos-surface-inset)] overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-700/60 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Order summary
            </div>
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-700/40">
              {items.map((item, index) => (
                <div key={item._id || `${item.name}-${index}`} className="px-4 py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{item.name}</p>
                    {item.variantName && (
                      <p className="text-[11px] text-amber-400/80 truncate">↳ {item.variantName}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">×{item.qty}</p>
                    <p className="text-xs text-slate-300 tabular-nums">
                      {formatCurrency(Number(item.price || 0) * Number(item.qty || 0))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mt-6 mb-2">
          Payment method
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availablePaymentMethods.map((method) => {
            const active = paymentType === method;
            return (
              <button
                key={method}
                type="button"
                onClick={() => {
                  setPaymentType(method);
                  if (method === 'cash') setCashReceivedInput(Number(total || 0).toFixed(2));
                }}
                className={`min-h-[52px] rounded-2xl px-4 text-base font-semibold border-2 transition active:scale-[0.99] ${
                  active
                    ? 'border-amber-500 bg-amber-500/15 text-[var(--pos-selection-text)] ring-2 ring-amber-500/40'
                    : 'border-slate-600 bg-[var(--pos-surface-inset)] text-slate-200 hover:border-slate-500'
                }`}
              >
                {formatMethodLabel(method)}
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl bg-[var(--pos-surface-inset)] border border-slate-700 p-4 space-y-2.5">
          {subtotal != null && (
            <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
          )}
          {discountTotal > 0 && (
            <SummaryRow label="Discounts" value={`-${formatCurrency(discountTotal)}`} accent />
          )}
          {taxAmount > 0 && (
            <SummaryRow label="Tax" value={formatCurrency(taxAmount)} />
          )}
          {serviceFeeAmount > 0 && (
            <SummaryRow label="Service fee" value={formatCurrency(serviceFeeAmount)} />
          )}
          <div className="flex justify-between items-baseline gap-3 pt-2 border-t border-slate-700/80">
            <span className="text-slate-400 text-base">Total due</span>
            <span className="text-[var(--pos-text-primary)] font-bold text-2xl tabular-nums">
              {formatCurrency(total || 0)}
            </span>
          </div>

          {paymentType === 'cash' && (
            <div className="pt-3 border-t border-slate-700/80 space-y-3">
              <label className="block text-sm font-semibold text-slate-300">Amount received</label>
              <input
                type="text"
                inputMode="decimal"
                value={cashReceivedInput}
                onChange={handleInputChange}
                className="w-full min-h-[56px] rounded-2xl border-2 border-slate-600 bg-slate-900/80 text-[var(--pos-text-primary)] text-2xl font-bold text-center tracking-wide px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 tabular-nums"
                placeholder={Number(total || 0).toFixed(2)}
                autoComplete="off"
              />

              {/* Added Notes list (removable) */}
              {addedNotes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 py-1">
                  {addedNotes.map((note, idx) => (
                    <span
                      key={`${note}-${idx}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400"
                    >
                      {branding?.currencySymbol || 'Rs.'} {note}
                      <button
                        type="button"
                        onClick={() => handleRemoveNote(idx)}
                        className="hover:text-red-400 font-bold ml-0.5 focus:outline-none"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAddedNotes([]);
                      setCashReceivedInput('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-350 font-semibold px-2 py-1 focus:outline-none ml-auto"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Banks Notes touch grid */}
              <div className="space-y-1.5 pt-1.5">
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Quick notes</span>
                <div className="grid grid-cols-4 gap-2">
                  {resolvedDenominations.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => handleAddNote(note)}
                      className="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700/80 active:scale-95 border border-slate-700/60 hover:border-amber-500/50 text-slate-300 hover:text-white text-sm font-bold transition flex items-center justify-center gap-0.5 shadow-sm focus:outline-none"
                    >
                      <span className="text-[10px] text-slate-500 font-normal">{branding?.currencySymbol || 'Rs.'}</span>
                      <span>{note}</span>
                    </button>
                  ))}
                </div>
              </div>

              {cashChange != null && (
                <div className="flex justify-between items-center text-lg bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3">
                  <span className="text-green-300 font-medium">Change due</span>
                  <span className="text-green-400 font-bold text-xl tabular-nums">
                    {formatCurrency(cashChange)}
                  </span>
                </div>
              )}
              {cashBalanceDue != null && (
                <div className="flex justify-between items-center text-lg bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3">
                  <span className="text-amber-200 font-medium">Balance due</span>
                  <span className="text-amber-300 font-bold text-xl tabular-nums">
                    {formatCurrency(cashBalanceDue)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 min-h-[54px] rounded-2xl border-2 border-slate-600 text-slate-200 text-lg font-semibold hover:bg-slate-800/80 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || (paymentType === 'cash' && cashBalanceDue != null)}
            className="flex-1 min-h-[54px] rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white text-lg font-bold shadow-lg shadow-green-500/25 transition"
          >
            {isPending ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
