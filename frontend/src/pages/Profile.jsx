import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import AppHeader from '../components/AppHeader';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';

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

function PersonalHeatmap({ heatmap }) {
  const TODAY = new Date();
  const WEEKS = 26;
  const TOTAL_DAYS = WEEKS * 7;
  const maxVal = Math.max(1, ...Object.values(heatmap || {}));

  function getColor(count) {
    if (!count) return 'var(--border)';
    const intensity = count / maxVal;
    if (intensity < 0.25) return 'rgba(34,211,238,0.25)';
    if (intensity < 0.5) return 'rgba(34,211,238,0.5)';
    if (intensity < 0.75) return 'rgba(34,211,238,0.75)';
    return 'var(--accent)';
  }

  const days = [];
  for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ dateStr, count: (heatmap || {})[dateStr] || 0 });
  }

  const firstDow = new Date(days[0].dateStr).getDay();
  const padded = [...Array(firstDow).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

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
    <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: 28, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-h)' }}>📅 Your activity</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Less</span>
          {['var(--border)','rgba(34,211,238,0.25)','rgba(34,211,238,0.5)','rgba(34,211,238,0.75)','var(--accent)'].map((c,i) => (
            <div key={i} style={{ width: 11, height: 11, borderRadius: 2, background: c, border: '1px solid rgba(0,0,0,0.06)' }} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div style={{ display: 'flex', marginBottom: 4, paddingLeft: 22 }}>
        {weeks.map((_, wi) => {
          const ml = monthLabels.find(m => m.wi === wi);
          return <div key={wi} style={{ width: 13, marginRight: 2, fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{ml?.label || ''}</div>;
        })}
      </div>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
          {['','M','','W','','F',''].map((d, i) => (
            <div key={i} style={{ height: 11, fontSize: 9, color: 'var(--text-muted)', lineHeight: '11px', width: 14, textAlign: 'right' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {weeks.map((wk, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {wk.map((day, di) => (
                <div
                  key={di}
                  onMouseEnter={day ? (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ x: rect.left, y: rect.top - 36, text: `${day.dateStr}: ${day.count} completion${day.count !== 1 ? 's' : ''}` });
                  } : undefined}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    width: 11, height: 11, borderRadius: 2,
                    background: day ? getColor(day.count) : 'transparent',
                    border: day ? '1px solid rgba(0,0,0,0.06)' : 'none',
                    cursor: day ? 'pointer' : 'default',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 10px', fontSize: 11,
          color: 'var(--text-h)', zIndex: 9999, pointerEvents: 'none',
          boxShadow: 'var(--shadow)',
        }}>{tooltip.text}</div>
      )}
    </div>
  );
}

function DayDrawer({ cell, trigger }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 9, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, textAlign: 'left', fontWeight: 600,
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
              padding: 24, maxWidth: 360, width: '100%', maxHeight: '80vh', overflow: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-h)' }}>
                {format(cell.date, 'EEEE, MMM d, yyyy')}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cell.items.map((it, j) => (
                <div
                  key={j}
                  style={{
                    padding: '12px 14px', borderRadius: 'var(--radius)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    fontSize: 14, color: 'var(--text-h)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{it.subtopic || it.topic}</div>
                  {it.subtopic && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{it.topic}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{it.project}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CalendarGrid({ byDate, currentMonth, onMonthChange }) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const rows = [];
  let days = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const items = (byDate || {})[dateStr] || [];
      days.push({ date: day, dateStr, items, isCurrentMonth: isSameMonth(day, monthStart) });
      day = addDays(day, 1);
    }
    rows.push(days);
    days = [];
  }

  return (
    <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px', marginBottom: 28, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-h)' }}>📆 Calendar</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            style={{ width: 32, height: 32, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', cursor: 'pointer', fontSize: 14 }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-h)', minWidth: 120, textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button type="button" onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            style={{ width: 32, height: 32, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', cursor: 'pointer', fontSize: 14 }}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, overflowX: 'auto' }} className="calendar-grid">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{ padding: '6px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{d}</div>
        ))}
        {rows.flat().map((cell, i) => (
          <div
            key={i}
            style={{
              minHeight: 64,
              padding: 6,
              borderRadius: 6,
              background: cell.isCurrentMonth ? 'var(--bg-elevated)' : 'var(--bg)',
              opacity: cell.isCurrentMonth ? 1 : 0.5,
              border: isToday(cell.date) ? '2px solid var(--accent)' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)', marginBottom: 4 }}>{format(cell.date, 'd')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 48, overflow: 'hidden' }}>
              {cell.items.slice(0, 3).map((it, j) => (
                <div key={j} style={{ fontSize: 9, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={`${it.topic}${it.subtopic ? ` — ${it.subtopic}` : ''} (${it.project})`}>
                  {it.subtopic || it.topic}
                </div>
              ))}
              {cell.items.length > 3 && (
                <DayDrawer cell={cell} trigger={`+${cell.items.length - 3} more`} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/users/me/profile');
      const payload = (r && typeof r === 'object' && r.data !== undefined) ? r.data : (r && typeof r === 'object') ? r : {};
      setData(payload);
    } catch (_) { setData({ heatmap: {}, completed: [], byDate: {} }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (!user) { navigate('/login'); return null; }

  return (
    <>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <AppHeader user={user} streak={data?.streak} onLogout={() => logout().then(() => navigate('/'))} />

        <main style={{ flex: 1, maxWidth: 900, width: '100%', margin: '0 auto', padding: 'clamp(16px, 4vw, 40px) clamp(12px, 4vw, 28px)', boxSizing: 'border-box' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 600, color: 'var(--text-h)' }}>Your profile</h1>
          <p style={{ margin: '0 0 28px', color: 'var(--text-muted)', fontSize: 14 }}>Your activity across all projects</p>

          {loading ? (
            <div>
              <Skeleton h={140} r={12} style={{ marginBottom: 28 }} />
              <Skeleton h={280} r={12} style={{ marginBottom: 28 }} />
              <Skeleton w={180} h={20} r={6} style={{ marginBottom: 16 }} />
              {[1,2,3,4,5,6,7,8].map(i => (
                <Skeleton key={i} w="100%" h={44} r={8} style={{ marginBottom: 8 }} />
              ))}
            </div>
          ) : (
            <>
              <PersonalHeatmap heatmap={data?.heatmap} />

              {/* Nudge: always shown — nextUp (priority), appreciation, or fallback */}
              <div style={{
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-border)',
                background: 'var(--accent-dim)', padding: '16px 20px', marginBottom: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              }}>
                {data?.nextUp ? (
                  <>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Next up
                      </div>
                      <p style={{ margin: 0, fontSize: 15, color: 'var(--text-h)', fontWeight: 500 }}>
                        In <strong>{data.nextUp.project}</strong>: you're <strong>{data.nextUp.remaining} subtopic{data.nextUp.remaining !== 1 ? 's' : ''}</strong> away from finishing <strong>{data.nextUp.topic}</strong>
                        {data.nextUp.done != null && data.nextUp.total != null && (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({data.nextUp.done}/{data.nextUp.total})</span>
                        )}.
                      </p>
                    </div>
                    <Link
                      to={`/projects/${data.nextUp.projectId}`}
                      style={{
                        padding: '10px 20px', borderRadius: 'var(--radius)', fontWeight: 600,
                        background: 'var(--accent)', color: 'var(--bg)', textDecoration: 'none', fontSize: 14,
                      }}
                    >
                      Continue →
                    </Link>
                  </>
                ) : data?.recentTopicCompletion ? (
                  <>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        🎉 Well done!
                      </div>
                      <p style={{ margin: 0, fontSize: 15, color: 'var(--text-h)', fontWeight: 500 }}>
                        You completed the whole topic <strong>{data.recentTopicCompletion.topic}</strong> in <strong>{data.recentTopicCompletion.project}</strong>
                        {data.recentTopicCompletion.date === format(new Date(), 'yyyy-MM-dd') ? ' today' : ''}!
                      </p>
                    </div>
                    <Link
                      to="/projects"
                      style={{
                        padding: '10px 20px', borderRadius: 'var(--radius)', fontWeight: 600,
                        background: 'var(--accent)', color: 'var(--bg)', textDecoration: 'none', fontSize: 14,
                      }}
                    >
                      View projects →
                    </Link>
                  </>
                ) : (data?.completed?.length > 0) ? (
                  <>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Keep going
                      </div>
                      <p style={{ margin: 0, fontSize: 15, color: 'var(--text-h)', fontWeight: 500 }}>
                        You've completed {data.completed.length} item{data.completed.length !== 1 ? 's' : ''}. Continue studying to finish your next topic.
                      </p>
                    </div>
                    <Link
                      to="/projects"
                      style={{
                        padding: '10px 20px', borderRadius: 'var(--radius)', fontWeight: 600,
                        background: 'var(--accent)', color: 'var(--bg)', textDecoration: 'none', fontSize: 14,
                      }}
                    >
                      Go to projects →
                    </Link>
                  </>
                ) : (
                  <>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Get started
                      </div>
                      <p style={{ margin: 0, fontSize: 15, color: 'var(--text-h)', fontWeight: 500 }}>
                        Pick a project and start studying to see your progress here.
                      </p>
                    </div>
                    <Link
                      to="/projects"
                      style={{
                        padding: '10px 20px', borderRadius: 'var(--radius)', fontWeight: 600,
                        background: 'var(--accent)', color: 'var(--bg)', textDecoration: 'none', fontSize: 14,
                      }}
                    >
                      Go to projects →
                    </Link>
                  </>
                )}
              </div>

              <CalendarGrid
                byDate={data?.byDate}
                currentMonth={calendarMonth}
                onMonthChange={setCalendarMonth}
              />

              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-h)' }}>Topics covered</h2>
              {(data?.completed || []).length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: 14 }}>
                  No completions yet. Start studying in a project to see your progress here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(data?.completed || []).map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '12px 16px', borderRadius: 'var(--radius)',
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, minWidth: 90 }}>
                        {item.date}
                      </span>
                      <span style={{ fontSize: 14, color: 'var(--text-h)', fontWeight: 500 }}>
                        {item.topic}{item.subtopic ? ` — ${item.subtopic}` : ''}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {item.project}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
