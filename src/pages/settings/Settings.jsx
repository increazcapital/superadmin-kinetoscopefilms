/* ============================================================
   Page: Settings.jsx
   Description: Admin settings and configuration
   ============================================================ */

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { getApiUrl } from '../../config/apiUrl';
import { getAuthData, getAuthToken } from '../../utils/authStorage';

// ── 6-Digit Reusable OTP Input Component ───────────────────────
function OtpInput({ value, onChange, idPrefix = 'otp', length = 6 }) {
  const inputs = Array(length).fill('');
  
  const handleInputChange = (e, index) => {
    const val = e.target.value;
    const char = val.replace(/[^0-9]/g, '').slice(-1); // Keep only the last typed digit
    
    const newValue = value.split('');
    while (newValue.length < length) newValue.push('');
    newValue[index] = char;
    
    const joinedValue = newValue.join('').slice(0, length);
    onChange(joinedValue);
    
    // Auto-focus next input
    if (char && index < length - 1) {
      const nextInput = document.getElementById(`${idPrefix}-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };
  
  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      const newValue = value.split('');
      while (newValue.length < length) newValue.push('');
      
      // If current cell is empty, clear the previous cell and focus it
      if (!newValue[index] && index > 0) {
        newValue[index - 1] = '';
        onChange(newValue.join(''));
        const prevInput = document.getElementById(`${idPrefix}-${index - 1}`);
        if (prevInput) {
          prevInput.focus();
        }
      } else {
        newValue[index] = '';
        onChange(newValue.join(''));
      }
    }
  };
  
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (/^\d+$/.test(pasteData) && pasteData.length === length) {
      onChange(pasteData);
      const lastInput = document.getElementById(`${idPrefix}-${length - 1}`);
      if (lastInput) lastInput.focus();
    }
  };
  
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '16px 0' }}>
      {inputs.map((_, index) => {
        const char = value[index] || '';
        return (
          <input
            key={index}
            id={`${idPrefix}-${index}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={char}
            onChange={(e) => handleInputChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            style={{
              width: '42px',
              height: '42px',
              textAlign: 'center',
              fontSize: '1.25rem',
              fontWeight: '700',
              borderRadius: '8px',
              border: '2px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-navy)',
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-gold)';
              e.target.style.boxShadow = '0 0 0 3px var(--color-gold-glow)';
              e.target.select();
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-border)';
              e.target.style.boxShadow = 'none';
            }}
          />
        );
      })}
    </div>
  );
}

export default function Settings() {
  const addToast = useToast();

  // Auth/Email State
  const [currentUser, setCurrentUser] = useState(() => {
    const authData = getAuthData();
    return authData || { token: 'mock-jwt', admin: { name: 'Super Admin', email: 'admin@kfpl.com' } };
  });

  // Support Desk Contact State
  const [supportConfig, setSupportConfig] = useState({
    clientSupportEmail: 'support@kfpl.com',
    clientSupportPhone: '+91 98765 43210',
    clientSupportWhatsapp: '919876543210',
    agentSupportEmail: 'support@kfpl.in',
    agentSupportPhone: '+91 99999 99999',
    agentSupportWhatsapp: '919999999999',
    supportHours: 'Mon - Sat, 10 AM to 6 PM IST',
  });
  const [savingSupport, setSavingSupport] = useState(false);

  useEffect(() => {
    const fetchSupportSettings = async () => {
      try {
        const token = getToken();
        if (!token) return;
        const res = await fetch(getApiUrl('/api/super-admin/settings/support'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            setSupportConfig({
              clientSupportEmail: data.data.clientSupportEmail || 'support@kfpl.com',
              clientSupportPhone: data.data.clientSupportPhone || '+91 98765 43210',
              clientSupportWhatsapp: data.data.clientSupportWhatsapp || '919876543210',
              agentSupportEmail: data.data.agentSupportEmail || 'support@kfpl.in',
              agentSupportPhone: data.data.agentSupportPhone || '+91 99999 99999',
              agentSupportWhatsapp: data.data.agentSupportWhatsapp || '919999999999',
              supportHours: data.data.supportHours || 'Mon - Sat, 10 AM to 6 PM IST',
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch support settings:', err);
      }
    };
    fetchSupportSettings();
  }, []);

  const handleSaveSupportConfig = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      addToast('Authentication token not found.', 'error', 'Error');
      return;
    }

    setSavingSupport(true);
    try {
      const res = await fetch(getApiUrl('/api/super-admin/settings/support'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(supportConfig),
      });

      if (res.ok) {
        addToast('Support Desk contact details updated successfully!', 'success', 'Settings Saved');
      } else {
        const data = await res.json();
        addToast(data.message || 'Failed to update support settings.', 'error', 'Error');
      }
    } catch (err) {
      addToast('Unable to connect to server.', 'error', 'Error');
    } finally {
      setSavingSupport(false);
    }
  };


  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const parsedAuth = getAuthData();
        const token = parsedAuth?.token;
        if (!token) {
          console.warn('DEBUG Settings: No token found in authData');
          return;
        }

        console.log('DEBUG Settings: Fetching profile from /api/auth/profile...');
        const response = await fetch(getApiUrl('/api/auth/profile'), {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('DEBUG Settings: Profile API status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('DEBUG Settings: Profile API response JSON:', data);
          
          const adminData = data.admin || data.data || data.user || data;
          console.log('DEBUG Settings: Resolved adminData:', adminData);

          const fetchedEmail = adminData?.email;
          const currentLocalEmail = currentUser?.admin?.email;
          let emailToUse = fetchedEmail || currentLocalEmail || 'admin@kfpl.com';
          
          // If the server returns default 'admin@kfpl.com' but client already has a non-default email, preserve the client's email
          if (fetchedEmail === 'admin@kfpl.com' && currentLocalEmail && currentLocalEmail !== 'admin@kfpl.com') {
            emailToUse = currentLocalEmail;
          }

          const is2FA = adminData?.is2FAEnabled === true || adminData?.is2FAEnabled === 'true';
          setTwoFactor(is2FA);
          localStorage.setItem('kfpl_tfa', String(is2FA));

          const updatedUser = {
            ...currentUser,
            admin: {
              ...(currentUser?.admin || {}),
              ...adminData,
              email: emailToUse,
              is2FAEnabled: is2FA
            }
          };
          console.log('DEBUG Settings: updatedUser to save:', updatedUser);
          setCurrentUser(updatedUser);
          localStorage.setItem('kfpl_auth', JSON.stringify(updatedUser));
        } else {
          console.error('DEBUG Settings: Profile API returned non-200 response:', response.status);
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
      }
    };
    
    fetchProfile();
  }, []);

  const currentEmail = currentUser?.admin?.email || 'admin@kfpl.com';

  // Email Change Form State
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // OTP Timers
  const [emailTimer, setEmailTimer] = useState(0);
  const [passwordTimer, setPasswordTimer] = useState(0);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  // Password OTP Form State
  const [pwdOtpSent, setPwdOtpSent] = useState(false);
  const [pwdOtp, setPwdOtp] = useState('');
  const [sendingPwdOtp, setSendingPwdOtp] = useState(false);

  // Countdown timer for Email OTP
  useEffect(() => {
    let interval = null;
    if (emailTimer > 0) {
      interval = setInterval(() => {
        setEmailTimer((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [emailTimer]);

  // Countdown timer for Password OTP
  useEffect(() => {
    let interval = null;
    if (passwordTimer > 0) {
      interval = setInterval(() => {
        setPasswordTimer((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [passwordTimer]);

  // Helper to get auth token
  const getToken = () => {
    return getAuthToken();
  };

  // Step 1: Send OTP to current email for verification (Email)
  const handleSendOtp = async () => {
    setEmailError('');
    setEmailSuccess('');

    if (!newEmail) {
      setEmailError('Please enter a new email address.');
      return;
    }
    if (newEmail === currentEmail) {
      setEmailError('New email cannot be the same as current email.');
      return;
    }
    if (!newEmail.includes('@')) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    const token = getToken();
    if (!token) {
      setEmailError('Authentication token not found. Please log in again.');
      return;
    }

    setSendingOtp(true);

    try {
      const response = await fetch(getApiUrl('/api/super-admin/settings/change-email/send-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ currentEmail, newEmail }),
      });

      const data = await response.json();
      console.log('📩 Email Change OTP response:', data);
      console.log('📩 Email Change OTP (from API):', data.otp || data.code || 'Check email');

      if (response.ok) {
        setOtpSent(true);
        setEmailTimer(30);
        addToast(`Verification OTP sent to ${currentEmail}`, 'success', 'OTP Sent');
      } else {
        setEmailError(data.message || data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setEmailError('Unable to connect to server.');
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: Verify OTP & Change Email
  const handleVerifyAndChangeEmail = async () => {
    setEmailError('');
    setEmailSuccess('');

    if (!emailOtp || emailOtp.length !== 6) {
      setEmailError('Please enter a valid 6-digit verification OTP.');
      return;
    }

    const token = getToken();
    if (!token) {
      setEmailError('Authentication token not found. Please log in again.');
      return;
    }

    setVerifyingOtp(true);

    try {
      const response = await fetch(getApiUrl('/api/super-admin/settings/change-email/verify-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          otp: emailOtp,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const updatedUser = {
          ...currentUser,
          admin: {
            ...currentUser.admin,
            email: newEmail,
            name: data.admin?.name || currentUser.admin?.name,
          }
        };
        setCurrentUser(updatedUser);
        localStorage.setItem('kfpl_auth', JSON.stringify(updatedUser));

        setEmailSuccess(data.message || 'Email updated successfully!');
        setNewEmail('');
        setEmailOtp('');
        setOtpSent(false);
        addToast('Email address updated successfully', 'success', 'Email Changed');
      } else {
        setEmailError(data.message || data.error || 'Invalid OTP or failed to update email.');
      }
    } catch (err) {
      setEmailError('Unable to connect to server.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Step 1: Send OTP to current email for verification (Password Change)
  const handleSendPwdOtp = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill out all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password should be at least 6 characters.');
      return;
    }

    const token = getToken();
    if (!token) {
      setPasswordError('Authentication token not found. Please log in again.');
      return;
    }

    setSendingPwdOtp(true);

    try {
      const response = await fetch(getApiUrl('/api/super-admin/settings/change-password/send-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();
      console.log('📩 Password Change OTP response:', data);
      console.log('📩 Password Change OTP (from API):', data.otp || data.code || 'Check email');

      if (response.ok) {
        setPwdOtpSent(true);
        setPasswordTimer(30);
        addToast(`Verification OTP sent to ${currentEmail}`, 'success', 'OTP Sent');
      } else {
        setPasswordError(data.message || data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setPasswordError('Unable to connect to server.');
    } finally {
      setSendingPwdOtp(false);
    }
  };

  // Step 2: Verify OTP & Change Password
  const handleUpdatePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!pwdOtp || pwdOtp.length !== 6) {
      setPasswordError('Please enter a valid 6-digit verification OTP.');
      return;
    }

    setUpdatingPassword(true);

    try {
      const parsedAuth = getAuthData();
      const token = parsedAuth?.token;

      if (!token) {
        setPasswordError('Authentication token not found. Please log in again.');
        setUpdatingPassword(false);
        return;
      }

      const response = await fetch(getApiUrl('/api/super-admin/settings/change-password/verify-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          otp: pwdOtp,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordSuccess(data.message || 'Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwdOtp('');
        setPwdOtpSent(false);
        addToast('Your password has been changed successfully', 'success', 'Password Updated');
      } else {
        setPasswordError(data.message || data.error || 'Failed to update password. Please try again.');
      }
    } catch (err) {
      setPasswordError('Unable to connect to server. Please check if the backend is running.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Eye toggle button component
  const EyeToggle = ({ visible, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
        color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
      }}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );

  // TFA Toggle State
  const [twoFactor, setTwoFactor] = useState(() => {
    return localStorage.getItem('kfpl_tfa') === 'true';
  });

  const [clientTwoFactor, setClientTwoFactor] = useState(() => {
    const val = localStorage.getItem('kfpl_client_tfa') || localStorage.getItem('kfpl_tfa_enabled');
    return val === 'true';
  });

  const [agentTwoFactor, setAgentTwoFactor] = useState(() => {
    const val = localStorage.getItem('kfpl_agent_tfa') || localStorage.getItem('kfpl_agent_2fa_enabled');
    return val === 'true';
  });

  // Handle Super Admin TFA toggle
  const handleTfaToggle = async () => {
    const newValue = !twoFactor;
    const token = getToken();
    if (!token) {
      addToast('Authentication token not found. Please log in again.', 'error', 'Error');
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/super-admin/settings/2fa'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is2FAEnabled: newValue }),
      });

      if (response.ok) {
        setTwoFactor(newValue);
        localStorage.setItem('kfpl_tfa', String(newValue));

        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            admin: {
              ...currentUser.admin,
              is2FAEnabled: newValue,
            }
          };
          setCurrentUser(updatedUser);
          localStorage.setItem('kfpl_auth', JSON.stringify(updatedUser));
        }

        addToast(
          `Super Admin 2FA turned ${newValue ? 'ON' : 'OFF'}`,
          newValue ? 'success' : 'info',
          'Security Update'
        );
      } else {
        const data = await response.json();
        addToast(data.message || data.error || 'Failed to update 2FA setting.', 'error', 'Error');
      }
    } catch (err) {
      addToast('Unable to connect to server.', 'error', 'Error');
    }
  };

  // Handle Client Portal TFA toggle
  const handleClientTfaToggle = async () => {
    const newValue = !clientTwoFactor;
    setClientTwoFactor(newValue);
    localStorage.setItem('kfpl_client_tfa', String(newValue));
    localStorage.setItem('kfpl_tfa_enabled', String(newValue));

    const token = getToken();
    if (token) {
      try {
        await fetch(getApiUrl('/api/super-admin/settings/client-2fa'), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ is2FAEnabled: newValue }),
        }).catch(() => {});
      } catch (err) {}
    }

    addToast(
      `Client Portal 2FA turned ${newValue ? 'ON' : 'OFF'}`,
      newValue ? 'success' : 'info',
      'Security Update'
    );
  };

  // Handle Agent Portal TFA toggle
  const handleAgentTfaToggle = async () => {
    const newValue = !agentTwoFactor;
    setAgentTwoFactor(newValue);
    localStorage.setItem('kfpl_agent_tfa', String(newValue));
    localStorage.setItem('kfpl_agent_2fa_enabled', String(newValue));

    const token = getToken();
    if (token) {
      try {
        await fetch(getApiUrl('/api/super-admin/settings/agent-2fa'), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ is2FAEnabled: newValue }),
        }).catch(() => {});
      } catch (err) {}
    }

    addToast(
      `Agent Portal 2FA turned ${newValue ? 'ON' : 'OFF'}`,
      newValue ? 'success' : 'info',
      'Security Update'
    );
  };

  return (
    <div className="kfpl-page animate-fade-slide-up">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Settings</h2>
          <p className="kfpl-page-subtitle">Configure admin credentials and login security preferences</p>
        </div>
      </div>

      <div className="kfpl-grid-2col">
        {/* Left Column: Change Email & Security Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Change Email */}
          <div className="kfpl-detail-info-card">
            <div className="kfpl-detail-info-title">Change Email Address</div>
            
            {emailError && (
              <div className="kfpl-alert kfpl-alert--danger" style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {emailError}
              </div>
            )}

            {emailSuccess && (
              <div className="kfpl-alert kfpl-alert--success" style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {emailSuccess}
              </div>
            )}

            <div className="kfpl-form" style={{ gap: '16px' }}>
              {/* Current Email — always read-only */}
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Current Email</label>
                <input className="kfpl-input" value={currentEmail} readOnly disabled style={{ background: 'var(--color-surface)', cursor: 'not-allowed' }} />
              </div>

              {/* New Email — disabled after OTP is sent */}
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">New Email Address</label>
                <input 
                  className="kfpl-input" 
                  type="email" 
                  placeholder="Enter new email" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={otpSent}
                />
              </div>

              {/* OTP Field — shows after Send OTP */}
              {otpSent && (
                <div className="kfpl-input-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                  <label className="kfpl-input-label" style={{ textAlign: 'center', display: 'block', width: '100%' }}>Enter 6-Digit Email Verification OTP</label>
                  <OtpInput 
                    value={emailOtp}
                    onChange={setEmailOtp}
                    idPrefix="email-otp"
                    length={6}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textAlign: 'center', marginTop: '4px' }}>
                    A verification code was sent to <strong>{currentEmail}</strong>
                  </span>

                  {/* Resend Timer / Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                    {emailTimer > 0 ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Resend OTP in <strong style={{ color: 'var(--color-gold)' }}>{emailTimer}s</strong>
                      </span>
                    ) : (
                      <button 
                        type="button" 
                        onClick={handleSendOtp} 
                        disabled={sendingOtp}
                        style={{ fontSize: '0.8125rem', color: 'var(--color-gold)', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {sendingOtp ? 'Resending...' : 'Resend OTP'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                {!otpSent ? (
                  <button 
                    className="kfpl-btn kfpl-btn--primary" 
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {sendingOtp ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                ) : (
                  <>
                    <button 
                      className="kfpl-btn kfpl-btn--ghost" 
                      onClick={() => { setOtpSent(false); setEmailOtp(''); setEmailError(''); }}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Back
                    </button>
                    <button 
                      className="kfpl-btn kfpl-btn--primary" 
                      onClick={handleVerifyAndChangeEmail}
                      disabled={verifyingOtp}
                      style={{ flex: 2, justifyContent: 'center' }}
                    >
                      {verifyingOtp ? 'Verifying...' : 'Verify & Update Email'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Security & TFA Options */}
          <div className="kfpl-detail-info-card">
            <div className="kfpl-detail-info-title">Security Settings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {/* Super Admin 2FA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Super Admin Portal 2FA</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Requires entering an email OTP code when logging into Super Admin panel</div>
                </div>
                <div className="kfpl-toggle" onClick={handleTfaToggle} style={{ cursor: 'pointer' }}>
                  <div className={`kfpl-toggle-track ${twoFactor ? 'active' : ''}`}>
                    <div className="kfpl-toggle-thumb"></div>
                  </div>
                </div>
              </div>

              {/* Client Portal 2FA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Client Portal 2FA</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Enforces email OTP verification during client portal login</div>
                </div>
                <div className="kfpl-toggle" onClick={handleClientTfaToggle} style={{ cursor: 'pointer' }}>
                  <div className={`kfpl-toggle-track ${clientTwoFactor ? 'active' : ''}`}>
                    <div className="kfpl-toggle-thumb"></div>
                  </div>
                </div>
              </div>

              {/* Agent Portal 2FA */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Agent Portal 2FA</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Enforces email OTP verification during agent portal login</div>
                </div>
                <div className="kfpl-toggle" onClick={handleAgentTfaToggle} style={{ cursor: 'pointer' }}>
                  <div className={`kfpl-toggle-track ${agentTwoFactor ? 'active' : ''}`}>
                    <div className="kfpl-toggle-thumb"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Change Password */}
        <div className="kfpl-detail-info-card" style={{ height: 'fit-content' }}>
          <div className="kfpl-detail-info-title">Change Password</div>

          {passwordError && (
            <div className="kfpl-alert kfpl-alert--danger" style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="kfpl-alert kfpl-alert--success" style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {passwordSuccess}
            </div>
          )}

          <div className="kfpl-form" style={{ gap: '16px' }}>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Current Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="kfpl-input" 
                  type={showCurrentPwd ? 'text' : 'password'} 
                  placeholder="Enter current password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ paddingRight: '42px' }}
                />
                <EyeToggle visible={showCurrentPwd} onClick={() => setShowCurrentPwd(!showCurrentPwd)} />
              </div>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="kfpl-input" 
                  type={showNewPwd ? 'text' : 'password'} 
                  placeholder="Enter new password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingRight: '42px' }}
                />
                <EyeToggle visible={showNewPwd} onClick={() => setShowNewPwd(!showNewPwd)} />
              </div>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="kfpl-input" 
                  type={showConfirmPwd ? 'text' : 'password'} 
                  placeholder="Confirm new password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingRight: '42px' }}
                />
                <EyeToggle visible={showConfirmPwd} onClick={() => setShowConfirmPwd(!showConfirmPwd)} />
              </div>
            </div>

            {/* Password OTP Field — shows after Send Password OTP */}
            {pwdOtpSent && (
              <div className="kfpl-input-group" style={{ animation: 'fadeIn 0.3s ease', marginTop: '8px' }}>
                <label className="kfpl-input-label" style={{ textAlign: 'center', display: 'block', width: '100%' }}>Enter 6-Digit Password Verification OTP</label>
                <OtpInput 
                  value={pwdOtp}
                  onChange={setPwdOtp}
                  idPrefix="pwd-otp"
                  length={6}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textAlign: 'center', marginTop: '4px' }}>
                  A verification code was sent to <strong>{currentEmail}</strong>
                </span>

                {/* Resend Timer / Button */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                  {passwordTimer > 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      Resend OTP in <strong style={{ color: 'var(--color-gold)' }}>{passwordTimer}s</strong>
                    </span>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleSendPwdOtp} 
                      disabled={sendingPwdOtp}
                      style={{ fontSize: '0.8125rem', color: 'var(--color-gold)', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {sendingPwdOtp ? 'Resending...' : 'Resend OTP'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons for Password Change */}
            <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
              {!pwdOtpSent ? (
                <button 
                  type="button" 
                  className="kfpl-btn kfpl-btn--primary" 
                  onClick={handleSendPwdOtp}
                  disabled={sendingPwdOtp}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {sendingPwdOtp ? 'Sending OTP...' : 'Send OTP & Update'}
                </button>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="kfpl-btn kfpl-btn--ghost" 
                    onClick={() => { setPwdOtpSent(false); setPwdOtp(''); setPasswordError(''); }}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Back
                  </button>
                  <button 
                    type="button" 
                    className="kfpl-btn kfpl-btn--primary" 
                    onClick={handleUpdatePassword}
                    disabled={updatingPassword}
                    style={{ flex: 2, justifyContent: 'center' }}
                  >
                    {updatingPassword ? 'Updating...' : 'Verify & Update Password'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Support Desk Contact Configuration */}
      <div className="kfpl-detail-info-card" style={{ marginTop: '24px' }}>
        <div className="kfpl-detail-info-title">Support Desk Contact Configuration (Client & Agent Portals)</div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
          Configure the contact email, phone number, WhatsApp link, and working hours displayed across Client & Agent portals.
        </p>

        <form onSubmit={handleSaveSupportConfig} className="kfpl-form">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {/* Client Portal Support */}
            <div style={{ background: 'var(--color-surface-elevated)', padding: '16px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
                Client Portal Support Contacts
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Email Support Address</label>
                  <input
                    className="kfpl-input"
                    value={supportConfig.clientSupportEmail}
                    onChange={(e) => setSupportConfig(prev => ({ ...prev, clientSupportEmail: e.target.value }))}
                    placeholder="e.g. support@kfpl.com"
                  />
                </div>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Phone Support Number</label>
                  <input
                    className="kfpl-input"
                    value={supportConfig.clientSupportPhone}
                    onChange={(e) => setSupportConfig(prev => ({ ...prev, clientSupportPhone: e.target.value }))}
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">WhatsApp Number / Link</label>
                  <input
                    className="kfpl-input"
                    value={supportConfig.clientSupportWhatsapp}
                    onChange={(e) => setSupportConfig(prev => ({ ...prev, clientSupportWhatsapp: e.target.value }))}
                    placeholder="e.g. 919876543210"
                  />
                </div>
              </div>
            </div>

            {/* Agent Portal Support */}
            <div style={{ background: 'var(--color-surface-elevated)', padding: '16px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
                Agent Portal Support Contacts
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Email Support Address</label>
                  <input
                    className="kfpl-input"
                    value={supportConfig.agentSupportEmail}
                    onChange={(e) => setSupportConfig(prev => ({ ...prev, agentSupportEmail: e.target.value }))}
                    placeholder="e.g. support@kfpl.in"
                  />
                </div>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Phone Support Number</label>
                  <input
                    className="kfpl-input"
                    value={supportConfig.agentSupportPhone}
                    onChange={(e) => setSupportConfig(prev => ({ ...prev, agentSupportPhone: e.target.value }))}
                    placeholder="e.g. +91 99999 99999"
                  />
                </div>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">WhatsApp Number / Link</label>
                  <input
                    className="kfpl-input"
                    value={supportConfig.agentSupportWhatsapp}
                    onChange={(e) => setSupportConfig(prev => ({ ...prev, agentSupportWhatsapp: e.target.value }))}
                    placeholder="e.g. 919999999999"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="kfpl-input-group" style={{ marginTop: '16px' }}>
            <label className="kfpl-input-label">Advisory Desk Working Hours</label>
            <input
              className="kfpl-input"
              value={supportConfig.supportHours}
              onChange={(e) => setSupportConfig(prev => ({ ...prev, supportHours: e.target.value }))}
              placeholder="e.g. Mon - Sat, 10 AM to 6 PM IST"
            />
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="kfpl-btn kfpl-btn--primary" disabled={savingSupport}>
              {savingSupport ? 'Saving Settings...' : 'Save Support Desk Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============ END: Settings.jsx ============ */
