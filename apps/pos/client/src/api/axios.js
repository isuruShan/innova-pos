import axios from 'axios';
import { isRecoverableNetworkError } from '../offline/http.js';
import { serveOfflineMutation } from '../offline/mutationsOffline.js';
import { cacheSuccessfulGetResponse, readCachedGet } from '../offline/cacheRead.js';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const url = String(config.url || '');
  if (url.includes('/upload') && config.timeout == null) {
    config.timeout = 300_000;
    config.maxContentLength = Infinity;
    config.maxBodyLength = Infinity;
  }
  const token = localStorage.getItem('pos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const selectedStore = localStorage.getItem('pos_selected_store');
  if (config.headers['x-store-id'] === undefined || config.headers['x-store-id'] === null) {
    if (selectedStore) {
      config.headers['x-store-id'] = selectedStore;
    }
  }
  return config;
});

api.interceptors.response.use(
  async (res) => {
    const cfg = res.config;
    if (!cfg.headers?.['x-pos-sync-replay']) {
      try {
        await cacheSuccessfulGetResponse(res);
      } catch (e) {
        console.warn('[pos-offline] Cache write failed', e);
      }
    }
    return res;
  },
  async (err) => {
    const cfg = err.config;
    const reqUrl = cfg?.url || '';
    const isLoginCall = reqUrl.includes('/auth/login');

    if (cfg?.headers?.['x-pos-sync-replay']) {
      return Promise.reject(err);
    }

    if (err.response?.status === 402) {
      const userRaw = localStorage.getItem('pos_user');
      if (userRaw) {
        try {
          const userObj = JSON.parse(userRaw);
          userObj.subscriptionActive = false;
          localStorage.setItem('pos_user', JSON.stringify(userObj));
        } catch (e) {
          // ignore
        }
      }
      window.dispatchEvent(new Event('subscription-inactive'));
      return Promise.reject(err);
    }

    const isRefreshCall = reqUrl.includes('/auth/refresh');
    if (err.response?.status === 401 && !isLoginCall && !isRefreshCall && cfg && !cfg._retry) {
      cfg._retry = true;
      const refreshToken = localStorage.getItem('pos_refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post('/api/auth/refresh', { refreshToken });
          const { token, refreshToken: newRefreshToken, user } = response.data;

          localStorage.setItem('pos_token', token);
          if (newRefreshToken) localStorage.setItem('pos_refresh_token', newRefreshToken);
          localStorage.setItem('pos_user', JSON.stringify(user));

          cfg.headers.Authorization = `Bearer ${token}`;
          return api(cfg);
        } catch (refreshErr) {
          localStorage.removeItem('pos_token');
          localStorage.removeItem('pos_refresh_token');
          localStorage.removeItem('pos_user');
          window.location.href = '/login';
          return Promise.reject(err);
        }
      }

      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_refresh_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
      return Promise.reject(err);
    } else if (err.response?.status === 401) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_refresh_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    if (isRecoverableNetworkError(err)) {
      console.log('[Axios Interceptor] Network error detected, attempting offline mutation:', reqUrl);
      const offlineMutation = await serveOfflineMutation(err);
      if (offlineMutation) {
        console.log('[Axios Interceptor] Offline mutation successful:', offlineMutation);
        return Promise.resolve(offlineMutation);
      }

      if ((cfg?.method || 'get').toLowerCase() === 'get') {
        const cached = await readCachedGet(cfg);
        if (cached != null) {
          return Promise.resolve({
            data: cached,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: cfg,
            request: {},
            _fromOfflineCache: true,
          });
        }
      }
    }

    return Promise.reject(err);
  }
);

export default api;
