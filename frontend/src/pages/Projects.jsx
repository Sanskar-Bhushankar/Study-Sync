import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export default function Projects() {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/projects').then((r) => setList(r.data || [])).catch(() => setList([]));
  }, []);

  async function createProject(e) {
    e.preventDefault();
    setErr('');
    try {
      const r = await api.post('/projects', { title });
      setList((prev) => [...prev, r.data]);
      setTitle('');
    } catch (x) {
      setErr(x.error?.message || 'Failed');
    }
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border)' }}>
        <Link to="/projects">StudySync</Link>
        <span>{user.full_name || user.email}</span>
        <button type="button" onClick={() => logout().then(() => navigate('/'))}>Logout</button>
      </header>
      <main style={{ padding: 24 }}>
        <h1>Projects</h1>
        <form onSubmit={createProject} style={{ marginBottom: 24 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New project title" style={{ marginRight: 8, padding: 8 }} />
          <button type="submit">Create</button>
          {err && <span style={{ color: 'red', marginLeft: 8 }}>{err}</span>}
        </form>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {list.map((p) => (
            <li key={p.id} style={{ marginBottom: 8 }}>
              <Link to={`/projects/${p.id}`}>{p.title}</Link>
              {p.role === 'owner' && <span style={{ marginLeft: 8, fontSize: 12 }}>owner</span>}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
