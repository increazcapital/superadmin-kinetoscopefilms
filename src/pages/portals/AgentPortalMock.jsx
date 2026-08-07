/* ============================================================
   Page: AgentPortalMock.jsx
   Description: Agent Portal Accounts & Credentials Listing
   ============================================================ */

import { useState, useEffect } from 'react';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';
import { usePermissions } from '../../utils/usePermissions';

export default function AgentPortalMock() {
  const addToast = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [residencyFilter, setResidencyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [agentsList, setAgentsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);
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
            .map((a, index) => {
              const user = a.user || {};
              const profile = a.profile || {};
              
              const padIndex = String(index + 1).padStart(3, '0');
              const fallbackCode = `AGT-${padIndex}`;

              const name = profile.fullName || user.name || a.name || '';
              const firstWord = name.split(' ')[0] || 'agent';
              
              const formatAgentID = (rawId) => {
                if (!rawId || rawId === '—') return '—';
                if (rawId.startsWith('KFPL-AG-') || rawId.startsWith('KFPL-AGT-')) {
                  return rawId.replace('KFPL-AGT-', 'KFPL-AG-');
                }
                const digits = rawId.match(/\d+/);
                if (digits) {
                  let val = parseInt(digits[0], 10);
                  if (val < 1000) {
                    val = 1000 + val;
                  }
                  return `KFPL-AG-${val}`;
                }
                return 'KFPL-AG-1001';
              };

              const cleanCode = user.clientCode || profile.agentId || a.agentId || user._id || a._id || fallbackCode;
              const formattedAgentId = formatAgentID(cleanCode);
              const rawId = formattedAgentId.split('-').pop();
              
              const generatedPassword = `${firstWord.toLowerCase()}@${rawId}`;

              return {
                id: user._id || profile.userId || a._id || a.id,
                name: name || '—',
                email: profile.email || user.email || a.email || '—',
                portalEmail: profile.email || user.email || a.email || '—',
                agentId: formattedAgentId,
                portalPassword: a.portalPassword || profile.portalPassword || user.portalPassword || a.password || profile.password || generatedPassword,
                status: profile.status || (user.isActive ? 'Active' : 'Inactive') || a.status || 'Active',
                residencyStatus: profile.residencyStatus || a.residencyStatus || a.citizenship || '',
              };
            });
          setAgentsList(normalized);
        }
      } catch (err) {
        console.error('Failed to load agents portals:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const filteredAgents = agentsList.filter(agt => {
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const email = (agt.portalEmail || agt.email || '').toLowerCase();
      const name = (agt.name || '').toLowerCase();
      const id = (agt.agentId || '').toLowerCase();
      if (!email.includes(q) && !name.includes(q) && !id.includes(q)) return false;
    }

    if (residencyFilter !== 'all') {
      const isInt = residencyFilter === 'international';
      const actualInt = (agt.residencyStatus || '').toLowerCase() === 'international';
      if (isInt !== actualInt) return false;
    }

    if (statusFilter !== 'all') {
      if ((agt.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
    }

    return true;
  });

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
        <div style={{ color: 'var(--color-navy)', fontSize: '1.2rem', fontWeight: 500 }}>Loading Agent Portals...</div>
      </div>
    );
  }

  return (
    <div className="kfpl-page">
      {/* Page Header */}
      <div className="kfpl-page-header" style={{ marginBottom: '20px' }}>
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">
            Agent Portal Hub
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
          <p className="kfpl-page-subtitle">Manage and copy agent portal access credentials</p>
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
            placeholder="Search by agent ID, name, or email ID..."
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
              {searchQuery.trim() || residencyFilter !== 'all' || statusFilter !== 'all' ? (
                <>Showing <strong>{filteredAgents.length}</strong> of <strong>{agentsList.length}</strong> agents</>
              ) : (
                <>Showing Portal Login Credentials for <strong>{agentsList.length}</strong> agents</>
              )}
            </span>
          </div>
        </div>
        <div className="kfpl-table-scroll">
          <table className="kfpl-table">
            <thead>
              <tr>
                <th>Agent ID</th>
                <th>Agent Name</th>
                <th>Portal Login ID (Email)</th>
                <th>Portal Password</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    No portal credentials found matching your search.
                  </td>
                </tr>
              ) : filteredAgents.map((agt) => (
                <tr key={agt.id}>
                  <td style={{ fontWeight: 600 }}>{agt.agentId}</td>
                  <td style={{ fontWeight: 600 }}>{agt.name}</td>
                  <td><span style={{ fontFamily: 'monospace' }}>{agt.portalEmail || agt.email}</span></td>
                  <td><span style={{ fontFamily: 'monospace', color: 'var(--color-navy-hover)', fontWeight: '600' }}>{agt.portalPassword || 'kfpl@123'}</span></td>
                  <td><Badge status={agt.status}>{agt.status}</Badge></td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        onClick={() => copyPassword(agt.portalEmail || agt.email, agt.portalPassword || 'kfpl@123')}
                        style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                      >
                        Copy Credentials
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ END: AgentPortalMock.jsx ============ */
