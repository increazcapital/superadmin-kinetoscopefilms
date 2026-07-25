/* ============================================================
   Page: AssignInvestment.jsx
   Description: Form to assign investment to a client
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { INVESTMENT_SEGMENTS as MOCK_INVESTMENT_SEGMENTS } from '../../data/mockData';
import { apiRequest } from '../../config/apiHelper';
import { formatClientID } from '../../utils/formatters';

export default function AssignInvestment() {
  const navigate = useNavigate();
  const addToast = useToast();
  
  const [form, setForm] = useState({
    clientId: '',
    amount: '',
    roi: '',
    riskPercentage: '',
    riskLevel: 'Medium',
    contractPeriod: '',
    dateOfJoining: new Date().toISOString().split('T')[0]
  });

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [segments, setSegments] = useState(MOCK_INVESTMENT_SEGMENTS);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch clients and projects from backend API on mount
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const [clientsRes, projectsRes, segmentsRes] = await Promise.all([
          apiRequest('/api/super-admin/clients').catch(() => null),
          apiRequest('/api/super-admin/projects').catch(() => null),
          apiRequest('/api/super-admin/segments').catch(() => null)
        ]);

        // Extract clients list
        if (clientsRes) {
          let cList = [];
          if (Array.isArray(clientsRes)) {
            cList = clientsRes;
          } else if (clientsRes.data?.clients) {
            cList = clientsRes.data.clients;
          } else if (clientsRes.data && Array.isArray(clientsRes.data)) {
            cList = clientsRes.data;
          } else if (clientsRes.clients) {
            cList = clientsRes.clients;
          }
          setClients(cList);
        }

        // Extract projects list
        if (projectsRes) {
          let pList = [];
          if (Array.isArray(projectsRes)) {
            pList = projectsRes;
          } else if (projectsRes.data?.projects) {
            pList = projectsRes.data.projects;
          } else if (projectsRes.data && Array.isArray(projectsRes.data)) {
            pList = projectsRes.data;
          } else if (projectsRes.projects) {
            pList = projectsRes.projects;
          }
          setProjects(pList);
        }

        // Extract segments list
        if (segmentsRes) {
          let sList = [];
          if (Array.isArray(segmentsRes)) {
            sList = segmentsRes;
          } else if (segmentsRes.data?.segments) {
            sList = segmentsRes.data.segments;
          } else if (segmentsRes.data && Array.isArray(segmentsRes.data)) {
            sList = segmentsRes.data;
          } else if (segmentsRes.segments) {
            sList = segmentsRes.segments;
          }
          if (sList && sList.length > 0) {
            const mapped = sList.map(s => ({
              id: s._id || s.id || s.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              name: s.name || '',
              color: s.color || '#10B981'
            }));
            setSegments(mapped);
          }
        }

        // Fallback: if projects came back empty, try localStorage
        if (!projectsRes || (Array.isArray(projectsRes) && projectsRes.length === 0)) {
          const storedProjects = localStorage.getItem('kfpl_portfolio_projects');
          if (storedProjects) {
            try {
              setProjects(JSON.parse(storedProjects));
            } catch (e) { /* ignore */ }
          }
        }
      } catch (err) {
        console.error('Failed to fetch clients/projects:', err);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    // Auto-fill ROI and Contract Period when client is selected
    if (name === 'clientId' && value) {
      const selectedClient = clients.find(c => {
        const cId = c.user?._id || c.user?.id || c._id || c.id;
        return String(cId) === String(value);
      });
      if (selectedClient) {
        const clientRoi = selectedClient.monthlyRoi || 
                          selectedClient.summaryCards?.monthlyRoi || 
                          selectedClient.profile?.monthlyRoi || 
                          selectedClient.roiPercentage || 
                          selectedClient.profile?.roiPercentage || '';
        
        // Try direct contractPeriod field first
        const p = selectedClient.profile || {};
        const h = selectedClient.header || {};
        const s = selectedClient.summaryCards || {};
        const u = (selectedClient.userId && typeof selectedClient.userId === 'object' ? selectedClient.userId : null) || 
                  (selectedClient.user && typeof selectedClient.user === 'object' ? selectedClient.user : null) || {};
        
        let clientPeriod = selectedClient.contractPeriod || selectedClient.durationMonths || 
                           p.contractPeriod || p.durationMonths || 
                           h.contractPeriod || h.durationMonths ||
                           s.contractPeriod || s.durationMonths ||
                           u.contractPeriod || u.durationMonths || '';
        
        // If not found, calculate from contractStartDate and contractEndDate
        if (!clientPeriod) {
          const startStr = selectedClient.contractStartDate || p.contractStartDate || h.contractStartDate ||
                           selectedClient.joinDate || p.joinDate || selectedClient.createdAt || p.createdAt || '';
          const endStr = selectedClient.contractEndDate || p.contractEndDate || h.contractEndDate ||
                         selectedClient.extendContractDate || p.extendContractDate || 
                         selectedClient.contractExtendedDate || p.contractExtendedDate || '';
          if (startStr && endStr) {
            const sd = new Date(startStr);
            const ed = new Date(endStr);
            if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
              const months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
              if (months > 0) {
                clientPeriod = months;
              }
            }
          }
        }
        
        // Final fallback: scan all keys for anything matching "period" or "duration"
        if (!clientPeriod) {
          const allKeys = Object.keys(selectedClient);
          for (const key of allKeys) {
            const lk = key.toLowerCase();
            if ((lk.includes('period') || lk.includes('duration') || lk.includes('tenure') || lk.includes('month')) && typeof selectedClient[key] === 'number') {
              clientPeriod = selectedClient[key];
              break;
            }
          }
        }

        const updates = { clientId: value };
        const autoFilled = [];
        if (clientRoi) {
          updates.roi = String(clientRoi);
          autoFilled.push(`ROI ${clientRoi}%`);
        }
        if (clientPeriod) {
          updates.contractPeriod = String(clientPeriod);
          autoFilled.push(`Contract ${clientPeriod} months`);
        }
        if (autoFilled.length > 0) {
          setForm(prev => ({ ...prev, ...updates }));
          addToast(`${autoFilled.join(', ')} auto-filled from client profile`, 'info', 'Auto-Filled');
        }
      }
    }
  };

  const getClientName = (client) => {
    const profile = client.profile || {};
    const user = client.userId || client.user || {};
    return profile.fullName || user.name || user.fullName || client.fullName || client.name || client.email || 'Unknown';
  };

  const getClientCode = (client) => {
    const raw = client.clientCode || client.profile?.clientCode || client.user?.clientCode || client.clientId || client.profile?.clientId || client._id || client.id || '';
    return formatClientID(raw);
  };

  const handleProjectChange = (e) => {
    const pId = e.target.value;
    setSelectedProjectId(pId);
    
    if (!pId) {
      // Clear auto-filled selections when project is deselected
      setSelectedSegments([]);
      setAllocations({});
      return;
    }

    const project = projects.find(p => String(p._id || p.id) === String(pId));
    if (project) {
      // 1. Load ROI from project
      const rawRoi = project.roi || project.roiPercentage || '';
      const numRoi = parseFloat(String(rawRoi).replace(/[^0-9.]/g, ''));
      if (!isNaN(numRoi)) {
        setForm(prev => ({ ...prev, roi: numRoi.toFixed(2) }));
        addToast(`ROI of ${numRoi}% auto-filled from project`, 'info', 'Auto-Filled ROI');
      }

      // 2. Auto-select segment and set allocation to 100%
      const projectSegment = project.segment || project.category || '';
      if (projectSegment) {
        const cleanProjSeg = projectSegment.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchingSeg = segments.find(s => {
          const cleanName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanId = s.id.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanName === cleanProjSeg || cleanId === cleanProjSeg;
        });

        if (matchingSeg) {
          const segId = matchingSeg.id;
          setSelectedSegments([segId]);
          setAllocations({ [segId]: '100' });
        } else {
          // If no matching segment found, clear allocations so we don't inject bad IDs
          setSelectedSegments([]);
          setAllocations({});
        }
      }
    }
  };

  const handleSegmentToggle = (segId) => {
    if (selectedSegments.includes(segId)) {
      setSelectedSegments(prev => prev.filter(id => id !== segId));
      setAllocations(prev => {
        const copy = { ...prev };
        delete copy[segId];
        return copy;
      });
    } else {
      setSelectedSegments(prev => [...prev, segId]);
      setAllocations(prev => ({ ...prev, [segId]: '' }));
    }
  };

  const handleAllocationChange = (segId, value) => {
    setAllocations(prev => ({ ...prev, [segId]: value }));
  };

  const totalAllocation = selectedSegments.reduce((sum, segId) => {
    const val = parseFloat(allocations[segId]);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (selectedSegments.length === 0) {
      addToast('Please select at least one segment', 'error', 'Validation Error');
      setLoading(false);
      return;
    }

    if (totalAllocation !== 100) {
      addToast('Total allocation across segments must be exactly 100%', 'error', 'Validation Error');
      setLoading(false);
      return;
    }

    if (!form.clientId) {
      addToast('Please select a client', 'error', 'Validation Error');
      setLoading(false);
      return;
    }

    // Build segmentAllocation payload matching backend contract
    const segmentAllocation = selectedSegments.map(sid => ({
      segmentName: segments.find(s => s.id === sid)?.name || sid,
      allocationPercentage: parseFloat(allocations[sid]) || 0
    }));

    const payload = {
      clientId: form.clientId,
      investmentAmount: Number(form.amount),
      roiPercentage: Number(form.roi),
      riskPercentage: Number(form.riskPercentage) || 0,
      riskLevel: form.riskLevel || 'Medium',
      durationMonths: Number(form.contractPeriod) || 24,
      segmentAllocation
    };

    // Include projectId if a project was selected
    if (selectedProjectId) {
      payload.projectId = selectedProjectId;
    }

    try {
      await apiRequest('/api/super-admin/investments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      addToast('Investment assigned successfully!', 'success', 'Investment Created');
      setTimeout(() => navigate('/investments'), 500);
    } catch (err) {
      console.error('Failed to create investment:', err);
      addToast(err.message || 'Failed to assign investment.', 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Assign Investment</h2>
          <p className="kfpl-page-subtitle">Assign a new investment project to a client across segments</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/investments')}>Cancel</button>
        </div>
      </div>

      {dataLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-muted)' }}>
          Loading clients and projects...
        </div>
      ) : (
        <form className="kfpl-form-card" onSubmit={handleSubmit}>
          <div className="kfpl-form-card-header">
            <div>
              <h3 className="kfpl-form-card-title">Investment Details</h3>
            </div>
          </div>

          <div className="kfpl-form">
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Select Project (Optional — Auto-fills Segment & ROI)</label>
                <select
                  className="kfpl-select"
                  name="selectedProjectId"
                  value={selectedProjectId}
                  onChange={handleProjectChange}
                >
                  <option value="">Choose project to link</option>
                  {projects.map(p => {
                    const pId = p._id || p.id;
                    const pRoi = p.roi || p.roiPercentage || '';
                    const pSeg = p.segment || p.category || '';
                    return (
                      <option key={pId} value={pId}>
                        {p.name} ({pSeg}{pRoi ? ` — ROI: ${pRoi}` : ''})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Select Client <span className="required">*</span></label>
                <select className="kfpl-select" name="clientId" value={form.clientId} onChange={handleChange} required>
                  <option value="">Choose client</option>
                  {clients.map(c => {
                    const cId = c.user?._id || c.user?.id || c._id || c.id;
                    const cName = getClientName(c);
                    const cCode = getClientCode(c);
                    return (
                      <option key={cId} value={cId}>
                        {cName}{cCode ? ` (${cCode})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Date of Joining / Contract Start <span className="required">*</span></label>
                <input
                  type="date"
                  className="kfpl-input"
                  name="dateOfJoining"
                  value={form.dateOfJoining}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            <div className="kfpl-form-row-3">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Amount (₹) <span className="required">*</span></label>
                <input className="kfpl-input" name="amount" type="number" value={form.amount} onChange={handleChange} onWheel={(e) => e.target.blur()} placeholder="Enter amount" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">ROI % <span className="required">*</span></label>
                <input className="kfpl-input" name="roi" type="number" step="0.1" value={form.roi} onChange={handleChange} onWheel={(e) => e.target.blur()} placeholder="e.g. 12" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Contract Period (months)</label>
                <input className="kfpl-input" name="contractPeriod" type="number" value={form.contractPeriod} onChange={handleChange} onWheel={(e) => e.target.blur()} placeholder="e.g. 24" />
              </div>
            </div>

            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Risk Percentage (%)</label>
                <input className="kfpl-input" name="riskPercentage" type="number" step="1" min="0" max="100" value={form.riskPercentage} onChange={handleChange} onWheel={(e) => e.target.blur()} placeholder="e.g. 30" />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Risk Level</label>
                <select className="kfpl-select" name="riskLevel" value={form.riskLevel} onChange={handleChange}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </div>

            {/* Segment Checkboxes + Allocation Inputs */}
            <div className="kfpl-form-section">
              <div className="kfpl-form-section-title">
                Investment Segment Allocation
                <span style={{ float: 'right', color: totalAllocation > 100 ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 700 }}>
                  Total Allocation: {totalAllocation}% / 100%
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
                {segments.map(seg => {
                  const isSelected = selectedSegments.includes(seg.id);
                  return (
                    <div
                      key={seg.id}
                      style={{
                        padding: '14px',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid var(--color-emerald)' : '1px solid var(--color-border)',
                        background: isSelected ? 'rgba(16, 185, 129, 0.04)' : 'var(--color-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, color: 'var(--color-navy)' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSegmentToggle(seg.id)}
                          style={{ width: '18px', height: '18px', accentColor: 'var(--color-emerald)' }}
                        />
                        {seg.name}
                      </label>

                      {isSelected && (
                        <div className="kfpl-input-group" style={{ margin: 0 }}>
                          <label className="kfpl-input-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Allocation (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="kfpl-input"
                            value={allocations[seg.id] ?? ''}
                            onChange={(e) => handleAllocationChange(seg.id, e.target.value)}
                            onWheel={(e) => e.target.blur()}
                            placeholder="e.g. 25"
                            style={{ padding: '6px 10px', height: '36px' }}
                            required
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="kfpl-form-actions">
              <button type="button" className="kfpl-btn kfpl-btn--ghost" onClick={() => navigate('/investments')} disabled={loading}>Cancel</button>
              <button type="submit" className="kfpl-btn kfpl-btn--primary" disabled={loading || totalAllocation !== 100}>
                {loading ? 'Assigning...' : 'Assign Investment'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============ END: AssignInvestment.jsx ============ */
