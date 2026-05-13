/** Aligns with POS `receiptPolicy.js` — admin form helpers only */

export const RECEIPT_PRINT_AT_OPTIONS = [
  { value: 'placement', label: 'When order is placed (checkout)' },
  { value: 'preparing', label: 'When sent to kitchen (preparing)' },
  { value: 'ready', label: 'When order is ready' },
  { value: 'completed', label: 'When order is completed' },
  { value: 'none', label: 'Never print automatically' },
];

const VALID = new Set(RECEIPT_PRINT_AT_OPTIONS.map((o) => o.value));

export const DEFAULT_RECEIPT_PRINT_AT_BY_ORDER_TYPE = {
  'dine-in': 'completed',
  takeaway: 'placement',
  'uber-eats': 'placement',
  pickme: 'placement',
};

export function mergeReceiptPrintAtByOrderType(settings) {
  const base = { ...DEFAULT_RECEIPT_PRINT_AT_BY_ORDER_TYPE };
  const map = settings?.receiptPrintAtByOrderType;
  if (map && typeof map === 'object' && !Array.isArray(map) && Object.keys(map).length > 0) {
    return { ...base, ...map };
  }
  const legacy = settings?.receiptPrintAtStatus;
  if (legacy && VALID.has(legacy)) {
    return {
      'dine-in': legacy,
      takeaway: legacy,
      'uber-eats': legacy,
      pickme: legacy,
    };
  }
  return base;
}
