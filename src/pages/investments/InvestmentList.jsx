/* ============================================================
   Page: InvestmentList.jsx
   Description: All investments across all clients
   ============================================================ */

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/formatters';
import { apiRequest } from '../../config/apiHelper';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../utils/usePermissions';

function formatDateDMY(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${day}/${mon}/${yr}`;
}

function calculateMonthsBetween(startStr, endStr) {
  if (!startStr || !endStr) return 18;
  const sd = new Date(startStr);
  const ed = new Date(endStr);
  if (isNaN(sd.getTime()) || isNaN(ed.getTime()) || ed <= sd) return 18;
  const months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
  return months > 0 ? months : 18;
}

function getDynamicEndDateAndMonths(row) {
  const clientObj = row.clientId && typeof row.clientId === 'object' ? row.clientId : null;
  const startDateStr = row.investmentDate || row.date || row.createdAt || row.contractStartDate || clientObj?.contractStartDate || clientObj?.profile?.contractStartDate;

  const extDate = row.extendContractDate || row.contractExtendedDate || clientObj?.extendContractDate || clientObj?.profile?.extendContractDate;

  // 1. If explicitly extended, calculate from startDate to extDate
  if (startDateStr && extDate) {
    const sd = new Date(startDateStr);
    const ed = new Date(extDate);
    if (!isNaN(sd.getTime()) && !isNaN(ed.getTime()) && ed > sd) {
      const months = calculateMonthsBetween(startDateStr, extDate);
      return {
        formattedDate: formatDateDMY(extDate),
        monthsText: `${months} Months`
      };
    }
  }

  // 2. Default: 18 months standard term from contractStartDate
  if (startDateStr) {
    const sd = new Date(startDateStr);
    if (!isNaN(sd.getTime())) {
      const defaultEd = new Date(sd);
      defaultEd.setMonth(defaultEd.getMonth() + 18);
      return {
        formattedDate: formatDateDMY(defaultEd),
        monthsText: `18 Months`
      };
    }
  }

  return {
    formattedDate: '—',
    monthsText: '18 Months'
  };
}

export default function InvestmentList() {
  const navigate = useNavigate();
  const addToast = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [extendingInvestment, setExtendingInvestment] = useState(null);
  const [extensionEndDate, setExtensionEndDate] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Delete investment state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInvestmentId, setDeleteInvestmentId] = useState(null);

  // Clear all investments state
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  const handleDeleteInvestmentClick = (id) => {
    setDeleteInvestmentId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteInvestment = async () => {
    if (!deleteInvestmentId) return;
    try {
      await apiRequest(`/api/super-admin/investments/${deleteInvestmentId}`, {
        method: 'DELETE'
      });
      addToast('Investment deleted successfully.', 'success', 'Deleted');
      setShowDeleteModal(false);
      setDeleteInvestmentId(null);
      setRenderTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Failed to delete investment:', err);
      addToast(err.message || 'Failed to delete investment.', 'error', 'Error');
    }
  };

  const handleClearAllInvestments = async () => {
    try {
      try {
        await apiRequest('/api/super-admin/investments/clear', {
          method: 'DELETE'
        });
      } catch (e) {
        await apiRequest('/api/super-admin/investments', {
          method: 'DELETE'
        });
      }
      addToast('All investments cleared successfully.', 'success', 'Data Cleared');
      setShowClearAllModal(false);
      setRenderTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Failed to clear investments:', err);
      addToast(err.message || 'Failed to clear investments.', 'error', 'Error');
    }
  };

  const handleApproveInvestment = async (investmentId, amount) => {
    // Optimistic UI update for instant activation
    setInvestments(prev => prev.map(inv => {
      const invId = inv._id || inv.id;
      if (String(invId) === String(investmentId)) {
        return { ...inv, status: 'active' };
      }
      return inv;
    }));

    addToast('Activating investment...', 'info', 'Processing');

    try {
      await apiRequest(`/api/super-admin/investments/${investmentId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ investmentAmount: amount })
      });
      addToast('Investment successfully activated!', 'success', 'Activated');
      window.dispatchEvent(new Event('superAdminDataUpdated'));
    } catch (err) {
      console.error('Failed to activate investment:', err);
      addToast(err.message || 'Failed to activate investment.', 'error', 'Error');
    }
  };

  useEffect(() => {
    const fetchInvestments = async () => {
      setLoading(true);
      try {
        const data = await apiRequest('/api/super-admin/investments');
        const list = Array.isArray(data)
          ? data
          : (data.investments || data.data?.investments || (data.data && Array.isArray(data.data) ? data.data : []));
        setInvestments(list);
      } catch (err) {
        console.error('Failed to fetch investments from API', err);
        setInvestments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInvestments();
  }, [renderTrigger]);

  const handleExtendContractToDate = async (investmentId, newEndDateStr) => {
    if (!newEndDateStr) return;

    const targetEndDateISO = new Date(newEndDateStr).toISOString();

    // 1. Optimistic Local State Update (Instant UI response, zero refresh delay)
    setInvestments(prev => prev.map(inv => {
      const invId = inv._id || inv.id;
      if (String(invId) === String(investmentId)) {
        const startDt = inv.investmentDate || inv.date || inv.createdAt || inv.contractStartDate;
        const newMonths = calculateMonthsBetween(startDt, newEndDateStr);
        return {
          ...inv,
          contractEndDate: targetEndDateISO,
          extendContractDate: targetEndDateISO,
          contractPeriod: newMonths,
          durationMonths: newMonths
        };
      }
      return inv;
    }));

    addToast('Contract extension submitted. Syncing in background...', 'info', 'Updating');

    // 2. Concurrent Background API Execution
    try {
      const clientObj = extendingInvestment?.clientId;
      const clientRealId = clientObj && typeof clientObj === 'object' ? (clientObj._id || clientObj.id) : (typeof clientObj === 'string' ? clientObj : null);

      await Promise.all([
        apiRequest(`/api/super-admin/investments/${investmentId}/extend`, {
          method: 'PATCH',
          body: JSON.stringify({ newEndDate: targetEndDateISO })
        }).catch(err => console.error('[BG API] Investment extend error:', err)),
        clientRealId ? apiRequest(`/api/super-admin/clients/${clientRealId}`, {
          method: 'PATCH',
          body: JSON.stringify({ extendContractDate: targetEndDateISO })
        }).catch(err => console.error('[BG API] Client extend error:', err)) : Promise.resolve()
      ]);

      addToast('Contract extension saved successfully!', 'success', 'Contract Extended');
      window.dispatchEvent(new Event('superAdminDataUpdated'));
    } catch (err) {
      console.error('Background contract extension failed:', err);
      addToast(err.message || 'Failed to sync extension.', 'error', 'Error');
    }
  };

  // Filter out mock data from both local fallback and backend database seeded objects
  const cleanInvestments = useMemo(() => {
    const mockNames = ['John Doe', 'Sunil Verma', 'Kavita Reddy', 'Amit Joshi', 'Meera Iyer', 'Suresh Patel'];
    return investments
      .filter(inv => {
        const clientName = inv.clientName ||
          inv.investorName ||
          (inv.clientId && typeof inv.clientId === 'object' ? (inv.clientId.profile?.fullName || inv.clientId.name || inv.clientId.userId?.name) : '') ||
          '';
        return !mockNames.includes(clientName);
      })
      .map(inv => {
        const clientObj = inv.clientId && typeof inv.clientId === 'object' ? inv.clientId : null;
        const name = inv.clientName || inv.investorName || clientObj?.profile?.fullName || clientObj?.name || clientObj?.userId?.name || '';
        const code = inv.clientCode || clientObj?.clientCode || clientObj?.profile?.clientCode || clientObj?.userId?.clientCode || '';
        return {
          ...inv,
          clientName: name,
          clientCode: code
        };
      });
  }, [investments]);

  const rawDisplayData = cleanInvestments;

  const uniqueSegments = useMemo(() => {
    return Array.from(new Set(rawDisplayData.map(inv => inv.segment))).filter(Boolean);
  }, [rawDisplayData]);

  const uniqueStatuses = useMemo(() => {
    return Array.from(new Set(rawDisplayData.map(inv => inv.status || 'Active'))).filter(Boolean);
  }, [rawDisplayData]);

  const filteredDisplayData = useMemo(() => {
    return rawDisplayData.filter(inv => {
      if (segmentFilter !== 'all' && inv.segment !== segmentFilter) return false;
      if (statusFilter !== 'all' && (inv.status || 'Active') !== statusFilter) return false;
      return true;
    });
  }, [rawDisplayData, segmentFilter, statusFilter]);

  const columns = [
    {
      header: 'Client',
      accessor: 'clientId',
      render: (row) => {
        const clientObj = row.clientId && typeof row.clientId === 'object' ? row.clientId : null;
        const clientRealId = clientObj ? (clientObj._id || clientObj.id) : (typeof row.clientId === 'string' && /^[0-9a-fA-F]{24}$/.test(row.clientId) ? row.clientId : null);
        const clientName = row.clientName ||
          row.investorName ||
          clientObj?.profile?.fullName ||
          clientObj?.userId?.name ||
          (typeof row.clientId === 'string' && !/^[0-9a-fA-F]{24}$/.test(row.clientId) ? row.clientId : '') ||
          'N/A';
        const clientCode = row.clientCode ||
          clientObj?.clientCode ||
          clientObj?.profile?.clientCode ||
          clientObj?.userId?.clientCode ||
          '';
        return (
          <div
            style={{ cursor: clientRealId ? 'pointer' : 'default' }}
            onClick={() => {
              if (clientRealId) navigate(`/investors/${clientRealId}`);
            }}
          >
            <div className="kfpl-table-cell-primary" style={{ color: 'var(--color-navy-dark)', fontWeight: 700 }}>
              {clientName}
            </div>
            {clientCode && <div className="kfpl-table-cell-secondary" style={{ color: 'var(--color-gold-dark)', fontWeight: 600 }}>{clientCode}</div>}
          </div>
        );
      },
    },
    {
      header: 'Segment',
      accessor: 'segment',
      render: (row) => {
        const hasAlloc = Array.isArray(row.segmentAllocation) && row.segmentAllocation.length > 0;
        if (hasAlloc) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {row.segmentAllocation.map((s, sIdx) => (
                <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    className="font-medium"
                    style={{ cursor: 'pointer', color: 'var(--color-navy)', fontWeight: 600, fontSize: '0.8125rem' }}
                    onClick={() => navigate('/portfolio')}
                  >
                    {s.segmentName}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--color-gold-dark, #059669)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    {s.allocationPercentage}%
                  </span>
                </div>
              ))}
            </div>
          );
        }
        const rawSeg = row.segment || 'Unallocated';
        const isUnallocated = !rawSeg || rawSeg === 'Project Allocated' || rawSeg === 'General Capital Pool' || rawSeg === 'Capital Deposit' || rawSeg === 'Unallocated Pool';
        const segmentText = isUnallocated ? 'Unallocated' : rawSeg;
        return (
          <span
            className="font-medium"
            style={{ cursor: 'pointer', color: 'var(--color-navy)', fontWeight: 600 }}
            onClick={() => navigate('/portfolio')}
          >
            {segmentText}
          </span>
        );
      }
    },
    { header: 'Amount', accessor: 'investmentAmount', render: (row) => <span className="font-semibold">{formatCurrency(row.investmentAmount || row.amount || 0)}</span> },
    { header: 'ROI %', accessor: 'roiPercentage', render: (row) => `${row.roiPercentage || row.roi || 0}%` },
    { header: 'Risk %', accessor: 'riskPercentage', render: (row) => `${row.riskPercentage || row.risk || 0}%` },
    {
      header: 'Contract Start',
      accessor: 'investmentDate',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatDateDMY(row.investmentDate || row.date || row.createdAt)}</div>
          <div className="kfpl-table-cell-secondary" style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>DD/MM/YYYY</div>
        </div>
      )
    },
    {
      header: 'End Date',
      render: (row) => {
        const info = getDynamicEndDateAndMonths(row);
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{info.formattedDate}</div>
            <div className="kfpl-table-cell-secondary" style={{ fontSize: '0.7rem' }}>{info.monthsText} · DD/MM/YYYY</div>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <Badge status={(row.status || 'active').toLowerCase()}>{(row.status || 'active').toUpperCase()}</Badge>
    },
    {
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
            style={{ padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--color-danger)' }}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteInvestmentClick(row._id || row.id);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="12" height="12">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Investments</h2>
          <p className="kfpl-page-subtitle">All investments across all clients & agents</p>
        </div>
        <div className="kfpl-page-header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value)}
            className="kfpl-select"
            style={{ padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', flex: '1 1 140px' }}
          >
            <option value="all">All Segments</option>
            {uniqueSegments.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="kfpl-select"
            style={{ padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', flex: '1 1 120px' }}
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {canCreate('manageInvestments') && (
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => navigate('/investments/assign')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Assign Investment
            </button>
          )}

          {canDelete('manageInvestments') && (
            <button
              className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
              onClick={() => setShowClearAllModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear All Investments
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredDisplayData}
        onRowClick={(row) => row.investorId ? navigate(`/investors/${row.investorId}`) : null}
        searchPlaceholder="Search by investor, segment..."
      />

      {extendingInvestment && createPortal(
        <div
          className="kfpl-modal-overlay"
          onClick={() => setExtendingInvestment(null)}
        >
          <div
            className="kfpl-modal"
            style={{ maxWidth: '440px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="kfpl-modal-header">
              <h3 className="kfpl-modal-title">Extend Contract</h3>
              <button className="kfpl-modal-close" onClick={() => setExtendingInvestment(null)} aria-label="Close modal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="kfpl-modal-body" style={{ padding: '20px 24px' }}>
              {(() => {
                const clientName = extendingInvestment.clientName ||
                  extendingInvestment.investorName ||
                  (extendingInvestment.clientId && typeof extendingInvestment.clientId === 'object' ? (extendingInvestment.clientId.profile?.fullName || extendingInvestment.clientId.userId?.name) : '') ||
                  'Client';
                const rawSeg = extendingInvestment.segment || 'Unallocated';
                const isUnallocated = !rawSeg || rawSeg === 'Project Allocated' || rawSeg === 'General Capital Pool' || rawSeg === 'Capital Deposit' || rawSeg === 'Unallocated Pool';
                const segmentText = isUnallocated ? 'Unallocated' : rawSeg;
                const period = extendingInvestment.contractPeriod || extendingInvestment.durationMonths || 18;

                return (
                  <>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                      Extend contract for <strong>{clientName}</strong>'s investment in <strong>{segmentText}</strong>.
                    </p>
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Contract Start Date:</span>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                        {formatDateDMY(extendingInvestment.investmentDate || extendingInvestment.date || extendingInvestment.createdAt)}
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Current End Date:</span>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                        {(() => {
                          const info = getDynamicEndDateAndMonths(extendingInvestment);
                          return `${info.formattedDate} (${info.monthsText})`;
                        })()}
                      </div>
                    </div>
                  </>
                );
              })()}
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Select New End Date <span className="required">*</span></label>
                <input
                  type="date"
                  className="kfpl-input"
                  value={extensionEndDate}
                  onChange={(e) => setExtensionEndDate(e.target.value)}
                  min={extendingInvestment.investmentDate ? new Date(extendingInvestment.investmentDate).toISOString().split('T')[0] : undefined}
                  required
                />
              </div>
            </div>
            <div className="kfpl-modal-footer">
              <button
                className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                onClick={() => setExtendingInvestment(null)}
              >Cancel</button>
              <button
                className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                onClick={() => {
                  handleExtendContractToDate(extendingInvestment._id || extendingInvestment.id, extensionEndDate);
                  setExtendingInvestment(null);
                }}
              >Confirm Extension</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDeleteModal && createPortal(
        <div
          className="kfpl-modal-overlay"
          onClick={() => {
            setShowDeleteModal(false);
            setDeleteInvestmentId(null);
          }}
        >
          <div
            className="kfpl-modal"
            style={{ maxWidth: '440px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="kfpl-modal-header">
              <h3 className="kfpl-modal-title">Delete Investment</h3>
              <button className="kfpl-modal-close" onClick={() => {
                setShowDeleteModal(false);
                setDeleteInvestmentId(null);
              }} aria-label="Close modal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                    Are you sure you want to delete this investment? This action will permanently remove the investment and cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="kfpl-modal-footer">
              <button
                className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteInvestmentId(null);
                }}
              >Cancel</button>
              <button
                className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                onClick={confirmDeleteInvestment}
              >Confirm Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showClearAllModal && createPortal(
        <div
          className="kfpl-modal-overlay"
          onClick={() => setShowClearAllModal(false)}
        >
          <div
            className="kfpl-modal"
            style={{ maxWidth: '440px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="kfpl-modal-header">
              <h3 className="kfpl-modal-title">Confirm Data Deletion</h3>
              <button className="kfpl-modal-close" onClick={() => setShowClearAllModal(false)} aria-label="Close modal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                    You are about to delete **all client and agent investments** from the system. This action is irreversible and cannot be undone.
                  </p>
                </div>
              </div>
            </div>
            <div className="kfpl-modal-footer">
              <button
                className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                onClick={() => setShowClearAllModal(false)}
              >Cancel</button>
              <button
                className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                onClick={handleClearAllInvestments}
              >Yes, Clear All Data</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ============ END: InvestmentList.jsx ============ */
