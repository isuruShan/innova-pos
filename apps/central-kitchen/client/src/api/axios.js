import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ck_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  const url = String(config.url || '');
  const isStoreById = /\/stores\/[a-f0-9]{24}$/i.test(url);
  const selectedStore = localStorage.getItem('ck_selected_store');
  
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
      const refreshToken = localStorage.getItem('ck_refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { token, refreshToken: newRefreshToken, user } = response.data;

          localStorage.setItem('ck_token', token);
          if (newRefreshToken) localStorage.setItem('ck_refresh_token', newRefreshToken);
          localStorage.setItem('ck_user', JSON.stringify(user));

          cfg.headers.Authorization = `Bearer ${token}`;
          return api(cfg);
        } catch (refreshErr) {
          localStorage.removeItem('ck_token');
          localStorage.removeItem('ck_refresh_token');
          localStorage.removeItem('ck_user');
          window.location.href = '/login';
          return Promise.reject(err);
        }
      }

      localStorage.removeItem('ck_token');
      localStorage.removeItem('ck_refresh_token');
      localStorage.removeItem('ck_user');
      window.location.href = '/login';
      return Promise.reject(err);
    } else if (err.response?.status === 401) {
      if (!isLoginCall) {
        localStorage.removeItem('ck_token');
        localStorage.removeItem('ck_refresh_token');
        localStorage.removeItem('ck_user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
