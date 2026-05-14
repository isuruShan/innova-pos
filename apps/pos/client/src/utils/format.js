export const formatCurrency = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'Rs 0.00';
  const cents = Math.round(x * 100) / 100;
  return `Rs ${cents.toFixed(2)}`;
};
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

/** Human-readable payment method for POS / session summaries. */
export function formatPaymentTypeLabel(raw) {
  if (raw == null || raw === '') return '—';
  const s = String(raw).trim();
  if (PAYMENT_TYPE_LABELS[s]) return PAYMENT_TYPE_LABELS[s];
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
