/* ============================================================
   Page: Dashboard.jsx
   Description: Premium KPI dashboard — Platform Command Centre
   PRD Section 3: 6 KPIs, 4 charts, candlestick, quick actions,
   activity feed, top investors, agent performance
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KpiCard from '../../components/ui/KpiCard';
import DonutChart from '../../components/charts/DonutChart';
import LineChart from '../../components/charts/LineChart';
import BarChart from '../../components/charts/BarChart';
import PieChart from '../../components/charts/PieChart';
import AreaChart from '../../components/charts/AreaChart';
import Badge from '../../components/ui/Badge';
import { apiRequest } from '../../config/apiHelper';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { getAuthUser } from '../../utils/authStorage';

const formatClientID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  const str = String(rawId).trim();
  if (str.toUpperCase().startsWith('KFPL-CL-')) return str.toUpperCase();
  const digitsMatch = str.match(/\d+/);
  if (digitsMatch) {
    let val = parseInt(digitsMatch[0], 10);
    if (val < 1000) val = 1000 + val;
    return `KFPL-CL-${val}`;
  }
  return 'KFPL-CL-1001';
};

// ── KPI Icons (SVG) ───────────────────────
const kpiIcons = {
  investors: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  investment: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  roi: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  agents: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  pending: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  active: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
};

// ── Quick Actions will be defined inside the component reactively ──

// ── Activity Icons ───────────────────────
const activityIcons = {
  success: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  gold: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  warning: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  danger: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
};

const SEGMENT_COLORS = ['#10B981', '#1565C0', '#2E7D32', '#E65100', '#7B1FA2', '#00838F'];

export default function Dashboard() {
  const navigate = useNavigate();


  const [stats, setStats] = useState({
    totalInvestors: 0,
    investorChange: 0,
    totalInvestment: 0,
    investmentChange: 0,
    totalROIPaid: 0,
    roiChange: 0,
    totalAgents: 0,
    agentChange: 0,
    pendingApprovals: 0,
    activeInvestments: 0,
  });

  const quickActionItems = [
    { label: 'Add Client', subtitle: 'Onboard new client', route: '/clients/add', color: '#0E7490', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> },
    { label: 'Approvals', subtitle: `${stats.pendingApprovals} pending`, route: '/approvals', color: '#C62828', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { label: 'Add Agent', subtitle: 'Register agent', route: '/agents/add', color: '#1565C0', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
    { label: 'Assign Investment', subtitle: 'Map to client', route: '/investments/assign', color: '#10B981', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
    { label: 'Mark ROI Paid', subtitle: 'Process returns', route: '/roi', color: '#2E7D32', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    { label: 'Post Update', subtitle: 'Status updates', route: '/investment-status', color: '#7B1FA2', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  ];

  const [roiTrend, setRoiTrend] = useState([]);
  const [segments, setSegments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [investorsRanked, setInvestorsRanked] = useState([]);
  const [agentsRanked, setAgentsRanked] = useState([]);
  const [agentContribution, setAgentContribution] = useState([]);
  const [investmentStatus, setInvestmentStatus] = useState([]);
  const [investmentFlow, setInvestmentFlow] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // --- SWR Cache Initialization for Instant Load (0ms) ---
    try {
      const cacheData = localStorage.getItem('kfpl_super_admin_dashboard_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        if (parsed && typeof parsed === 'object') {
          if (parsed.stats && typeof parsed.stats === 'object') setStats(parsed.stats);
          if (Array.isArray(parsed.investorsRanked)) setInvestorsRanked(parsed.investorsRanked);
          if (Array.isArray(parsed.segments)) setSegments(parsed.segments);
          if (Array.isArray(parsed.investmentStatus)) setInvestmentStatus(parsed.investmentStatus);
          if (Array.isArray(parsed.investmentFlow)) setInvestmentFlow(parsed.investmentFlow);
          if (Array.isArray(parsed.agentContribution)) setAgentContribution(parsed.agentContribution);
          if (Array.isArray(parsed.agentsRanked)) setAgentsRanked(parsed.agentsRanked);
          if (Array.isArray(parsed.roiTrend)) setRoiTrend(parsed.roiTrend);
          if (Array.isArray(parsed.activities)) setActivities(parsed.activities);
        }
      }
    } catch (e) {
      console.warn('Failed to parse super admin dashboard cache:', e);
      localStorage.removeItem('kfpl_super_admin_dashboard_cache');
    }

    const fetchDashboard = async () => {
      try {
        const [res, clientsRes, investmentsRes, payoutsRes, agentsRes] = await Promise.all([
          apiRequest('/api/super-admin/dashboard').catch(() => null),
          apiRequest('/api/super-admin/clients').catch(() => null),
          apiRequest('/api/super-admin/investments').catch(() => null),
          apiRequest('/api/super-admin/roi/payouts?status=All&recipientType=All').catch(() => null),
          apiRequest('/api/super-admin/agents').catch(() => null)
        ]);

        const data = res?.data || res || {};
        const MOCK_NAMES = ['John Doe', 'Sunil Verma', 'Kavita Reddy', 'Amit Joshi', 'Meera Iyer', 'Suresh Patel'];

        // 1. Process Top Investors dynamically from clients list
        let computedInvestors = [];
        if (clientsRes) {
          const list = clientsRes.data?.clients || clientsRes.data || clientsRes.clients || [];
          if (Array.isArray(list) && list.length > 0) {
            const rawClients = list.filter(c => {
              if (!c || typeof c !== 'object') return false;
              const profile = c.profile || {};
              const user = c.userId || c.user || {};
              const name = profile.fullName || user.name || c.fullName || c.name || '';
              return name.trim() !== '';
            });

            if (rawClients.length > 0) {
              const sortedClients = [...rawClients].sort((a, b) => {
                const aInv = a.totalInvestment || a.profile?.totalInvestment || a.summaryCards?.totalInvestment || a.profile?.totalPortfolioValue || 0;
                const bInv = b.totalInvestment || b.profile?.totalInvestment || b.summaryCards?.totalInvestment || b.profile?.totalPortfolioValue || 0;
                return bInv - aInv;
              });

              computedInvestors = sortedClients.slice(0, 5).map((c, i) => {
                const profile = c.profile || {};
                const user = c.userId || c.user || {};
                const amount = c.totalInvestment || c.profile?.totalInvestment || c.summaryCards?.totalInvestment || c.profile?.totalPortfolioValue || 0;
                return {
                  id: c._id || c.id || i,
                  name: profile.fullName || user.name || c.fullName || c.name || 'Investor',
                  clientId: formatClientID(user.clientCode || c.clientCode || c.clientId || profile.clientId || i + 1),
                  category: (c.tier || c.profile?.tier || c.category || c.profile?.category || 'silver').toLowerCase(),
                  amount
                };
              });
            }
          }
        }

        if (computedInvestors.length === 0 && data.topInvestors && Array.isArray(data.topInvestors)) {
          computedInvestors = data.topInvestors.map((inv, i) => ({
            id: inv._id || inv.id || i,
            name: inv.name || inv.clientName || 'Investor',
            clientId: formatClientID(inv.code || inv.clientCode || i + 1),
            category: (inv.category || inv.tier || 'silver').toLowerCase(),
            amount: inv.totalActiveAmt || inv.amount || 0
          }));
        }
        setInvestorsRanked(computedInvestors);

        // 2. Process Investments List
        let realActiveInvestmentsCount = 0;
        let realTotalInvestmentAmt = 0;
        let computedSegments = [];
        let computedInvestmentStatus = [];
        let computedInflow = [];
        let computedContribution = [];
        let computedAgentsRanked = [];

        if (investmentsRes) {
          const list = Array.isArray(investmentsRes)
            ? investmentsRes
            : (investmentsRes.investments || investmentsRes.data?.investments || (investmentsRes.data && Array.isArray(investmentsRes.data) ? investmentsRes.data : []));

          if (Array.isArray(list) && list.length > 0) {
            const cleanInvests = list.filter(inv => {
              const clientName = inv.clientName || 
                                 inv.investorName || 
                                 (inv.clientId && typeof inv.clientId === 'object' ? (inv.clientId.profile?.fullName || inv.clientId.userId?.name) : '') || 
                                 '';
              return !clientName || !MOCK_NAMES.includes(clientName.trim());
            });

            realActiveInvestmentsCount = cleanInvests.length;
            realTotalInvestmentAmt = cleanInvests.reduce((sum, inv) => sum + (inv.investmentAmount || inv.amount || 0), 0);

            // Calculate Segment Distribution
            const segmentSums = {};
            let grandTotal = 0;
            cleanInvests.forEach(inv => {
              const amount = inv.investmentAmount || inv.amount || 0;
              if (Array.isArray(inv.segmentAllocation) && inv.segmentAllocation.length > 0) {
                inv.segmentAllocation.forEach(alloc => {
                  const segName = alloc.segmentName || 'Unknown';
                  const pct = alloc.allocationPercentage || 100;
                  const partAmount = (amount * pct) / 100;
                  segmentSums[segName] = (segmentSums[segName] || 0) + partAmount;
                  grandTotal += partAmount;
                });
              } else if (inv.segment) {
                const segName = inv.segment;
                segmentSums[segName] = (segmentSums[segName] || 0) + amount;
                grandTotal += amount;
              }
            });

            computedSegments = Object.keys(segmentSums).map(segName => ({
              segment: segName,
              value: grandTotal > 0 ? Math.round((segmentSums[segName] / grandTotal) * 100) : 0,
              amount: segmentSums[segName]
            }));

            // Investment Status Split
            const statusCounts = { Active: 0, Pending: 0, Closed: 0 };
            cleanInvests.forEach(inv => {
              const rawStatus = (inv.status || 'Active').toLowerCase();
              if (rawStatus === 'active') statusCounts.Active++;
              else if (rawStatus === 'pending') statusCounts.Pending++;
              else if (rawStatus === 'closed') statusCounts.Closed++;
              else statusCounts.Active++;
            });
            const totalStatus = statusCounts.Active + statusCounts.Pending + statusCounts.Closed;
            if (totalStatus > 0) {
              computedInvestmentStatus = [
                { status: 'Active', count: statusCounts.Active, percentage: Math.round((statusCounts.Active / totalStatus) * 100), color: '#10B981' },
                { status: 'Pending', count: statusCounts.Pending, percentage: Math.round((statusCounts.Pending / totalStatus) * 100), color: '#F59E0B' },
                { status: 'Closed', count: statusCounts.Closed, percentage: Math.round((statusCounts.Closed / totalStatus) * 100), color: '#EF4444' }
              ];
            }

            // Monthly Inflow
            const monthlyInflow = {};
            const monthlyOutflow = {};
            cleanInvests.forEach(inv => {
              const date = new Date(inv.investmentDate || inv.date || inv.createdAt);
              const amount = inv.investmentAmount || inv.amount || 0;
              if (!isNaN(date.getTime())) {
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                monthlyInflow[monthName] = (monthlyInflow[monthName] || 0) + amount;
                if ((inv.status || '').toLowerCase() === 'closed') {
                  monthlyOutflow[monthName] = (monthlyOutflow[monthName] || 0) + amount;
                }
              }
            });
            const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            computedInflow = monthOrder.map(m => ({
              month: m,
              investments: monthlyInflow[m] || 0,
              withdrawals: monthlyOutflow[m] || 0
            }));

            // Agent Contribution & Performance Calculation
            const rawAgents = Array.isArray(agentsRes)
              ? agentsRes
              : (agentsRes?.agents || agentsRes?.data?.agents || (agentsRes?.data && Array.isArray(agentsRes.data) ? agentsRes.data : []));

            const rawClientsList = Array.isArray(clientsRes)
              ? clientsRes
              : (clientsRes?.clients || clientsRes?.data?.clients || (clientsRes?.data && Array.isArray(clientsRes.data) ? clientsRes.data : []));

            const agentPerfMap = {};

            // Helper to get or create agent entry in map
            const getOrCreateAgentEntry = (agId, agName, agCode) => {
              if (!agentPerfMap[agId]) {
                agentPerfMap[agId] = {
                  id: agId,
                  name: agName,
                  agentId: agCode || 'AGT-001',
                  clientsSet: new Set(),
                  amount: 0
                };
              }
              return agentPerfMap[agId];
            };

            // Pre-seed registered agents
            if (Array.isArray(rawAgents)) {
              rawAgents.forEach(ag => {
                const agId = String(ag._id || ag.id);
                const entry = getOrCreateAgentEntry(agId, ag.name || ag.fullName || 'Agent', ag.agentId || ag.clientCode || ag.agentCode || 'AGT-001');
                if (ag.clientsCount !== undefined) {
                  entry.baseClientsCount = ag.clientsCount;
                }
                if (ag.totalInvestment !== undefined) {
                  entry.baseTotalInvestment = ag.totalInvestment;
                }
              });
            }

            // Always ensure Direct / Admin exists
            getOrCreateAgentEntry('direct', 'Direct / Admin', 'AGT-001');

            // Map each client to their assigned agent
            const clientToAgentMap = {};
            if (Array.isArray(rawClientsList)) {
              rawClientsList.forEach(cl => {
                const possibleClientIds = [
                  String(cl._id || ''),
                  String(cl.id || ''),
                  String(cl.userId?._id || cl.userId || ''),
                  String(cl.user?._id || cl.user || ''),
                  String(cl.profile?.userId || ''),
                  String(cl.clientCode || ''),
                  String(cl.user?.clientCode || '')
                ].filter(Boolean);

                const assignedAg = cl.assignedAgent || cl.user?.assignedAgent || cl.profile?.assignedAgent;
                
                let targetAgent = null;
                if (assignedAg) {
                  const agIdStr = typeof assignedAg === 'object' ? String(assignedAg._id || assignedAg.id || '') : String(assignedAg);
                  if (agIdStr && agentPerfMap[agIdStr]) {
                    targetAgent = agentPerfMap[agIdStr];
                  } else if (typeof assignedAg === 'object' && (assignedAg.name || assignedAg.fullName)) {
                    const agName = assignedAg.name || assignedAg.fullName;
                    targetAgent = getOrCreateAgentEntry(agIdStr || agName, agName, assignedAg.clientCode || 'AGT-001');
                  }
                }

                if (!targetAgent) {
                  targetAgent = agentPerfMap['direct'];
                }

                // Register client ID in agent's clientsSet
                possibleClientIds.forEach(idKey => {
                  clientToAgentMap[idKey] = targetAgent;
                });
                
                // Track client in agent's clients set
                targetAgent.clientsSet.add(String(cl._id || cl.id || cl.name || cl.fullName));
              });
            }

            // Now attribute cleanInvests to agents
            cleanInvests.forEach(inv => {
              const amount = Number(inv.investmentAmount || inv.amount || 0);
              const invClientKeys = [
                String(inv.clientId?._id || inv.clientId?.id || inv.clientId || ''),
                String(inv.clientCode || ''),
                String(inv.clientName || inv.investorName || '')
              ].filter(Boolean);

              let assignedTarget = null;
              for (const key of invClientKeys) {
                if (clientToAgentMap[key]) {
                  assignedTarget = clientToAgentMap[key];
                  break;
                }
              }

              if (!assignedTarget) {
                // Check direct agent name on investment
                const invAgName = inv.assignedAgentName || (inv.assignedAgent && typeof inv.assignedAgent === 'object' ? inv.assignedAgent.name : null);
                if (invAgName) {
                  assignedTarget = getOrCreateAgentEntry(invAgName, invAgName, 'AGT-001');
                } else {
                  assignedTarget = agentPerfMap['direct'];
                }
              }

              assignedTarget.amount += amount;
              if (inv.clientId || inv.clientName) {
                assignedTarget.clientsSet.add(String(inv.clientId?._id || inv.clientId || inv.clientName));
              }
            });

            const sortedPerf = Object.values(agentPerfMap)
              .map(item => ({
                id: item.id,
                name: item.name,
                agentId: item.agentId,
                clients: Math.max(item.clientsSet.size, item.baseClientsCount || 0),
                amount: Math.max(item.amount, item.baseTotalInvestment || 0)
              }))
              .filter(item => item.clients > 0 || item.amount > 0)
              .sort((a, b) => b.amount - a.amount || b.clients - a.clients);

            computedContribution = sortedPerf.map(item => ({
              name: item.name,
              amount: item.amount,
              clients: item.clients
            }));

            computedAgentsRanked = sortedPerf.map((item, i) => ({
              id: item.id || i,
              name: item.name,
              agentId: item.agentId || `AGT-${String(i+1).padStart(3, '0')}`,
              clients: item.clients,
              totalInvestment: item.amount
            }));
          }
        }

        // Apply segments without zero fallbacks
        const activeSegmentsList = (computedSegments.length > 0 ? computedSegments : (data.segments || []))
          .filter(s => (s.amount || s.value || 0) > 0);
        setSegments(activeSegmentsList);

        // Apply investment status with fallbacks
        if (computedInvestmentStatus.length > 0) {
          setInvestmentStatus(computedInvestmentStatus);
        } else if (data.investmentStatus) {
          const invStat = data.investmentStatus;
          const act = invStat.active || invStat.activeInvestments || 0;
          const pend = invStat.pending || invStat.pendingDeposits || 0;
          const cls = invStat.closed || invStat.closedInvestments || 0;
          const tot = act + pend + cls;
          setInvestmentStatus([
            { status: 'Active', count: act, percentage: tot > 0 ? Math.round((act / tot) * 100) : 0, color: '#10B981' },
            { status: 'Pending', count: pend, percentage: tot > 0 ? Math.round((pend / tot) * 100) : 0, color: '#F59E0B' },
            { status: 'Closed', count: cls, percentage: tot > 0 ? Math.round((cls / tot) * 100) : 0, color: '#EF4444' }
          ]);
        }

        // Apply investment flow with fallbacks
        const hasInflow = computedInflow.some(v => v.investments > 0 || v.withdrawals > 0);
        if (hasInflow) {
          setInvestmentFlow(computedInflow);
        } else if (data.monthlyCharts && Array.isArray(data.monthlyCharts)) {
          setInvestmentFlow(data.monthlyCharts.map(m => ({
            month: m.month,
            investments: m.inflow || m.investments || 0,
            withdrawals: m.withdrawal || m.withdrawals || 0
          })));
        }

        // Apply agent contribution with fallbacks
        if (computedContribution.length > 0) {
          setAgentContribution(computedContribution);
          setAgentsRanked(computedAgentsRanked);
        } else if (data.topAgentsContribution || data.agentPerformance) {
          const agentList = data.topAgentsContribution || data.agentPerformance || [];
          if (Array.isArray(agentList)) {
            setAgentContribution(agentList.map(a => ({
              name: a.name || a.agentName || 'Agent',
              amount: a.amount || a.investmentVolume || a.totalInvestment || 0,
              clients: a.clientsCount || a.clientCount || 0
            })));
            setAgentsRanked(agentList.map((a, i) => ({
              id: a.agentId || i,
              name: a.name || a.agentName || 'Agent',
              agentId: a.code || a.agentCode || `AGT-${String(i+1).padStart(3, '0')}`,
              clients: a.clientsCount || a.clientCount || 0,
              totalInvestment: a.amount || a.investmentVolume || a.totalInvestment || 0
            })));
          }
        }

        // 3. Process ROI Payouts
        let realTotalRoiPaid = 0;
        let computedRoiTrend = [];

        if (payoutsRes) {
          const pList = Array.isArray(payoutsRes)
            ? payoutsRes
            : (payoutsRes.payouts || payoutsRes.data?.payouts || (payoutsRes.data && Array.isArray(payoutsRes.data) ? payoutsRes.data : []));

          if (Array.isArray(pList) && pList.length > 0) {
            const cleanPayouts = pList.filter(p => {
              const recipientName = p.recipientName || p.investorName || p.name || '';
              return !recipientName || !MOCK_NAMES.includes(recipientName.trim());
            });

            const paidPayouts = cleanPayouts.filter(p => (p.status || '').toLowerCase() === 'paid');
            realTotalRoiPaid = paidPayouts.reduce((sum, p) => sum + (p.amount || p.payoutAmount || 0), 0);
            
            const monthlyRoiSums = {};
            paidPayouts.forEach(p => {
              const date = new Date(p.createdAt || p.payoutDate || p.dueDate || p.paidAt);
              if (!isNaN(date.getTime())) {
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });
                monthlyRoiSums[monthName] = (monthlyRoiSums[monthName] || 0) + (p.amount || p.payoutAmount || 0);
              }
            });
            const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            computedRoiTrend = monthOrder.map(m => ({
              month: m,
              amount: monthlyRoiSums[m] || 0
            }));
          }
        }

        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const hasPayouts = computedRoiTrend.some(v => v.amount > 0);
        if (hasPayouts) {
          setRoiTrend(computedRoiTrend);
        } else if (data.monthlyCharts && Array.isArray(data.monthlyCharts) && data.monthlyCharts.some(m => (m.roiPaid || m.roi || 0) > 0)) {
          setRoiTrend(data.monthlyCharts.map(m => ({
            month: m.month,
            amount: m.roiPaid || m.roi || m.roiAmount || 0
          })));
        } else {
          setRoiTrend(monthOrder.map(m => ({ month: m, amount: 0 })));
        }

        // 4. Update core stats reactively with server data as primary source
        const finalInvestorsCount = data.totalInvestors !== undefined ? data.totalInvestors : (data.totalClients ?? data.stats?.totalInvestors ?? 0);
        const finalTotalInvestment = data.totalInvestment !== undefined ? data.totalInvestment : (data.totalInvestmentAmount ?? data.stats?.totalInvestment ?? 0);
        
        let finalRoiPaid = data.totalRoiPaid !== undefined ? data.totalRoiPaid : (data.roiPaid ?? data.stats?.totalRoiPaid ?? 0);
        if (finalInvestorsCount === 0 || realTotalRoiPaid === 0) {
          finalRoiPaid = 0;
        }

        const finalActiveInvestments = data.activeInvestments !== undefined ? data.activeInvestments : (data.activeInvestmentsCount ?? data.stats?.activeInvestments ?? 0);
        const finalTotalAgents = data.totalAgents !== undefined ? data.totalAgents : (data.stats?.totalAgents ?? 0);

        let freshStats = {
          totalInvestors: finalInvestorsCount,
          investorChange: data.investorChange ?? data.stats?.investorChange ?? 0,
          totalInvestment: finalTotalInvestment,
          investmentChange: data.investmentChange ?? data.stats?.investmentChange ?? 0,
          totalROIPaid: finalRoiPaid,
          roiChange: data.roiChange ?? data.stats?.roiChange ?? 0,
          totalAgents: finalTotalAgents,
          agentChange: data.agentChange ?? data.stats?.agentChange ?? 0,
          pendingApprovals: data.pendingApprovals ?? data.stats?.pendingApprovals ?? data.pendingCount ?? 0,
          activeInvestments: finalActiveInvestments,
        };
        setStats(freshStats);

        // Recent Activity
        let mappedActivities = [];
        const ensureArray = (val, fallback = []) => Array.isArray(val) ? val : fallback;
        const rawActivity = ensureArray(
          data?.recentActivities || data?.data?.recentActivities || 
          data?.recentActivity || data?.data?.recentActivity || 
          data?.activities || data?.data?.activities
        );
        mappedActivities = rawActivity
          .filter(item => {
            if (finalInvestorsCount === 0 && (item.type === 'onboarding' || item.type === 'roi_payment')) return false;
            return true;
          })
          .map((item, idx) => ({
            id: item.id || item._id || idx,
            text: item.text || item.message || 'Platform activity recorded',
            type: (item.type || 'info').toLowerCase(),
            time: item.timestamp || item.time || item.createdAt || 'Just now'
          }));
        setActivities(mappedActivities);

        // Save fresh calculations to SWR Cache
        localStorage.setItem('kfpl_super_admin_dashboard_cache', JSON.stringify({
          stats: freshStats,
          investorsRanked: computedInvestors,
          segments: computedSegments.length > 0 ? computedSegments : (data.segments || []),
          investmentStatus: computedInvestmentStatus.length > 0 ? computedInvestmentStatus : [],
          investmentFlow: computedInflow,
          agentContribution: computedContribution,
          agentsRanked: computedAgentsRanked,
          roiTrend: computedRoiTrend,
          activities: mappedActivities
        }));

      } catch (err) {
        console.error('Failed to fetch super-admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="kfpl-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading dashboard data...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="kfpl-page" id="dashboard-page">

      {/* ═══════════════ WELCOME BANNER ═══════════════ */}
      <div className="kfpl-welcome-banner">
        <div className="kfpl-welcome-content">
          <div className="kfpl-welcome-text">
            <h1 className="kfpl-welcome-title">
              Welcome back, <span className="kfpl-welcome-name">
                {(() => {
                  const admin = getAuthUser();
                  if (admin?.name) return admin.name;
                  if (admin?.role === 'sub-admin') return 'Sub Admin';
                  return 'Super Admin';
                })()}
              </span>
            </h1>
            <p className="kfpl-welcome-subtitle">
              {dateStr} — Here's your platform overview.
            </p>
          </div>
          <div className="kfpl-welcome-stats">
            <div className="kfpl-stat-pill kfpl-stat-pill--dark">
              <span className="kfpl-stat-pill-value" style={{ color: 'var(--color-gold)' }}>{formatNumber(stats.activeInvestments)}</span>
              <span className="kfpl-stat-pill-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Active Investments</span>
            </div>
            <div className="kfpl-stat-pill kfpl-stat-pill--dark">
              <span className="kfpl-stat-pill-value" style={{ color: '#4CAF50' }}>{stats.pendingApprovals}</span>
              <span className="kfpl-stat-pill-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Pending</span>
            </div>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="kfpl-welcome-deco" aria-hidden="true">
          <div className="kfpl-welcome-circle kfpl-welcome-circle--1" />
          <div className="kfpl-welcome-circle kfpl-welcome-circle--2" />
          <div className="kfpl-welcome-circle kfpl-welcome-circle--3" />
        </div>
      </div>

      {/* ═══════════════ 6 KPI CARDS ═══════════════ */}
      <div className="kfpl-dashboard-kpis">
        <KpiCard
          title="Total Investors"
          value={formatNumber(stats.totalInvestors)}
          trend={`+${stats.investorChange}% this month`}
          trendDirection="up"
          icon={kpiIcons.investors}
          iconColor="navy"
          delay={0}
        />
        <KpiCard
          title="Total Investment"
          value={formatCurrency(stats.totalInvestment)}
          trend={`+${stats.investmentChange}% growth`}
          trendDirection="up"
          icon={kpiIcons.investment}
          iconColor="gold"
          variant="gold"
          delay={80}
        />
        <KpiCard
          title="ROI Paid"
          value={formatCurrency(stats.totalROIPaid)}
          trend={`+${stats.roiChange}% vs last month`}
          trendDirection="up"
          icon={kpiIcons.roi}
          iconColor="success"
          delay={160}
        />
        <KpiCard
          title="Total Agents"
          value={formatNumber(stats.totalAgents)}
          trend={`+${stats.agentChange}% new`}
          trendDirection="up"
          icon={kpiIcons.agents}
          iconColor="info"
          delay={240}
        />
        <KpiCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          trend="Requires attention"
          trendDirection="down"
          icon={kpiIcons.pending}
          iconColor="danger"
          pulse={true}
          delay={320}
        />
        <KpiCard
          title="Active Investments"
          value={formatNumber(stats.activeInvestments)}
          trend="Live records"
          trendDirection="up"
          icon={kpiIcons.active}
          iconColor="navy"
          delay={400}
        />
      </div>

      {/* ═══════════════ CHARTS 2×2 GRID ═══════════════ */}
      <div className="kfpl-dashboard-charts-grid">
        {/* C-01: Investment by Segment — Pie */}
        <div className="kfpl-chart-card kfpl-chart-card--glass" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Investment by Segment</div>
              <div className="kfpl-chart-subtitle">Distribution across active segments</div>
            </div>
            <Badge status="active">Live</Badge>
          </div>
          <div className="kfpl-chart-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', width: '100%', padding: '10px 15px', flex: 1, overflow: 'hidden' }}>
            {(!Array.isArray(segments) || segments.length === 0 || segments.every(s => !s.amount && !s.value)) ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', gap: '8px', padding: '40px 0' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                </svg>
                <span>No active segment allocations available</span>
              </div>
            ) : (
              <>
                <div style={{ flex: 1.2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <PieChart 
                    data={(Array.isArray(segments) ? segments : []).map((seg, idx) => ({
                      status: seg.segment,
                      count: seg.amount || 0,
                      percentage: seg.value,
                      color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length]
                    }))} 
                    size={210} 
                    strokeWidth={24} 
                    isCurrency={true}
                  />
                </div>
                <div className="kfpl-chart-legend-side" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
                  {(Array.isArray(segments) ? segments : []).map((seg, i) => (
                    <div 
                      key={seg.segment} 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '4px',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.segment}</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '11px', color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}>{seg.value}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                        <span>Allocation</span>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formatCurrency(seg.amount)}</span>
                      </div>
                      <div style={{ width: '100%', height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '1.5px', overflow: 'hidden', marginTop: '2px' }}>
                        <div style={{ width: `${seg.value}%`, height: '100%', background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], borderRadius: '1.5px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* C-02: Monthly ROI Trend — Line */}
        <div className="kfpl-chart-card kfpl-chart-card--glass" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Monthly ROI Trend</div>
              <div className="kfpl-chart-subtitle">Total ROI paid per month</div>
            </div>
            <Badge status="gold">Active</Badge>
          </div>
          <div className="kfpl-chart-body" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <LineChart data={roiTrend} height={220} color="#10B981" />
          </div>
        </div>

        {/* C-03: Agent Contribution — Bar */}
        <div className="kfpl-chart-card kfpl-chart-card--glass" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Agent Contribution</div>
              <div className="kfpl-chart-subtitle">Top 10 agents by investment brought in</div>
            </div>
            <Badge status="active">Ranked</Badge>
          </div>
          <div className="kfpl-chart-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '8px' }}>
            <BarChart data={agentContribution} height={280} />
          </div>
        </div>

        {/* C-04: Investment Status — Pie */}
        <div className="kfpl-chart-card kfpl-chart-card--glass" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Investment Status</div>
              <div className="kfpl-chart-subtitle">Active vs Pending vs Closed split</div>
            </div>
            <Badge status="gold">{stats.activeInvestments} Total</Badge>
          </div>
          <div className="kfpl-chart-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '20px', width: '100%', padding: '10px 0', flex: 1 }}>
            <PieChart data={Array.isArray(investmentStatus) ? investmentStatus : []} size={180} strokeWidth={24} />
            <div className="kfpl-chart-legend-side" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
              {(Array.isArray(investmentStatus) ? investmentStatus : []).map(seg => (
                <div className="kfpl-legend-item" key={seg.status} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span className="kfpl-legend-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{seg.status}</span>
                  <span className="kfpl-legend-value" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{seg.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ INVESTMENT FLOW CHARTS ROW ═══════════════ */}
      <div className="kfpl-dashboard-full-row">
        {/* Monthly Investment Bar Chart */}
        <div className="kfpl-chart-card kfpl-chart-card--glass kfpl-chart-card--wide">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Monthly Investment Inflow</div>
              <div className="kfpl-chart-subtitle">Total investments received per month</div>
            </div>
            <Badge status="gold">₹ Crores</Badge>
          </div>
          <div className="kfpl-chart-body">
            <div className="kfpl-vbar-chart">
              {(Array.isArray(investmentFlow) ? investmentFlow : []).map((d, i) => {
                const maxVal = Math.max(...(Array.isArray(investmentFlow) ? investmentFlow : []).map(x => x.investments || 0), 1);
                const pct = ((d.investments || 0) / maxVal) * 100;
                return (
                  <div className="kfpl-vbar-col" key={i}>
                    <div className="kfpl-vbar-value">{formatCurrency(d.investments || 0)}</div>
                    <div className="kfpl-vbar-track">
                      <div className="kfpl-vbar-fill" style={{ height: `${pct}%` }} />
                    </div>
                    <div className="kfpl-vbar-label">{d.month}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Area Chart */}
        <div className="kfpl-chart-card kfpl-chart-card--glass kfpl-chart-card--wide">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Investment vs Withdrawal Flow</div>
              <div className="kfpl-chart-subtitle">Monthly inflows and outflows</div>
            </div>
            <Badge status="active">Cash Flow</Badge>
          </div>
          <div className="kfpl-chart-body">
            <AreaChart data={investmentFlow} height={240} />
          </div>
        </div>
      </div>

      {/* ═══════════════ QUICK ACTIONS ═══════════════ */}
      <div className="kfpl-quick-actions-section">
        <div className="kfpl-section-header">
          <h3 className="kfpl-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Quick Actions
          </h3>
          <span className="kfpl-section-subtitle">One-click access to common tasks</span>
        </div>
        <div className="kfpl-quick-actions-grid">
          {quickActionItems.map((action, i) => (
            <button
              key={i}
              className="kfpl-quick-action-btn"
              onClick={() => navigate(action.route)}
              style={{ '--action-color': action.color }}
            >
              <div className="kfpl-quick-action-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="kfpl-quick-action-icon-wrap" style={{ background: `${action.color}12`, color: action.color }}>
                {action.icon}
              </div>
              <div className="kfpl-quick-action-text">
                <span className="kfpl-quick-action-label">{action.label}</span>
                <span className="kfpl-quick-action-sublabel">{action.subtitle}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ BOTTOM WIDGETS ═══════════════ */}
      <div className="kfpl-dashboard-widgets">
        {/* Recent Activity */}
        <div className="kfpl-chart-card">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Recent Activity</div>
              <div className="kfpl-chart-subtitle">Last 10 platform actions</div>
            </div>
            <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/approvals')}>View All</button>
          </div>
          <div className="kfpl-chart-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="kfpl-activity-feed">
              {Array.isArray(activities) && activities.length > 0 ? (
                activities.map(item => (
                  <div className="kfpl-activity-item" key={item.id}>
                    <div className={`kfpl-activity-icon-wrap ${item.type}`}>
                      {activityIcons[item.type] || activityIcons.info}
                    </div>
                    <div className="kfpl-activity-content">
                      <div className="kfpl-activity-text" dangerouslySetInnerHTML={{ __html: item.text }} />
                      <div className="kfpl-activity-time">{item.time}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  No recent platform activity logged yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Investors */}
        <div className="kfpl-chart-card">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Top Investors</div>
              <div className="kfpl-chart-subtitle">Ranked by total investment</div>
            </div>
            <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/investors')}>View All</button>
          </div>
          <div className="kfpl-chart-body">
            <div className="kfpl-widget-list">
              {Array.isArray(investorsRanked) && investorsRanked.length > 0 ? (
                investorsRanked.map((inv, i) => (
                  <div className="kfpl-widget-item" key={inv.id}>
                    <div className={`kfpl-widget-rank ${i < 3 ? 'gold' : 'silver'}`}>
                      #{i + 1}
                    </div>
                    <div className="kfpl-widget-item-info">
                      <div className="kfpl-widget-item-name">{inv.name}</div>
                      <div className="kfpl-widget-item-sub">{inv.clientId} • <Badge status={inv.category}>{inv.category}</Badge></div>
                    </div>
                    <div className="kfpl-widget-item-value">
                      {formatCurrency(inv.amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  No investors registered yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Agent Performance */}
        <div className="kfpl-chart-card">
          <div className="kfpl-chart-header">
            <div>
              <div className="kfpl-chart-title">Agent Performance</div>
              <div className="kfpl-chart-subtitle">By client investment brought in</div>
            </div>
            <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/agents')}>View All</button>
          </div>
          <div className="kfpl-chart-body">
            <div className="kfpl-widget-list">
              {Array.isArray(agentsRanked) && agentsRanked.length > 0 ? (
                agentsRanked.map((agent, i) => (
                  <div className="kfpl-widget-item" key={agent.id}>
                    <div className={`kfpl-widget-rank ${i < 3 ? 'gold' : 'silver'}`}>
                      #{i + 1}
                    </div>
                    <div className="kfpl-widget-item-info">
                      <div className="kfpl-widget-item-name">{agent.name}</div>
                      <div className="kfpl-widget-item-sub">{agent.agentId} • {agent.clients} clients</div>
                    </div>
                    <div className="kfpl-widget-item-value">
                      {formatCurrency(agent.totalInvestment)}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                  No active agents recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ END: Dashboard.jsx ============ */
