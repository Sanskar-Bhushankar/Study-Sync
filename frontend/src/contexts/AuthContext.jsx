import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api, setToken, getToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Always try to restore session via refresh-token cookie on page load.
    // The cookie is HttpOnly so JS can't read it — but the server can use it.
    (async () => {
      try {
        // 1. If we already have a live in-memory token, just fetch the profile
        if (getToken()) {
          const me = await api.get('/users/me');
          setUser(me.data);
          return;
        }
        // 2. No in-memory token → try the refresh cookie (survives page reload)
        const r = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (r.ok) {
          const d = await r.json().catch(() => ({}));
          if (d.access_token) {
            setToken(d.access_token);
            const me = await api.get('/users/me');
            setUser(me.data);
            return;
          }
        }
      } catch (_) {
        // no valid session — stay logged out
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.access_token);
    const me = await api.get('/users/me');
    setUser(me.data);
    return me;
  };

  const register = async (email, password, full_name) => {
    const r = await api.post('/auth/register', { email, password, full_name });
    const session = r.data?.session;
    if (session?.access_token) {
      setToken(session.access_token);
      const me = await api.get('/users/me');
      setUser(me.data);
      return me;
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
