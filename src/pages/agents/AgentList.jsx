/* ============================================================
   Page: AgentList.jsx
   Description: Paginated table of all agents
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatAgentID } from '../../utils/formatters';
import { apiRequest } from '../../config/apiHelper';
import { getSWRCache, setSWRCache, invalidateSWRCache } from '../../utils/swrHelper';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../utils/usePermissions';

const slugifyName = (name) => {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export default function AgentList() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [residencyFilter, setResidencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAgentId, setDeleteAgentId] = useState(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleDeleteAgentClick = (id) => {
    setDeleteAgentId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteAgent = async () => {
    if (!deleteAgentId || isDeleting) return;

    const targetId = deleteAgentId;
    setIsDeleting(true);
    setShowDeleteModal(false);
    setDeleteAgentId(null);

    const previousAgents = agentsList;
    const updated = previousAgents.filter(a => (a.id || a._id) !== targetId);
    setAgentsList(updated);
    try {
      setSWRCache('sa_agents', updated);
      invalidateSWRCache('sa_dashboard');
    } catch (_) {}

    try {
      await apiRequest(`/api/super-admin/agents/${targetId}`, {
        method: 'DELETE'
      });
      addToast('Agent deleted successfully.', 'success', 'Deleted');
    } catch (err) {
      console.error('Failed to delete agent:', err);
      setAgentsList(previousAgents);
      try {
        setSWRCache('sa_agents', previousAgents);
      } catch (_) {}
      addToast(err.message || 'Failed to delete agent.', 'error', 'Error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllAgents = async () => {
    if (isClearing) return;

    setIsClearing(true);
    setShowClearAllModal(false);

    const previousAgents = agentsList;
    setAgentsList([]);
    try {
      setSWRCache('sa_agents', []);
      invalidateSWRCache('sa_dashboard');
    } catch (_) {}

    try {
      await apiRequest('/api/super-admin/agents/clear', {
        method: 'DELETE'
      });
      addToast('All agent profiles cleared successfully.', 'success', 'Data Cleared');
    } catch (err) {
      console.error('Failed to clear agents:', err);
      setAgentsList(previousAgents);
      try {
        setSWRCache('sa_agents', previousAgents);
      } catch (_) {}
      addToast(err.message || 'Failed to clear agents.', 'error', 'Error');
    } finally {
      setIsClearing(false);
    }
  };

  const formatAgentID = (rawId) => {
    if (!rawId || rawId === '—') return '—';
    const str = String(rawId).trim();
    if (str.toUpperCase().startsWith('KFPL-AG-') || str.toUpperCase().startsWith('KFPL-AGT-')) {
      return str.toUpperCase().replace('KFPL-AGT-', 'KFPL-AG-');
    }
    const digits = str.match(/\d+/);
    if (digits) {
      let val = parseInt(digits[0], 10);
      if (val < 1000) {
        val = 1000 + val;
      }
      return `KFPL-AG-${val}`;
    }
    return '—';
  };

  const formatDateDMY = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '—';
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${mon}/${d.getFullYear()}`;
  };

  useEffect(() => {
    // --- User-Scoped SWR Cache Initialization for Instant Load (0ms) ---
    try {
      const parsed = getSWRCache('sa_agents');
      if (Array.isArray(parsed)) {
        setAgentsList(parsed);
        setLoading(false);
      }
    } catch (e) {
      console.warn('Failed to parse agents cache:', e);
    }

    const fetchAgents = async () => {
      try {
        const data = await apiRequest('/api/super-admin/agents');
        
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

        const raw = extractAgents(data);
        if (Array.isArray(raw)) {
          const normalized = raw
            .filter(a => a && typeof a === 'object')
            .map(a => {
              const user = a.user || {};
              const profile = a.profile || {};
              const resolvedCode = a.agentId || a.clientCode || user.clientCode || profile.clientCode || profile.agentId || '';
              const statusVal = (profile.status || (user.isActive ? 'active' : 'inactive') || 'active').toLowerCase();
              const residencyVal = profile.residencyStatus || a.residencyStatus || a.citizenship || 'National (Domestic)';

              const formattedCode = formatAgentID(resolvedCode || '—');
              const nameVal = profile.fullName || a.name || user.name || '';
              const agentSlug = nameVal ? slugifyName(nameVal) : (resolvedCode || a._id || a.id || user._id || profile.userId);

              return {
                ...a,
                id: a._id || a.id || user._id || profile.userId,
                slug: agentSlug,
                name: nameVal || '—',
                email: profile.email || a.email || user.email || '—',
                phone: profile.phone || '—',
                agentId: formattedCode,
                joinDateRaw: user.createdAt || profile.createdAt || a.createdAt || '',
                totalClients: a.clientsCount ?? a.totalClients ?? 0,
                totalInvestment: a.totalInvestment ?? 0,
                commissionPaid: a.commissionPaid ?? a.totalCommissionsPaid ?? a.totalCommissions ?? 0,
                status: statusVal,
                residencyStatus: residencyVal,
                citizenship: residencyVal.toLowerCase().includes('international') ? 'International' : 'National',
              };
            });
          
          normalized.sort((a, b) => {
            return a.agentId.localeCompare(b.agentId, undefined, { numeric: true, sensitivity: 'base' });
          });

          setAgentsList(normalized);
          try {
            const cacheableAgents = normalized.map(a => {
              const copy = { ...a };
              if (copy.profilePic && copy.profilePic.length > 2000) delete copy.profilePic;
              return copy;
            });
            setSWRCache('sa_agents', cacheableAgents);
          } catch (_) {}
        } else {
          setAgentsList([]);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();

    const handleFocus = () => fetchAgents();
    const handleUpdate = () => fetchAgents();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('superAdminDataUpdated', handleUpdate);
    const interval = setInterval(fetchAgents, 15000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('superAdminDataUpdated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const filteredAgents = agentsList.filter(agt => {
    if (residencyFilter !== 'all') {
      const isInt = residencyFilter === 'international';
      const actualInt = (agt.residencyStatus || '').toLowerCase().includes('international');
      if (isInt !== actualInt) return false;
    }
    if (statusFilter !== 'all') {
      if ((agt.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
    }
    return true;
  });

  const { canCreate, canEdit, canDelete } = usePermissions();

  const columns = [
    {
      header: 'Agent ID',
      accessor: 'agentId',
      render: (row) => <span style={{ fontWeight: 700 }}>{formatAgentID(row.agentId || row.code || row.clientCode)}</span>
    },
    {
      header: 'Join Date',
      render: (row) => <span>{formatDateDMY(row.joinDateRaw || row.createdAt)}</span>
    },
    {
      header: 'Agent Name',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: 'var(--color-navy-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-gold)', fontWeight: 800, fontSize: 14, flexShrink: 0, overflow: 'hidden'
          }}>
            {row.profilePic ? (
              <img src={row.profilePic} alt={row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (row.name || 'A').charAt(0).toUpperCase()
            )}
          </div>
          <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{row.name}</span>
        </div>
      )
    },
    {
      header: 'Email',
      render: (row) => <span style={{ fontSize: '0.8125rem', color: '#475569' }}>{row.email || '—'}</span>
    },
    {
      header: 'Client',
      render: (row) => {
        const count = row.totalClients || 0;
        if (count > 0) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/agents/${row._id || row.id}/clients`);
              }}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '4px 10px',
                borderRadius: '6px',
                color: 'var(--color-gold-dark)',
                fontWeight: '700',
                fontSize: '0.8125rem',
                cursor: 'pointer'
              }}
            >
              {count} {count === 1 ? 'Client' : 'Clients'}
            </button>
          );
        }
        return <span style={{ color: '#94a3b8' }}>0</span>;
      }
    },
    {
      header: 'Total Investment',
      render: (row) => <span className="font-semibold">{formatCurrency(row.totalInvestment || 0)}</span>,
    },
    {
      header: 'Commission Paid',
      render: (row) => <span style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(row.commissionPaid || 0)}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
    ...((canEdit('manageAgents') || canDelete('manageAgents')) ? [{
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          {canEdit('manageAgents') && (
            <button
              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/agents/${row.slug || row.agentId || row.id || row._id}/edit`);
              }}
            >
              Edit
            </button>
          )}
          {canDelete('manageAgents') && (
            <button
              className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
              style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--color-danger)' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteAgentClick(row.id || row._id);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="12" height="12">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
          )}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Agents</h2>
          <p className="kfpl-page-subtitle">Agents invest and bring clients — manage profiles & commissions</p>
        </div>
        <div className="kfpl-page-header-actions">
          {/* Residency Filter Dropdown */}
          <select
            className="kfpl-select"
            value={residencyFilter}
            onChange={(e) => setResidencyFilter(e.target.value)}
            style={{ width: '150px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', marginRight: '8px' }}
          >
            <option value="all">All Residency</option>
            <option value="national">National</option>
            <option value="international">International</option>
          </select>

          {/* Status Filter Dropdown */}
          <select
            className="kfpl-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '140px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', marginRight: '8px' }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {canCreate('manageAgents') && (
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => navigate('/agents/add')} style={{ marginRight: '8px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Agent
            </button>
          )}
          {canDelete('manageAgents') && (
            <button
              className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
              onClick={() => setShowClearAllModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear All Agents
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading agents...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filteredAgents}
            onRowClick={(row) => navigate(`/agents/${row.slug || row.agentId || row.id || row._id}`)}
            searchPlaceholder="Search agents by name, ID..."
          />
          {showDeleteModal && createPortal(
            <div
              className="kfpl-modal-overlay"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteAgentId(null);
              }}
            >
              <div
                className="kfpl-modal"
                style={{ maxWidth: '440px' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="kfpl-modal-header">
                  <h3 className="kfpl-modal-title">Delete Agent</h3>
                  <button className="kfpl-modal-close" onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteAgentId(null);
                  }} aria-label="Close modal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="kfpl-modal-body" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'start', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#EF4444' }}>Danger: Permanent Deletion</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                        Are you sure you want to delete this agent? This action will permanently remove the agent profile, documents, and unset agent associations for all their clients. This cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="kfpl-modal-footer">
                  <button
                    className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteAgentId(null);
                    }}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                    onClick={confirmDeleteAgent}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {showClearAllModal && createPortal(
            <div
              className="kfpl-modal-overlay"
              onClick={() => !isClearing && setShowClearAllModal(false)}
            >
              <div
                className="kfpl-modal"
                style={{ maxWidth: '440px' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="kfpl-modal-header">
                  <h3 className="kfpl-modal-title">Clear All Agents</h3>
                  <button className="kfpl-modal-close" onClick={() => !isClearing && setShowClearAllModal(false)} aria-label="Close modal" disabled={isClearing}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div className="kfpl-modal-body" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'start', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#EF4444' }}>Danger: Clear All Records</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                        Are you sure you want to clear all agents? This will permanently remove all agent profiles, documents, and reset all clients to direct (no agent) clients. This cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="kfpl-modal-footer">
                  <button
                    className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                    onClick={() => setShowClearAllModal(false)}
                    disabled={isClearing}
                  >
                    Cancel
                  </button>
                  <button
                    className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                    onClick={handleClearAllAgents}
                    disabled={isClearing}
                  >
                    {isClearing ? 'Clearing...' : 'Yes, Clear All'}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}

/* ============ END: AgentList.jsx ============ */
