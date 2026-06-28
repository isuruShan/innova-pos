import { createContext, useContext, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import api from '../api/axios';

const AuthContext = createContext(null);

const ALLOWED_ROLES = ['merchant_admin', 'commissary_operator', 'purchasing_officer', 'inventory_clerk'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('ck_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const updateUser = useCallback((updatedUser, newToken, newRefreshToken) => {
    if (newToken) localStorage.setItem('ck_token', newToken);
    if (newRefreshToken) localStorage.setItem('ck_refresh_token', newRefreshToken);
    localStorage.setItem('ck_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    
    // Auth gate on client side
    if (!ALLOWED_ROLES.includes(data.user.role)) {
      throw new Error('Access Denied: This application is restricted to Central Kitchen and Procurement roles.');
    }

    localStorage.setItem('ck_token', data.token);
    if (data.refreshToken) localStorage.setItem('ck_refresh_token', data.refreshToken);
    localStorage.setItem('ck_user', JSON.stringify(data.user));
    
    flushSync(() => {
      setUser(data.user);
    });
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem('ck_token');
    localStorage.removeItem('ck_refresh_token');
    localStorage.removeItem('ck_user');
    localStorage.removeItem('ck_selected_store');
    // Clear synced admin-portal keys (set by AdminContextBridge for shared components)
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_selected_store');
    setUser(null);
  }, []);

  const isMerchantAdmin = user?.role === 'merchant_admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isMerchantAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
