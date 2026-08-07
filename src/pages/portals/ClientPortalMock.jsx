/* ============================================================
   Page: ClientPortalMock.jsx
   Description: Client Portal Accounts & Credentials Listing
   ============================================================ */

import { useState, useEffect } from 'react';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';
import Modal from '../../components/ui/Modal';
import { usePermissions } from '../../utils/usePermissions';

export default function ClientPortalMock() {
  const addToast = useToast();
  const { canDelete } = usePermissions();
  const allowDelete = canDelete('clientPortal') || canDelete('manageClients');
  const [searchQuery, setSearchQuery] = useState('');
  const [residencyFilter, setResidencyFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const res = await apiRequest('/api/super-admin/clients');
        const list = res.data?.clients || res.data || res.clients || [];
        if (Array.isArray(list)) {
          const normalized = list.map((c, index) => {
            const profile = c.profile || {};
            const header = c.header || {};
            const user = (c.userId && typeof c.userId === 'object' ? c.userId : null) || 
                         (c.user && typeof c.user === 'object' ? c.user : null) || 
                         (profile.userId && typeof profile.userId === 'object' ? profile.userId : null) ||
                         (profile.user && typeof profile.user === 'object' ? profile.user : null) || {};
            
            const padIndex = String(index + 1).padStart(3, '0');
            const fallbackCode = `C-${padIndex}`;

            const name = profile.fullName || user.name || user.fullName || c.fullName || header.clientName || c.name || profile.name || '';
            const firstWord = name.split(' ')[0] || 'client';
            
            const formatClientID = (rawId) => {
              if (!rawId || rawId === '—') return '—';
              if (rawId.startsWith('KFPL-CL-')) return rawId;
              const digits = rawId.match(/\d+/);
              if (digits) {
                let val = parseInt(digits[0], 10);
                if (val < 1000) {
                  val = 1000 + val;
                }
                return `KFPL-CL-${val}`;
              }
              return 'KFPL-CL-1001';
            };

            const cleanCode = user.clientCode || c.clientCode || header.clientCode || profile.clientCode || c.clientId || profile.clientId || user._id || c._id || fallbackCode;
            const formattedClientId = formatClientID(cleanCode);
            const rawId = formattedClientId.split('-').pop();
            
            const generatedPassword = `${firstWord.toLowerCase()}@${rawId}`;
            const emailVal = profile.email || user.email || c.email || '';

            return {
              id: c._id || user._id || profile.userId || c.id,
              clientId: formattedClientId,
              name: name || '—',
              email: emailVal,
              portalEmail: emailVal,
              portalPassword: c.portalPassword || profile.portalPassword || user.portalPassword || c.password || profile.password || generatedPassword,
              status: c.status || header.status || profile.status || 'Active',
              residencyStatus: c.residencyStatus || profile.residencyStatus || c.citizenship || profile.citizenship || '',
              tier: c.tier || header.tier || profile.tier || c.category || profile.category || 'silver',
            };
          });
          setClients(normalized);
        }
      } catch (err) {
        console.error('Failed to load clients portals:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const filteredInvestors = clients.filter(inv => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const email = (inv.portalEmail || inv.email || '').toLowerCase();
      const name = (inv.name || '').toLowerCase();
      const id = (inv.clientId || '').toLowerCase();
      if (!email.includes(q) && !name.includes(q) && !id.includes(q)) return false;
    }

    if (residencyFilter !== 'all') {
      const isInt = residencyFilter === 'international';
      const actualInt = (inv.residencyStatus || '').toLowerCase() === 'international';
      if (isInt !== actualInt) return false;
    }

    if (tierFilter !== 'all') {
      if ((inv.tier || 'silver').toLowerCase() !== tierFilter.toLowerCase()) return false;
    }

    if (statusFilter !== 'all') {
      if ((inv.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
    }

    return true;
  });

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setDeleteLoading(true);
    try {
      await apiRequest(`/api/super-admin/clients/${clientToDelete.id}`, {
        method: 'DELETE'
      });
      addToast('Client profile and credentials deleted successfully!', 'success', 'Portal Deleted');
      setClients(prev => prev.filter(c => c.id !== clientToDelete.id));
      setShowDeleteModal(false);
      setClientToDelete(null);
    } catch (err) {
      console.error('Failed to delete client portal:', err);
      addToast(err.message || 'Failed to delete client', 'danger', 'Deletion Failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyPassword = (email, password) => {
    const text = `Email: ${email}\nPassword: ${password}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => addToast('Credentials copied to clipboard!', 'success', 'Copied'))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      addToast('Credentials copied to clipboard!', 'success', 'Copied');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textarea);
  };

  if (loading) {
    return (
      <div className="kfpl-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ color: 'var(--color-navy)', fontSize: '1.2rem', fontWeight: 500 }}>Loading Client Portals...</div>
      </div>
    );
  }

  return (
    <div className="kfpl-page">
      {/* Page Header */}
      <div className="kfpl-page-header" style={{ marginBottom: '20px' }}>
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">
            Client Portal Hub
            <span style={{ 
              background: 'var(--color-gold-glow)', 
              color: 'var(--color-gold)', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              padding: '4px 10px', 
              borderRadius: '20px',
              marginLeft: '12px',
              border: '1px solid var(--color-gold)'
            }}>
              PORTAL CONFIG
            </span>
          </h2>
          <p className="kfpl-page-subtitle">Manage and copy client portal access credentials</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div className="kfpl-search" style={{ maxWidth: '400px', flex: 1, marginBottom: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="kfpl-search-icon">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by client ID, name, or email ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          value={residencyFilter}
          onChange={e => setResidencyFilter(e.target.value)}
          className="kfpl-select"
          style={{ width: '160px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <option value="all">All Residency</option>
          <option value="national">National</option>
          <option value="international">International</option>
        </select>

        <select
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
          className="kfpl-select"
          style={{ width: '150px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <option value="all">All Tiers</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="diamond">Diamond</option>
          <option value="platinum">Platinum</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="kfpl-select"
          style={{ width: '140px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      {/* Credentials Table */}
      <div className="kfpl-table-container">
        <div className="kfpl-table-toolbar">
          <div className="kfpl-table-toolbar-left">
            <span className="kfpl-table-count">
              {searchQuery.trim() || residencyFilter !== 'all' || tierFilter !== 'all' || statusFilter !== 'all' ? (
                <>Showing <strong>{filteredInvestors.length}</strong> of <strong>{clients.length}</strong> clients</>
              ) : (
                <>Showing Portal Login Credentials for <strong>{clients.length}</strong> clients</>
              )}
            </span>
          </div>
        </div>
        <div className="kfpl-table-scroll">
          <table className="kfpl-table">
            <thead>
              <tr>
                <th>Client ID</th>
                <th>Client Name</th>
                <th>Portal Login ID (Email)</th>
                <th>Portal Password</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestors.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    No portal credentials found matching your search.
                  </td>
                </tr>
              ) : filteredInvestors.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600 }}>{inv.clientId}</td>
                  <td style={{ fontWeight: 600 }}>{inv.name}</td>
                  <td><span style={{ fontFamily: 'monospace' }}>{inv.portalEmail || inv.email}</span></td>
                  <td><span style={{ fontFamily: 'monospace', color: 'var(--color-navy-hover)', fontWeight: '600' }}>{inv.portalPassword || 'kfpl@123'}</span></td>
                  <td><Badge status={inv.status}>{inv.status}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        onClick={() => copyPassword(inv.portalEmail || inv.email, inv.portalPassword || 'kfpl@123')}
                        style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                      >
                        Copy Credentials
                      </button>
                      {allowDelete && (
                        <button 
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          onClick={() => {
                            setClientToDelete(inv);
                            setShowDeleteModal(true);
                          }}
                          style={{ padding: '6px 14px', fontSize: '0.8125rem', color: '#EF4444', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.05)' }}
                        >
                          Delete Client
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!deleteLoading) {
            setShowDeleteModal(false);
            setClientToDelete(null);
          }
        }}
        title="Delete Client Profile & Credentials"
        footer={
          <>
            <button
              className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
              onClick={() => {
                setShowDeleteModal(false);
                setClientToDelete(null);
              }}
              disabled={deleteLoading}
            >
              Cancel
            </button>
            <button
              className="kfpl-btn kfpl-btn--sm"
              style={{ background: '#EF4444', borderColor: 'transparent', color: '#FFFFFF', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Yes, Delete Client'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px' }}>
          <div style={{ 
            display: 'flex', 
            gap: '16px', 
            alignItems: 'flex-start', 
            background: 'rgba(239, 68, 68, 0.05)', 
            border: '1px solid rgba(239, 68, 68, 0.15)', 
            padding: '16px', 
            borderRadius: '12px' 
          }}>
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              color: '#EF4444', 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0,
              fontSize: '1.25rem',
              fontWeight: 'bold'
            }}>
              ⚠️
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
                Permanently delete client & portal access?
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4B5563', lineHeight: '1.5' }}>
                Are you sure you want to completely remove client <strong>{clientToDelete?.name}</strong> and revoke their portal access credentials? 
                This action is irreversible and will delete all associated data from the database.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============ END: ClientPortalMock.jsx ============ */
