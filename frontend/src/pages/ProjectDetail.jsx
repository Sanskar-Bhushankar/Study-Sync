import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

/* ─── Avatar chip ─── */
function Avatar({ name, size = 24, title }) {
  const initials = (name || '?')[0].toUpperCase();
  const colors = ['#aa3bff','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <span title={title || name} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: color + '30', border: `2px solid ${color}`,
      fontSize: size * 0.42, fontWeight: 700, color,
      flexShrink: 0, cursor: 'default',
    }}>{initials}</span>
  );
}

/* ─── Badge ─── */
function Badge({ children, color }) {
  const map = {
    owner:    { bg: 'rgba(170,59,255,0.15)', text: 'var(--accent)' },
    member:   { bg: 'rgba(100,100,120,0.12)', text: 'var(--text)' },
    pending:  { bg: 'rgba(234,179,8,0.15)',   text: '#ca8a04' },
    accepted: { bg: 'rgba(34,197,94,0.15)',   text: '#16a34a' },
    declined: { bg: 'rgba(239,68,68,0.15)',   text: '#dc2626' },
    pdf:      { bg: 'rgba(239,68,68,0.12)',   text: '#dc2626' },
    image:    { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6' },
  };
  const c = map[color] || map.member;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.text,
    }}>{children}</span>
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
      fontWeight: 500, boxShadow: 'var(--shadow)', fontSize: 14,
    }}>{msg}</div>
  );
}

/* ─── Inline add form ─── */
function InlineForm({ placeholder, onSave, onCancel }) {
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!val.trim()) return;
    setSaving(true);
    await onSave(val.trim());
    setSaving(false);
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, padding: '7px 12px', borderRadius: 7, border: '1.5px solid var(--accent-border)', background: 'var(--code-bg)', color: 'var(--text-h)', outline: 'none' }} />
      <button type="submit" disabled={saving} style={{ padding: '7px 16px', borderRadius: 7, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? '…' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
        Cancel
      </button>
    </form>
  );
}

/* ─── Icon button ─── */
function IconBtn({ onClick, title, danger, children }) {
  return (
    <button type="button" title={title} onClick={onClick}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 5, color: danger ? '#dc2626' : 'var(--text)', fontSize: 13, opacity: 0.65, transition: 'all 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'var(--code-bg)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.65'; e.currentTarget.style.background = 'transparent'; }}
    >{children}</button>
  );
}

/* ─── Progress bar ─── */
function ProgressBar({ pct, color = 'var(--accent)' }) {
  return (
    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   PARSE MARKDOWN SYLLABUS
   # Topic Title
   - Subtopic title    (or - [ ] Subtopic title)
══════════════════════════════════════════════ */
function parseMdSyllabus(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const topics = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('#')) {
      current = { title: line.replace(/^#+\s*/, '').trim(), subtopics: [] };
      topics.push(current);
    } else if (line.startsWith('-') && current) {
      const title = line.replace(/^-\s*(\[.\]\s*)?/, '').trim();
      if (title) current.subtopics.push(title);
    }
  }
  return topics;
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject]   = useState(null);
  const [topics, setTopics]     = useState([]);
  const [progress, setProgress] = useState(null);
  const [members, setMembers]   = useState([]);
  const [invites, setInvites]   = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [allNotes, setAllNotes] = useState({}); // topicId → [completion]
  const [tab, setTab]           = useState('syllabus');
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState({ msg: '', type: 'success' });

  // syllabus mode: 'ui' | 'md'
  const [syllabusMode, setSyllabusMode]   = useState('ui');
  const [mdText, setMdText]               = useState('');
  const [mdSaving, setMdSaving]           = useState(false);

  // inline add state
  const [showAddTopic, setShowAddTopic]     = useState(false);
  const [addSubtopicFor, setAddSubtopicFor] = useState(null);

  // upload state per topic
  const [uploadingFor, setUploadingFor]   = useState(null); // topicId
  const fileInputRef = useRef(null);

  // invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);
  const [inviteErr, setInviteErr]     = useState('');

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const myMember = members.find((m) => m.user_id === user?.id);
  const isOwner  = myMember?.role === 'owner';

  /* ── loaders ── */
  const loadTopics   = useCallback(() => api.get(`/projects/${projectId}/topics`).then((r) => setTopics(r.data || [])).catch(() => {}), [projectId]);
  const loadProgress = useCallback(() => api.get(`/projects/${projectId}/progress`).then((r) => setProgress(r)).catch(() => {}), [projectId]);
  const loadMembers  = useCallback(() => api.get(`/projects/${projectId}/members`).then((r) => setMembers(r.data || [])).catch(() => {}), [projectId]);
  const loadInvites  = useCallback(() => api.get(`/projects/${projectId}/invites`).then((r) => setInvites(r.data || [])).catch(() => {}), [projectId]);
  const loadDashboard = useCallback(() => api.get(`/projects/${projectId}/dashboard`).then((r) => setDashboard(r.data)).catch(() => {}), [projectId]);

  const loadAllNotes = useCallback(async (list) => {
    const result = {};
    await Promise.all((list || []).map(async (t) => {
      try {
        const r = await api.get(`/projects/${projectId}/topics/${t.id}/completions`);
        result[t.id] = r.data || [];
      } catch (_) { result[t.id] = []; }
    }));
    setAllNotes(result);
  }, [projectId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([
        api.get(`/projects/${projectId}`).then((r) => setProject(r.data)).catch(() => setProject(null)),
        loadTopics(),
        loadProgress(),
        loadMembers(),
      ]);
      setLoading(false);
    }
    init();
  }, [projectId, loadTopics, loadProgress, loadMembers]);

  useEffect(() => { if (tab === 'members' && isOwner) loadInvites(); }, [tab, isOwner, loadInvites]);
  useEffect(() => { if (tab === 'dashboard') loadDashboard(); }, [tab, loadDashboard]);
  // notes: re-run when topics are loaded (topics.length changes from 0)
  const topicsLen = topics.length;
  useEffect(() => {
    if (tab === 'notes' && topicsLen > 0) loadAllNotes(topics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, topicsLen, loadAllNotes]);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  /* ── whether all my subtopics are done for a topic ── */
  function myTopicAllDone(topicId) {
    const pt = progress?.topics?.find((t) => t.id === topicId);
    if (!pt || !pt.subtopics?.length) return false;
    return pt.subtopics.every((st) => st.completions?.[user.id]?.is_completed);
  }
  function myTopicCompleted(topicId) {
    const pt = progress?.topics?.find((t) => t.id === topicId);
    return pt?.completions?.[user.id]?.is_completed === true;
  }

  /* ─── member name map ─── */
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m.full_name || m.email || '?']));

  /* ─── syllabus actions ─── */
  async function addTopic(title) {
    try {
      await api.post(`/projects/${projectId}/topics`, { title });
      await loadTopics(); setShowAddTopic(false); showToast(`Topic "${title}" added!`);
    } catch (e) { showToast(e.error?.message || 'Failed to add topic', 'error'); }
  }

  async function deleteTopic(topicId, title) {
    if (!window.confirm(`Delete topic "${title}" and all its subtopics?`)) return;
    try { await api.delete(`/projects/${projectId}/topics/${topicId}`); await loadTopics(); await loadProgress(); showToast('Topic deleted.'); }
    catch (e) { showToast(e.error?.message || 'Failed', 'error'); }
  }

  async function addSubtopic(topicId, title) {
    try {
      await api.post(`/projects/${projectId}/topics/${topicId}/subtopics`, { title });
      await loadTopics(); setAddSubtopicFor(null); showToast(`Subtopic "${title}" added!`);
    } catch (e) { showToast(e.error?.message || 'Failed', 'error'); }
  }

  async function deleteSubtopic(topicId, subtopicId, title) {
    if (!window.confirm(`Delete subtopic "${title}"?`)) return;
    try { await api.delete(`/projects/${projectId}/topics/${topicId}/subtopics/${subtopicId}`); await loadTopics(); await loadProgress(); showToast('Subtopic deleted.'); }
    catch (e) { showToast(e.error?.message || 'Failed', 'error'); }
  }

  /* ─── MD bulk import ─── */
  async function saveMdSyllabus() {
    const parsed = parseMdSyllabus(mdText);
    if (!parsed.length) { showToast('No topics found. Use # for topics and - for subtopics.', 'error'); return; }
    setMdSaving(true);
    try {
      for (const t of parsed) {
        const tr = await api.post(`/projects/${projectId}/topics`, { title: t.title });
        const topicId = tr.data?.id;
        if (topicId) {
          for (let i = 0; i < t.subtopics.length; i++) {
            await api.post(`/projects/${projectId}/topics/${topicId}/subtopics`, { title: t.subtopics[i], order_index: i });
          }
        }
      }
      await loadTopics();
      setMdText('');
      setSyllabusMode('ui');
      showToast(`Imported ${parsed.length} topic(s)!`);
    } catch (e) {
      showToast(e.error?.message || 'Import failed', 'error');
    } finally { setMdSaving(false); }
  }

  /* ─── progress toggle ─── */
  async function toggleComplete(subtopicId, isCompleted) {
    try {
      if (isCompleted) await api.delete(`/projects/${projectId}/subtopics/${subtopicId}/complete`);
      else await api.post(`/projects/${projectId}/subtopics/${subtopicId}/complete`);
      await loadProgress();
    } catch (e) { showToast(e.error?.message || 'Could not update progress', 'error'); }
  }

  /* ─── notes upload ─── */
  function triggerUpload(topicId) {
    setUploadingFor(topicId);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadingFor) return;
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/projects/${projectId}/topics/${uploadingFor}/complete`, form);
      await loadProgress();
      if (tab === 'notes') await loadAllNotes(topics);
      showToast('Notes uploaded! Topic completed 🎉');
    } catch (e) {
      showToast(e.error?.message || 'Upload failed', 'error');
    } finally { setUploadingFor(null); }
  }

  /* ─── invite actions ─── */
  async function sendInvite(e) {
    e.preventDefault(); setInviteErr('');
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await api.post(`/projects/${projectId}/invites`, { invited_email: inviteEmail.trim() });
      setInviteEmail(''); await loadInvites(); showToast(`Invite sent!`);
    } catch (e) { setInviteErr(e.error?.message || 'Failed to send invite'); }
    finally { setInviting(false); }
  }

  async function cancelInvite(id) {
    if (!window.confirm('Cancel this invite?')) return;
    try { await api.delete(`/projects/${projectId}/invites/${id}`); await loadInvites(); showToast('Invite cancelled.'); }
    catch (e) { showToast(e.error?.message || 'Failed', 'error'); }
  }

  /* ─── guards ─── */
  if (!user) { navigate('/login'); return null; }
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text)', opacity: 0.5 }}>Loading…</div>
  );
  if (!project) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)' }}>
      Project not found or you don't have access. <Link to="/projects">← Back</Link>
    </div>
  );

  const tabs = ['syllabus', 'members', 'notes', 'dashboard'];

  /* ══════════════ RENDER ══════════════ */
  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      {/* ── hidden file input ── */}
      <input ref={fileInputRef} type="file" accept=".pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={handleFileSelected} />

      {/* ── header ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/projects" style={{ color: 'var(--text)', fontSize: 20 }}>←</Link>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 16 }}>{project.title}</div>
            {project.description && <div style={{ fontSize: 12, color: 'var(--text)' }}>{project.description}</div>}
          </div>
          {isOwner && <Badge color="owner">Owner</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>{user.full_name || user.email}</span>
          <button type="button" onClick={() => logout().then(() => navigate('/'))}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      {/* ── tabs ── */}
      <nav style={{ display: 'flex', gap: 4, padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        {tabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ padding: '6px 18px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: tab === t ? 'var(--accent-bg)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text)', transition: 'all 0.18s' }}>
            {t}
          </button>
        ))}
      </nav>

      <main style={{ padding: '28px 24px', flex: 1, textAlign: 'left', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ════════ SYLLABUS TAB ════════ */}
        {tab === 'syllabus' && (
          <div>
            {/* view mode toggle (owner only) */}
            {isOwner && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text)', marginRight: 4 }}>View:</span>
                {['ui', 'md'].map((m) => (
                  <button key={m} type="button" onClick={() => setSyllabusMode(m)}
                    style={{ padding: '4px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', cursor: 'pointer', background: syllabusMode === m ? 'var(--accent)' : 'transparent', color: syllabusMode === m ? '#fff' : 'var(--text)', transition: 'all 0.18s' }}>
                    {m === 'ui' ? '🧩 UI' : '📝 Markdown'}
                  </button>
                ))}
              </div>
            )}

            {/* ── MD MODE ── */}
            {syllabusMode === 'md' && isOwner && (
              <div style={{ borderRadius: 12, border: '1.5px solid var(--accent-border)', background: 'var(--code-bg)', padding: 20, marginBottom: 20 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text)' }}>
                  Use <code style={{ fontSize: 12 }}># Topic Title</code> for topics and <code style={{ fontSize: 12 }}>- subtopic</code> for subtopics:
                </p>
                <textarea value={mdText} onChange={(e) => setMdText(e.target.value)}
                  placeholder={'# Variables & Data Types\n- let, const, var\n- Primitive vs Reference\n\n# Functions\n- Arrow functions\n- Closures'}
                  rows={12}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontFamily: 'var(--mono)', fontSize: 13, resize: 'vertical', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button type="button" onClick={saveMdSyllabus} disabled={mdSaving || !mdText.trim()}
                    style={{ padding: '8px 22px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, cursor: mdSaving || !mdText.trim() ? 'not-allowed' : 'pointer', opacity: mdSaving || !mdText.trim() ? 0.6 : 1 }}>
                    {mdSaving ? 'Importing…' : 'Import Syllabus'}
                  </button>
                  <button type="button" onClick={() => { setMdText(''); setSyllabusMode('ui'); }}
                    style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── UI MODE ── */}
            {syllabusMode === 'ui' && (
              <>
                {topics.length === 0 && !showAddTopic && (
                  <div style={{ padding: 40, textAlign: 'center', borderRadius: 12, border: '2px dashed var(--border)', color: 'var(--text)' }}>
                    {isOwner ? 'No topics yet. Use 🧩 UI mode or 📝 Markdown mode to build your syllabus.' : 'No syllabus added yet.'}
                  </div>
                )}

                {topics.map((topic) => {
                  const pt = progress?.topics?.find((t) => t.id === topic.id);
                  const allMyDone = myTopicAllDone(topic.id);
                  const alreadyCompleted = myTopicCompleted(topic.id);
                  // who completed this topic (proof uploaded)
                  const topicCompletors = Object.entries(pt?.completions || {}).filter(([, v]) => v.is_completed).map(([uid]) => uid);
                  return (
                    <div key={topic.id} style={{ marginBottom: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      {/* topic header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--code-bg)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-h)' }}>{topic.title}</h2>
                          {/* avatars of who uploaded notes */}
                          {topicCompletors.length > 0 && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {topicCompletors.map((uid) => (
                                <Avatar key={uid} name={memberMap[uid] || uid} size={22} title={`${memberMap[uid] || 'Someone'} — notes uploaded ✓`} />
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* upload notes button */}
                          {allMyDone && !alreadyCompleted && (
                            <button type="button" onClick={() => triggerUpload(topic.id)}
                              style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                              📎 Upload Notes
                            </button>
                          )}
                          {alreadyCompleted && (
                            <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Completed</span>
                          )}
                          {isOwner && (
                            <IconBtn title="Delete topic" danger onClick={() => deleteTopic(topic.id, topic.title)}>✕</IconBtn>
                          )}
                        </div>
                      </div>

                      {/* subtopics */}
                      <div style={{ padding: '10px 18px 14px' }}>
                        {(topic.subtopics || []).length === 0 && (
                          <p style={{ fontSize: 13, color: 'var(--text)', opacity: 0.6, margin: '6px 0' }}>No subtopics yet.</p>
                        )}
                        {(topic.subtopics || []).map((st) => {
                          const comp = pt?.subtopics?.find((s) => s.id === st.id)?.completions || {};
                          const myDone = comp[user.id]?.is_completed;
                          const completors = Object.entries(comp).filter(([, v]) => v.is_completed).map(([uid]) => uid);
                          return (
                            <div key={st.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                {/* my checkbox */}
                                <button type="button" onClick={() => toggleComplete(st.id, myDone)}
                                  title={myDone ? 'Mark incomplete' : 'Mark complete'}
                                  style={{ width: 22, height: 22, borderRadius: 5, border: 'none', flexShrink: 0, background: myDone ? 'var(--accent)' : 'transparent', border: myDone ? 'none' : '2px solid var(--border)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
                                  {myDone ? '✓' : ''}
                                </button>
                                <span style={{ fontSize: 14, color: 'var(--text-h)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {st.title}
                                </span>
                                {/* who completed this subtopic */}
                                {completors.length > 0 && (
                                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                    {completors.map((uid) => (
                                      <Avatar key={uid} name={memberMap[uid] || uid} size={20} title={`${memberMap[uid] || 'Someone'} ✓`} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              {isOwner && (
                                <IconBtn title="Delete subtopic" danger onClick={() => deleteSubtopic(topic.id, st.id, st.title)}>✕</IconBtn>
                              )}
                            </div>
                          );
                        })}

                        {isOwner && (
                          addSubtopicFor === topic.id ? (
                            <InlineForm placeholder="Subtopic title…" onSave={(t) => addSubtopic(topic.id, t)} onCancel={() => setAddSubtopicFor(null)} />
                          ) : (
                            <button type="button" onClick={() => { setAddSubtopicFor(topic.id); setShowAddTopic(false); }}
                              style={{ marginTop: 10, padding: '5px 12px', borderRadius: 7, fontSize: 12, background: 'transparent', border: '1px dashed var(--border)', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
                              ＋ Add Subtopic
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}

                {isOwner && (
                  showAddTopic ? (
                    <div style={{ padding: '16px 18px', borderRadius: 12, border: '1.5px dashed var(--accent-border)', background: 'var(--accent-bg)' }}>
                      <InlineForm placeholder="Topic title…" onSave={addTopic} onCancel={() => setShowAddTopic(false)} />
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setShowAddTopic(true); setAddSubtopicFor(null); }}
                      style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 14, background: 'var(--accent-bg)', border: '1.5px dashed var(--accent-border)', color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }}>
                      ＋ Add Topic
                    </button>
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* ════════ MEMBERS TAB ════════ */}
        {tab === 'members' && (
          <div>
            {isOwner && (
              <div style={{ padding: '20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>Invite a teammate</h2>
                <form onSubmit={sendInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input type="email" value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteErr(''); }}
                    placeholder="teammate@email.com" required
                    style={{ flex: '1 1 220px', padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${inviteErr ? '#dc2626' : 'var(--border)'}`, background: 'var(--code-bg)', color: 'var(--text-h)', outline: 'none', fontSize: 14 }} />
                  <button type="submit" disabled={inviting}
                    style={{ padding: '9px 22px', borderRadius: 8, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.7 : 1, fontSize: 14 }}>
                    {inviting ? 'Sending…' : 'Send Invite'}
                  </button>
                </form>
                {inviteErr && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>⚠ {inviteErr}</p>}
              </div>
            )}

            <section style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>Members ({members.length})</h2>
              <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                {members.map((m, i) => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={m.full_name || m.email} size={36} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>
                          {m.full_name || '—'}{m.user_id === user.id && <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 6, fontWeight: 400 }}>(you)</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{m.email || ''}</div>
                      </div>
                    </div>
                    <Badge color={m.role}>{m.role}</Badge>
                  </div>
                ))}
              </div>
            </section>

            {isOwner && (
              <section>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>Invites {invites.length > 0 && `(${invites.length})`}</h2>
                {invites.length === 0 ? (
                  <div style={{ padding: 24, borderRadius: 12, textAlign: 'center', border: '1px dashed var(--border)', color: 'var(--text)', opacity: 0.6, fontSize: 14 }}>No invites sent yet.</div>
                ) : (
                  <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    {invites.map((inv, i) => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < invites.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--bg)' }}>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-h)', fontSize: 14 }}>{inv.invited_email}</div>
                          <div style={{ fontSize: 11, color: 'var(--text)' }}>Invited {new Date(inv.created_at).toLocaleDateString()}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Badge color={inv.status}>{inv.status}</Badge>
                          {inv.status === 'pending' && <IconBtn title="Cancel" danger onClick={() => cancelInvite(inv.id)}>✕</IconBtn>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ════════ NOTES TAB ════════ */}
        {tab === 'notes' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: 'var(--text-h)' }}>Study Notes</h2>
            {topics.length === 0 && <p style={{ color: 'var(--text)', opacity: 0.6 }}>No topics in this project yet.</p>}
            {topics.map((topic) => {
              const notes = allNotes[topic.id] || [];
              if (notes.length === 0) return null;
              return (
                <div key={topic.id} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', marginBottom: 12, padding: '8px 14px', background: 'var(--code-bg)', borderRadius: 8, display: 'inline-block' }}>
                    📚 {topic.title}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    {notes.map((n) => (
                      <div key={n.user_id} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={n.full_name || n.user_id} size={32} />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>{n.full_name || 'Unknown'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text)' }}>{new Date(n.uploaded_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Badge color={n.notes_type === 'pdf' ? 'pdf' : 'image'}>{n.notes_type === 'pdf' ? '📄 PDF' : '🖼 Image'}</Badge>
                          {n.signed_url && (
                            <a href={n.signed_url} target="_blank" rel="noreferrer"
                              style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', padding: '4px 12px', borderRadius: 6, border: '1px solid var(--accent-border)', background: 'var(--accent-bg)' }}>
                              View →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {topics.every((t) => !(allNotes[t.id] || []).length) && topics.length > 0 && (
              <div style={{ padding: 40, textAlign: 'center', borderRadius: 12, border: '2px dashed var(--border)', color: 'var(--text)', opacity: 0.6 }}>
                No notes uploaded yet. Complete all subtopics in a topic to unlock the upload button.
              </div>
            )}
          </div>
        )}

        {/* ════════ DASHBOARD TAB ════════ */}
        {tab === 'dashboard' && (
          <div>
            {tab === 'dashboard' && !dashboard && (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text)', opacity: 0.5 }}>Loading stats…</div>
            )}
            {dashboard && (
              <>
                {/* summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 32 }}>
                  {[
                    { label: 'Topics', value: dashboard.project?.total_topics ?? 0, icon: '📖' },
                    { label: 'Subtopics', value: dashboard.project?.total_subtopics ?? 0, icon: '📝' },
                    { label: 'Members', value: members.length, icon: '👥' },
                  ].map((card) => (
                    <div key={card.label} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', padding: '18px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: 28 }}>{card.icon}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-h)', lineHeight: 1.1, marginTop: 6 }}>{card.value}</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 4 }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* leaderboard */}
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>🏆 Leaderboard</h2>
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 32 }}>
                  {(dashboard.leaderboard || []).map((m, i) => {
                    const barColors = ['#f59e0b', '#94a3b8', '#cd7c4c'];
                    const rankColor = barColors[i] || 'var(--accent)';
                    return (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < dashboard.leaderboard.length - 1 ? '1px solid var(--border)' : 'none', background: m.user_id === user.id ? 'var(--accent-bg)' : 'var(--bg)' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: rankColor, width: 28, textAlign: 'center', flexShrink: 0 }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${m.rank}`}
                        </div>
                        <Avatar name={m.full_name} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>
                              {m.full_name || 'Unknown'}{m.user_id === user.id && <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 6 }}>(you)</span>}
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>{m.completion_percentage.toFixed(1)}%</span>
                          </div>
                          <ProgressBar pct={m.completion_percentage} color={m.user_id === user.id ? 'var(--accent)' : rankColor} />
                          <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 4 }}>
                            {m.subtopics_completed}/{m.subtopics_total} subtopics · {m.topics_completed}/{m.topics_total} topics with notes
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* last activity */}
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>📅 Last Activity</h2>
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {(dashboard.members || []).sort((a, b) => new Date(b.last_activity || 0) - new Date(a.last_activity || 0)).map((m, i, arr) => (
                    <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--bg)' }}>
                      <Avatar name={m.full_name} size={30} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>{m.full_name || 'Unknown'}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text)' }}>
                        {m.last_activity ? `Last active ${new Date(m.last_activity).toLocaleDateString()}` : 'No activity yet'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'success' })} />
    </div>
  );
}
