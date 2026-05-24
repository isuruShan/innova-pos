let currencySymbol = 'Rs.';
let currencyCode = 'LKR';

export function setMerchantCurrencyFormat({ currencySymbol: sym, currency }) {
  if (sym) currencySymbol = sym;
  if (currency) currencyCode = currency;
}

export const formatCurrency = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return `${currencySymbol} 0.00`;
  return `${currencySymbol} ${(Math.round(x * 100) / 100).toFixed(2)}`;
};

export const formatPrice = formatCurrency;

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const PAYMENT_TYPE_LABELS = {
  cash: 'Cash',
  card: 'Card',
  online: 'Online',
  bank_transfer: 'Bank transfer',
  pending: 'Pending',
  unknown: 'Other',
};

/**
 * Get display price for a menu item, considering default variant.
 * @param {Object} item - Menu item with price, hasVariants, variants, defaultVariantId
 * @returns {{ price: number, prefix: string, hasVariants: boolean }}
 */
export function getItemDisplayPrice(item) {
  if (!item) return { price: 0, prefix: '', hasVariants: false };
  
  if (item.hasVariants && item.variants?.length > 0) {
    const availableVariants = item.variants.filter(v => v.available !== false);
    if (availableVariants.length > 0) {
      // Check for default variant
      const defaultVariant = item.defaultVariantId
        ? availableVariants.find(v => String(v._id) === String(item.defaultVariantId))
        : null;
      
      if (defaultVariant) {
        return { price: Number(defaultVariant.price), prefix: '', hasVariants: true };
      }
      // Show lowest price with "from" prefix
      const prices = availableVariants.map(v => Number(v.price)).filter(p => !isNaN(p));
      return { price: Math.min(...prices), prefix: 'from ', hasVariants: true };
    }
  }
  
  return { price: Number(item.price) || 0, prefix: '', hasVariants: false };
}

/** Human-readable payment method for POS / session summaries. */
export function formatPaymentTypeLabel(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  if (PAYMENT_TYPE_LABELS[s]) return PAYMENT_TYPE_LABELS[s];
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
