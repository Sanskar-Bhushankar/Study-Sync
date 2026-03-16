const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

let token = null;
let refreshPromise = null;

export function setToken(t) {
  token = t;
}
export function getToken() {
  return token;
}

async function doRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const r = await fetch(`${BASE}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.access_token) {
        token = d.access_token;
        return token;
      }
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
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...opts, credentials: 'include', headers });
  if (res.status === 401 && token && !isRetry) {
    await doRefresh();
    return request(path, opts, true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
