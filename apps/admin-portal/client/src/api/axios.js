import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const url = String(config.url || '');
  // Never scope store CRUD by the header store selector (prevents wrong-store updates).
  const isStoreById = /\/stores\/[a-f0-9]{24}$/i.test(url);
  const selectedStore = localStorage.getItem('admin_selected_store');
  // Allow per-request x-store-id (e.g. 'all') without being overwritten by localStorage
  if (
    !isStoreById
    && (config.headers['x-store-id'] === undefined || config.headers['x-store-id'] === null)
  ) {
    if (selectedStore) {
      config.headers['x-store-id'] = selectedStore;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err.config;
    const reqUrl = cfg?.url || '';
    const isLoginCall = reqUrl.includes('/auth/login');
    const isRefreshCall = reqUrl.includes('/auth/refresh');

    if (err.response?.status === 401 && !isLoginCall && !isRefreshCall && cfg && !cfg._retry) {
      cfg._retry = true;
      const refreshToken = localStorage.getItem('admin_refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { token, refreshToken: newRefreshToken, user } = response.data;

          localStorage.setItem('admin_token', token);
          if (newRefreshToken) localStorage.setItem('admin_refresh_token', newRefreshToken);
          localStorage.setItem('admin_user', JSON.stringify(user));

          cfg.headers.Authorization = `Bearer ${token}`;
          return api(cfg);
        } catch (refreshErr) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_refresh_token');
          localStorage.removeItem('admin_user');
          window.location.href = '/login';
          return Promise.reject(err);
        }
      }

      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
      return Promise.reject(err);
    } else if (err.response?.status === 401) {
      if (!isLoginCall) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_refresh_token');
        localStorage.removeItem('admin_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
