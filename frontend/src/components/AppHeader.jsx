import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Shared header for Projects, Profile, Invitations, and ProjectDetail.
 * Streak & invite badge come from AuthContext (one batch fetch; not repeated on every route change).
 * Updates on login and on `STREAK_REFRESH_EVENT` via `refreshHeaderStats`.
 */
export default function AppHeader({
  user,
  onLogout,
  variant = 'main', // 'main' | 'invitations' | 'project'
  projectTitle,
  projectDescription,
  badge,
  onDeleteProject,
}) {
  const location = useLocation();
  const { headerStreak, pendingInvites } = useAuth();

  const isProfile = location.pathname === '/profile';
  const isProjects = location.pathname === '/projects';

  return (
    <header
      className="app-header"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
        {variant === 'project' ? (
          <>
            <Link to="/projects" style={{ color: 'var(--text)', fontSize: 20, flexShrink: 0 }} title="Back to projects">
              ←
            </Link>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 16, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {projectTitle}
              </div>
              {projectDescription && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{projectDescription}</div>}
            </div>
            {badge}
          </>
        ) : variant === 'invitations' ? (
          <>
            <Link to="/projects" style={{ color: 'var(--text)', fontSize: 20, lineHeight: 1 }}>←</Link>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-h)' }}>My Invitations</h1>
          </>
        ) : (
          <>
            <Link to="/projects" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
              <span style={{ fontSize: 20 }}>📚</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-h)', letterSpacing: '-0.02em' }}>StudySync</span>
            </Link>
            <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Link
                to="/projects"
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: isProjects ? 600 : 500,
                  color: isProjects ? 'var(--accent)' : 'var(--text-muted)',
                  background: isProjects ? 'var(--accent-dim)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                Projects
              </Link>
              <Link
                to="/profile"
                style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius)',
                  fontSize: 13,
                  fontWeight: isProfile ? 600 : 500,
                  color: isProfile ? 'var(--accent)' : 'var(--text-muted)',
                  background: isProfile ? 'var(--accent-dim)' : 'transparent',
                  textDecoration: 'none',
                }}
              >
                Profile
              </Link>
            </nav>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        {variant !== 'invitations' && (
          <Link
            to="/invitations"
            title="My Invitations"
            style={{
              position: 'relative',
              fontSize: 18,
              textDecoration: 'none',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.9,
            }}
          >
            🔔
            {pendingInvites > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 99,
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {pendingInvites}
              </span>
            )}
          </Link>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.2 }}>
            {user?.full_name || user?.email}
          </span>
          <span style={{
            fontSize: 12, color: headerStreak > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }} title="Consecutive days with activity">
            🔥 {headerStreak} day{headerStreak !== 1 ? 's' : ''} streak
          </span>
        </div>
        {variant === 'project' && onDeleteProject && (
          <button
            type="button"
            onClick={onDeleteProject}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius)',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--danger-dim)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: 'var(--danger)',
            }}
          >
            Delete Project
          </button>
        )}
        <button
          type="button"
          onClick={() => onLogout?.()}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            fontWeight: 500,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
