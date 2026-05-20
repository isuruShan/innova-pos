let currencySymbol = 'Rs.';
let currencyCode = 'LKR';

export function setMerchantCurrencyFormat({ currencySymbol: sym, currency }) {
  if (sym) currencySymbol = sym;
  if (currency) currencyCode = currency;
}

export function getMerchantCurrencyFormat() {
  return { currencySymbol, currencyCode };
}

/** Format amounts using the merchant's branding currency (set via TenantCurrencyProvider). */
export const formatCurrency = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return `${currencySymbol} 0.00`;
  return `${currencySymbol} ${(Math.round(x * 100) / 100).toFixed(2)}`;
};

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
