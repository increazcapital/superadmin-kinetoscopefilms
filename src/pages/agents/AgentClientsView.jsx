/* ============================================================
   Page: AgentClientsView.jsx
   Description: Lists clients pre-filtered by specific agent
   ============================================================ */

import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import { formatCurrency, getCategoryFromAmount } from '../../utils/formatters';
import { apiRequest } from '../../config/apiHelper';

export default function AgentClientsView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const [agent, setAgent] = useState(null);
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatClientID = (rawId) => {
    if (!rawId || rawId === '—') return 'KFPL-CL-1001';
    const str = String(rawId).trim();
    if (str.toUpperCase().startsWith('KFPL-CL-')) return str.toUpperCase();
    const digits = str.match(/\d+/);
    if (digits) {
      let val = parseInt(digits[0], 10);
      if (val < 1000) val += 1000;
      return `KFPL-CL-${val}`;
    }
    return 'KFPL-CL-1001';
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const [agentData, clientsData] = await Promise.all([
          apiRequest(`/api/super-admin/agents/${id}`).catch(err => {
            console.error('Failed to load agent detail:', err);
            return null;
          }),
          apiRequest(`/api/super-admin/agents/${id}/clients`).catch(err => {
            console.error('Failed to load agent clients list:', err);
            return null;
          })
        ]);

        if (agentData) {
          const extractAgentDetail = (res) => {
            if (!res) return null;
            if (res.agent) return res.agent;
            if (res.data) {
              if (res.data.agent) return res.data.agent;
              return res.data;
            }
            return res;
          };
          setAgent(extractAgentDetail(agentData));
        }

        if (clientsData) {
          const extractClients = (res) => {
            if (!res) return [];
            if (Array.isArray(res)) return res;
            if (res.data) {
              if (Array.isArray(res.data)) return res.data;
              if (res.data.clients && Array.isArray(res.data.clients)) return res.data.clients;
            }
            if (res.clients && Array.isArray(res.clients)) return res.clients;
            return [];
          };
          const rawClients = extractClients(clientsData);
          const normalized = rawClients.map(c => {
            const user = c.user || {};
            const profile = c.profile || {};
            return {
              ...c,
              clientId: formatClientID(c.clientId || user.clientCode || profile.clientCode || '—'),
              id: c.id || c._id || user._id,
              name: c.name || profile.fullName || user.name || '—',
              email: c.email || user.email || profile.email || '—',
              joinDate: c.joinDate || user.createdAt || profile.createdAt || '',
              totalInvestment: c.totalInvestment || 0,
              monthlyRoi: c.monthlyRoi ?? c.roi ?? profile.monthlyRoi ?? 0,
              agentCommission: c.agentCommission || c.agentCommissionMonthly || '',
              riskProfile: c.riskProfile || profile.riskProfile || 'Conservative',
              status: c.status || profile.status || 'active'
            };
          });
          setClientsList(normalized);
        }
      } catch (err) {
        console.error('Failed to load agent clients view:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [id]);

  const agentName = agent?.name || agent?.fullName || location.state?.agentName || 'Agent';

  const formatDateDMY = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '—';
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${mon}/${d.getFullYear()}`;
  };

  const getPerkTier = (amount) => {
    return getCategoryFromAmount(amount);
  };

  const columns = [
    { header: 'Client ID', render: (row) => <span style={{ fontWeight: 700 }}>{row.clientId}</span> },
    { header: 'Join Date', render: (row) => <span>{formatDateDMY(row.joinDate)}</span> },
    {
      header: 'Contract End',
      render: (row) => <span>{formatDateDMY(row.contractEndDate)}</span>,
    },
    {
      header: 'Client Name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--color-navy)' }}>{row.name}</span>,
    },
    { header: 'Email Address', render: (row) => <span style={{ fontSize: '0.8125rem', color: '#475569' }}>{row.email}</span> },
    {
      header: 'Total Investment',
      render: (row) => <span className="font-semibold">{formatCurrency(row.totalInvestment || 0)}</span>,
    },
    {
      header: 'ROI % Allocated',
      render: (row) => {
        const roiPct = row.monthlyRoi || 0;
        return <span style={{ fontWeight: 700, color: '#10b981' }}>{roiPct}%</span>;
      },
    },
    {
      header: 'Perks',
      render: (row) => {
        const perk = getPerkTier(row.totalInvestment || 0);
        return <Badge status={perk}>{perk.toUpperCase()} PERK</Badge>;
      },
    },
    {
      header: 'Agent Commission',
      render: (row) => {
        const comm = row.agentCommission || row.agentCommissionMonthly;
        if (!comm || comm === '—') return <span style={{ color: '#94a3b8' }}>—</span>;
        return (
          <span style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: '#D1FAE5',
            color: '#065F46'
          }}>{comm}</span>
        );
      }
    },
    {
      header: 'Risk Profile',
      render: (row) => {
        const risk = row.riskProfile || 'Conservative';
        const statusMap = {
          'Conservative': 'active',
          'Moderate': 'gold',
          'Aggressive': 'rejected'
        };
        return <Badge status={statusMap[risk]}>{risk}</Badge>;
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
  ];

  return (
    <div className="kfpl-page">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <div className="kfpl-header-breadcrumb" style={{ cursor: 'pointer', marginBottom: '8px' }} onClick={() => navigate('/agents')}>
            <span>Agents</span> / {agentName} / Clients
          </div>
          <h2 className="kfpl-page-title">Clients of {agentName}</h2>
          <p className="kfpl-page-subtitle">Clients brought to the platform by {agentName}</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => navigate('/agents')}>
            Back to Agents
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading agent clients...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={clientsList}
          onRowClick={(row) => navigate(`/investors/${row.id}`)}
          searchPlaceholder="Search clients by name, email, ID..."
        />
      )}
    </div>
  );
}

/* ============ END: AgentClientsView.jsx ============ */
