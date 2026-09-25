import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h2 style={{ color: 'var(--primary)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 400 }}>An unexpected error occurred. Try reloading the page — if it persists, please contact support.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}
