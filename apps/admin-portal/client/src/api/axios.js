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
  const selectedStore = localStorage.getItem('admin_selected_store');
  // Allow per-request x-store-id (e.g. 'all') without being overwritten by localStorage
  if (config.headers['x-store-id'] === undefined || config.headers['x-store-id'] === null) {
    if (selectedStore) {
      config.headers['x-store-id'] = selectedStore;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const reqUrl = err.config?.url || '';
    const isLoginCall = reqUrl.includes('/auth/login');
    // Let login page handle invalid credentials (toast/message) instead of hard redirect.
    if (err.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
