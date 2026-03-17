import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

/* ─── Avatar ─── */
function Avatar({ name, size = 36 }) {
  const i = (name || '?')[0].toUpperCase();
  const COLORS = ['#aa3bff','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
  const c = COLORS[(name || '').charCodeAt(0) % COLORS.length];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: c + '25', border: `2px solid ${c}`,
      fontSize: size * 0.42, fontWeight: 700, color: c, flexShrink: 0,
    }}>{i}</span>
  );
}

/* ─── Toast ─── */
function Toast({ msg, type, onClose }) {
  useEffect(() => { if (msg) { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); } }, [msg, onClose]);
  if (!msg) return null;
  const isErr = type === 'error';
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      padding: '12px 20px', borderRadius: 10, maxWidth: 320,
      background: isErr ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
      color: isErr ? '#dc2626' : '#16a34a',
      border: `1px solid ${isErr ? '#dc2626' : '#16a34a'}`,
      fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 14,
    }}>{msg}</div>
  );
}

export default function Invitations() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null); // inviteId being handled
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const loadInvites = async () => {
    try {
      const r = await api.get('/users/me/invites');
      setInvites(r.data || []);
    } catch (_) {
      showToast('Failed to load invitations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvites(); }, []); // eslint-disable-line

  const accept = async (inv) => {
    setActingOn(inv.id);
    try {
      await api.post(`/invites/${inv.id}/accept`);
      showToast(`Joined "${inv.projects?.title || 'project'}" 🎉`);
      // redirect after short delay so user sees the toast
      setTimeout(() => navigate(`/projects/${inv.project_id}`), 1200);
    } catch (e) {
      showToast(e.error?.message || 'Failed to accept', 'error');
      setActingOn(null);
    }
  };

  const decline = async (inv) => {
    if (!window.confirm(`Decline invite to "${inv.projects?.title || 'project'}"?`)) return;
    setActingOn(inv.id);
    try {
      await api.post(`/invites/${inv.id}/decline`);
      showToast('Invite declined.');
      await loadInvites();
    } catch (e) {
      showToast(e.error?.message || 'Failed to decline', 'error');
    } finally {
      setActingOn(null);
    }
  };

  if (!user) { navigate('/login'); return null; }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ── header ── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 28px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/projects" style={{ color: 'var(--text)', fontSize: 20, lineHeight: 1 }}>←</Link>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-h)' }}>My Invitations</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{user.full_name || user.email}</span>
          <button type="button"
            onClick={() => logout().then(() => navigate('/'))}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: '36px 24px', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text)', opacity: 0.5 }}>Checking invitations…</div>
        ) : invites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, borderRadius: 16, border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--text-h)', fontWeight: 700 }}>No pending invitations</h2>
            <p style={{ margin: 0, color: 'var(--text)', fontSize: 14 }}>
              When someone invites you to a project, it will appear here.
            </p>
            <Link to="/projects" style={{
              display: 'inline-block', marginTop: 20, padding: '9px 24px', borderRadius: 8,
              background: 'var(--accent)', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 14,
            }}>Go to Projects</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 14 }}>
              You have <strong style={{ color: 'var(--text-h)' }}>{invites.length}</strong> pending invitation{invites.length !== 1 ? 's' : ''}.
            </p>
            {invites.map((inv) => (
              <div key={inv.id} style={{
                borderRadius: 14, border: '1px solid var(--border)',
                background: 'var(--bg)', padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                {/* project icon */}
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: 'var(--accent-bg)', border: '1.5px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>📚</div>

                {/* info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-h)', marginBottom: 4 }}>
                    {inv.projects?.title || 'Unknown Project'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    Invited on {new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {/* actions */}
                <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                  <button
                    type="button"
                    disabled={actingOn === inv.id}
                    onClick={() => accept(inv)}
                    style={{
                      padding: '9px 20px', borderRadius: 8, fontWeight: 700,
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      cursor: actingOn === inv.id ? 'not-allowed' : 'pointer',
                      opacity: actingOn === inv.id ? 0.7 : 1, fontSize: 14,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                    {actingOn === inv.id ? '…' : '✓ Accept'}
                  </button>
                  <button
                    type="button"
                    disabled={actingOn === inv.id}
                    onClick={() => decline(inv)}
                    style={{
                      padding: '9px 16px', borderRadius: 8, fontWeight: 600,
                      background: 'transparent', color: '#dc2626',
                      border: '1.5px solid rgba(239,68,68,0.4)',
                      cursor: actingOn === inv.id ? 'not-allowed' : 'pointer',
                      opacity: actingOn === inv.id ? 0.7 : 1, fontSize: 14,
                    }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'success' })} />
    </div>
  );
}
