/* ============================================================
   Page: PortfolioManagement.jsx
   Description: Super-admin portfolio CRUD — add/edit/delete projects,
                manage segments, and attach project media.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import { INVESTMENT_SEGMENTS } from '../../data/mockData';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../utils/usePermissions';
import { apiRequest } from '../../config/apiHelper';

// ── Default project data ────────────────────────
const DEFAULT_PROJECTS = [];

const SEGMENT_ABBR = {
  'Film Making': 'FM', Distribution: 'DS', Music: 'MS',
  'Trading & Syndication': 'TS', 'Content IP Bank': 'IP', 'Film Exhibition': 'EX',
};

const SEGMENT_COLORS = {
  'Film Making': '#10B981', Distribution: '#1565C0', Music: '#7C3AED',
  'Trading & Syndication': '#F59E0B', 'Content IP Bank': '#0F766E', 'Film Exhibition': '#0891B2',
};

const LS_KEY = 'kfpl_portfolio_projects';

const formatClientID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  const str = String(rawId).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    return 'KFPL-CL-1001';
  }
  if (/^KFPL-CL-\d+$/i.test(str)) {
    return str.toUpperCase();
  }
  const digitsMatch = str.match(/\d+/);
  if (digitsMatch) {
    let val = parseInt(digitsMatch[0], 10);
    if (val < 1000) val = 1000 + val;
    return `KFPL-CL-${val}`;
  }
  return 'KFPL-CL-1001';
};

export default function PortfolioManagement() {
  const { addToast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const fileInputRef = useRef(null);

  // ── State ──────────────────────────
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [drawerProject, setDrawerProject] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  // Map of Cloudinary URL → original filename (persisted in localStorage)
  const [mediaFileNames, setMediaFileNames] = useState(() => {
    try { return JSON.parse(localStorage.getItem('kfpl_media_names') || '{}'); }
    catch { return {}; }
  });
  const [activePage, setActivePage] = useState('projects'); // 'projects' or 'dividends'
  const [dividends, setDividends] = useState([]);
  const [investorList, setInvestorList] = useState([]);
  const [dividendStats, setDividendStats] = useState({
    totalPoolAmount: 0,
    totalAllottedAmount: 0,
    remainingBalance: 0
  });
  const [showAddPoolModal, setShowAddPoolModal] = useState(false);
  const [poolForm, setPoolForm] = useState({ name: '', poolAmount: '', remarks: '' });
  const [editingPoolId, setEditingPoolId] = useState(null);
  const [drawerPoolInput, setDrawerPoolInput] = useState('');
  const [drawerStats, setDrawerStats] = useState(null);
  const [globalPools, setGlobalPools] = useState(() => {
    try {
      const stored = localStorage.getItem('kfpl_global_pools_list');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Segment & Statuses configurations state
  const [segmentsConfig, setSegmentsConfig] = useState([]);
  const [showSegmentsManagerModal, setShowSegmentsManagerModal] = useState(false);
  const [editingSegmentIndex, setEditingSegmentIndex] = useState(null);
  const [segmentFormName, setSegmentFormName] = useState('');
  const [segmentFormStatuses, setSegmentFormStatuses] = useState([]);
  const [newStatusText, setNewStatusText] = useState('');
  const [deleteSegConfirmIdx, setDeleteSegConfirmIdx] = useState(null);
  const [customSegmentText, setCustomSegmentText] = useState('');

  // Inline quick update state
  const [editId, setEditId] = useState(null);
  const [updateNote, setUpdateNote] = useState('');
  const [inlineStatus, setInlineStatus] = useState('');
  const [inlineProgress, setInlineProgress] = useState(0);
  const [isSegmentWidePost, setIsSegmentWidePost] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    isSegmentWide: false,
    name: '', segment: '', status: 'Planning', value: '', milestone: 0,
    minInvestment: 200000, targetFunding: 25000000, fundedAmount: 0, totalSlots: 20, slotsAvailable: 20,
    summary: '', risk: 'Medium', horizon: '', roi: '1.0%', health: 'On Track', bannerImg: '',
    update: '', allocation: '',
  });

  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Helper parser for projects
  const extractProjects = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.projects && Array.isArray(res.projects)) return res.projects;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (res.data.projects && Array.isArray(res.data.projects)) return res.data.projects;
    }
    for (const key of Object.keys(res)) {
      if (Array.isArray(res[key])) {
        return res[key];
      }
    }
    return [];
  };

  // Helper parser for segments
  const extractSegments = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.segments && Array.isArray(res.segments)) return res.segments;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (res.data.segments && Array.isArray(res.data.segments)) return res.data.segments;
    }
    for (const key of Object.keys(res)) {
      if (Array.isArray(res[key])) {
        return res[key];
      }
    }
    return [];
  };


  // Helper: map a Cloudinary URL to a media object using saved original names
  const mapMediaUrl = (url, namesMap) => {
    const cleanUrl = url.split('?')[0];
    const lastSegment = cleanUrl.split('/').pop() || '';
    const rawExt = lastSegment.includes('.') ? lastSegment.split('.').pop()?.toLowerCase() : '';
    const ext = (rawExt && rawExt.length <= 5) ? rawExt : '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'tiff'];
    const isRawUpload = cleanUrl.includes('/raw/upload/');
    const savedName = namesMap[url] || namesMap[cleanUrl];
    const displayName = savedName || lastSegment || 'File';
    const finalExt = ext || (savedName ? savedName.split('.').pop()?.toLowerCase() : '') || '';
    return {
      id: url,
      name: displayName,
      url: url,
      ext: finalExt,
      isImage: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'tiff'].includes(finalExt),
      isRawUpload: isRawUpload
    };
  };

  const loadDashboardData = async () => {
    setLoading(true);

    // 1. Fetch projects
    try {
      const data = await apiRequest('/api/super-admin/projects');
      console.log('GET /api/super-admin/projects raw API data:', data);
      const raw = extractProjects(data);
      const filteredRaw = raw.filter(p => p.name !== '__KFPL_DUMMY__');
      const mapped = filteredRaw.map(p => ({
        id: p._id || p.id,
        name: p.name || '',
        segment: p.segment || '',
        status: p.status || 'Planning',
        value: (p.portfolioValue && p.portfolioValue !== '₹0.0 Cr' && p.portfolioValue !== '₹0 Cr')
          ? p.portfolioValue
          : formatCurrency(p.targetFunding || p.minInvestment || 0),
        milestone: p.milestoneProgress !== undefined ? p.milestoneProgress : (p.milestone !== undefined ? p.milestone : 0),
        minInvestment: p.minInvestment !== undefined ? p.minInvestment : 200000,
        targetFunding: p.targetFunding !== undefined ? p.targetFunding : 25000000,
        fundedAmount: p.fundedAmount !== undefined ? p.fundedAmount : 0,
        totalSlots: p.totalSlots !== undefined ? p.totalSlots : 20,
        slotsAvailable: p.slotsAvailable !== undefined ? p.slotsAvailable : 20,
        summary: p.summary || '',
        risk: p.riskLevel || p.risk || 'Medium',
        horizon: p.horizon || '',
        roi: p.monthlyRoi || p.roi || '',
        health: p.health || 'On Track',
        media: (p.mediaFiles || []).map(url => mapMediaUrl(url, mediaFileNames)),
        bannerImg: p.bannerImage || p.bannerImg || '',
        totalDividendPool: p.totalDividendPool || 0,
        dividendsDistributed: p.dividendsDistributed || 0,
        update: p.currentUpdate || p.update || '',
        allocation: p.allocationFocus || p.allocation || '',
      }));
      setProjects(mapped);
    } catch (err) {
      console.error('Failed to fetch projects from API:', err);
      setProjects([]);
    }

    // 2. Fetch segments
    try {
      const segData = await apiRequest('/api/super-admin/segments');
      const rawSeg = extractSegments(segData);
      const mappedSeg = rawSeg.map(s => ({
        id: s._id || s.id,
        name: s.name || '',
        statuses: s.statuses || []
      }));
      setSegmentsConfig(mappedSeg);
    } catch (err) {
      console.error('Failed to fetch segments from API:', err);
      setSegmentsConfig([]);
    }

    // 3. Load Dividend stats, allotments and investors from APIs
    try {
      const [divStatsRes, allotmentsRes, clientsRes, investmentsRes] = await Promise.all([
        apiRequest('/api/super-admin/dividends/stats'),
        apiRequest('/api/super-admin/dividends/allotments'),
        apiRequest('/api/super-admin/clients'),
        apiRequest('/api/super-admin/investments').catch(() => null)
      ]);

      // Extract dividend stats dynamically from backend API response
      const statsObj = divStatsRes?.data || divStatsRes || allotmentsRes?.data?.stats || allotmentsRes?.data || {};
      const totalPoolAmount = Number(statsObj.totalPoolsConfigured ?? statsObj.totalPoolAmount ?? 0);
      const totalAllottedAmount = Number(statsObj.dividendsDistributed ?? statsObj.totalAllottedAmount ?? 0);
      const remainingBalance = Number(statsObj.remainingPoolsBalance ?? statsObj.remainingBalance ?? (totalPoolAmount - totalAllottedAmount));

      setDividendStats({
        totalPoolAmount,
        totalAllottedAmount,
        remainingBalance
      });

      // Extract allotments
      const rawAllotments = allotmentsRes.allotments || allotmentsRes.data?.allotments || allotmentsRes.data || allotmentsRes || [];
      const mappedAllotments = (Array.isArray(rawAllotments) ? rawAllotments : []).map(al => {
        if (!al) return null;
        const clientObj = al.client || al.clientId || {};
        const projectObj = al.project || al.projectId || {};

        let pName = 'Unknown Project';
        let pSeg = '—';
        if (projectObj && typeof projectObj === 'object') {
          pName = projectObj.name || al.projectName || 'Unknown Project';
          pSeg = projectObj.segment || al.segment || '—';
        } else {
          pName = typeof projectObj === 'string' ? projectObj : (al.projectName || 'Unknown Project');
          pSeg = al.segment || '—';
        }

        let cName = 'Unknown Client';
        let cId = '—';
        // Priority: ClientProfile fullName > User.name > email prefix
        const resolvedName = al._resolvedClientName;
        const userPopulatedName = (clientObj && typeof clientObj === 'object') ? (clientObj.name || clientObj.fullName) : null;
        const emailPrefix = (clientObj && typeof clientObj === 'object' && clientObj.email)
          ? clientObj.email.split('@')[0]
          : null;
        cName = resolvedName || userPopulatedName || emailPrefix || 'Unknown Client';
        if (clientObj && typeof clientObj === 'object') {
          cId = al._resolvedClientCode || clientObj.clientCode || clientObj.clientId || clientObj.id || '—';
        } else {
          cId = al._resolvedClientCode || al.clientId || '—';
        }

        // Just in case any fallback is still an object
        const safePName = typeof pName === 'object' ? (pName.name || 'Unknown Project') : String(pName);
        const safePSeg = typeof pSeg === 'object' ? (pSeg.name || '—') : String(pSeg);
        const safeCName = typeof cName === 'object' ? (cName.name || cName.fullName || 'Unknown Client') : String(cName);
        const safeCId = typeof cId === 'object' ? (cId.clientId || cId.clientCode || cId.id || '—') : String(cId);

        return {
          id: al._id || al.id,
          projectName: safePName,
          segment: safePSeg,
          clientName: safeCName,
          clientId: formatClientID(safeCId),
          amount: al.allottedAmount || al.amount || 0,
          creditDate: al.creditDate || al.createdAt || new Date().toISOString(),
          adminNote: al.remarks || al.adminNote || '—'
        };
      }).filter(Boolean);
      setDividends(mappedAllotments);

      // Extract active clients list and cross-reference with all investments
      const rawClients = clientsRes.clients || clientsRes.data?.clients || clientsRes.data || clientsRes || [];
      const rawInvestments = (investmentsRes && (investmentsRes.investments || investmentsRes.data?.investments || (Array.isArray(investmentsRes.data) ? investmentsRes.data : (Array.isArray(investmentsRes) ? investmentsRes : [])))) || [];

      const mappedClients = (Array.isArray(rawClients) ? rawClients : []).map((c, index) => {
        const profile = c.profile || {};
        const user = (c.userId && typeof c.userId === 'object' ? c.userId : null) ||
          (c.user && typeof c.user === 'object' ? c.user : null) || {};
        const name = profile.fullName || user.name || user.fullName || c.fullName || c.name || 'Client';
        
        const rawClientId = c.clientId || profile.clientId || '';
        const clientId = formatClientID(rawClientId || index + 1);

        const cIdStr = String(c._id || c.id);

        // Find all investments corresponding to this client from rawInvestments
        const myRawInvestments = rawInvestments.filter(inv => {
          if (!inv) return false;
          const clientRef = inv.client || inv.clientId || '';
          const clientRefId = (clientRef && typeof clientRef === 'object') ? String(clientRef._id || clientRef.id || '') : String(clientRef);
          return clientRefId === cIdStr;
        });

        // Merge embedded investments with fetched investments
        const combinedRaw = [...(c.investments || profile.investments || []), ...myRawInvestments];

        const investments = combinedRaw.map(inv => {
          const proj = inv.projectId || inv.project || '';
          const projectIdStr = (proj && typeof proj === 'object') ? String(proj._id || proj.id || '') : String(proj);
          const segmentStr = inv.segment || (proj && typeof proj === 'object' ? proj.segment : '') || '';
          return {
            projectId: projectIdStr,
            segment: segmentStr,
            amount: inv.amount || inv.investmentAmount || inv.allottedAmount || 0
          };
        });

        return {
          id: cIdStr,
          name,
          clientId,
          investments,
          category: c.category || profile.riskProfile || 'Silver',
          status: c.status || 'Active'
        };
      });
      setInvestorList(mappedClients);

      // Combine with local allotments
      let localAllotments = [];
      try {
        const storedLocals = localStorage.getItem('kfpl_local_allotments');
        localAllotments = storedLocals ? JSON.parse(storedLocals) : [];
      } catch {}

      const combinedAllotments = [...mappedAllotments, ...localAllotments];
      setDividends(combinedAllotments);

      // Sum of project pools
      const projectPoolsTotal = projects.reduce((sum, p) => {
        const localOverride = localStorage.getItem(`kfpl_project_dividend_pool_${p.id}`);
        const poolVal = localOverride !== null ? parseFloat(localOverride) : (p.totalDividendPool || 0);
        return sum + poolVal;
      }, 0);

      // Update global pool metrics dynamically from backend API
      const backendTotalPool = totalPoolAmount;
      const totalPoolCalculated = backendTotalPool > 0 ? backendTotalPool : projectPoolsTotal;
      const totalAllottedCalculated = combinedAllotments.reduce((sum, al) => sum + (al.amount || 0), 0);
      const remainingBalanceCalculated = Math.max(0, totalPoolCalculated - totalAllottedCalculated);

      setDividendStats({
        totalPoolAmount: totalPoolCalculated,
        totalAllottedAmount: totalAllottedCalculated,
        remainingBalance: remainingBalanceCalculated
      });

    } catch (err) {
      console.error('Failed to load dividend stats/allotments/clients:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (drawerProject) {
      setDrawerPoolInput(drawerProject.totalDividendPool ? String(drawerProject.totalDividendPool) : '');
      
      const fetchDrawerStats = async () => {
        try {
          const res = await apiRequest(`/api/super-admin/dividends/stats?projectId=${drawerProject.id}`);
          if (res) {
            const raw = res.data || res;
            setDrawerStats({
              totalPoolAmount: raw.totalPoolsConfigured || raw.totalPoolAmount || 0,
              totalAllottedAmount: raw.dividendsDistributed || raw.totalAllottedAmount || 0,
              remainingBalance: raw.remainingPoolsBalance || raw.remainingBalance || 0
            });
          }
        } catch (e) {
          console.warn('Failed to fetch drawer project stats:', e);
        }
      };
      fetchDrawerStats();
    } else {
      setDrawerPoolInput('');
      setDrawerStats(null);
    }
  }, [drawerProject]);

  const persist = (updated) => {
    setProjects(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  // ── Segment list (from config + projects fallback) ──
  const segmentNames = [...new Set([
    ...segmentsConfig.map(s => s.name),
    ...projects.map(p => p.segment)
  ])].filter(Boolean);

  // ── CRUD handlers ─────────────────────────
  const resetForm = () => {
    setFormData({
      isSegmentWide: false,
      name: '', segment: '', status: 'Planning', value: '', milestone: 0,
      minInvestment: 200000, targetFunding: 25000000, fundedAmount: 0, totalSlots: 20, slotsAvailable: 20,
      summary: '', risk: 'Medium', horizon: '', roi: '1.0%', health: 'On Track', bannerImg: '',
      update: '', allocation: '',
    });
    setCustomSegmentText('');
    setSelectedFile(null);
  };

  const openAddModal = () => {
    resetForm();
    setEditingProject(null);
    setShowAddModal(true);
  };

  const openEditModal = (project) => {
    setFormData({
      isSegmentWide: !!project.isSegmentWide,
      name: project.name || '',
      segment: project.segment || '',
      status: project.status || 'Planning',
      value: project.value || `₹${((Number(project.targetFunding || 25000000)) / 10000000).toFixed(1)} Cr`,
      milestone: project.milestone !== undefined ? project.milestone : 0,
      minInvestment: project.minInvestment !== undefined ? project.minInvestment : 200000,
      targetFunding: project.targetFunding !== undefined ? project.targetFunding : 25000000,
      fundedAmount: project.fundedAmount !== undefined ? project.fundedAmount : 0,
      totalSlots: project.totalSlots !== undefined ? project.totalSlots : 20,
      slotsAvailable: project.slotsAvailable !== undefined ? project.slotsAvailable : 20,
      summary: project.summary || '',
      risk: project.risk || 'Medium',
      horizon: project.horizon || '',
      roi: project.roi || '1.0%',
      health: project.health || 'On Track',
      bannerImg: project.bannerImg || '',
      update: project.update || '',
      allocation: project.allocation || '',
    });
    setEditingProject(project);
    setShowAddModal(true);
  };

  const handlePostUpdate = async (item) => {
    if (!updateNote.trim() && !inlineStatus) {
      addToast('Please provide an update note or status', 'error', 'Error');
      return;
    }

    try {
      setSubmitting(true);
      const isSeg = isSegmentWidePost || (item && item.isSegmentWide);

      const payload = {
        status: inlineStatus || item.status,
        progress: Number(inlineProgress) !== undefined ? Number(inlineProgress) : (item.milestone || 0),
        notes: updateNote.trim(),
        applySegmentWide: isSeg
      };

      await apiRequest(`/api/super-admin/projects/${item.id}/updates`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      addToast(`Status update published for ${isSeg ? item.segment : item.name}`, 'success', 'Published');
      setEditId(null);
      setUpdateNote('');
      setIsSegmentWidePost(false);
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to post update:', err);
      addToast(err.message || 'Failed to post update', 'error', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProject = async () => {
    let finalSegment = formData.segment;

    if (formData.segment === '__NEW__') {
      const segText = customSegmentText.trim();
      if (!segText) {
        addToast('Please enter a custom segment name', 'error', 'Validation Error');
        return;
      }
      finalSegment = segText;

      // Create segment on the backend first!
      try {
        await apiRequest('/api/super-admin/segments', {
          method: 'POST',
          body: JSON.stringify({
            name: segText,
            statuses: ['Planning', 'Active', 'Ongoing', 'Completed']
          })
        });
      } catch (err) {
        console.warn('Segment creation failed or already exists:', err);
      }
    }

    if (!formData.name.trim() || !finalSegment) {
      addToast('Please fill in project name and segment', 'error', 'Validation Error');
      return;
    }

    setSubmitting(true);
    const targetFundingNum = Number(formData.targetFunding) || 0;
    const calculatedPortfolioValue = (formData.value && formData.value !== '₹0.0 Cr' && formData.value !== '₹0 Cr')
      ? formData.value
      : (targetFundingNum > 0 ? formatCurrency(targetFundingNum) : '₹0');

    try {
      if (editingProject) {
        const id = editingProject.id;
        if (selectedFile) {
          const formDataToSend = new FormData();
          formDataToSend.append('name', formData.name.trim());
          formDataToSend.append('segment', finalSegment);
          formDataToSend.append('status', formData.status || 'Planning');
          formDataToSend.append('portfolioValue', calculatedPortfolioValue);
          formDataToSend.append('monthlyRoi', formData.roi || '1.0%');
          formDataToSend.append('riskLevel', formData.risk || 'Medium');
          formDataToSend.append('milestoneProgress', String(parseInt(formData.milestone) || 0));
          formDataToSend.append('minInvestment', String(Number(formData.minInvestment) || 200000));
          formDataToSend.append('targetFunding', String(Number(formData.targetFunding) || 25000000));
          formDataToSend.append('fundedAmount', String(Number(formData.fundedAmount) || 0));
          formDataToSend.append('totalSlots', String(Number(formData.totalSlots) || 20));
          formDataToSend.append('slotsAvailable', String(Number(formData.slotsAvailable) || 20));
          formDataToSend.append('health', formData.health || 'On Track');
          formDataToSend.append('summary', formData.summary || '');
          formDataToSend.append('currentUpdate', formData.update || '');
          formDataToSend.append('allocationFocus', formData.allocation || '');
          formDataToSend.append('horizon', formData.horizon || '12 Months');
          formDataToSend.append('bannerImage', selectedFile);

          const res = await apiRequest(`/api/super-admin/projects/${id}`, {
            method: 'PATCH',
            body: formDataToSend,
          });
          console.log('PATCH project (FormData) response:', res);
        } else {
          const payload = {
            name: formData.name.trim(),
            segment: finalSegment,
            status: formData.status || 'Planning',
            portfolioValue: calculatedPortfolioValue,
            monthlyRoi: formData.roi || '1.0%',
            riskLevel: formData.risk || 'Medium',
            milestoneProgress: parseInt(formData.milestone) || 0,
            minInvestment: Number(formData.minInvestment) || 200000,
            targetFunding: Number(formData.targetFunding) || 25000000,
            fundedAmount: Number(formData.fundedAmount) || 0,
            totalSlots: Number(formData.totalSlots) || 20,
            slotsAvailable: Number(formData.slotsAvailable) || 20,
            health: formData.health || 'On Track',
            summary: formData.summary || '',
            currentUpdate: formData.update || '',
            allocationFocus: formData.allocation || '',
            horizon: formData.horizon || '12 Months',
            scope: formData.isSegmentWide ? 'segment' : 'project',
            applySegmentWide: formData.isSegmentWide
          };
          if (!formData.bannerImg) {
            payload.bannerImage = '';
          }

          const res = await apiRequest(`/api/super-admin/projects/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
          console.log('PATCH project (JSON) payload:', payload, 'response:', res);
        }
        addToast(`${formData.name} updated successfully`, 'success', 'Project Updated');
      } else {
        if (selectedFile) {
          const formDataToSend = new FormData();
          formDataToSend.append('name', formData.name.trim());
          formDataToSend.append('segment', finalSegment);
          formDataToSend.append('status', formData.status || 'Planning');
          formDataToSend.append('portfolioValue', calculatedPortfolioValue);
          formDataToSend.append('monthlyRoi', formData.roi || '1.0%');
          formDataToSend.append('riskLevel', formData.risk || 'Medium');
          formDataToSend.append('milestoneProgress', String(parseInt(formData.milestone) || 0));
          formDataToSend.append('minInvestment', String(Number(formData.minInvestment) || 200000));
          formDataToSend.append('targetFunding', String(Number(formData.targetFunding) || 25000000));
          formDataToSend.append('fundedAmount', String(Number(formData.fundedAmount) || 0));
          formDataToSend.append('totalSlots', String(Number(formData.totalSlots) || 20));
          formDataToSend.append('slotsAvailable', String(Number(formData.slotsAvailable) || 20));
          formDataToSend.append('health', formData.health || 'On Track');
          formDataToSend.append('summary', formData.summary || '');
          formDataToSend.append('currentUpdate', formData.update || '');
          formDataToSend.append('allocationFocus', formData.allocation || '');
          formDataToSend.append('horizon', formData.horizon || '12 Months');
          formDataToSend.append('bannerImage', selectedFile);

          const res = await apiRequest('/api/super-admin/projects', {
            method: 'POST',
            body: formDataToSend,
          });
          console.log('POST project (FormData) response:', res);
        } else {
          const payload = {
            name: formData.name.trim(),
            segment: finalSegment,
            status: formData.status || 'Planning',
            portfolioValue: calculatedPortfolioValue,
            monthlyRoi: formData.roi || '1.0%',
            riskLevel: formData.risk || 'Medium',
            milestoneProgress: parseInt(formData.milestone) || 0,
            minInvestment: Number(formData.minInvestment) || 200000,
            targetFunding: Number(formData.targetFunding) || 25000000,
            fundedAmount: Number(formData.fundedAmount) || 0,
            totalSlots: Number(formData.totalSlots) || 20,
            slotsAvailable: Number(formData.slotsAvailable) || 20,
            health: formData.health || 'On Track',
            summary: formData.summary || '',
            currentUpdate: formData.update || '',
            allocationFocus: formData.allocation || '',
            horizon: formData.horizon || '12 Months',
            scope: formData.isSegmentWide ? 'segment' : 'project',
            applySegmentWide: formData.isSegmentWide
          };

          const res = await apiRequest('/api/super-admin/projects', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          console.log('POST project (JSON) payload:', payload, 'response:', res);
        }
        addToast(`${formData.name} added successfully`, 'success', 'Project Created');
      }

      await loadDashboardData();
      setShowAddModal(false);
      setEditingProject(null);
      resetForm();
    } catch (err) {
      console.error('Failed to save project:', err);
      addToast(err.message || 'Failed to save project', 'error', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Segment & Status Configuration Manager Handlers ──
  const openSegmentsManager = () => {
    setEditingSegmentIndex(null);
    setSegmentFormName('');
    setSegmentFormStatuses([]);
    setNewStatusText('');
    setDeleteSegConfirmIdx(null);
    setShowSegmentsManagerModal(true);
  };

  const handleEditSegment = (index) => {
    setEditingSegmentIndex(index);
    setSegmentFormName(segmentsConfig[index].name);
    setSegmentFormStatuses([...segmentsConfig[index].statuses]);
    setNewStatusText('');
    setDeleteSegConfirmIdx(null);
  };

  const handleAddStatusTag = () => {
    const status = newStatusText.trim();
    if (!status) return;
    if (segmentFormStatuses.some(s => s.toLowerCase() === status.toLowerCase())) {
      addToast('Status already exists in this segment', 'error', 'Duplicate');
      return;
    }
    setSegmentFormStatuses([...segmentFormStatuses, status]);
    setNewStatusText('');
  };

  const handleRemoveStatusTag = (statusToRemove) => {
    setSegmentFormStatuses(segmentFormStatuses.filter(s => s !== statusToRemove));
  };

  const handleSaveSegmentConfig = async () => {
    const name = segmentFormName.trim();
    if (!name) {
      addToast('Please enter a segment name', 'error', 'Validation Error');
      return;
    }

    if (segmentFormStatuses.length === 0) {
      addToast('Please add at least one status option', 'error', 'Validation Error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSegmentIndex !== null) {
        const targetSeg = segmentsConfig[editingSegmentIndex];
        const id = targetSeg.id;

        if (id) {
          await apiRequest(`/api/super-admin/segments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name,
              statuses: segmentFormStatuses
            })
          });
        } else {
          await apiRequest('/api/super-admin/segments', {
            method: 'POST',
            body: JSON.stringify({
              name,
              statuses: segmentFormStatuses
            })
          });
        }
        addToast(`Segment "${name}" updated successfully`, 'success', 'Segment Updated');
      } else {
        await apiRequest('/api/super-admin/segments', {
          method: 'POST',
          body: JSON.stringify({
            name,
            statuses: segmentFormStatuses
          })
        });
        addToast(`Segment "${name}" created successfully`, 'success', 'Segment Created');
      }

      await loadDashboardData();
      setEditingSegmentIndex(null);
      setSegmentFormName('');
      setSegmentFormStatuses([]);
      setNewStatusText('');
    } catch (err) {
      console.error('Failed to save segment:', err);
      addToast(err.message || 'Failed to save segment', 'error', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePool = async () => {
    const name = poolForm.name.trim();
    const amount = parseFloat(poolForm.poolAmount);
    if (!name || isNaN(amount) || amount <= 0) {
      addToast('Please enter a valid pool name and positive amount', 'error', 'Error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingPoolId) {
        // EDIT MODE
        const updatedPools = globalPools.map(p => {
          if (p.id === editingPoolId) {
            return {
              ...p,
              name,
              amount,
              remarks: poolForm.remarks.trim()
            };
          }
          return p;
        });
        setGlobalPools(updatedPools);
        localStorage.setItem('kfpl_global_pools_list', JSON.stringify(updatedPools));
        addToast('Dividend pool updated successfully', 'success', 'Pool Updated');
        setEditingPoolId(null);
      } else {
        // CREATE MODE
        // 1. Call official backend API (for compatibility)
        await apiRequest('/api/super-admin/dividends/pools', {
          method: 'POST',
          body: {
            name,
            poolAmount: amount,
            remarks: poolForm.remarks.trim()
          }
        }).catch(err => console.warn('Backend pools API failed, proceeding with local configuration:', err));

        // 2. Save locally in list
        const newPoolItem = {
          id: String(Date.now()),
          name,
          amount,
          createdAt: new Date().toISOString(),
          remarks: poolForm.remarks.trim()
        };

        const updatedPools = [...globalPools, newPoolItem];
        setGlobalPools(updatedPools);
        localStorage.setItem('kfpl_global_pools_list', JSON.stringify(updatedPools));

        addToast('Dividend pool configured successfully', 'success', 'Success');
      }
      
      // Reset form & state
      setShowAddPoolModal(false);
      setPoolForm({ name: '', poolAmount: '', remarks: '' });
      
      // Reload dashboard stats
      setTimeout(() => {
        loadDashboardData();
      }, 100);

    } catch (err) {
      console.error('Failed to save pool:', err);
      addToast(err.message || 'Failed to save dividend pool', 'error', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGlobalPool = (poolId) => {
    const updated = globalPools.filter(p => p.id !== poolId);
    setGlobalPools(updated);
    localStorage.setItem('kfpl_global_pools_list', JSON.stringify(updated));
    addToast('Dividend pool deleted successfully', 'success', 'Pool Deleted');
    setTimeout(() => {
      loadDashboardData();
    }, 100);
  };

  const confirmDeleteSegment = async () => {
    if (deleteSegConfirmIdx === null) return;
    const targetSeg = segmentsConfig[deleteSegConfirmIdx];
    const id = targetSeg.id;
    const segmentToDelete = targetSeg.name;

    const prevSegments = segmentsConfig;
    setSegmentsConfig(prev => prev.filter((_, idx) => idx !== deleteSegConfirmIdx));
    addToast(`Segment "${segmentToDelete}" deleted`, 'success', 'Segment Deleted');

    if (editingSegmentIndex === deleteSegConfirmIdx) {
      setEditingSegmentIndex(null);
      setSegmentFormName('');
      setSegmentFormStatuses([]);
      setNewStatusText('');
    }
    setDeleteSegConfirmIdx(null);

    try {
      if (id) {
        await apiRequest(`/api/super-admin/segments/${id}`, {
          method: 'DELETE',
        });
      }
      loadDashboardData();
    } catch (err) {
      console.error('Failed to delete segment:', err);
      addToast(err.message || 'Failed to delete segment', 'error', 'Error');
      setSegmentsConfig(prevSegments);
      loadDashboardData();
    }
  };

  const handleDeleteProject = async (id) => {
    const prevProjects = projects;
    setProjects(prev => prev.filter(p => p.id !== id));
    addToast('Project deleted successfully', 'success', 'Deleted');
    setDeleteConfirm(null);

    try {
      const nonDummyProjects = projects.filter(p => p.name !== '__KFPL_DUMMY__');
      const isDeletingLast = nonDummyProjects.length === 1 && nonDummyProjects[0].id === id;

      await apiRequest(`/api/super-admin/projects/${id}`, {
        method: 'DELETE',
      });

      if (isDeletingLast) {
        const payload = {
          name: '__KFPL_DUMMY__',
          segment: 'Film Making',
          status: 'Planning',
          portfolioValue: '₹0 Cr',
          monthlyRoi: '0%',
          riskLevel: 'Low',
          milestoneProgress: 0,
          health: 'Planned',
          summary: 'Internal system placeholder. Do not delete.',
        };
        await apiRequest('/api/super-admin/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      loadDashboardData();
    } catch (err) {
      console.error('Failed to delete project:', err);
      addToast(err.message || 'Failed to delete project', 'error', 'Error');
      setProjects(prevProjects);
      loadDashboardData();
    }
  };

  // ── Media upload ──────────────────────────
  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!uploadTarget || files.length === 0) return;

    setSubmitting(true);
    let successCount = 0;
    let lastMappedProject = null;

    for (const file of files) {
      try {
        const formDataToSend = new FormData();
        formDataToSend.append('file', file);
        // Remember the original filename before upload
        const originalFileName = file.name;
        // Get existing URLs for this project to detect the newly added one
        const projectBefore = projects.find(p => p.id === uploadTarget);
        const urlsBefore = new Set((projectBefore?.media || []).map(m => m.url));

        const res = await apiRequest(`/api/super-admin/projects/${uploadTarget}/media`, {
          method: 'POST',
          body: formDataToSend
        });

        successCount++;
        const updatedProject = res.project || res.data?.project || res.data || {};

        // Find the new Cloudinary URL (one that wasn't in the previous list)
        const newMediaUrls = updatedProject.mediaFiles || [];
        const newUrl = newMediaUrls.find(u => !urlsBefore.has(u)) || newMediaUrls[newMediaUrls.length - 1];
        if (newUrl && originalFileName) {
          const updatedNames = { ...mediaFileNames, [newUrl]: originalFileName };
          setMediaFileNames(updatedNames);
          try { localStorage.setItem('kfpl_media_names', JSON.stringify(updatedNames)); } catch { }
        }

        if (updatedProject && (updatedProject._id || updatedProject.id)) {
          lastMappedProject = {
            id: updatedProject._id || updatedProject.id,
            name: updatedProject.name || '',
            segment: updatedProject.segment || '',
            status: updatedProject.status || 'Planning',
            value: updatedProject.portfolioValue || updatedProject.value || '₹0 Cr',
            milestone: updatedProject.milestoneProgress !== undefined ? updatedProject.milestoneProgress : (updatedProject.milestone !== undefined ? updatedProject.milestone : 0),
            summary: updatedProject.summary || '',
            risk: updatedProject.riskLevel || updatedProject.risk || 'Medium',
            horizon: updatedProject.horizon || '',
            roi: updatedProject.monthlyRoi || updatedProject.roi || '',
            health: updatedProject.health || 'On Track',
            media: (updatedProject.mediaFiles || []).map(url => mapMediaUrl(url, { ...mediaFileNames, ...(newUrl ? { [newUrl]: originalFileName } : {}) })),
            bannerImg: updatedProject.bannerImage || updatedProject.bannerImg || '',
            totalDividendPool: updatedProject.totalDividendPool || 0,
            dividendsDistributed: updatedProject.dividendsDistributed || 0,
            update: updatedProject.currentUpdate || updatedProject.update || '',
            allocation: updatedProject.allocationFocus || updatedProject.allocation || '',
          };
        }
      } catch (err) {
        console.error('Failed to upload file:', file.name, err);
      }
    }

    if (successCount > 0) {
      addToast(`${successCount} file(s) uploaded successfully`, 'success', 'Success');
      await loadDashboardData();
      if (lastMappedProject && drawerProject && drawerProject.id === uploadTarget) {
        setDrawerProject(lastMappedProject);
      }
    } else {
      addToast('Failed to upload project media', 'error', 'Error');
    }

    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadTarget(null);
  };

  const handleRemoveMedia = async (projectId, mediaId) => {
    // mediaId here is the Cloudinary URL of the file
    setSubmitting(true);
    try {
      await apiRequest(`/api/super-admin/projects/${projectId}/media`, {
        method: 'DELETE',
        body: JSON.stringify({
          url: mediaId
        })
      });

      addToast('Media removed successfully', 'success', 'Success');
      await loadDashboardData();

      // Update drawer if open
      if (drawerProject && drawerProject.id === projectId) {
        setDrawerProject(prev => {
          if (!prev) return null;
          return {
            ...prev,
            media: (prev.media || []).filter(m => m.id !== mediaId)
          };
        });
      }
    } catch (err) {
      console.error('Failed to remove media:', err);
      addToast(err.message || 'Failed to remove media', 'error', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Filtering ─────────────────────────────
  const filteredProjects = activeTab === 'All'
    ? projects
    : projects.filter(p => p.segment === activeTab);

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => !['Completed', 'Planned'].includes(p.status)).length;
  const avgProgress = totalProjects > 0
    ? Math.round(projects.reduce((s, p) => s + (parseInt(p.milestone) || 0), 0) / totalProjects)
    : 0;

  // ── Lock body scroll when drawer is open ──
  useEffect(() => {
    if (!drawerProject) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [drawerProject]);

  // ── Drawer Portal ─────────────────────────
  const projectInvestors = drawerProject
    ? investorList.filter(inv =>
      (inv.investments || []).some(subInv => 
        String(subInv.projectId) === String(drawerProject.id) ||
        (subInv.segment && drawerProject.segment && 
         subInv.segment.trim().toLowerCase() === drawerProject.segment.trim().toLowerCase())
      )
    )
    : [];

  const drawer = drawerProject && createPortal(
    <>
      <div className="kfpl-portfolio-drawer-overlay" onClick={() => setDrawerProject(null)} />
      <aside className="kfpl-portfolio-drawer" style={{ '--portfolio-accent': SEGMENT_COLORS[drawerProject.segment] || 'var(--color-gold)' }}>
        {/* Header */}
        <div className="kfpl-drawer-header kfpl-portfolio-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', paddingTop: '4px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{drawerProject.name}</h2>
            <span className="kfpl-portfolio-segment" style={{ marginTop: 0 }}>{drawerProject.segment}</span>
          </div>
          <button className="kfpl-modal-close" onClick={() => setDrawerProject(null)} aria-label="Close project details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="kfpl-drawer-body kfpl-portfolio-drawer-body">
          <div className="kfpl-portfolio-drawer-visual" style={{
            backgroundImage: drawerProject.bannerImg ? `linear-gradient(rgba(6, 29, 19, 0.5), rgba(6, 29, 19, 0.8)), url(${drawerProject.bannerImg})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative'
          }}>
            <span>{SEGMENT_ABBR[drawerProject.segment] || drawerProject.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--color-gold)' }}>
                Max Target: {drawerProject.targetFunding ? formatCurrency(drawerProject.targetFunding) : (drawerProject.value || '₹0')}
              </strong>
              <small style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem' }}>Min Investment: {formatCurrency(drawerProject.minInvestment || 0)}</small>
            </div>

          </div>

          <p className="kfpl-portfolio-drawer-summary">{drawerProject.summary}</p>

          {/* KPIs */}
          <div className="kfpl-portfolio-drawer-kpis">
            <div>
              <span>Min. Investment</span>
              <strong>{formatCurrency(drawerProject.minInvestment || 0)}</strong>
            </div>
            <div>
              <span>Max Target Funding</span>
              <strong style={{ color: 'var(--color-gold)' }}>{drawerProject.targetFunding ? formatCurrency(drawerProject.targetFunding) : (drawerProject.value || '₹0')}</strong>
            </div>
            <div>
              <span>Funded Amount</span>
              <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(drawerProject.fundedAmount || 0)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{drawerProject.status}</strong>
            </div>
            <div>
              <span>Monthly ROI</span>
              <strong>{drawerProject.roi || '—'}</strong>
            </div>
            <div>
              <span>Risk</span>
              <strong>{drawerProject.risk || '—'}</strong>
            </div>
            <div>
              <span>Horizon</span>
              <strong>{drawerProject.horizon || '—'}</strong>
            </div>
            <div>
              <span>Segment</span>
              <strong>{drawerProject.segment}</strong>
            </div>
            <div>
              <span>Health</span>
              <strong>{drawerProject.health || '—'}</strong>
            </div>
          </div>

          {/* Latest Status Update Section */}
          <div className="kfpl-portfolio-drawer-section">
            <h3>Latest Operational Update</h3>
            {drawerProject.update ? (
              <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-success)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                  CURRENT STATUS NOTE
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--color-text-primary)' }}>{drawerProject.update}</p>
              </div>
            ) : (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '12px', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
                No status updates posted yet.
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="kfpl-portfolio-drawer-section">
            <h3>Milestone Progress</h3>
            <div className="kfpl-portfolio-progress-row">
              <span>{drawerProject.health || 'On Track'}</span>
              <strong>{drawerProject.milestone}%</strong>
            </div>
            <div className="kfpl-progress kfpl-portfolio-drawer-progress">
              <div className="kfpl-progress-fill" style={{ width: `${drawerProject.milestone}%` }} />
            </div>
          </div>

          {/* Media Section */}
          <div className="kfpl-portfolio-drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Project Media & Files</h3>
              <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => {
                setUploadTarget(drawerProject.id);
                setTimeout(() => fileInputRef.current?.click(), 50);
              }}>+ Upload</button>
            </div>
            {(drawerProject.media || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', border: '2px dashed var(--color-border)', borderRadius: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                No files uploaded yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(drawerProject.media || []).map(m => (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                    background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)',
                  }}>
                    {m.isImage ? (
                      <img src={m.url} alt={m.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        {m.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{m.size ? `${(m.size / 1024).toFixed(1)} KB` : 'Cloud Storage'}</div>
                    </div>
                    <button
                      className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                      style={{
                        color: 'var(--color-danger)', padding: '4px 8px', minWidth: 'auto',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      onClick={() => handleRemoveMedia(drawerProject.id, m.id)}
                      aria-label={`Remove media ${m.name}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 11, height: 11 }}>
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dividend Management Section */}
          <div className="kfpl-portfolio-drawer-section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800 }}>Dividend Management</h3>

            {/* Pool Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Dividend Pool</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--color-gold)' }}>
                  {formatCurrency(drawerStats ? drawerStats.totalPoolAmount : (drawerProject.totalDividendPool || 0))}
                </strong>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Distributed</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--color-success)' }}>
                  {formatCurrency(drawerStats ? drawerStats.totalAllottedAmount : (drawerProject.dividendsDistributed || 0))}
                </strong>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Remaining</div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                  {formatCurrency(drawerStats ? drawerStats.remainingBalance : ((drawerProject.totalDividendPool || 0) - (drawerProject.dividendsDistributed || 0)))}
                </strong>
              </div>
            </div>

            {/* Set Pool Input */}
            <div className="kfpl-input-group" style={{ marginBottom: '16px' }}>
              <label className="kfpl-input-label" style={{ fontSize: '0.75rem' }}>Configure / Increase Dividend Pool (₹)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  className="kfpl-input kfpl-input--sm"
                  placeholder="Enter pool amount"
                  value={drawerPoolInput}
                  onChange={e => setDrawerPoolInput(e.target.value)}
                  style={{ flex: 1, height: '36px', fontSize: '0.8125rem' }}
                />
                <button
                  type="button"
                  className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                  style={{ height: '36px', minWidth: '80px' }}
                  onClick={async () => {
                    const amt = parseFloat(drawerPoolInput);
                    if (isNaN(amt) || amt <= 0) {
                      addToast('Please enter a valid positive pool amount', 'error', 'Error');
                      return;
                    }

                    setSubmitting(true);
                    try {
                      // 1. Set pool in backend via POST /api/super-admin/dividends/pools
                      await apiRequest('/api/super-admin/dividends/pools', {
                        method: 'POST',
                        body: {
                          projectId: drawerProject.id,
                          poolAmount: amt,
                          name: `${drawerProject.name} Pool`,
                          remarks: 'Configured from project drawer'
                        }
                      });

                      // 2. Also keep compatibility PATCH call (failsafe)
                      const formDataToSend = new FormData();
                      formDataToSend.append('totalDividendPool', String(amt));
                      await apiRequest(`/api/super-admin/projects/${drawerProject.id}`, {
                        method: 'PATCH',
                        body: formDataToSend
                      }).catch(() => null);

                      // Update local storage cache
                      localStorage.setItem(`kfpl_project_dividend_pool_${drawerProject.id}`, String(amt));

                      await loadDashboardData();
                      
                      // Refresh drawer stats live
                      const statsRes = await apiRequest(`/api/super-admin/dividends/stats?projectId=${drawerProject.id}`).catch(() => null);
                      if (statsRes) {
                        const raw = statsRes.data || statsRes;
                        setDrawerStats({
                          totalPoolAmount: raw.totalPoolsConfigured || raw.totalPoolAmount || 0,
                          totalAllottedAmount: raw.dividendsDistributed || raw.totalAllottedAmount || 0,
                          remainingBalance: raw.remainingPoolsBalance || raw.remainingBalance || 0
                        });
                      }

                      setDrawerProject(prev => prev ? { ...prev, totalDividendPool: amt } : null);
                      addToast(`Dividend pool set to ${formatCurrency(amt)} for ${drawerProject.name}`, 'success', 'Success');
                    } catch (err) {
                      console.error('Failed to set project dividend pool:', err);
                      addToast(err.message || 'Failed to update dividend pool', 'error', 'Error');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {drawerProject.totalDividendPool > 0 ? 'Update' : 'Set Pool'}
                </button>
                {drawerProject.totalDividendPool > 0 && (
                  <button
                    type="button"
                    className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                    style={{ height: '36px', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        // 1. Reset pool to 0 via POST /api/super-admin/dividends/pools
                        await apiRequest('/api/super-admin/dividends/pools', {
                          method: 'POST',
                          body: {
                            projectId: drawerProject.id,
                            poolAmount: 0,
                            name: `${drawerProject.name} Pool Cleared`,
                            remarks: 'Cleared from project drawer'
                          }
                        });

                        // 2. Also keep compatibility PATCH call (failsafe)
                        const formDataToSend = new FormData();
                        formDataToSend.append('totalDividendPool', '0');
                        await apiRequest(`/api/super-admin/projects/${drawerProject.id}`, {
                          method: 'PATCH',
                          body: formDataToSend
                        }).catch(() => null);

                        localStorage.setItem(`kfpl_project_dividend_pool_${drawerProject.id}`, '0');
                        await loadDashboardData();
                        
                        setDrawerStats({
                          totalPoolAmount: 0,
                          totalAllottedAmount: 0,
                          remainingBalance: 0
                        });

                        setDrawerProject(prev => prev ? { ...prev, totalDividendPool: 0 } : null);
                        addToast(`Dividend pool cleared for ${drawerProject.name}`, 'success', 'Pool Cleared');
                      } catch (err) {
                        console.error('Failed to clear project dividend pool:', err);
                        addToast('Failed to clear dividend pool', 'error', 'Error');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    Clear Pool
                  </button>
                )}
              </div>
            </div>

            {/* Allotment Form (only if pool is set) */}
            {drawerProject.totalDividendPool > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', marginTop: '12px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                  Allot Dividend to Investor
                </h4>
                {projectInvestors.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontStyle: 'italic', textAlign: 'center', padding: '8px' }}>
                    No active investors found for this project.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="kfpl-input-group">
                      <label className="kfpl-input-label" style={{ fontSize: '0.7rem' }}>Select Client</label>
                      <select id="div-client-select" className="kfpl-select" style={{ height: '36px', fontSize: '0.8125rem', padding: '0 10px' }}>
                        <option value="">Choose investor...</option>
                        {projectInvestors.map(inv => {
                          const projectInvestments = (inv.investments || []).filter(subInv => String(subInv.projectId) === String(drawerProject.id));
                          const totalProjectAmt = projectInvestments.reduce((sum, subInv) => sum + (subInv.amount || 0), 0);
                          return (
                            <option key={inv.id} value={inv.clientId}>
                              {inv.name} ({inv.clientId} — Invested: {formatCurrency(totalProjectAmt)})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="kfpl-input-group">
                        <label className="kfpl-input-label" style={{ fontSize: '0.7rem' }}>Amount (₹)</label>
                        <input id="div-allot-amount" type="number" className="kfpl-input" placeholder="e.g. 50000" style={{ height: '36px', fontSize: '0.8125rem' }} />
                      </div>
                      <div className="kfpl-input-group">
                        <label className="kfpl-input-label" style={{ fontSize: '0.7rem' }}>Remarks / Note</label>
                        <input id="div-allot-note" type="text" className="kfpl-input" placeholder="e.g. Hit bonus" style={{ height: '36px', fontSize: '0.8125rem' }} />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                      style={{ marginTop: '6px' }}
                      disabled={submitting}
                      onClick={async () => {
                        const clientSelect = document.getElementById('div-client-select');
                        const amtInput = document.getElementById('div-allot-amount');
                        const noteInput = document.getElementById('div-allot-note');

                        const selectedClientId = clientSelect?.value;
                        const allotAmt = parseFloat(amtInput?.value);
                        const note = noteInput?.value || '';

                        if (!selectedClientId) {
                          addToast('Please select a client', 'error', 'Error');
                          return;
                        }
                        if (isNaN(allotAmt) || allotAmt <= 0) {
                          addToast('Please enter a valid allotment amount', 'error', 'Error');
                          return;
                        }

                        const selectedInv = investorList.find(inv => inv.clientId === selectedClientId);
                        if (!selectedInv) {
                          addToast('Selected client not found', 'error', 'Error');
                          return;
                        }

                        setSubmitting(true);
                        try {
                          await apiRequest('/api/super-admin/dividends/allotments', {
                            method: 'POST',
                            body: {
                              clientId: selectedInv.id,
                              projectId: drawerProject.id,
                              allottedAmount: allotAmt,
                              remarks: note || 'Project dividend distribution'
                            }
                          });
                          addToast(`Dividend of ${formatCurrency(allotAmt)} allotted successfully to ${selectedInv.name}`, 'success', 'Allotment Success');
                          await loadDashboardData();
                          // Refresh drawer metrics
                          setDrawerProject(prev => {
                            if (!prev) return null;
                            const currentDist = Number(prev.dividendsDistributed) || 0;
                            return {
                              ...prev,
                              dividendsDistributed: currentDist + allotAmt
                            };
                          });
                          if (amtInput) amtInput.value = '';
                          if (noteInput) noteInput.value = '';
                          if (clientSelect) clientSelect.value = '';
                        } catch (err) {
                          console.warn('Backend allotment failed, saving locally:', err);
                          
                          // Fallback local allotment
                          const localAllotmentItem = {
                            id: `local-al-${Date.now()}`,
                            projectName: drawerProject.name,
                            segment: drawerProject.segment,
                            clientName: selectedInv.name,
                            clientId: selectedInv.clientId,
                            amount: allotAmt,
                            creditDate: new Date().toISOString(),
                            adminNote: (note || 'Project dividend distribution') + ' (Local Sync)'
                          };

                          let localAllotments = [];
                          try {
                            const stored = localStorage.getItem('kfpl_local_allotments');
                            localAllotments = stored ? JSON.parse(stored) : [];
                          } catch {}

                          localAllotments.push(localAllotmentItem);
                          localStorage.setItem('kfpl_local_allotments', JSON.stringify(localAllotments));

                          addToast(`Allotted locally: ${formatCurrency(allotAmt)} for ${selectedInv.name}`, 'warning', 'Local Allotment');
                          
                          // Refresh drawer metrics locally
                          setDrawerProject(prev => {
                            if (!prev) return null;
                            const currentDist = Number(prev.dividendsDistributed) || 0;
                            return {
                              ...prev,
                              dividendsDistributed: currentDist + allotAmt
                            };
                          });
                          
                          await loadDashboardData();
                          if (amtInput) amtInput.value = '';
                          if (noteInput) noteInput.value = '';
                          if (clientSelect) clientSelect.value = '';
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      {submitting ? 'Allotting...' : 'Allot Dividend'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '24px' }}>
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => { setDrawerProject(null); openEditModal(drawerProject); }}>
              Edit Project
            </button>
            <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: 'var(--color-danger)' }} onClick={() => { setDrawerProject(null); setDeleteConfirm(drawerProject); }}>
              Delete
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );

  return (
    <div className="kfpl-page animate-fade-slide-up">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleMediaUpload} />

      {/* Header */}
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Portfolio Management</h2>
          <p className="kfpl-page-subtitle">Manage projects, segments, and media across the Kinetoscope portfolio</p>
        </div>
        <div className="kfpl-page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={openSegmentsManager}>
            Manage Segments
          </button>
          {canCreate('portfolio') && (
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={openAddModal}>
              + Add Project
            </button>
          )}
        </div>
      </div>

      {/* Page Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '24px', gap: '16px' }}>
        <button
          onClick={() => setActivePage('projects')}
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activePage === 'projects' ? '2px solid var(--color-gold)' : '2px solid transparent',
            color: activePage === 'projects' ? 'var(--color-gold)' : 'var(--color-text-muted)',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          Project Catalog
        </button>
        <button
          onClick={() => setActivePage('dividends')}
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activePage === 'dividends' ? '2px solid var(--color-gold)' : '2px solid transparent',
            color: activePage === 'dividends' ? 'var(--color-gold)' : 'var(--color-text-muted)',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          Dividend Ledger
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px' }}>
          <span className="kfpl-spinner" style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading portfolio data...</p>
        </div>
      ) : activePage === 'projects' ? (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="kfpl-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Total Projects</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{totalProjects}</div>
            </div>
            <div className="kfpl-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Active</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>{activeProjects}</div>
            </div>
            <div className="kfpl-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Segments</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-gold-dark)' }}>{segmentNames.length}</div>
            </div>
            <div className="kfpl-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Avg. Progress</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{avgProgress}%</div>
            </div>
          </div>

          {/* Segment Tabs */}
          <div className="kfpl-filter-chips" style={{ marginBottom: '20px', flexWrap: 'wrap' }}>
            {['All', ...segmentNames].map(tab => {
              const count = tab === 'All' ? projects.length : projects.filter(p => p.segment === tab).length;
              return (
                <span
                  key={tab}
                  className={`kfpl-filter-chip ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab} ({count})
                </span>
              );
            })}
          </div>

          {/* Project Cards Grid */}
          <div className="kfpl-portfolio-grid">
            {filteredProjects.length === 0 ? (
              <div className="kfpl-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
                No projects found in this segment
              </div>
            ) : filteredProjects.map(project => {
              const accent = SEGMENT_COLORS[project.segment] || '#10B981';
              const initials = SEGMENT_ABBR[project.segment] || project.name.slice(0, 2).toUpperCase();
              return (
                <div className="kfpl-portfolio-card" key={project.id} style={{ '--portfolio-accent': accent, cursor: 'pointer' }}
                  onClick={() => setDrawerProject(project)}
                >
                  <div className="kfpl-portfolio-card-media" style={{
                    backgroundImage: project.bannerImg ? `linear-gradient(rgba(6, 29, 19, 0.4), rgba(6, 29, 19, 0.8)), url(${project.bannerImg})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}>
                    <span className="kfpl-portfolio-card-initials">{initials}</span>
                    <span className="kfpl-portfolio-card-status">{project.health || 'On Track'}</span>
                  </div>

                  <div className="kfpl-portfolio-card-body">
                    <div className="kfpl-portfolio-card-topline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="kfpl-portfolio-segment">{project.segment}</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.6875rem' }}>
                          Min: <strong style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(project.minInvestment || 0)}</strong>
                        </span>
                        <span style={{ color: 'var(--color-gold)', fontWeight: 800, fontSize: '0.8125rem' }}>
                          Max: {project.targetFunding ? formatCurrency(project.targetFunding) : (project.value || '₹0')}
                        </span>
                      </div>
                    </div>

                    <h2>{project.name}</h2>
                    <p>{project.summary}</p>

                    <div className="kfpl-portfolio-metrics">
                      <div>
                        <span>Status</span>
                        <strong>{project.status}</strong>
                      </div>
                      <div>
                        <span>Monthly ROI</span>
                        <strong>{project.roi || '—'}</strong>
                      </div>
                      <div>
                        <span>Risk</span>
                        <strong>{project.risk || '—'}</strong>
                      </div>
                    </div>

                    <div className="kfpl-portfolio-progress-row">
                      <span>Milestone Progress</span>
                      <strong>{project.milestone}%</strong>
                    </div>
                    <div className="kfpl-progress">
                      <div className="kfpl-progress-fill" style={{ width: `${project.milestone}%` }} />
                    </div>

                    {/* Latest Status Update Note */}
                    {project.update && (
                      <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                          </svg>
                          LATEST UPDATE
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{project.update}</div>
                      </div>
                    )}

                    {/* Four Action Buttons: Update, Edit, Attach, Delete */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--color-border)', position: 'relative', zIndex: 10 }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => {
                          if (editId === project.id) {
                            setEditId(null);
                          } else {
                            setEditId(project.id);
                            setInlineStatus(project.status || '');
                            setInlineProgress(project.milestone || 0);
                            setUpdateNote('');
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Update
                      </button>

                      {canEdit('portfolio') && (
                        <button
                          type="button"
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          style={{ fontSize: '0.75rem', padding: '4px 10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => openEditModal(project)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                      )}

                      {canCreate('portfolio') && (
                        <button
                          type="button"
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          style={{ fontSize: '0.75rem', padding: '4px 10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => {
                            setUploadTarget(project.id);
                            setTimeout(() => fileInputRef.current?.click(), 50);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          Attach
                        </button>
                      )}

                      {canDelete('portfolio') && (
                        <button
                          type="button"
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          style={{ fontSize: '0.75rem', padding: '4px 10px', fontWeight: 700, color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => setDeleteConfirm(project)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Inline Quick Update Drawer Panel */}
                    {editId === project.id && (
                      <div style={{ marginTop: '12px', padding: '14px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '8px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '120px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Status</label>
                            <select
                              className="kfpl-select"
                              value={inlineStatus}
                              onChange={e => setInlineStatus(e.target.value)}
                              style={{ fontSize: '0.78rem', padding: '4px 8px', height: '32px' }}
                            >
                              {((segmentsConfig.find(s => s.name === project.segment)?.statuses) || ['Planning', 'In Production', 'Active', 'Ongoing', 'Completed']).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ width: '90px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Progress (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="kfpl-input"
                              value={inlineProgress}
                              onChange={e => setInlineProgress(e.target.value)}
                              style={{ fontSize: '0.78rem', padding: '4px 8px', height: '32px' }}
                            />
                          </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          <input type="checkbox" checked={isSegmentWidePost} onChange={(e) => setIsSegmentWidePost(e.target.checked)} style={{ cursor: 'pointer' }} />
                          Segment-wide update for <strong>{project.segment}</strong>
                        </label>
                        <textarea
                          className="kfpl-textarea"
                          value={updateNote}
                          onChange={(e) => setUpdateNote(e.target.value)}
                          placeholder="Write status note update..."
                          rows="2"
                          style={{ fontSize: '0.82rem', width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', outline: 'none', background: 'var(--color-background)', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => handlePostUpdate(project)} disabled={submitting} style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                            {submitting ? 'Publishing...' : 'Publish Update'}
                          </button>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => setEditId(null)} style={{ fontSize: '0.78rem' }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="animate-fade-slide-up">
          {/* Ledger Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="kfpl-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Total Pools Configured</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-gold-dark)' }}>
                {formatCurrency(dividendStats.totalPoolAmount)}
              </div>
            </div>
            <div className="kfpl-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Dividends Distributed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>
                {formatCurrency(dividendStats.totalAllottedAmount)}
              </div>
            </div>
            <div className="kfpl-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Remaining Pools Balance</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                {formatCurrency(dividendStats.remainingBalance)}
              </div>
            </div>
          </div>

          {/* Ledger Data Table */}
          <div className="kfpl-card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Allotment Ledger</h3>
            </div>
            <DataTable
              columns={[
                {
                  header: 'Project / Segment',
                  accessor: 'projectName',
                  render: (row) => (
                    <div>
                      <div className="kfpl-table-cell-primary">{row.projectName}</div>
                      <div className="kfpl-table-cell-secondary">{row.segment}</div>
                    </div>
                  )
                },
                {
                  header: 'Client Details',
                  accessor: 'clientName',
                  render: (row) => (
                    <div>
                      <div className="kfpl-table-cell-primary">{row.clientName}</div>
                      <div className="kfpl-table-cell-secondary">{row.clientId}</div>
                    </div>
                  )
                },
                {
                  header: 'Allotted Amount',
                  accessor: 'amount',
                  render: (row) => (
                    <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(row.amount || 0)}</strong>
                  )
                },
                {
                  header: 'Date of Allotment',
                  accessor: 'creditDate',
                  render: (row) => {
                    let formattedDate = '—';
                    try {
                      if (row.creditDate) {
                        const dateObj = new Date(row.creditDate);
                        if (!isNaN(dateObj.getTime())) {
                          formattedDate = dateObj.toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } else {
                          formattedDate = String(row.creditDate);
                        }
                      }
                    } catch (e) {
                      formattedDate = String(row.creditDate || '—');
                    }
                    return <span>{formattedDate}</span>;
                  }
                },
                {
                  header: 'Remarks / Notes',
                  accessor: 'adminNote',
                  render: (row) => (
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{row.adminNote || '—'}</span>
                  )
                },
                {
                  header: 'Actions',
                  render: (row) => {
                    return (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                          onClick={async () => {
                            const clientName = row.clientDetails?.name || row._resolvedClientName || 'Client';
                            if (!window.confirm(`Are you sure you want to delete this dividend allotment entry for ${clientName}?`)) {
                              return;
                            }
                            try {
                              if (String(row.id).startsWith('local-al-')) {
                                let localAllotments = [];
                                try {
                                  const stored = localStorage.getItem('kfpl_local_allotments');
                                  localAllotments = stored ? JSON.parse(stored) : [];
                                } catch {}
                                const updated = localAllotments.filter(al => al.id !== row.id);
                                localStorage.setItem('kfpl_local_allotments', JSON.stringify(updated));
                              } else {
                                await apiRequest(`/api/super-admin/dividends/allotments/${row.id}`, {
                                  method: 'DELETE'
                                });
                              }
                              addToast('Dividend allotment deleted successfully', 'success', 'Allotment Deleted');
                              loadDashboardData();
                            } catch (err) {
                              addToast(err.message || 'Failed to delete dividend allotment', 'error', 'Error');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  }
                }
              ]}
              data={dividends}
              searchPlaceholder="Search by client or project..."
            />
          </div>
        </div>
      )}

      {/* ═══════ Add / Edit Project Modal ═══════ */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingProject(null); resetForm(); }}
        title={editingProject ? 'Edit Project' : 'Add New Project'}
        size="lg"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" disabled={submitting} onClick={() => { setShowAddModal(false); setEditingProject(null); resetForm(); }}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" disabled={submitting} onClick={handleSaveProject}>
              {submitting ? 'Saving...' : (editingProject ? 'Update Project' : 'Add Project')}
            </button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '16px' }}>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Update Scope</label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="radio"
                  name="updateScope"
                  checked={!formData.isSegmentWide}
                  onChange={() => setFormData({ ...formData, isSegmentWide: false })}
                />
                Specific Project
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="radio"
                  name="updateScope"
                  checked={formData.isSegmentWide}
                  onChange={() => setFormData({ ...formData, isSegmentWide: true })}
                />
                Segment-Wide Update
              </label>
            </div>
          </div>

          {!formData.isSegmentWide && (
            <div className="kfpl-input-group animate-fade-slide-up">
              <label className="kfpl-input-label">Project Name <span className="required">*</span></label>
              <input type="text" className="kfpl-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Enter project name" />
            </div>
          )}

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Segment <span className="required">*</span></label>
              <select
                className="kfpl-select"
                value={formData.segment}
                onChange={e => {
                  const selectedSeg = e.target.value;
                  const segConfig = segmentsConfig.find(s => s.name === selectedSeg);
                  const defaultStatus = segConfig && segConfig.statuses.length > 0 ? segConfig.statuses[0] : '';
                  setFormData({ ...formData, segment: selectedSeg, status: defaultStatus });
                }}
              >
                <option value="">Select segment</option>
                {segmentNames.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__NEW__" style={{ fontStyle: 'italic', fontWeight: 'bold' }}>+ Add New Segment...</option>
              </select>
              {formData.segment === '__NEW__' && (
                <div className="animate-fade-slide-up" style={{ marginTop: '8px' }}>
                  <input
                    type="text"
                    className="kfpl-input"
                    placeholder="Enter custom segment name"
                    value={customSegmentText}
                    onChange={e => setCustomSegmentText(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Status</label>
              <select
                className="kfpl-select"
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                disabled={!formData.segment || formData.segment === '__NEW__'}
              >
                <option value="">Select status</option>
                {((segmentsConfig.find(s => s.name === formData.segment)?.statuses) || []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {formData.status && !((segmentsConfig.find(s => s.name === formData.segment)?.statuses) || []).includes(formData.status) && (
                  <option value={formData.status}>{formData.status} (Current)</option>
                )}
              </select>
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Min. Investment (₹)</label>
              <input type="number" className="kfpl-input" min="0" value={formData.minInvestment} onChange={e => setFormData({ ...formData, minInvestment: e.target.value })} placeholder="e.g. 200000" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Target Funding (₹)</label>
              <input type="number" className="kfpl-input" min="0" value={formData.targetFunding} onChange={e => setFormData({ ...formData, targetFunding: e.target.value })} placeholder="e.g. 25000000" />
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Funded Amount (₹)</label>
              <input type="number" className="kfpl-input" min="0" value={formData.fundedAmount} onChange={e => setFormData({ ...formData, fundedAmount: e.target.value })} placeholder="e.g. 15000000" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Milestone Progress (%)</label>
              <input type="number" className="kfpl-input" min="0" max="100" value={formData.milestone} onChange={e => setFormData({ ...formData, milestone: e.target.value })} />
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Total Slots</label>
              <input type="number" className="kfpl-input" min="1" value={formData.totalSlots} onChange={e => setFormData({ ...formData, totalSlots: e.target.value })} placeholder="20" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Slots Available</label>
              <input type="number" className="kfpl-input" min="0" value={formData.slotsAvailable} onChange={e => setFormData({ ...formData, slotsAvailable: e.target.value })} placeholder="20" />
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Investment Horizon (Duration)</label>
              <input
                type="text"
                className="kfpl-input"
                value={formData.horizon}
                onChange={e => setFormData({ ...formData, horizon: e.target.value })}
                placeholder="e.g. 12 Months, Q4 2025"
              />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Monthly ROI</label>
              <input
                type="text"
                className="kfpl-input"
                value={formData.roi}
                onChange={e => setFormData({ ...formData, roi: e.target.value })}
                placeholder="e.g. 1.25%"
              />
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Risk Level</label>
              <select className="kfpl-select" value={formData.risk} onChange={e => setFormData({ ...formData, risk: e.target.value })}>
                {['Low', 'Medium', 'Medium High', 'High'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Health</label>
              <select className="kfpl-select" value={formData.health} onChange={e => setFormData({ ...formData, health: e.target.value })}>
                {['On Track', 'Active', 'Performing', 'Building', 'Planned', 'At Risk', 'Completed'].map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Project Banner Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    setSelectedFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setFormData(prev => ({ ...prev, bannerImg: ev.target.result }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="kfpl-input"
                  style={{ flex: 1 }}
                />
                {formData.bannerImg && (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={formData.bannerImg}
                      alt="Banner Preview"
                      style={{ width: 60, height: 40, borderRadius: 4, objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, bannerImg: '' });
                        setSelectedFile(null);
                      }}
                      style={{
                        position: 'absolute', top: -6, right: -6, background: 'var(--color-danger)',
                        color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Summary</label>
            <textarea className="kfpl-textarea" value={formData.summary} onChange={e => setFormData({ ...formData, summary: e.target.value })} placeholder="Brief project description..." rows="2" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Current Update</label>
              <textarea className="kfpl-textarea" value={formData.update} onChange={e => setFormData({ ...formData, update: e.target.value })} placeholder="e.g. Principal photography completed..." rows="2" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Allocation Focus</label>
              <textarea className="kfpl-textarea" value={formData.allocation} onChange={e => setFormData({ ...formData, allocation: e.target.value })} placeholder="e.g. Film production, talent..." rows="2" />
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══════ Delete Confirmation Modal ═══════ */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
        size="sm"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleDeleteProject(deleteConfirm.id)}>Delete Project</button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.
        </p>
      </Modal>

      {/* ═══════ Manage Segments & Statuses Modal ═══════ */}
      <Modal
        isOpen={showSegmentsManagerModal}
        onClose={() => setShowSegmentsManagerModal(false)}
        title="Manage Segments & Statuses"
        size="lg"
        footer={
          <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowSegmentsManagerModal(false)}>Close</button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Deletion confirmation panel */}
          {deleteSegConfirmIdx !== null && (
            <div style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-danger)',
              borderRadius: '8px',
              animation: 'fadeIn 0.2s'
            }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: 'var(--color-danger)', fontWeight: 500 }}>
                Are you sure you want to delete segment <strong>{segmentsConfig[deleteSegConfirmIdx]?.name}</strong>?
                {projects.some(p => p.segment === segmentsConfig[deleteSegConfirmIdx]?.name) && (
                  <span> <br /><strong>Warning:</strong> Existing projects under this segment will remain, but their segment mapping will be unmanaged.</span>
                )}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="kfpl-btn kfpl-btn--sm"
                  style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)', color: '#fff' }}
                  onClick={confirmDeleteSegment}
                >
                  Yes, Delete
                </button>
                <button
                  className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                  onClick={() => setDeleteSegConfirmIdx(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Left Column: Segments List */}
            <div style={{ borderRight: '1px solid var(--color-border)', paddingRight: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                Existing Segments
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '6px' }}>
                {segmentsConfig.map((seg, idx) => (
                  <div key={seg.name} style={{
                    padding: '12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{seg.name}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          style={{ padding: '2px 8px', minWidth: 'auto' }}
                          onClick={() => handleEditSegment(idx)}
                        >
                          Edit
                        </button>
                        <button
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          style={{ padding: '2px 8px', minWidth: 'auto', color: 'var(--color-danger)' }}
                          onClick={() => setDeleteSegConfirmIdx(idx)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {seg.statuses.map(status => (
                        <span key={status} style={{
                          fontSize: '0.6875rem',
                          padding: '2px 6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '4px',
                          color: 'var(--color-text-muted)'
                        }}>
                          {status}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Add / Edit Form */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 700 }}>
                {editingSegmentIndex !== null ? `Edit Segment: ${segmentsConfig[editingSegmentIndex].name}` : 'Add New Segment'}
              </h4>

              <div className="kfpl-form" style={{ gap: '12px' }}>
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Segment Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="kfpl-input"
                    placeholder="e.g. Music, Film Making"
                    value={segmentFormName}
                    onChange={e => setSegmentFormName(e.target.value)}
                  />
                </div>

                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Statuses <span className="required">*</span></label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      className="kfpl-input"
                      placeholder="Add status (e.g. Planning)"
                      value={newStatusText}
                      onChange={e => setNewStatusText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddStatusTag();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button type="button" className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={handleAddStatusTag}>
                      Add
                    </button>
                  </div>

                  {/* Status tags container */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    minHeight: '80px',
                    padding: '10px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    alignContent: 'flex-start'
                  }}>
                    {segmentFormStatuses.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No statuses added yet. Type above and click Add.
                      </span>
                    ) : (
                      segmentFormStatuses.map(status => (
                        <span key={status} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '16px',
                          color: '#10B981',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          {status}
                          <button
                            type="button"
                            onClick={() => handleRemoveStatusTag(status)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-danger)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              padding: '0 2px',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button type="button" className="kfpl-btn kfpl-btn--primary" disabled={submitting} onClick={handleSaveSegmentConfig}>
                    {submitting ? 'Saving...' : (editingSegmentIndex !== null ? 'Save Changes' : 'Create Segment')}
                  </button>
                  {editingSegmentIndex !== null && (
                    <button type="button" className="kfpl-btn kfpl-btn--ghost" onClick={() => {
                      setEditingSegmentIndex(null);
                      setSegmentFormName('');
                      setSegmentFormStatuses([]);
                      setNewStatusText('');
                    }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </Modal>

      {/* ═══════ Configure Dividend Pool Modal ═══════ */}
      <Modal
        isOpen={showAddPoolModal}
        onClose={() => { setShowAddPoolModal(false); setPoolForm({ name: '', poolAmount: '', remarks: '' }); setEditingPoolId(null); }}
        title={editingPoolId ? "Edit Dividend Pool" : "Configure Dividend Pool"}
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" disabled={submitting} onClick={() => { setShowAddPoolModal(false); setPoolForm({ name: '', poolAmount: '', remarks: '' }); setEditingPoolId(null); }}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" disabled={submitting} onClick={handleSavePool}>
              {submitting ? 'Saving...' : (editingPoolId ? 'Save Changes' : 'Configure Pool')}
            </button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '16px' }}>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Pool Name <span className="required">*</span></label>
            <input
              type="text"
              className="kfpl-input"
              value={poolForm.name}
              onChange={e => setPoolForm({ ...poolForm, name: e.target.value })}
              placeholder="e.g. Q3 Milestone Pool"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Pool Amount (₹) <span className="required">*</span></label>
            <input
              type="number"
              className="kfpl-input"
              value={poolForm.poolAmount}
              onChange={e => setPoolForm({ ...poolForm, poolAmount: e.target.value })}
              placeholder="e.g. 500000"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Remarks / Description</label>
            <textarea
              className="kfpl-textarea"
              value={poolForm.remarks}
              onChange={e => setPoolForm({ ...poolForm, remarks: e.target.value })}
              placeholder="Enter remarks..."
              rows="3"
            />
          </div>
        </div>
      </Modal>

      {drawer}
    </div>
  );
}

/* ============ END: PortfolioManagement.jsx ============ */
