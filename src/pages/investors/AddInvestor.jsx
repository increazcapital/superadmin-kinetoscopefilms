/* ============================================================
   Page: AddInvestor.jsx
   Description: Form to create a new investor profile by calling 
                the /api/super-admin/clients backend API endpoint.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import FileDropzone from '../../components/ui/FileDropzone';
import { getApiUrl } from '../../config/apiUrl';
import { apiRequest } from '../../config/apiHelper';
import { invalidateSWRCache } from '../../utils/swrHelper';
import { getAuthToken } from '../../utils/authStorage';
import { WORLD_COUNTRY_CODES } from '../../data/countryCodes';

const formatAgentID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  if (rawId.startsWith('KFPL-AG-') || rawId.startsWith('KFPL-AGT-')) {
    return rawId.replace('KFPL-AGT-', 'KFPL-AG-');
  }
  const digits = rawId.match(/\d+/);
  if (digits) {
    let val = parseInt(digits[0], 10);
    if (val < 1000) {
      val = 1000 + val;
    }
    return `KFPL-AG-${val}`;
  }
  return 'KFPL-AG-1001';
};

export default function AddInvestor() {
  const navigate = useNavigate();
  const addToast = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', phoneCountryCode: '+91', dob: '', address: '',
    pan: '', bankName: '', accountNo: '', confirmAccountNo: '', ifsc: '',
    aadhaarNumber: '',
    nomineeName: '', nomineeRelation: '', nomineeContact: '', nomineePhoneCountryCode: '+91', nomineeEmail: '',
    riskProfile: 'Conservative',
    citizenship: 'National',
    nomineeCitizenship: 'National',
    roiPercentage: '0',
    contractStartDate: new Date().toISOString().split('T')[0],
    contractEndDate: '',
  });

  const [dbAgents, setDbAgents] = useState([]);

  useEffect(() => {
    const fetchDbAgents = async () => {
      try {
        const resData = await apiRequest('/api/super-admin/agents');
        if (resData) {
          const extractAgents = (res) => {
            if (!res) return [];
            if (Array.isArray(res)) return res;
            if (res.data) {
              if (Array.isArray(res.data)) return res.data;
              if (res.data.agents && Array.isArray(res.data.agents)) return res.data.agents;
            }
            if (res.agents && Array.isArray(res.agents)) return res.agents;
            return [];
          };
          const fetchedAgents = extractAgents(resData);
          setDbAgents(fetchedAgents);
        }
      } catch (err) {
        console.error('Failed to load agents from API:', err);
      }
    };
    fetchDbAgents();
  }, []);

  // Uploaded Files State
  const [panDocument, setPanDocument] = useState(null);
  const [aadhaarDocument, setAadhaarDocument] = useState(null);
  const [bankProofDocument, setBankProofDocument] = useState(null);
  const [nomineeProofDocument, setNomineeProofDocument] = useState(null);
  const [agreementDocument, setAgreementDocument] = useState(null);

  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      let nextValue = value;
      if (name === 'aadhaarNumber' && prev.citizenship === 'National') {
        const digits = value.replace(/\D/g, '').slice(0, 12);
        nextValue = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
      }
      const nextForm = { ...prev, [name]: nextValue };
      if (name === 'email') {
        setPortalEmail(value);
      }
      return nextForm;
    });
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
    if ((form.nomineeRelation || form.nomineeContact) && !form.nomineeName) {
      alert('Nominee Name is required if Nominee Relation or Nominee Contact is provided.');
      return;
    }

    setLoading(true);
    setIsSubmitting(true);

    try {
      const jwtToken = getAuthToken();

      // Construct FormData for multipart upload
      const formData = new FormData();
      formData.append('fullName', form.fullName);
      formData.append('email', form.email);
      const fullPhone = form.phone ? `${form.phoneCountryCode} ${form.phone.replace(/^\+\d+\s*/, '')}`.trim() : '';
      formData.append('phone', fullPhone);
      if (form.dob) formData.append('dob', form.dob);
      if (form.address) formData.append('address', form.address);
      formData.append('riskProfile', form.riskProfile);
      formData.append('residencyStatus', form.citizenship === 'International' ? 'International' : 'National (Domestic)');
      formData.append('monthlyRoi', form.roiPercentage || '0');
      if (form.contractStartDate) {
        formData.append('contractStartDate', form.contractStartDate);
        formData.append('joinDate', form.contractStartDate);
      }
      if (form.contractEndDate) {
        formData.append('contractEndDate', form.contractEndDate);
      }
      if (form.bankName) formData.append('bankName', form.bankName);
      if (form.accountNo) {
        formData.append('accountNumber', form.accountNo);
        formData.append('confirmAccountNumber', form.confirmAccountNo || form.accountNo);
      }
      if (form.ifsc) formData.append('ifscCode', form.ifsc);
      if (form.pan) formData.append('panNumber', form.pan);
      if (form.aadhaarNumber) formData.append('aadhaarNumber', form.aadhaarNumber.replace(/\s/g, ''));

      if (form.nomineeName) {
        formData.append('nomineeName', form.nomineeName);
        formData.append('nomineeRelation', form.nomineeRelation);
        const fullNomineePhone = form.nomineeContact ? `${form.nomineePhoneCountryCode} ${form.nomineeContact.replace(/^\+\d+\s*/, '')}`.trim() : '';
        formData.append('nomineePhone', fullNomineePhone);
        formData.append('nomineeEmail', form.nomineeEmail);
        formData.append('nomineeResidency', form.nomineeCitizenship === 'International' ? 'International' : 'National (Domestic)');
      }

      // Only append assignedAgent if it is a valid MongoDB ObjectID string
      const isValidMongoId = /^[0-9a-fA-F]{24}$/.test(selectedAgentId);
      if (selectedAgentId && isValidMongoId) {
        formData.append('assignedAgent', selectedAgentId);
      }
      formData.append('tier', 'SILVER');
      if (portalPassword) {
        formData.append('portalPassword', portalPassword);
        formData.append('password', portalPassword);
      }
      formData.append('is2FAEnabled', 'false');

      // Append files if selected
      if (panDocument) formData.append('panDocument', panDocument);
      if (aadhaarDocument) formData.append('aadhaarDocument', aadhaarDocument);
      if (bankProofDocument) formData.append('bankProofDocument', bankProofDocument);
      if (nomineeProofDocument) formData.append('nomineeProofDocument', nomineeProofDocument);
      if (agreementDocument) formData.append('agreementDocument', agreementDocument);

      const response = await fetch(getApiUrl('/api/super-admin/clients'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        },
        body: formData
      });

      const resData = await response.json();

      if (response.ok) {
        try {
          invalidateSWRCache('sa_clients');
          invalidateSWRCache('sa_dashboard');
        } catch (_) {}
        addToast(`Client "${form.fullName}" registered successfully!`, 'success', 'Client Added');
        
        setTimeout(() => navigate('/investors'), 500);
      } else {
        addToast(resData.message || resData.error || 'Failed to onboard client.', 'danger', 'Submission Error');
      }
    } catch (err) {
      console.error(err);
      addToast('Network error or server unavailable.', 'danger', 'Submission Error');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Add New Investor</h2>
          <p className="kfpl-page-subtitle">Fill in the details to onboard a new investor</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/investors')}>Cancel</button>
        </div>
      </div>

      <form className="kfpl-form-card" onSubmit={handleSubmit}>
        <div className="kfpl-form-card-header">
          <div>
            <h3 className="kfpl-form-card-title">Personal Information</h3>
            <p className="kfpl-form-card-subtitle">Client ID will be auto-generated</p>
          </div>
        </div>

        <div className="kfpl-form">
          {/* Personal Details */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Basic Details</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Full Name <span className="required">*</span></label>
                <input className="kfpl-input" name="fullName" value={form.fullName} onChange={handleChange} placeholder="Enter full name" required />
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
                <label className="kfpl-input-label">Date of Birth</label>
                <input className="kfpl-input" name="dob" type="date" value={form.dob} onChange={handleChange} />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group" style={{ flex: 2 }}>
                <label className="kfpl-input-label">Address</label>
                <textarea className="kfpl-textarea" name="address" value={form.address} onChange={handleChange} placeholder="Enter your full address" rows="2" />
              </div>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Risk Profile</label>
                <select className="kfpl-select" name="riskProfile" value={form.riskProfile} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Residency / Citizenship</label>
                <select className="kfpl-select" name="citizenship" value={form.citizenship} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                  <option value="National">National (Domestic)</option>
                  <option value="International">International</option>
                </select>
              </div>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Agent / Source of Client</label>
                <select 
                  className="kfpl-select" 
                  value={selectedAgentId} 
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <option value="">Direct Client (No Agent)</option>
                  {dbAgents.map(a => {
                    const user = a.user || {};
                    const profile = a.profile || {};
                    const agentName = profile.fullName || user.name || a.fullName || a.name || 'Agent';
                    const rawCode = user.clientCode || profile.agentId || a.agentId || a.code || '';
                    const formattedId = formatAgentID(rawCode);
                    return (
                      <option key={a._id || a.id} value={a._id || a.id}>
                        {agentName} ({formattedId})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="kfpl-form-row" style={{ marginTop: '16px' }}>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Monthly ROI % <span className="required">*</span></label>
                <input 
                  type="number" 
                  step="0.1" 
                  className="kfpl-input" 
                  name="roiPercentage" 
                  value={form.roiPercentage} 
                  onChange={handleChange} 
                  required 
                />
              </div>
              <div style={{ flex: 1 }}></div>
            </div>
            <div className="kfpl-form-row" style={{ marginTop: '16px' }}>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Contract Start Date <span className="required">*</span></label>
                <input 
                  type="date" 
                  className="kfpl-input" 
                  name="contractStartDate" 
                  value={form.contractStartDate} 
                  onChange={handleChange} 
                  required 
                />
              </div>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Contract End Date <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(Optional)</span></label>
                <input 
                  type="date" 
                  className="kfpl-input" 
                  name="contractEndDate" 
                  value={form.contractEndDate} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>

          {/* KYC & Bank */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">KYC & Bank Details</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">
                  {form.citizenship === 'International' ? 'Tax ID / SSN' : 'PAN Card Number'} <span className="required">*</span>
                </label>
                <input 
                  className="kfpl-input" 
                  name="pan" 
                  value={form.pan} 
                  onChange={handleChange} 
                  placeholder={form.citizenship === 'International' ? 'Enter your tax ID or SSN' : 'Enter your PAN number'} 
                  required 
                />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">
                  {form.citizenship === 'International' ? 'Passport / National ID Number' : 'Aadhaar Number'} <span className="required">*</span>
                </label>
                <input 
                  className="kfpl-input" 
                  name="aadhaarNumber" 
                  value={form.aadhaarNumber} 
                  onChange={handleChange} 
                  placeholder={form.citizenship === 'International' ? 'Enter your passport or ID number' : 'Enter your Aadhaar number'} 
                  style={form.citizenship === 'National' ? { letterSpacing: '1.5px' } : {}}
                  required 
                />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Bank Name <span className="required">*</span></label>
                <input className="kfpl-input" name="bankName" value={form.bankName} onChange={handleChange} placeholder="Enter your bank name" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">
                  {form.citizenship === 'International' ? 'IFSC / SWIFT Code' : 'IFSC Code'} <span className="required">*</span>
                </label>
                <input 
                  className="kfpl-input" 
                  name="ifsc" 
                  value={form.ifsc} 
                  onChange={handleChange} 
                  placeholder={form.citizenship === 'International' ? 'Enter your SWIFT or IFSC code' : 'Enter your IFSC code'} 
                  required 
                />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Account Number <span className="required">*</span></label>
                <input className="kfpl-input" name="accountNo" value={form.accountNo} onChange={handleChange} placeholder="Enter your account number" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Confirm Account Number <span className="required">*</span></label>
                <input className="kfpl-input" name="confirmAccountNo" value={form.confirmAccountNo} onChange={handleChange} placeholder="Enter your account number again" required />
              </div>
            </div>
          </div>

          {/* KYC Document Uploads */}
          <FileDropzone 
            label={form.citizenship === 'International' ? 'Tax ID Upload' : 'PAN Card Upload'} 
            multiple={false} 
            onFilesChange={(files) => setPanDocument(files[0] || null)} 
          />
          <FileDropzone 
            label={form.citizenship === 'International' ? 'International Passport / National ID Card Upload' : 'Aadhaar Card Upload'} 
            multiple={false} 
            onFilesChange={(files) => setAadhaarDocument(files[0] || null)} 
          />
          <FileDropzone 
            label="Bank Details Document (Cancelled Cheque / Bank Statement) (Optional)" 
            multiple={false} 
            onFilesChange={(files) => setBankProofDocument(files[0] || null)} 
          />

          {/* Nominee Details */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Nominee Details <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'none' }}>(Optional)</span></div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Name {(form.nomineeRelation || form.nomineeContact) && <span className="required">*</span>}</label>
                <input className="kfpl-input" name="nomineeName" value={form.nomineeName} onChange={handleChange} placeholder="Enter your nominee's full name" required={!!(form.nomineeRelation || form.nomineeContact)} />
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
          <FileDropzone 
            label={form.nomineeCitizenship === 'International' ? 'Nominee International Passport / National ID Card Upload (Optional)' : 'Nominee ID Proof (Aadhaar / Driving License / Passport) (Optional)'} 
            multiple={false} 
            onFilesChange={(files) => setNomineeProofDocument(files[0] || null)} 
          />

          {/* Agreement Upload */}
          <FileDropzone 
            label="Agreement Document (Optional)" 
            multiple={false} 
            onFilesChange={(files) => setAgreementDocument(files[0] || null)} 
          />

          {/* Client Portal Credentials Generation */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Client Portal Access</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Email Address / Login ID</label>
                <input className="kfpl-input" name="portalEmail" value={portalEmail} onChange={(e) => setPortalEmail(e.target.value)} placeholder="Enter your client login email" />
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
            <button type="button" className="kfpl-btn kfpl-btn--ghost" onClick={() => navigate('/investors')} disabled={loading || isSubmitting}>Cancel</button>
            <button type="submit" className="kfpl-btn kfpl-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Investor'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
