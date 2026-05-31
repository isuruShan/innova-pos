import axios from 'axios';

/**
 * Public-web API runs on port 5002 in dev (same paths as production: /applications, /newsletter, /contact).
 * Override with VITE_PUBLIC_WEB_API_URL when the backend URL differs.
 */
let baseURL = import.meta.env.VITE_PUBLIC_WEB_API_URL;
if (!baseURL) {
  baseURL = import.meta.env.DEV ? 'http://localhost:5002' : '/api';
}

// Normalize baseURL: if it's a full origin like https://www.cafinity.io without /api, append /api
if (baseURL.startsWith('http') && !baseURL.includes('/api') && !baseURL.includes('localhost:5002')) {
  baseURL = `${baseURL.replace(/\/$/, '')}/api`;
}

const api = axios.create({ baseURL });
export default api;
