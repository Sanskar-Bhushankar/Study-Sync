import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import AppHeader from '../components/AppHeader';

function Avatar({ name, size = 36 }) {
  const i = (name || '?')[0].toUpperCase();
  const COLORS = ['#22d3ee', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const c = COLORS[(name || '').charCodeAt(0) % COLORS.length];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: c + '20', border: `2px solid ${c}60`,
      fontSize: size * 0.42, fontWeight: 600, color: c, flexShrink: 0,
    }}>{i}</span>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { if (msg) { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); } }, [msg, onClose]);
  if (!msg) return null;
  const isErr = type === 'error';
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      padding: '14px 20px', borderRadius: 'var(--radius)', maxWidth: 340,
      background: isErr ? 'var(--danger-dim)' : 'var(--success-dim)',
      color: isErr ? 'var(--danger)' : 'var(--success)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
      fontWeight: 500, boxShadow: 'var(--shadow-lg)', fontSize: 14,
    }}>{msg}</div>
  );
}

export default function Invitations() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState(null);
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
      <AppHeader user={user} variant="invitations" onLogout={() => logout().then(() => navigate('/'))} />

      <main style={{ flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: 'clamp(16px, 4vw, 40px) clamp(12px, 4vw, 28px)', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 180, height: 16, borderRadius: 6, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-elevated) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '60%', height: 16, borderRadius: 6, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-elevated) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: 8 }} />
                  <div style={{ width: '40%', height: 12, borderRadius: 4, background: 'linear-gradient(90deg, var(--border) 25%, var(--bg-elevated) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
                </div>
                <div style={{ width: 90, height: 36, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)' }} />
              </div>
            ))}
          </div>
        ) : invites.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64, borderRadius: 'var(--radius-xl)', border: '1px dashed var(--border)', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.8 }}>📭</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>No pending invitations</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
              When someone invites you to a project, it will appear here.
            </p>
            <Link to="/projects" style={{
              display: 'inline-block', marginTop: 24, padding: '12px 24px', borderRadius: 'var(--radius)',
              background: 'var(--accent)', color: 'var(--bg)', fontWeight: 600, textDecoration: 'none', fontSize: 14,
            }}>Go to Projects</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: 14 }}>
              You have <strong style={{ color: 'var(--text-h)' }}>{invites.length}</strong> pending invitation{invites.length !== 1 ? 's' : ''}.
            </p>
            {invites.map((inv) => (
              <div key={inv.id} style={{
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
                background: 'var(--bg-card)', padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 'var(--radius)',
                  background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>📚</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-h)', marginBottom: 4 }}>
                    {inv.projects?.title || 'Unknown Project'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Invited on {new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                  <button type="button" disabled={actingOn === inv.id} onClick={() => accept(inv)}
                    style={{
                      padding: '10px 20px', borderRadius: 'var(--radius)', fontWeight: 600,
                      background: 'var(--accent)', color: 'var(--bg)', border: 'none',
                      cursor: actingOn === inv.id ? 'not-allowed' : 'pointer',
                      opacity: actingOn === inv.id ? 0.7 : 1, fontSize: 14,
                    }}>
                    {actingOn === inv.id ? '…' : '✓ Accept'}
                  </button>
                  <button type="button" disabled={actingOn === inv.id} onClick={() => decline(inv)}
                    style={{
                      padding: '10px 18px', borderRadius: 'var(--radius)', fontWeight: 500,
                      background: 'transparent', color: 'var(--danger)',
                      border: '1px solid rgba(239,68,68,0.4)',
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
