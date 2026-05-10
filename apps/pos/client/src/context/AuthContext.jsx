import { createContext, useContext, useState, useCallback } from 'react';
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

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('pos_token', data.token);
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
    localStorage.removeItem('pos_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser, newToken) => {
    if (newToken) localStorage.setItem('pos_token', newToken);
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
