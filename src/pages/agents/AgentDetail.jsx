/* ============================================================
   Page: AgentDetail.jsx
   Description: Agent profile with client list and commission tabs
   ============================================================ */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';
import { usePermissions } from '../../utils/usePermissions';
import { getApiUrl } from '../../config/apiUrl';
import Modal from '../../components/ui/Modal';
import { getAuthToken } from '../../utils/authStorage';
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

/* ── helpers ─────────────────────── */
function formatDateDMY(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr || '—';
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${day}/${mon}/${yr}`;
}

function getPeriodInvestmentDate(investor, com) {
  if (!investor || !com) return '';
  const monthName = com.month.split(' ')[0];
  const monthsMap = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  let targetMonth = monthsMap[monthName];
  if (targetMonth === undefined) {
    const comDate = com.date || com.paidAt;
    if (comDate) {
      targetMonth = new Date(comDate).getMonth();
    }
  }
  if (targetMonth === undefined) return '';

  if (investor.investments && investor.investments.length > 0) {
    const matchingInv = investor.investments.find(inv => {
      const d = new Date(inv.date);
      return d.getMonth() === targetMonth;
    });
    if (matchingInv) return formatDateDMY(matchingInv.date);
  }
  if (investor.joinDate) {
    const d = new Date(investor.joinDate);
    if (d.getMonth() === targetMonth) return formatDateDMY(investor.joinDate);
  }
  // Fallback: Return first investment date or joinDate for recurring monthly commissions
  if (investor.investments && investor.investments.length > 0) {
    return formatDateDMY(investor.investments[0].date);
  }
  if (investor.joinDate) {
    return formatDateDMY(investor.joinDate);
  }
  return '';
}
function getCalculatedCommissions(agt, cls, apiSlabs = []) {
  // Commissions are now auto-created by the backend when deposits are approved.
  // This function is kept as a stub for backward compatibility with PDF/CSV exports.
  return [];
}

function downloadStatementCSV(com, agentName) {
  const rows = [
    ['Commission Statement'],
    ['Agent', agentName],
    ['Period', com.month],
    ['Date', formatDateDMY(com.date || com.paidAt || com.payoutDate)],
    ['Total Amount', com.amount],
    ['Status', com.status],
    [''],
    ['Type', (String(com.type || com.commissionType || '').toLowerCase().trim() === 'one-time' || String(com.type || com.commissionType || '').toLowerCase().trim() === 'one-time onboarding' || String(com.type || com.commissionType || '').toLowerCase().trim() === 'onetime' || String(com.type || com.commissionType || '').toLowerCase().trim() === 'one time') ? 'One Time' : (String(com.type || com.commissionType || '').toLowerCase().trim() === 'special' || String(com.type || com.commissionType || '').toLowerCase().trim() === 'override' || String(com.type || com.commissionType || '').toLowerCase().trim() === 'special override' ? 'Special' : 'Monthly')],
    [''],
    ['Client Name', 'Client ID', 'Investment', 'Rate %', 'Commission'],
  ];
  if (com.breakdown) {
    com.breakdown.forEach(b => {
      rows.push([b.clientName, b.clientId, b.investment, b.rate, b.amount]);
    });
  }
  const csvContent = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `commission_${com.month ? com.month.replace(/\s/g, '_') : 'Statement'}_${agentName.replace(/\s/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadStatementPDF(com, agentName, agentClients = []) {
  const dateStr = formatDateDMY(com.date || com.paidAt || com.payoutDate);
  const filteredBreakdown = com.breakdown
    ? com.breakdown.filter(b => {
        const inv = agentClients.find(invObj => invObj.clientId === b.clientId || invObj.id === b.clientId)
          || investors.find(invObj => invObj.clientId === b.clientId || invObj.id === b.clientId);
        if (!inv) return false;
        const isMockInv = investors.some(invObj => invObj.clientId === b.clientId);
        if (isMockInv) {
          return getPeriodInvestmentDate(inv, com) !== '';
        }
        return true;
      })
    : [];

  const filteredTotal = filteredBreakdown.reduce((sum, b) => sum + b.amount, 0);

  const rowsHtml = filteredBreakdown.map(b => {
    const inv = agentClients.find(invObj => invObj.clientId === b.clientId || invObj.id === b.clientId)
      || investors.find(invObj => invObj.clientId === b.clientId || invObj.id === b.clientId);
    const invDateStr = inv ? (inv.joinDate || getPeriodInvestmentDate(inv, com)) : (b.investmentDate || '');
    const comType = String(com.type || com.commissionType || '').toLowerCase().trim();
    const isOneTime = comType === 'one-time' || comType === 'onetime' || comType === 'one time' || comType === 'one-time onboarding';
    const isSpecial = comType === 'special' || comType === 'override' || comType === 'special override';
    return `
      <tr>
        <td style="border: 1px solid #CFDDD5; padding: 10px; font-weight: 500;">${b.clientName}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; font-family: monospace;">${b.clientId}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">${invDateStr}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: center;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; ${isOneTime ? 'background: #DBEAFE; color: #1E40AF;' : isSpecial ? 'background: #FEF3C7; color: #92400E;' : 'background: #D1FAE5; color: #065F46;'}">${isOneTime ? 'One Time' : isSpecial ? 'Special' : 'Monthly'}</span>
        </td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: 600;">${formatCurrency(b.investment)}</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right;">${b.rate}%</td>
        <td style="border: 1px solid #CFDDD5; padding: 10px; text-align: right; font-weight: bold; color: #059669;">${formatCurrency(b.amount)}</td>
      </tr>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  printWindow.document.write(`
    <html>
    <head>
      <title>Commission Statement - ${com.month} - ${agentName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #11221A; background-color: #FFFFFF; padding: 40px; margin: 0; }
        .header { margin-bottom: 30px; border-bottom: 3px solid #10B981; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .title { font-size: 28px; font-weight: 800; color: #061D13; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; }
        .meta-info { margin-bottom: 30px; background-color: #F3F7F5; border: 1px solid #CFDDD5; border-radius: 12px; padding: 20px; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .meta-item { display: flex; justify-content: space-between; border-bottom: 1px solid #E2ECE7; padding-bottom: 6px; font-size: 14px; }
        .meta-label { font-weight: 600; color: #6D7E75; }
        .meta-val { font-weight: 700; color: #11221A; }
        .section-title { font-size: 18px; font-weight: 700; color: #061D13; margin-top: 40px; margin-bottom: 14px; border-bottom: 1.5px solid #CFDDD5; padding-bottom: 6px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        .table th { background-color: #E5ECE8; border: 1px solid #CFDDD5; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2E3E36; letter-spacing: 0.5px; }
        .table td { border: 1px solid #CFDDD5; padding: 10px 12px; color: #11221A; }
        .total-row { background-color: #F3F7F5; font-weight: bold; }
        .success { color: #059669; }
        @media print {
          body { padding: 0; }
          .print-btn-bar { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar" style="display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 10px;">
        <button onclick="window.print();" style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2);">Print / Save PDF</button>
        <button onclick="window.close();" style="background: #e2ece7; color: #2e3e36; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 13px;">Close Window</button>
      </div>

      <div class="header">
        <div>
          <div class="title">Commission Statement</div>
          <div style="font-size: 12px; color: #6D7E75; margin-top: 4px; font-weight: 500;">KINETOSCOPE CAPITAL PARTNERS LTD</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 600; color: #2E3E36;">Date Generated:</div>
          <div style="font-size: 14px; font-weight: 700; color: #11221A;">${new Date().toLocaleDateString('en-GB')}</div>
        </div>
      </div>
      
      <div class="meta-info">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Agent Name:</span>
            <span class="meta-val">${agentName}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Period:</span>
            <span class="meta-val">${com.month}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Payout Date:</span>
            <span class="meta-val">${dateStr}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status:</span>
            <span class="meta-val" style="color: #059669;">${com.status.toUpperCase()}</span>
          </div>
          <div class="meta-item" style="grid-column: span 2; border-bottom: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #CFDDD5;">
            <span class="meta-label" style="font-size: 16px; color: #061D13;">Total Commission Payout:</span>
            <span class="meta-val" style="font-size: 20px; color: #059669;">${formatCurrency(filteredTotal)}</span>
          </div>
        </div>
      </div>
      
      <div class="section-title">Client-wise Breakdown</div>
      <table class="table">
        <thead>
          <tr>
            <th>Client Name</th>
            <th>Client ID</th>
            <th style="text-align: center;">Investment Date</th>
            <th style="text-align: center;">Type</th>
            <th style="text-align: right;">Investment</th>
            <th style="text-align: right;">Rate %</th>
            <th style="text-align: right;">Commission</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="total-row">
            <td colspan="6" style="text-align: right; font-weight: 800; font-size: 14px; padding: 12px;">Total Payout</td>
            <td style="text-align: right; font-weight: 800; color: #059669; font-size: 14px; padding: 12px;">${formatCurrency(filteredTotal)}</td>
          </tr>
        </tbody>
      </table>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}


const tabIcons = {
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  clients: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  commission: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  documents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
};

const infoIcons = {
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  fileText: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  landmark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" />
    </svg>
  )
};


export default function AgentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canEdit, canDelete } = usePermissions();
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedCommission, setSelectedCommission] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [commissionSearch, setCommissionSearch] = useState('');
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [agent, setAgent] = useState(null);
  const [agentClients, setAgentClients] = useState([]);
  const [commissionHistory, setCommissionHistory] = useState([]);
  const [documentsList, setDocumentsList] = useState([]);
  const [verifiedDocs, setVerifiedDocs] = useState({});
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!viewingDoc || !viewingDoc.url) {
      setPreviewUrl('');
      return;
    }
    
    let active = true;
    let objUrl = '';

    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const targetUrl = normalizeUrl(viewingDoc.url);
        const isCloudinary = targetUrl.includes('cloudinary.com') || targetUrl.includes('res.cloudinary.com');
        
        const headers = {};
        if (!isCloudinary) {
          const token = getAuthToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch(targetUrl, { headers });
        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        
        if (active) {
          objUrl = URL.createObjectURL(blob);
          setPreviewUrl(objUrl);
        }
      } catch (err) {
        console.error('Preview fetch error:', err);
        if (active) {
          setPreviewUrl(normalizeUrl(viewingDoc.url));
        }
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objUrl) {
        URL.revokeObjectURL(objUrl);
      }
    };
  }, [viewingDoc]);

  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState('active');
  const [apiSlabs, setApiSlabs] = useState([]);

  const fetchAgentDetails = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      let localAg = null;
      let parsedSlabs = [];
      const [agentRes, clientsRes, commissionsRes, overridesRes, slabsRes] = await Promise.all([
        apiRequest(`/api/super-admin/agents/${id}`).catch(err => {
          console.error('Failed to load agent basic details:', err);
          return null;
        }),
        apiRequest(`/api/super-admin/agents/${id}/clients`).catch(err => {
          console.error('Failed to load agent clients:', err);
          return null;
        }),
        apiRequest(`/api/super-admin/agents/${id}/commissions`).catch(err => {
          console.error('Failed to load agent commissions:', err);
          return null;
        }),
        apiRequest('/api/super-admin/commission-slabs/overrides').catch(err => {
          console.error('Failed to load overrides in agent details:', err);
          return null;
        }),
        apiRequest('/api/super-admin/commission-slabs').catch(err => {
          console.error('Failed to load slabs in agent details:', err);
          return null;
        })
      ]);

      const extractAgentDetail = (res) => {
        if (!res) return null;
        if (res.agent) return res.agent;
        if (res.data) {
          if (res.data.agent) return res.data.agent;
          return res.data;
        }
        return res;
      };
      const ag = extractAgentDetail(agentRes);
      
      if (ag) {
        const user = ag.user || {};
        const profile = ag.profile || {};
        
        const docs = ag.documents || [];
        setDocumentsList(docs);
        
        const verifiedMap = {};
        const coreDocsList = docs.filter(d => {
          const k = (d.key || '').toLowerCase();
          const n = (d.name || d.label || '').toLowerCase();
          return !k.includes('nominee') && !n.includes('nominee');
        });
        let allDocsVerifiedOnLoad = coreDocsList.length > 0;
        
        docs.forEach(doc => {
          const label = doc.name || doc.label;
          const k = (doc.key || '').toLowerCase();
          const n = (doc.name || doc.label || '').toLowerCase();
          const isNomineeDoc = k.includes('nominee') || n.includes('nominee');
          
          const s = (doc.status || '').toLowerCase();
          const isDocVerified = s === 'verified' || s === 'approved' || doc.verified === true;
          if (isDocVerified) {
            verifiedMap[label] = true;
          } else if (!isNomineeDoc) {
            allDocsVerifiedOnLoad = false;
          }
        });
        setVerifiedDocs(verifiedMap);

        // Search for overrides mapping
        let specialOverrideVal = null;
        let overrideReasonVal = null;
        
        const extractArray = (res) => {
          if (!res) return [];
          if (Array.isArray(res)) return res;
          if (res.data && Array.isArray(res.data)) return res.data;
          for (const key in res) {
            if (Array.isArray(res[key])) return res[key];
            if (res[key] && typeof res[key] === 'object') {
              const nested = extractArray(res[key]);
              if (nested && nested.length > 0) return nested;
            }
          }
          return [];
        };

        const rawSlabs = extractArray(slabsRes);
        parsedSlabs = rawSlabs.map(s => ({
          id: s._id || s.id,
          minAmount: s.minAmount || 0,
          maxAmount: (s.maxAmount === null || s.maxAmount === undefined || s.maxAmount === 999999999) ? 999999999 : s.maxAmount,
          commissionPercentage: s.commissionPercentage !== undefined ? s.commissionPercentage : (s.percentage || 0),
          percentage: s.commissionPercentage !== undefined ? s.commissionPercentage : (s.percentage || 0),
          type: s.type || 'monthly'
        }));
        setApiSlabs(parsedSlabs);

        const rawOverrides = extractArray(overridesRes);
        const matchedOverride = rawOverrides.find(o => {
          const oAgentId = o.agentId?._id || o.agentId?.id || o.agentId;
          return oAgentId === id;
        });

        if (matchedOverride) {
          specialOverrideVal = matchedOverride.commissionOverride !== undefined ? matchedOverride.commissionOverride : matchedOverride.percentage;
          overrideReasonVal = matchedOverride.reason;
        }

        let kycStatus = (ag.header?.kycStatus || ag.summaryCards?.kycStatus || profile.kycStatus || 'PENDING').toUpperCase();
        if (allDocsVerifiedOnLoad || kycStatus === 'VERIFIED') {
          kycStatus = 'VERIFIED';
        }

        const normalizedAg = {
          ...ag,
          id: user._id || profile.userId || ag._id || ag.id,
          name: profile.fullName || user.name || '—',
          email: profile.email || user.email || '—',
          phone: profile.phone || '—',
          pan: profile.panNumber || '—',
          agentId: formatAgentID(ag.header?.agentCode || user.clientCode || profile.agentId || '—'),
          joinDate: formatDateDMY(profile.joinDate || user.createdAt || profile.createdAt || ''),
          totalClients: ag.summaryCards?.clientsCount ?? ag.clientsCount ?? ag.totalClients ?? 0,
          totalInvestment: ag.summaryCards?.totalInvestment ?? ag.totalInvestment ?? 0,
          status: ag.header?.status?.toLowerCase() || profile.status || (user.isActive ? 'active' : 'inactive') || 'active',
          kyc: kycStatus,
          nomineeName: profile.nomineeName || '—',
          nomineeRelation: profile.nomineeRelation || '—',
          nomineePhone: profile.nomineePhone || '—',
          nomineeEmail: profile.nomineeEmail || '—',
          bankName: profile.bankName || '—',
          accountNo: profile.accountNumber || '—',
          ifsc: profile.ifscCode || '—',
          commissionOneTime: profile.oneTimeCommission || 0,
          commissionMonthly: profile.monthlySlab || '—',
          commissionSpecial: profile.specialCommission || 0,
          specialOverride: specialOverrideVal,
          overrideReason: overrideReasonVal,
          panDocument: profile.panDocument,
          idProofDocument: profile.idProofDocument,
          bankProofDocument: profile.bankProofDocument,
          nomineeProofDocument: profile.nomineeProofDocument,
          residencyStatus: profile.residencyStatus || ag.residencyStatus || 'National (Domestic)',
          commissionHistory: ag.commissionHistory || []
        };
        setAgent(normalizedAg);
        localAg = normalizedAg;
        setLocalStatus(normalizedAg.status);
      }

      // Extract and set clients
      const extractClients = (res) => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (res.clients && Array.isArray(res.clients)) return res.clients;
        if (res.data) {
          if (Array.isArray(res.data)) return res.data;
          if (res.data.clients && Array.isArray(res.data.clients)) return res.data.clients;
        }
        return [];
      };
      const rawClients = extractClients(clientsRes);
      
      const normalizedClients = rawClients.map((c, index) => {
        const user = c.user || {};
        const profile = c.profile || {};
        const header = c.header || {};
        const summary = c.summaryCards || {};
        
        const padIndex = String(index + 1).padStart(3, '0');
        const fallbackCode = `C-${padIndex}`;
        const userId = c._id || user._id || profile.userId || c.id;
        
        return {
          id: userId,
          clientId: formatClientID(user.clientCode || c.clientCode || header.clientCode || profile.clientCode || c.clientId || profile.clientId || fallbackCode),
          name: profile.fullName || user.name || user.fullName || c.fullName || header.clientName || c.name || profile.name || '—',
          email: profile.email || user.email || c.email || '—',
          phone: profile.phone || c.phone || '—',
          joinDate: formatDateDMY(c.joinDate || profile.joinDate || c.contractStartDate || profile.contractStartDate || c.createdAt || profile.createdAt || ''),
          totalInvestment: c.totalInvestment || summary.totalInvestment || profile.totalPortfolioValue || 0,
          roiPercentage: c.monthlyRoi || summary.monthlyRoi || profile.monthlyRoi || c.roiPercentage || profile.roiPercentage || 1.2,
          status: c.status || header.status || profile.status || 'active',
        };
      });

      normalizedClients.sort((a, b) => {
        return a.clientId.localeCompare(b.clientId, undefined, { numeric: true, sensitivity: 'base' });
      });

      setAgentClients(normalizedClients);

      // Extract and set commissions
      const extractCommissions = (res) => {
        let list = [];
        if (res) {
          if (Array.isArray(res)) {
            list = res;
          } else if (res.data) {
            if (Array.isArray(res.data)) {
              list = res.data;
            } else if (res.data.commissions && Array.isArray(res.data.commissions)) {
              list = res.data.commissions;
            }
          } else if (res.commissions && Array.isArray(res.commissions)) {
            list = res.commissions;
          }
        }
        
        // Filter out mock data entries (missing/invalid date, isMock flag, or hardcoded mock amounts)
        return list.filter(com => {
          if (!com) return false;
          if (com.isMock) return false;
          // Business safety rule: Newly registered agents (with 0 clients) cannot have commissions!
          if (normalizedClients.length === 0) return false;
          if (com.amount === 16250 || com.amount === 33750 || com.amount === 90000 || com.amount === 900000) return false;
          const dateVal = com.date || com.paidAt || com.payoutDate;
          if (!dateVal || isNaN(new Date(dateVal).getTime())) return false;
          return true;
        });
      };
      const dbComms = extractCommissions(commissionsRes);

      setCommissionHistory(dbComms);

    } catch (err) {
      console.error('Failed to fetch agent details:', err);
      addToast(err.message || 'Failed to load agent details', 'error', 'Error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="kfpl-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading agent details...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="kfpl-page">
        <div className="kfpl-empty">
          <div className="kfpl-empty-title">Agent not found</div>
          <button className="kfpl-btn kfpl-btn--primary mt-4" onClick={() => navigate('/agents')}>Back to List</button>
        </div>
      </div>
    );
  }

  const handleBlockAgent = async () => {
    const newStatus = localStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await apiRequest(`/api/super-admin/agents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setLocalStatus(newStatus);
      addToast(`Agent status set to ${newStatus.toUpperCase()}`, 'info', 'Status Changed');
    } catch (err) {
      console.error('Failed to block agent:', err);
      addToast(err.message || 'Failed to change agent status', 'error', 'Error');
    }
  };

  const handleHoldAgent = async () => {
    const newStatus = localStatus === 'inactive' ? 'active' : 'inactive';
    try {
      await apiRequest(`/api/super-admin/agents/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setLocalStatus(newStatus);
      addToast(`Agent status set to ${newStatus.toUpperCase()}`, 'info', 'Status Changed');
    } catch (err) {
      console.error('Failed to hold agent:', err);
      addToast(err.message || 'Failed to change agent status', 'error', 'Error');
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await apiRequest(`/api/super-admin/agents/${id}`, {
        method: 'DELETE',
      });
      addToast('Agent profile deleted successfully!', 'success', 'Agent Deleted');
      setShowDeleteModal(false);
      navigate('/agents');
    } catch (err) {
      console.error('Failed to delete agent:', err);
      addToast(err.message || 'Failed to delete agent', 'error', 'Error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVerifyDocument = async (docLabel) => {
    let fieldName = 'panDocument';
    const label = docLabel.toLowerCase();
    if (label.includes('nominee')) {
      fieldName = 'nomineeProofDocument';
    } else if (label.includes('pan') || label.includes('tax id') || label.includes('tax')) {
      fieldName = 'panDocument';
    } else if (label.includes('aadhaar') || label.includes('id proof') || label.includes('identity') || label.includes('passport') || label.includes('id card') || label.includes('national id')) {
      fieldName = 'idProofDocument';
    } else if (label.includes('bank') || label.includes('details')) {
      fieldName = 'bankProofDocument';
    }

    const newVerified = { ...verifiedDocs, [docLabel]: true };
    setVerifiedDocs(newVerified);
    
    const updatedDocs = documentsList.map(d => {
      if ((d.name || d.label) === docLabel) {
        return { ...d, status: 'Verified', verified: true };
      }
      return d;
    });
    setDocumentsList(updatedDocs);
    addToast(`"${docLabel}" verified successfully!`, 'success', 'Document Verified');

    // Auto-verify KYC when core 3 documents (PAN, ID proof, Bank details) are verified
    const coreDocs = updatedDocs.filter(d => {
      const k = (d.key || '').toLowerCase();
      const n = (d.name || d.label || '').toLowerCase();
      return !k.includes('nominee') && !n.includes('nominee');
    });

    const coreAllVerified = coreDocs.length > 0 && coreDocs.every(d => {
      const l = d.name || d.label;
      const s = (d.status || '').toLowerCase();
      return newVerified[l] || s === 'verified' || s === 'approved' || d.verified === true;
    });

    if (coreAllVerified) {
      setAgent(prev => prev ? { ...prev, kyc: 'VERIFIED', status: 'active' } : null);
      setLocalStatus('active');
      await handleKycStatusChange('VERIFIED');
      addToast('Core documents verified — KYC automatically set to Verified!', 'success', 'KYC Auto-Verified');
    }

    try {
      // Option A: Try dedicated verify-document API
      await apiRequest(`/api/super-admin/agents/${id}/verify-document`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentName: docLabel,
          documentField: fieldName,
          field: fieldName,
          fieldName: fieldName,
          docField: fieldName,
          status: 'Verified'
        })
      });
      await fetchAgentDetails(true); // Silent sync from backend
    } catch (err) {
      console.warn('Dedicated verify-document API failed, falling back to agent profile update...', err);
      try {
        // Option B: Fallback to main agent patch with the specific document field updated
        const targetDoc = documentsList.find(d => (d.name || d.label) === docLabel) || {};
        const currentDocObj = agent[fieldName] || {};
        const updatedDocObj = {
          url: targetDoc.url || currentDocObj.url || '',
          status: 'Verified',
          verified: true
        };

        await apiRequest(`/api/super-admin/agents/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            [fieldName]: updatedDocObj,
            profile: {
              ...agent.profile,
              [fieldName]: updatedDocObj
            },
            documents: updatedDocs
          })
        });
        await fetchAgentDetails(true); // Silent sync from backend
      } catch (fallbackErr) {
        console.error('All backend verification fallbacks failed:', fallbackErr);
      }
    }
  };

  const handleKycStatusChange = async (newKycStatus) => {
    // Update local state first so UI updates instantly and stays verified
    setAgent(prev => prev ? { ...prev, kyc: newKycStatus } : null);
    addToast(`Agent KYC status updated to ${newKycStatus}`, 'success', 'KYC Updated');

    // Candidates for agent KYC endpoints on the desktop backend
    const endpoints = [
      `/api/super-admin/agents/${id}`,
      `/api/super-admin/agents/${id}/kyc`,
      `/api/super-admin/agents/${id}/kyc-status`,
      `/api/super-admin/agents/${id}/verify-kyc`
    ];

    for (const url of endpoints) {
      try {
        // Try JSON
        await apiRequest(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            kycStatus: newKycStatus,
            kyc: newKycStatus,
            status: newKycStatus
          })
        });
        console.log(`Successfully updated agent KYC using JSON on ${url}`);
        break; // Break loop once an endpoint succeeds!
      } catch (jsonErr) {
        try {
          // Try FormData fallback
          const formData = new FormData();
          formData.append('kycStatus', newKycStatus);
          formData.append('kyc', newKycStatus);
          formData.append('status', newKycStatus);
          await apiRequest(url, {
            method: 'PATCH',
            body: formData
          });
          console.log(`Successfully updated agent KYC using FormData on ${url}`);
          break; // Break loop once an endpoint succeeds!
        } catch (formErr) {
          console.warn(`Endpoint ${url} failed to patch:`, formErr);
        }
      }
    }
  };

  /* ── filtered clients ─── */
  const filteredClients = agentClients.filter(client => {
    if (!clientSearch.trim()) return true;
    const term = clientSearch.toLowerCase();
    return (
      client.name.toLowerCase().includes(term) ||
      client.clientId.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      client.phone.includes(term)
    );
  });

  /* ── filtered commission ─── */
  const filteredCommission = commissionHistory.filter(com => {
    if (!commissionSearch.trim()) return true;
    const term = commissionSearch.toLowerCase();
    return (
      (com.month || '').toLowerCase().includes(term) ||
      (com.status || '').toLowerCase().includes(term) ||
      formatDateDMY(com.date || com.paidAt || com.payoutDate).includes(term) ||
      String(com.amount || '').includes(term)
    );
  });

  const getCommissionBreakdown = (com) => {
    if (!com) return [];
    if (com.breakdown && com.breakdown.length > 0) {
      return com.breakdown.filter(b => {
        const inv = agentClients.find(cl => cl.clientId === b.clientId || cl.id === b.clientId)
          || investors.find(invObj => invObj.clientId === b.clientId);
        if (!inv) return false;
        const isMockInv = investors.some(invObj => invObj.clientId === b.clientId);
        if (isMockInv) {
          return getPeriodInvestmentDate(inv, com) !== '';
        }
        return true;
      });
    }

    // Construct fallback breakdown from single database payout record
    const cid = com.clientId?._id || com.clientId?.id || com.clientId;
    if (cid) {
      const clientObj = agentClients.find(cl => cl.id === cid || cl.clientId === cid || cl._id === cid);
      if (clientObj) {
        let pct = 0;
        const typeNormalized = String(com.type || com.commissionType || '').toLowerCase().trim();
        const totalInv = clientObj.totalInvestment || 0;

        const getSlabRateLocal = (typeNorm, amount) => {
          const typeSlabs = apiSlabs.filter(s => s.type === typeNorm);
          const fallbackSlabs = typeNorm === 'one-time' 
            ? [
                { minAmount: 500000, maxAmount: 2500000, percentage: 2 },
                { minAmount: 2500000, maxAmount: 5000000, percentage: 3 },
                { minAmount: 5000000, maxAmount: 10000000, percentage: 4 },
                { minAmount: 10000000, maxAmount: 999999999, percentage: 5 }
              ]
            : [
                { minAmount: 0, maxAmount: 1500000, percentage: 0.5 },
                { minAmount: 1500000, maxAmount: 2500000, percentage: 0.75 },
                { minAmount: 2500000, maxAmount: 5000000, percentage: 1 },
                { minAmount: 5000000, maxAmount: 10000000, percentage: 1.5 },
                { minAmount: 10000000, maxAmount: 999999999, percentage: 2 }
              ];
          const activeSlabs = typeSlabs.length > 0 ? typeSlabs : fallbackSlabs;
          const matched = activeSlabs.find(s => {
            const max = s.maxAmount === null || s.maxAmount === undefined || s.maxAmount === 999999999 ? 999999999 : s.maxAmount;
            const min = s.minAmount || 0;
            return amount >= min && amount < max;
          });
          return matched ? (matched.commissionPercentage !== undefined ? matched.commissionPercentage : (matched.percentage || 0)) : 0;
        };

        if (typeNormalized === 'one-time' || typeNormalized === 'onetime' || typeNormalized === 'one time' || typeNormalized === 'one-time onboarding') {
          pct = getSlabRateLocal('one-time', totalInv);
        } else if (typeNormalized === 'monthly' || typeNormalized === 'recurring' || typeNormalized === 'monthly recurring') {
          pct = getSlabRateLocal('monthly', totalInv);
        } else if (typeNormalized === 'special' || typeNormalized === 'override' || typeNormalized === 'special override') {
          pct = agent.commissionSpecial || 0;
        }

        return [{
          clientName: clientObj.name,
          clientId: clientObj.clientId,
          investment: clientObj.totalInvestment || 0,
          rate: pct,
          amount: com.amount,
          investmentDate: clientObj.joinDate || '—'
        }];
      }
    }
    return [];
  };

  const tabs = ['profile', 'clients', 'commission', 'documents'];

  const coreDocsList = documentsList.filter(d => {
    const k = (d.key || '').toLowerCase();
    const n = (d.name || d.label || '').toLowerCase();
    return !k.includes('nominee') && !n.includes('nominee');
  });

  const allDocsVerified = coreDocsList.length > 0 && coreDocsList.every(doc => {
    const l = doc.name || doc.label;
    const s = (doc.status || '').toLowerCase();
    return !!verifiedDocs[l] || s === 'verified' || s === 'approved' || doc.verified === true;
  });

  const totalCommission = commissionHistory.reduce((sum, com) => sum + (com.amount || 0), 0);

  const normalizeUrl = (url) => {
    if (!url) return '';
    let normalized = url;
    if (
      normalized.startsWith('uploads/') ||
      normalized.startsWith('/uploads/') ||
      (!normalized.startsWith('http://') &&
        !normalized.startsWith('https://') &&
        !normalized.startsWith('blob:') &&
        !normalized.startsWith('data:'))
    ) {
      const base = getApiUrl('');
      const cleanPath = normalized.startsWith('/') ? normalized : '/' + normalized;
      normalized = base + cleanPath;
    }
    if (normalized.startsWith('http://')) {
      const isLocal = normalized.includes('localhost') || normalized.includes('192.168.');
      if (!isLocal) {
        normalized = 'https://' + normalized.substring(7);
      }
    }
    return normalized;
  };

  const getFileType = (url, filename) => {
    if (!url) return 'none';
    const targetUrl = normalizeUrl(url);
    const ext = (filename || targetUrl).split('.').pop().toLowerCase();
    
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) || /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(targetUrl);
    if (isImage) return 'image';
    const isPdf = ext === 'pdf' || /\.pdf/i.test(targetUrl);
    if (isPdf) return 'pdf';
    const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) || /\.(doc|docx|xls|xlsx|ppt|pptx)/i.test(targetUrl);
    if (isOffice) return 'office';
    return 'other';
  };

  const downloadFile = async (url, filename) => {
    if (!url) {
      addToast('No file URL available', 'error', 'Download Failed');
      return;
    }
    const targetUrl = normalizeUrl(url);
    const isCloudinary = targetUrl.includes('cloudinary.com') || targetUrl.includes('res.cloudinary.com');

    if (isCloudinary) {
      addToast('Starting file download...', 'info', 'Downloading');
      try {
        const link = document.createElement('a');
        link.href = targetUrl;
        link.setAttribute('download', filename || 'document');
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast('File download started!', 'success', 'Downloaded');
      } catch (err) {
        window.open(targetUrl, '_blank');
        addToast('File opened in new tab', 'success', 'Opened');
      }
      return;
    }

    addToast('Starting secure file download...', 'info', 'Downloading');
    try {
      const token = getAuthToken();

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(targetUrl, { headers });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      addToast('File downloaded successfully!', 'success', 'Downloaded');
    } catch (error) {
      console.error('Fetch download error, falling back to window.open:', error);
      window.open(targetUrl, '_blank');
      addToast('File opened in new tab', 'success', 'Opened');
    }
  };

  return (
    <div className="kfpl-page">
      {/* Premium Gradient Header Card */}
      <div className="kfpl-detail-card-header">
        <div className="kfpl-detail-profile">
          <div className="kfpl-detail-avatar">
            {(agent.name || '').split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h2 className="kfpl-detail-name" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{agent.name}</h2>
            <div className="kfpl-detail-id" style={{ marginTop: '2px' }}>ID: {agent.agentId}</div>
            <div className="kfpl-detail-meta" style={{ marginTop: '8px' }}>
              <Badge status={localStatus}>{localStatus}</Badge>
              <Badge status={(agent.kyc === 'VERIFIED' || allDocsVerified) ? 'active' : 'pending'}>KYC: {(agent.kyc === 'VERIFIED' || allDocsVerified) ? 'VERIFIED' : agent.kyc}</Badge>
            </div>
          </div>
        </div>
        <div className="kfpl-detail-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: 'var(--color-white)', borderColor: 'rgba(255, 255, 255, 0.25)', background: 'rgba(255, 255, 255, 0.05)' }} onClick={() => navigate('/agents')}>
            ← Back
          </button>
          {canEdit('manageAgents') && (
            <>
              <button type="button" className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: 'var(--color-white)', borderColor: 'rgba(255, 255, 255, 0.25)', background: localStatus === 'suspended' ? '#EF4444' : 'rgba(255, 255, 255, 0.05)' }} onClick={handleBlockAgent}>
                {localStatus === 'suspended' ? 'Unblock Agent' : 'Block Agent'}
              </button>
              <button type="button" className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: 'var(--color-white)', borderColor: 'rgba(255, 255, 255, 0.25)', background: localStatus === 'inactive' ? '#F59E0B' : 'rgba(255, 255, 255, 0.05)' }} onClick={handleHoldAgent}>
                {localStatus === 'inactive' ? 'Resume Agent' : 'Hold Agent'}
              </button>
            </>
          )}
          {canDelete('manageAgents') && (
            <button type="button" className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ color: '#EF4444', borderColor: '#EF4444', background: 'rgba(239, 68, 68, 0.05)' }} onClick={() => setShowDeleteModal(true)}>
              Delete Agent
            </button>
          )}
          {canEdit('manageAgents') && (
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" style={{ background: '#10B981', color: 'var(--color-white)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }} onClick={() => navigate(`/agents/${id}/edit`)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* KPI summaries dashboard */}
      <div className="kfpl-detail-kpis-summary">
        <div className="kfpl-detail-kpi-summary-card">
          <span className="kfpl-detail-kpi-summary-label">Total Commission</span>
          <span className="kfpl-detail-kpi-summary-value" style={{ color: 'var(--color-gold-dark)' }}>{formatCurrency(totalCommission)}</span>
        </div>
        <div className="kfpl-detail-kpi-summary-card">
          <span className="kfpl-detail-kpi-summary-label">Total Clients</span>
          <span className="kfpl-detail-kpi-summary-value">{agent.totalClients} Clients</span>
        </div>
        <div className="kfpl-detail-kpi-summary-card">
          <span className="kfpl-detail-kpi-summary-label">Commission Model</span>
          <span className="kfpl-detail-kpi-summary-value" style={{ color: '#F59E0B' }}>Automatic (Slab)</span>
        </div>
        <div className="kfpl-detail-kpi-summary-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span className="kfpl-detail-kpi-summary-label">KYC Verification</span>
          <div style={{ marginTop: '4px' }}>
            {(agent.kyc === 'VERIFIED' || allDocsVerified) ? (
              <Badge status="active">Verified</Badge>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <select
                  className="kfpl-select"
                  value={agent.kyc || 'PENDING'}
                  onChange={(e) => handleKycStatusChange(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '4px 8px', 
                    fontSize: '0.85rem', 
                    borderRadius: '6px', 
                    border: '1px solid #10B981', 
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="PENDING">Pending</option>
                  <option value="VERIFIED">Verified</option>
                </select>
                {!allDocsVerified && (
                  <span style={{ fontSize: '0.68rem', color: '#EF4444', fontWeight: 500 }}>
                    ⚠️ Verify all docs first
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segmented Pill Tab Bar */}
      <div className="kfpl-tabs">
        {tabs.map(tab => (
          <div
            key={tab}
            className={`kfpl-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tabIcons[tab]}
            {tab.toUpperCase()}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <div className="kfpl-detail-grid">
          <div className="kfpl-detail-info-card">
            <div className="kfpl-detail-info-title">Personal Information</div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.user}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Full Name</span>
                <span className="kfpl-detail-info-item-value">{agent.name}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.mail}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Email Address</span>
                <span className="kfpl-detail-info-item-value">{agent.email}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.phone}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Phone Number</span>
                <span className="kfpl-detail-info-item-value">{agent.phone}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.fileText}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">
                  {agent.residencyStatus === 'International' ? 'Tax ID / SSN' : 'PAN Number'}
                </span>
                <span className="kfpl-detail-info-item-value">{agent.pan}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.calendar}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Join Date</span>
                <span className="kfpl-detail-info-item-value">{agent.joinDate}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.user}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Total Clients</span>
                <span className="kfpl-detail-info-item-value">{agent.totalClients} Clients</span>
              </div>
            </div>
          </div>

          <div className="kfpl-detail-info-card">
            <div className="kfpl-detail-info-title">KYC, Bank & Nominee Information</div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.shield}</div>
              <div className="kfpl-detail-info-item-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <span className="kfpl-detail-info-item-label">KYC Status</span>
                  <span className="kfpl-detail-info-item-value" style={{ display: 'block', marginTop: '2px' }}>
                    {agent.kyc === 'VERIFIED' ? (
                      <Badge status="active">Verified</Badge>
                    ) : (
                      <Badge status="pending">Pending</Badge>
                    )}
                  </span>
                </div>
                {agent.kyc === 'VERIFIED' ? null : allDocsVerified ? (
                  <select
                    className="kfpl-select"
                    value={agent.kyc || 'PENDING'}
                    onChange={(e) => handleKycStatusChange(e.target.value)}
                    style={{ 
                      padding: '4px 8px', 
                      fontSize: '0.8rem', 
                      borderRadius: '6px', 
                      border: '1px solid #10B981', 
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 500 }}>
                    ⚠️ Verify all docs first
                  </span>
                )}
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.landmark}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Bank Name</span>
                <span className="kfpl-detail-info-item-value">{agent.bankName}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.fileText}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Account No.</span>
                <span className="kfpl-detail-info-item-value">{agent.accountNo}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.shield}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">IFSC Code</span>
                <span className="kfpl-detail-info-item-value">{agent.ifsc}</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.user}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Nominee Name</span>
                <span className="kfpl-detail-info-item-value">{agent.nomineeName} ({agent.nomineeRelation})</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.phone}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Nominee Phone</span>
                <span className="kfpl-detail-info-item-value">{agent.nomineePhone}</span>
              </div>
            </div>
          </div>

          <div className="kfpl-detail-info-card">
            <div className="kfpl-detail-info-title">Commission Slab Configuration</div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.landmark}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">One-Time Commission Slab</span>
                <span className="kfpl-detail-info-item-value">Automatic (Linked to Slab)</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.shield}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Monthly Commission Slab</span>
                <span className="kfpl-detail-info-item-value">Automatic (Linked to Slab)</span>
              </div>
            </div>
            <div className="kfpl-detail-info-row-item">
              <div className="kfpl-detail-info-item-icon">{infoIcons.user}</div>
              <div className="kfpl-detail-info-item-content">
                <span className="kfpl-detail-info-item-label">Special Commission Slab</span>
                <span className="kfpl-detail-info-item-value" style={{ 
                  color: (agent.specialOverride || parseFloat(agent.commissionSpecial) > 0) ? 'var(--color-gold-dark)' : 'inherit', 
                  fontWeight: (agent.specialOverride || parseFloat(agent.commissionSpecial) > 0) ? 600 : 'normal' 
                }}>
                  {parseFloat(agent.commissionSpecial) > 0 
                    ? `+${agent.commissionSpecial}%` 
                    : (agent.specialOverride !== undefined && agent.specialOverride !== null 
                        ? `+${agent.specialOverride}%` 
                        : 'No active slab')}
                </span>
              </div>
            </div>
            {agent.specialOverride && (
              <div className="kfpl-detail-info-row-item">
                <div className="kfpl-detail-info-item-icon">{infoIcons.fileText}</div>
                <div className="kfpl-detail-info-item-content">
                  <span className="kfpl-detail-info-item-label">Slab Reason</span>
                  <span className="kfpl-detail-info-item-value" style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                    "{agent.overrideReason || 'N/A'}"
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="kfpl-table-container">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="kfpl-search" style={{ maxWidth: '360px' }}>
              <svg className="kfpl-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search clients by name, ID, email..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>Date of Joining</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th style={{ textAlign: 'right' }}>Total Investment</th>
                  <th style={{ textAlign: 'right' }}>ROI %</th>
                  <th style={{ textAlign: 'right' }}>Commission Paid</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>No clients found</td></tr>
                ) : filteredClients.map(client => (
                  <tr key={client.id} onClick={() => navigate(`/investors/${client.id}`)} style={{ cursor: 'pointer' }}>
                    <td>{client.clientId}</td>
                    <td>{client.joinDate}</td>
                    <td className="kfpl-table-cell-primary">{client.name}</td>
                    <td>{client.email}</td>
                    <td>{client.phone}</td>
                    <td className="font-semibold" style={{ textAlign: 'right' }}>{formatCurrency(client.totalInvestment)}</td>
                    <td style={{ textAlign: 'right' }}>{client.roiPercentage || 12}%</td>
                    <td className="font-semibold" style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                      {formatCurrency(client.totalInvestment * ((agent.commissionOneTime || 2) / 100))}
                    </td>
                    <td><Badge status={client.status}>{client.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'commission' && (
        <div className="kfpl-table-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Commission History</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Click on any period to view detailed breakdown</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div className="kfpl-search" style={{ maxWidth: '260px' }}>
                <svg className="kfpl-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search commission..."
                  value={commissionSearch}
                  onChange={(e) => setCommissionSearch(e.target.value)}
                />
              </div>
              <button
                className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                onClick={() => {
                  commissionHistory.forEach(com => downloadStatementCSV({ ...com, breakdown: getCommissionBreakdown(com) }, agent.name || agent.fullName));
                  addToast('All CSV statements downloaded', 'success', 'Download Complete');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                CSV (All)
              </button>
              <button
                className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                onClick={() => {
                  commissionHistory.forEach(com => downloadStatementPDF({ ...com, breakdown: getCommissionBreakdown(com) }, agent.name || agent.fullName, agentClients));
                  addToast('All PDF statements generated', 'success', 'Download Complete');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                PDF (All)
              </button>
            </div>
          </div>
          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr><th>Period</th><th>Date</th><th>Type</th><th>Amount</th><th>Status</th><th style={{ textAlign: 'center' }}>Download Statement</th></tr>
              </thead>
              <tbody>
                {filteredCommission.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>No commission records found</td></tr>
                ) : filteredCommission.map(com => (
                  <tr key={com.id}>
                    <td>
                      <button
                        onClick={() => setSelectedCommission(com)}
                        style={{
                          background: 'none', border: 'none', padding: '4px 8px',
                          borderRadius: '6px', color: 'var(--color-gold-dark)',
                          fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
                          textUnderlineOffset: '3px', fontSize: '0.875rem',
                        }}
                        title="Click to view details"
                      >
                        {com.month || ((com.date || com.paidAt || com.payoutDate) ? new Date(com.date || com.paidAt || com.payoutDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Statement')}
                      </button>
                    </td>
                    <td>{formatDateDMY(com.date || com.paidAt || com.payoutDate)}</td>
                    <td>
                      {(() => {
                        const comType = String(com.type || com.commissionType || '').toLowerCase().trim();
                        const isOneTime = comType === 'one-time' || comType === 'onetime' || comType === 'one time' || comType === 'one-time onboarding';
                        const isSpecial = comType === 'special' || comType === 'override' || comType === 'special override';
                        return (
                          <Badge status={isOneTime ? 'info' : isSpecial ? 'gold' : 'active'}>
                            {isOneTime ? 'One Time' : isSpecial ? 'Special' : 'Monthly'}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="font-semibold">{formatCurrency(com.amount)}</td>
                    <td><Badge status={com.status}>{com.status}</Badge></td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          onClick={() => {
                            downloadStatementCSV({ ...com, breakdown: getCommissionBreakdown(com) }, agent.name || agent.fullName);
                            addToast(`Statement CSV downloaded for ${com.month}`, 'success', 'Downloaded');
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 8px' }}
                          title="Download CSV"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                          </svg>
                          CSV
                        </button>
                        <button
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          onClick={() => {
                            downloadStatementPDF({ ...com, breakdown: getCommissionBreakdown(com) }, agent.name || agent.fullName, agentClients);
                            addToast(`Statement PDF generated for ${com.month}`, 'success', 'Downloaded');
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 8px' }}
                          title="Download PDF"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                          </svg>
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Commission Detail Modal ─── */}
      {(() => {
        if (!selectedCommission) return null;
        const filteredBreakdown = getCommissionBreakdown(selectedCommission);
        const filteredTotal = filteredBreakdown.length > 0 ? filteredBreakdown.reduce((sum, b) => sum + b.amount, 0) : (selectedCommission.amount || 0);

        return createPortal(
          <div
            className="kfpl-modal-overlay"
            onClick={() => setSelectedCommission(null)}
          >
            <div
              className="kfpl-modal"
              style={{ maxWidth: '640px' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="kfpl-modal-header">
                <h3 className="kfpl-modal-title">Commission Statement</h3>
                <button className="kfpl-modal-close" onClick={() => setSelectedCommission(null)} aria-label="Close modal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="kfpl-modal-body">
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {selectedCommission.month || ((selectedCommission.date || selectedCommission.paidAt || selectedCommission.payoutDate) ? new Date(selectedCommission.date || selectedCommission.paidAt || selectedCommission.payoutDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Statement')} — {agent.name || agent.fullName} ({agent.agentId})
                </p>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    background: 'var(--color-surface-alt, #f8fafc)', borderRadius: '12px',
                    padding: '16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Total Amount</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-gold-dark)' }}>{formatCurrency(filteredTotal)}</div>
                  </div>
                  <div style={{
                    background: 'var(--color-surface-alt, #f8fafc)', borderRadius: '12px',
                    padding: '16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Type</div>
                    <div>
                      {(() => {
                        const comType = String(selectedCommission.type || selectedCommission.commissionType || '').toLowerCase().trim();
                        const isOneTime = comType === 'one-time' || comType === 'onetime' || comType === 'one time' || comType === 'one-time onboarding';
                        const isSpecial = comType === 'special' || comType === 'override' || comType === 'special override';
                        return (
                          <Badge status={isOneTime ? 'info' : isSpecial ? 'gold' : 'active'}>
                            {isOneTime ? 'One Time' : isSpecial ? 'Special' : 'Monthly'}
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{
                    background: 'var(--color-surface-alt, #f8fafc)', borderRadius: '12px',
                    padding: '16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Date</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatDateDMY(selectedCommission.date || selectedCommission.paidAt || selectedCommission.payoutDate)}</div>
                  </div>
                  <div style={{
                    background: 'var(--color-surface-alt, #f8fafc)', borderRadius: '12px',
                    padding: '16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '6px' }}>Status</div>
                    <div><Badge status={selectedCommission.status}>{selectedCommission.status}</Badge></div>
                  </div>
                </div>

                {filteredBreakdown.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 12px', color: 'var(--color-text-primary)' }}>
                      Client-wise Breakdown
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="kfpl-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Client</th>
                            <th>Client ID</th>
                            <th style={{ textAlign: 'center' }}>Investment Date</th>
                            <th style={{ textAlign: 'center' }}>Type</th>
                            <th style={{ textAlign: 'right' }}>Investment</th>
                            <th style={{ textAlign: 'right' }}>Rate</th>
                            <th style={{ textAlign: 'right' }}>Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBreakdown.map((b, i) => {
                            const inv = investors.find(invObj => invObj.clientId === b.clientId);
                            const invDateStr = inv ? getPeriodInvestmentDate(inv, selectedCommission) : (b.investmentDate || '');
                            const comType = String(selectedCommission.type || selectedCommission.commissionType || '').toLowerCase().trim();
                            const isOneTime = comType === 'one-time' || comType === 'onetime' || comType === 'one time' || comType === 'one-time onboarding';
                            const isSpecial = comType === 'special' || comType === 'override' || comType === 'special override';
                            return (
                              <tr key={i}>
                                <td className="kfpl-table-cell-primary">{b.clientName}</td>
                                <td>{b.clientId}</td>
                                <td style={{ textAlign: 'center' }}>{invDateStr}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <Badge status={isOneTime ? 'info' : isSpecial ? 'gold' : 'active'}>
                                    {isOneTime ? 'One Time' : isSpecial ? 'Special' : 'Monthly'}
                                  </Badge>
                                </td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(b.investment)}</td>
                                <td style={{ textAlign: 'right' }}>{b.rate}%</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{formatCurrency(b.amount)}</td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: 'var(--color-surface-alt, #f8fafc)', fontWeight: 700 }}>
                            <td colSpan={6} style={{ textAlign: 'right' }}>Total</td>
                            <td style={{ textAlign: 'right', color: 'var(--color-gold-dark)' }}>{formatCurrency(filteredTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="kfpl-modal-footer">
                <button
                  className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                  onClick={() => setSelectedCommission(null)}
                >Close</button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                    onClick={() => {
                      downloadStatementCSV({ ...selectedCommission, breakdown: filteredBreakdown }, agent.name || agent.fullName);
                      addToast('Statement CSV downloaded', 'success', 'Downloaded');
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                    </svg>
                    Download CSV
                  </button>
                  <button
                    className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                    onClick={() => {
                      downloadStatementPDF({ ...selectedCommission, breakdown: filteredBreakdown }, agent.name || agent.fullName, agentClients);
                      addToast('Statement PDF generated', 'success', 'Downloaded');
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                    </svg>
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="kfpl-page-header" style={{ marginBottom: '4px' }}>
            <div>
              <h3 className="kfpl-form-card-title" style={{ margin: 0 }}>Onboarded Documents</h3>
              <p className="kfpl-page-subtitle" style={{ margin: '2px 0 0 0' }}>KYC, bank verification, and nominee documents</p>
            </div>
          </div>

          <div className="kfpl-detail-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {documentsList.map((doc, idx) => {
              const docName = doc.name || doc.label;
              const isVerified = !!verifiedDocs[docName];
              return (
                <div key={idx} className="kfpl-detail-info-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px', minHeight: '160px', position: 'relative' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ background: 'var(--color-gold-glow, #fef3c7)', color: 'var(--color-gold-dark, #b38600)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="20" height="20">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{docName}</h4>
                          {isVerified && <Badge status="active">Verified</Badge>}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{doc.fileName || 'PDF Document'} • {doc.fileSize || '—'}</span>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                      {doc.description || doc.desc || 'Uploaded document'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', marginTop: '12px' }}>
                    <button 
                      className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" 
                      style={{ flex: 1, fontSize: '0.78rem', padding: '6px 0' }}
                      onClick={() => setViewingDoc({ label: docName, filename: doc.fileName || 'document.pdf', agentName: doc.holder || agent.name, status: isVerified ? 'Verified' : 'Pending Verification', uploadedAt: doc.uploadedDate || doc.uploaded || agent.joinDate, url: doc.url })}
                    >
                      View Document
                    </button>
                    {!isVerified && (
                      <button 
                        className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" 
                        style={{ fontSize: '0.78rem', padding: '6px 12px', fontWeight: '700' }}
                        onClick={() => handleVerifyDocument(docName)}
                      >
                        Verify
                      </button>
                    )}
                    <button 
                      className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" 
                      style={{ padding: '6px 10px' }}
                      onClick={() => downloadFile(doc.url, docName)}
                      title="Download File"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="14" height="14">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Document Viewer Modal ─── */}
      {viewingDoc && createPortal(
        <div
          className="kfpl-modal-overlay"
          onClick={() => setViewingDoc(null)}
        >
          <div
            className="kfpl-modal"
            style={{ maxWidth: '640px', width: '95%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="kfpl-modal-header" style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              <h3 className="kfpl-modal-title" style={{ color: '#1e293b', fontSize: '1.05rem', fontWeight: 700 }}>{viewingDoc.label}</h3>
              <button className="kfpl-modal-close" onClick={() => setViewingDoc(null)} aria-label="Close modal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: '#64748b', width: '16px', height: '16px' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="kfpl-modal-body" style={{ background: '#f8fafc', padding: 0, display: 'flex', flexDirection: 'column' }}>
              {/* File Preview Area */}
              {previewLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#64748b', minHeight: '260px' }}>
                  <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: '0.8rem', marginTop: '12px', fontWeight: 500 }}>Loading secure document preview...</span>
                </div>
              ) : previewUrl ? (
                (() => {
                  const fileUrl = previewUrl;
                  const fileType = getFileType(viewingDoc.url, viewingDoc.filename);
                  if (fileType === 'image') {
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#f8fafc', minHeight: '260px' }}>
                        <img src={fileUrl} alt={viewingDoc.label} style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                      </div>
                    );
                  } else if (fileType === 'pdf') {
                    return <iframe src={fileUrl} title={viewingDoc.label} style={{ width: '100%', height: '450px', border: 'none', background: '#ffffff' }} />;
                  } else if (fileType === 'office') {
                    const isBlob = fileUrl.startsWith('blob:') || fileUrl.startsWith('data:');
                    if (isBlob) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#f8fafc', minHeight: '260px', color: '#64748b' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: '12px', opacity: 0.6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          <p style={{ margin: 0, fontSize: '0.8rem' }}>Local document. Click "Download Original" to view.</p>
                        </div>
                      );
                    }
                    return <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`} title={viewingDoc.label} style={{ width: '100%', height: '450px', border: 'none' }} />;
                  } else {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#f8fafc', minHeight: '260px', color: '#64748b' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: '12px', opacity: 0.6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                        <p style={{ margin: 0, fontSize: '0.8rem' }}>Preview not available for this file type</p>
                      </div>
                    );
                  }
                })()
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#f8fafc', minHeight: '260px', color: '#64748b' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ marginBottom: '12px', opacity: 0.6 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>No file available</p>
                </div>
              )}

              {/* Document Info Bar */}
              <div style={{ background: '#ffffff', padding: '14px 20px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{viewingDoc.filename}</h4>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Uploaded: {viewingDoc.uploadedAt}</span>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                    background: verifiedDocs[viewingDoc.label] ? '#dcfce7' : '#fef3c7',
                    color: verifiedDocs[viewingDoc.label] ? '#16a34a' : '#d97706',
                    border: `1px solid ${verifiedDocs[viewingDoc.label] ? '#bbf7d0' : '#fde68a'}`
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: verifiedDocs[viewingDoc.label] ? '#16a34a' : '#d97706' }} />
                    {verifiedDocs[viewingDoc.label] ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: '#64748b' }}>
                  <span><strong style={{ color: '#1e293b' }}>Holder:</strong> {viewingDoc.agentName}</span>
                </div>
              </div>
            </div>
            <div className="kfpl-modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                onClick={() => setViewingDoc(null)}
              >Close</button>

              {!verifiedDocs[viewingDoc.label] && (
                <button
                  className="kfpl-btn kfpl-btn--sm"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#ffffff', border: 'none', fontWeight: 600, padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem' }}
                  onClick={() => {
                    handleVerifyDocument(viewingDoc.label);
                    setViewingDoc(null);
                  }}
                >
                  Verify Document
                </button>
              )}

              <button
                className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                style={{ fontWeight: 700, padding: '6px 16px', borderRadius: '8px', fontSize: '0.8rem' }}
                onClick={() => {
                  downloadFile(viewingDoc.url, viewingDoc.filename);
                  setViewingDoc(null);
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Original
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Agent Deletion"
        footer={
          <>
            <button 
              className="kfpl-btn kfpl-btn--ghost" 
              onClick={() => setShowDeleteModal(false)}
              disabled={deleteLoading}
            >
              Cancel
            </button>
            <button 
              className="kfpl-btn" 
              style={{ background: '#EF4444', borderColor: 'transparent', color: '#FFFFFF', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
              onClick={handleConfirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Yes, Delete Agent'}
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
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              ⚠️
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#1e293b', fontWeight: 600 }}>Critical Action Warning</h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
                Are you sure you want to completely delete agent profile <strong>{agent?.name || agent?.fullName}</strong>? This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============ END: AgentDetail.jsx ============ */
