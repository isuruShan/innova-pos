/**
 * Merchant-configured timing for automatic receipt printing (tenant Branding settings).
 * Values: none | placement | preparing | ready | completed
 *
 * `receiptPrintAtByOrderType` (optional): { "dine-in": "completed", takeaway: "placement", ... }
 * Legacy `receiptPrintAtStatus` applies when per-type map is absent.
 */

export const RECEIPT_PRINT_AT_OPTIONS = [
  { value: 'placement', label: 'When order is placed (checkout)' },
  { value: 'preparing', label: 'When sent to kitchen (preparing)' },
  { value: 'ready', label: 'When order is ready' },
  { value: 'completed', label: 'When order is completed' },
  { value: 'none', label: 'Never print automatically' },
];

const VALID = new Set(RECEIPT_PRINT_AT_OPTIONS.map((o) => o.value));

/** Default print milestone per order type (dine-in after meal; others at checkout). */
export const DEFAULT_RECEIPT_PRINT_AT_BY_ORDER_TYPE = {
  'dine-in': 'completed',
  takeaway: 'placement',
  'uber-eats': 'placement',
  pickme: 'placement',
};

export function normalizedReceiptPrintAt(branding) {
  const v = branding?.receiptPrintAtStatus;
  if (v && VALID.has(v)) return v;
  return 'placement';
}

/** Effective milestone for a specific order (uses per-type map when present). */
export function receiptPrintMilestoneForOrder(branding, orderLike) {
  const orderType = orderLike?.orderType || 'dine-in';
  const map = branding?.receiptPrintAtByOrderType;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    const v = map[orderType] ?? map.default;
    if (v && VALID.has(v)) return v;
  }
  return normalizedReceiptPrintAt(branding);
}

/** Merge stored settings with defaults for admin form / client bootstrap. */
export function mergeReceiptPrintAtByOrderType(brandingLike) {
  const base = { ...DEFAULT_RECEIPT_PRINT_AT_BY_ORDER_TYPE };
  const map = brandingLike?.receiptPrintAtByOrderType;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    return { ...base, ...map };
  }
  const legacy = normalizedReceiptPrintAt(brandingLike);
  if (brandingLike?.receiptPrintAtByOrderType == null && brandingLike?.receiptPrintAtStatus != null) {
    return {
      'dine-in': legacy,
      takeaway: legacy,
      'uber-eats': legacy,
      pickme: legacy,
    };
  }
  return base;
}

/** Print right after successful checkout on New Order */
export function shouldPrintReceiptOnOrderCreated(branding, createdOrder) {
  const order = createdOrder || {};
  return receiptPrintMilestoneForOrder(branding, order) === 'placement';
}

/** Print after a status update when the order's new status matches the configured milestone */
export function shouldPrintReceiptForUpdatedOrder(branding, order) {
  const mode = receiptPrintMilestoneForOrder(branding, order);
  if (mode === 'none' || mode === 'placement') return false;
  return order?.status === mode;
}
