/* ============================================================
   Page: EmailNotifications.jsx
   Description: Premium Notification Management System with native dashboard
                KPI cards, collapsible selection accordions, HTML file uploader,
                dynamic global blur on active overlays, advanced timezone
                and 12-hour AM/PM calendar scheduling selectors.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import Badge from '../../components/ui/Badge';
import DataTable from '../../components/ui/DataTable';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';

// Helper to format Agent and Client IDs
const formatAgentID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  if (rawId.startsWith('KFPL-AG-') || rawId.startsWith('KFPL-AGT-')) {
    return rawId.replace('KFPL-AGT-', 'KFPL-AG-');
  }
  const digits = rawId.match(/\d+/);
  if (digits) {
    let val = parseInt(digits[0], 10);
    if (val < 1000) val = 1000 + val;
    return `KFPL-AG-${val}`;
  }
  return 'KFPL-AG-1001';
};

const formatClientID = (rawId) => {
  if (!rawId || rawId === '—') return '—';
  if (rawId.startsWith('KFPL-CL-')) return rawId;
  const digits = rawId.match(/\d+/);
  if (digits) {
    let val = parseInt(digits[0], 10);
    if (val < 1000) val = 1000 + val;
    return `KFPL-CL-${val}`;
  }
  return 'KFPL-CL-1001';
};

// Preset Templates Definition
const PRESET_TEMPLATES = [
  {
    id: 'custom',
    name: 'Custom Email (Blank)',
    subject: '',
    body: '',
    targetRole: 'all'
  },
  {
    id: 'welcome',
    name: 'Welcome Investor Kit',
    subject: 'Welcome to Kinetoscope Family - Investor Onboarding',
    body: `<h3>Welcome to Kinetoscope Films Production Pvt Ltd</h3>
<p style="font-size:0.95rem;color:#64748b;margin-top:-10px;margin-bottom:15px;font-style:italic;">A Global Media Fund</p>
<p>Dear {ClientName},</p>
<p>We are thrilled to welcome you as an esteemed partner in our premium film investment catalog. Your account has been verified and registered under Client ID: <strong>{ClientID}</strong>.</p>
<p>You can now log in to the Client Portal using your registered email address to check your monthly ROI allocation, active portfolio value, and download certificate statements.</p>
<p>If you have any questions, feel free to reach out to your assigned representative or raise a ticket in the support center.</p>
<br/>
<p>Warm Regards,<br/><strong>Kinetoscope Admin Desk</strong></p>`,
    targetRole: 'client'
  },
  {
    id: 'reward',
    name: 'Reward / Perk Announcement',
    subject: 'Congratulations! You have unlocked a new Perk Tier',
    body: `<h3>New Milestone Achieved! 🎉</h3>
<p>Dear {ClientName},</p>
<p>Based on your latest portfolio expansion, we are delighted to inform you that your profile has been promoted to a higher Perks tier. You have unlocked exclusive privileges including higher priority project allocations, invitation to private screening events, and direct access to production advisory panels.</p>
<p>Please log in to your portal and visit the "Perks & Recognition" tab to view your active benefits.</p>
<br/>
<p>Cheers,<br/><strong>Kinetoscope Investor Relations Team</strong></p>`,
    targetRole: 'client'
  },
  {
    id: 'statement',
    name: 'Quarterly Statement Notice',
    subject: 'Kinetoscope Quarterly Investment Statement Available',
    body: `<h3>Quarterly Investment Statement Released</h3>
<p>Dear Partner,</p>
<p>This is to inform you that the quarterly ROI statements and investment audit reports for the period ended June 2026 have been generated. You can download the authenticated PDF/CSV statement ledger directly from the documents vault under your account details.</p>
<p>All active movie project segments have yielded competitive returns aligned with the monthly slab projections.</p>
<br/>
<p>Regards,<br/><strong>Kinetoscope Operations Desk</strong></p>`,
    targetRole: 'client'
  },
  {
    id: 'alert',
    name: 'Account Security Alert',
    subject: 'Important: Complete your KYC Verification',
    body: `<h3>KYC Action Required</h3>
<p>Dear User,</p>
<p>This is an automated reminder regarding your pending KYC documentation. To keep your movie portfolio active and receive uninterrupted monthly payouts, please verify your identity details. Upload your PAN card, Aadhaar card, and bank proof documents through your portal profile section at your earliest convenience.</p>
<p>Security and compliance are crucial for our investment cycles.</p>
<br/>
<p>Best Regards,<br/><strong>Kinetoscope Compliance Department</strong></p>`,
    targetRole: 'client'
  },
  // Agent-Specific Templates
  {
    id: 'agent-welcome',
    name: 'Agent Onboarding Welcome',
    subject: 'Welcome to Kinetoscope Agent Network - Onboarding Complete',
    body: `<h3>Welcome to the Kinetoscope Agent Network! 🤝</h3>
<p>Dear {AgentName},</p>
<p>Congratulations on being onboarded as a verified Agent Partner with Kinetoscope Films Production Pvt Ltd. Your Agent ID is: <strong>{AgentID}</strong>.</p>
<p>You can now access the Agent Portal to manage your referred client base, track commission earnings, submit deposit/withdrawal requests on behalf of clients, and view your performance dashboard.</p>
<p>We look forward to a productive partnership. If you need any assistance, please reach out to the admin support desk.</p>
<br/>
<p>Best Regards,<br/><strong>Kinetoscope Agent Operations Desk</strong></p>`,
    targetRole: 'agent'
  },
  {
    id: 'agent-commission',
    name: 'Commission Payout Notification',
    subject: 'Kinetoscope Commission Payout Processed - {AgentID}',
    body: `<h3>Commission Payout Confirmation 💸</h3>
<p>Dear {AgentName},</p>
<p>We are pleased to confirm that your commission payout has been successfully processed. Below is the transaction summary:</p>
<ul>
<li><strong>Agent ID:</strong> {AgentID}</li>
<li><strong>Payout Status:</strong> Paid</li>
<li><strong>Processing Date:</strong> ${new Date().toLocaleDateString('en-IN')}</li>
</ul>
<p>You can view detailed commission breakdowns, slab tier details, and historical payouts in the Agent Portal under the "Commission Slabs" section.</p>
<br/>
<p>Thank you for your continued partnership.<br/><strong>Kinetoscope Finance Department</strong></p>`,
    targetRole: 'agent'
  },
  {
    id: 'agent-performance',
    name: 'Monthly Performance Report',
    subject: 'Kinetoscope Monthly Agent Performance Summary',
    body: `<h3>Monthly Performance Report 📊</h3>
<p>Dear {AgentName},</p>
<p>Here is your monthly performance snapshot as an Agent Partner with Kinetoscope (Agent ID: <strong>{AgentID}</strong>):</p>
<ul>
<li><strong>Active Referred Clients:</strong> View in portal</li>
<li><strong>Total Deposits Processed:</strong> View in portal</li>
<li><strong>Commission Earned (This Month):</strong> View in portal</li>
</ul>
<p>Keep up the excellent work! Higher referral volumes unlock premium commission tiers and exclusive bonus incentives.</p>
<p>Log in to your Agent Portal dashboard for detailed analytics and graphs.</p>
<br/>
<p>Best Regards,<br/><strong>Kinetoscope Agent Relations Team</strong></p>`,
    targetRole: 'agent'
  },
  {
    id: 'agent-referral',
    name: 'Referral Bonus Announcement',
    subject: 'New Referral Bonus Unlocked! - Kinetoscope Agent Rewards',
    body: `<h3>Referral Bonus Achieved! 🎉</h3>
<p>Dear {AgentName},</p>
<p>Great news! Based on your recent client referrals, you have unlocked a special referral bonus reward. Your consistent efforts in expanding the Kinetoscope investor network have been recognized.</p>
<p>Details of your bonus will be reflected in your next commission cycle. Please check the "Commission Slabs" tab in your Agent Portal for the latest updates.</p>
<p>Thank you for being a valued partner in our growth journey.</p>
<br/>
<p>Warm Regards,<br/><strong>Kinetoscope Rewards & Incentives Team</strong></p>`,
    targetRole: 'agent'
  }
];

// Initial mock logs of manually sent notifications
const INITIAL_SENT_LOGS = [];

// SVG Icons Definition
const svgIcons = {
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  paperclip: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
  chevronDown: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  globe: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
};

export default function EmailNotifications() {
  const addToast = useToast();
  
  // Tabs: 'compose', 'logs', 'auto'
  const [activeTab, setActiveTab] = useState('compose');

  // Load clients and agents data from APIs (with fallback mock structures)
  const [clients, setClients] = useState([]);
  const [agents, setAgents] = useState([]);

  // Combined recipient list for selection states
  const [recipientsList, setRecipientsList] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]); // List of selected IDs
  
  // Accordion Expand/Collapse States
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const [agentsExpanded, setAgentsExpanded] = useState(false);

  // Individual search strings for accordions
  const [clientSearch, setClientSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');

  // Custom Templates State
  const [templates, setTemplates] = useState(PRESET_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [showAddTemplateModal, setShowAddTemplateModal] = useState(false);

  // New template form state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');

  // Mail form states
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const htmlUploadRef = useRef(null);
  const textareaRef = useRef(null);

  // Logs sub-tab state: 'sent' or 'scheduled'
  const [logsSubTab, setLogsSubTab] = useState('sent');

  // Scheduling states
  const [sendMode, setSendMode] = useState('now'); // now, schedule
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleHour, setScheduleHour] = useState('10');
  const [scheduleMinute, setScheduleMinute] = useState('00');
  const [schedulePeriod, setSchedulePeriod] = useState('AM');
  const [scheduleTimezone, setScheduleTimezone] = useState('IST (UTC+05:30)');

  // History logs state
  const [sentLogs, setSentLogs] = useState(INITIAL_SENT_LOGS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null); // Modal detail view log

  // Auto trigger templates state
  const [autoTriggers, setAutoTriggers] = useState([
    { id: 1, event: 'New Investor Onboarded', recipient: 'Client', status: 'active', lastSent: '—', count: 0 },
    { id: 2, event: 'Agreement Uploaded', recipient: 'Client', status: 'active', lastSent: '—', count: 0 },
    { id: 3, event: 'Investment Assigned / Modified', recipient: 'Client', status: 'active', lastSent: '—', count: 0 },
    { id: 4, event: 'ROI Marked as Paid', recipient: 'Client', status: 'active', lastSent: '—', count: 0 },
    { id: 5, event: 'Deposit Approved', recipient: 'Client / Agent', status: 'active', lastSent: '—', count: 0 },
    { id: 6, event: 'Deposit Rejected', recipient: 'Client / Agent', status: 'active', lastSent: '—', count: 0 },
    { id: 7, event: 'Withdrawal Approved', recipient: 'Client / Agent', status: 'active', lastSent: '—', count: 0 },
    { id: 8, event: 'Withdrawal Rejected', recipient: 'Client / Agent', status: 'active', lastSent: '—', count: 0 },
    { id: 9, event: 'Commission Marked as Paid', recipient: 'Agent', status: 'active', lastSent: '—', count: 0 },
    { id: 10, event: 'Perk Assigned', recipient: 'Client', status: 'active', lastSent: '—', count: 0 },
  ]);
  const [metricsData, setMetricsData] = useState({ totalSent: null, scheduled: null, recipients: null, activeTriggers: null });

  // Handle global modal blur class toggling
  useEffect(() => {
    const isOverlayOpen = showAddTemplateModal || !!selectedLog;
    if (isOverlayOpen) {
      document.body.classList.add('global-modal-blur');
    } else {
      document.body.classList.remove('global-modal-blur');
    }
    return () => {
      document.body.classList.remove('global-modal-blur');
    };
  }, [showAddTemplateModal, selectedLog]);

  const loadNotificationData = async () => {
    // 1. Auto Triggers - fetch database triggers to merge real MongoDB IDs and isEnabled statuses
    try {
      const tRes = await apiRequest('/api/super-admin/notifications/triggers');
      const tList = tRes.data?.triggers || tRes.triggers || (Array.isArray(tRes.data) ? tRes.data : (Array.isArray(tRes) ? tRes : []));
      if (tList && tList.length > 0) {
        setAutoTriggers(prev => prev.map(mockTrigger => {
          // Find matching real trigger by systemEventTrigger name (case-insensitive) or triggerKey
          const realTrigger = tList.find(t => 
            (t.systemEventTrigger && t.systemEventTrigger.toLowerCase() === mockTrigger.event.toLowerCase()) ||
            (t.triggerKey && t.triggerKey.toLowerCase().replace(/_/g, ' ') === mockTrigger.event.toLowerCase())
          );
          if (realTrigger) {
            return {
              ...mockTrigger,
              id: realTrigger._id || realTrigger.id,
              status: realTrigger.isEnabled ? 'active' : 'inactive'
            };
          }
          return mockTrigger;
        }));
      }
    } catch (err) {
      console.error('Failed to load real trigger configurations:', err);
    }

    // 2. Custom Templates
    try {
      const tmplRes = await apiRequest('/api/super-admin/notifications/templates');
      const tmplList = tmplRes.data?.templates || tmplRes.templates || (Array.isArray(tmplRes.data) ? tmplRes.data : (Array.isArray(tmplRes) ? tmplRes : []));
      if (tmplList.length > 0) {
        const mappedCustom = tmplList.map(t => ({
          id: t._id || t.id,
          name: t.name,
          subject: t.subject,
          body: t.body,
          isCustom: true
        }));
        setTemplates([...PRESET_TEMPLATES, ...mappedCustom]);
      }
    } catch (err) {
      console.error('Failed to load custom templates:', err);
    }

    // 3. Metrics
    try {
      const metricsRes = await apiRequest('/api/super-admin/notifications/metrics');
      const metrics = metricsRes.data?.metrics 
        || metricsRes.metrics 
        || metricsRes.data 
        || metricsRes 
        || {};
      if (metrics.totalSent !== undefined || metrics.totalSentCount !== undefined) {
        setMetricsData({
          totalSent: metrics.totalSent !== undefined ? metrics.totalSent : (metrics.totalSentCount || 0),
          scheduled: metrics.scheduled !== undefined ? metrics.scheduled : (metrics.scheduledCount || 0),
          recipients: metrics.recipients !== undefined ? metrics.recipients : (metrics.recipientsCount || 0),
          activeTriggers: metrics.activeTriggers !== undefined ? metrics.activeTriggers : (metrics.activeTriggersCount || 0)
        });
      }
    } catch (err) {
      console.error('Failed to load notification metrics:', err);
    }

    // 4. Sent Logs
    try {
      const logsRes = await apiRequest('/api/super-admin/notifications/logs');
      const logsList = logsRes.data?.logs || logsRes.logs || (Array.isArray(logsRes.data) ? logsRes.data : (Array.isArray(logsRes) ? logsRes : []));
      if (logsList.length > 0) {
        const mappedLogs = logsList.map(l => ({
          id: l._id || l.id,
          dateTime: l.dateTime || (l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'),
          subject: l.subject || '',
          recipientType: l.recipientType || (l.recipientEmails?.length > 1 ? 'Bulk Group' : 'Individual'),
          recipientSummary: l.recipientSummary || (l.recipientEmails ? l.recipientEmails.join(', ') : ''),
          templateName: l.templateName || l.templateType || 'Custom Email (Blank)',
          attachmentsCount: l.attachmentsCount || l.attachments?.length || 0,
          attachments: l.attachments || [],
          body: l.body || '',
          status: l.status || 'Delivered',
          scheduledFor: l.scheduledFor || l.scheduledAt || null
        }));
        setSentLogs(prev => [...mappedLogs, ...prev.filter(p => !mappedLogs.some(m => m.id === p.id))]);
      }
    } catch (err) {
      console.error('Failed to load sent logs:', err);
    }
  };

  // Fetch real clients and agents on load
  useEffect(() => {
    const loadData = async () => {
      let loadedClients = [];
      let loadedAgents = [];

      try {
        const cRes = await apiRequest('/api/super-admin/clients');
        const list = cRes.data?.clients || cRes.clients || (Array.isArray(cRes.data) ? cRes.data : (Array.isArray(cRes) ? cRes : []));
        if (list && list.length > 0) {
          loadedClients = list.map((c, index) => {
            const user = c.user || c.userId || {};
            const profile = c.profile || {};
            const padIndex = String(index + 1).padStart(3, '0');
            const fallbackCode = `C-${padIndex}`;
            return {
              id: c._id || user._id || profile.userId || c.id,
              name: profile.fullName || user.name || c.fullName || c.name || '—',
              code: formatClientID(user.clientCode || c.clientCode || profile.clientCode || fallbackCode),
              email: profile.email || user.email || c.email || '',
              role: 'client'
            };
          });
        }
      } catch (err) {
        console.error('Failed to load real clients in EmailNotifications:', err);
      }

      try {
        const aRes = await apiRequest('/api/super-admin/agents');
        const list = aRes.data?.agents || aRes.agents || (Array.isArray(aRes.data) ? aRes.data : (Array.isArray(aRes) ? aRes : []));
        if (list && list.length > 0) {
          loadedAgents = list.map((a, index) => {
            const user = a.user || a.userId || {};
            const profile = a.profile || {};
            const padIndex = String(index + 1).padStart(3, '0');
            const fallbackCode = `A-${padIndex}`;
            return {
              id: a._id || user._id || profile.userId || a.id,
              name: profile.fullName || user.name || a.name || '—',
              code: formatAgentID(user.agentCode || a.agentCode || profile.agentCode || fallbackCode),
              email: profile.email || user.email || a.email || '',
              role: 'agent'
            };
          });
        }
      } catch (err) {
        console.error('Failed to load real agents in EmailNotifications:', err);
      }

      // Fallbacks if lists are empty
      if (loadedClients.length === 0) {
        loadedClients = [
          { id: '6a178eea1bfaaa856cac2115', name: 'Tushar Bhatnagar', code: 'KFPL-CL-1001', email: 'tushar@kritidigital.com', role: 'client' },
          { id: '6a178eea1bfaaa856cac2116', name: 'Milind Ratan Saugat', code: 'KFPL-CL-1002', email: 'milindsaugat1122@gmail.com', role: 'client' },
          { id: '6a178eea1bfaaa856cac2117', name: 'Garima Agrawal', code: 'KFPL-CL-1003', email: 'agrawalgarima53@gmail.com', role: 'client' }
        ];
      }
      if (loadedAgents.length === 0) {
        loadedAgents = [
          { id: '6a175c3add213cf692b9fd6e', name: 'Rishika Chaudhary', code: 'KFPL-AG-1001', email: 'rishikakds@gmail.com', role: 'agent' }
        ];
      }

      setClients(loadedClients);
      setAgents(loadedAgents);

      const combined = [
        ...loadedClients.map(c => ({ ...c, role: 'client' })),
        ...loadedAgents.map(a => ({ ...a, role: 'agent' }))
      ];
      setRecipientsList(combined);

      await loadNotificationData();
    };

    loadData();
  }, []);

  // Pre-fill fields when template changes (with auto-fill of recipient placeholders)
  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const tmpl = templates.find(t => t.id === templateId);
    if (tmpl) {
      let filledSubject = tmpl.subject;
      let filledBody = tmpl.body;

      // Auto-fill client placeholders if a single client is selected
      const selectedClientIds = selectedRecipients.filter(id => clients.some(c => c.id === id));
      if (selectedClientIds.length === 1) {
        const client = clients.find(c => c.id === selectedClientIds[0]);
        if (client) {
          filledSubject = filledSubject.replace(/\{ClientName\}/g, client.name).replace(/\{ClientID\}/g, client.code);
          filledBody = filledBody.replace(/\{ClientName\}/g, client.name).replace(/\{ClientID\}/g, client.code);
        }
      }

      // Auto-fill agent placeholders if a single agent is selected
      const selectedAgentIds = selectedRecipients.filter(id => agents.some(a => a.id === id));
      if (selectedAgentIds.length === 1) {
        const agent = agents.find(a => a.id === selectedAgentIds[0]);
        if (agent) {
          filledSubject = filledSubject.replace(/\{AgentName\}/g, agent.name).replace(/\{AgentID\}/g, agent.code);
          filledBody = filledBody.replace(/\{AgentName\}/g, agent.name).replace(/\{AgentID\}/g, agent.code);
        }
      }

      setSubject(filledSubject);
      setBodyText(filledBody);
    }
  };

  // Create new custom template
  const handleAddTemplate = async (e) => {
    e.preventDefault();
    if (!newTemplateName.trim()) {
      addToast('Template name is required', 'error', 'Validation Failed');
      return;
    }
    if (!newTemplateSubject.trim()) {
      addToast('Template subject is required', 'error', 'Validation Failed');
      return;
    }
    if (!newTemplateBody.trim()) {
      addToast('Template body content is required', 'error', 'Validation Failed');
      return;
    }

    try {
      const res = await apiRequest('/api/super-admin/notifications/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: newTemplateName,
          subject: newTemplateSubject,
          body: newTemplateBody
        })
      });
      const savedTemplate = res.data || res.template || res;
      const newTmpl = {
        id: savedTemplate._id || savedTemplate.id,
        name: savedTemplate.name,
        subject: savedTemplate.subject,
        body: savedTemplate.body,
        isCustom: true
      };

      setTemplates(prev => [...prev, newTmpl]);
      setSelectedTemplate(newTmpl.id);
      setSubject(newTmpl.subject);
      setBodyText(newTmpl.body);
      
      // Clear and close modal
      setNewTemplateName('');
      setNewTemplateSubject('');
      setNewTemplateBody('');
      setShowAddTemplateModal(false);
      
      addToast(`Template "${newTemplateName}" saved successfully`, 'success', 'Template Created');
    } catch (err) {
      console.error('Failed to create custom template:', err);
      addToast(err.message || 'Failed to create template', 'error', 'Error');
    }
  };

  // Update details of a custom template
  const handleUpdateCustomTemplate = async () => {
    const selectedTemplateObj = templates.find(t => t.id === selectedTemplate);
    if (!selectedTemplateObj || !selectedTemplateObj.isCustom) return;
    try {
      await apiRequest(`/api/super-admin/notifications/templates/${selectedTemplate}`, {
        method: 'PATCH',
        body: JSON.stringify({
          subject: subject,
          body: bodyText
        })
      });
      addToast(`Template "${selectedTemplateObj.name}" updated successfully`, 'success', 'Template Updated');
      setTemplates(prev => prev.map(t => {
        if (t.id === selectedTemplate) {
          return { ...t, subject: subject, body: bodyText };
        }
        return t;
      }));
    } catch (err) {
      console.error('Failed to update custom template:', err);
      addToast(err.message || 'Failed to update template', 'error', 'Error');
    }
  };

  // Delete custom template
  const handleDeleteCustomTemplate = async () => {
    const selectedTemplateObj = templates.find(t => t.id === selectedTemplate);
    if (!selectedTemplateObj || !selectedTemplateObj.isCustom) return;
    if (!window.confirm(`Are you sure you want to delete template "${selectedTemplateObj.name}"?`)) return;
    try {
      await apiRequest(`/api/super-admin/notifications/templates/${selectedTemplate}`, {
        method: 'DELETE'
      });
      addToast('Template deleted successfully', 'success', 'Template Deleted');
      setTemplates(prev => prev.filter(t => t.id !== selectedTemplate));
      setSelectedTemplate('custom');
      setSubject('');
      setBodyText('');
    } catch (err) {
      console.error('Failed to delete custom template:', err);
      addToast(err.message || 'Failed to delete template', 'error', 'Error');
    }
  };

  // Force run scheduled queue processor
  const handleForceProcessQueue = async () => {
    try {
      await apiRequest('/api/super-admin/notifications/process-scheduled', {
        method: 'POST'
      });
      addToast('Scheduled queue processed successfully', 'success', 'Queue Processed');
      await loadNotificationData();
    } catch (err) {
      console.error('Failed to process scheduled queue:', err);
      addToast(err.message || 'Failed to process scheduled queue', 'error', 'Error');
    }
  };



  // Upload HTML template file and read contents
  const handleHtmlTemplateUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      addToast('Please upload a valid .html template file', 'error', 'File Type Error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const htmlContent = event.target.result;
      setBodyText(htmlContent);
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      const title = doc.querySelector('title')?.innerText || '';
      if (title) {
        setSubject(title);
      }
      addToast(`HTML template "${file.name}" loaded successfully!`, 'success', 'Template Imported');
    };
    reader.onerror = () => {
      addToast('Failed to read the HTML template file', 'error', 'Upload Error');
    };
    reader.readAsText(file);
  };

  // Add personalization tags at cursor position
  const insertTag = (tag) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + tag + after;
      setBodyText(newText);
      
      // Focus back and place cursor after inserted tag
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      }, 0);
    } else {
      setBodyText(prev => prev + ` ${tag} `);
    }
    addToast(`Tag ${tag} inserted`, 'info', 'Tag Added');
  };

  // Define columns for Sent History Logs DataTable
  const logColumns = [
    {
      header: 'Sent Date & Time',
      accessor: 'dateTime',
      render: (row) => <span className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>{row.dateTime}</span>
    },
    {
      header: 'Subject',
      accessor: 'subject',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '180px' }}>
          <span className="kfpl-table-cell-primary" style={{ fontWeight: 600 }}>{row.subject}</span>
          {row.scheduledFor && (
            <span style={{ fontSize: '0.72rem', color: 'var(--color-gold-dark)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
              ⏰ Scheduled: {row.scheduledFor}
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Recipient Group',
      accessor: 'recipientType',
      render: (row) => (
        <span className="kfpl-stat-pill" style={{ background: row.recipientType === 'Individual' ? '#EFF6FF' : '#F1F5F9', color: row.recipientType === 'Individual' ? '#1D4ED8' : '#475569', fontWeight: 600, fontSize: '0.75rem', padding: '4px 8px', borderRadius: '12px', display: 'inline-block' }}>
          {row.recipientType}
        </span>
      )
    },
    {
      header: 'Target Summary',
      accessor: 'recipientSummary',
      render: (row) => <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{row.recipientSummary}</span>
    },
    {
      header: 'Template',
      accessor: 'templateName',
      render: (row) => <span style={{ fontSize: '0.8125rem', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>{row.templateName}</span>
    },
    {
      header: 'Attachments',
      accessor: 'attachmentsCount',
      render: (row) => (
        row.attachmentsCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-gold-dark)', fontWeight: 600, fontSize: '0.8rem' }}>
            {svgIcons.paperclip}
            {row.attachmentsCount} File(s)
          </div>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        )
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => (
        <Badge status={row.status === 'Scheduled' ? 'pending' : (row.status === 'Delivered' ? 'active' : 'inactive')}>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button 
            type="button"
            className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click
              setSelectedLog(row);
            }}
            style={{ padding: '4px 12px', fontSize: '0.75rem', height: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}
          >
            View Mail
          </button>
        </div>
      )
    }
  ];

  // Simulate file uploads
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const formattedFiles = files.map(file => ({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      rawFile: file
    }));
    
    setAttachments(prev => [...prev, ...formattedFiles]);
    addToast(`${files.length} file(s) attached`, 'success', 'Attached Successfully');
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    addToast('Attachment removed', 'info', 'Removed');
  };

  // Select / Deselect individual
  const handleToggleRecipient = (id) => {
    setSelectedRecipients(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Accordion 1: Filter clients
  const filteredClients = clients.filter(c => {
    const term = clientSearch.toLowerCase();
    return !term.trim() || c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
  });

  // Accordion 2: Filter agents
  const filteredAgents = agents.filter(a => {
    const term = agentSearch.toLowerCase();
    return !term.trim() || a.name.toLowerCase().includes(term) || a.code.toLowerCase().includes(term) || a.email.toLowerCase().includes(term);
  });

  // Bulk selectors inside accordion 1 (Clients)
  const isAllClientsSelected = filteredClients.length > 0 && filteredClients.every(c => selectedRecipients.includes(c.id));
  
  const handleToggleAllClients = () => {
    if (isAllClientsSelected) {
      const clientIds = filteredClients.map(c => c.id);
      setSelectedRecipients(prev => prev.filter(id => !clientIds.includes(id)));
      addToast('Cleared client selections', 'info', 'Clients Reset');
    } else {
      const clientIds = filteredClients.map(c => c.id);
      setSelectedRecipients(prev => Array.from(new Set([...prev, ...clientIds])));
      addToast(`Selected all ${filteredClients.length} clients`, 'success', 'Clients Selected');
    }
  };

  // Bulk selectors inside accordion 2 (Agents)
  const isAllAgentsSelected = filteredAgents.length > 0 && filteredAgents.every(a => selectedRecipients.includes(a.id));

  const handleToggleAllAgents = () => {
    if (isAllAgentsSelected) {
      const agentIds = filteredAgents.map(a => a.id);
      setSelectedRecipients(prev => prev.filter(id => !agentIds.includes(id)));
      addToast('Cleared agent selections', 'info', 'Agents Reset');
    } else {
      const agentIds = filteredAgents.map(a => a.id);
      setSelectedRecipients(prev => Array.from(new Set([...prev, ...agentIds])));
      addToast(`Selected all ${filteredAgents.length} agents`, 'success', 'Agents Selected');
    }
  };

  // Dynamic Day of the Week calculation helper
  const getDayOfWeek = (dateStr) => {
    if (!dateStr) return '';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return days[d.getDay()];
  };

  // Submit email notification (supports immediate or scheduled)
  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (selectedRecipients.length === 0) {
      addToast('Please select at least one recipient from the Client or Agent accordions below', 'error', 'Validation Failed');
      return;
    }
    if (!subject.trim()) {
      addToast('Subject line is required', 'error', 'Validation Failed');
      return;
    }
    if (!bodyText.trim()) {
      addToast('Email message content cannot be empty', 'error', 'Validation Failed');
      return;
    }
    if (sendMode === 'schedule' && (!scheduleDate || !scheduleHour || !scheduleMinute || !schedulePeriod)) {
      addToast('Please specify full date and time parameters for scheduling', 'error', 'Validation Failed');
      return;
    }

    setIsSending(true);

    const recipientEmails = recipientsList
      .filter(r => selectedRecipients.includes(r.id))
      .map(r => r.email)
      .filter(Boolean);

    // Normalize square brackets to curly braces before saving/sending
    const normalizedBody = bodyText
      .replace(/\[ClientName\]/g, '{ClientName}')
      .replace(/\[ClientID\]/g, '{ClientID}')
      .replace(/\[AgentName\]/g, '{AgentName}')
      .replace(/\[AgentID\]/g, '{AgentID}');

    let scheduledAt = null;
    if (sendMode === 'schedule') {
      let hourNum = parseInt(scheduleHour, 10);
      if (schedulePeriod === 'PM' && hourNum < 12) hourNum += 12;
      if (schedulePeriod === 'AM' && hourNum === 12) hourNum = 0;
      
      const timeString = `${scheduleDate}T${String(hourNum).padStart(2, '0')}:${scheduleMinute}:00`;
      const scheduledDateObj = new Date(timeString);
      scheduledAt = scheduledDateObj.toISOString();
    }

    const attachmentsPayload = attachments.map(att => ({
      filename: att.name,
      path: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    }));

    const selectedTemplateObj = templates.find(t => t.id === selectedTemplate);
    const templateType = selectedTemplateObj?.isCustom ? 'custom' : selectedTemplate;

    const payload = {
      recipientEmails,
      subject,
      body: normalizedBody,
      attachments: attachmentsPayload,
      ...(sendMode === 'schedule' ? { sendTiming: 'schedule', scheduledAt } : { sendTiming: 'now', templateType })
    };

    try {
      await apiRequest('/api/super-admin/notifications/send-email', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (sendMode === 'schedule') {
        const selectedDay = getDayOfWeek(scheduleDate);
        const scheduledString = `${scheduleDate} (${selectedDay}) at ${scheduleHour}:${scheduleMinute} ${schedulePeriod}`;
        addToast(`Email notification successfully scheduled for ${scheduledString}!`, 'success', 'Mail Scheduled');
      } else {
        addToast('Notification emails have been dispatched successfully!', 'success', 'Mail Sent');
      }

      // Reset form
      setSubject('');
      setBodyText('');
      setAttachments([]);
      setSelectedTemplate('custom');
      setSelectedRecipients([]);
      setSendMode('now');
      setScheduleDate('');
      setScheduleHour('10');
      setScheduleMinute('00');
      setSchedulePeriod('AM');

      // Refresh sent logs history and metrics
      await loadNotificationData();
    } catch (err) {
      console.error('Failed to send or schedule notification:', err);
      addToast(err.message || 'Failed to dispatch email', 'error', 'Error');
    } finally {
      setIsSending(false);
    }
  };

  // Toggle automated system trigger configuration
  const handleToggleAutoTrigger = async (triggerId, triggerName) => {
    // Always toggle locally first for instant UI feedback
    const nextStatusLocal = autoTriggers.find(t => t.id === triggerId)?.status === 'active' ? 'inactive' : 'active';
    setAutoTriggers(prev => prev.map(t => {
      if (t.id === triggerId) {
        return { ...t, status: nextStatusLocal };
      }
      return t;
    }));
    addToast(`Trigger '${triggerName}' has been ${nextStatusLocal === 'active' ? 'enabled' : 'disabled'}`, 'info', 'Configuration Updated');

    // Then call API in background (non-blocking, if it fails local state stays)
    try {
      await apiRequest(`/api/super-admin/notifications/triggers/${triggerId}/toggle`, {
        method: 'PATCH'
      });
    } catch (err) {
      console.error('API toggle call failed (local state kept):', err);
    }
  };

  // Filter sent logs
  const filteredLogs = sentLogs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.subject.toLowerCase().includes(term) ||
      log.recipientSummary.toLowerCase().includes(term) ||
      log.recipientType.toLowerCase().includes(term) ||
      log.templateName.toLowerCase().includes(term)
    );
  });

  // Calculate dynamic stats (API metrics override, otherwise fallback to local computation)
  const totalSentCount = metricsData.totalSent !== null && metricsData.totalSent !== undefined ? metricsData.totalSent : sentLogs.filter(l => l.status === 'Delivered').length;
  const scheduledCount = metricsData.scheduled !== null && metricsData.scheduled !== undefined ? metricsData.scheduled : sentLogs.filter(l => l.status === 'Scheduled').length;
  const activeTriggersCount = metricsData.activeTriggers !== null && metricsData.activeTriggers !== undefined ? metricsData.activeTriggers : autoTriggers.filter(t => t.status === 'active').length;

  // Selected Clients and Agents count for display in accordions
  const selectedClientsCount = selectedRecipients.filter(id => clients.some(c => c.id === id)).length;
  const selectedAgentsCount = selectedRecipients.filter(id => agents.some(a => a.id === id)).length;

  // Determine current recipient selection type for dynamic template filtering
  const hasClientsSelected = selectedClientsCount > 0;
  const hasAgentsSelected = selectedAgentsCount > 0;
  const recipientSelectionType = hasClientsSelected && hasAgentsSelected ? 'mixed' 
    : hasAgentsSelected ? 'agent' 
    : hasClientsSelected ? 'client' 
    : 'none';

  // Dynamic template filtering based on selected recipients
  const filteredTemplates = templates.filter(t => {
    if (t.targetRole === 'all' || !t.targetRole) return true; // Custom/blank always visible
    if (t.isCustom) return true; // User-created custom templates always visible
    if (recipientSelectionType === 'none' || recipientSelectionType === 'mixed') return true; // Show all if none or mixed
    return t.targetRole === recipientSelectionType;
  });

  // Template dropdown label based on selection type
  const templateDropdownLabel = recipientSelectionType === 'agent' 
    ? 'Select Agent Template' 
    : recipientSelectionType === 'client' 
    ? 'Select Client Template' 
    : 'Select System Template';

  // Hour options (1 to 12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  // Minute options (00 to 55 by steps of 5)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  return (
    <div className="kfpl-page">
      <style>{`
        body.global-modal-blur .kfpl-sidebar,
        body.global-modal-blur .kfpl-header,
        body.global-modal-blur .kfpl-page > *:not(.kfpl-modal-overlay) {
          filter: blur(8px) grayscale(15%);
          opacity: 0.65;
          pointer-events: none;
          transition: filter 0.3s ease, opacity 0.3s ease;
        }
        body.global-modal-blur .kfpl-modal-overlay {
          backdrop-filter: blur(25px) !important;
          -webkit-backdrop-filter: blur(25px) !important;
          background: rgba(255, 255, 255, 0.45) !important;
        }
        .kfpl-custom-dotted-dropzone {
          border: 3px dotted #94A3B8 !important;
          border-radius: 12px !important;
          padding: 24px !important;
          text-align: center !important;
          cursor: pointer !important;
          background: #FAFAFA !important;
          transition: border-color 0.2s ease, background-color 0.2s ease !important;
        }
        .kfpl-custom-dotted-dropzone:hover {
          border-color: var(--color-gold) !important;
          background: var(--color-gold-glow) !important;
        }
      `}</style>

      {/* Page Header */}
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Notification & Mail Console</h2>
          <p className="kfpl-page-subtitle">Send bulk/individual updates to clients & agents, attach assets, and configure automated system notifications.</p>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="kfpl-dashboard-kpis" style={{ marginBottom: '24px' }}>
        
        {/* Card 1 */}
        <div className="kfpl-card kfpl-kpi-card visible">
          <div className="kfpl-kpi-info">
            <span className="kfpl-kpi-label">Total Emails Sent</span>
            <h3 className="kfpl-kpi-value">{totalSentCount.toLocaleString()}</h3>
          </div>
          <div className="kfpl-kpi-icon gold">
            {svgIcons.send}
          </div>
        </div>

        {/* Card 2 */}
        <div className="kfpl-card kfpl-kpi-card visible">
          <div className="kfpl-kpi-info">
            <span className="kfpl-kpi-label">Scheduled Deliveries</span>
            <h3 className="kfpl-kpi-value">{scheduledCount}</h3>
          </div>
          <div className="kfpl-kpi-icon navy">
            {svgIcons.calendar}
          </div>
        </div>

        {/* Card 3 */}
        <div className="kfpl-card kfpl-kpi-card visible">
          <div className="kfpl-kpi-info">
            <span className="kfpl-kpi-label">Registered Recipients</span>
            <h3 className="kfpl-kpi-value">{recipientsList.length}</h3>
          </div>
          <div className="kfpl-kpi-icon success">
            {svgIcons.history}
          </div>
        </div>

        {/* Card 4 */}
        <div className="kfpl-card kfpl-kpi-card visible">
          <div className="kfpl-kpi-info">
            <span className="kfpl-kpi-label">System Automations</span>
            <h3 className="kfpl-kpi-value">{activeTriggersCount}</h3>
          </div>
          <div className="kfpl-kpi-icon warning">
            {svgIcons.settings}
          </div>
        </div>

      </div>

      {/* Navigation Tabs */}
      <div className="kfpl-tabs" style={{ marginBottom: '24px' }}>
        <button 
          className={`kfpl-tab ${activeTab === 'compose' ? 'active' : ''}`}
          onClick={() => setActiveTab('compose')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {svgIcons.send}
          Compose Notification
        </button>
        <button 
          className={`kfpl-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {svgIcons.history}
          Sent History Logs ({sentLogs.length})
        </button>
        <button 
          className={`kfpl-tab ${activeTab === 'auto' ? 'active' : ''}`}
          onClick={() => setActiveTab('auto')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {svgIcons.settings}
          Auto Trigger Config
        </button>

      </div>

      {/* Tab 1: Compose Notification */}
      {activeTab === 'compose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* STEP 1: Recipient Selection Console (Collapsible Accordion Panels) */}
          <div className="kfpl-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Step 1: Recipient Targets Selection</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Expand Client or Agent selection panels below. Toggles allow bulk actions and checkbox picking.</p>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '6px 16px', background: 'var(--color-gold-glow)', border: '1px solid var(--color-gold)', borderRadius: '20px', fontWeight: 700 }}>
                Total Selected: <strong style={{ color: 'var(--color-gold-dark)', fontSize: '1.05rem' }}>{selectedRecipients.length}</strong>
              </div>
            </div>

            {/* Accordion List container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Accordion Item 1: Clients Selection */}
              <div style={{ border: '1.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Header */}
                <div 
                  onClick={() => setClientsExpanded(!clientsExpanded)}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '14px 20px', 
                    background: '#F8FAFC', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: clientsExpanded ? '1.5px solid var(--color-border)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }}></span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Client / Investor List</span>
                    <Badge status={selectedClientsCount > 0 ? 'active' : 'inactive'}>
                      {selectedClientsCount} Selected
                    </Badge>
                  </div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', transition: '0.2s', transform: clientsExpanded ? 'rotate(180deg)' : 'none' }}>
                    {svgIcons.chevronDown}
                  </span>
                </div>

                {/* Body Content */}
                {clientsExpanded && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFF' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                      
                      {/* Search client input */}
                      <div className="kfpl-search" style={{ margin: 0, flex: 1, maxWidth: '320px' }}>
                        {svgIcons.search}
                        <input 
                          type="text" 
                          placeholder="Search clients..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                        />
                      </div>

                      {/* Select/Clear client actions */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button" 
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          onClick={handleToggleAllClients}
                          style={{ border: '1.5px solid var(--color-border)', borderRadius: '6px', height: 'auto', padding: '6px 12px' }}
                        >
                          {isAllClientsSelected ? 'Deselect All Clients' : 'Select All Clients'}
                        </button>
                        {selectedClientsCount > 0 && (
                          <button 
                            type="button" 
                            className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm"
                            onClick={() => {
                              const clientIds = clients.map(c => c.id);
                              setSelectedRecipients(prev => prev.filter(id => !clientIds.includes(id)));
                              addToast('Cleared client selections', 'info', 'Reset');
                            }}
                            style={{ color: '#EF4444', border: '1.5px solid #FCA5A5', height: 'auto', padding: '6px 12px' }}
                          >
                            Clear Clients
                          </button>
                        )}
                      </div>

                    </div>

                    {/* Scrollable list */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                      {filteredClients.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          No clients found matching the query.
                        </div>
                      ) : (
                        filteredClients.map(c => {
                          const isChecked = selectedRecipients.includes(c.id);
                          return (
                            <label 
                              key={c.id}
                              style={{ 
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', 
                                border: isChecked ? '1.5px solid var(--color-gold)' : '1.5px solid #E2E8F0',
                                borderRadius: '8px', background: isChecked ? 'var(--color-gold-glow)' : '#FFF',
                                cursor: 'pointer', margin: 0, transition: 'var(--transition-fast)'
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handleToggleRecipient(c.id)}
                                style={{ accentColor: 'var(--color-gold)', scale: '1.1' }}
                              />
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{c.name}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.code} • {c.email}</span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion Item 2: Agents Selection */}
              <div style={{ border: '1.5px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
                {/* Header */}
                <div 
                  onClick={() => setAgentsExpanded(!agentsExpanded)}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '14px 20px', 
                    background: '#F8FAFC', 
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderBottom: agentsExpanded ? '1.5px solid var(--color-border)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Agent List</span>
                    <Badge status={selectedAgentsCount > 0 ? 'active' : 'inactive'}>
                      {selectedAgentsCount} Selected
                    </Badge>
                  </div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', transition: '0.2s', transform: agentsExpanded ? 'rotate(180deg)' : 'none' }}>
                    {svgIcons.chevronDown}
                  </span>
                </div>

                {/* Body Content */}
                {agentsExpanded && (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFF' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                      
                      {/* Search agent input */}
                      <div className="kfpl-search" style={{ margin: 0, flex: 1, maxWidth: '320px' }}>
                        {svgIcons.search}
                        <input 
                          type="text" 
                          placeholder="Search agents..."
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                        />
                      </div>

                      {/* Select/Clear agent actions */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          type="button" 
                          className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                          onClick={handleToggleAllAgents}
                          style={{ border: '1.5px solid var(--color-border)', borderRadius: '6px', height: 'auto', padding: '6px 12px' }}
                        >
                          {isAllAgentsSelected ? 'Deselect All Agents' : 'Select All Agents'}
                        </button>
                        {selectedAgentsCount > 0 && (
                          <button 
                            type="button" 
                            className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm"
                            onClick={() => {
                              const agentIds = agents.map(a => a.id);
                              setSelectedRecipients(prev => prev.filter(id => !agentIds.includes(id)));
                              addToast('Cleared agent selections', 'info', 'Reset');
                            }}
                            style={{ color: '#EF4444', border: '1.5px solid #FCA5A5', height: 'auto', padding: '6px 12px' }}
                          >
                            Clear Agents
                          </button>
                        )}
                      </div>

                    </div>

                    {/* Scrollable list */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                      {filteredAgents.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          No agents found matching the query.
                        </div>
                      ) : (
                        filteredAgents.map(a => {
                          const isChecked = selectedRecipients.includes(a.id);
                          return (
                            <label 
                              key={a.id}
                              style={{ 
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', 
                                border: isChecked ? '1.5px solid var(--color-gold)' : '1.5px solid #E2E8F0',
                                borderRadius: '8px', background: isChecked ? 'var(--color-gold-glow)' : '#FFF',
                                cursor: 'pointer', margin: 0, transition: 'var(--transition-fast)'
                              }}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handleToggleRecipient(a.id)}
                                style={{ accentColor: 'var(--color-gold)', scale: '1.1' }}
                              />
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
                                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{a.name}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{a.code} • {a.email}</span>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* STEP 2: Compose & Content (Full Width) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
            
            {/* Left Box: Mail Form */}
            <form className="kfpl-card" onSubmit={handleSendNotification} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Step 2: Compose Mail Content</h3>
              </div>

              {/* Template Selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                
                {/* Built-in dropdown */}
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">{templateDropdownLabel}</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select 
                      className="kfpl-select" 
                      value={selectedTemplate} 
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {/* Always show Custom Email (Blank) first */}
                      {filteredTemplates.filter(t => t.targetRole === 'all' || !t.targetRole).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                      {/* Client templates group */}
                      {filteredTemplates.some(t => t.targetRole === 'client') && (
                        <optgroup label="— Client Templates —">
                          {filteredTemplates.filter(t => t.targetRole === 'client').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* Agent templates group */}
                      {filteredTemplates.some(t => t.targetRole === 'agent') && (
                        <optgroup label="— Agent Templates —">
                          {filteredTemplates.filter(t => t.targetRole === 'agent').map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      )}
                      {/* Custom user-created templates */}
                      {filteredTemplates.some(t => t.isCustom) && (
                        <optgroup label="— Custom Templates —">
                          {filteredTemplates.filter(t => t.isCustom).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {templates.find(t => t.id === selectedTemplate)?.isCustom && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm"
                          onClick={handleUpdateCustomTemplate}
                          title="Save changes to this template"
                          style={{ padding: '8px 12px', border: '1.5px solid var(--color-gold)', color: 'var(--color-gold-dark)', borderRadius: '8px', height: '100%' }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="kfpl-btn kfpl-btn--secondary kfpl-btn--sm"
                          onClick={handleDeleteCustomTemplate}
                          title="Delete this template"
                          style={{ padding: '8px 12px', border: '1.5px solid #FCA5A5', color: '#EF4444', borderRadius: '8px', height: '100%' }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                  {recipientSelectionType !== 'none' && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      {recipientSelectionType === 'agent' && '🔸 Agent recipients detected — showing agent-specific templates'}
                      {recipientSelectionType === 'client' && '🔹 Client recipients detected — showing client-specific templates'}
                      {recipientSelectionType === 'mixed' && '📋 Mixed recipients — showing all available templates'}
                    </p>
                  )}
                </div>

                {/* Upload HTML Template file */}
                <div className="kfpl-input-group">
                  <label className="kfpl-input-label">Upload HTML Template File</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="file"
                      ref={htmlUploadRef}
                      accept=".html,.htm"
                      onChange={handleHtmlTemplateUpload}
                      style={{ display: 'none' }}
                    />
                    <button 
                      type="button"
                      className="kfpl-btn kfpl-btn--ghost"
                      onClick={() => htmlUploadRef.current.click()}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center', border: '1.5px solid var(--color-border)', borderRadius: '8px' }}
                    >
                      {svgIcons.upload}
                      Upload .html File
                    </button>
                  </div>
                </div>

              </div>

              {/* Subject Line */}
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Email Subject Line <span className="required">*</span></label>
                <input 
                  type="text" 
                  className="kfpl-input"
                  placeholder="Enter subject heading..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              {/* Message Body Composer */}
              <div className="kfpl-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="kfpl-input-label">Email Body Content (HTML supported) <span className="required">*</span></label>
                </div>
                <textarea 
                  className="kfpl-input"
                  style={{ minHeight: '220px', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5', borderRadius: '10px' }}
                  placeholder="Enter email content. HTML blocks like <h3>, <p>, and <strong> tags can be used..."
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  required
                />
              </div>

              {/* Attachment Area */}
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Attach Files, Videos or Documents</label>
                <div 
                  onClick={() => fileInputRef.current.click()}
                  className="kfpl-custom-dotted-dropzone"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    multiple
                  />
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-gold-dark)', marginBottom: '8px', marginInline: 'auto' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Click to upload file resources</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Supported: PDF, Images, Videos, ZIP, Docs (Max 25MB)</div>
                </div>

                {/* Uploaded Attachments list */}
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {attachments.map((file, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#F1F5F9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          {svgIcons.paperclip}
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>({file.size})</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => removeAttachment(idx)}
                          style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                        >
                          {svgIcons.trash}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Mode & Scheduling Console */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <span className="kfpl-input-label" style={{ marginBottom: 0 }}>Send Timing:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="radio" 
                      name="sendMode" 
                      checked={sendMode === 'now'} 
                      onChange={() => setSendMode('now')}
                      style={{ accentColor: 'var(--color-gold)' }}
                    />
                    Send Immediately
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input 
                      type="radio" 
                      name="sendMode" 
                      checked={sendMode === 'schedule'} 
                      onChange={() => setSendMode('schedule')}
                      style={{ accentColor: 'var(--color-gold)' }}
                    />
                    Schedule for Later
                  </label>
                </div>

                {sendMode === 'schedule' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1.5px solid var(--color-border)', animate: 'fadeIn 0.2s ease' }}>
                    
                    {/* Date Picker Row with day calculation */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                      <div className="kfpl-input-group">
                        <label className="kfpl-input-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {svgIcons.calendar}
                          Select Date
                        </label>
                        <input 
                          type="date" 
                          className="kfpl-input"
                          value={scheduleDate}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          style={{ padding: '8px 12px' }}
                        />
                      </div>
                      
                      {/* Dynamic Day Helper Block */}
                      <div className="kfpl-input-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        <div style={{ padding: '10px 14px', background: '#FFF', border: '1.5px solid var(--color-border)', borderRadius: '8px', height: '40px', display: 'flex', alignItems: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                          Day: <span style={{ color: 'var(--color-gold-dark)', marginLeft: '6px' }}>{getDayOfWeek(scheduleDate) || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Time Selectors Row (AM/PM Custom Pickers) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div className="kfpl-input-group">
                        <label className="kfpl-input-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {svgIcons.clock}
                          Hour
                        </label>
                        <select 
                          className="kfpl-select" 
                          value={scheduleHour} 
                          onChange={(e) => setScheduleHour(e.target.value)}
                        >
                          {hourOptions.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="kfpl-input-group">
                        <label className="kfpl-input-label">Minute</label>
                        <select 
                          className="kfpl-select" 
                          value={scheduleMinute} 
                          onChange={(e) => setScheduleMinute(e.target.value)}
                        >
                          {minuteOptions.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="kfpl-input-group">
                        <label className="kfpl-input-label">AM / PM</label>
                        <select 
                          className="kfpl-select" 
                          value={schedulePeriod} 
                          onChange={(e) => setSchedulePeriod(e.target.value)}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>



                  </div>
                )}
              </div>

              {/* Form submit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '6px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  Selected Targets: <strong>{selectedRecipients.length}</strong>
                </div>
                <button 
                  type="submit" 
                  className="kfpl-btn kfpl-btn--primary"
                  disabled={isSending}
                  style={{ minWidth: '160px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                >
                  {isSending ? (
                    <>
                      <span className="kfpl-spinner" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      {svgIcons.send}
                      {sendMode === 'schedule' ? 'Schedule Campaign' : 'Dispatch Email'}
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Right Box: Instructions / Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Template creation button */}
              <div className="kfpl-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Email Layout Templates</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: '1.4', margin: 0 }}>
                  Upload dynamic Welcome HTML layout scripts or configure templates using our inline creation utility.
                </p>
                <button 
                  type="button" 
                  className="kfpl-btn kfpl-btn--secondary"
                  onClick={() => setShowAddTemplateModal(true)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {svgIcons.plus}
                  Configure Custom Template
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: Sent History & Scheduled Logs */}
      {activeTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Sub-tab toggle buttons */}
          <div style={{ display: 'flex', gap: '0', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid var(--color-border)', width: 'fit-content' }}>
            <button 
              type="button"
              onClick={() => setLogsSubTab('sent')}
              style={{ 
                padding: '10px 22px', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                border: 'none', 
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: logsSubTab === 'sent' ? 'var(--color-gold)' : '#F8FAFC', 
                color: logsSubTab === 'sent' ? '#FFF' : 'var(--color-text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              {svgIcons.send}
              Sent History ({sentLogs.filter(l => l.status === 'Delivered' || l.status === 'Failed').length})
            </button>
            <button 
              type="button"
              onClick={() => setLogsSubTab('scheduled')}
              style={{ 
                padding: '10px 22px', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                border: 'none', 
                borderLeft: '1.5px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: logsSubTab === 'scheduled' ? 'var(--color-gold)' : '#F8FAFC', 
                color: logsSubTab === 'scheduled' ? '#FFF' : 'var(--color-text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              {svgIcons.clock}
              Scheduled Queue ({sentLogs.filter(l => l.status === 'Scheduled').length})
            </button>
          </div>

          {/* Sub-tab: Sent History */}
          {logsSubTab === 'sent' && (
            <DataTable
              columns={logColumns}
              data={sentLogs.filter(l => l.status !== 'Scheduled')}
              onRowClick={(row) => setSelectedLog(row)}
              searchPlaceholder="Search sent emails by subject, recipient, template or status..."
            />
          )}

          {/* Sub-tab: Scheduled Queue */}
          {logsSubTab === 'scheduled' && (
            <>
              <div className="kfpl-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1.5px solid var(--color-border)', borderRadius: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Scheduled Delivery Queue</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Emails waiting to be dispatched at their scheduled time. Force process to send immediately.</p>
                </div>
                <button 
                  type="button" 
                  className="kfpl-btn kfpl-btn--primary kfpl-btn--sm"
                  onClick={handleForceProcessQueue}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', height: 'auto', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
                >
                  ⚡ Force Process Queue
                </button>
              </div>
              <DataTable
                columns={logColumns}
                data={sentLogs.filter(l => l.status === 'Scheduled')}
                onRowClick={(row) => setSelectedLog(row)}
                searchPlaceholder="Search scheduled emails by subject, recipient or template..."
              />
            </>
          )}
        </div>
      )}

      {/* Tab 3: Auto-Trigger Configuration */}
      {activeTab === 'auto' && (
        <div className="kfpl-table-container">
          <div className="kfpl-table-toolbar">
            <span className="kfpl-table-count">
              Modify triggers that dispatch dynamic emails during core operational workflows.
            </span>
          </div>

          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>System Event Trigger</th>
                  <th>Recipient Portal</th>
                  <th>Automatic Status</th>
                  <th>Total Emails Sent</th>
                  <th>Last Executed</th>
                  <th style={{ textAlign: 'center' }}>Toggle Status</th>
                </tr>
              </thead>
              <tbody>
                {autoTriggers.map(item => (
                  <tr key={item.id}>
                    <td className="kfpl-table-cell-primary">{item.event}</td>
                    <td>
                      <span className="kfpl-stat-pill">
                        <span className="kfpl-stat-pill-value">{item.recipient}</span>
                      </span>
                    </td>
                    <td>
                      <Badge status={item.status === 'active' ? 'active' : 'inactive'}>
                        {item.status === 'active' ? 'ENABLED' : 'DISABLED'}
                      </Badge>
                    </td>
                    <td className="font-semibold">{item.count.toLocaleString()}</td>
                    <td className="text-muted text-sm">{item.lastSent}</td>
                    <td style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
                      {/* Premium Toggle Switch */}
                      <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '22px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox"
                          checked={item.status === 'active'}
                          onChange={() => handleToggleAutoTrigger(item.id, item.event)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{ 
                          position: 'absolute', 
                          top: 0, left: 0, right: 0, bottom: 0, 
                          backgroundColor: item.status === 'active' ? '#10B981' : '#D1D5DB', 
                          borderRadius: '34px',
                          transition: '0.3s',
                        }}>
                          <span style={{ 
                            position: 'absolute', 
                            content: '""', 
                            height: '16px', width: '16px', 
                            left: item.status === 'active' ? '24px' : '4px', 
                            bottom: '3px', 
                            backgroundColor: 'white', 
                            borderRadius: '50%',
                            transition: '0.3s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Custom Template */}
      {showAddTemplateModal && (
        <div className="kfpl-modal-overlay" onClick={() => setShowAddTemplateModal(false)}>
          <form 
            className="kfpl-modal" 
            onSubmit={handleAddTemplate}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px' }}
          >
            <div className="kfpl-modal-header">
              <h3 className="kfpl-modal-title">Create Custom Mail Template</h3>
              <button 
                type="button"
                className="kfpl-modal-close"
                onClick={() => setShowAddTemplateModal(false)}
                style={{ border: 'none', background: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="kfpl-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Template Name <span className="required">*</span></label>
                <input 
                  type="text"
                  className="kfpl-input"
                  placeholder="e.g. Festival Greeting, Monthly Newsletter..."
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  required
                />
              </div>

              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Email Subject Line <span className="required">*</span></label>
                <input 
                  type="text"
                  className="kfpl-input"
                  placeholder="Enter default subject for this template..."
                  value={newTemplateSubject}
                  onChange={(e) => setNewTemplateSubject(e.target.value)}
                  required
                />
              </div>

              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Template Body Message <span className="required">*</span></label>
                <textarea 
                  className="kfpl-input"
                  style={{ minHeight: '160px', fontFamily: 'monospace', borderRadius: '10px' }}
                  placeholder="Enter default body message. Supports shortcodes like {ClientName} or [ClientName]..."
                  value={newTemplateBody}
                  onChange={(e) => setNewTemplateBody(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="kfpl-modal-footer">
              <button 
                type="button" 
                className="kfpl-btn kfpl-btn--secondary"
                onClick={() => setShowAddTemplateModal(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="kfpl-btn kfpl-btn--primary"
              >
                Save & Use Template
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sent Log Modal Detail View */}
      {selectedLog && (
        <div className="kfpl-modal-overlay" onClick={() => setSelectedLog(null)}>
          <div 
            className="kfpl-modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '680px' }}
          >
            <div className="kfpl-modal-header">
              <div>
                <span className="text-muted text-sm" style={{ display: 'block', marginBottom: '2px' }}>{selectedLog.dateTime}</span>
                <h3 className="kfpl-modal-title">Sent Notification Details</h3>
              </div>
              <button 
                type="button"
                className="kfpl-modal-close"
                onClick={() => setSelectedLog(null)}
                style={{ border: 'none', background: 'none' }}
              >
                ✕
              </button>
            </div>

            <div className="kfpl-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Meta information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Recipient Type:</strong> {selectedLog.recipientType}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Recipients list:</strong> {selectedLog.recipientSummary}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Template:</strong> {selectedLog.templateName}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--color-text-secondary)' }}>Subject:</strong> {selectedLog.subject}
                </div>
                {selectedLog.scheduledFor && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-gold-dark)', fontWeight: 600 }}>
                    ⏰ Scheduled For Delivery: {selectedLog.scheduledFor}
                  </div>
                )}
              </div>

              {/* Email Message Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Message Preview:</span>
                <div 
                  style={{ 
                    border: '1.5px solid var(--color-border)', 
                    borderRadius: '10px', 
                    padding: '16px', 
                    maxHeight: '200px', 
                    overflowY: 'auto', 
                    background: '#FFF', 
                    fontSize: '0.875rem', 
                    lineHeight: '1.6' 
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedLog.body }}
                />
              </div>

              {/* Attachments Section inside Modal */}
              {selectedLog.attachments.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '6px' }}>Attached Resources:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedLog.attachments.map((file, index) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#FAFAFA' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>📎 {file.name} ({file.size})</span>
                        <a href="#" onClick={(e) => { e.preventDefault(); alert(`Simulating file download: ${file.name}`); }} style={{ fontSize: '0.78rem', color: 'var(--color-gold-dark)', fontWeight: 600, textDecoration: 'underline' }}>Download</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="kfpl-modal-footer">
              <button 
                type="button"
                className="kfpl-btn kfpl-btn--secondary"
                onClick={() => setSelectedLog(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
