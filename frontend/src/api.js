const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let accessToken = null;
let refreshPromise = null;

const RT_KEY = 'ss_rt';

export function setToken(t) { accessToken = t; }
export function getToken()  { return accessToken; }

function saveRefreshToken(rt) {
  try { if (rt) localStorage.setItem(RT_KEY, rt); else localStorage.removeItem(RT_KEY); } catch (_) {}
}
function loadRefreshToken() {
  try { return localStorage.getItem(RT_KEY); } catch (_) { return null; }
}
export function clearRefreshToken() { saveRefreshToken(null); }

async function doRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const rt = loadRefreshToken();
      const body = rt ? JSON.stringify({ refresh_token: rt }) : undefined;
      const r = await fetch(`${BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.access_token) {
        accessToken = d.access_token;
        if (d.refresh_token) saveRefreshToken(d.refresh_token);
        return accessToken;
      }
      // refresh failed — clear stored token so we don't retry forever
      saveRefreshToken(null);
      throw { status: r.status, ...d };
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(path, opts = {}, isRetry = false) {
  const url = path.startsWith('http') ? path : `${BASE}/api/v1${path}`;
  const headers = { ...opts.headers };
  if (accessToken && !headers.Authorization) headers.Authorization = `Bearer ${accessToken}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opts, credentials: 'include', headers });
  if (res.status === 401 && !isRetry) {
    try {
      await doRefresh();
      return request(path, opts, true);
    } catch (_) {
      throw { status: 401, error: { message: 'Session expired' } };
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const api = {
  get:    (path)       => request(path),
  post:   (path, body) => request(path, { method: 'POST',  body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch:  (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path)       => request(path, { method: 'DELETE' }),
};

export { saveRefreshToken, loadRefreshToken };
