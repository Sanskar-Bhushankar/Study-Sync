import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 600 }}>StudySync</span>
        <nav>
          <Link to="/login" style={{ marginRight: 12 }}>Sign In</Link>
          <Link to="/register">Sign Up</Link>
        </nav>
      </header>
      <main style={{ padding: 24 }}>
        <h1>StudySync</h1>
        <p>Collaborative study progress tracker.</p>
      </main>
    </div>
  );
}
