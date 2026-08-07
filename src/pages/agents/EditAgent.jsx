/* ============================================================
   Page: EditAgent.jsx
   Description: Form to edit an existing agent profile
   ============================================================ */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import { COMMISSION_SLABS } from '../../data/mockData';
import FileDropzone from '../../components/ui/FileDropzone';
import { apiRequest } from '../../config/apiHelper';
import { WORLD_COUNTRY_CODES } from '../../data/countryCodes';

export default function EditAgent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [apiSlabs, setApiSlabs] = useState([]);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', phoneCountryCode: '+91', address: '', pan: '',
    bankName: '', accountNo: '', ifsc: '',
    commissionOneTime: '', commissionMonthly: '', commissionSpecial: '',
    status: '',
    nomineeName: '', nomineeRelation: '', nomineeContact: '', nomineePhoneCountryCode: '+91', nomineeEmail: '',
    citizenship: 'National',
    nomineeCitizenship: 'National',
  });

  // File Upload states
  const [existingDocs, setExistingDocs] = useState({});
  const [panDocFile, setPanDocFile] = useState(null);
  const [idProofDocFile, setIdProofDocFile] = useState(null);
  const [bankProofDocFile, setBankProofDocFile] = useState(null);
  const [nomineeProofDocFile, setNomineeProofDocFile] = useState(null);

  useEffect(() => {
    const fetchAgentAndSlabs = async () => {
      try {
        const [agentRes, slabsRes] = await Promise.all([
          apiRequest(`/api/super-admin/agents/${id}`),
          apiRequest('/api/super-admin/commission-slabs').catch(err => {
            console.error('Failed to load slabs in edit agent:', err);
            return null;
          })
        ]);

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
        setApiSlabs(extractSlabs(slabsRes));

        const extractAgentDetail = (res) => {
          if (!res) return null;
          if (res.agent) return res.agent;
          if (res.data) {
            if (res.data.agent) return res.data.agent;
            return res.data;
          }
          return res;
        };
        const ag = extractAgentDetail(agentRes);
        const user = ag.user || {};
        const profile = ag.profile || {};

        const normalizedAg = {
          ...ag,
          id: user._id || profile.userId || ag._id || ag.id,
          name: profile.fullName || user.name || '',
          email: profile.email || user.email || '',
          phone: profile.phone || '',
          address: profile.address || ag.address || '',
          pan: profile.panNumber || '',
          status: ag.status || profile.status || 'Active',
          agentId: ag.header?.agentCode || user.clientCode || profile.agentId || '',
          citizenship: profile.residencyStatus || 'National',
          bankName: profile.bankName || '',
          accountNo: profile.accountNumber || '',
          ifsc: profile.ifscCode || '',
          commissionOneTime: profile.oneTimeCommission ?? '',
          commissionMonthly: profile.monthlySlab ?? '',
          commissionSpecial: profile.specialCommission ?? '',
          nomineeName: profile.nomineeName || '',
          nomineeRelation: profile.nomineeRelation || '',
          nomineeContact: profile.nomineePhone || '',
          nomineeEmail: profile.nomineeEmail || '',
          nomineeCitizenship: profile.nomineeResidency || 'National',
        };

        setAgent(normalizedAg);
        setForm({
          name: normalizedAg.name,
          email: normalizedAg.email,
          phone: normalizedAg.phone,
          address: normalizedAg.address,
          pan: normalizedAg.pan,
          bankName: normalizedAg.bankName,
          accountNo: normalizedAg.accountNo,
          ifsc: normalizedAg.ifsc,
          commissionOneTime: normalizedAg.commissionOneTime,
          commissionMonthly: normalizedAg.commissionMonthly,
          commissionSpecial: normalizedAg.commissionSpecial,
          status: normalizedAg.status.toLowerCase(),
          nomineeName: normalizedAg.nomineeName,
          nomineeRelation: normalizedAg.nomineeRelation,
          nomineeContact: normalizedAg.nomineeContact,
          nomineeEmail: normalizedAg.nomineeEmail,
          citizenship: normalizedAg.citizenship,
          nomineeCitizenship: normalizedAg.nomineeCitizenship === 'International' ? 'International' : 'National',
        });

        setExistingDocs({
          panDocument: profile.panDocument || '',
          idProofDocument: profile.idProofDocument || '',
          bankProofDocument: profile.bankProofDocument || '',
          nomineeProofDocument: profile.nomineeProofDocument || '',
        });
      } catch (err) {
        console.error('Failed to load agent profile:', err);
        addToast(err.message || 'Failed to load agent profile', 'error', 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchAgentAndSlabs();
  }, [id]);

  if (loading) {
    return (
      <div className="kfpl-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading agent profile...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="kfpl-page">
        <div className="kfpl-empty">
          <div className="kfpl-empty-title">Agent not found</div>
          <button className="kfpl-btn kfpl-btn--primary mt-4" onClick={() => navigate('/agents')}>Back to List</button>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const formData = new FormData();
      formData.append('fullName', form.name);
      formData.append('phone', form.phone);
      formData.append('email', form.email);
      formData.append('address', form.address || '');
      formData.append('residencyStatus', form.citizenship === 'International' ? 'International' : 'National (Domestic)');
      formData.append('panNumber', form.pan);
      formData.append('bankName', form.bankName);
      formData.append('accountNumber', form.accountNo);
      formData.append('confirmAccountNumber', form.accountNo);
      formData.append('ifscCode', form.ifsc);
      formData.append('oneTimeCommission', '0');
      formData.append('monthlySlab', '0');
      formData.append('specialCommission', form.commissionSpecial || '0');
      formData.append('status', form.status);
      formData.append('nomineeName', form.nomineeName || '');
      formData.append('nomineeRelation', form.nomineeRelation || '');
      formData.append('nomineePhone', form.nomineeContact || '');
      formData.append('nomineeEmail', form.nomineeEmail || '');
      formData.append('nomineeResidency', form.nomineeCitizenship === 'International' ? 'International' : 'National (Domestic)');

      if (panDocFile) formData.append('panDocument', panDocFile);
      if (idProofDocFile) formData.append('idProofDocument', idProofDocFile);
      if (bankProofDocFile) formData.append('bankProofDocument', bankProofDocFile);
      if (nomineeProofDocFile) formData.append('nomineeProofDocument', nomineeProofDocFile);

      await apiRequest(`/api/super-admin/agents/${id}`, {
        method: 'PATCH',
        body: formData,
      });

      addToast(`Agent "${form.name}" updated successfully!`, 'success', 'Agent Updated');
      setTimeout(() => navigate(`/agents/${id}`), 500);
    } catch (err) {
      console.error('Failed to update agent:', err);
      addToast(err.message || 'Failed to update agent profile', 'error', 'Error');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Edit Agent Profile</h2>
          <p className="kfpl-page-subtitle">Update details for <strong>{agent.name}</strong> — {agent.agentId}</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate(`/agents/${id}`)}>Cancel</button>
        </div>
      </div>

      <form className="kfpl-form-card" onSubmit={handleSubmit}>
        <div className="kfpl-form-card-header">
          <div>
            <h3 className="kfpl-form-card-title">Agent Information</h3>
            <p className="kfpl-form-card-subtitle">Agent ID: {agent.agentId}</p>
          </div>
          <Badge status={agent.status}>{agent.status}</Badge>
        </div>

        <div className="kfpl-form">
          {/* Personal Details */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Personal Details</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Full Name <span className="required">*</span></label>
                <input className="kfpl-input" name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Email Address <span className="required">*</span></label>
                <input className="kfpl-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="agent@email.com" required />
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
                <input className="kfpl-input" name="address" value={form.address} onChange={handleChange} placeholder="Enter residential address..." />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">{form.citizenship === 'International' ? 'Tax ID / SSN Number' : 'PAN Number'}</label>
                <input className="kfpl-input" name="pan" value={form.pan} onChange={handleChange} placeholder={form.citizenship === 'International' ? 'Tax ID or SSN' : 'ABCVP1234T'} />
              </div>
              <div></div>
            </div>
          </div>

          {/* Status */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Account Settings</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Status</label>
                <select className="kfpl-input" name="status" value={form.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div></div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Bank Details</div>
            <div className="kfpl-form-row-3">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Bank Name</label>
                <input className="kfpl-input" name="bankName" value={form.bankName} onChange={handleChange} placeholder="Bank name" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Account Number</label>
                <input className="kfpl-input" name="accountNo" value={form.accountNo} onChange={handleChange} placeholder="Account number" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">{form.citizenship === 'International' ? 'IFSC / SWIFT Code' : 'IFSC Code'}</label>
                <input className="kfpl-input" name="ifsc" value={form.ifsc} onChange={handleChange} placeholder={form.citizenship === 'International' ? 'SWIFT or IFSC code' : 'HDFC0004321'} />
              </div>
            </div>
          </div>

          {/* Commission Configuration */}
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
                <input className="kfpl-input" name="nomineeName" value={form.nomineeName} onChange={handleChange} placeholder="Enter nominee's full name" />
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
                <input className="kfpl-input" name="nomineeContact" value={form.nomineeContact} onChange={handleChange} placeholder="Enter nominee's contact number" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Email Address</label>
                <input className="kfpl-input" name="nomineeEmail" type="email" value={form.nomineeEmail} onChange={handleChange} placeholder="Enter nominee's email address" />
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

          {/* KYC & Nominee Document Uploads (2x2 Grid Layout) */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">KYC & Document Uploads (Optional Re-upload)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <FileDropzone label={form.citizenship === 'International' ? 'Tax ID Upload' : 'PAN Card Upload'} multiple={false} existingFileUrl={existingDocs.panDocument} onFilesChange={(files) => setPanDocFile(files[0] || null)} />
              <FileDropzone label={form.citizenship === 'International' ? 'Passport / National ID' : 'ID Proof (Aadhaar / DL / Passport)'} multiple={false} existingFileUrl={existingDocs.idProofDocument} onFilesChange={(files) => setIdProofDocFile(files[0] || null)} />
              <FileDropzone label="Bank Details Document" multiple={false} existingFileUrl={existingDocs.bankProofDocument} onFilesChange={(files) => setBankProofDocFile(files[0] || null)} />
              <FileDropzone label={form.nomineeCitizenship === 'International' ? 'Nominee Passport / ID Upload (Optional)' : 'Nominee ID Proof Document (Optional)'} multiple={false} existingFileUrl={existingDocs.nomineeProofDocument} onFilesChange={(files) => setNomineeProofDocFile(files[0] || null)} />
            </div>
          </div>

          {/* Actions */}
          <div className="kfpl-form-actions">
            <button type="button" className="kfpl-btn kfpl-btn--ghost" disabled={submitLoading} onClick={() => navigate(`/agents/${id}`)}>Cancel</button>
            <button type="submit" className="kfpl-btn kfpl-btn--primary" disabled={submitLoading}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16" style={{ marginRight: '6px' }}>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2 2h11l5 5v11z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {submitLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============ END: EditAgent.jsx ============ */
