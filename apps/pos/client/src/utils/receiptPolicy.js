/**
 * Merchant-configured timing for automatic receipt printing (tenant Branding settings).
 * Values: none | placement | preparing | ready | completed
 */

export const RECEIPT_PRINT_AT_OPTIONS = [
  { value: 'placement', label: 'When order is placed (checkout)' },
  { value: 'preparing', label: 'When sent to kitchen (preparing)' },
  { value: 'ready', label: 'When order is ready' },
  { value: 'completed', label: 'When order is completed' },
  { value: 'none', label: 'Never print automatically' },
];

const VALID = new Set(RECEIPT_PRINT_AT_OPTIONS.map((o) => o.value));

export function normalizedReceiptPrintAt(branding) {
  const v = branding?.receiptPrintAtStatus;
  if (v && VALID.has(v)) return v;
  return 'placement';
}

/** Print right after successful checkout on New Order */
export function shouldPrintReceiptOnOrderCreated(branding) {
  return normalizedReceiptPrintAt(branding) === 'placement';
}

/** Print after a status update when the order's new status matches the configured milestone */
export function shouldPrintReceiptForUpdatedOrder(branding, order) {
  const mode = normalizedReceiptPrintAt(branding);
  if (mode === 'none' || mode === 'placement') return false;
  return order?.status === mode;
}
