import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [full_name, setFullName] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const result = await register(email, password, full_name);
      if (result?.needsConfirmation) {
        setErr('Check your email to confirm, then sign in.');
        return;
      }
      navigate('/projects');
    } catch (x) {
      setErr(x.error?.message || 'Registration failed');
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
          <h1 style={{ marginBottom: 8, fontSize: 24 }}>Create account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>Start tracking your progress today</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Full name</label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={full_name}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
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
              {loading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
