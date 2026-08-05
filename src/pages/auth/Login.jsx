/* ============================================================
   Page: Login.jsx
   Description: Admin login page with glassmorphism card and conditional 2FA OTP flow
   ============================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../../config/apiUrl';
import { setAuthData } from '../../utils/authStorage';

export default function Login() {
  const navigate = useNavigate();
  
  // Stacking steps: 'credentials' or 'otp'
  const [step, setStep] = useState('credentials');
  
  // Credentials Credentials Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP Verification Form State
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  
  // Common states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Submit Credentials (Step 1)
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('🔐 Login API Response:', data);
        if (data.requires2FA) {
          console.log('📩 2FA OTP (from API):', data.otp || data.code || 'Check email');
          localStorage.setItem('kfpl_tfa', 'true');
          // Switch to OTP step
          setStep('otp');
          setError('');
        } else {
          // No TFA, log in directly
          localStorage.setItem('kfpl_tfa', 'false');
          const adminObject = data.data?.user || data.data || data.admin || data.user || {};
          const storedAdmin = {
            ...adminObject,
            email: email, // ALWAYS use the typed email to log in
            name: adminObject.name || 'Super Admin',
            role: adminObject.role || 'super-admin',
            permissions: adminObject.permissions || null,
          };
          console.log('🔐 Storing kfpl_auth admin (direct):', storedAdmin);
          setAuthData({ 
            token: data.token, 
            admin: storedAdmin
          });
          navigate('/dashboard');
        }
      } else {
        setError(data.message || data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setError('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  // Submit OTP Verification (Step 2)
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setOtpError('');

    if (!otp) {
      setOtpError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(getApiUrl('/api/auth/verify-2fa'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();
      console.log('🔐 2FA Verification API Response:', data);

      if (response.ok) {
        localStorage.setItem('kfpl_tfa', 'true');
        const adminObject = data.admin || data.data?.user || data.data || data.user || {};
        const storedAdmin = {
          ...adminObject,
          email: email, // ALWAYS use the typed email to log in
          name: adminObject.name || 'Super Admin',
          role: adminObject.role || 'super-admin',
          permissions: adminObject.permissions || null,
        };
        console.log('🔐 Storing kfpl_auth admin:', storedAdmin);
        setAuthData({ 
          token: data.token, 
          admin: storedAdmin
        });
        navigate('/dashboard');
      } else {
        setOtpError(data.message || data.error || 'Invalid OTP.');
      }
    } catch (err) {
      setOtpError('Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kfpl-login">
      {/* Left Column: Cinema Wallpaper */}
      <div className="kfpl-login-wallpaper">
        <div className="kfpl-login-brand">
          <div style={{ background: '#ffffff', padding: '6px', width: '68px', height: '68px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginBottom: '16px' }}>
            <img src="/logokfpl.jpeg" alt="KFPL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '10px', display: 'block' }} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', margin: 0, lineHeight: 1.15 }}>Kinetoscope Film Pvt Ltd</h1>
          <p style={{ fontSize: '12px', color: 'rgba(240, 253, 244, 0.9)', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '6px', marginBottom: '12px', fontWeight: '700' }}>A Global Media Fund</p>
          <p>Super Admin control center. Manage agents, investors, commissions, and project portfolios in real-time.</p>
        </div>
      </div>

      {/* Right Column: Glassmorphic Form Card */}
      <div className="kfpl-login-panel">
        <div className="kfpl-login-card animate-scale-in">
          {/* Logo and Titles */}
          <div className="kfpl-login-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', padding: '6px', width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.18)', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
              <img src="/logokfpl.jpeg" alt="KFPL Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px', display: 'block' }} />
            </div>
            <h1 className="kfpl-login-title">Super Admin Portal</h1>
            <p className="kfpl-login-subtitle">Sign in to manage the production network</p>
          </div>

          {/* CREDENTIALS STEP */}
          {step === 'credentials' && (
            <div className="animate-fade-in">
              {error && (
                <div className="kfpl-login-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form className="kfpl-login-form" onSubmit={handleCredentialsSubmit}>
                <div className="kfpl-login-input-group">
                  <label className="kfpl-login-label">Email Address</label>
                  <input
                    type="email"
                    className="kfpl-login-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="kfpl-login-input-group">
                  <label className="kfpl-login-label">Password</label>
                  <div className="kfpl-login-password-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="kfpl-login-input"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="kfpl-login-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="kfpl-login-options">
                  <label className="kfpl-login-remember">
                    <input type="checkbox" /> Remember me
                  </label>
                  <span className="kfpl-login-forgot" onClick={() => navigate('/forgot-password')}>
                    Forgot Password?
                  </span>
                </div>

                <button type="submit" className="kfpl-login-btn" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          )}

          {/* TWO-FACTOR AUTHENTICATION STEP */}
          {step === 'otp' && (
            <div className="animate-fade-in">
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div className="kfpl-login-tfa-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Two-Factor Authentication</h2>
                <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                  We sent a verification code to your email.<br />Please enter the 6-digit code below.
                </p>
              </div>

              {otpError && (
                <div className="kfpl-login-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  <span>{otpError}</span>
                </div>
              )}

              <form className="kfpl-login-form" onSubmit={handleOtpSubmit}>
                <div className="kfpl-login-input-group">
                  <label className="kfpl-login-label">Verification Code</label>
                  <input
                    type="text"
                    maxLength="6"
                    className="kfpl-login-input"
                    placeholder="Enter verification code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.25rem', fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="kfpl-login-btn"
                    style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-gold)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: 'none' }}
                    onClick={() => {
                      setStep('credentials');
                      setOtp('');
                      setOtpError('');
                    }}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button type="submit" className="kfpl-login-btn" style={{ flex: 2 }} disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify & Login'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="kfpl-login-footer">
            © 2026 Kinetoscope Film Pvt Ltd. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ END: Login.jsx ============ */
