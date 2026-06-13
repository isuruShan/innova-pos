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
  onPrintSplitReceipt = null, // Callback to print individual split receipt
}) {
  const branding = useBranding();
  const { selectedStore } = useStoreContext();
  const [splitMode, setSplitMode] = useState('equal'); // 'equal', 'custom', 'item'
  const [payments, setPayments] = useState([]); // Array of { paymentType, amount, itemsPaid }
  
  // Equal Split Mode States
  const [numSplits, setNumSplits] = useState(2);
  
  // Custom Mode States
  const [currentAmountInput, setCurrentAmountInput] = useState('');
  
  // Item Selection Mode States
  const [selectedItems, setSelectedItems] = useState({}); // { [itemId]: qtySelected }
  const [currentPaymentType, setCurrentPaymentType] = useState(availablePaymentMethods[0] || 'cash');

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
    setSelectedItems({});
    setCurrentPaymentType(availablePaymentMethods[0] || 'cash');
  }, [open, total, availablePaymentMethods]);

  // Proportional calculations for individual item checkout
  const originalSubtotal = subtotal || items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  const getSelectedItemsCalculations = useMemo(() => {
    let sub = 0;
    const selectedList = [];
    Object.entries(selectedItems).forEach(([itemId, qty]) => {
      const item = items.find(i => i.menuItem === itemId || i._id === itemId);
      if (item && qty > 0) {
        sub += item.price * qty;
        selectedList.push({ itemId, qty });
      }
    });

    const ratio = originalSubtotal > 0 ? sub / originalSubtotal : 0;
    const itemDiscount = discountTotal * ratio;
    const itemTax = taxAmount * ratio;
    const itemService = serviceFeeAmount * ratio;
    const itemTotal = Math.max(0, sub - itemDiscount + itemTax + itemService);

    return {
      subtotal: sub,
      discount: itemDiscount,
      tax: itemTax,
      serviceFee: itemService,
      total: itemTotal,
      itemsPaid: selectedList,
    };
  }, [selectedItems, items, originalSubtotal, discountTotal, taxAmount, serviceFeeAmount]);

  // Check how many of each item is remaining to be paid
  const remainingItemQuantities = useMemo(() => {
    const counts = {};
    items.forEach(item => {
      const id = item.menuItem || item._id;
      counts[id] = item.qty;
    });

    // Subtract quantities already paid in previous split rows
    payments.forEach(p => {
      (p.itemsPaid || []).forEach(ip => {
        if (counts[ip.itemId] !== undefined) {
          counts[ip.itemId] = Math.max(0, counts[ip.itemId] - ip.qty);
        }
      });
    });

    return counts;
  }, [items, payments]);

  const handleAddEqualPayment = (index, amount) => {
    // Collect all equal parts sequentially
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

  const handleAddItemPayment = () => {
    const calcs = getSelectedItemsCalculations;
    if (calcs.total <= 0) {
      alert('Select at least one item to pay');
      return;
    }

    setPayments(prev => [
      ...prev,
      {
        paymentType: currentPaymentType,
        amount: Number(calcs.total.toFixed(2)),
        itemsPaid: calcs.itemsPaid,
      }
    ]);

    // Reset selected items
    setSelectedItems({});
  };

  const handleRemovePayment = (index) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemQtyChange = (itemId, change, max) => {
    setSelectedItems(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(max, current + change));
      return { ...prev, [itemId]: next };
    });
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
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-black/80 flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="w-full max-w-4xl bg-[#0F172A] border border-slate-700 rounded-none p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row gap-6 max-h-[95vh] overflow-y-auto">
        
        {/* Left Side: Order items & Payment Splits status */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white font-bold text-xl sm:text-2xl tracking-tight">Split Bill</h3>
              <p className="text-xs text-slate-400 mt-1">
                Order #{orderNumber} {tableNumber && `• Table ${tableNumber}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Split Mode Tabs */}
          <div className="flex border-b border-slate-800 mt-4">
            <button
              onClick={() => { setSplitMode('equal'); setPayments([]); }}
              className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition ${
                splitMode === 'equal' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Split Equally
            </button>
            <button
              onClick={() => { setSplitMode('custom'); setPayments([]); }}
              className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition ${
                splitMode === 'custom' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Custom Amounts
            </button>
            <button
              onClick={() => { setSplitMode('item'); setPayments([]); }}
              className={`py-2.5 px-4 font-semibold text-sm border-b-2 transition ${
                splitMode === 'item' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Pay by Item
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 mt-4 overflow-y-auto min-h-[200px] max-h-[350px] pr-1">
            {splitMode === 'equal' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-slate-300">Number of splits:</label>
                  <div className="flex items-center border border-slate-700 bg-slate-900 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setNumSplits(prev => Math.max(2, prev - 1))}
                      className="px-3 py-1.5 text-slate-400 hover:text-white font-bold"
                    >
                      -
                    </button>
                    <span className="px-4 py-1.5 text-white font-bold font-mono">{numSplits}</span>
                    <button
                      type="button"
                      onClick={() => setNumSplits(prev => Math.min(20, prev + 1))}
                      className="px-3 py-1.5 text-slate-400 hover:text-white font-bold"
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
                      <div key={i} className="flex justify-between items-center p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                        <span className="text-sm font-semibold text-slate-300">Guest {i + 1} Share</span>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold font-mono text-white">{formatCurrency(share)}</span>
                          {isCollected ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                              <CheckCircle size={12} />
                              {formatMethodLabel(payments[i].paymentType)}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddEqualPayment(i, share)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition"
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
                      className="w-full h-11 border border-slate-700 bg-slate-900 text-white font-bold rounded-xl px-3 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    onClick={handleAddCustomPayment}
                    className="h-11 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center gap-1 transition self-end"
                  >
                    <Plus size={16} />
                    Add Split
                  </button>
                </div>
              </div>
            )}

            {splitMode === 'item' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Tally which items are being paid right now by this guest:</p>
                
                <div className="space-y-2 border border-slate-800 rounded-xl bg-slate-900/40 p-2 divide-y divide-slate-800">
                  {items.map(item => {
                    const id = item.menuItem || item._id;
                    const maxQty = remainingItemQuantities[id] || 0;
                    const currentSelected = selectedItems[id] || 0;
                    
                    if (maxQty === 0 && currentSelected === 0) return null;

                    return (
                      <div key={id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-200 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(item.price)} each • {maxQty} remaining
                          </p>
                        </div>

                        <div className="flex items-center border border-slate-700 bg-slate-900 rounded-lg shrink-0">
                          <button
                            type="button"
                            onClick={() => handleItemQtyChange(id, -1, maxQty)}
                            className="px-2.5 py-1 text-slate-400 hover:text-white font-bold text-sm"
                          >
                            -
                          </button>
                          <span className="px-3 py-1 text-white font-bold font-mono text-xs">{currentSelected}</span>
                          <button
                            type="button"
                            onClick={() => handleItemQtyChange(id, 1, maxQty)}
                            className="px-2.5 py-1 text-slate-400 hover:text-white font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected sub-bill totals review */}
                {getSelectedItemsCalculations.total > 0 && (
                  <div className="mt-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Subtotal Selection</span>
                      <span>{formatCurrency(getSelectedItemsCalculations.subtotal)}</span>
                    </div>
                    {getSelectedItemsCalculations.discount > 0 && (
                      <div className="flex justify-between text-xs text-green-400">
                        <span>Selected Discounts</span>
                        <span>-{formatCurrency(getSelectedItemsCalculations.discount)}</span>
                      </div>
                    )}
                    {getSelectedItemsCalculations.tax > 0 && (
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Selected Taxes</span>
                        <span>{formatCurrency(getSelectedItemsCalculations.tax)}</span>
                      </div>
                    )}
                    {getSelectedItemsCalculations.serviceFee > 0 && (
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Selected Service Fees</span>
                        <span>{formatCurrency(getSelectedItemsCalculations.serviceFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-800 text-sm font-bold text-white">
                      <span>Total for Selection</span>
                      <span className="text-amber-400 text-base">{formatCurrency(getSelectedItemsCalculations.total)}</span>
                    </div>
                    
                    <button
                      onClick={handleAddItemPayment}
                      className="w-full mt-2 h-10 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition"
                    >
                      Collect Selected Items
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment Method Selector (For current additions) */}
          {splitMode !== 'equal' && remainingBalance > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Active Payment Method
              </span>
              <div className="flex flex-wrap gap-2">
                {availablePaymentMethods.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCurrentPaymentType(m)}
                    className={`h-9 px-4 rounded-xl text-xs font-bold border transition ${
                      currentPaymentType === m
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
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
        <div className="w-full md:w-80 bg-slate-900/60 border border-slate-800 p-4 flex flex-col rounded-xl shrink-0">
          <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            Collected Transactions
          </h4>
          
          <div className="flex-1 overflow-y-auto space-y-2 mt-3 min-h-[150px]">
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-8">No payments registered yet</p>
            ) : (
              payments.map((p, idx) => (
                <div key={idx} className="p-3 bg-[#0F172A] border border-slate-800 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
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
                        className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title="Print receipt for this split"
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        onClick={() => handleRemovePayment(idx)}
                        className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
                        title="Delete split"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">
                      {p.itemsPaid?.length > 0 ? `${p.itemsPaid.length} selected item(s)` : 'General split'}
                    </span>
                    <span className="text-sm font-bold text-white font-mono">{formatCurrency(p.amount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Balancing Ledger */}
          <div className="border-t border-slate-800 pt-3 mt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Total Due</span>
              <span className="font-mono text-sm text-slate-200">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-green-400">
              <span>Paid So Far</span>
              <span className="font-mono text-sm font-bold">-{formatCurrency(totalCollected)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-800 text-sm font-bold text-white">
              <span>Remaining Balance</span>
              <span className={`font-mono text-lg ${remainingBalance <= 0.02 ? 'text-green-400' : 'text-amber-500'}`}>
                {formatCurrency(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Confirm controls */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleConfirmAll}
              disabled={remainingBalance > 0.02}
              className="w-full h-11 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/10"
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
