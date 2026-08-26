import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1120',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '36px 28px',
            maxWidth: '480px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#F59E0B', marginBottom: '12px', fontSize: '1.35rem', fontWeight: '600' }}>
              Session or Cache Recovery Required
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
              {this.state.error?.message || 'A browser rendering error occurred.'}
            </p>
            <button
              onClick={this.handleReset}
              style={{
                background: 'linear-gradient(135deg, #0B1F4D, #F5A800)',
                color: '#fff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem',
                boxShadow: '0 4px 12px rgba(245, 168, 0, 0.3)'
              }}
            >
              Reset Session & Go to Login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
