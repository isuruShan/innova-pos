import axios from 'axios';
import { isRecoverableNetworkError } from '../offline/http.js';
import { serveOfflineMutation } from '../offline/mutationsOffline.js';
import { cacheSuccessfulGetResponse, readCachedGet } from '../offline/cacheRead.js';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
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

    if (err.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    if (isRecoverableNetworkError(err)) {
      const offlineMutation = await serveOfflineMutation(err);
      if (offlineMutation) return Promise.resolve(offlineMutation);

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
