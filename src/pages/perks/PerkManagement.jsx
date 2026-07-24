import { useState, useEffect, useMemo } from 'react';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';

// ── SVG Tier Icons ───────────────────────
const TierIcons = {
  silver: (props = {}) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke={props.color || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" /><path d="M9 18l3-6 3 6" /><path d="M8 22h8" /><path d="M12 18v4" />
    </svg>
  ),
  gold: (props = {}) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke={props.color || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  platinum: (props = {}) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke={props.color || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z" /><path d="M2 9h20" /><path d="M10 9l2-6 2 6" /><path d="M6 9l6 13 6-13" />
    </svg>
  ),
  diamond: (props = {}) => (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke={props.color || 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12l5-8h10l5 8-10 10L2 12z" /><path d="M7 4l5 8M17 4l-5 8M2 12h20" />
    </svg>
  ),
};

// ── Tier Config ───────────────────────
const tierConfig = {
  silver: { gradient: 'linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 100%)', icon: TierIcons.silver, bg: 'rgba(192, 192, 192, 0.08)', color: '#9CA3AF' },
  gold: { gradient: 'linear-gradient(135deg, #F5E6C0 0%, #C9A84C 100%)', icon: TierIcons.gold, bg: 'rgba(201, 168, 76, 0.08)', color: '#C9A84C' },
  platinum: { gradient: 'linear-gradient(135deg, #E5E8EB 0%, #8FA3B8 100%)', icon: TierIcons.platinum, bg: 'rgba(143, 163, 184, 0.06)', color: '#8FA3B8' },
  diamond: { gradient: 'linear-gradient(135deg, #E0F7FA 0%, #4DD0E1 100%)', icon: TierIcons.diamond, bg: 'rgba(77, 208, 225, 0.06)', color: '#4DD0E1' },
};

const renderTierIcon = (tierObj, size = 16) => {
  if (!tierObj || !tierObj.icon) return null;
  if (typeof tierObj.icon === 'function') {
    return tierObj.icon({ size, color: tierObj.color });
  }
  return tierObj.icon;
};

// ── Perk Icons by name ───────────────────────
const perkIcons = {
  'Priority Support': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  'Annual Gala Invite': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  'Quarterly Review': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  'Film Set Visit': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" /></svg>,
  'Premiere Tickets': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="2" y1="12" x2="22" y2="12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>,
  'Tax Advisory': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
};

const defaultIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>;

// ── SVG Icons ───────────────────────
const icons = {
  star: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  assigned: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="14" height="14"><polyline points="20 6 9 17 4 12" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  revoke: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
};

/* Description Formatter for Multi-line / Bullet Point Texts */
const renderFormattedDescription = (desc) => {
  if (!desc) return null;
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 1 && !lines[0].endsWith(':') && !lines[0].includes('•')) {
    return (
      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '3px', lineHeight: 1.4 }}>
        {desc}
      </span>
    );
  }

  return (
    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
      {lines.map((line, idx) => {
        const isHeader = line.endsWith(':') || line.toLowerCase().includes('points:') || line.toLowerCase().includes('includes:');
        if (isHeader) {
          return (
            <div key={idx} style={{ fontWeight: 700, color: 'var(--color-navy)', marginTop: idx > 0 ? '8px' : '3px', marginBottom: '4px', fontSize: '0.825rem' }}>
              {line}
            </div>
          );
        }

        const isFirstIntro = idx === 0 && !line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*') && !/^\d+\./.test(line);
        if (isFirstIntro) {
          return (
            <div key={idx} style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', marginBottom: '6px', lineHeight: 1.4 }}>
              {line}
            </div>
          );
        }

        const cleanText = line.replace(/^[•\-\*\d+\.]+\s*/, '');
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '3px', paddingLeft: '4px' }}>
            <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '0.8rem', lineHeight: '1.3' }}>✓</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', lineHeight: 1.35 }}>{cleanText}</span>
          </div>
        );
      })}
    </div>
  );
};

// Persistent SWR cache store key
const CACHE_KEY = 'kfpl_perks_dashboard_cache';

const getInitialCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read perks cache:', e);
  }
  return null;
};

export default function PerkManagement() {
  const addToast = useToast();
  const [activeTab, setActiveTab] = useState('library');
  const [showAssign, setShowAssign] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [assignForm, setAssignForm] = useState({ selectedClients: [], perkId: '' });
  const [clientSearch, setClientSearch] = useState('');
  const [newPerk, setNewPerk] = useState({ name: '', description: '', tier: 'silver', minInvestment: '' });
  const [editingPerk, setEditingPerk] = useState(null);
  const [deletePerkConfirm, setDeletePerkConfirm] = useState(null);

  // Initialize state synchronously from localStorage cache for INSTANT 0ms render
  const initialCache = getInitialCache();
  const [perksList, setPerksList] = useState(initialCache?.perksList || []);
  const [clientsList, setClientsList] = useState(initialCache?.clientsList || []);
  const [assignedPerks, setAssignedPerks] = useState(initialCache?.assignedPerks || []);
  const [loading, setLoading] = useState(!initialCache || !initialCache.perksList || initialCache.perksList.length === 0);

  const [assignedSearch, setAssignedSearch] = useState('');
  const [assignedFilterPerk, setAssignedFilterPerk] = useState('');
  const [assignedFilterTier, setAssignedFilterTier] = useState('');

  // Helper response parser
  const extractPerks = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.perks && Array.isArray(res.perks)) return res.perks;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (res.data.perks && Array.isArray(res.data.perks)) return res.data.perks;
    }
    for (const key of Object.keys(res)) {
      if (Array.isArray(res[key])) return res[key];
    }
    return [];
  };

  const extractAssignments = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.assignments && Array.isArray(res.assignments)) return res.assignments;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (res.data.assignments && Array.isArray(res.data.assignments)) return res.data.assignments;
    }
    for (const key of Object.keys(res)) {
      if (Array.isArray(res[key])) return res[key];
    }
    return [];
  };

  const extractClients = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.clients && Array.isArray(res.clients)) return res.clients;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (res.data.clients && Array.isArray(res.data.clients)) return res.data.clients;
    }
    for (const key of Object.keys(res)) {
      if (Array.isArray(res[key])) return res[key];
    }
    return [];
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Load all dashboard records dynamically with Promise.all and SWR pattern
  const loadData = async (isInitial = false) => {
    // Only show loading spinner if we have NO cached data at all
    if (isInitial && (!initialCache || !initialCache.perksList || initialCache.perksList.length === 0)) {
      setLoading(true);
    }
    try {
      // Parallel API Execution using Promise.all for maximum concurrency
      const [perksRes, assignmentsRes, clientsRes] = await Promise.all([
        apiRequest('/api/super-admin/perks'),
        apiRequest('/api/super-admin/perks/assignments'),
        apiRequest('/api/super-admin/clients')
      ]);

      // Mapped perks definitions list
      const rawPerks = extractPerks(perksRes);
      const mappedPerks = rawPerks.map(p => ({
        id: p._id || p.id,
        name: p.title || p.name || '',
        description: p.description || '',
        tier: (p.tier || 'silver').toLowerCase(),
        minInvestment: p.minInvestment || 0,
        status: p.status || 'active',
      }));

      // Mapped assignments list
      const rawAssignments = extractAssignments(assignmentsRes);
      const mappedAssignments = rawAssignments.map(ap => {
        const clientObj = ap.client || {};
        const perkObj = ap.perk || {};
        return {
          id: ap._id || ap.id,
          investorId: clientObj._id || clientObj.id || '',
          investorName: clientObj.fullName || clientObj.name || 'Unknown Client',
          clientId: clientObj.clientId || '—',
          perkId: perkObj._id || perkObj.id || '',
          perkName: perkObj.title || perkObj.name || 'Unknown Perk',
          tier: (perkObj.tier || 'silver').toLowerCase(),
          assignedAt: ap.assignedAt || new Date().toISOString(),
          status: ap.status || 'active',
        };
      });

      // Mapped active clients list for selectors
      const rawClients = extractClients(clientsRes);
      const mappedClients = rawClients.map((c, index) => {
        const profile = c.profile || {};
        const user = (c.userId && typeof c.userId === 'object' ? c.userId : null) ||
          (c.user && typeof c.user === 'object' ? c.user : null) || {};
        const name = profile.fullName || user.name || user.fullName || c.fullName || c.name || 'Client';

        const id = c._id || c.id || user._id || profile.userId || `client-idx-${index}`;
        const clientId = c.clientId || profile.clientId || `KFPL-CL-${1000 + index}`;
        return {
          id: String(id),
          name,
          clientId,
          category: c.category || profile.riskProfile || 'Silver',
          status: c.status || 'Active'
        };
      });

      // Update state and persistent cache
      setPerksList(mappedPerks);
      setAssignedPerks(mappedAssignments);
      setClientsList(mappedClients);

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          perksList: mappedPerks,
          assignedPerks: mappedAssignments,
          clientsList: mappedClients,
        }));
      } catch (e) {
        console.error('Failed to save perks cache:', e);
      }

    } catch (err) {
      console.error('Failed to load Perks & Recognition dashboard data:', err);
      addToast('Failed to load perks configuration from API', 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  // ── Handle Assign Perk (multi-client batch POST) ──
  const handleAssign = async () => {
    if (!assignForm.perkId || assignForm.selectedClients.length === 0 || isAssigning) return;
    setIsAssigning(true);
    try {
      await apiRequest('/api/super-admin/perks/assign', {
        method: 'POST',
        body: JSON.stringify({
          perkId: assignForm.perkId,
          clientIds: assignForm.selectedClients,
        })
      });
      addToast('Perk assigned successfully to selected clients', 'success', 'Assigned');
      setShowAssign(false);
      setAssignForm({ selectedClients: [], perkId: '' });
      setClientSearch('');
      await loadData();
    } catch (err) {
      console.error('Failed to assign perk:', err);
      addToast(err.message || 'Failed to assign perk', 'error', 'Error');
    } finally {
      setIsAssigning(false);
    }
  };

  // ── Handle Revoke Assignment (DELETE with Optimistic Update) ──
  const handleRevoke = async (assignmentId) => {
    // Optimistic update
    setAssignedPerks(prev => prev.map(ap => ap.id === assignmentId ? { ...ap, status: 'revoked' } : ap));
    try {
      await apiRequest(`/api/super-admin/perks/assignments/${assignmentId}`, {
        method: 'DELETE'
      });
      addToast('Perk assignment revoked successfully', 'info', 'Perk Revoked');
    } catch (err) {
      console.error('Failed to revoke perk assignment:', err);
      addToast(err.message || 'Failed to revoke perk assignment', 'error', 'Error');
      await loadData();
    }
  };

  // ── Handle Add Perk Definition (POST) ──
  const handleAddPerk = async () => {
    if (!newPerk.name || isSubmittingAdd) return;
    setIsSubmittingAdd(true);
    try {
      await apiRequest('/api/super-admin/perks', {
        method: 'POST',
        body: JSON.stringify({
          title: newPerk.name.trim(),
          description: newPerk.description.trim(),
          tier: newPerk.tier.toUpperCase(),
          minInvestment: Number(newPerk.minInvestment) || 0,
          status: 'active'
        })
      });
      addToast('New perk created successfully', 'success', 'Perk Created');
      setShowAdd(false);
      setNewPerk({ name: '', description: '', tier: '', minInvestment: '' });
      await loadData();
    } catch (err) {
      console.error('Failed to create perk:', err);
      addToast(err.message || 'Failed to create perk', 'error', 'Error');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // ── Handle Edit Perk Modal & Submit (PATCH) ──
  const openEditModal = (perk) => {
    setEditingPerk({
      id: perk.id,
      name: perk.name,
      description: perk.description,
      tier: perk.tier,
      minInvestment: perk.minInvestment,
      status: perk.status,
    });
    setShowEdit(true);
  };

  const handleUpdatePerk = async () => {
    if (!editingPerk || !editingPerk.name || isSubmittingEdit) return;
    setIsSubmittingEdit(true);
    try {
      await apiRequest(`/api/super-admin/perks/${editingPerk.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editingPerk.name.trim(),
          description: editingPerk.description.trim(),
          tier: editingPerk.tier.toUpperCase(),
          minInvestment: Number(editingPerk.minInvestment) || 0,
          status: editingPerk.status || 'active',
        })
      });
      addToast('Perk definition updated successfully', 'success', 'Updated');
      setShowEdit(false);
      setEditingPerk(null);
      await loadData();
    } catch (err) {
      console.error('Failed to update perk:', err);
      addToast(err.message || 'Failed to update perk', 'error', 'Error');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // ── Handle Delete Perk Definition (DELETE with Instant Optimistic UI) ──
  const openDeleteConfirm = (perk) => {
    setDeletePerkConfirm(perk);
  };

  const handleDeletePerk = async () => {
    if (!deletePerkConfirm || isDeleting) return;
    const targetPerk = deletePerkConfirm;
    const targetId = targetPerk.id;
    setIsDeleting(true);

    // Optimistically update UI immediately for instant user feedback
    const updatedPerks = perksList.filter(p => p.id !== targetId);
    const updatedAssignments = assignedPerks.filter(ap => ap.perkId !== targetId);
    setPerksList(updatedPerks);
    setAssignedPerks(updatedAssignments);
    setDeletePerkConfirm(null);

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        perksList: updatedPerks,
        assignedPerks: updatedAssignments,
        clientsList,
      }));
    } catch (e) {}

    try {
      await apiRequest(`/api/super-admin/perks/${targetId}`, {
        method: 'DELETE',
      });
      addToast(`Perk "${targetPerk.name}" deleted successfully`, 'success', 'Deleted');
    } catch (err) {
      console.error('Failed to delete perk:', err);
      addToast(err.message || 'Failed to delete perk', 'error', 'Error');
      // Revert state on failure
      await loadData();
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Client toggle in assign modal ──
  const toggleClient = (clientId) => {
    setAssignForm(prev => ({
      ...prev,
      selectedClients: prev.selectedClients.includes(clientId)
        ? prev.selectedClients.filter(id => id !== clientId)
        : [...prev.selectedClients, clientId],
    }));
  };

  const selectAllFiltered = (filteredClients) => {
    const allIds = filteredClients.map(c => String(c.id));
    const allSelected = allIds.every(id => assignForm.selectedClients.includes(id));
    if (allSelected) {
      setAssignForm(prev => ({
        ...prev,
        selectedClients: prev.selectedClients.filter(id => !allIds.includes(id)),
      }));
    } else {
      setAssignForm(prev => ({
        ...prev,
        selectedClients: [...new Set([...prev.selectedClients, ...allIds])],
      }));
    }
  };

  // ── Filtered clients for assign modal ──
  const filteredClients = useMemo(() => {
    return clientsList.filter(i => {
      const status = i.status || 'Active';
      if (status.toLowerCase() !== 'active') return false;
      if (!clientSearch) return true;
      const q = clientSearch.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.clientId.toLowerCase().includes(q);
    });
  }, [clientsList, clientSearch]);

  // ── Filtered assigned perks for table ──
  const filteredAssigned = useMemo(() => {
    return assignedPerks.filter(ap => {
      if (assignedFilterPerk && ap.perkName !== assignedFilterPerk) return false;
      if (assignedFilterTier && ap.tier !== assignedFilterTier) return false;
      if (assignedSearch) {
        const q = assignedSearch.toLowerCase();
        if (!ap.investorName.toLowerCase().includes(q) && !ap.clientId.toLowerCase().includes(q) && !ap.perkName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [assignedPerks, assignedSearch, assignedFilterPerk, assignedFilterTier]);

  const activePerks = perksList.filter(p => p.status === 'active').length;
  const inactivePerks = perksList.filter(p => p.status !== 'active').length;
  const totalAssigned = assignedPerks.filter(ap => ap.status === 'active').length;

  if (loading && perksList.length === 0) {
    return (
      <div className="kfpl-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div className="kfpl-loading-spinner" />
      </div>
    );
  }

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Perks & Recognition</h2>
          <p className="kfpl-page-subtitle">Manage perk definitions and assign to clients</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => setShowAssign(true)}>
            {icons.star}
            Assign Perk
          </button>
          <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => setShowAdd(true)}>
            {icons.plus}
            Add Perk
          </button>
        </div>
      </div>

      {/* ═══════ Tabs ═══════ */}
      <div className="kfpl-tabs">
        <button className={`kfpl-tab ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
          {icons.library}
          Perks Library
        </button>
        <button className={`kfpl-tab ${activeTab === 'assigned' ? 'active' : ''}`} onClick={() => setActiveTab('assigned')}>
          {icons.assigned}
          Assigned Perks
          {totalAssigned > 0 && <span className="kfpl-perk-tab-count">{totalAssigned}</span>}
        </button>
      </div>

      {/* ═══════ Tab: Perks Library ═══════ */}
      {activeTab === 'library' && (
        <>
          {/* Stats Strip */}
          <div className="kfpl-perks-stats">
            <div className="kfpl-perks-stat">
              <span className="kfpl-perks-stat-num">{perksList.length}</span>
              <span className="kfpl-perks-stat-label">Total Perks</span>
            </div>
            <div className="kfpl-perks-stat">
              <span className="kfpl-perks-stat-num" style={{ color: 'var(--color-success)' }}>{activePerks}</span>
              <span className="kfpl-perks-stat-label">Active</span>
            </div>
            <div className="kfpl-perks-stat">
              <span className="kfpl-perks-stat-num" style={{ color: 'var(--color-text-muted)' }}>{inactivePerks}</span>
              <span className="kfpl-perks-stat-label">Inactive</span>
            </div>
            <div className="kfpl-perks-stat">
              <span className="kfpl-perks-stat-num" style={{ color: 'var(--color-gold-dark)' }}>4</span>
              <span className="kfpl-perks-stat-label">Tiers</span>
            </div>
          </div>

          {/* Perks Grid — Premium Cards */}
          {perksList.length === 0 ? (
            <div className="kfpl-form-card" style={{ padding: '60px 20px', textAlign: 'center', margin: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--color-surface-hover, #F3F4F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold-dark, #C9A84C)' }}>
                {icons.star}
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-navy, #0F172A)', margin: 0 }}>No Perks in Library</h3>
              <p style={{ color: 'var(--color-text-muted, #64748B)', fontSize: '0.875rem', margin: 0, maxWidth: '400px' }}>Create a new perk definition to make it available for assigning to clients.</p>
              <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ marginTop: '8px' }} onClick={() => setShowAdd(true)}>
                {icons.plus}
                Add First Perk
              </button>
            </div>
          ) : (
            <div className="kfpl-perks-grid">
              {perksList.map(perk => {
                const tierKey = (perk.tier || 'silver').toLowerCase();
                const tier = tierConfig[tierKey] || tierConfig.silver;
                return (
                  <div className="kfpl-perk-card" key={perk.id} style={{ '--tier-bg': tier.bg }}>
                    {/* Tier stripe */}
                    <div className="kfpl-perk-tier-stripe" style={{ background: tier.gradient }} />

                    {/* Header */}
                    <div className="kfpl-perk-card-header">
                      <div className="kfpl-perk-icon-wrap" style={{ background: tier.bg }}>
                        {perkIcons[perk.name] || defaultIcon}
                      </div>
                      <div className="kfpl-perk-card-badges" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <Badge status={perk.status}>{perk.status}</Badge>
                        <div className="kfpl-perk-actions-mini" style={{ display: 'flex', gap: '6px', marginLeft: '8px' }}>
                          <button onClick={() => openEditModal(perk)} title="Edit perk" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" /></svg>
                          </button>
                          <button onClick={() => openDeleteConfirm(perk)} title="Delete perk" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#ef4444', display: 'inline-flex', alignItems: 'center' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Body */}
                    <div className="kfpl-perk-card-body">
                      <h4 className="kfpl-perk-card-title">{perk.name}</h4>
                      <div className="kfpl-perk-card-desc">{renderFormattedDescription(perk.description)}</div>
                    </div>

                    {/* Footer */}
                    <div className="kfpl-perk-card-footer">
                      <div className="kfpl-perk-tier-badge">
                        <span className="kfpl-perk-tier-icon">{renderTierIcon(tier, 14)}</span>
                        <Badge status={tierKey}>{perk.tier} tier</Badge>
                      </div>
                      <div className="kfpl-perk-min">
                        <span className="kfpl-perk-min-label">Min Investment</span>
                        <span className="kfpl-perk-min-value">{formatCurrency(perk.minInvestment)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════ Tab: Assigned Perks ═══════ */}
      {activeTab === 'assigned' && (
        <>
          {/* Assigned Perks Stats */}
          <div className="kfpl-perks-stats">
            <div className="kfpl-perks-stat">
              <span className="kfpl-perks-stat-num">{assignedPerks.length}</span>
              <span className="kfpl-perks-stat-label">Total Assignments</span>
            </div>
            <div className="kfpl-perks-stat">
              <span className="kfpl-perks-stat-num" style={{ color: 'var(--color-success)' }}>{totalAssigned}</span>
              <span className="kfpl-perks-stat-label">Active</span>
            </div>
            <div className="kfpl-perks-stat">
              <span className="kfpl-perks-stat-num" style={{ color: 'var(--color-danger, #ef4444)' }}>{assignedPerks.filter(a => a.status === 'revoked').length}</span>
              <span className="kfpl-perks-stat-label">Revoked</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="kfpl-assigned-filters">
            <div className="kfpl-assigned-search-wrap">
              {icons.search}
              <input
                type="text"
                className="kfpl-assigned-search"
                placeholder="Search by client name, ID, or perk…"
                value={assignedSearch}
                onChange={e => setAssignedSearch(e.target.value)}
              />
            </div>
            <select className="kfpl-select kfpl-assigned-filter-select" value={assignedFilterPerk} onChange={e => setAssignedFilterPerk(e.target.value)}>
              <option value="">All Perks</option>
              {perksList.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select className="kfpl-select kfpl-assigned-filter-select" value={assignedFilterTier} onChange={e => setAssignedFilterTier(e.target.value)}>
              <option value="">All Tiers</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
              <option value="diamond">Diamond</option>
            </select>
          </div>

          {/* Assigned Perks Table */}
          <div className="kfpl-table-container">
            <div className="kfpl-table-scroll">
              <table className="kfpl-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Client</th>
                    <th>Client ID</th>
                    <th>Perk Name</th>
                    <th>Tier</th>
                    <th>Assigned Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssigned.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                        No assigned perks found
                      </td>
                    </tr>
                  ) : (
                    filteredAssigned.map((ap, idx) => {
                      const tier = tierConfig[ap.tier] || tierConfig.silver;
                      return (
                        <tr key={ap.id} className={ap.status === 'revoked' ? 'kfpl-row-revoked' : ''}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="kfpl-assigned-client-cell">
                              <div className="kfpl-assigned-client-avatar" style={{ background: tier.gradient }}>
                                {ap.investorName.charAt(0)}
                              </div>
                              <span className="kfpl-assigned-client-name">{ap.investorName}</span>
                            </div>
                          </td>
                          <td><span className="kfpl-client-id-tag">{ap.clientId}</span></td>
                          <td>
                            <div className="kfpl-assigned-perk-cell">
                              <span className="kfpl-assigned-perk-icon-mini" style={{ background: tier.bg }}>
                                {perkIcons[ap.perkName] || defaultIcon}
                              </span>
                              {ap.perkName}
                            </div>
                          </td>
                          <td><Badge status={ap.tier}>{ap.tier}</Badge></td>
                          <td>{new Date(ap.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td><Badge status={ap.status === 'active' ? 'active' : 'inactive'}>{ap.status}</Badge></td>
                          <td>
                            {ap.status === 'active' ? (
                              <button className="kfpl-btn kfpl-btn--danger-ghost kfpl-btn--xs" onClick={() => handleRevoke(ap.id)} title="Revoke perk">
                                {icons.revoke}
                                Revoke
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════ Assign Perk Modal (Multi-Client) ═══════ */}
      <Modal
        isOpen={showAssign}
        onClose={() => { setShowAssign(false); setAssignForm({ selectedClients: [], perkId: '' }); setClientSearch(''); }}
        title="Assign Perk to Clients"
        size="lg"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => { setShowAssign(false); setAssignForm({ selectedClients: [], perkId: '' }); setClientSearch(''); }} disabled={isAssigning}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleAssign} disabled={assignForm.selectedClients.length === 0 || !assignForm.perkId || isAssigning}>
              {isAssigning ? 'Assigning...' : `Assign to ${assignForm.selectedClients.length} Client${assignForm.selectedClients.length !== 1 ? 's' : ''}`}
            </button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '20px' }}>
          {/* Perk Selector */}
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Select Perk <span className="required">*</span></label>
            <select className="kfpl-select" value={assignForm.perkId} onChange={(e) => setAssignForm(prev => ({ ...prev, perkId: e.target.value }))}>
              <option value="">Choose perk to assign</option>
              {perksList.filter(p => p.status === 'active').map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.tier} tier)</option>
              ))}
            </select>
          </div>

          {/* Multi-Client Selector */}
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">
              Select Clients <span className="required">*</span>
              {assignForm.selectedClients.length > 0 && (
                <span className="kfpl-assign-selected-count">{assignForm.selectedClients.length} selected</span>
              )}
            </label>

            {/* Search Bar */}
            <div className="kfpl-client-search-box">
              {icons.search}
              <input
                type="text"
                placeholder="Search clients by name or ID…"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="kfpl-client-search-input"
              />
            </div>

            {/* Select All / Deselect All */}
            <div className="kfpl-client-select-actions">
              <button type="button" className="kfpl-btn kfpl-btn--ghost kfpl-btn--xs" onClick={() => selectAllFiltered(filteredClients)}>
                {filteredClients.every(c => assignForm.selectedClients.includes(String(c.id))) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Client List (scrollable) */}
            <div className="kfpl-client-checklist">
              {filteredClients.length === 0 ? (
                <div className="kfpl-client-checklist-empty">No active clients found</div>
              ) : (
                filteredClients.map(inv => {
                  const isSelected = assignForm.selectedClients.includes(String(inv.id));
                  const alreadyHas = assignForm.perkId && assignedPerks.some(
                    ap => String(ap.investorId) === String(inv.id) && String(ap.perkId) === String(assignForm.perkId) && ap.status === 'active'
                  );
                  return (
                    <div
                      key={inv.id}
                      className={`kfpl-client-check-item ${isSelected ? 'selected' : ''} ${alreadyHas ? 'already-assigned' : ''}`}
                      onClick={() => !alreadyHas && toggleClient(String(inv.id))}
                    >
                      <div className={`kfpl-client-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && icons.check}
                      </div>
                      <div className="kfpl-client-check-avatar">
                        {inv.name.charAt(0)}
                      </div>
                      <div className="kfpl-client-check-info">
                        <span className="kfpl-client-check-name">{inv.name}</span>
                        <span className="kfpl-client-check-id">{inv.clientId}</span>
                      </div>
                      <div className="kfpl-client-check-meta">
                        <Badge status={inv.category}>{inv.category}</Badge>
                        {alreadyHas && <span className="kfpl-already-badge">Already Assigned</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══════ Add Perk Modal ═══════ */}
      <Modal
        isOpen={showAdd}
        onClose={() => !isSubmittingAdd && setShowAdd(false)}
        title="Add New Perk"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowAdd(false)} disabled={isSubmittingAdd}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleAddPerk} disabled={!newPerk.name || isSubmittingAdd}>
              {isSubmittingAdd ? 'Creating...' : 'Create Perk'}
            </button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '16px' }}>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Perk Name <span className="required">*</span></label>
            <input className="kfpl-input" value={newPerk.name} onChange={(e) => setNewPerk(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. VIP Lounge Access" />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Description</label>
            <textarea className="kfpl-textarea" value={newPerk.description} onChange={(e) => setNewPerk(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe the perk..." rows="2" />
          </div>
          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Tier</label>
              <select className="kfpl-select" value={newPerk.tier} onChange={(e) => setNewPerk(prev => ({ ...prev, tier: e.target.value }))}>
                <option value="">Select tier</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Min Investment (₹)</label>
              <input className="kfpl-input" type="number" value={newPerk.minInvestment} onChange={(e) => setNewPerk(prev => ({ ...prev, minInvestment: e.target.value }))} placeholder="500000" />
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══════ Edit Perk Modal ═══════ */}
      <Modal
        isOpen={showEdit}
        onClose={() => { if (!isSubmittingEdit) { setShowEdit(false); setEditingPerk(null); } }}
        title="Edit Perk Definition"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => { setShowEdit(false); setEditingPerk(null); }} disabled={isSubmittingEdit}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleUpdatePerk} disabled={!editingPerk?.name || isSubmittingEdit}>
              {isSubmittingEdit ? 'Updating...' : 'Update Perk'}
            </button>
          </>
        }
      >
        {editingPerk && (
          <div className="kfpl-form" style={{ gap: '16px' }}>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Perk Name <span className="required">*</span></label>
              <input className="kfpl-input" value={editingPerk.name} onChange={(e) => setEditingPerk(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. VIP Lounge Access" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Description</label>
              <textarea className="kfpl-textarea" value={editingPerk.description} onChange={(e) => setEditingPerk(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe the perk..." rows="2" />
            </div>
            <div className="kfpl-form-row">
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Tier</label>
                <select className="kfpl-select" value={editingPerk.tier} onChange={(e) => setEditingPerk(prev => ({ ...prev, tier: e.target.value }))}>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="diamond">Diamond</option>
                </select>
              </div>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Min Investment (₹)</label>
                <input className="kfpl-input" type="number" value={editingPerk.minInvestment} onChange={(e) => setEditingPerk(prev => ({ ...prev, minInvestment: e.target.value }))} placeholder="500000" />
              </div>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Status</label>
              <select className="kfpl-select" value={editingPerk.status} onChange={(e) => setEditingPerk(prev => ({ ...prev, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════ Delete Confirmation Modal ═══════ */}
      <Modal
        isOpen={!!deletePerkConfirm}
        onClose={() => !isDeleting && setDeletePerkConfirm(null)}
        title="Confirm Delete Perk"
        size="sm"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setDeletePerkConfirm(null)} disabled={isDeleting}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={handleDeletePerk} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Are you sure you want to delete <strong>{deletePerkConfirm?.name}</strong>?
          This will delete the perk definition and cascade remove any active client assignments. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

/* ============ END: PerkManagement.jsx ============ */
