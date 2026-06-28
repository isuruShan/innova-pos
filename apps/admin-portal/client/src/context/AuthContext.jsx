import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import api from '../api/axios';
import { silentRegisterIfGranted, unregisterPushNotifications } from '../services/pushService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('admin_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  // updateUser must be declared BEFORE any useEffect that references it
  const updateUser = useCallback((updatedUser, newToken, newRefreshToken) => {
    if (newToken) localStorage.setItem('admin_token', newToken);
    if (newRefreshToken) localStorage.setItem('admin_refresh_token', newRefreshToken);
    localStorage.setItem('admin_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  // Silently re-register FCM token on mount if permission already granted
  useEffect(() => {
    if (user) {
      silentRegisterIfGranted().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for preference updates from intercepted storage writes
  useEffect(() => {
    const handlePrefsUpdated = (e) => {
      const { user: updatedUser, token, refreshToken } = e.detail;
      updateUser(updatedUser, token, refreshToken);
    };
    window.addEventListener('user-preferences-updated', handlePrefsUpdated);
    return () => window.removeEventListener('user-preferences-updated', handlePrefsUpdated);
  }, [updateUser]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('admin_token', data.token);
    if (data.refreshToken) localStorage.setItem('admin_refresh_token', data.refreshToken);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    flushSync(() => {
      setUser(data.user);
    });
    // Silently register FCM token if permission already granted
    silentRegisterIfGranted().catch(() => {});
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await unregisterPushNotifications().catch(() => {});
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  }, []);

  const isSuperAdmin = user?.role === 'superadmin';
  const isMerchantAdmin = user?.role === 'merchant_admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isSuperAdmin, isMerchantAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
