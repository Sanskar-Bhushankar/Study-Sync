import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

/* ─── Badge ─── */
function Badge({ children, color = 'owner' }) {
  const styles = {
    owner:  { bg: 'rgba(170,59,255,0.12)', text: 'var(--accent)' },
    member: { bg: 'rgba(100,100,120,0.10)', text: 'var(--text)' },
  };
  const s = styles[color] || styles.member;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.text }}>
      {children}
    </span>
  );
}

export default function Projects() {
  const [list, setList]         = useState([]);
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [err, setErr]           = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const loadProjects = useCallback(() =>
    api.get('/projects').then((r) => setList(r.data || [])).catch(() => setList([])), []);

  const loadInviteCount = useCallback(() =>
    api.get('/users/me/invites').then((r) => setPendingCount((r.data || []).length)).catch(() => {}), []);

  useEffect(() => {
    loadProjects();
    loadInviteCount();
  }, [loadProjects, loadInviteCount]);

  async function createProject(e) {
    e.preventDefault(); setErr('');
    if (!title.trim()) return;
    setCreating(true);
    try {
      const r = await api.post('/projects', { title: title.trim(), description: desc.trim() || undefined });
      setList((prev) => [r.data, ...prev]);
      setTitle(''); setDesc(''); setShowForm(false);
    } catch (x) {
      setErr(x.error?.message || 'Failed to create project');
    } finally { setCreating(false); }
  }

  if (!user) { navigate('/login'); return null; }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ── header ── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📚</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-h)' }}>StudySync</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Invitations bell */}
          <Link to="/invitations" title="My Invitations" style={{
            position: 'relative', fontSize: 20, textDecoration: 'none',
            color: 'var(--text)', display: 'flex', alignItems: 'center',
          }}>
            🔔
            {pendingCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                minWidth: 18, height: 18, borderRadius: 99,
                background: '#ef4444', color: '#fff',
                fontSize: 10, fontWeight: 800, display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>{pendingCount}</span>
            )}
          </Link>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{user.full_name || user.email}</span>
          <button type="button" onClick={() => logout().then(() => navigate('/'))}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 860, width: '100%', margin: '0 auto', padding: '36px 24px', boxSizing: 'border-box' }}>
        {/* page title + create button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-h)' }}>My Projects</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text)', fontSize: 14 }}>
              {list.length === 0 ? 'No projects yet.' : `${list.length} project${list.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button type="button" onClick={() => { setShowForm((v) => !v); setErr(''); }}
            style={{ padding: '10px 22px', borderRadius: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {showForm ? '✕ Cancel' : '＋ New Project'}
          </button>
        </div>

        {/* ── create form ── */}
        {showForm && (
          <form onSubmit={createProject} style={{ marginBottom: 28, borderRadius: 14, border: '1.5px solid var(--accent-border)', background: 'var(--accent-bg)', padding: '20px 24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-h)' }}>Create a new project</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title *" required
                style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 14, outline: 'none' }} />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description (optional)"
                style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontSize: 14, outline: 'none' }} />
              {err && <p style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>⚠ {err}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={creating || !title.trim()}
                  style={{ padding: '9px 24px', borderRadius: 8, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating || !title.trim() ? 0.7 : 1, fontSize: 14 }}>
                  {creating ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── projects grid ── */}
        {list.length === 0 ? (
          <div style={{ padding: 60, borderRadius: 16, border: '2px dashed var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--text-h)', fontWeight: 700 }}>No projects yet</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text)', fontSize: 14 }}>Create your first project to get started.</p>
            <button type="button" onClick={() => setShowForm(true)}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--accent)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>
              ＋ New Project
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {list.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg)',
                  padding: '20px', display: 'flex', flexDirection: 'column', gap: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'all 0.18s',
                  cursor: 'pointer',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(170,59,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none'; }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 28 }}>📖</div>
                    <Badge color={p.role}>{p.role}</Badge>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-h)', marginBottom: 4 }}>{p.title}</div>
                    {p.description && <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{p.description}</div>}
                  </div>
                  <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text)', opacity: 0.7 }}>
                    Created {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
