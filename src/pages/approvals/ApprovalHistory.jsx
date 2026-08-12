/* ============================================================
   Page: ApprovalHistory.jsx
   Description: History log of past approvals/rejections
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { apiRequest } from '../../config/apiHelper';
import { useToast } from '../../components/ui/Toast';

export default function ApprovalHistory() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/api/super-admin/transactions/history?search=`);
      const data = res.data || res;
      const list = Array.isArray(data) ? data : (data.history || data.logs || []);
      
      const mapped = list.map((item, idx) => ({
        id: item.id || item._id || idx,
        type: item.type || 'deposit',
        investorName: item.investorName || (item.clientId && typeof item.clientId === 'object' ? item.clientId.name : '') || '—',
        clientId: item.investorCode || (item.clientId && typeof item.clientId === 'object' ? item.clientId.clientCode : item.clientId) || '—',
        amount: Number(item.amount || 0),
        date: item.date || item.createdAt || '—',
        status: (item.status || 'approved').toLowerCase(),
        adminNote: item.adminNote || item.remarks || item.rejectionReason || '',
        actionAt: item.actionAt || item.updatedAt || '—'
      }));
      setHistoryData(mapped);
    } catch (err) {
      console.error('Failed to load approval history:', err);
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearAllHistory = async () => {
    try {
      setClearing(true);

      await apiRequest('/api/super-admin/transactions/history/clear', {
        method: 'DELETE'
      });

      // Optimistic update - only remove non-deposit-approved items from UI
      setHistoryData(prev => prev.filter(item => item.type === 'deposit' && item.status === 'approved'));
      setShowClearAllModal(false);

      addToast('Rejected and withdrawal logs cleared. Approved deposits are safely preserved.', 'success', 'History Cleared');
      // Refresh to get actual state from backend
      fetchHistory();
    } catch (err) {
      console.error('Failed to clear approval history:', err);
      addToast(err.message || 'Failed to clear history log. Please try again.', 'danger', 'Action Failed');
      fetchHistory();
    } finally {
      setClearing(false);
    }
  };

  const handleSyncInvestments = async () => {
    try {
      setSyncing(true);
      const res = await apiRequest('/api/super-admin/transactions/backfill-investments', { method: 'POST' });
      const { created = 0, skipped = 0 } = res || {};
      if (created > 0) {
        addToast(`${created} investment record(s) created from existing approved deposits. All dashboards now reflect accurate totals.`, 'success', 'Investments Synced');
      } else {
        addToast(res.message || 'All approved deposits already have corresponding investment records.', 'info', 'Already Synced');
      }
    } catch (err) {
      console.error('Failed to sync investments:', err);
      addToast(err.message || 'Failed to sync investments. Please try again.', 'danger', 'Sync Failed');
    } finally {
      setSyncing(false);
    }
  };

  const columns = [
    {
      header: 'Investor',
      accessor: 'investorName',
      render: (row) => (
        <div>
          <div className="kfpl-table-cell-primary">{row.investorName}</div>
          <div className="kfpl-table-cell-secondary">{row.clientId}</div>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: 'type',
      render: (row) => <Badge status={row.type === 'deposit' ? 'active' : 'pending'}>{row.type}</Badge>,
    },
    {
      header: 'Amount',
      accessor: 'amount',
      render: (row) => <span className="font-semibold">{formatCurrency(row.amount)}</span>,
    },
    {
      header: 'Date',
      accessor: 'date',
      render: (row) => <span>{formatDateTime(row.date)}</span>
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
    {
      header: 'Admin Note',
      accessor: 'adminNote',
      render: (row) => <span className="text-sm text-muted">{row.adminNote || '—'}</span>,
    },
    {
      header: 'Action Time',
      accessor: 'actionAt',
      render: (row) => <span>{formatDateTime(row.actionAt)}</span>
    },
  ];

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Approval History</h2>
          <p className="kfpl-page-subtitle">Complete log of past approved and rejected requests</p>
        </div>
        <div className="kfpl-page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/approvals')}>← Back to Queue</button>
          <button
            className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
            onClick={handleSyncInvestments}
            disabled={syncing}
            title="Backfill Investment records for existing approved deposits"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="14" height="14"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            {syncing ? 'Syncing...' : 'Sync Investments'}
          </button>
          {historyData.length > 0 && (
            <button
              className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
              onClick={() => setShowClearAllModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="14" height="14">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear Logs
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading approval history...
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={historyData}
            searchPlaceholder="Search by investor name..."
          />

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
                  <h3 className="kfpl-modal-title">Clear Approval History</h3>
                  <button className="kfpl-modal-close" onClick={() => setShowClearAllModal(false)} aria-label="Close modal">
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
                      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#EF4444' }}>Clear Approval History Logs</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                        This will clear all history logs from this table. <strong>Client investment amounts are securely preserved in the Investment Portfolio</strong> and will not be erased.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="kfpl-modal-footer">
                  <button
                    className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                    onClick={() => setShowClearAllModal(false)}
                    disabled={clearing}
                  >
                    Cancel
                  </button>
                  <button
                    className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                    onClick={handleClearAllHistory}
                    disabled={clearing}
                  >
                    {clearing ? 'Clearing...' : 'Yes, Clear All'}
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

/* ============ END: ApprovalHistory.jsx ============ */
