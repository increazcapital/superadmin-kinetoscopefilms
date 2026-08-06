/* ============================================================
   Page: InvestmentStatus.jsx
   Description: Dynamic Investment Status Dashboard for Super Admin.
                Uses standard portal design system, KpiCard components in 2x2 grid,
                dedicated Segment Filter Bar, delete functionality, DataTable styling,
                and comprehensive detail modals with media & update history.
   ============================================================ */

import { useState, useEffect, useMemo } from 'react';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import KpiCard from '../../components/ui/KpiCard';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';

// KPI Icons
const kpiIcons = {
  investment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  investors: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  commission: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <line x1="12" y1="6" x2="12" y2="18" />
    </svg>
  ),
  roi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
};

/* Dynamic HSL color for any segment string */
function getSegmentStyle(seg) {
  if (!seg) return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.1)' };
  let h = 0;
  for (let i = 0; i < seg.length; i++) h = seg.charCodeAt(i) + ((h << 5) - h);
  h = Math.abs(h) % 360;
  return { color: `hsl(${h}, 70%, 35%)`, bg: `hsla(${h}, 70%, 45%, 0.1)` };
}

/* Fallback gradient backgrounds for project cards */
function getSegmentGradient(seg) {
  let h = 0;
  for (let i = 0; i < (seg || '').length; i++) h = (seg || '').charCodeAt(i) + ((h << 5) - h);
  h = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${h}, 50%, 15%) 0%, hsl(${(h + 40) % 360}, 60%, 28%) 100%)`;
}

/* Slab-based commission calculation */
function computeSlabCommission(amount, slabs) {
  const num = Number(amount) || 0;
  if (!slabs || slabs.length === 0) {
    if (num < 2500000) return 1.0;
    if (num < 10000000) return 1.5;
    if (num < 30000000) return 2.0;
    return 2.5;
  }
  for (const slab of slabs) {
    const min = Number(slab.minAmount) || 0;
    const max = Number(slab.maxAmount) || Infinity;
    if (num >= min && num <= max) return Number(slab.percentage) || 1.5;
  }
  return 1.5;
}

export default function InvestmentStatus() {
  const { addToast } = useToast();

  /* ── Data States ──────────────────────────── */
  const [investments, setInvestments] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [dbSegments, setDbSegments] = useState([]);
  const [commissionSlabs, setCommissionSlabs] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── Filter States ────────────────────────── */
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('All');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grouped'

  /* ── Modal States & Deep Project Details ─── */
  const [detailItem, setDetailItem] = useState(null);
  const [projectUpdates, setProjectUpdates] = useState([]);
  const [loadingUpdates, setLoadingUpdates] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [targetInvestment, setTargetInvestment] = useState(null);
  const [approvedAmountInput, setApprovedAmountInput] = useState('');
  const [approving, setApproving] = useState(false);
  const [assignForm, setAssignForm] = useState({
    clientId: '', projectId: '', investmentAmount: '',
    roiPercentage: '', agentCommission: '', durationMonths: '24',
  });
  const [selectedClientInfo, setSelectedClientInfo] = useState(null);
  const [selectedProjectInfo, setSelectedProjectInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const openApproveModal = (inv) => {
    setTargetInvestment(inv);
    const initialAmt = inv.amount || inv.investmentAmount || inv.projectDetails?.minInvestment || 5;
    setApprovedAmountInput(initialAmt);
    setShowApproveModal(true);
  };

  const handleConfirmApproval = async () => {
    if (!targetInvestment) return;
    try {
      setApproving(true);
      const invId = targetInvestment.id || targetInvestment._id;
      const res = await apiRequest(`/api/super-admin/investments/${invId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({
          investmentAmount: parseFloat(approvedAmountInput) || 0
        })
      });

      addToast(res.message || 'Investment approved successfully!', 'success', 'Request Approved');
      setShowApproveModal(false);
      setTargetInvestment(null);
      setDetailItem(null);
      await loadData();
    } catch (err) {
      console.error('Failed to approve investment:', err);
      addToast(err.message || 'Failed to approve investment', 'danger', 'Error');
    } finally {
      setApproving(false);
    }
  };

  /* ── Fetch Project Status Updates for Modal ─ */
  useEffect(() => {
    if (detailItem?.projectName) {
      setLoadingUpdates(true);
      const searchName = detailItem.projectName;
      apiRequest(`/api/super-admin/projects/updates/history?search=${encodeURIComponent(searchName)}`)
        .then(res => {
          const list = res?.data?.history || res?.history || [];
          setProjectUpdates(list);
        })
        .catch(() => setProjectUpdates([]))
        .finally(() => setLoadingUpdates(false));
    } else {
      setProjectUpdates([]);
    }
  }, [detailItem]);

  /* ── Load All Data (Parallel) ─────────────── */
  const loadData = async () => {
    setLoading(true);
    try {
      const [invRes, clientsRes, projectsRes, segRes, slabRes] = await Promise.all([
        apiRequest('/api/super-admin/investments?limit=500').catch(() => ({})),
        apiRequest('/api/super-admin/clients').catch(() => ({})),
        apiRequest('/api/super-admin/projects?limit=500').catch(() => ({})),
        apiRequest('/api/super-admin/segments').catch(() => ({})),
        apiRequest('/api/super-admin/commission-slabs').catch(() => ({})),
      ]);

      let rawInv = Array.isArray(invRes) ? invRes : (invRes?.data?.investments || invRes?.investments || []);
      let rawClients = Array.isArray(clientsRes) ? clientsRes : (clientsRes?.data?.clients || clientsRes?.clients || []);
      setClientsList(rawClients);

      let rawProjects = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.data?.projects || projectsRes?.projects || []);
      setProjectsList(rawProjects.filter(p => p.name !== '__KFPL_DUMMY__'));

      let rawSeg = Array.isArray(segRes) ? segRes : (segRes?.data?.segments || segRes?.segments || []);
      setDbSegments(rawSeg.map(s => s.name || s).filter(Boolean));

      let rawSlabs = Array.isArray(slabRes) ? slabRes : (slabRes?.data || []);
      if (!Array.isArray(rawSlabs)) {
        for (const k in slabRes) { if (Array.isArray(slabRes[k])) { rawSlabs = slabRes[k]; break; } }
      }
      setCommissionSlabs(Array.isArray(rawSlabs) ? rawSlabs : []);

      const clientMap = {};
      rawClients.forEach(c => {
        const id = String(c._id || c.id);
        const ag = c.assignedAgent;
        clientMap[id] = {
          name: c.name, code: c.clientId || c.clientCode || '—',
          email: c.email || c.user?.email || '—',
          agentName: ag?.name || c.assignedAgentName || 'Direct / No Agent',
          agentCode: ag?.clientCode || ag?.agentCode || '—',
          totalInvestment: c.totalInvestment || 0,
          monthlyRoi: c.monthlyRoi || c.roiPercentage || 0,
        };
      });

      const mapped = rawInv.map((inv) => {
        const cid = String(inv.clientId?._id || inv.clientId || '');
        const ci = clientMap[cid] || {};
        const agentObj = inv.clientId?.assignedAgent || inv.assignedAgent;
        const projObj = typeof inv.projectId === 'object' ? inv.projectId : null;
        const amount = Number(inv.investmentAmount || inv.amount || 0);
        const roiNum = inv.roiPercentage !== undefined ? Number(inv.roiPercentage) : (projObj?.monthlyRoi ? parseFloat(projObj.monthlyRoi) : (ci.monthlyRoi || 1.5));
        const commStr = inv.agentCommission || '1.5%';
        const commNum = parseFloat(commStr) || 1.5;

        return {
          id: inv._id || inv.id,
          clientName: inv.clientName || inv.clientId?.name || ci.name || 'Client',
          clientCode: inv.clientCode || inv.clientId?.clientCode || ci.code || '—',
          clientEmail: inv.clientId?.email || ci.email || '—',
          agentName: agentObj?.name || ci.agentName || 'Direct / No Agent',
          agentCode: agentObj?.clientCode || agentObj?.agentCode || ci.agentCode || '—',
          projectName: projObj?.name || inv.projectName || 'Media Fund',
          segment: projObj?.segment || inv.segment || 'General',
          amount,
          roiRate: `${roiNum}%`,
          monthlyReturn: (amount * roiNum) / 100,
          commRate: `${commNum}%`,
          commPayout: (amount * commNum) / 100,
          status: inv.status || 'active',
          date: (inv.investmentDate || inv.createdAt) ? new Date(inv.investmentDate || inv.createdAt).toLocaleDateString('en-IN') : '—',
          durationMonths: inv.durationMonths || 24,
          remarks: inv.remarks || 'Standard Portfolio Contract',
          projectDetails: projObj ? {
            id: projObj._id || projObj.id,
            name: projObj.name,
            segment: projObj.segment,
            bannerImage: projObj.bannerImage || (Array.isArray(projObj.mediaFiles) && projObj.mediaFiles[0]) || '',
            mediaFiles: Array.isArray(projObj.mediaFiles) ? projObj.mediaFiles : [],
            summary: projObj.summary || '',
            currentUpdate: projObj.currentUpdate || '',
            allocationFocus: projObj.allocationFocus || '',
            minInvestment: projObj.minInvestment || 0,
            targetFunding: projObj.targetFunding || 0,
            fundedAmount: projObj.fundedAmount || 0,
            slotsAvailable: projObj.slotsAvailable || 0,
            totalSlots: projObj.totalSlots || 0,
            milestoneProgress: projObj.milestoneProgress || 0,
            riskLevel: projObj.riskLevel || 'Medium',
            health: projObj.health || 'On Track',
            horizon: projObj.horizon || '12 Months',
          } : null,
        };
      });

      setInvestments(mapped);
    } catch (err) {
      addToast('Failed to load investment data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  /* ── Delete Investment Record ───────────── */
  const handleDeleteInvestment = async (id, projectName) => {
    if (!window.confirm(`Are you sure you want to delete investment record for "${projectName}"?`)) return;
    try {
      await apiRequest(`/api/super-admin/investments/${id}`, { method: 'DELETE' });
      addToast('Investment record deleted successfully', 'success');
      if (detailItem && detailItem.id === id) setDetailItem(null);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to delete investment record', 'error');
    }
  };

  /* ── Client Select → Auto-fill deposit data ─ */
  const handleClientSelect = async (clientId) => {
    setAssignForm(prev => ({ ...prev, clientId, investmentAmount: '', roiPercentage: '', agentCommission: '' }));
    setSelectedClientInfo(null);
    if (!clientId) return;

    const client = clientsList.find(c => String(c._id || c.id) === clientId);
    if (!client) return;

    const ag = client.assignedAgent;
    const info = {
      name: client.name,
      code: client.clientId || client.clientCode || '—',
      email: client.email || client.user?.email || '—',
      agentName: ag?.name || client.assignedAgentName || 'Direct / No Agent',
      agentCode: ag?.clientCode || ag?.agentCode || '—',
      totalInvestment: client.totalInvestment || 0,
      monthlyRoi: client.monthlyRoi || client.roiPercentage || 0,
    };
    setSelectedClientInfo(info);

    if (info.totalInvestment > 0) {
      const autoComm = computeSlabCommission(info.totalInvestment, commissionSlabs);
      setAssignForm(prev => ({
        ...prev,
        investmentAmount: String(info.totalInvestment),
        roiPercentage: String(info.monthlyRoi || '1.5'),
        agentCommission: `${autoComm}%`,
      }));
    }
  };

  /* ── Project Select → Auto-fill ROI ────────── */
  const handleProjectSelect = (projectId) => {
    setSelectedProjectInfo(null);
    const proj = projectsList.find(p => String(p._id || p.id) === projectId);
    if (proj) {
      setSelectedProjectInfo(proj);
      const roiVal = proj.monthlyRoi ? String(proj.monthlyRoi).replace('%', '').trim() : '';
      setAssignForm(prev => ({ ...prev, projectId, roiPercentage: roiVal || prev.roiPercentage }));
    } else {
      setAssignForm(prev => ({ ...prev, projectId }));
    }
  };

  /* ── Amount Change → Auto-slab commission ──── */
  const handleAmountChange = (val) => {
    const autoComm = computeSlabCommission(val, commissionSlabs);
    setAssignForm(prev => ({ ...prev, investmentAmount: val, agentCommission: `${autoComm}%` }));
  };

  /* ── Submit ────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignForm.clientId || !assignForm.investmentAmount) {
      addToast('Select a client and enter investment amount', 'error'); return;
    }
    setSubmitting(true);
    try {
      const proj = projectsList.find(p => String(p._id || p.id) === assignForm.projectId);
      await apiRequest('/api/super-admin/investments', {
        method: 'POST',
        body: JSON.stringify({
          clientId: assignForm.clientId,
          projectId: assignForm.projectId || undefined,
          segment: proj?.segment || dbSegments[0] || 'Film Making',
          investmentAmount: Number(assignForm.investmentAmount),
          roiPercentage: Number(assignForm.roiPercentage || 1.5),
          agentCommission: assignForm.agentCommission || '1.5%',
          durationMonths: Number(assignForm.durationMonths || 24),
        }),
      });
      addToast('Investment assigned successfully', 'success');
      setShowAssignModal(false);
      setAssignForm({ clientId: '', projectId: '', investmentAmount: '', roiPercentage: '', agentCommission: '', durationMonths: '24' });
      setSelectedClientInfo(null);
      setSelectedProjectInfo(null);
      loadData();
    } catch (err) {
      addToast(err.message || 'Failed to assign investment', 'error');
    } finally { setSubmitting(false); }
  };

  /* ── Computed Filters ─────────────────────── */
  const segmentFilters = useMemo(() => {
    const s = new Set(['All', ...dbSegments, ...investments.map(i => i.segment)]);
    return Array.from(s).filter(Boolean);
  }, [dbSegments, investments]);

  const filtered = useMemo(() => {
    return investments.filter(inv => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || [inv.clientName, inv.clientCode, inv.agentName, inv.projectName, inv.segment]
        .some(f => (f || '').toLowerCase().includes(q));
      const matchSeg = selectedSegment === 'All' || inv.segment === selectedSegment;
      return matchSearch && matchSeg;
    });
  }, [investments, searchTerm, selectedSegment]);

  const grouped = useMemo(() => {
    const m = {};
    filtered.forEach(inv => {
      const key = inv.clientCode !== '—' ? inv.clientCode : inv.clientName;
      if (!m[key]) m[key] = { clientName: inv.clientName, clientCode: inv.clientCode, agentName: inv.agentName, agentCode: inv.agentCode, total: 0, totalComm: 0, totalRoi: 0, projects: [] };
      m[key].total += inv.amount;
      m[key].totalComm += inv.commPayout;
      m[key].totalRoi += inv.monthlyReturn;
      m[key].projects.push(inv);
    });
    return Object.values(m);
  }, [filtered]);

  const totalVol = useMemo(() => filtered.reduce((s, i) => s + i.amount, 0), [filtered]);
  const totalComm = useMemo(() => filtered.reduce((s, i) => s + i.commPayout, 0), [filtered]);
  const totalRoi = useMemo(() => filtered.reduce((s, i) => s + i.monthlyReturn, 0), [filtered]);
  const uniqueClients = useMemo(() => new Set(filtered.map(i => i.clientCode !== '—' ? i.clientCode : i.clientName)).size, [filtered]);

  /* Computed preview in assign modal */
  const previewAmount = Number(assignForm.investmentAmount) || 0;
  const previewRoi = Number(assignForm.roiPercentage) || 0;
  const previewCommPct = parseFloat(assignForm.agentCommission) || 0;
  const previewMonthlyReturn = (previewAmount * previewRoi) / 100;
  const previewCommAmt = (previewAmount * previewCommPct) / 100;

  return (
    <div className="kfpl-page-container" style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* ═══ PAGE HEADER ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            Investment Status
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0', fontSize: '0.875rem' }}>
            Live tracking of client investments, assigned agents, ROI yields, and commissions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="kfpl-btn kfpl-btn--secondary" onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh Data
          </button>
          <button
            type="button"
            className="kfpl-btn kfpl-btn--primary"
            onClick={() => {
              setShowAssignModal(true);
              setSelectedClientInfo(null);
              setSelectedProjectInfo(null);
              setAssignForm({ clientId: '', projectId: '', investmentAmount: '', roiPercentage: '', agentCommission: '', durationMonths: '24' });
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Assign Investment
          </button>
        </div>
      </div>

      {/* ═══ 4 KPI CARDS (2x2 GRID FOR EXTRA WIDE VIEW) ═══ */}
      <div className="kfpl-dashboard-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
        <KpiCard
          title="Total Investment Volume"
          value={formatCurrency(totalVol)}
          trend="Total Investment Contracts"
          trendDirection="up"
          icon={kpiIcons.investment}
          iconColor="gold"
          variant="gold"
        />
        <KpiCard
          title="Active Investors"
          value={`${uniqueClients}`}
          trend="Active Portfolio Investors"
          trendDirection="up"
          icon={kpiIcons.investors}
          iconColor="navy"
        />
        <KpiCard
          title="Agent Commission Volume"
          value={formatCurrency(totalComm)}
          trend="Total Commission Allocated"
          trendDirection="up"
          icon={kpiIcons.commission}
          iconColor="amber"
        />
        <KpiCard
          title="Monthly ROI Payout"
          value={`${formatCurrency(totalRoi)} /mo`}
          trend="Distributed Monthly Yield"
          trendDirection="up"
          icon={kpiIcons.roi}
          iconColor="purple"
        />
      </div>

      {/* ═══ SEARCH TOOLBAR ═══ */}
      <div className="kfpl-table-container" style={{ marginBottom: '16px' }}>
        <div className="kfpl-table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search client, agent, project, segment..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="kfpl-input"
              style={{ paddingLeft: '36px', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '3px', borderRadius: 'var(--radius-md)', gap: '3px' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'table' ? 'var(--color-white)' : 'transparent',
                color: viewMode === 'table' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'table' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              All Investments Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              style={{
                padding: '6px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'grouped' ? 'var(--color-white)' : 'transparent',
                color: viewMode === 'grouped' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'grouped' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              Grouped by Client (Multi-Project)
            </button>
          </div>
        </div>
      </div>

      {/* ═══ DEDICATED SEGMENT FILTER BAR ═══ */}
      <div className="kfpl-table-container" style={{ padding: '14px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <span className="text-xs text-muted font-bold" style={{ textTransform: 'uppercase', letterSpacing: '0.6px', flexShrink: 0 }}>
          Filter by Segment:
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {segmentFilters.map(seg => {
            const ss = getSegmentStyle(seg);
            const active = selectedSegment === seg;
            return (
              <button
                key={seg}
                type="button"
                onClick={() => setSelectedSegment(seg)}
                style={{
                  padding: '5px 16px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  border: active ? `1.5px solid ${ss.color}` : '1px solid var(--color-border)',
                  background: active ? ss.bg : 'var(--color-white)',
                  color: active ? ss.color : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                {seg}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ DATA VIEWS ═══ */}
      {loading ? (
        <div className="kfpl-table-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 1s linear infinite' }} />
          <span className="text-muted font-medium">Loading live investment records...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="kfpl-table-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--color-border)" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 12px' }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>No Investment Records Found</h3>
          <p className="text-muted text-sm" style={{ margin: '6px 0 16px' }}>No active investment contracts found in database.</p>
          <button type="button" className="kfpl-btn kfpl-btn--primary" onClick={() => setShowAssignModal(true)}>+ Assign Investment</button>
        </div>
      ) : viewMode === 'table' ? (
        /* ═══ 1. ALL INVESTMENTS TABLE VIEW (PORTAL STANDARD DATA TABLE) ═══ */
        <div className="kfpl-table-container">
          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Agent</th>
                  <th>Project & Segment</th>
                  <th style={{ textAlign: 'right' }}>Invested Amount</th>
                  <th style={{ textAlign: 'right' }}>ROI Rate & Monthly Return</th>
                  <th style={{ textAlign: 'right' }}>Agent Commission</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const ss = getSegmentStyle(inv.segment);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <div className="kfpl-table-cell-primary">{inv.clientName}</div>
                        {inv.clientCode !== '—' && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-info)', background: 'var(--color-info-bg)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', display: 'inline-block', marginTop: '2px' }}>
                            {inv.clientCode}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="kfpl-table-cell-primary">{inv.agentName}</div>
                        <span className="kfpl-table-cell-secondary">{inv.agentCode}</span>
                      </td>
                      <td>
                        <div className="kfpl-table-cell-primary">{inv.projectName}</div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: ss.color, background: ss.bg, padding: '2px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block', marginTop: '2px' }}>
                          {inv.segment}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                        {formatCurrency(inv.amount)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>{inv.roiRate} /mo</div>
                        <div className="kfpl-table-cell-secondary">{formatCurrency(inv.monthlyReturn)} /mo</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{formatCurrency(inv.commPayout)}</div>
                        <div className="kfpl-table-cell-secondary">({inv.commRate})</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Badge variant={inv.status === 'active' ? 'success' : 'info'}>{inv.status.toUpperCase()}</Badge>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button type="button" className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm" onClick={() => setDetailItem(inv)}>
                            View Details
                          </button>
                          <button type="button" className="kfpl-btn kfpl-btn--danger kfpl-btn--sm" onClick={() => handleDeleteInvestment(inv.id, inv.projectName)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ═══ 2. GROUPED BY CLIENT (MULTI-PROJECT CARDS WITH BANNER IMAGE) ═══ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {grouped.map(g => (
            <div key={g.clientCode || g.clientName} className="kfpl-table-container" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '16px', marginBottom: '18px', borderBottom: '1px solid var(--color-border-light)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{g.clientName}</h2>
                    {g.clientCode !== '—' && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-info)', background: 'var(--color-info-bg)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                        {g.clientCode}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                      {g.projects.length} Project Investment{g.projects.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-sm text-muted" style={{ marginTop: '4px' }}>
                    Assigned Agent: <strong style={{ color: 'var(--color-text-primary)' }}>{g.agentName}</strong> ({g.agentCode})
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Total Portfolio Capital</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(g.total)}</div>
                </div>
              </div>

              {/* Rich Project Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {g.projects.map(p => {
                  const bannerUrl = p.projectDetails?.bannerImage;
                  const bgStyle = bannerUrl ? `url(${bannerUrl})` : getSegmentGradient(p.segment);

                  return (
                    <div
                      key={p.id}
                      style={{
                        background: 'var(--color-white)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'var(--transition-smooth)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Banner Image / Cover Header */}
                      <div
                        style={{
                          height: '140px',
                          backgroundImage: bgStyle,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'flex-end',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(6,29,19,0.8) 100%)' }} />
                        <div style={{ position: 'relative', zIndex: 2, color: '#fff', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <div>
                            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#E5ECE8', display: 'inline-block', marginBottom: '2px' }}>
                              {p.segment}
                            </span>
                            <h3 style={{ color: '#ffffff', fontSize: '1.05rem', fontWeight: 700, margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                              {p.projectName}
                            </h3>
                          </div>
                          <Badge variant={p.status === 'active' ? 'success' : 'info'}>{p.status.toUpperCase()}</Badge>
                        </div>
                      </div>

                      {/* Card Content & Stats */}
                      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--color-surface)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}>
                          <div>
                            <span className="text-xs text-muted" style={{ display: 'block' }}>Invested Amount</span>
                            <strong style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>{formatCurrency(p.amount)}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-muted" style={{ display: 'block' }}>Monthly ROI Yield</span>
                            <strong style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '0.9rem' }}>{p.roiRate}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-muted" style={{ display: 'block' }}>Agent Commission</span>
                            <strong style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{formatCurrency(p.commPayout)}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-muted" style={{ display: 'block' }}>Contract Date</span>
                            <strong style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{p.date}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                          <button
                            type="button"
                            className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm"
                            onClick={() => setDetailItem(p)}
                            style={{ flex: 1 }}
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                            onClick={() => handleDeleteInvestment(p.id, p.projectName)}
                            style={{ padding: '6px 12px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ RICH COMPREHENSIVE DETAIL MODAL (PROJECT SPECS, MEDIA, UPDATES, FINANCIALS) ═══ */}
      {detailItem && (
        <Modal isOpen onClose={() => setDetailItem(null)} title={`Investment Details — ${detailItem.projectName}`} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
            {/* Banner Preview Header */}
            {detailItem.projectDetails && (
              <div
                style={{
                  height: '180px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundImage: detailItem.projectDetails.bannerImage ? `url(${detailItem.projectDetails.bannerImage})` : getSegmentGradient(detailItem.segment),
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '20px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(6,29,19,0.85) 100%)' }} />
                <div style={{ position: 'relative', zIndex: 2, color: '#ffffff', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <span style={{ color: '#E5ECE8', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Segment: {detailItem.segment}
                    </span>
                    <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
                      {detailItem.projectName}
                    </h2>
                  </div>
                  <Badge variant={detailItem.status === 'active' ? 'success' : 'info'}>{detailItem.status.toUpperCase()}</Badge>
                </div>
              </div>
            )}

            {/* 1. Project Specifications Block */}
            {detailItem.projectDetails ? (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 22px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                  Project Catalog Specifications
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.875rem' }}>
                  <div>
                    <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Target Funding</span>
                    <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(detailItem.projectDetails.targetFunding)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Min. Investment Required</span>
                    <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(detailItem.projectDetails.minInvestment)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Funded Amount</span>
                    <strong style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(detailItem.projectDetails.fundedAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Available Slots</span>
                    <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{detailItem.projectDetails.slotsAvailable} / {detailItem.projectDetails.totalSlots} Slots</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Risk Level & Health</span>
                    <strong style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '0.95rem' }}>{detailItem.projectDetails.riskLevel} ({detailItem.projectDetails.health})</strong>
                  </div>
                  <div>
                    <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Project Horizon</span>
                    <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>{detailItem.projectDetails.horizon}</strong>
                  </div>
                </div>

                {detailItem.projectDetails.summary && (
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)', fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    <strong>Summary: </strong>{detailItem.projectDetails.summary}
                  </div>
                )}
              </div>
            ) : null}

            {/* 2. Project Media & Uploaded Files */}
            {detailItem.projectDetails?.mediaFiles && detailItem.projectDetails.mediaFiles.length > 0 && (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 22px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                  Project Media & Attachments ({detailItem.projectDetails.mediaFiles.length})
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {detailItem.projectDetails.mediaFiles.map((fileUrl, idx) => (
                    <a
                      key={idx}
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: 'var(--color-white)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-primary)',
                        fontWeight: 600,
                        textDecoration: 'none',
                        transition: 'var(--transition-fast)',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                        <polyline points="13 2 13 9 20 9" />
                      </svg>
                      Attached Media #{idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Live Project Updates & Milestones History */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 22px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Project Status Updates & Milestones</span>
                <span className="text-xs text-muted">{projectUpdates.length} update{projectUpdates.length !== 1 ? 's' : ''}</span>
              </div>
              {loadingUpdates ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px' }}>Loading project updates...</div>
              ) : projectUpdates.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', background: 'var(--color-white)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)' }}>
                  No extra status updates or milestones logged for this project yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {projectUpdates.map((up, i) => (
                    <div key={up._id || i} style={{ background: 'var(--color-white)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{up.status || 'Status Update'}</div>
                        <span className="text-xs text-muted">{up.createdAt ? new Date(up.createdAt).toLocaleDateString('en-IN') : 'Recently'}</span>
                      </div>
                      {up.notes && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{up.notes}</p>}
                      {up.progress > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'var(--color-border-light)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${up.progress}%`, height: '100%', background: 'var(--color-success)', borderRadius: '3px' }} />
                          </div>
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>{up.progress}% Progress</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Client Contract Financials Block */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 22px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
                Client Contract Financials
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.875rem' }}>
                <div>
                  <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Client Name & Code</span>
                  <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{detailItem.clientName}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-info)', fontWeight: 600 }}>{detailItem.clientCode}</div>
                </div>
                <div>
                  <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Assigned Agent</span>
                  <strong style={{ color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{detailItem.agentName}</strong>
                  <div className="text-xs text-muted">{detailItem.agentCode}</div>
                </div>
                <div>
                  <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Capital Investment</span>
                  <strong style={{ color: 'var(--color-success)', fontSize: '1.15rem', fontWeight: 700 }}>{formatCurrency(detailItem.amount)}</strong>
                </div>
                <div>
                  <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Monthly ROI Return</span>
                  <strong style={{ color: 'var(--color-success)', fontWeight: 700, fontSize: '0.95rem' }}>{detailItem.roiRate} ({formatCurrency(detailItem.monthlyReturn)} / mo)</strong>
                </div>
                <div>
                  <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Agent Commission</span>
                  <strong style={{ color: 'var(--color-warning)', fontWeight: 700, fontSize: '0.95rem' }}>{formatCurrency(detailItem.commPayout)} ({detailItem.commRate})</strong>
                </div>
                <div>
                  <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '2px' }}>Date & Duration</span>
                  <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>{detailItem.date} ({detailItem.durationMonths} Months)</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {detailItem.status === 'pending' ? (
                  <button
                    type="button"
                    className="kfpl-btn"
                    style={{ background: '#10B981', color: '#ffffff', fontWeight: 700, padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => openApproveModal(detailItem)}
                  >
                    ✓ Approve Investment & Notify Client
                  </button>
                ) : (
                  <span style={{ background: '#ECFDF5', color: '#065F46', border: '1.5px solid #10B981', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Investment Approved & Active
                  </span>
                )}
                <button
                  type="button"
                  className="kfpl-btn kfpl-btn--danger"
                  onClick={() => handleDeleteInvestment(detailItem.id, detailItem.projectName)}
                >
                  Delete Record
                </button>
              </div>
              <button type="button" className="kfpl-btn kfpl-btn--secondary" onClick={() => setDetailItem(null)} style={{ padding: '9px 24px', fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ APPROVE INVESTMENT MODAL ═══ */}
      {showApproveModal && targetInvestment && (
        <Modal isOpen onClose={() => setShowApproveModal(false)} title={`Approve Investment — ${targetInvestment.projectName || 'Project'}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px' }}>
            <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderLeft: '4px solid #10B981', padding: '14px 16px', borderRadius: '8px' }}>
              <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.95rem', marginBottom: '4px' }}>
                Confirm Investment Approval & Client Notification
              </div>
              <p style={{ fontSize: '0.85rem', color: '#15803D', margin: 0, lineHeight: 1.5 }}>
                Approving this selection will activate the investment contract for <strong>{targetInvestment.clientName}</strong> ({targetInvestment.clientCode}), send an official confirmation email to <strong>{targetInvestment.clientEmail || 'registered email'}</strong>, and trigger an alert on their Client Dashboard bell icon.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '6px' }}>
                Approved Capital Amount (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className="kfpl-input"
                style={{ width: '100%', fontSize: '1.1rem', fontWeight: 700, padding: '10px 14px' }}
                value={approvedAmountInput}
                onChange={(e) => setApprovedAmountInput(e.target.value)}
                placeholder="Enter approved amount"
              />
              <span className="text-xs text-muted" style={{ marginTop: '6px', display: 'block' }}>
                Client requested project selection for <strong>{targetInvestment.projectName}</strong>. Minimum investment required is ₹{targetInvestment.projectDetails?.minInvestment || 5}.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="kfpl-btn kfpl-btn--secondary"
                onClick={() => setShowApproveModal(false)}
                disabled={approving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="kfpl-btn"
                style={{ background: '#10B981', color: '#ffffff', fontWeight: 700, padding: '10px 22px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                onClick={handleConfirmApproval}
                disabled={approving}
              >
                {approving ? 'Approving & Sending Email...' : '✓ Confirm Approval & Notify Client'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ ASSIGN INVESTMENT MODAL ═══ */}
      {showAssignModal && (
        <Modal isOpen onClose={() => setShowAssignModal(false)} title="Assign Investment to Client">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '4px' }}>
                Select Client <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <select
                className="kfpl-select"
                value={assignForm.clientId}
                onChange={e => handleClientSelect(e.target.value)}
                required
                style={{ width: '100%', padding: '9px' }}
              >
                <option value="">-- Choose Client --</option>
                {clientsList.map(c => (
                  <option key={c._id || c.id} value={c._id || c.id}>
                    {c.name} ({c.clientId || c.clientCode || '—'})
                  </option>
                ))}
              </select>
            </div>

            {selectedClientInfo && (
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  Client Data Auto-Fetched
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8125rem' }}>
                  <div><span className="text-xs text-muted" style={{ display: 'block' }}>Name</span><strong>{selectedClientInfo.name}</strong></div>
                  <div><span className="text-xs text-muted" style={{ display: 'block' }}>Code</span><strong>{selectedClientInfo.code}</strong></div>
                  <div><span className="text-xs text-muted" style={{ display: 'block' }}>Assigned Agent</span><strong>{selectedClientInfo.agentName}</strong></div>
                  <div><span className="text-xs text-muted" style={{ display: 'block' }}>Existing Capital</span><strong style={{ color: 'var(--color-success)' }}>{formatCurrency(selectedClientInfo.totalInvestment)}</strong></div>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '4px' }}>Select Target Project</label>
              <select
                className="kfpl-select"
                value={assignForm.projectId}
                onChange={e => handleProjectSelect(e.target.value)}
                style={{ width: '100%', padding: '9px' }}
              >
                <option value="">-- Choose Target Project --</option>
                {projectsList.map(p => (
                  <option key={p._id || p.id} value={p._id || p.id}>
                    {p.name} [{p.segment}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '4px' }}>
                Investment Amount (₹) <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 500000"
                value={assignForm.investmentAmount}
                onChange={e => handleAmountChange(e.target.value)}
                required
                className="kfpl-input"
                style={{ width: '100%', padding: '9px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '4px' }}>Monthly ROI (%)</label>
                <input
                  type="text"
                  placeholder="Auto from project"
                  value={assignForm.roiPercentage}
                  onChange={e => setAssignForm(p => ({ ...p, roiPercentage: e.target.value }))}
                  className="kfpl-input"
                  style={{ width: '100%', padding: '9px' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted" style={{ display: 'block', marginBottom: '4px' }}>Agent Commission (%)</label>
                <input
                  type="text"
                  placeholder="Auto from slab"
                  value={assignForm.agentCommission}
                  readOnly
                  className="kfpl-input"
                  style={{ width: '100%', padding: '9px', background: 'var(--color-surface)', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            {previewAmount > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '12px', background: 'var(--color-gold-glow)', border: '1px dashed var(--color-gold)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Monthly Return</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success)' }}>{formatCurrency(previewMonthlyReturn)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Agent Payout</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-warning)' }}>{formatCurrency(previewCommAmt)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Slab Rate</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-info)' }}>{assignForm.agentCommission || '—'}</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--color-border-light)' }}>
              <button type="button" className="kfpl-btn kfpl-btn--secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button type="submit" className="kfpl-btn kfpl-btn--primary" disabled={submitting}>
                {submitting ? 'Assigning...' : 'Assign Investment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
