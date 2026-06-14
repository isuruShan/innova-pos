// Global local storage monkeypatch to synchronize view mode preferences with the database.
// Imported at the entry point (main.jsx) so it runs before any React components load.

const originalGetItem = localStorage.getItem.bind(localStorage);
const originalSetItem = localStorage.setItem.bind(localStorage);

localStorage.getItem = (key) => {
  if (key && typeof key === 'string' && key.startsWith('view_mode_')) {
    try {
      const userStr = originalGetItem('admin_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.preferences && user.preferences[key] !== undefined) {
          return user.preferences[key];
        }
      }
    } catch (e) {
      console.error('Error reading preference from local user object:', e);
    }
  }
  return originalGetItem(key);
};

localStorage.setItem = (key, value) => {
  originalSetItem(key, value);

  if (key && typeof key === 'string' && key.startsWith('view_mode_')) {
    let userUpdated = false;
    let token = '';
    let updatedUser = null;

    try {
      const userStr = originalGetItem('admin_user');
      token = originalGetItem('admin_token');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user) {
          if (!user.preferences) {
            user.preferences = {};
          }
          if (user.preferences[key] !== value) {
            user.preferences[key] = value;
            updatedUser = user;
            originalSetItem('admin_user', JSON.stringify(user));
            userUpdated = true;
          }
        }
      }
    } catch (e) {
      console.error('Error updating preference in local user object:', e);
    }

    // Call backend API if user is logged in
    if (userUpdated && token) {
      // Use window.fetch for dependency-free requests
      fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          preferences: {
            [key]: value
          }
        })
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            originalSetItem('admin_user', JSON.stringify(data.user));
            if (data.token) originalSetItem('admin_token', data.token);
            if (data.refreshToken) originalSetItem('admin_refresh_token', data.refreshToken);
            
            // Notify AuthContext to refresh React's in-memory state
            window.dispatchEvent(new CustomEvent('user-preferences-updated', { detail: data }));
          }
        } else {
          console.warn('Backend rejected preference update:', res.statusText);
        }
      })
      .catch((err) => {
        console.error('Network error updating backend preferences:', err);
      });
    }
  }
};
