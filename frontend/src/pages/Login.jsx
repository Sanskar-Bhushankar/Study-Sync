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
    <div>
      <header style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
        <Link to="/">StudySync</Link>
      </header>
      <main style={{ maxWidth: 400, margin: '40px auto', padding: 24 }}>
        <h1>Sign In</h1>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          {err && <p style={{ color: 'red', marginBottom: 8 }}>{err}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
        </form>
        <p style={{ marginTop: 16 }}><Link to="/register">Create account</Link></p>
      </main>
    </div>
  );
}
