import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import AppHeader from '../components/AppHeader';

/* ─── Badge ─── */
function Badge({ children, color = 'owner' }) {
  const styles = {
    owner:  { bg: 'var(--accent-dim)', text: 'var(--accent)' },
    member: { bg: 'var(--bg-hover)', text: 'var(--text)' },
  };
  const s = styles[color] || styles.member;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 6, background: s.bg, color: s.text }}>
      {children}
    </span>
  );
}

/* ─── Skeleton ─── */
function Skeleton({ w = '100%', h = 16, r = 6, style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-elevated) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
      ...extra,
    }} />
  );
}

function ProjectCardSkeleton() {
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton w={36} h={36} r={8} />
        <Skeleton w={52} h={20} r={10} />
      </div>
      <Skeleton w="70%" h={16} r={5} />
      <Skeleton w="90%" h={12} r={4} />
      <Skeleton w="50%" h={10} r={4} />
    </div>
  );
}

export default function Projects() {
  const [list, setList]         = useState([]);
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [err, setErr]           = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // project object
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const loadProjects = useCallback(() =>
    api.get('/projects').then((r) => setList(r.data || [])).catch(() => setList([])), []);

  useEffect(() => {
    setLoadingProjects(true);
    loadProjects().finally(() => setLoadingProjects(false));
  }, [loadProjects]);

  async function deleteProject(project) {
    setDeletingId(project.id);
    try {
      await api.delete(`/projects/${project.id}`);
      setList((prev) => prev.filter((p) => p.id !== project.id));
    } catch (x) {
      alert(x.error?.message || 'Failed to delete project');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  }

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
    <>{/* shimmer keyframes */}
    <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <AppHeader user={user} onLogout={() => logout().then(() => navigate('/'))} />

      <main style={{ flex: 1, maxWidth: 920, width: '100%', margin: '0 auto', padding: 'clamp(16px, 4vw, 40px) clamp(12px, 4vw, 28px)', boxSizing: 'border-box' }}>
        {/* page title + create button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: 'var(--text-h)', letterSpacing: '-0.02em' }}>My Projects</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              {list.length === 0 ? 'No projects yet.' : `${list.length} project${list.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button type="button" onClick={() => { setShowForm((v) => !v); setErr(''); }}
            style={{ padding: '10px 20px', borderRadius: 'var(--radius)', fontWeight: 600, background: 'var(--accent)', color: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 14 }}>
            {showForm ? 'Cancel' : '＋ New Project'}
          </button>
        </div>

        {/* ── create form ── */}
        {showForm && (
          <form onSubmit={createProject} style={{ marginBottom: 32, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 24 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 600, color: 'var(--text-h)' }}>Create a new project</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title *" required style={{ width: '100%' }} />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description (optional)" style={{ width: '100%' }} />
              {err && <p style={{ margin: 0, color: 'var(--danger)', fontSize: 14 }}>⚠ {err}</p>}
              <button type="submit" disabled={creating || !title.trim()}
                style={{ alignSelf: 'flex-start', padding: '10px 24px', fontWeight: 600, background: 'var(--accent)', color: 'var(--bg)', opacity: creating || !title.trim() ? 0.7 : 1, cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        )}

        {/* ── projects grid ── */}
        {loadingProjects ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
            {[1,2,3,4,5,6].map(i => <ProjectCardSkeleton key={i} />)}
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: 64, borderRadius: 'var(--radius-xl)', border: '1px dashed var(--border)', textAlign: 'center', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.8 }}>📂</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No projects yet</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 14 }}>Create your first project to start tracking progress.</p>
            <button type="button" onClick={() => setShowForm(true)}
              style={{ padding: '12px 24px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: 'var(--bg)', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 14 }}>
              ＋ New Project
            </button>
          </div>
        ) : (
          <>
          <div className="project-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 16 }}>
            {list.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                <Link to={`/projects/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)',
                    padding: 22, display: 'flex', flexDirection: 'column', gap: 12,
                    boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease',
                    cursor: 'pointer', minHeight: 150,
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none'; }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 26 }}>📖</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge color={p.role}>{p.role}</Badge>
                        {p.role === 'owner' && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(p); }}
                            disabled={deletingId === p.id}
                            title="Delete project"
                            style={{
                              padding: '5px 11px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                              background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.3)',
                              color: 'var(--danger)', cursor: deletingId === p.id ? 'not-allowed' : 'pointer',
                              opacity: deletingId === p.id ? 0.6 : 1,
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { if (deletingId !== p.id) e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger-dim)'; }}
                          >
                            {deletingId === p.id ? 'Deleting…' : '🗑 Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-h)', marginBottom: 4, letterSpacing: '-0.01em' }}>{p.title}</div>
                      {p.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>{p.description}</div>}
                    </div>
                    <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                      Created {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {/* Delete confirmation modal */}
          {confirmDelete && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }} onClick={() => setConfirmDelete(null)}>
              <div style={{
                background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                padding: 28, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)',
              }} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600, color: 'var(--text-h)' }}>Delete project?</h2>
                <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}>
                  Permanently delete <strong>"{confirmDelete.title}"</strong>? All topics, subtopics, members, invites, and uploaded notes will be removed. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setConfirmDelete(null)}
                    style={{ padding: '9px 20px', borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500 }}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => deleteProject(confirmDelete)} disabled={deletingId === confirmDelete.id}
                    style={{ padding: '9px 20px', borderRadius: 'var(--radius)', background: 'var(--danger)', color: '#fff', border: 'none', fontWeight: 600, opacity: deletingId ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {deletingId === confirmDelete.id && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                    {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </main>
    </div>
    </>
  );
}
