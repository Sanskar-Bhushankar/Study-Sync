import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/projects');
    } catch (x) {
      const msg = x.error?.message || x.message || 'Login failed';
      setErr(msg === 'Invalid or expired token' ? 'Session error. Try signing in again.' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-h)' }}>StudySync</Link>
      </header>

      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: 32,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <h1 style={{ marginBottom: 8, fontSize: 24 }}>Sign in</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>Welcome back to your dashboard</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
            {err && (
              <div style={{ padding: 12, borderRadius: 'var(--radius)', background: 'var(--danger-dim)', color: 'var(--danger)', fontSize: 14 }}>
                {err}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 20px', borderRadius: 'var(--radius)', fontWeight: 600,
                background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading && (
                <span style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              )}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>Create one</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
