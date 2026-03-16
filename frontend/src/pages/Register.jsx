import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [full_name, setFullName] = useState('');
  const [err, setErr] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      const result = await register(email, password, full_name);
      if (result?.needsConfirmation) {
        setErr('Check your email to confirm, then sign in.');
        return;
      }
      navigate('/projects');
    } catch (x) {
      setErr(x.error?.message || 'Registration failed');
    }
  }

  return (
    <div>
      <header style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
        <Link to="/">StudySync</Link>
      </header>
      <main style={{ maxWidth: 400, margin: '40px auto', padding: 24 }}>
        <h1>Sign Up</h1>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Full name" value={full_name} onChange={(e) => setFullName(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
          {err && <p style={{ color: 'red', marginBottom: 8 }}>{err}</p>}
          <button type="submit">Sign Up</button>
        </form>
        <p style={{ marginTop: 16 }}><Link to="/login">Already have an account</Link></p>
      </main>
    </div>
  );
}
