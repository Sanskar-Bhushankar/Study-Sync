import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import AppHeader from '../components/AppHeader';

const MODE_LABELS = {
  A: 'Option A — One event per topic completed',
  B: 'Option B — Topic completions + revisions',
  C: 'Option C — One daily summary event',
};

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function eventLabel(log) {
  if (log.event_type === 'daily_summary') return `📚 Daily summary — ${log.summary_date}`;
  if (log.event_type === 'revision') return `🔁 ${log.topic_title || 'Revision'} (${log.project_title || 'Project'})`;
  return `✅ ${log.topic_title || 'Topic'} (${log.project_title || 'Project'})`;
}

export default function Calendar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('log');
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState({ sync_mode: 'A', auto_sync: true, calendar_id: 'primary' });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st, logRes] = await Promise.all([
        api.get('/integrations/google/status'),
        api.get('/integrations/google/log'),
      ]);
      setStatus(st.data);
      setSettings({
        sync_mode: st.data.sync_mode || 'A',
        auto_sync: st.data.auto_sync !== false,
        calendar_id: st.data.calendar_id || 'primary',
      });
      setLogs(logRes.data?.logs || []);
      setPending(logRes.data?.pending || []);
    } catch (_) {
      setStatus({ connected: false, configured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      showToast('Google Calendar connected!');
      setSearchParams({}, { replace: true });
      loadAll();
    }
    const err = searchParams.get('error');
    if (err) {
      showToast(`Connection failed: ${decodeURIComponent(err)}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, loadAll]);

  async function connectGoogle() {
    setConnecting(true);
    try {
      const r = await api.get('/integrations/google/connect-url');
      window.location.href = r.url;
    } catch (e) {
      showToast(e.error?.message || 'Could not start Google sign-in');
      setConnecting(false);
    }
  }

  async function disconnectGoogle() {
    if (!window.confirm('Disconnect Google Calendar?')) return;
    try {
      await api.delete('/integrations/google/disconnect');
      showToast('Disconnected');
      loadAll();
    } catch (e) {
      showToast(e.error?.message || 'Disconnect failed');
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const r = await api.patch('/integrations/google/settings', settings);
      setStatus((s) => ({ ...s, ...r.data }));
      showToast('Settings saved');
    } catch (e) {
      showToast(e.error?.message || 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  }

  async function syncItem(item) {
    const key = item.type === 'revision' ? item.revision_id : item.topic_id;
    setSyncingId(key);
    try {
      const body = item.type === 'revision'
        ? { type: 'revision', revisionId: item.revision_id }
        : { type: 'topic_complete', projectId: item.project_id, topicId: item.topic_id };
      await api.post('/integrations/google/sync', body);
      showToast('Synced to Google Calendar');
      loadAll();
    } catch (e) {
      showToast(e.error?.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function syncAllPending() {
    setSyncingAll(true);
    try {
      const r = await api.post('/integrations/google/sync-all');
      showToast(`Synced ${r.data?.synced || 0} item(s)`);
      loadAll();
    } catch (e) {
      showToast(e.error?.message || 'Sync all failed');
    } finally {
      setSyncingAll(false);
    }
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <AppHeader user={user} onLogout={() => logout().then(() => navigate('/'))} />

        {toast && (
          <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', fontSize: 13, boxShadow: 'var(--shadow-lg)' }}>
            {toast}
          </div>
        )}

        <main style={{ flex: 1, maxWidth: 820, width: '100%', margin: '0 auto', padding: 'clamp(16px, 4vw, 40px) clamp(12px, 4vw, 28px)', boxSizing: 'border-box' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 600, color: 'var(--text-h)' }}>📅 Calendar</h1>
          <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 14 }}>Sync study activity to your Google Calendar</p>

          {/* Connection card */}
          <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px 24px', marginBottom: 24 }}>
            {loading ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p>
            ) : !status?.configured ? (
              <p style={{ margin: 0, color: 'var(--warning)' }}>Google OAuth is not configured on the server. Add GOOGLE_CLIENT_ID and secrets to backend .env.</p>
            ) : status?.connected ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>● Connected</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{status.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Mode: {settings.sync_mode} · Auto-sync: {settings.auto_sync ? 'On' : 'Off'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href="https://calendar.google.com" target="_blank" rel="noreferrer"
                    style={{ padding: '8px 16px', borderRadius: 'var(--radius)', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    Open Google Calendar ↗
                  </a>
                  <button type="button" onClick={disconnectGoogle}
                    style={{ padding: '8px 16px', borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', marginBottom: 4 }}>Not connected</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connect your Google account to log study events automatically or manually.</div>
                </div>
                <button type="button" onClick={connectGoogle} disabled={connecting}
                  style={{ padding: '10px 20px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontWeight: 600, cursor: connecting ? 'wait' : 'pointer', opacity: connecting ? 0.7 : 1 }}>
                  {connecting ? 'Redirecting…' : 'Connect Google Calendar'}
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {['log', 'settings'].map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                style={{
                  padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'var(--accent-dim)' : 'transparent',
                  border: `1px solid ${tab === t ? 'var(--accent-border)' : 'var(--border)'}`,
                  color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                {t === 'log' ? 'Sync log' : 'Settings'}
              </button>
            ))}
          </div>

          {tab === 'log' && (
            <div>
              {pending.length > 0 && status?.connected && (
                <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid rgba(234,179,8,0.4)', background: 'rgba(234,179,8,0.08)', padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Pending sync ({pending.length})</span>
                    <button type="button" onClick={syncAllPending} disabled={syncingAll}
                      style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'var(--bg)', border: 'none', cursor: syncingAll ? 'wait' : 'pointer' }}>
                      {syncingAll ? 'Syncing…' : 'Sync all'}
                    </button>
                  </div>
                  {pending.map((item) => {
                    const key = item.type === 'revision' ? item.revision_id : item.topic_id;
                    return (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13 }}>
                          {item.type === 'revision' ? '🔁' : '✅'} {item.topic_title} ({item.project_title}) · {formatWhen(item.at)}
                        </span>
                        <button type="button" onClick={() => syncItem(item)} disabled={syncingId === key}
                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: syncingId === key ? 'wait' : 'pointer' }}>
                          {syncingId === key ? '…' : 'Sync now'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>Recently synced</div>
                {loading ? (
                  <p style={{ padding: 24, margin: 0, color: 'var(--text-muted)' }}>Loading…</p>
                ) : logs.length === 0 ? (
                  <p style={{ padding: 24, margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
                    No synced events yet. Complete a topic or use manual sync.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{eventLabel(log)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatWhen(log.synced_at)} · {log.sync_trigger} · mode {log.sync_mode}
                        </div>
                      </div>
                      {log.google_event_link && (
                        <a href={log.google_event_link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>Open in GCal ↗</a>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <form onSubmit={saveSettings} style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>How to log events</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {['A', 'B', 'C'].map((m) => (
                  <label key={m} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 'var(--radius)', border: `1px solid ${settings.sync_mode === m ? 'var(--accent-border)' : 'var(--border)'}`, background: settings.sync_mode === m ? 'var(--accent-dim)' : 'var(--bg-elevated)' }}>
                    <input type="radio" name="sync_mode" value={m} checked={settings.sync_mode === m}
                      onChange={() => setSettings((s) => ({ ...s, sync_mode: m }))} style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{MODE_LABELS[m]}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {m === 'A' && 'Creates one calendar event when you complete a topic.'}
                        {m === 'B' && 'Topic completions plus a separate event for each revision.'}
                        {m === 'C' && 'Bundles all study activity into one event per day.'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.auto_sync}
                  onChange={(e) => setSettings((s) => ({ ...s, auto_sync: e.target.checked }))} />
                <span style={{ fontSize: 14 }}>Automatically sync when I study (turn off for manual-only)</span>
              </label>

              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Target calendar ID</span>
                <input value={settings.calendar_id} onChange={(e) => setSettings((s) => ({ ...s, calendar_id: e.target.value }))}
                  placeholder="primary"
                  style={{ width: '100%', maxWidth: 320, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Use <code style={{ fontSize: 11 }}>primary</code> for your main Google Calendar.</span>
              </label>

              <button type="submit" disabled={savingSettings}
                style={{ padding: '10px 24px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontWeight: 600, cursor: savingSettings ? 'wait' : 'pointer' }}>
                {savingSettings ? 'Saving…' : 'Save settings'}
              </button>
            </form>
          )}
        </main>
      </div>
    </>
  );
}
