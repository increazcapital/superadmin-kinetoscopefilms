import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { apiRequest } from '../../config/apiHelper';

export default function ServiceRequestsPage() {
  const addToast = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Raiser data lookup maps (to resolve N/A and GOLD role bugs)
  const [raiserMap, setRaiserMap] = useState({ clients: new Map(), agents: new Map() });
  const [seqMap, setSeqMap] = useState({});

  // Filter States
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form edit states
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');
  const [sendEmail, setSendEmail] = useState(true);

  const fetchRaiserData = async () => {
    try {
      const [clientsData, agentsData] = await Promise.all([
        apiRequest('/api/super-admin/clients').catch(() => ({})),
        apiRequest('/api/super-admin/agents').catch(() => ({}))
      ]);

      const cList = clientsData.data?.clients || clientsData.data || clientsData.clients || (Array.isArray(clientsData) ? clientsData : []);
      const aList = agentsData.data?.agents || agentsData.data || agentsData.agents || (Array.isArray(agentsData) ? agentsData : []);

      const clientsMap = new Map();
      cList.forEach(c => {
        const id = c._id || c.id;
        const profile = c.profile || {};
        const user = c.userId || c.user || {};
        const name = profile.fullName || user.name || user.fullName || c.fullName || c.name || '';
        if (name) {
          if (id) clientsMap.set(id, name);
          
          // Map user credential ID if present as string or object
          const uId = typeof c.userId === 'string' ? c.userId : (user._id || user.id);
          if (uId) clientsMap.set(uId, name);
          
          // Map profile user ID
          const profUserId = typeof profile.userId === 'string' ? profile.userId : (profile.user?._id || profile.user?.id);
          if (profUserId) clientsMap.set(profUserId, name);
        }
      });

      const agentsMap = new Map();
      aList.forEach(a => {
        const id = a._id || a.id;
        const profile = a.profile || {};
        const user = a.userId || a.user || {};
        const name = profile.fullName || user.name || user.fullName || a.fullName || a.name || '';
        if (name) {
          if (id) agentsMap.set(id, name);
          
          // Map user credential ID if present as string or object
          const uId = typeof a.userId === 'string' ? a.userId : (user._id || user.id);
          if (uId) agentsMap.set(uId, name);
          
          // Map profile user ID
          const profUserId = typeof profile.userId === 'string' ? profile.userId : (profile.user?._id || profile.user?.id);
          if (profUserId) agentsMap.set(profUserId, name);
        }
      });

      setRaiserMap({ clients: clientsMap, agents: agentsMap });
    } catch (err) {
      console.error('Failed to load raiser details for lookup:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);

      const params = [];
      if (statusFilter !== 'All') params.push(`status=${statusFilter}`);
      if (typeFilter !== 'All') params.push(`raiserType=${typeFilter}`);
      const queryString = params.length > 0 ? `?${params.join('&')}` : '';

      const data = await apiRequest(`/api/super-admin/service-requests${queryString}`);
      console.log('Super Admin Service Requests Raw Data:', data);

      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data) {
        if (data.requests && Array.isArray(data.requests)) {
          list = data.requests;
        } else if (data.serviceRequests && Array.isArray(data.serviceRequests)) {
          list = data.serviceRequests;
        } else if (data.data) {
          if (Array.isArray(data.data)) {
            list = data.data;
          } else if (data.data.requests && Array.isArray(data.data.requests)) {
            list = data.data.requests;
          } else if (data.data.serviceRequests && Array.isArray(data.data.serviceRequests)) {
            list = data.data.serviceRequests;
          }
        }
      }

      setRequests(list);
    } catch (err) {
      console.error('Failed to load support requests:', err);
      addToast(err.message || 'Failed to fetch service requests', 'danger', 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('kfpl_service_requests_last_read', Date.now().toString());
    localStorage.setItem('kfpl_requests_viewed', 'true');
    window.dispatchEvent(new Event('serviceRequestsUpdated'));

    fetchRaiserData().then(() => {
      fetchRequests();
    });
  }, [statusFilter, typeFilter]);

  const handleOpenDetail = async (req) => {
    try {
      const reqId = req._id || req.id;
      if (!reqId) {
        throw new Error('No valid request ID found in the record.');
      }
      
      const response = await apiRequest(`/api/super-admin/service-requests/${reqId}`);
      console.log('Super Admin Service Request Detail Raw Data:', response);

      let detail = null;
      if (response) {
        if (response._id || response.id) {
          detail = response;
        } else if (response.request && (response.request._id || response.request.id)) {
          detail = response.request;
        } else if (response.serviceRequest && (response.serviceRequest._id || response.serviceRequest.id)) {
          detail = response.serviceRequest;
        } else if (response.data) {
          if (response.data._id || response.data.id) {
            detail = response.data;
          } else if (response.data.request && (response.data.request._id || response.data.request.id)) {
            detail = response.data.request;
          } else if (response.data.serviceRequest && (response.data.serviceRequest._id || response.data.serviceRequest.id)) {
            detail = response.data.serviceRequest;
          }
        }
      }

      if (!detail) {
        detail = req;
      }

      setSelectedReq(detail);
      setEditStatus(detail.status || 'Open');
      setEditNote(detail.adminRemarks || detail.adminNote || '');
      setSendEmail(false);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error fetching detail, falling back to list record:', err);
      setSelectedReq(req);
      setEditStatus(req.status || 'Open');
      setEditNote(req.adminRemarks || req.adminNote || '');
      setSendEmail(false);
      setShowDetailModal(true);
    }
  };

  const handleSaveChanges = async () => {
    if (!editStatus) {
      alert('Please select a status.');
      return;
    }

    try {
      setSaving(true);
      await apiRequest(`/api/super-admin/service-requests/${selectedReq._id || selectedReq.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editStatus,
          adminRemarks: editNote,
          notifyUser: sendEmail
        }),
      });

      addToast('Service Request updated successfully', 'success', 'Request Updated');
      setShowDetailModal(false);
      setSelectedReq(null);
      
      // Reload and broadcast custom event
      await fetchRequests();
      window.dispatchEvent(new Event('serviceRequestsUpdated'));
    } catch (err) {
      console.error('Failed to update service request:', err);
      addToast(err.message || 'Failed to update request', 'danger', 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!window.confirm('Are you sure you want to delete this service request? This action cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await apiRequest(`/api/super-admin/service-requests/${selectedReq._id || selectedReq.id}`, {
        method: 'DELETE'
      });

      addToast('Service Request deleted successfully', 'success', 'Request Deleted');
      setShowDetailModal(false);
      setSelectedReq(null);

      // Reload and broadcast custom event
      await fetchRequests();
      window.dispatchEvent(new Event('serviceRequestsUpdated'));
    } catch (err) {
      console.error('Failed to delete service request:', err);
      addToast(err.message || 'Failed to delete request', 'danger', 'Error');
    } finally {
      setSaving(false);
    }
  };

  // Helper resolvers for displaying clean values
  const resolveRaiserName = (req) => {
    if (!req) return 'N/A';
    
    // 1. Check createdBy object (real database fields)
    const creator = req.createdBy;
    if (creator && typeof creator === 'object') {
      const name = creator.name || creator.fullName || creator.profile?.fullName || creator.profile?.name;
      if (name) return name;
      if (creator.email) return creator.email;
    }

    // 2. Check populated raiserId object
    const raiser = req.raiserId;
    if (raiser && typeof raiser === 'object') {
      const name = raiser.fullName || raiser.name || raiser.profile?.fullName || raiser.profile?.name || raiser.user?.name || raiser.user?.fullName;
      if (name) return name;
      if (raiser.email) return raiser.email;
    }
    
    // 3. Check if raiserId or createdBy is string ID and resolve using raiserMap
    const raiserIdStr = typeof req.raiserId === 'object' ? (req.raiserId?._id || req.raiserId?.id) : req.raiserId;
    const creatorIdStr = typeof req.createdBy === 'object' ? (req.createdBy?._id || req.createdBy?.id) : req.createdBy;
    const lookupId = creatorIdStr || raiserIdStr;
    if (lookupId) {
      const lookupName = raiserMap.clients.get(lookupId) || raiserMap.agents.get(lookupId);
      if (lookupName) return lookupName;
    }
    
    return req.raisedBy || 'N/A';
  };

  const resolveRaiserType = (req) => {
    if (!req) return 'Client';
    
    const raiserIdStr = typeof req.raiserId === 'object' ? (req.raiserId?._id || req.raiserId?.id) : req.raiserId;
    const creatorIdStr = typeof req.createdBy === 'object' ? (req.createdBy?._id || req.createdBy?.id) : req.createdBy;
    const lookupId = creatorIdStr || raiserIdStr;

    // 1. Resolve via lookup maps
    if (lookupId) {
      if (raiserMap.clients.has(lookupId)) return 'Client';
      if (raiserMap.agents.has(lookupId)) return 'Agent';
    }
    
    // 2. Resolve via createdBy.role or createdBy.userType
    const creator = req.createdBy;
    if (creator && typeof creator === 'object') {
      const roleVal = creator.role || creator.userType || '';
      if (typeof roleVal === 'string' && roleVal) {
        const lower = roleVal.toLowerCase();
        if (lower.includes('agent')) return 'Agent';
        if (lower.includes('client') || lower.includes('investor')) return 'Client';
      }
    }

    // 3. Resolve via fields
    const raiser = req.raiserId;
    if (raiser && typeof raiser === 'object') {
      if (raiser.agentId || raiser.commissionMonthly !== undefined) return 'Agent';
      if (raiser.clientId || raiser.clientCode || raiser.totalInvestment !== undefined) return 'Client';
    }
    
    const typeVal = req.raiserType || req.role || req.onModel || req.raiserModel || '';
    if (typeof typeVal === 'string' && typeVal) {
      const clean = typeVal.trim();
      const lower = clean.toLowerCase();
      if (lower.includes('agent')) return 'Agent';
      if (lower.includes('client') || lower.includes('investor') || lower.includes('gold') || lower.includes('silver')) {
        return 'Client';
      }
    }
    
    return 'Client';
  };

  const getDisplayId = (req) => {
    if (!req) return 'N/A';
    return req.requestId || req.ticketId || req.id || (req._id ? 'SR-' + req._id.substring(req._id.length - 6).toUpperCase() : 'N/A');
  };

  const getAttachmentUrl = (req) => {
    if (!req) return null;
    const urlVal = req.attachmentUrl || req.attachment || req.fileUrl || req.file || req.filePath;
    if (!urlVal) return null;
    if (typeof urlVal === 'string') return urlVal;
    if (typeof urlVal === 'object') {
      return urlVal.url || urlVal.filePath || urlVal.path || null;
    }
    return null;
  };

  const isSeededMock = (req) => {
    const mockSubjects = [
      'ROI payout timeline confirmation',
      'Monthly Commission Delay',
      'Address Update Request',
      'Commission Payout Enquiry',
      'ROI Payment Pending',
      'Add new segment request',
      'KYC document update'
    ];
    // Seeded mock requests are those with mock subjects that don't match any active client/agent ID in the database
    const raiserIdStr = typeof req.raiserId === 'object' ? (req.raiserId?._id || req.raiserId?.id) : req.raiserId;
    const hasRealRaiser = raiserIdStr && (raiserMap.clients.has(raiserIdStr) || raiserMap.agents.has(raiserIdStr));
    return mockSubjects.includes(req.subject) && !hasRealRaiser;
  };

  // Client-side date and mock filters
  const filteredRequests = requests.filter(req => {
    // Remove seeded mock requests
    if (isSeededMock(req)) return false;

    const reqDate = req.createdAt || req.dateRaised || req.date;
    if (startDate && reqDate && reqDate.substring(0, 10) < startDate) return false;
    if (endDate && reqDate && reqDate.substring(0, 10) > endDate) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    const map = {
      'Open': 'pending', // orange
      'In Progress': 'gold', // gold
      'Resolved': 'active', // green
      'Closed': 'inactive' // grey
    };
    return map[status] || 'inactive';
  };

  const unresolvedCount = filteredRequests.filter(r => r.status === 'Open' || r.status === 'In Progress').length;

  return (
    <div className="kfpl-page animate-fade-slide-up">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Service Requests</h2>
          <p className="kfpl-page-subtitle">
            Manage inquiries, update requests, and issues raised by clients and agents (Unresolved: <strong style={{ color: 'var(--color-gold-dark)' }}>{unresolvedCount}</strong>)
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="kfpl-card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div className="kfpl-form-row-3" style={{ gap: '16px', flexWrap: 'wrap' }}>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Filter by Status</label>
            <select className="kfpl-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Filter by Raiser Type</label>
            <select className="kfpl-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="All">All Raisers</option>
              <option value="Client">Client</option>
              <option value="Agent">Agent</option>
            </select>
          </div>

          <div className="kfpl-input-group" style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label className="kfpl-input-label">Start Date</label>
              <input type="date" className="kfpl-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="kfpl-input-label">End Date</label>
              <input type="date" className="kfpl-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="kfpl-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
            Loading service requests...
          </div>
        ) : (
          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Raised By</th>
                  <th>Raiser Type</th>
                  <th>Date Raised</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-muted)' }}>
                      No service requests found matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map(req => {
                    const displayId = getDisplayId(req);
                    const raisedByName = resolveRaiserName(req);
                    const raiserType = resolveRaiserType(req);
                    const reqDate = req.createdAt || req.dateRaised || req.date;
                    
                    return (
                      <tr key={req._id || req.id} onClick={() => handleOpenDetail(req)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 600 }}>{displayId}</td>
                        <td className="kfpl-table-cell-primary">{raisedByName}</td>
                        <td>
                          <Badge status={raiserType === 'Client' ? 'silver' : 'gold'}>
                            {raiserType}
                          </Badge>
                        </td>
                        <td>{reqDate ? new Date(reqDate).toLocaleDateString('en-IN') : 'N/A'}</td>
                        <td>{req.subject}</td>
                        <td>
                          <Badge status={getStatusBadge(req.status)}>{req.status}</Badge>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={(e) => { e.stopPropagation(); handleOpenDetail(req); }}>
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail & Response Modal */}
      {selectedReq && (
        <Modal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          title={`Review Service Request - ${getDisplayId(selectedReq)}`}
          footer={
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button"
                className="kfpl-btn kfpl-btn--danger" 
                onClick={handleDeleteRequest}
                disabled={saving}
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                Delete Request
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowDetailModal(false)} disabled={saving}>Cancel</button>
                <button type="button" className="kfpl-btn kfpl-btn--primary" onClick={handleSaveChanges} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          }
        >
          <div className="kfpl-form" style={{ gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>RAISED BY</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--color-navy)' }}>
                  {resolveRaiserName(selectedReq)} ({resolveRaiserType(selectedReq)})
                </strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>DATE RAISED</span>
                <strong style={{ fontSize: '0.95rem', color: 'var(--color-navy)' }}>
                  {selectedReq.createdAt || selectedReq.dateRaised || selectedReq.date ? new Date(selectedReq.createdAt || selectedReq.dateRaised || selectedReq.date).toLocaleDateString('en-IN') : 'N/A'}
                </strong>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>SUBJECT</span>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-navy)' }}>{selectedReq.subject}</div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>DESCRIPTION</span>
              <div style={{ fontSize: '0.875rem', padding: '10px 14px', borderRadius: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                {selectedReq.description}
              </div>
            </div>

            {getAttachmentUrl(selectedReq) && (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>ATTACHMENT</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a 
                    href={getAttachmentUrl(selectedReq).startsWith('http') ? getAttachmentUrl(selectedReq) : `http://192.168.1.28:5000${getAttachmentUrl(selectedReq).startsWith('/') ? '' : '/'}${getAttachmentUrl(selectedReq)}`}
                    target="_blank" 
                    rel="noreferrer" 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      color: 'var(--color-gold)', 
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      textDecoration: 'none'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    View Attached File
                  </a>
                  {/\.(jpg|jpeg|png|gif|webp)$/i.test(getAttachmentUrl(selectedReq)) && (
                    <img 
                      src={getAttachmentUrl(selectedReq).startsWith('http') ? getAttachmentUrl(selectedReq) : `http://192.168.1.28:5000${getAttachmentUrl(selectedReq).startsWith('/') ? '' : '/'}${getAttachmentUrl(selectedReq)}`}
                      alt="Attachment Preview"
                      style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', border: '1px solid var(--color-border)', objectFit: 'cover', marginTop: '4px' }}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="kfpl-form-row" style={{ gap: '16px', alignItems: 'flex-end' }}>
              <div className="kfpl-input-group" style={{ flex: 1 }}>
                <label className="kfpl-input-label">Update Status</label>
                <select className="kfpl-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="kfpl-input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '62px', justifyContent: 'flex-end' }}>
                <label className="kfpl-input-label" style={{ marginBottom: '6px' }}>Email Notification</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '38px' }}>
                  <button
                    type="button"
                    onClick={() => setSendEmail(!sendEmail)}
                    style={{
                      position: 'relative',
                      width: '46px',
                      height: '24px',
                      borderRadius: '12px',
                      background: sendEmail ? 'var(--color-success, #10b981)' : '#cbd5e1',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.25s ease',
                      padding: 0,
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        transform: sendEmail ? 'translateX(26px)' : 'translateX(4px)'
                      }}
                    />
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: sendEmail ? 'var(--color-text)' : 'var(--color-text-muted)', transition: 'color 0.2s' }}>
                    {sendEmail ? 'Notify Raiser via Email' : 'Do Not Notify'}
                  </span>
                </div>
              </div>
            </div>

            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Internal Admin Response / Remarks</label>
              <textarea
                className="kfpl-textarea"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Write resolution steps, internal audit notes, or replies..."
                rows="3"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============ END: ServiceRequestsPage.jsx ============ */
