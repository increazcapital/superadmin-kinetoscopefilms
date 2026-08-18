import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { INVESTMENT_SEGMENTS as MOCK_INVESTMENT_SEGMENTS } from '../../data/mockData';
import { apiRequest } from '../../config/apiHelper';
import { formatClientID } from '../../utils/formatters';

export default function AssignInvestment() {
  const navigate = useNavigate();
  const location = useLocation();
  const addToast = useToast();

  const searchParams = new URLSearchParams(location.search);
  const editInvestmentId = searchParams.get('id') || searchParams.get('editId') || '';
  const isEditMode = Boolean(editInvestmentId);
  
  function getCalculatedEndDateStr(startDateStr, periodMonths) {
    if (!startDateStr) return '';
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return '';
    const months = parseInt(periodMonths, 10) || 18;
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  }

  function calculateMonthsBetweenDates(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 18;
    const sd = new Date(startDateStr);
    const ed = new Date(endDateStr);
    if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || ed <= sd) return 18;
    const months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
    return months > 0 ? months : 18;
  }

  const [form, setForm] = useState({
    clientId: '',
    amount: '',
    roi: '',
    riskPercentage: '',
    riskLevel: 'Medium',
    contractPeriod: '18',
    dateOfJoining: new Date().toISOString().split('T')[0],
    contractEndDate: getCalculatedEndDateStr(new Date().toISOString().split('T')[0], 18),
    extendContractDate: ''
  });

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [segments, setSegments] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [segmentProjectMap, setSegmentProjectMap] = useState({});
  const [selectedClientInfo, setSelectedClientInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch clients and projects from backend API on mount (+ real-time investment details if in Edit mode)
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      try {
        const urlParams = new URLSearchParams(location.search || window.location.search);
        const currentEditId = urlParams.get('id') || urlParams.get('editId') || editInvestmentId;

        const [clientsRes, projectsRes, segmentsRes, editInvRes] = await Promise.all([
          apiRequest('/api/super-admin/clients').catch(() => null),
          apiRequest('/api/super-admin/projects').catch(() => null),
          apiRequest('/api/super-admin/segments').catch(() => null),
          currentEditId ? apiRequest(`/api/super-admin/investments/${currentEditId}`).catch((err) => {
            console.error('Failed to fetch investment details:', err);
            return null;
          }) : Promise.resolve(null)
        ]);

        let cList = [];
        let pList = [];
        let sList = [];

        // Extract clients list
        if (clientsRes) {
          if (Array.isArray(clientsRes)) cList = clientsRes;
          else if (clientsRes.data?.clients) cList = clientsRes.data.clients;
          else if (clientsRes.data && Array.isArray(clientsRes.data)) cList = clientsRes.data;
          else if (clientsRes.clients) cList = clientsRes.clients;
          if (cList && cList.length > 0) {
            cList.sort((a, b) => {
              const codeA = formatClientID(a.user?.clientCode || a.clientCode || a.clientId || '');
              const codeB = formatClientID(b.user?.clientCode || b.clientCode || b.clientId || '');
              return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
            });
          }
          setClients(cList);
        }

        // Extract projects list
        if (projectsRes) {
          if (Array.isArray(projectsRes)) pList = projectsRes;
          else if (projectsRes.data?.projects) pList = projectsRes.data.projects;
          else if (projectsRes.data && Array.isArray(projectsRes.data)) pList = projectsRes.data;
          else if (projectsRes.projects) pList = projectsRes.projects;
          if (pList && pList.length > 0) {
            pList = pList.filter(p => p.name && !p.name.includes('__KFPL_DUMMY__') && !p.name.toUpperCase().includes('DUMMY'));
          }
          setProjects(pList);
        }

        // Extract segments list
        if (segmentsRes) {
          if (Array.isArray(segmentsRes)) sList = segmentsRes;
          else if (segmentsRes.data?.segments) sList = segmentsRes.data.segments;
          else if (segmentsRes.data && Array.isArray(segmentsRes.data)) sList = segmentsRes.data;
          else if (segmentsRes.segments) sList = segmentsRes.segments;
        }

        const mappedSegments = (sList && sList.length > 0) ? sList.map(s => ({
          id: s._id || s.id || s.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: s.name || '',
          color: s.color || '#10B981'
        })) : [
          { id: 'film-making', name: 'Film Making', color: '#10B981' },
          { id: 'distribution', name: 'Distribution', color: '#10B981' },
          { id: 'music', name: 'Music', color: '#10B981' },
          { id: 'trading-&-syndication', name: 'Trading & Syndication', color: '#10B981' },
          { id: 'content-ip-bank', name: 'Content IP Bank', color: '#10B981' },
          { id: 'exhibition', name: 'Exhibition', color: '#10B981' },
        ];
        setSegments(mappedSegments);

        // Fallback: if projects came back empty, try localStorage
        if (!projectsRes || (Array.isArray(projectsRes) && projectsRes.length === 0)) {
          const storedProjects = localStorage.getItem('kfpl_portfolio_projects');
          if (storedProjects) {
            try {
              const parsed = JSON.parse(storedProjects);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter(p => p.name && !p.name.includes('__KFPL_DUMMY__') && !p.name.toUpperCase().includes('DUMMY'));
                setProjects(filtered);
                pList = filtered;
              }
            } catch (e) { /* ignore */ }
          }
        }

        // If in Edit Mode, prefill form with real-time investment data
        if (editInvRes) {
          const invData = editInvRes.data?.investment || editInvRes.data || editInvRes.investment || editInvRes;
          if (invData && (invData._id || invData.investmentAmount !== undefined || invData.amount !== undefined)) {
            const clientUserId = invData.clientId?._id || invData.clientId || '';
            const startD = invData.investmentDate ? new Date(invData.investmentDate).toISOString().split('T')[0] : '';
            const endD = invData.contractEndDate ? new Date(invData.contractEndDate).toISOString().split('T')[0] : '';

            // Match client in cList
            const matchedClient = cList.find(c => {
              const cId = String(c.user?._id || c.user?.id || c.userId?._id || c.userId || c._id || c.id || '');
              const cCode = String(c.clientCode || c.user?.clientCode || '').toLowerCase().trim();
              const invCode = String(invData.clientCode || invData.clientId?.clientCode || '').toLowerCase().trim();
              return cId === String(clientUserId) || (cCode && invCode && cCode === invCode);
            });

            const resolvedClientId = matchedClient 
              ? String(matchedClient.user?._id || matchedClient.user?.id || matchedClient._id || matchedClient.id) 
              : String(clientUserId);

            setForm({
              clientId: resolvedClientId,
              amount: String(invData.investmentAmount !== undefined ? invData.investmentAmount : (invData.amount || '')),
              roi: String(invData.roiPercentage !== undefined ? invData.roiPercentage : (invData.roi || '')),
              riskPercentage: String(invData.riskPercentage !== undefined ? invData.riskPercentage : ''),
              riskLevel: invData.riskLevel || 'Medium',
              contractPeriod: String(invData.durationMonths || 18),
              dateOfJoining: startD || new Date().toISOString().split('T')[0],
              contractEndDate: endD || getCalculatedEndDateStr(startD, invData.durationMonths || 18),
              extendContractDate: ''
            });

            const pId = invData.projectId?._id || invData.projectId || '';
            if (pId) setSelectedProjectId(String(pId));

            if (matchedClient) {
              const totalDep = matchedClient.totalInvestment || matchedClient.totalPortfolioValue || invData.investmentAmount || 0;
              setSelectedClientInfo({
                name: matchedClient.name || matchedClient.user?.name || invData.clientName || invData.clientId?.name,
                clientCode: matchedClient.clientCode || matchedClient.user?.clientCode || invData.clientCode || invData.clientId?.clientCode,
                depositAmount: totalDep
              });
            } else {
              setSelectedClientInfo({
                name: invData.clientName || invData.clientId?.name || 'Client',
                clientCode: invData.clientCode || invData.clientId?.clientCode || '—',
                depositAmount: invData.investmentAmount || 0
              });
            }

            // Map segment allocations
            if (Array.isArray(invData.segmentAllocation) && invData.segmentAllocation.length > 0) {
              const preSelected = [];
              const preAlloc = {};
              const preProjMap = {};

              invData.segmentAllocation.forEach(alloc => {
                const sName = String(alloc.segmentName || '').toLowerCase().trim();
                const foundSeg = mappedSegments.find(s => 
                  s.name.toLowerCase().trim() === sName || 
                  s.id.toLowerCase().trim() === sName ||
                  s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === sName.replace(/[^a-z0-9]/g, '')
                );
                const segId = foundSeg ? foundSeg.id : alloc.segmentName;
                if (segId) {
                  preSelected.push(segId);
                  preAlloc[segId] = String(alloc.allocationPercentage !== undefined ? alloc.allocationPercentage : '');
                  if (alloc.projectId) {
                    preProjMap[segId] = String(alloc.projectId?._id || alloc.projectId);
                  }
                }
              });

              setSelectedSegments(preSelected);
              setAllocations(preAlloc);
              setSegmentProjectMap(preProjMap);
            } else if (invData.segment) {
              const sName = String(invData.segment).toLowerCase().trim();
              const foundSeg = mappedSegments.find(s => 
                s.name.toLowerCase().trim() === sName || 
                s.id.toLowerCase().trim() === sName
              );
              if (foundSeg) {
                const segId = foundSeg.id;
                setSelectedSegments([segId]);
                setAllocations({ [segId]: '100' });
                if (pId) setSegmentProjectMap({ [segId]: String(pId) });
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, [location.search, editInvestmentId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'dateOfJoining' || name === 'contractPeriod') {
      const newStart = name === 'dateOfJoining' ? value : form.dateOfJoining;
      const newPeriod = name === 'contractPeriod' ? value : form.contractPeriod;
      setForm(prev => ({ ...prev, [name]: value, contractEndDate: getCalculatedEndDateStr(newStart, newPeriod) }));
      return;
    }
    if (name === 'contractEndDate' || name === 'extendContractDate') {
      const startStr = form.dateOfJoining;
      const targetEnd = value || form.contractEndDate;
      const calcPeriod = calculateMonthsBetweenDates(startStr, targetEnd);
      setForm(prev => ({ ...prev, [name]: value, contractPeriod: String(calcPeriod) }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));

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
        
        const p = selectedClient.profile || {};
        const h = selectedClient.header || {};
        
        // Client contract dates resolution
        const clientStartDate = selectedClient.contractStartDate || p.contractStartDate || h.contractStartDate ||
                                selectedClient.joinDate || p.joinDate || selectedClient.createdAt || p.createdAt || '';

        const clientEndDate = selectedClient.contractEndDate || p.contractEndDate || h.contractEndDate || '';

        const clientExtDate = selectedClient.extendContractDate || p.extendContractDate || 
                              selectedClient.contractExtendedDate || p.contractExtendedDate || '';

        const formattedStartDate = clientStartDate 
          ? new Date(clientStartDate).toISOString().split('T')[0] 
          : new Date().toISOString().split('T')[0];

        let formattedEndDate = '';
        if (clientEndDate && !isNaN(new Date(clientEndDate).getTime())) {
          const sd = new Date(formattedStartDate);
          const ed = new Date(clientEndDate);
          if (ed > sd) {
            formattedEndDate = ed.toISOString().split('T')[0];
          }
        }

        let formattedExtDate = '';
        if (clientExtDate && !isNaN(new Date(clientExtDate).getTime())) {
          const sd = new Date(formattedStartDate);
          const extd = new Date(clientExtDate);
          if (extd > sd) {
            formattedExtDate = extd.toISOString().split('T')[0];
          }
        }

        if (!formattedEndDate) {
          formattedEndDate = getCalculatedEndDateStr(formattedStartDate, 18);
        }

        const targetEndDate = formattedExtDate || formattedEndDate;
        const calculatedMonths = calculateMonthsBetweenDates(formattedStartDate, targetEndDate);

        const clientDepAmount = Number(selectedClient.totalInvestment || selectedClient.amount || selectedClient.summaryCards?.totalInvestment || p.totalInvestment || 0);

        setSelectedClientInfo({
          depositAmount: clientDepAmount,
          name: getClientName(selectedClient)
        });

        const updates = { 
          clientId: value,
          dateOfJoining: formattedStartDate,
          contractEndDate: formattedEndDate,
          contractPeriod: String(calculatedMonths),
          extendContractDate: formattedExtDate
        };

        const autoFilled = [];
        if (clientDepAmount > 0) {
          updates.amount = String(clientDepAmount);
          autoFilled.push(`Amount: ₹${clientDepAmount.toLocaleString('en-IN')}`);
        } else {
          updates.amount = '';
        }

        autoFilled.push(`Start: ${formattedStartDate}`);
        autoFilled.push(`End: ${formattedEndDate}`);
        autoFilled.push(`Period: ${calculatedMonths} Months`);
        if (formattedExtDate) {
          autoFilled.push(`Extended: ${formattedExtDate}`);
        }

        if (clientRoi) {
          updates.roi = String(clientRoi);
          autoFilled.push(`ROI: ${clientRoi}%`);
        }

        setForm(prev => ({ ...prev, ...updates }));
        addToast(`Client info auto-filled: ${autoFilled.join(', ')}`, 'info', 'Auto-Filled');
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

    if (selectedClientInfo && selectedClientInfo.depositAmount === 0) {
      addToast('Cannot assign investment: This client has no approved capital deposited. Please approve a deposit first.', 'error', 'Action Blocked');
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

            <div className={form.extendContractDate ? "kfpl-form-row-3" : "kfpl-form-row"}>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Contract Start Date <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span> <span className="required">*</span></label>
                <input
                  type="date"
                  className="kfpl-input"
                  name="dateOfJoining"
                  value={form.dateOfJoining}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Contract End Date <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span> <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(Optional)</span></label>
                <input
                  type="date"
                  className="kfpl-input"
                  name="contractEndDate"
                  value={form.contractEndDate}
                  onChange={handleChange}
                />
              </div>
              {form.extendContractDate && (
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Contract Extended Date <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>(DD/MM/YYYY)</span></label>
                  <input
                    type="date"
                    className="kfpl-input"
                    name="extendContractDate"
                    value={form.extendContractDate}
                    onChange={handleChange}
                  />
                  <span style={{ color: '#3B82F6', fontSize: '0.78rem', fontWeight: 700, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Contract extension active
                  </span>
                </div>
              )}
            </div>

            <div className="kfpl-form-row-3">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Amount (₹) <span className="required">*</span></label>
                <input 
                  className="kfpl-input" 
                  name="amount" 
                  type="number" 
                  value={form.amount} 
                  onChange={handleChange} 
                  onWheel={(e) => e.target.blur()} 
                  placeholder={selectedClientInfo && selectedClientInfo.depositAmount === 0 ? "No capital deposited by client" : "Enter amount"} 
                  style={selectedClientInfo && selectedClientInfo.depositAmount === 0 ? { borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', cursor: 'not-allowed' } : {}}
                  disabled={Boolean(selectedClientInfo && selectedClientInfo.depositAmount === 0)}
                  required 
                />
                {selectedClientInfo && (
                  selectedClientInfo.depositAmount > 0 ? (
                    <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: 700, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Capital Deposited: ₹{Number(selectedClientInfo.depositAmount).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span style={{ color: '#EF4444', fontSize: '0.78rem', fontWeight: 700, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      No capital deposited by client (Capital Pending)
                    </span>
                  )
                )}
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">ROI % <span className="required">*</span></label>
                <input className="kfpl-input" name="roi" type="number" step="0.1" value={form.roi} onChange={handleChange} onWheel={(e) => e.target.blur()} placeholder="e.g. 12" required />
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Contract Period (months)</label>
                <input className="kfpl-input" name="contractPeriod" type="number" value={form.contractPeriod} onChange={handleChange} onWheel={(e) => e.target.blur()} placeholder="e.g. 18" />
                {form.extendContractDate && (
                  <span style={{ color: '#3B82F6', fontSize: '0.78rem', fontWeight: 700, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Includes contract extension period
                  </span>
                )}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                          <div className="kfpl-input-group" style={{ margin: 0 }}>
                            <label className="kfpl-input-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                              Allocation (%)
                            </label>
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

                          <div className="kfpl-input-group" style={{ margin: 0 }}>
                            <label className="kfpl-input-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                              Select Project (Optional)
                            </label>
                            {(() => {
                              const segProjects = projects.filter(p => {
                                const pSeg = (p.segment || p.category || '').toLowerCase().trim();
                                const sName = (seg.name || '').toLowerCase().trim();
                                return pSeg === sName;
                              });

                              return (
                                <select
                                  className="kfpl-select"
                                  value={segmentProjectMap[seg.id] || ''}
                                  onChange={(e) => setSegmentProjectMap(prev => ({ ...prev, [seg.id]: e.target.value }))}
                                  style={{ padding: '6px 10px', height: '36px', fontSize: '0.8125rem' }}
                                >
                                  <option value="">
                                    {segProjects.length > 0 ? '-- No Project (Segment-Only Allocation) --' : '-- No Projects In This Segment --'}
                                  </option>
                                  {segProjects.map(p => (
                                    <option key={p._id || p.id} value={p._id || p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              );
                            })()}
                          </div>
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
                {loading ? (isEditMode ? 'Updating...' : 'Assigning...') : (isEditMode ? 'Update Investment' : 'Assign Investment')}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

/* ============ END: AssignInvestment.jsx ============ */
