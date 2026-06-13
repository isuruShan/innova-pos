import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Printer, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { useBranding } from '../../context/BrandingContext';
import { useStoreContext } from '../../context/StoreContext';
import { printSplitReceipt } from '../../utils/receiptPrint';

function formatMethodLabel(method) {
  const label = String(method || '').replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function SplitBillModal({
  open,
  onClose,
  onConfirm,
  total,
  items = [],
  availablePaymentMethods = ['cash'],
  orderNumber = null,
  tableNumber = '',
  reference = '',
  subtotal = 0,
  discountTotal = 0,
  taxAmount = 0,
  serviceFeeAmount = 0,
  onPrintSplitReceipt = null,
}) {
  const branding = useBranding();
  const { selectedStore } = useStoreContext();
  const [splitMode, setSplitMode] = useState('equal'); // 'equal', 'custom'
  const [payments, setPayments] = useState([]); // Array of { paymentType, amount, itemsPaid }
  
  // Equal Split Mode States
  const [numSplits, setNumSplits] = useState(2);
  
  // Custom Mode States
  const [currentAmountInput, setCurrentAmountInput] = useState('');
  
  const [currentPaymentType, setCurrentPaymentType] = useState(availablePaymentMethods[0] || 'cash');

  // Receipt printing option: 'separate' (print individual split bills) or 'single' (print single consolidated bill)
  const [printModeOption, setPrintModeOption] = useState('separate');

  // Total collected so far
  const totalCollected = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments]);

  const remainingBalance = Math.max(0, total - totalCollected);

  // Initialize/Reset states
  useEffect(() => {
    if (!open) return;
    setPayments([]);
    setSplitMode('equal');
    setNumSplits(2);
    setCurrentAmountInput('');
    setCurrentPaymentType(availablePaymentMethods[0] || 'cash');
    setPrintModeOption('separate');
  }, [open, total, availablePaymentMethods]);

  const handleAddEqualPayment = (index, amount) => {
    const currentType = currentPaymentType;
    setPayments(prev => [
      ...prev,
      {
        paymentType: currentType,
        amount: Number(amount.toFixed(2)),
        itemsPaid: [],
      }
    ]);
  };

  const handleAddCustomPayment = () => {
    const val = parseFloat(currentAmountInput);
    if (!Number.isFinite(val) || val <= 0 || val > remainingBalance + 0.01) {
      alert(`Please enter a valid amount up to ${formatCurrency(remainingBalance)}`);
      return;
    }
    setPayments(prev => [
      ...prev,
      {
        paymentType: currentPaymentType,
        amount: Number(val.toFixed(2)),
        itemsPaid: [],
      }
    ]);
    setCurrentAmountInput('');
  };

  const handleRemovePayment = (index) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirmAll = () => {
    if (remainingBalance > 0.02) {
      alert(`Please collect the remaining balance of ${formatCurrency(remainingBalance)} first.`);
      return;
    }
    onConfirm?.({
      paymentType: 'split',
      paymentAmount: total,
      payments,
      printMode: printModeOption,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="w-full max-w-4xl bg-[var(--pos-panel)] border border-[color-mix(in_srgb,var(--pos-text-primary)_12%,transparent)] rounded-none p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row gap-6 max-h-[95vh] overflow-y-auto">
        
        {/* Left Side: Order items & Payment Splits status */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-[var(--pos-text-primary)] font-bold text-xl sm:text-2xl tracking-tight">Split Bill</h3>
              <p className="text-xs text-[var(--pos-text-secondary)] mt-1">
                Order #{orderNumber} {tableNumber && `• Table ${tableNumber}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/20 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Split Mode Tabs */}
          <div className="flex border-b border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)] mt-4">
            <button
              onClick={() => { setSplitMode('equal'); setPayments([]); }}
              className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition cursor-pointer ${
                splitMode === 'equal' ? 'border-amber-500 text-amber-500' : 'border-transparent text-[var(--pos-text-muted)] hover:text-[var(--pos-text-primary)]'
              }`}
            >
              Split Equally
            </button>
            <button
              onClick={() => { setSplitMode('custom'); setPayments([]); }}
              className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition cursor-pointer ${
                splitMode === 'custom' ? 'border-amber-500 text-amber-500' : 'border-transparent text-[var(--pos-text-muted)] hover:text-[var(--pos-text-primary)]'
              }`}
            >
              Custom Amounts
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 mt-4 overflow-y-auto min-h-[200px] max-h-[350px] pr-1">
            {splitMode === 'equal' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-[var(--pos-text-secondary)]">Number of splits:</label>
                  <div className="flex items-center border border-[color-mix(in_srgb,var(--pos-text-primary)_12%,transparent)] bg-[var(--pos-surface-inset)] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setNumSplits(prev => Math.max(2, prev - 1))}
                      className="px-3 py-1.5 text-slate-500 hover:text-[var(--pos-text-primary)] font-bold cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-4 py-1.5 text-[var(--pos-text-primary)] font-bold font-mono">{numSplits}</span>
                    <button
                      type="button"
                      onClick={() => setNumSplits(prev => Math.min(20, prev + 1))}
                      className="px-3 py-1.5 text-slate-500 hover:text-[var(--pos-text-primary)] font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {Array.from({ length: numSplits }).map((_, i) => {
                    const share = total / numSplits;
                    const isCollected = payments[i] !== undefined;
                    return (
                      <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)] bg-[var(--pos-surface-inset)]">
                        <span className="text-sm font-semibold text-[var(--pos-text-secondary)]">Guest {i + 1} Share</span>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold font-mono text-[var(--pos-text-primary)]">{formatCurrency(share)}</span>
                          {isCollected ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 dark:text-green-400">
                              <CheckCircle size={12} />
                              {formatMethodLabel(payments[i].paymentType)}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddEqualPayment(i, share)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-[var(--pos-selection-text)] text-xs font-bold rounded-lg transition cursor-pointer"
                            >
                              Pay Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {splitMode === 'custom' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Enter Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentAmountInput}
                      onChange={(e) => setCurrentAmountInput(e.target.value)}
                      placeholder={remainingBalance.toFixed(2)}
                      className="w-full h-11 border border-[color-mix(in_srgb,var(--pos-text-primary)_12%,transparent)] bg-[var(--pos-surface-inset)] text-[var(--pos-text-primary)] font-bold rounded-xl px-3 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    onClick={handleAddCustomPayment}
                    className="h-11 px-4 bg-amber-500 hover:bg-amber-400 text-[var(--pos-selection-text)] font-bold rounded-xl flex items-center gap-1 transition self-end cursor-pointer"
                  >
                    <Plus size={16} />
                    Add Split
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Selector (For current additions) */}
          {splitMode !== 'equal' && remainingBalance > 0 && (
            <div className="mt-4 pt-4 border-t border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)]">
              <span className="block text-xs font-bold text-[var(--pos-text-muted)] uppercase tracking-wide mb-2">
                Active Payment Method
              </span>
              <div className="flex flex-wrap gap-2">
                {availablePaymentMethods.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCurrentPaymentType(m)}
                    className={`h-9 px-4 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      currentPaymentType === m
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'border-slate-600 bg-[var(--pos-surface-inset)] text-slate-700 dark:text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    {formatMethodLabel(m)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Ledger summary of collected payments */}
        <div className="w-full md:w-80 bg-[var(--pos-surface-inset)] border border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)] p-4 flex flex-col rounded-xl shrink-0">
          <h4 className="text-sm font-bold text-[var(--pos-text-secondary)] uppercase tracking-wider border-b border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)] pb-2">
            Collected Transactions
          </h4>
          
          <div className="flex-1 overflow-y-auto space-y-2 mt-3 min-h-[150px]">
            {payments.length === 0 ? (
              <p className="text-xs text-[var(--pos-text-muted)] italic text-center py-8">No payments registered yet</p>
            ) : (
              payments.map((p, idx) => (
                <div key={idx} className="p-3 bg-[var(--pos-panel)] border border-[color-mix(in_srgb,var(--pos-text-primary)_8%,transparent)] rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-[var(--pos-text-secondary)] uppercase tracking-wide">
                      {idx + 1}. {formatMethodLabel(p.paymentType)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          try {
                            printSplitReceipt({
                              orderNumber,
                              tableNumber,
                              reference,
                              subtotal,
                              discountTotal,
                              taxAmount,
                              serviceFeeAmount,
                              items,
                              totalAmount: total,
                            }, p, { branding, store: selectedStore });
                          } catch (err) {
                            console.error('[Split Print] Error:', err);
                            alert('Failed to print split receipt');
                          }
                        }}
                        className="p-1 rounded text-slate-500 hover:text-[var(--pos-text-primary)] hover:bg-slate-700/50 transition cursor-pointer"
                        title="Print receipt for this split"
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        onClick={() => handleRemovePayment(idx)}
                        className="p-1 rounded text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-700/50 transition cursor-pointer"
                        title="Delete split"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-[var(--pos-text-muted)]">
                      {p.itemsPaid?.length > 0 ? `${p.itemsPaid.length} selected item(s)` : 'General split'}
                    </span>
                    <span className="text-sm font-bold text-[var(--pos-text-primary)] font-mono">{formatCurrency(p.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Balancing Ledger */}
          <div className="border-t border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)] pt-3 mt-3 space-y-2 text-xs">
            <div className="flex justify-between text-[var(--pos-text-secondary)]">
              <span>Total Due</span>
              <span className="font-mono text-sm text-[var(--pos-text-primary)]">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-green-600 dark:text-green-400">
              <span>Paid So Far</span>
              <span className="font-mono text-sm font-bold">-{formatCurrency(totalCollected)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)] text-sm font-bold text-[var(--pos-text-primary)]">
              <span>Remaining Balance</span>
              <span className={`font-mono text-lg ${remainingBalance <= 0.02 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-500'}`}>
                {formatCurrency(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Print Option Selector */}
          <div className="border-t border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)] pt-3 mt-3">
            <span className="block text-xs font-bold text-[var(--pos-text-muted)] uppercase tracking-wide mb-2">
              Receipt Print Mode
            </span>
            <div className="flex bg-[var(--pos-surface-inset)] p-0.5 rounded-xl border border-[color-mix(in_srgb,var(--pos-text-primary)_10%,transparent)]">
              <button
                type="button"
                onClick={() => setPrintModeOption('separate')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                  printModeOption === 'separate'
                    ? 'bg-amber-500 text-[var(--pos-selection-text)] shadow-sm'
                    : 'text-[var(--pos-text-muted)] hover:text-[var(--pos-text-primary)]'
                }`}
              >
                Separate Bills
              </button>
              <button
                type="button"
                onClick={() => setPrintModeOption('single')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                  printModeOption === 'single'
                    ? 'bg-amber-500 text-[var(--pos-selection-text)] shadow-sm'
                    : 'text-[var(--pos-text-muted)] hover:text-[var(--pos-text-primary)]'
                }`}
              >
                Consolidated Bill
              </button>
            </div>
          </div>

          {/* Confirm controls */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleConfirmAll}
              disabled={remainingBalance > 0.02}
              className="w-full h-11 bg-green-500 hover:bg-green-400 text-[var(--pos-selection-text)] font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/10 cursor-pointer"
            >
              <CheckCircle size={16} />
              Complete Checkout
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
