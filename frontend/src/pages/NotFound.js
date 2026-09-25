import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 64 }}>🔍</div>
      <h1 style={{ fontSize: 24, color: 'var(--primary)' }}>Page Not Found</h1>
      <p style={{ color: 'var(--text-muted)' }}>The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary">Go Home</Link>
    </div>
  );
}
