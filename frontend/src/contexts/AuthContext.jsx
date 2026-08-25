import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api, setToken, getToken, saveRefreshToken, clearRefreshToken } from '../api';
import { STREAK_REFRESH_EVENT } from '../streakRefresh';
import { extractActivityPayload, streakFromPayload } from '../utils/headerStats';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [headerStreak, setHeaderStreak] = useState(0);
  const [headerHighestStreak, setHeaderHighestStreak] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);
  const headerStatsGen        = useRef(0);
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

  /**
   * Single batch: `/users/me` + profile (streak) + pending invites.
   * Not tied to React Router — avoids refetch on every /projects ↔ /profile navigation.
   */
  const refreshHeaderStats = useCallback(async () => {
    if (!getToken()) return;
    const gen = ++headerStatsGen.current;
    const wrap = (p) => p.then((r) => ({ ok: true, r })).catch(() => ({ ok: false }));

    const [meRes, profileRes, invitesRes] = await Promise.all([
      wrap(api.get('/users/me')),
      wrap(api.get('/users/me/profile')),
      wrap(api.get('/users/me/invites')),
    ]);
    if (gen !== headerStatsGen.current) return;

    if (meRes.ok && meRes.r?.data != null) setUser(meRes.r.data);

    if (profileRes.ok) {
      const payload = extractActivityPayload(profileRes.r);
      setHeaderStreak(streakFromPayload(payload));
      if (typeof payload.highest_streak === 'number') {
        setHeaderHighestStreak(payload.highest_streak);
      }
    }

    if (invitesRes.ok) {
      const r = invitesRes.r;
      const arr = (r && r.data !== undefined) ? r.data : (Array.isArray(r) ? r : []);
      setPendingInvites(Array.isArray(arr) ? arr.length : 0);
    }
  }, []);

  useEffect(() => {
    if (loading || !user?.id) return;
    refreshHeaderStats();
  }, [loading, user?.id, refreshHeaderStats]);

  useEffect(() => {
    if (!user?.id) return;
    const onActivity = () => { refreshHeaderStats(); };
    window.addEventListener(STREAK_REFRESH_EVENT, onActivity);
    return () => window.removeEventListener(STREAK_REFRESH_EVENT, onActivity);
  }, [user?.id, refreshHeaderStats]);

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
    headerStatsGen.current += 1;
    setHeaderStreak(0);
    setHeaderHighestStreak(0);
    setPendingInvites(0);
  };

  /** Re-fetch `/users/me` so header name/email reflect profile edits without full reload. */
  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await api.get('/users/me');
      if (me?.data != null) setUser(me.data);
    } catch (_) {}
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      headerStreak,
      headerHighestStreak,
      pendingInvites,
      refreshHeaderStats,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
