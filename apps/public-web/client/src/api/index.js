import axios from 'axios';

/**
 * Public-web API runs on port 5002 in dev (same paths as production: /applications, /newsletter, /contact).
 * Override with VITE_PUBLIC_WEB_API_URL when the backend URL differs.
 */
const baseURL =
  import.meta.env.VITE_PUBLIC_WEB_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5002' : '');

const api = axios.create({ baseURL });
export default api;
