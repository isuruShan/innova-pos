export function isRecoverableNetworkError(err) {
  if (!err || err.response) return false;
  const code = err.code;
  const msg = String(err.message || '');
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    msg === 'Network Error' ||
    msg.includes('Failed to fetch')
  );
}

export function normalizeApiPath(config) {
  const base = config.baseURL || '';
  const path = config.url || '';
  const joined = `${base}${path}`.replace(/\/+/g, '/');
  try {
    const u = new URL(joined, typeof window !== 'undefined' ? window.location.origin : 'http://local');
    return u.pathname + u.search;
  } catch {
    return path;
  }
}

export function cacheKeyForRequest(config) {
  const path = normalizeApiPath(config);
  const store = typeof window !== 'undefined' ? localStorage.getItem('pos_selected_store') || '' : '';
  return `${store}|${config.method?.toUpperCase() || 'GET'}|${path}`;
}
