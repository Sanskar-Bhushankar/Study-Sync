import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api, setToken, getToken, saveRefreshToken, clearRefreshToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized           = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        // If we already have a live in-memory token, just fetch the profile
        if (getToken()) {
          const me = await api.get('/users/me');
          setUser(me.data);
          return;
        }
        // Try to restore session using stored refresh token (cookie OR localStorage)
        const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const storedRt = (() => { try { return localStorage.getItem('ss_rt'); } catch (_) { return null; } })();
        const body = storedRt ? JSON.stringify({ refresh_token: storedRt }) : undefined;
        const r = await fetch(`${BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (r.ok) {
          const d = await r.json().catch(() => ({}));
          if (d.access_token) {
            setToken(d.access_token);
            if (d.refresh_token) saveRefreshToken(d.refresh_token);
            setUser(d.user || (await api.get('/users/me')).data);
            return;
          }
        }
        // No valid session
        clearRefreshToken();
        setToken(null);
      } catch (_) {
        clearRefreshToken();
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.access_token);
    if (r.refresh_token) saveRefreshToken(r.refresh_token);
    const userData = r.user || (await api.get('/users/me')).data;
    setUser(userData);
    return { data: userData };
  };

  const register = async (email, password, full_name) => {
    const r = await api.post('/auth/register', { email, password, full_name });
    const session = r.data?.session;
    if (session?.access_token) {
      setToken(session.access_token);
      if (session.refresh_token) saveRefreshToken(session.refresh_token);
      const userData = r.data?.user ? { ...r.data.user, id: r.data.user.id } : (await api.get('/users/me')).data;
      if (userData) setUser(userData);
      return { data: userData };
    }
    try {
      return await login(email, password);
    } catch (_) {
      return { needsConfirmation: true };
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    setToken(null);
    clearRefreshToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
