/**
 * Cross-app base URLs for Vite clients. Set VITE_* in each app's .env before build.
 * Dev fallbacks match default Vite ports when env is unset.
 */

function normalizeBase(url) {
  const s = String(url ?? '').trim();
  return s ? s.replace(/\/$/, '') : '';
}

function env(key) {
  return typeof import.meta !== 'undefined' ? import.meta.env?.[key] : undefined;
}

function devFallback(port) {
  return env('DEV') ? `http://localhost:${port}` : '';
}

/** POS web app (cashier / manager UI). */
export function getPosUrl() {
  return normalizeBase(env('VITE_POS_URL')) || devFallback(5173);
}

/** Merchant & super-admin portal. */
export function getAdminUrl() {
  return (
    normalizeBase(env('VITE_ADMIN_URL') || env('VITE_ADMIN_PORTAL_URL')) || devFallback(5174)
  );
}

/** Public marketing / signup site. */
export function getPublicWebUrl() {
  return normalizeBase(env('VITE_PUBLIC_WEB_URL')) || 'https://cafinity.io';
}

/** Guest QR table-order SPA (not the POS host). */
export function getQrOrderWebOrigin() {
  return (
    normalizeBase(env('VITE_QR_ORDER_WEB_ORIGIN') || env('VITE_PUBLIC_ORDER_PAGE_ORIGIN')) ||
    devFallback(5180)
  );
}

/** Build a path on another app, e.g. adminUrl('/addons?code=qr_ordering'). */
export function adminPath(path = '/') {
  const base = getAdminUrl();
  if (!base) return '';
  const p = String(path).startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function posPath(path = '/') {
  const base = getPosUrl();
  if (!base) return '';
  const p = String(path).startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
