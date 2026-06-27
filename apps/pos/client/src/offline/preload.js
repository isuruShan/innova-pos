import api from '../api/axios.js';

let isPreloading = false;

export async function preloadOfflineData() {
  if (typeof window === 'undefined') return;
  if (!window.navigator.onLine) return;

  const token = localStorage.getItem('pos_token');
  const store = localStorage.getItem('pos_selected_store');
  if (!token || !store) {
    console.log('[pos-offline] Preloading skipped: User not logged in or store not selected');
    return;
  }

  if (isPreloading) return;
  isPreloading = true;

  console.log('[pos-offline] Preloading product catalogue and store metadata...');

  try {
    await Promise.allSettled([
      api.get('/menu'),
      api.get('/menu/modifier-groups'),
      api.get('/tables'),
      api.get('/promotions'),
      api.get('/stores'),
      api.get('/tenant/paid-addons'),
    ]);
    console.log('[pos-offline] Preloading complete.');
  } catch (err) {
    console.warn('[pos-offline] Preloading encountered issues:', err);
  } finally {
    isPreloading = false;
  }
}
