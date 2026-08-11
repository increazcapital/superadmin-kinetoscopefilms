/* ============================================================
   Page: AddAgent.jsx
   Description: Form to create a new agent
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { COMMISSION_SLABS } from '../../data/mockData';
import FileDropzone from '../../components/ui/FileDropzone';
import { WORLD_COUNTRY_CODES } from '../../data/countryCodes';
import { invalidateSWRCache } from '../../utils/swrHelper';

export default function AddAgent() {
  const navigate = useNavigate();
  const addToast = useToast();
  const [apiSlabs, setApiSlabs] = useState([]);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', phoneCountryCode: '+91', address: '', pan: '', aadhaar: '', passport: '',
    bankName: '', accountNo: '', confirmAccountNo: '', ifsc: '',
    commissionOneTime: '', commissionMonthly: '', commissionSpecial: '',
    nomineeName: '', nomineeRelation: '', nomineeContact: '', nomineePhoneCountryCode: '+91', nomineeEmail: '',
    citizenship: 'National',
    nomineeCitizenship: 'National',
  });

  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File Upload states
  const [panDocFile, setPanDocFile] = useState(null);
  const [idProofDocFile, setIdProofDocFile] = useState(null);
  const [bankProofDocFile, setBankProofDocFile] = useState(null);
  const [nomineeProofDocFile, setNomineeProofDocFile] = useState(null);

  useEffect(() => {
    const fetchSlabs = async () => {
      try {
        const res = await apiRequest('/api/super-admin/commission-slabs');
        const extractSlabs = (r) => {
          let rawList = [];
          if (!r) rawList = [];
          else if (Array.isArray(r)) rawList = r;
          else if (r.data) {
            if (Array.isArray(r.data)) rawList = r.data;
            else if (r.data.slabs && Array.isArray(r.data.slabs)) rawList = r.data.slabs;
          }
          else if (r.slabs && Array.isArray(r.slabs)) rawList = r.slabs;
          else {
            for (const k in r) {
              if (Array.isArray(r[k])) {
                rawList = r[k];
                break;
              }
            }
          }
          return rawList.map(s => ({
            id: s._id || s.id,
            minAmount: s.minAmount || 0,
            maxAmount: (s.maxAmount === null || s.maxAmount === undefined || s.maxAmount === 999999999) ? 999999999 : s.maxAmount,
            commissionPercentage: s.commissionPercentage !== undefined ? s.commissionPercentage : (s.percentage || 0),
            percentage: s.commissionPercentage !== undefined ? s.commissionPercentage : (s.percentage || 0),
            type: s.type || 'monthly'
          }));
        };
        setApiSlabs(extractSlabs(res));
      } catch (err) {
        console.error('Failed to load slabs in add agent:', err);
      }
    };
    fetchSlabs();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const nextForm = { ...prev, [name]: value };
      if (name === 'email') {
        setPortalEmail(value);
      }
      return nextForm;
    });
  };

  // Aadhaar auto-format: 1234 5678 9012
  const handleAadhaarChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    setForm(prev => ({ ...prev, aadhaar: formatted }));
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPortalPassword(pass);
    addToast('Secure password generated!', 'info', 'Password Generated');
  };

  const copyCredentials = () => {
    if (!portalEmail || !portalPassword) return;
    const text = `Email: ${portalEmail}\nPassword: ${portalPassword}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          addToast('Credentials copied to clipboard!', 'success', 'Copied');
        })
        .catch(() => {
          fallbackCopyText(text);
        });
    } else {
      fallbackCopyText(text);
    }
  };

  const fallbackCopyText = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      addToast('Credentials copied to clipboard!', 'success', 'Copied');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textarea);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.accountNo !== form.confirmAccountNo) {
      addToast('Account Number and Confirm Account Number do not match!', 'danger', 'Validation Error');
      return;
    }
    // Nominee fields are completely optional
    setSubmitLoading(true);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('fullName', form.name);
      const fullPhone = form.phone ? `${form.phoneCountryCode} ${form.phone.replace(/^\+\d+\s*/, '')}`.trim() : '';
      formData.append('phone', fullPhone);
      formData.append('email', form.email);
      formData.append('address', form.address || '');
      formData.append('residencyStatus', form.citizenship === 'International' ? 'International' : 'National (Domestic)');
      formData.append('panNumber', form.pan);
      if (form.citizenship === 'International') {
        if (form.passport) {
          formData.append('passportNumber', form.passport);
          formData.append('aadhaarNumber', form.passport); // send passport as aadhaarNumber to satisfy backend validation
        }
      } else {
        if (form.aadhaar) {
          formData.append('aadhaarNumber', form.aadhaar.replace(/\s/g, ''));
        }
      }
      formData.append('bankName', form.bankName);
      formData.append('accountNumber', form.accountNo);
      formData.append('confirmAccountNumber', form.confirmAccountNo || form.accountNo);
      formData.append('ifscCode', form.ifsc);
      formData.append('oneTimeCommission', '0');
      formData.append('monthlySlab', '0');
      formData.append('specialCommission', form.commissionSpecial || '0');
      formData.append('nomineeName', form.nomineeName || '');
      formData.append('nomineeRelation', form.nomineeRelation || '');
      const fullNomineePhone = form.nomineeContact ? `${form.nomineePhoneCountryCode} ${form.nomineeContact.replace(/^\+\d+\s*/, '')}`.trim() : '';
      formData.append('nomineePhone', fullNomineePhone);
      formData.append('nomineeEmail', form.nomineeEmail || '');
      formData.append('nomineeResidency', form.nomineeCitizenship === 'International' ? 'International' : 'National (Domestic)');
      if (portalPassword) {
        formData.append('password', portalPassword);
        formData.append('portalPassword', portalPassword);
      }
      formData.append('is2FAEnabled', 'false');

      if (panDocFile) formData.append('panDocument', panDocFile);
      if (idProofDocFile) formData.append('idProofDocument', idProofDocFile);
      if (bankProofDocFile) formData.append('bankProofDocument', bankProofDocFile);
      if (nomineeProofDocFile) formData.append('nomineeProofDocument', nomineeProofDocFile);

      await apiRequest('/api/super-admin/agents', {
        method: 'POST',
        body: formData,
      });

      try {
        invalidateSWRCache('sa_agents');
        invalidateSWRCache('sa_dashboard');
      } catch (_) {}

      addToast(`Agent "${form.name}" registered successfully!`, 'success', 'Agent Added');
      setTimeout(() => navigate('/agents'), 500);
    } catch (err) {
      console.error('Failed to register agent:', err);
      addToast(err.message || 'Failed to register agent', 'error', 'Error');
    } finally {
      setSubmitLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Add New Agent</h2>
          <p className="kfpl-page-subtitle">Register a new agent on the platform</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/agents')}>Cancel</button>
        </div>
      </div>

      <form className="kfpl-form-card" onSubmit={handleSubmit}>
        <div className="kfpl-form-card-header">
          <div>
            <h3 className="kfpl-form-card-title">Agent Information</h3>
            <p className="kfpl-form-card-subtitle">Agent ID will be auto-generated</p>
          </div>
        </div>

        <div className="kfpl-form">
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Personal Details</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Full Name <span className="required">*</span></label>
                <input className="kfpl-input" name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Email Address <span className="required">*</span></label>
                <input className="kfpl-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Enter your email address" required />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Phone Number <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select name="phoneCountryCode" value={form.phoneCountryCode} onChange={handleChange} className="kfpl-select" style={{ width: '130px', padding: '10px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.85rem' }}>
                    {WORLD_COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <input className="kfpl-input" name="phone" value={form.phone} onChange={handleChange} placeholder="Enter phone number" required style={{ flex: 1 }} />
                </div>
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Residency / Citizenship</label>
                <select className="kfpl-select" name="citizenship" value={form.citizenship} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <option value="National">National (Domestic)</option>
                  <option value="International">International</option>
                </select>
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group" style={{ gridColumn: 'span 2' }}>
                <label className="kfpl-input-label">Residential Address</label>
                <input className="kfpl-input" name="address" value={form.address} onChange={handleChange} placeholder="Enter full residential address..." />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">{form.citizenship === 'International' ? 'Tax ID / SSN Number' : 'PAN Number'}</label>
                <input className="kfpl-input" name="pan" value={form.pan} onChange={handleChange} placeholder={form.citizenship === 'International' ? 'Enter your tax ID or SSN' : 'Enter your PAN number'} />
              </div>
              {form.citizenship === 'National' ? (
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Aadhaar Number</label>
                  <input className="kfpl-input" name="aadhaar" value={form.aadhaar} onChange={handleAadhaarChange} placeholder="Enter your Aadhaar number" maxLength="14" style={{ letterSpacing: '1.5px' }} />
                </div>
              ) : (
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Passport / National ID Number <span className="required">*</span></label>
                  <input className="kfpl-input" name="passport" value={form.passport} onChange={handleChange} placeholder="Enter your passport / national ID" required />
                </div>
              )}
            </div>
          </div>

          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Bank Details</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Bank Name</label>
                <input className="kfpl-input" name="bankName" value={form.bankName} onChange={handleChange} placeholder="Enter your bank name" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">{form.citizenship === 'International' ? 'IFSC / SWIFT Code' : 'IFSC Code'}</label>
                <input className="kfpl-input" name="ifsc" value={form.ifsc} onChange={handleChange} placeholder={form.citizenship === 'International' ? 'Enter your SWIFT or IFSC code' : 'Enter your IFSC code'} />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Account Number</label>
                <input className="kfpl-input" name="accountNo" value={form.accountNo} onChange={handleChange} placeholder="Enter your account number" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Confirm Account Number</label>
                <input className="kfpl-input" name="confirmAccountNo" value={form.confirmAccountNo} onChange={handleChange} placeholder="Enter your account number again" />
              </div>
            </div>
          </div>

          {/* KYC Document Uploads */}
          <FileDropzone label={form.citizenship === 'International' ? 'Tax ID Upload' : 'PAN Card Upload'} multiple={false} onFilesChange={(files) => setPanDocFile(files[0] || null)} />
          <FileDropzone label={form.citizenship === 'International' ? 'International Passport / National ID Card Upload' : 'ID Proof Upload (Aadhaar / Driving License / Passport)'} multiple={false} onFilesChange={(files) => setIdProofDocFile(files[0] || null)} />
          <FileDropzone label="Bank Details Document (Cancelled Cheque / Bank Statement)" multiple={false} onFilesChange={(files) => setBankProofDocFile(files[0] || null)} />

          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Commission Configuration</div>
            <div className="kfpl-form-row-3">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">One-Time Commission %</label>
                <input className="kfpl-input" value="Automatic (Linked to Slab)" disabled={true} />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Monthly Slab %</label>
                <input className="kfpl-input" value="Automatic (Linked to Slab)" disabled={true} />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Special Commission Slab %</label>
                <input className="kfpl-input" name="commissionSpecial" type="number" step="0.1" value={form.commissionSpecial} onChange={handleChange} placeholder="e.g. 0.5" />
              </div>
            </div>
          </div>

          {/* Nominee Details (Optional) */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Nominee Details (Optional)</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Name</label>
                <input className="kfpl-input" name="nomineeName" value={form.nomineeName} onChange={handleChange} placeholder="Enter your nominee's full name" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Relation</label>
                <select className="kfpl-select" name="nomineeRelation" value={form.nomineeRelation} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <option value="">Select Relation</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Child">Child</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="kfpl-form-row-3">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Contact Number</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select name="nomineePhoneCountryCode" value={form.nomineePhoneCountryCode} onChange={handleChange} className="kfpl-select" style={{ width: '130px', padding: '10px 8px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '0.85rem' }}>
                    {WORLD_COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <input className="kfpl-input" name="nomineeContact" value={form.nomineeContact} onChange={handleChange} placeholder="Enter contact number" style={{ flex: 1 }} />
                </div>
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Email Address</label>
                <input className="kfpl-input" name="nomineeEmail" type="email" value={form.nomineeEmail} onChange={handleChange} placeholder="Enter your nominee's email address" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Residency / Citizenship</label>
                <select className="kfpl-select" name="nomineeCitizenship" value={form.nomineeCitizenship} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <option value="National">National (Domestic)</option>
                  <option value="International">International</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nominee ID Proof Upload */}
          <FileDropzone label={form.nomineeCitizenship === 'International' ? 'Nominee Passport / National ID Card Upload (Optional)' : 'Nominee ID Proof (Aadhaar / Driving License / Passport) (Optional)'} multiple={false} onFilesChange={(files) => setNomineeProofDocFile(files[0] || null)} />

          {/* Agent Portal Credentials Generation */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Agent Portal Access</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Email Address / Login ID</label>
                <input className="kfpl-input" name="portalEmail" value={portalEmail} onChange={(e) => setPortalEmail(e.target.value)} placeholder="Enter your agent login email" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Portal Password</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="kfpl-input" type="text" value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} placeholder="Enter your secure password" style={{ flex: 1 }} />
                  <button type="button" className="kfpl-btn kfpl-btn--ghost" onClick={generatePassword} style={{ whiteSpace: 'nowrap' }}>Generate</button>
                  <button type="button" className="kfpl-btn kfpl-btn--ghost" onClick={copyCredentials} disabled={!portalEmail || !portalPassword} style={{ whiteSpace: 'nowrap' }}>Copy</button>
                </div>
              </div>
            </div>
          </div>

          <div className="kfpl-form-actions">
            <button type="button" className="kfpl-btn kfpl-btn--ghost" disabled={submitLoading || isSubmitting} onClick={() => navigate('/agents')}>Cancel</button>
            <button type="submit" className="kfpl-btn kfpl-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Create Agent'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============ END: AddAgent.jsx ============ */
