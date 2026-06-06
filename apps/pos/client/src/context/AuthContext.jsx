import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import api from '../api/axios';
import { processSyncQueue } from '../offline/sync';

const AuthContext = createContext(null);

function normalizeStoredUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const role = String(raw.role || '').trim().toLowerCase();
  const tenantId = raw.tenantId != null ? String(raw.tenantId) : null;
  return { ...raw, role, tenantId };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pos_user');
      return stored ? normalizeStoredUser(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleSubscriptionInactive = () => {
      setUser((prev) => {
        if (!prev) return null;
        return { ...prev, subscriptionActive: false };
      });
    };
    window.addEventListener('subscription-inactive', handleSubscriptionInactive);
    return () => {
      window.removeEventListener('subscription-inactive', handleSubscriptionInactive);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('pos_token', data.token);
    if (data.refreshToken) localStorage.setItem('pos_refresh_token', data.refreshToken);
    const normalized = normalizeStoredUser(data.user);
    localStorage.setItem('pos_user', JSON.stringify(normalized));
    flushSync(() => {
      setUser(normalized);
    });
    processSyncQueue().catch(() => {});
    return normalized;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_refresh_token');
    localStorage.removeItem('pos_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser, newToken, newRefreshToken) => {
    if (newToken) localStorage.setItem('pos_token', newToken);
    if (newRefreshToken) localStorage.setItem('pos_refresh_token', newRefreshToken);
    const normalized = normalizeStoredUser(updatedUser);
    localStorage.setItem('pos_user', JSON.stringify(normalized));
    setUser(normalized);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
