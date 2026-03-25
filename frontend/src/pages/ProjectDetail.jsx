import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import AppHeader from '../components/AppHeader';
import { notifyStreakMayHaveChanged } from '../streakRefresh';

/* ─── Avatar chip ─── */
function Avatar({ name, size = 24, title }) {
  const initials = (name || '?')[0].toUpperCase();
  const colors = ['#22d3ee','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <span title={title || name} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: '50%',
      background: color + '25', border: `2px solid ${color}60`,
      fontSize: size * 0.42, fontWeight: 600, color,
      flexShrink: 0, cursor: 'default',
    }}>{initials}</span>
  );
}

/* ─── Badge ─── */
function Badge({ children, color }) {
  const map = {
    owner:    { bg: 'var(--accent-dim)', text: 'var(--accent)' },
    member:   { bg: 'var(--bg-hover)', text: 'var(--text)' },
    pending:  { bg: 'rgba(234,179,8,0.12)', text: 'var(--warning)' },
    accepted: { bg: 'var(--success-dim)', text: 'var(--success)' },
    declined: { bg: 'var(--danger-dim)', text: 'var(--danger)' },
    pdf:      { bg: 'var(--danger-dim)', text: 'var(--danger)' },
    image:    { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
  };
  const c = map[color] || map.member;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 6, background: c.bg, color: c.text,
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
      padding: '14px 20px', borderRadius: 'var(--radius)', maxWidth: 340,
      background: isErr ? 'var(--danger-dim)' : 'var(--success-dim)',
      color: isErr ? 'var(--danger)' : 'var(--success)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
      fontWeight: 500, boxShadow: 'var(--shadow-lg)', fontSize: 14,
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
        style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-h)' }} />
      <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? '…' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}>
        Cancel
      </button>
    </form>
  );
}

/* ─── Icon button ─── */
function IconBtn({ onClick, title, danger, children }) {
  return (
    <button type="button" title={title} onClick={onClick}
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: danger ? 'var(--danger)' : 'var(--text)', fontSize: 13, opacity: 0.7, transition: 'all 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = danger ? 'var(--danger-dim)' : 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent'; }}
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

/* ─── Skeleton ─── */
function Skeleton({ w = '100%', h = 16, r = 6, style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--border) 25%, var(--code-bg) 50%, var(--border) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
      ...extra,
    }} />
  );
}

/* ─── Dashboard Skeleton ─── */
function DashboardSkeleton() {
  return (
    <div>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {/* contribution graph skeleton */}
      <Skeleton h={110} r={12} style={{ marginBottom: 28 }} />
      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ borderRadius: 12, border: '1px solid var(--border)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <Skeleton w={36} h={36} r={8} />
            <Skeleton w="60%" h={22} r={6} />
            <Skeleton w="80%" h={12} r={4} />
          </div>
        ))}
      </div>
      {/* leaderboard skeleton */}
      <Skeleton w={160} h={18} r={6} style={{ marginBottom: 14 }} />
      <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 28 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton w={28} h={28} r={14} />
            <Skeleton w={34} h={34} r={17} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Skeleton w="40%" h={12} r={4} />
              <Skeleton w="100%" h={6} r={3} />
              <Skeleton w="60%" h={10} r={4} />
            </div>
            <Skeleton w={40} h={18} r={4} />
          </div>
        ))}
      </div>
      {/* activity table skeleton */}
      <Skeleton w={140} h={18} r={6} style={{ marginBottom: 14 }} />
      <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
            <Skeleton w={30} h={30} r={15} />
            <Skeleton w="30%" h={12} r={4} />
            <div style={{ flex: 1 }} />
            <Skeleton w={120} h={10} r={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Notes tab skeleton ─── */
function NotesSkeleton() {
  return (
    <div>
      <Skeleton w={140} h={20} r={6} style={{ marginBottom: 20 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton w={180} h={36} r={8} style={{ marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {[1, 2].map((j) => (
                <div key={j} style={{ borderRadius: 12, border: '1px solid var(--border)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Skeleton w={32} h={32} r={16} />
                    <div style={{ flex: 1 }}>
                      <Skeleton w="70%" h={14} r={4} style={{ marginBottom: 6 }} />
                      <Skeleton w="40%" h={10} r={4} />
                    </div>
                  </div>
                  <Skeleton w={60} h={20} r={6} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Members tab skeleton ─── */
function MembersSkeleton() {
  return (
    <div>
      <Skeleton w={120} h={18} r={6} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <Skeleton w={40} h={40} r={20} />
            <div style={{ flex: 1 }}>
              <Skeleton w="40%" h={14} r={4} style={{ marginBottom: 6 }} />
              <Skeleton w="30%" h={10} r={4} />
            </div>
            <Skeleton w={52} h={20} r={10} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── GitHub-style contribution graph ─── */
function ContributionGraph({ timeline, members: memberList, memberMap }) {
  const TODAY = new Date();
  const WEEKS = 26;
  const TOTAL_DAYS = WEEKS * 7;

  // Build a map of date → total completions across all users
  const dateTotals = {};
  Object.values(timeline || {}).forEach((entries) => {
    if (!Array.isArray(entries)) return;
    let prev = 0;
    entries.forEach(({ date, cumulative_subtopics }) => {
      const daily = cumulative_subtopics - prev;
      prev = cumulative_subtopics;
      dateTotals[date] = (dateTotals[date] || 0) + Math.max(0, daily);
    });
  });

  // Build a per-user daily map
  const userDailyMap = {};
  Object.entries(timeline || {}).forEach(([uid, entries]) => {
    if (!Array.isArray(entries)) return;
    userDailyMap[uid] = {};
    let prev = 0;
    entries.forEach(({ date, cumulative_subtopics }) => {
      const daily = cumulative_subtopics - prev;
      prev = cumulative_subtopics;
      userDailyMap[uid][date] = Math.max(0, daily);
    });
  });

  const maxVal = Math.max(1, ...Object.values(dateTotals));

  function getColor(count) {
    if (!count) return 'var(--border)';
    const intensity = count / maxVal;
    if (intensity < 0.25) return 'rgba(34,211,238,0.25)';
    if (intensity < 0.5)  return 'rgba(34,211,238,0.5)';
    if (intensity < 0.75) return 'rgba(34,211,238,0.75)';
    return 'var(--accent)';
  }

  // Build grid: columns = weeks (oldest left), rows = days (Sun→Sat)
  const days = [];
  for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ dateStr, count: dateTotals[dateStr] || 0 });
  }

  // Pad so grid starts on Sunday
  const firstDow = new Date(days[0].dateStr).getDay();
  const padded = [...Array(firstDow).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  // Month labels
  const monthLabels = [];
  weeks.forEach((wk, wi) => {
    const firstReal = wk.find(Boolean);
    if (firstReal) {
      const d = new Date(firstReal.dateStr);
      if (d.getDate() <= 7) {
        monthLabels.push({ wi, label: d.toLocaleString('default', { month: 'short' }) });
      }
    }
  });

  const [tooltip, setTooltip] = useState(null);

  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', padding: '18px 20px', marginBottom: 28, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-h)' }}>📅 Activity Heatmap</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text)' }}>
          <span>Less</span>
          {['var(--border)','rgba(34,211,238,0.25)','rgba(34,211,238,0.5)','rgba(34,211,238,0.75)','var(--accent)'].map((c,i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div style={{ position: 'relative', minWidth: 0 }}>
        {/* month labels row */}
        <div style={{ display: 'flex', marginBottom: 4, paddingLeft: 22 }}>
          {weeks.map((_, wi) => {
            const ml = monthLabels.find(m => m.wi === wi);
            return <div key={wi} style={{ width: 13, marginRight: 2, fontSize: 9, color: 'var(--text)', textAlign: 'left', flexShrink: 0 }}>{ml?.label || ''}</div>;
          })}
        </div>

        <div style={{ display: 'flex', gap: 0 }}>
          {/* day labels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, paddingTop: 0 }}>
            {['','M','','W','','F',''].map((d, i) => (
              <div key={i} style={{ height: 11, fontSize: 9, color: 'var(--text)', lineHeight: '11px', width: 14, textAlign: 'right' }}>{d}</div>
            ))}
          </div>

          {/* grid */}
          <div style={{ display: 'flex', gap: 2 }}>
            {weeks.map((wk, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {wk.map((day, di) => (
                  <div
                    key={di}
                    onMouseEnter={day ? (e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const who = Object.entries(userDailyMap)
                        .filter(([, m]) => m[day.dateStr] > 0)
                        .map(([uid, m]) => `${memberMap[uid] || uid}: ${m[day.dateStr]}`)
                        .join(', ');
                      setTooltip({ x: rect.left, y: rect.top - 40, text: `${day.dateStr}: ${day.count} completion${day.count !== 1 ? 's' : ''}${who ? ` (${who})` : ''}` });
                    } : undefined}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      width: 11, height: 11, borderRadius: 2,
                      background: day ? getColor(day.count) : 'transparent',
                      border: day ? '1px solid rgba(0,0,0,0.06)' : 'none',
                      cursor: day ? 'pointer' : 'default',
                      transition: 'transform 0.1s',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          background: 'var(--code-bg)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '5px 10px', fontSize: 11,
          color: 'var(--text-h)', zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxWidth: 280, whiteSpace: 'pre-wrap',
        }}>{tooltip.text}</div>
      )}
    </div>
  );
}

/* ─── Mini bar chart ─── */
function BarChart({ data, title, color = 'var(--accent)' }) {
  const maxVal = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px 18px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)', marginBottom: 14 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 9, color: 'var(--text)', fontWeight: 700 }}>{d.value > 0 ? d.value : ''}</div>
            <div style={{
              width: '100%', background: color, borderRadius: '3px 3px 0 0',
              height: `${(d.value / maxVal) * 100}%`, minHeight: d.value ? 4 : 0,
              transition: 'height 0.4s ease', opacity: 0.85,
            }} />
            <div style={{ fontSize: 9, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Donut / ring chart ─── */
function RingChart({ pct, color = 'var(--accent)', label, sublabel }) {
  const r = 36, cx = 44, cy = 44, stroke = 8;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="var(--text-h)" fontSize={14} fontWeight={800}>{Math.round(pct)}%</text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)', textAlign: 'center' }}>{label}</div>
      {sublabel && <div style={{ fontSize: 11, color: 'var(--text)', textAlign: 'center' }}>{sublabel}</div>}
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

/** Single source of display order: `order_index` ascending (matches API). Backend assigns next index on create. */
function sortByOrderIndex(items) {
  return [...(items || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
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
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [allNotes, setAllNotes] = useState({}); // topicId → [completion]
  const [tab, setTab]           = useState('syllabus');
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState({ msg: '', type: 'success' });

  // syllabus mode: 'ui' | 'md'
  const [syllabusMode, setSyllabusMode]   = useState('ui');
  const [mdText, setMdText]               = useState('');
  const [mdSaving, setMdSaving]           = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [togglingSubtopicId, setTogglingSubtopicId] = useState(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

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
  const [inviteLoading, setInviteLoading] = useState(false);
  const loadInvites  = useCallback(async () => {
    setInviteLoading(true);
    try {
      const r = await api.get(`/projects/${projectId}/invites`);
      setInvites(r.data || []);
    } catch (_) { setInvites([]); }
    finally { setInviteLoading(false); }
  }, [projectId]);
  const loadDashboard = useCallback(() => {
    setDashboardLoading(true);
    return api.get(`/projects/${projectId}/dashboard`)
      .then((r) => setDashboard(r))
      .catch(() => {})
      .finally(() => setDashboardLoading(false));
  }, [projectId]);

  const loadAllNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const r = await api.get(`/projects/${projectId}/completions/all`);
      setAllNotes(r.data || {});
    } catch (_) { setAllNotes({}); }
    finally { setNotesLoading(false); }
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
  useEffect(() => {
    if (tab === 'notes') loadAllNotes();
  }, [tab, loadAllNotes]);

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
      const r = await api.post(`/projects/${projectId}/topics/bulk`, { topics: parsed });
      const { topics: topicCount, subtopics: subtopicCount } = r.data || {};
      await loadProgress();
      await loadTopics();
      setMdText('');
      setSyllabusMode('ui');
      showToast(`Imported ${topicCount} topic(s), ${subtopicCount} subtopic(s)!`);
    } catch (e) {
      const msg = e.error?.message || e.message || 'Import failed';
      showToast(msg, 'error');
    } finally { setMdSaving(false); }
  }

  async function toggleComplete(subtopicId, isCompleted) {
    setTogglingSubtopicId(subtopicId);
    try {
      if (isCompleted) await api.delete(`/projects/${projectId}/subtopics/${subtopicId}/complete`);
      else await api.post(`/projects/${projectId}/subtopics/${subtopicId}/complete`);
      notifyStreakMayHaveChanged();
      await loadProgress();
    } catch (e) { showToast(e.error?.message || 'Could not update progress', 'error'); }
    finally { setTogglingSubtopicId(null); }
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
    setUploadProgress(0);
    try {
      const r = await api.uploadWithProgress(`/projects/${projectId}/topics/${uploadingFor}/complete`, form, (pct) => setUploadProgress(pct));
      notifyStreakMayHaveChanged();
      await loadProgress();
      if (tab === 'notes') await loadAllNotes();
      showToast('Notes uploaded! Topic completed 🎉');
    } catch (e) {
      showToast(e.error?.message || e.response?.data?.error?.message || 'Upload failed', 'error');
    } finally {
      setUploadingFor(null);
      setUploadProgress(null);
    }
  }

  async function handleDeleteProject() {
    setDeletingProject(true);
    try {
      await api.delete(`/projects/${projectId}`);
      showToast('Project deleted');
      navigate('/projects');
    } catch (e) {
      showToast(e.error?.message || e.message || 'Failed to delete project', 'error');
      setDeletingProject(false);
      setShowDeleteModal(false);
    }
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
    <div style={{ minHeight: '100svh', background: 'var(--bg)' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton w={24} h={24} r={6} />
          <Skeleton w={140} h={18} r={6} />
        </div>
        <Skeleton w={80} h={32} r={7} />
      </div>
      {/* tabs skeleton */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        {[80, 80, 60, 90].map((w, i) => <Skeleton key={i} w={w} h={30} r={99} />)}
      </div>
      {/* content skeleton */}
      <div style={{ maxWidth: 800, margin: '28px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: 'var(--code-bg)', borderBottom: '1px solid var(--border)' }}>
              <Skeleton w="40%" h={16} r={5} />
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3].map(j => <Skeleton key={j} w={`${70 + j * 8}%`} h={12} r={4} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  if (!project) return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', padding: 48 }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Project not found or you don't have access.</p>
        <Link to="/projects" style={{ color: 'var(--accent)', fontWeight: 500 }}>← Back to Projects</Link>
      </div>
    </div>
  );

  const tabs = ['syllabus', 'members', 'notes', 'dashboard'];

  /* ══════════════ RENDER ══════════════ */
  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      {/* ── hidden file input ── */}
      <input ref={fileInputRef} type="file" accept=".pdf,image/jpeg,image/png" style={{ display: 'none' }} onChange={handleFileSelected} />

      <AppHeader
        user={user}
        variant="project"
        projectTitle={project.title}
        projectDescription={project.description}
        badge={isOwner && <Badge color="owner">Owner</Badge>}
        onDeleteProject={isOwner ? () => setShowDeleteModal(true) : undefined}
        onLogout={() => logout().then(() => navigate('/'))}
      />

      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: 28, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600, color: 'var(--text-h)' }}>Delete project?</h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}>
              Permanently delete <strong>"{project.title}"</strong>? This will remove all topics, subtopics, members, invites, and uploaded notes. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => !deletingProject && setShowDeleteModal(false)}
                disabled={deletingProject}
                style={{ padding: '9px 20px', borderRadius: 'var(--radius)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500 }}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteProject} disabled={deletingProject}
                style={{ padding: '9px 20px', borderRadius: 'var(--radius)', background: 'var(--danger)', color: '#fff', border: 'none', fontWeight: 600, opacity: deletingProject ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {deletingProject && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                {deletingProject ? 'Deleting…' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="dashboard-tabs" style={{ display: 'flex', gap: 4, padding: '12px clamp(12px, 3vw, 24px)', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        {tabs.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ padding: '8px 18px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: tab === t ? 'var(--accent-dim)' : 'transparent', color: tab === t ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {t}
          </button>
        ))}
      </nav>

      <main style={{ padding: 'clamp(16px, 4vw, 32px) clamp(12px, 4vw, 24px)', flex: 1, textAlign: 'left', maxWidth: 860, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

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
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text)' }}>
                  Use <code style={{ fontSize: 12 }}># Topic Title</code> for topics and <code style={{ fontSize: 12 }}>- subtopic</code> for subtopics:
                </p>
                <textarea value={mdText} onChange={(e) => setMdText(e.target.value)}
                  placeholder={'# Variables & Data Types\n- let, const, var\n- Primitive vs Reference\n\n# Functions\n- Arrow functions\n- Closures'}
                  rows={12}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-h)', fontFamily: 'var(--mono)', fontSize: 13, resize: 'vertical', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={saveMdSyllabus} disabled={mdSaving || !mdText.trim()}
                    style={{ padding: '8px 22px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 700, cursor: mdSaving || !mdText.trim() ? 'not-allowed' : 'pointer', opacity: mdSaving || !mdText.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {mdSaving && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                    {mdSaving ? 'Syncing to database…' : 'Import Syllabus'}
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

                {sortByOrderIndex(topics).map((topic) => {
                  const pt = progress?.topics?.find((t) => t.id === topic.id);
                  const subtopicsOrdered = sortByOrderIndex(topic.subtopics);
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
                            <button type="button" onClick={() => triggerUpload(topic.id)} disabled={uploadingFor === topic.id}
                              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', cursor: uploadingFor === topic.id ? 'wait' : 'pointer', opacity: uploadingFor === topic.id ? 0.9 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {uploadingFor === topic.id ? (
                                <>
                                  <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                  {uploadProgress != null ? `Uploading ${uploadProgress}%` : 'Uploading…'}
                                </>
                              ) : (
                                <>📎 Upload Notes</>
                              )}
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
                        {subtopicsOrdered.length === 0 && (
                          <p style={{ fontSize: 13, color: 'var(--text)', opacity: 0.6, margin: '6px 0' }}>No subtopics yet.</p>
                        )}
                        {subtopicsOrdered.map((st) => {
                          const comp = pt?.subtopics?.find((s) => s.id === st.id)?.completions || {};
                          const myDone = comp[user.id]?.is_completed;
                          const completors = Object.entries(comp).filter(([, v]) => v.is_completed).map(([uid]) => uid);
                          return (
                            <div key={st.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                {/* my checkbox */}
                                <button type="button" onClick={() => toggleComplete(st.id, myDone)} disabled={togglingSubtopicId === st.id}
                                  title={myDone ? 'Mark incomplete' : 'Mark complete'}
                                  style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: togglingSubtopicId === st.id ? 'var(--bg-hover)' : myDone ? 'var(--accent)' : 'transparent', border: togglingSubtopicId === st.id || !myDone ? '2px solid var(--border)' : 'none', color: '#fff', cursor: togglingSubtopicId === st.id ? 'wait' : 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.18s' }}>
                                  {togglingSubtopicId === st.id ? (
                                    <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                  ) : myDone ? '✓' : ''}
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
                    style={{ flex: '1 1 220px', padding: '9px 14px', borderRadius: 'var(--radius)', border: `1px solid ${inviteErr ? 'var(--danger)' : 'var(--border)'}`, background: 'var(--bg-elevated)', color: 'var(--text-h)', outline: 'none', fontSize: 14 }} />
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
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>Invites {!inviteLoading && invites.length > 0 && `(${invites.length})`}</h2>
                {inviteLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: '1px solid var(--border)' }}>
                        <Skeleton w={40} h={40} r={20} />
                        <div style={{ flex: 1 }}>
                          <Skeleton w="50%" h={14} r={4} style={{ marginBottom: 6 }} />
                          <Skeleton w="35%" h={10} r={4} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : invites.length === 0 ? (
                  <div style={{ padding: 24, borderRadius: 12, textAlign: 'center', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 14 }}>No invites sent yet.</div>
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

            {/* Danger zone — owner only */}
            {isOwner && (
              <section style={{ marginTop: 36, padding: 24, borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: '#dc2626' }}>Danger zone</h2>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text)', opacity: 0.9 }}>
                  Permanently delete this project, all topics, subtopics, members, invites, and uploaded notes. This cannot be undone.
                </p>
                <button type="button" onClick={() => setShowDeleteModal(true)}
                  style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer' }}>
                  Delete Project
                </button>
              </section>
            )}
          </div>
        )}

        {/* ════════ NOTES TAB ════════ */}
        {tab === 'notes' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: 'var(--text-h)' }}>Study Notes</h2>
            {notesLoading ? (
              <NotesSkeleton />
            ) : topics.length === 0 ? (
              <p style={{ color: 'var(--text)', opacity: 0.6 }}>No topics in this project yet.</p>
            ) : (
            <>
            {sortByOrderIndex(topics).map((topic) => {
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
            {topics.every((t) => !(allNotes[t.id] || []).length) && (
              <div style={{ padding: 40, textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                No notes uploaded yet. Complete all subtopics in a topic to unlock the upload button.
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* ════════ DASHBOARD TAB ════════ */}
        {tab === 'dashboard' && (
          <div>
            <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

            {dashboardLoading || !dashboard ? (
              <DashboardSkeleton />
            ) : (
              <>
                {/* ── Contribution / Activity Heatmap ── */}
                <ContributionGraph
                  timeline={dashboard.timeline}
                  members={dashboard.members}
                  memberMap={memberMap}
                />

                {/* ── Summary stat cards ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14, marginBottom: 28 }}>
                  {[
                    { label: 'Topics', value: dashboard.project?.total_topics ?? 0, icon: '📖', color: '#3b82f6' },
                    { label: 'Subtopics', value: dashboard.project?.total_subtopics ?? 0, icon: '📝', color: '#10b981' },
                    { label: 'Members', value: (dashboard.members || []).length, icon: '👥', color: '#f59e0b' },
                    { label: 'Completions', value: (dashboard.members || []).reduce((s, m) => s + m.subtopics_completed, 0), icon: '✅', color: 'var(--accent)' },
                  ].map((card) => (
                    <div key={card.label} style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)', padding: '18px 14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: 26 }}>{card.icon}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: card.color, lineHeight: 1.1, marginTop: 6 }}>{card.value}</div>
                      <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 4 }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── Ring charts row (per-member completion rings) ── */}
                {(dashboard.members || []).length > 0 && (
                  <>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>📊 Completion Overview</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 28 }}>
                      {(dashboard.members || []).map((m, i) => {
                        const ringColors = ['var(--accent)','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
                        return (
                          <RingChart
                            key={m.user_id}
                            pct={m.completion_percentage}
                            color={ringColors[i % ringColors.length]}
                            label={m.full_name?.split(' ')[0] || 'User'}
                            sublabel={`${m.subtopics_completed}/${m.subtopics_total}`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── Bar charts ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>
                  <BarChart
                    title="📝 Subtopics Completed per Member"
                    color="var(--accent)"
                    data={(dashboard.members || []).map(m => ({
                      label: m.full_name?.split(' ')[0] || 'User',
                      value: m.subtopics_completed,
                    }))}
                  />
                  <BarChart
                    title="📚 Topics with Notes per Member"
                    color="#3b82f6"
                    data={(dashboard.members || []).map(m => ({
                      label: m.full_name?.split(' ')[0] || 'User',
                      value: m.topics_completed,
                    }))}
                  />
                </div>

                {/* ── Leaderboard table ── */}
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>🏆 Leaderboard</h2>
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 28 }}>
                  {/* table header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 90px 90px 100px', gap: 0, padding: '9px 18px', background: 'var(--code-bg)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    <div>#</div><div>Member</div><div style={{ textAlign: 'center' }}>Subtopics</div><div style={{ textAlign: 'center' }}>Notes</div><div style={{ textAlign: 'right' }}>Progress</div>
                  </div>
                  {(dashboard.leaderboard || []).map((m, i) => {
                    const barColors = ['#f59e0b', '#94a3b8', '#cd7c4c'];
                    const rankColor = barColors[i] || 'var(--accent)';
                    const isMe = m.user_id === user.id;
                    return (
                      <div key={m.user_id} style={{ borderBottom: i < dashboard.leaderboard.length - 1 ? '1px solid var(--border)' : 'none', background: isMe ? 'var(--accent-bg)' : 'var(--bg)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 90px 90px 100px', gap: 0, padding: '12px 18px', alignItems: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: rankColor, textAlign: 'center' }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${m.rank}`}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <Avatar name={m.full_name} size={30} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.full_name || 'Unknown'}{isMe && <span style={{ fontSize: 10, color: 'var(--text)', marginLeft: 5 }}>(you)</span>}
                              </div>
                              {m.last_activity && (
                                <div style={{ fontSize: 10, color: 'var(--text)' }}>
                                  Active {new Date(m.last_activity).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-h)' }}>
                            {m.subtopics_completed}<span style={{ fontSize: 10, color: 'var(--text)', fontWeight: 400 }}>/{m.subtopics_total}</span>
                          </div>
                          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-h)' }}>
                            {m.topics_completed}<span style={{ fontSize: 10, color: 'var(--text)', fontWeight: 400 }}>/{m.topics_total}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isMe ? 'var(--accent)' : rankColor }}>{m.completion_percentage.toFixed(1)}%</span>
                            <div style={{ marginTop: 4 }}>
                              <ProgressBar pct={m.completion_percentage} color={isMe ? 'var(--accent)' : rankColor} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Head-to-head comparison table ── */}
                {(dashboard.members || []).length > 1 && (
                  <>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>⚔️ Head-to-Head Comparison</h2>
                    <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 28, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--code-bg)' }}>
                            <th style={{ padding: '9px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Member</th>
                            <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>% Done</th>
                            <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Subtopics</th>
                            <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Notes</th>
                            <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Remaining</th>
                            <th style={{ padding: '9px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(dashboard.leaderboard || []).map((m, i) => {
                            const remaining = m.subtopics_total - m.subtopics_completed;
                            const pct = m.completion_percentage;
                            const statusColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#ef4444';
                            const statusLabel = pct >= 80 ? 'On Track' : pct >= 50 ? 'In Progress' : 'Just Started';
                            return (
                              <tr key={m.user_id} style={{ background: m.user_id === user.id ? 'var(--accent-bg)' : i % 2 === 0 ? 'var(--bg)' : 'var(--code-bg)', borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '11px 18px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Avatar name={m.full_name} size={26} />
                                    <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{m.full_name || 'Unknown'}{m.user_id === user.id && <span style={{ fontSize: 10, color: 'var(--text)', marginLeft: 4 }}>(you)</span>}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '11px 12px', textAlign: 'center', fontWeight: 800, color: statusColor }}>{pct.toFixed(1)}%</td>
                                <td style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--text-h)' }}>{m.subtopics_completed}/{m.subtopics_total}</td>
                                <td style={{ padding: '11px 12px', textAlign: 'center', color: 'var(--text-h)' }}>{m.topics_completed}/{m.topics_total}</td>
                                <td style={{ padding: '11px 12px', textAlign: 'center', color: remaining > 0 ? '#ef4444' : '#16a34a', fontWeight: 700 }}>{remaining}</td>
                                <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: statusColor + '20', color: statusColor }}>{statusLabel}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ── Last Activity table ── */}
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: 'var(--text-h)' }}>⏱️ Recent Activity</h2>
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px', padding: '9px 18px', background: 'var(--code-bg)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    <div>Member</div><div style={{ textAlign: 'center' }}>Last Active</div><div style={{ textAlign: 'center' }}>Streak</div>
                  </div>
                  {(dashboard.members || [])
                    .slice()
                    .sort((a, b) => new Date(b.last_activity || 0) - new Date(a.last_activity || 0))
                    .map((m, i, arr) => {
                      const lastDate = m.last_activity ? new Date(m.last_activity) : null;
                      const daysAgo = lastDate ? Math.floor((Date.now() - lastDate) / 86400000) : null;
                      const streakColor = daysAgo === null ? 'var(--text)' : daysAgo === 0 ? '#16a34a' : daysAgo <= 2 ? '#f59e0b' : '#ef4444';
                      const streakLabel = daysAgo === null ? 'No activity' : daysAgo === 0 ? 'Today 🔥' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
                      return (
                        <div key={m.user_id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px', padding: '12px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', background: m.user_id === user.id ? 'var(--accent-bg)' : 'var(--bg)', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar name={m.full_name} size={30} />
                            <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 13 }}>
                              {m.full_name || 'Unknown'}{m.user_id === user.id && <span style={{ fontSize: 10, color: 'var(--text)', marginLeft: 5 }}>(you)</span>}
                            </span>
                          </div>
                          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text)' }}>
                            {lastDate ? lastDate.toLocaleDateString() : '—'}
                          </div>
                          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: streakColor }}>
                            {streakLabel}
                          </div>
                        </div>
                      );
                    })}
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
