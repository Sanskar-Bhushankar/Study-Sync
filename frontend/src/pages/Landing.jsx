import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
    }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-h)', letterSpacing: '-0.02em' }}>
          StudySync
        </span>
        <nav style={{ display: 'flex', gap: 8 }}>
          <Link to="/login" style={{
            padding: '8px 18px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 14,
            color: 'var(--text)', background: 'transparent', border: '1px solid var(--border)',
          }}>
            Sign In
          </Link>
          <Link to="/register" style={{
            padding: '8px 18px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 14,
            color: 'var(--bg)', background: 'var(--accent)', border: 'none',
          }}>
            Sign Up
          </Link>
        </nav>
      </header>

      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 48, textAlign: 'center', maxWidth: 560, margin: '0 auto',
      }}>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', fontWeight: 700, marginBottom: 16, letterSpacing: '-0.03em' }}>
          Study together. Stay accountable.
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text)', lineHeight: 1.6, marginBottom: 32 }}>
          Track progress, share syllabi, and build streaks with your study partner. DSA, JS, SQL — never drop the habit again.
        </p>
        <Link to="/register" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '14px 28px', borderRadius: 'var(--radius-lg)', fontWeight: 600, fontSize: 16,
          background: 'var(--accent)', color: 'var(--bg)', border: 'none',
          boxShadow: '0 4px 14px rgba(34, 211, 238, 0.3)',
        }}>
          Get started →
        </Link>
      </main>
    </div>
  );
}
