/* ============================================================
   Page: EditInvestor.jsx
   Description: Form to edit an existing investor/client profile.
                Fetches client data from API on mount, submits
                changes via PATCH /api/super-admin/clients/:id.
                Removes all mock data dependency.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import Badge from '../../components/ui/Badge';
import FileDropzone from '../../components/ui/FileDropzone';
import { apiRequest } from '../../config/apiHelper';

const COMMISSION_PRESETS = [
  { id: 'slab-1', name: 'Slab 1 (Basic): 1.0% One-Time / 0.50% Monthly', oneTime: 1.0, monthly: 0.50 },
  { id: 'slab-2', name: 'Slab 2 (Standard): 1.5% One-Time / 0.75% Monthly', oneTime: 1.5, monthly: 0.75 },
  { id: 'slab-3', name: 'Slab 3 (Premium): 2.0% One-Time / 1.00% Monthly', oneTime: 2.0, monthly: 1.00 },
  { id: 'slab-4', name: 'Slab 4 (Elite): 2.5% One-Time / 1.25% Monthly', oneTime: 2.5, monthly: 1.25 },
  { id: 'custom', name: 'Custom Rates...', oneTime: '', monthly: '' },
];

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

const formatDateToInputVal = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

export default function EditInvestor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [dbAgents, setDbAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Document file upload states
  const [existingDocs, setExistingDocs] = useState({});
  const [deletedDocs, setDeletedDocs] = useState({});
  const [panDocFile, setPanDocFile] = useState(null);
  const [aadhaarDocFile, setAadhaarDocFile] = useState(null);
  const [bankProofDocFile, setBankProofDocFile] = useState(null);
  const [agreementDocFile, setAgreementDocFile] = useState(null);
  const [nomineeProofDocFile, setNomineeProofDocFile] = useState(null);

  const handleDeleteDoc = (field) => {
    setExistingDocs(prev => ({ ...prev, [field]: '' }));
    setDeletedDocs(prev => ({ ...prev, [field]: true }));
    addToast('Document removed. Click "Save Changes" to apply.', 'info');
  };

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', dob: '', address: '',
    pan: '', bankName: '', accountNo: '', ifsc: '',
    category: '', status: '',
    nomineeName: '', nomineeRelation: '', nomineeContact: '', nomineeEmail: '',
    riskProfile: 'Conservative',
    citizenship: 'National (Domestic)',
    nomineeCitizenship: 'National (Domestic)',
    commissionSlab: 'slab-2',
    commissionOneTime: '1.5',
    commissionMonthly: '0.75',
    roiPercentage: '0',
    contractStartDate: '',
    contractEndDate: '',
    extendContractDate: '',
  });

  // Fetch client details and agents on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [agentsRes, clientRes] = await Promise.all([
          apiRequest('/api/super-admin/agents').catch(e => {
            console.error('Failed to load agents in edit page:', e);
            return null;
          }),
          apiRequest(`/api/super-admin/clients/${id}`)
        ]);

        // Process Agents list
        let agentsList = [];
        if (agentsRes) {
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
          agentsList = extractAgents(agentsRes);
          setDbAgents(agentsList);
        }

        // Process client details
        const data = clientRes.data || clientRes;
        const profile = data.profile || data;
        const header = data.header || {};
        const summary = data.summaryCards || {};

        setForm({
          fullName: profile.fullName || profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          dob: profile.dob ? new Date(profile.dob).toISOString().split('T')[0] : '',
          address: profile.address || '',
          pan: profile.panNumber || profile.pan || '',
          bankName: profile.bankName || '',
          accountNo: profile.accountNumber || profile.accountNo || '',
          ifsc: profile.ifscCode || profile.ifsc || '',
          category: (header.tier || profile.tier || 'silver').toUpperCase(),
          status: (header.status || profile.status || 'active').toLowerCase(),
          nomineeName: profile.nomineeName || '',
          nomineeRelation: profile.nomineeRelation || '',
          nomineeContact: profile.nomineePhone || '',
          nomineeEmail: profile.nomineeEmail || '',
          riskProfile: profile.riskProfile || 'Conservative',
          citizenship: profile.residencyStatus || 'National (Domestic)',
          nomineeCitizenship: profile.nomineeResidency || 'National (Domestic)',
          commissionSlab: profile.commissionSlab || 'slab-2',
          commissionOneTime: String(profile.commissionOneTime || '1.5'),
          commissionMonthly: String(profile.commissionMonthly || '0.75'),
          roiPercentage: String(summary.monthlyRoi ?? profile.monthlyRoi ?? 0),
          contractStartDate: formatDateToInputVal(profile.contractStartDate || profile.joinDate || profile.createdAt),
          contractEndDate: formatDateToInputVal(profile.contractEndDate),
          extendContractDate: formatDateToInputVal(profile.extendContractDate || profile.contractExtendedDate),
        });

        // Set selected agent ID and existing docs
        setSelectedAgentId(profile.assignedAgent || '');
        setExistingDocs({
          panDocument: profile.panDocument || '',
          aadhaarDocument: profile.aadhaarDocument || '',
          bankProofDocument: profile.bankProofDocument || '',
          agreementDocument: profile.agreementDocument || '',
          nomineeProofDocument: profile.nomineeProofDocument || '',
        });
      } catch (err) {
        console.error('Failed to fetch client details:', err);
        addToast(err.message || 'Error fetching client details', 'error', 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSlabChange = (e) => {
    const slabId = e.target.value;
    const preset = COMMISSION_PRESETS.find(p => p.id === slabId);
    setForm(prev => ({
      ...prev,
      commissionSlab: slabId,
      commissionOneTime: preset && slabId !== 'custom' ? String(preset.oneTime) : prev.commissionOneTime,
      commissionMonthly: preset && slabId !== 'custom' ? String(preset.monthly) : prev.commissionMonthly,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((form.nomineeRelation || form.nomineeContact) && !form.nomineeName) {
      addToast('Nominee Name is required if relation/contact is provided.', 'error', 'Validation Error');
      return;
    }

    setSubmitLoading(true);

    try {
      // Map form fields to API PATCH body structure
      const formData = new FormData();
      formData.append('fullName', form.fullName);
      formData.append('email', form.email);
      formData.append('phone', form.phone);
      if (form.dob) formData.append('dob', form.dob);
      if (form.address) formData.append('address', form.address);
      formData.append('panNumber', form.pan);
      formData.append('bankName', form.bankName);
      formData.append('accountNumber', form.accountNo);
      formData.append('confirmAccountNumber', form.accountNo);
      formData.append('ifscCode', form.ifsc);
      formData.append('tier', form.category);
      formData.append('status', form.status);
      formData.append('riskProfile', form.riskProfile);
      formData.append('residencyStatus', form.citizenship);
      formData.append('monthlyRoi', String(parseFloat(form.roiPercentage) || 0));
      formData.append('assignedAgent', selectedAgentId || 'Direct Client (No Agent)');
      if (form.contractStartDate) formData.append('contractStartDate', form.contractStartDate);
      if (form.contractEndDate) formData.append('contractEndDate', form.contractEndDate);
      if (form.extendContractDate) formData.append('extendContractDate', form.extendContractDate);
      formData.append('nomineeName', form.nomineeName || '');
      formData.append('nomineeRelation', form.nomineeRelation || '');
      formData.append('nomineePhone', form.nomineeContact || '');
      formData.append('nomineeEmail', form.nomineeEmail || '');
      formData.append('nomineeResidency', form.nomineeCitizenship);

      // Deletion flags
      if (deletedDocs.panDocument) formData.append('removePanDocument', 'true');
      if (deletedDocs.aadhaarDocument) formData.append('removeAadhaarDocument', 'true');
      if (deletedDocs.bankProofDocument) formData.append('removeBankProofDocument', 'true');
      if (deletedDocs.agreementDocument) formData.append('removeAgreementDocument', 'true');
      if (deletedDocs.nomineeProofDocument) formData.append('removeNomineeProofDocument', 'true');

      if (panDocFile) formData.append('panDocument', panDocFile);
      if (aadhaarDocFile) formData.append('aadhaarDocument', aadhaarDocFile);
      if (bankProofDocFile) formData.append('bankProofDocument', bankProofDocFile);
      if (agreementDocFile) formData.append('agreementDocument', agreementDocFile);
      if (nomineeProofDocFile) formData.append('nomineeProofDocument', nomineeProofDocFile);

      await apiRequest(`/api/super-admin/clients/${id}`, {
        method: 'PATCH',
        body: formData,
      });

      addToast(`Client "${form.fullName}" updated successfully!`, 'success', 'Client Updated');
      setTimeout(() => navigate(`/investors/${id}`), 500);
    } catch (err) {
      console.error('Failed to update client:', err);
      addToast(err.message || 'Failed to update client', 'error', 'Error');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="kfpl-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading form details...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Edit Client Profile</h2>
          <p className="kfpl-page-subtitle">Update details for <strong>{form.fullName}</strong></p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate(`/investors/${id}`)}>Cancel</button>
        </div>
      </div>

      <form className="kfpl-form-card" onSubmit={handleSubmit}>
        <div className="kfpl-form-card-header">
          <div>
            <h3 className="kfpl-form-card-title">Personal Information</h3>
          </div>
          <Badge status={form.category}>{form.category} Tier</Badge>
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
                <input className="kfpl-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="investor@email.com" required />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Phone Number <span className="required">*</span></label>
                <input className="kfpl-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Date of Birth</label>
                <input className="kfpl-input" name="dob" type="date" value={form.dob} onChange={handleChange} />
              </div>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Address</label>
              <textarea className="kfpl-textarea" name="address" value={form.address} onChange={handleChange} placeholder="Full address" rows="2" />
            </div>
          </div>

          {/* Status & Category */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Account Settings</div>
            <div className="kfpl-form-row-3">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Category / Tier</label>
                <select className="kfpl-input" name="category" value={form.category} onChange={handleChange}>
                  <option value="SILVER">Silver</option>
                  <option value="GOLD">Gold</option>
                  <option value="DIAMOND">Diamond</option>
                  <option value="PLATINUM">Platinum</option>
                </select>
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Status</label>
                <select className="kfpl-input" name="status" value={form.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Risk Profile</label>
                <select className="kfpl-input" name="riskProfile" value={form.riskProfile} onChange={handleChange}>
                  <option value="Conservative">Conservative</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Aggressive">Aggressive</option>
                </select>
              </div>
            </div>
            <div className="kfpl-form-row" style={{ marginTop: '16px' }}>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Residency / Citizenship</label>
                <select className="kfpl-select" name="citizenship" value={form.citizenship} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>
                  <option value="National (Domestic)">National (Domestic)</option>
                  <option value="International">International</option>
                </select>
              </div>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Agent / Source of Client</label>
                <select 
                  className="kfpl-select" 
                  value={selectedAgentId} 
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                >
                  <option value="Direct Client (No Agent)">Direct Client (No Agent)</option>
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
                <label className="kfpl-input-label">Contract Start Date</label>
                <input 
                  type="date" 
                  className="kfpl-input" 
                  name="contractStartDate" 
                  value={form.contractStartDate} 
                  onChange={handleChange}
                />
              </div>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Contract End Date</label>
                <input 
                  type="date" 
                  className="kfpl-input" 
                  name="contractEndDate" 
                  value={form.contractEndDate} 
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="kfpl-form-row" style={{ marginTop: '16px' }}>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Extend Contract Date</label>
                <input 
                  type="date" 
                  className="kfpl-input" 
                  name="extendContractDate" 
                  value={form.extendContractDate} 
                  onChange={handleChange} 
                  min={form.contractEndDate || form.contractStartDate || undefined}
                />
              </div>
              <div style={{ flex: 1 }}></div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">KYC & Banking Information</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">PAN Card / Tax ID <span className="required">*</span></label>
                <input className="kfpl-input" name="pan" value={form.pan} onChange={handleChange} placeholder="PAN Card or SWIFT code" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Bank Name <span className="required">*</span></label>
                <input className="kfpl-input" name="bankName" value={form.bankName} onChange={handleChange} placeholder="HDFC, SBI, etc." required />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Account Number <span className="required">*</span></label>
                <input className="kfpl-input" name="accountNo" value={form.accountNo} onChange={handleChange} placeholder="Bank account number" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">IFSC / Routing Code <span className="required">*</span></label>
                <input className="kfpl-input" name="ifsc" value={form.ifsc} onChange={handleChange} placeholder="IFSC code" required />
              </div>
            </div>
          </div>

          {/* Nominee Details */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">Nominee Details</div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Full Name</label>
                <input className="kfpl-input" name="nomineeName" value={form.nomineeName} onChange={handleChange} placeholder="Enter nominee name" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Relationship to Client</label>
                <input className="kfpl-input" name="nomineeRelation" value={form.nomineeRelation} onChange={handleChange} placeholder="Spouse, Son, Daughter, etc." />
              </div>
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Contact Number</label>
                <input className="kfpl-input" name="nomineeContact" value={form.nomineeContact} onChange={handleChange} placeholder="Phone number" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Nominee Email Address</label>
                <input className="kfpl-input" name="nomineeEmail" type="email" value={form.nomineeEmail} onChange={handleChange} placeholder="nominee@email.com" />
              </div>
            </div>
            <div className="kfpl-input-group" style={{ marginTop: '16px' }}>
              <label className="kfpl-input-label">Nominee Residency Status</label>
              <select className="kfpl-select" name="nomineeCitizenship" value={form.nomineeCitizenship} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>
                <option value="National (Domestic)">National (Domestic)</option>
                <option value="International">International</option>
              </select>
            </div>
          </div>

          {/* Document Re-upload Section */}
          <div className="kfpl-form-section">
            <div className="kfpl-form-section-title">KYC & Agreement Document Uploads (Edit / Delete / Re-upload)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <FileDropzone
                label={form.citizenship === 'International' ? 'Tax ID Upload' : 'PAN Card Upload'}
                multiple={false}
                existingFileUrl={existingDocs.panDocument}
                onFilesChange={(files) => setPanDocFile(files[0] || null)}
                onDeleteExisting={() => handleDeleteDoc('panDocument')}
              />
              <FileDropzone
                label={form.citizenship === 'International' ? 'Passport / National ID Card Upload' : 'ID Proof Upload (Aadhaar / DL / Passport)'}
                multiple={false}
                existingFileUrl={existingDocs.aadhaarDocument}
                onFilesChange={(files) => setAadhaarDocFile(files[0] || null)}
                onDeleteExisting={() => handleDeleteDoc('aadhaarDocument')}
              />
              <FileDropzone
                label="Bank Details Document"
                multiple={false}
                existingFileUrl={existingDocs.bankProofDocument}
                onFilesChange={(files) => setBankProofDocFile(files[0] || null)}
                onDeleteExisting={() => handleDeleteDoc('bankProofDocument')}
              />
              <FileDropzone
                label="Signed Investment Agreement"
                multiple={false}
                existingFileUrl={existingDocs.agreementDocument}
                onFilesChange={(files) => setAgreementDocFile(files[0] || null)}
                onDeleteExisting={() => handleDeleteDoc('agreementDocument')}
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <FileDropzone
                  label="Nominee ID Proof Document"
                  multiple={false}
                  existingFileUrl={existingDocs.nomineeProofDocument}
                  onFilesChange={(files) => setNomineeProofDocFile(files[0] || null)}
                  onDeleteExisting={() => handleDeleteDoc('nomineeProofDocument')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="kfpl-form-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '24px 30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="kfpl-btn kfpl-btn--ghost" onClick={() => navigate(`/investors/${id}`)} disabled={submitLoading}>
            Cancel
          </button>
          <button type="submit" className="kfpl-btn kfpl-btn--primary" style={{ minWidth: '140px' }} disabled={submitLoading}>
            {submitLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
