/* ============================================================
   Component: Header.jsx
   Description: Professional top bar with breadcrumb, admin profile,
                and interactive Universal Search, Onboarding Notifications,
                and Latest Service Requests dropdowns.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiUrl } from '../../config/apiUrl';
import { apiRequest } from '../../config/apiHelper';
import { getAuthToken, clearAuthData, getAuthUser } from '../../utils/authStorage';

// ── Route to Title & Breadcrumb Map ───────────────────────
const routeConfig = {
  '/dashboard': { title: 'Dashboard', breadcrumb: 'Overview' },
  '/investors': { title: 'Manage Clients', breadcrumb: 'Client & Agent' },
  '/investors/add': { title: 'Add New Client', breadcrumb: 'Client & Agent / Clients' },
  '/agents': { title: 'Manage Agents', breadcrumb: 'Client & Agent' },
  '/agents/add': { title: 'Add New Agent', breadcrumb: 'Client & Agent / Agents' },
  '/investments': { title: 'Manage Investments', breadcrumb: 'Investment Management' },
  '/investments/assign': { title: 'Assign Investment', breadcrumb: 'Investment Management' },
  '/roi': { title: 'Complete Transaction Details', breadcrumb: 'Investment Management' },
  '/investment-status': { title: 'Investment Status', breadcrumb: 'Investment Management' },
  '/portfolio': { title: 'Portfolio Management', breadcrumb: 'Investment Management' },
  '/perks': { title: 'Perks & Recognition', breadcrumb: 'Investment Management' },
  '/approvals': { title: 'Deposit & Withdrawal Approvals', breadcrumb: 'Operations' },
  '/approvals/history': { title: 'Approval History', breadcrumb: 'Operations / Approvals' },
  '/email-notifications': { title: 'Email Notifications', breadcrumb: 'Operations' },
  '/faq': { title: 'FAQ Control Board', breadcrumb: 'Operations' },
  '/settings': { title: 'Settings', breadcrumb: 'Operations' },
};

const navigationPages = [
  { title: 'Dashboard Overview', path: '/dashboard', category: 'Page', desc: 'Platform overview, KPIs, total investors, active investments & monthly trends', keywords: ['dashboard', 'overview', 'analytics', 'home', 'kpis', 'metrics', 'welcome back', 'total investment', 'total investors', 'roi paid', 'active investments', 'pending approvals'] },
  { title: 'Manage Clients', path: '/investors', category: 'Page', desc: 'View, filter, edit & manage all registered investor clients', keywords: ['clients', 'client', 'investors', 'investor', 'manage clients', 'customers', 'client list', 'client code'] },
  { title: 'Add New Client', path: '/investors/add', category: 'Page', desc: 'Onboard and register a new client profile with initial capital', keywords: ['add client', 'create client', 'new client', 'register client', 'onboard client'] },
  { title: 'Manage Agents', path: '/agents', category: 'Page', desc: 'View agent network, manage agent profiles & commission rates', keywords: ['agents', 'agent', 'broker', 'manage agents', 'sub-agent', 'agent code', 'agent list', 'commission'] },
  { title: 'Add New Agent', path: '/agents/add', category: 'Page', desc: 'Onboard and register a new agent partner', keywords: ['add agent', 'create agent', 'new agent', 'register agent', 'onboard agent'] },
  { title: 'Manage Investments', path: '/investments', category: 'Page', desc: 'View and assign client capital investments', keywords: ['investments', 'investment', 'manage investments', 'capital', 'funds', 'unallocated capital', 'allocated capital', 'active investments'] },
  { title: 'Assign Investment', path: '/investments/assign', category: 'Page', desc: 'Allocate client capital to specific film projects & segments', keywords: ['assign investment', 'allocate investment', 'project assign', 'assign capital', 'new investment'] },
  { title: 'Investment Status', path: '/investment-status', category: 'Page', desc: 'Track active vs unallocated capital allocations & project links', keywords: ['investment status', 'status of investment', 'unallocated', 'allocated', 'capital status', 'active investments', 'status'] },
  { title: 'Transaction & ROI Details', path: '/roi', category: 'Page', desc: 'Track monthly ROI returns, payouts & ledger entries', keywords: ['transaction details', 'complete transaction details', 'roi', 'roi paid', 'monthly returns', 'payout', 'ledger', 'payouts', 'transactions'] },
  { title: 'Portfolio Management', path: '/portfolio', category: 'Page', desc: 'Film fund projects, segments, target funding & performance', keywords: ['portfolio', 'portfolio management', 'projects', 'project', 'film fund', 'media fund', 'segments', 'segment', 'target funding', 'min investment'] },
  { title: 'Perks & Recognition', path: '/perks', category: 'Page', desc: 'Investor loyalty perks, reward tiers & milestones', keywords: ['perks', 'perk', 'perks & recognition', 'recognition', 'rewards', 'reward', 'loyalty', 'tier', 'milestones'] },
  { title: 'Deposit & Withdrawal Approvals', path: '/approvals', category: 'Page', desc: 'Review & approve pending deposit and withdrawal requests', keywords: ['approvals', 'approval', 'deposit', 'withdrawal', 'pending approvals', 'money deposit', 'payout approval', 'receipt', 'pending'] },
  { title: 'Approval History', path: '/approvals/history', category: 'Page', desc: 'Audit trail of past approved & rejected financial requests', keywords: ['approval history', 'passed approvals', 'rejected approvals', 'history', 'logs', 'audit'] },
  { title: 'Client Portal Hub', path: '/portals/client', category: 'Page', desc: 'Manage client portal login credentials, passwords & access', keywords: ['client portal', 'client portal hub', 'portal credentials', 'client login credentials', 'credentials', 'password', 'copy credentials', 'mock'] },
  { title: 'Agent Portal Hub', path: '/portals/agent', category: 'Page', desc: 'Manage agent portal login credentials, passwords & access', keywords: ['agent portal', 'agent portal hub', 'agent login credentials', 'agent credentials', 'agent login', 'credentials'] },
  { title: 'Email Notifications', path: '/email-notifications', category: 'Page', desc: 'Configure automated system emails, triggers & templates', keywords: ['email', 'notifications', 'email notifications', 'templates', 'auto triggers', 'smtp', 'mail'] },
  { title: 'Service Requests', path: '/service-requests', category: 'Page', desc: 'Manage client & agent support tickets, queries & issues', keywords: ['service requests', 'recent service requests', 'support tickets', 'queries', 'query', 'tickets', 'support'] },
  { title: 'News & Media Control', path: '/news-media', category: 'Page', desc: 'Publish and manage press releases, news & media articles', keywords: ['news', 'media', 'news & media', 'news media', 'press', 'articles', 'article', 'heading', 'upload news', 'news article', 'press release'] },
  { title: 'Add News Article', path: '/news-media/add', category: 'Page', desc: 'Create and publish a new press release or article', keywords: ['add news', 'create news', 'publish article', 'upload article', 'new article'] },
  { title: 'FAQ Control Board', path: '/faq', category: 'Page', desc: 'Manage help questions, answers & portal knowledge base', keywords: ['faq', 'faqs', 'faq control board', 'questions', 'answers', 'how to update', 'help', 'knowledge base', 'guide'] },
  { title: 'Sub-Admin Management', path: '/sub-admins', category: 'Page', desc: 'Manage sub-admin accounts, roles & granular permissions', keywords: ['sub admin', 'sub-admins', 'sub admin management', 'rbac', 'staff', 'admin permissions', 'roles', 'team'] },
  { title: 'Settings', path: '/settings', category: 'Page', desc: 'Platform configuration, system defaults & security', keywords: ['settings', 'system settings', 'general settings', 'platform settings', 'config'] },
  { title: 'Commission Slabs Config', path: '/settings/commission-slabs', category: 'Page', desc: 'Configure agent commission tiers, percentages & slabs', keywords: ['commission slab', 'commission slabs', 'commission config', 'agent commission', 'commission percentage', 'slabs', 'slab'] },
  { title: 'Rewards Configuration', path: '/settings/rewards', category: 'Page', desc: 'Configure milestone reward bonuses & perk thresholds', keywords: ['reward config', 'rewards config', 'rewards configuration', 'perk rewards', 'agent rewards', 'reward slabs'] },
];

function getPageConfig(pathname) {
  if (routeConfig[pathname]) return routeConfig[pathname];
  if (pathname.match(/^\/investors\/\d+\/edit/)) return { title: 'Edit Client', breadcrumb: 'Client & Agent / Clients' };
  if (pathname.match(/^\/investors\/\d+/)) return { title: 'Client Details', breadcrumb: 'Client & Agent / Clients' };
  if (pathname.match(/^\/roi\/\d+/)) return { title: 'ROI Details', breadcrumb: 'Investment Management / ROI' };
  if (pathname.match(/^\/agents\/\d+\/edit/)) return { title: 'Edit Agent', breadcrumb: 'Client & Agent / Agents' };
  if (pathname.match(/^\/agents\/\d+/)) return { title: 'Agent Details', breadcrumb: 'Client & Agent / Agents' };
  return { title: 'Super Admin', breadcrumb: '' };
}

export default function Header({ isCollapsed, onMenuClick }) {
  const location = useLocation();
  const navigate = useNavigate();
  const config = getPageConfig(location.pathname);

  // Dropdown visibility states
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showRequestDropdown, setShowRequestDropdown] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [clientsList, setClientsList] = useState([]);
  const [agentsList, setAgentsList] = useState([]);
  const [rawProjectsList, setRawProjectsList] = useState([]);
  const [rawArticlesList, setRawArticlesList] = useState([]);
  const [rawRequestsList, setRawRequestsList] = useState([]);
  const [faqsList, setFaqsList] = useState([]);
  const [rawDepositsList, setRawDepositsList] = useState([]);
  const [rawWithdrawalsList, setRawWithdrawalsList] = useState([]);
  const [searchResults, setSearchResults] = useState({ pages: [], clients: [], agents: [], projects: [], articles: [], requests: [], faqs: [], transactions: [] });

  // Notifications states (onboarded clients & agents)
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Service requests state
  const [requestsList, setRequestsList] = useState([]);
  const [hasUnreadRequests, setHasUnreadRequests] = useState(false);
  const [unreadRequestsCount, setUnreadRequestsCount] = useState(0);

  // Refs for click-away detection
  const profileRef = useRef(null);
  const searchRef = useRef(null);
  const notificationRef = useRef(null);
  const requestRef = useRef(null);

  // Read logged-in admin info
  const adminInfo = getAuthUser();
  const adminName = adminInfo?.name || 'Super Admin';
  const adminEmail = adminInfo?.email || 'admin@kfpl.com';
  const adminRole = adminInfo?.role || 'super-admin';
  const roleLabel = adminRole === 'sub-admin' ? 'Sub Admin' : 'Administrator';

  useEffect(() => {
    document.documentElement.classList.remove('dark-theme');
    localStorage.removeItem('kfpl_theme');
  }, []);

  // Fetch initial data for notifications & requests on mount
  const fetchHeaderData = async () => {
    try {
      // Determine sub-admin permissions to guard API calls
      const perms = adminInfo?.permissions;
      const isSuperAdminUser = adminRole !== 'sub-admin';
      const canViewClients = isSuperAdminUser || !!perms?.manageClients?.view;
      const canViewAgents = isSuperAdminUser || !!perms?.manageAgents?.view;
      const canViewRequests = isSuperAdminUser || !!perms?.serviceRequests?.view;
      const canViewApprovals = isSuperAdminUser || !!perms?.depositWithdrawal?.view;

      // 1. Fetch Clients, Agents, Service Requests, Deposits, Withdrawals, Projects, Articles, and FAQs concurrently
      const [clientsData, agentsData, requestsData, depositsData, withdrawalsData, projectsData, articlesData, faqsData] = await Promise.all([
        canViewClients ? apiRequest('/api/super-admin/clients').catch(() => []) : Promise.resolve([]),
        canViewAgents ? apiRequest('/api/super-admin/agents').catch(() => []) : Promise.resolve([]),
        canViewRequests ? apiRequest('/api/super-admin/service-requests').catch(() => []) : Promise.resolve([]),
        canViewApprovals ? apiRequest('/api/super-admin/transactions/approvals?type=deposit&limit=100').catch(() => ({ queue: [] })) : Promise.resolve({ queue: [] }),
        canViewApprovals ? apiRequest('/api/super-admin/transactions/approvals?type=withdrawal&limit=100').catch(() => ({ queue: [] })) : Promise.resolve({ queue: [] }),
        apiRequest('/api/super-admin/projects').catch(() => []),
        apiRequest('/api/super-admin/articles').catch(() => []),
        apiRequest('/api/super-admin/faqs').catch(() => []),
      ]);
      
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

      const extractQueue = (res) => {
        if (!res) return [];
        const data = res.data || res;
        if (Array.isArray(data)) return data;
        if (data.transactions && Array.isArray(data.transactions)) return data.transactions;
        if (data.queue && Array.isArray(data.queue)) return data.queue;
        return [];
      };

      const extractList = (res) => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (res.data) {
          if (Array.isArray(res.data)) return res.data;
          if (res.data.projects && Array.isArray(res.data.projects)) return res.data.projects;
          if (res.data.articles && Array.isArray(res.data.articles)) return res.data.articles;
          if (res.data.faqs && Array.isArray(res.data.faqs)) return res.data.faqs;
        }
        if (res.projects && Array.isArray(res.projects)) return res.projects;
        if (res.articles && Array.isArray(res.articles)) return res.articles;
        if (res.faqs && Array.isArray(res.faqs)) return res.faqs;
        return [];
      };

      const clients = extractClients(clientsData);
      const agents = extractAgents(agentsData);
      const deposits = extractQueue(depositsData);
      const withdrawals = extractQueue(withdrawalsData);
      const projectsList = extractList(projectsData);
      const articlesList = extractList(articlesData);
      const faqsListFetched = extractList(faqsData);

      let reqs = [];
      if (Array.isArray(requestsData)) {
        reqs = requestsData;
      } else if (requestsData) {
        reqs = requestsData.data?.requests || requestsData.requests || requestsData.serviceRequests || (Array.isArray(requestsData.data) ? requestsData.data : []) || [];
      }

      setClientsList(clients);
      setAgentsList(agents);
      setRawProjectsList(projectsList);
      setRawArticlesList(articlesList);
      setRawRequestsList(reqs);
      setFaqsList(faqsListFetched);
      setRawDepositsList(deposits);
      setRawWithdrawalsList(withdrawals);

      // Create a unified list of notification events sorted by date
      const notifyList = [];

      // Pending Deposits
      deposits.forEach(d => {
        if ((d.status || 'pending').toLowerCase() === 'pending') {
          const clientDisplayName = d.investorName || d.clientName || (d.clientId ? d.clientId.name : '') || d.clientCode || 'Client';
          notifyList.push({
            id: 'dep-' + (d._id || d.id),
            type: 'deposit',
            title: 'Deposit Approval Needed',
            name: `${clientDisplayName} — ₹${Number(d.amount || 0).toLocaleString('en-IN')}`,
            email: d.paymentMethod ? `Method: ${d.paymentMethod}` : 'Pending Deposit',
            date: d.createdAt || d.actionAt ? new Date(d.createdAt || d.actionAt) : new Date(),
            link: '/approvals'
          });
        }
      });

      // Pending Withdrawals
      withdrawals.forEach(w => {
        if ((w.status || 'pending').toLowerCase() === 'pending') {
          const clientDisplayName = w.investorName || w.clientName || (w.clientId ? w.clientId.name : '') || w.clientCode || 'Client';
          notifyList.push({
            id: 'with-' + (w._id || w.id),
            type: 'withdrawal',
            title: 'Withdrawal Request',
            name: `${clientDisplayName} — ₹${Number(w.amount || 0).toLocaleString('en-IN')}`,
            email: w.paymentMethod ? `Method: ${w.paymentMethod}` : 'Pending Withdrawal',
            date: w.createdAt || w.actionAt ? new Date(w.createdAt || w.actionAt) : new Date(),
            link: '/approvals'
          });
        }
      });

      // Service Requests are shown ONLY in the Chat Icon dropdown, NOT in the Bell Icon dropdown

      // Client Onboarding & KYC Review
      clients.forEach(c => {
        const cDate = c.createdAt ? new Date(c.createdAt) : null;
        if (cDate && (Date.now() - cDate.getTime() < 7 * 24 * 60 * 60 * 1000)) {
          notifyList.push({
            id: 'c-' + (c._id || c.id),
            type: 'client',
            title: 'New Client Onboarded',
            name: c.fullName || c.name || 'New Client',
            email: c.email || c.clientCode || '',
            date: cDate,
            link: `/investors/${c._id || c.id}`
          });
        }
        if (c.kycStatus === 'Pending' || c.kycStatus === 'submitted' || c.kycStatus === 'Submitted') {
          notifyList.push({
            id: 'kyc-c-' + (c._id || c.id),
            type: 'kyc',
            title: 'Client KYC Under Review',
            name: c.fullName || c.name || 'Client KYC',
            email: 'Verification Pending',
            date: c.updatedAt || c.createdAt ? new Date(c.updatedAt || c.createdAt) : new Date(),
            link: `/investors/${c._id || c.id}`
          });
        }
      });

      // Agent Onboarding & KYC Review
      agents.forEach(a => {
        const aDate = a.createdAt ? new Date(a.createdAt) : null;
        if (aDate && (Date.now() - aDate.getTime() < 7 * 24 * 60 * 60 * 1000)) {
          notifyList.push({
            id: 'a-' + (a._id || a.id),
            type: 'agent',
            title: 'New Agent Onboarded',
            name: a.name || a.fullName || 'New Agent',
            email: a.email || a.code || '',
            date: aDate,
            link: `/agents/${a._id || a.id}`
          });
        }
        if (a.kycStatus === 'Pending' || a.kycStatus === 'submitted' || a.kycStatus === 'Submitted') {
          notifyList.push({
            id: 'kyc-a-' + (a._id || a.id),
            type: 'kyc',
            title: 'Agent KYC Under Review',
            name: a.name || a.fullName || 'Agent KYC',
            email: 'Verification Pending',
            date: a.updatedAt || a.createdAt ? new Date(a.updatedAt || a.createdAt) : new Date(),
            link: `/agents/${a._id || a.id}`
          });
        }
      });

      // Projects and Articles notifications are intended for Client & Agent portals, not Super Admin self-notifications

      // Sort notification list: latest first
      notifyList.sort((a, b) => b.date - a.date);

      // Read read & cleared status from localStorage
      let readIds = [];
      let clearedIds = [];
      let lastReadTime = 0;
      try {
        const storedReadIds = localStorage.getItem('kfpl_read_notifications');
        readIds = storedReadIds ? JSON.parse(storedReadIds) : [];
        const storedClearedIds = localStorage.getItem('kfpl_cleared_notifications');
        clearedIds = storedClearedIds ? JSON.parse(storedClearedIds) : [];
        const storedLastRead = localStorage.getItem('kfpl_notifications_last_read');
        lastReadTime = storedLastRead ? parseInt(storedLastRead, 10) : 0;
      } catch (e) {
        console.error('Error loading notification read state:', e);
      }

      const activeNotifyList = notifyList.filter(n => !clearedIds.includes(n.id));

      const formattedNotifications = activeNotifyList.slice(0, 20).map(n => {
        const isActionItem = n.type === 'deposit' || n.type === 'withdrawal' || n.type === 'service';
        let isRead = false;
        if (isActionItem) {
          isRead = readIds.includes(n.id);
        } else {
          const itemTime = n.date ? n.date.getTime() : 0;
          isRead = readIds.includes(n.id) || (lastReadTime > 0 && itemTime <= lastReadTime);
        }
        return { ...n, isRead };
      });

      setNotifications(formattedNotifications);
      setUnreadNotifications(formattedNotifications.filter(n => !n.isRead).length);

      // 2. Process Service Requests for the chat bubble
      // Sort: latest requests first and slice 5
      const sortedReqs = [...reqs].sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
      setRequestsList(sortedReqs.slice(0, 5));

      const openCount = reqs.filter(r => {
        const st = (r.status || '').toUpperCase();
        return st === 'OPEN' || st === 'PENDING' || st === 'IN PROGRESS' || st === 'IN_PROGRESS';
      }).length;

      let lastReadReqTime = 0;
      let isRequestsViewed = false;
      try {
        const storedLastRead = localStorage.getItem('kfpl_service_requests_last_read');
        lastReadReqTime = storedLastRead ? parseInt(storedLastRead, 10) : 0;
        isRequestsViewed = localStorage.getItem('kfpl_requests_viewed') === 'true';
      } catch (e) {}

      const newestReqTime = sortedReqs.length > 0 && sortedReqs[0].createdAt ? new Date(sortedReqs[0].createdAt).getTime() : 0;

      if (openCount > 0 && !isRequestsViewed && (lastReadReqTime === 0 || newestReqTime > lastReadReqTime)) {
        setHasUnreadRequests(true);
        setUnreadRequestsCount(openCount);
      } else {
        setHasUnreadRequests(false);
        setUnreadRequestsCount(0);
      }

      // FAQs are fetched directly from MongoDB via API

    } catch (e) {
      console.error('Error fetching header metrics', e);
    }
  };

  const markServiceRequestsAsRead = () => {
    const now = Date.now();
    try {
      localStorage.setItem('kfpl_service_requests_last_read', now.toString());
      localStorage.setItem('kfpl_requests_viewed', 'true');
    } catch (e) {
      console.error('Failed to save service request read state:', e);
    }
    setHasUnreadRequests(false);
    setUnreadRequestsCount(0);
    window.dispatchEvent(new Event('serviceRequestsUpdated'));
  };

  const clearAllNotifications = () => {
    try {
      const allIds = notifications.map(n => n.id);
      let clearedIds = [];
      try {
        const stored = localStorage.getItem('kfpl_cleared_notifications');
        clearedIds = stored ? JSON.parse(stored) : [];
      } catch (e) {}
      const updatedCleared = Array.from(new Set([...clearedIds, ...allIds]));
      localStorage.setItem('kfpl_cleared_notifications', JSON.stringify(updatedCleared));
      localStorage.setItem('kfpl_notifications_cleared', 'true');
    } catch (e) {
      console.error('Failed to clear notifications:', e);
    }
    setNotifications([]);
    setUnreadNotifications(0);
  };

  const markAllNotificationsAsRead = () => {
    const now = Date.now();
    try {
      localStorage.setItem('kfpl_notifications_last_read', now.toString());
      const allIds = notifications.map(n => n.id);
      let readIds = [];
      try {
        const stored = localStorage.getItem('kfpl_read_notifications');
        readIds = stored ? JSON.parse(stored) : [];
      } catch (e) {}
      const updatedRead = Array.from(new Set([...readIds, ...allIds]));
      localStorage.setItem('kfpl_read_notifications', JSON.stringify(updatedRead));
    } catch (e) {
      console.error('Failed to save read notification state:', e);
    }
    setUnreadNotifications(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markNotificationAsRead = (id) => {
    try {
      let readIds = [];
      try {
        const stored = localStorage.getItem('kfpl_read_notifications');
        readIds = stored ? JSON.parse(stored) : [];
      } catch (e) {}
      if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem('kfpl_read_notifications', JSON.stringify(readIds));
      }
    } catch (e) {
      console.error('Failed to save read state:', e);
    }
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, isRead: true } : n);
      const unreadCount = updated.filter(n => !n.isRead).length;
      setUnreadNotifications(unreadCount);
      return updated;
    });
  };

  useEffect(() => {
    fetchHeaderData();
    const interval = setInterval(() => {
      fetchHeaderData();
    }, 5000);

    window.addEventListener('serviceRequestsUpdated', fetchHeaderData);
    window.addEventListener('approvalsUpdated', fetchHeaderData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('serviceRequestsUpdated', fetchHeaderData);
      window.removeEventListener('approvalsUpdated', fetchHeaderData);
    };
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationDropdown(false);
      }
      if (requestRef.current && !requestRef.current.contains(event.target)) {
        setShowRequestDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Universal Search Handler (Multi-token + direct substring matching)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ pages: [], clients: [], agents: [], projects: [], articles: [], requests: [], faqs: [], transactions: [] });
      return;
    }

    const rawQuery = searchQuery.toLowerCase().trim();
    const queryTokens = rawQuery.split(/\s+/).filter(Boolean);

    // Helper: Returns true if query substring matches or ALL tokens match any text field
    const isMatch = (targetText, extraFields = []) => {
      const combined = [targetText, ...extraFields].filter(Boolean).join(' ').toLowerCase();
      if (combined.includes(rawQuery)) return true;
      return queryTokens.every(token => combined.includes(token));
    };

    // 1. Navigation Pages
    const matchedPages = navigationPages.filter(p =>
      isMatch(p.title, [p.desc, ...(p.keywords || [])])
    ).slice(0, 5);

    // 2. Clients
    const matchedClients = clientsList.filter(c => 
      isMatch(c.fullName || c.name || '', [c.email, c.phone, c.clientCode, String(c.totalInvestment || '')])
    ).slice(0, 5);

    // 3. Agents
    const matchedAgents = agentsList.filter(a => 
      isMatch(a.name || a.fullName || '', [a.email, a.phone, a.agentId, a.code, String(a.totalBusiness || '')])
    ).slice(0, 5);

    // 4. Projects & Segments
    const matchedProjects = (rawProjectsList || []).filter(p =>
      isMatch(p.name || '', [p.segment, p.description, String(p.minInvestment || ''), String(p.targetFunding || ''), p.status])
    ).slice(0, 5);

    // 5. News & Media Articles
    const matchedArticles = (rawArticlesList || []).filter(art =>
      isMatch(art.title || art.heading || '', [art.heading, art.title, art.category, art.summary, art.content, art.author, art.status])
    ).slice(0, 5);

    // 6. Service Requests
    const matchedRequests = (rawRequestsList || []).filter(r =>
      isMatch(r.requestId || '', [r.category, r.subject, r.type, r.clientName, r.clientCode, r.createdBy?.name, r.status])
    ).slice(0, 5);

    // 7. FAQs
    const matchedFaqs = (faqsList || []).filter(f => 
      isMatch(f.question || '', [f.answer, f.category, f.targetPortal])
    ).slice(0, 5);

    // 8. Transactions & Amounts
    const allTxs = [...rawDepositsList, ...rawWithdrawalsList];
    const matchedTxs = allTxs.filter(t =>
      isMatch(String(t.amount || ''), [t.investorName, t.clientName, t.clientCode, t.type, t.paymentMethod, t.referenceNumber, t.status])
    ).slice(0, 5);

    setSearchResults({
      pages: matchedPages,
      clients: matchedClients,
      agents: matchedAgents,
      projects: matchedProjects,
      articles: matchedArticles,
      requests: matchedRequests,
      faqs: matchedFaqs,
      transactions: matchedTxs
    });
  }, [searchQuery, clientsList, agentsList, rawProjectsList, rawArticlesList, rawRequestsList, faqsList, rawDepositsList, rawWithdrawalsList]);

  const handleLogout = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(getApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error('Failed to log out from server', err);
      }
    }
    clearAuthData();
    navigate('/login');
  };

  return (
    <header className={`kfpl-header ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <style>{`
        /* Header Dropdown Custom Styling */
        .kfpl-header-dropdown-card {
          position: absolute;
          top: 50px;
          right: 0;
          width: 380px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.15);
          border: 1px solid #e2e8f0;
          z-index: 1000;
          animation: slideDownIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .kfpl-header-dropdown-header {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .kfpl-header-dropdown-title {
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--color-navy);
        }

        .kfpl-header-dropdown-body {
          max-height: 320px;
          overflow-y: auto;
        }

        .kfpl-dropdown-list-item {
          padding: 12px 16px;
          display: flex;
          gap: 12px;
          align-items: center;
          cursor: pointer;
          transition: background 0.15s ease;
          border-bottom: 1px solid #f1f5f9;
        }

        .kfpl-dropdown-list-item:hover {
          background: #f8fafc;
        }

        .kfpl-dropdown-list-item:last-child {
          border-bottom: none;
        }

        @keyframes slideDownIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="kfpl-header-left">
        <button className="kfpl-header-hamburger" onClick={onMenuClick} aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div className="kfpl-header-title-wrap">
          <h1 className="kfpl-header-title">{config.title}</h1>
          {config.breadcrumb && (
            <div className="kfpl-header-breadcrumb">
              <span>Home</span> / {config.breadcrumb}
            </div>
          )}
        </div>
      </div>

      <div className="kfpl-header-right">
        {/* 1. Global Search (Universal Search) */}
        <div className="kfpl-dropdown-container" ref={searchRef} style={{ position: 'relative' }}>
          <button 
            className={`kfpl-header-icon-btn ${showSearchDropdown ? 'active' : ''}`} 
            onClick={() => {
              setShowSearchDropdown(!showSearchDropdown);
              setShowNotificationDropdown(false);
              setShowRequestDropdown(false);
              setShowProfileDropdown(false);
            }}
            aria-label="Search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {showSearchDropdown && (
            <div className="kfpl-header-dropdown-card" style={{ width: '420px' }}>
              <div className="kfpl-header-dropdown-header" style={{ padding: '10px 14px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#94a3b8' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search Pages, Clients, Agents, Projects, News, FAQs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="kfpl-input"
                    style={{ paddingLeft: '32px', height: '36px', fontSize: '0.85rem', width: '100%', borderRadius: '8px' }}
                    autoFocus
                  />
                </div>
              </div>
              <div className="kfpl-header-dropdown-body" style={{ maxHeight: '380px' }}>
                {!searchQuery.trim() ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.825rem' }}>
                    <p style={{ margin: 0, fontWeight: 600 }}>Universal Console Search</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>Search pages, clients, agents, projects, news articles, FAQs, or request IDs.</p>
                  </div>
                ) : (
                  <>
                    {/* Navigation Pages Section */}
                    {searchResults.pages && searchResults.pages.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#2563eb', letterSpacing: '0.5px' }}>Pages & Views ({searchResults.pages.length})</div>
                        {searchResults.pages.map((pg, idx) => (
                          <div 
                            key={'spg-' + idx} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate(pg.path); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>{pg.title}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>{pg.desc}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Clients Section */}
                    {searchResults.clients.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#0284c7', letterSpacing: '0.5px' }}>Clients ({searchResults.clients.length})</div>
                        {searchResults.clients.map(c => (
                          <div 
                            key={'sc-' + (c._id || c.id)} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate(`/investors/${c._id || c.id}`); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-emerald)' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>{c.fullName || c.name}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>{c.clientCode ? `${c.clientCode} • ` : ''}{c.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Agents Section */}
                    {searchResults.agents.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#d97706', letterSpacing: '0.5px' }}>Agents ({searchResults.agents.length})</div>
                        {searchResults.agents.map(a => (
                          <div 
                            key={'sa-' + (a._id || a.id)} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate(`/agents/${a._id || a.id}`); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-gold)' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>{a.name || a.fullName}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Code: {a.code || a.agentId} • {a.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Projects Section */}
                    {searchResults.projects && searchResults.projects.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.5px' }}>Projects & Funds ({searchResults.projects.length})</div>
                        {searchResults.projects.map(p => (
                          <div 
                            key={'sp-' + (p._id || p.id)} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate('/projects'); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>{p.name}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Segment: {p.segment || 'Film Fund'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* News & Media Section */}
                    {searchResults.articles && searchResults.articles.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#0284c7', letterSpacing: '0.5px' }}>News & Articles ({searchResults.articles.length})</div>
                        {searchResults.articles.map(art => (
                          <div 
                            key={'sart-' + (art._id || art.id)} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate('/news-media'); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284c7' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>{art.title || art.heading}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Category: {art.category || 'Press'}{art.summary ? ` • ${art.summary.substring(0, 45)}...` : ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Transactions & Amounts Section */}
                    {searchResults.transactions && searchResults.transactions.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#16a34a', letterSpacing: '0.5px' }}>Transactions & Amounts ({searchResults.transactions.length})</div>
                        {searchResults.transactions.map((tx, idx) => (
                          <div 
                            key={'stx-' + (tx._id || tx.id || idx)} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate('/approvals'); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>₹{tx.amount?.toLocaleString('en-IN') || tx.amount} • {(tx.type || 'Transaction').toUpperCase()}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Client: {tx.investorName || tx.clientName || tx.clientCode || 'Investor'} • Ref: {tx.referenceNumber || tx.paymentMethod || 'N/A'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Service Requests Section */}
                    {searchResults.requests && searchResults.requests.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#7c3aed', letterSpacing: '0.5px' }}>Service Requests ({searchResults.requests.length})</div>
                        {searchResults.requests.map(r => (
                          <div 
                            key={'srq-' + (r._id || r.id)} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate('/service-requests'); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>{r.category || r.subject || r.type || 'Request'}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>Client: {r.clientName || r.clientCode || 'User'} • Status: {r.status || 'OPEN'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* FAQs Section */}
                    {searchResults.faqs && searchResults.faqs.length > 0 && (
                      <div>
                        <div style={{ background: '#f8fafc', padding: '6px 14px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#a855f7', letterSpacing: '0.5px' }}>FAQs ({searchResults.faqs.length})</div>
                        {searchResults.faqs.map(f => (
                          <div 
                            key={'sf-' + (f.id || f._id)} 
                            className="kfpl-dropdown-list-item"
                            onClick={() => { navigate('/faq'); setShowSearchDropdown(false); }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }}></span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)' }}>{f.question}</span>
                              <span style={{ fontSize: '0.725rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{f.answer}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No matches */}
                    {(!searchResults.pages || searchResults.pages.length === 0) &&
                     (!searchResults.clients || searchResults.clients.length === 0) &&
                     (!searchResults.agents || searchResults.agents.length === 0) &&
                     (!searchResults.projects || searchResults.projects.length === 0) &&
                     (!searchResults.articles || searchResults.articles.length === 0) &&
                     (!searchResults.transactions || searchResults.transactions.length === 0) &&
                     (!searchResults.requests || searchResults.requests.length === 0) &&
                     (!searchResults.faqs || searchResults.faqs.length === 0) && (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.825rem' }}>
                        No matches found for "{searchQuery}"
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Notifications (Bell Icon - Client / Agent onboard info) */}
        <div className="kfpl-dropdown-container" ref={notificationRef} style={{ position: 'relative' }}>
          <button 
            className={`kfpl-header-icon-btn ${showNotificationDropdown ? 'active' : ''}`} 
            onClick={() => {
              const nextState = !showNotificationDropdown;
              setShowNotificationDropdown(nextState);
              setShowSearchDropdown(false);
              setShowRequestDropdown(false);
              setShowProfileDropdown(false);
            }}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadNotifications > 0 && (
              <span className="kfpl-header-notification-dot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 800, color: '#fff', background: '#e11d48', width: '15px', height: '15px', top: '-2px', right: '-2px', borderRadius: '50%', position: 'absolute' }}>
                {unreadNotifications}
              </span>
            )}
          </button>

          {showNotificationDropdown && (
            <div className="kfpl-header-dropdown-card">
              <div className="kfpl-header-dropdown-header">
                <span className="kfpl-header-dropdown-title">System & Platform Alerts</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {notifications.some(n => !n.isRead) && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); markAllNotificationsAsRead(); }}
                      style={{ background: 'none', border: 'none', color: '#10B981', fontSize: '0.725rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <>
                      {notifications.some(n => !n.isRead) && <span style={{ color: '#cbd5e1' }}>|</span>}
                      <button 
                        onClick={(e) => { e.stopPropagation(); clearAllNotifications(); }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.725rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        Clear all
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="kfpl-header-dropdown-body">
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.825rem' }}>
                    No recent notifications found.
                  </div>
                ) : (
                  notifications.map(n => {
                    const badgeBg = 
                      n.type === 'deposit' ? '#dcfce7' :
                      n.type === 'withdrawal' ? '#fee2e2' :
                      n.type === 'service' ? '#fef3c7' :
                      n.type === 'client' ? '#e0f2fe' :
                      n.type === 'agent' ? '#f3e8ff' :
                      n.type === 'project' ? '#ecfdf5' :
                      n.type === 'news' ? '#eff6ff' : '#fef2f2';
                    const badgeColor = 
                      n.type === 'deposit' ? '#166534' :
                      n.type === 'withdrawal' ? '#991b1b' :
                      n.type === 'service' ? '#b45309' :
                      n.type === 'client' ? '#0284c7' :
                      n.type === 'agent' ? '#6b21a8' :
                      n.type === 'project' ? '#047857' :
                      n.type === 'news' ? '#1d4ed8' : '#b91c1c';
                    const badgeLetter = 
                      n.type === 'deposit' ? '₹' :
                      n.type === 'withdrawal' ? 'W' :
                      n.type === 'service' ? 'S' :
                      n.type === 'client' ? 'C' :
                      n.type === 'agent' ? 'A' :
                      n.type === 'project' ? 'P' :
                      n.type === 'news' ? 'N' : 'K';

                    return (
                      <div 
                        key={n.id} 
                        className="kfpl-dropdown-list-item"
                        style={{
                          background: n.isRead ? 'transparent' : 'rgba(239, 68, 68, 0.04)',
                          position: 'relative'
                        }}
                        onClick={() => {
                          markNotificationAsRead(n.id);
                          navigate(n.link);
                          setShowNotificationDropdown(false);
                        }}
                      >
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: badgeBg,
                          color: badgeColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.875rem', fontWeight: 800, flexShrink: 0
                        }}>
                          {badgeLetter}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-navy)', fontWeight: 700 }}>
                              {n.title}
                            </span>
                            {!n.isRead && (
                              <span style={{ fontSize: '0.625rem', background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>New</span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>{n.name}</span>
                          <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '2px' }}>{n.email}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Messages / Service Requests (Chat Icon - Latest 5 Service Requests) */}
        <div className="kfpl-dropdown-container" ref={requestRef} style={{ position: 'relative' }}>
          <button 
            className={`kfpl-header-icon-btn ${showRequestDropdown ? 'active' : ''}`} 
            onClick={() => {
              const nextState = !showRequestDropdown;
              setShowRequestDropdown(nextState);
              setShowSearchDropdown(false);
              setShowNotificationDropdown(false);
              setShowProfileDropdown(false);
              if (nextState) {
                markServiceRequestsAsRead();
              }
            }}
            aria-label="Service Requests"
            title="Recent Service Requests"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {hasUnreadRequests && unreadRequestsCount > 0 && (
              <span className="kfpl-header-notification-dot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 800, color: '#fff', background: '#f59e0b', width: '16px', height: '16px', top: '-2px', right: '-2px', borderRadius: '50%', position: 'absolute' }}>
                {unreadRequestsCount}
              </span>
            )}
          </button>

          {showRequestDropdown && (
            <div className="kfpl-header-dropdown-card">
              <div className="kfpl-header-dropdown-header">
                <span className="kfpl-header-dropdown-title">Recent Service Requests</span>
                <span 
                  onClick={() => { markServiceRequestsAsRead(); navigate('/service-requests'); setShowRequestDropdown(false); }} 
                  style={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '0.725rem', color: 'var(--color-gold-dark)', fontWeight: 700 }}
                >
                  View All
                </span>
              </div>
              <div className="kfpl-header-dropdown-body">
                {requestsList.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.825rem' }}>
                    No service requests found.
                  </div>
                ) : (
                  requestsList.map(r => {
                    const st = (r.status || '').toUpperCase();
                    const labelColor = (st === 'OPEN' || st === 'PENDING') ? '#ef4444' : (st === 'IN PROGRESS' || st === 'IN_PROGRESS') ? '#f59e0b' : '#10b981';
                    const raiser = r.createdBy?.name || r.createdBy?.email || r.clientName || r.clientEmail || r.agentName || 'User';
                    return (
                      <div 
                        key={r.id || r._id} 
                        className="kfpl-dropdown-list-item"
                        onClick={() => { markServiceRequestsAsRead(); navigate('/service-requests'); setShowRequestDropdown(false); }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                              {r.subject || r.title || r.category || r.type || 'Service Query'}
                            </span>
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: labelColor + '20',
                              color: labelColor,
                              textTransform: 'uppercase'
                            }}>
                              {r.status || 'OPEN'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px' }}>
                            Raised by: {raiser}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="kfpl-header-divider"></div>

        {/* Admin Profile with Dropdown */}
        <div className="kfpl-dropdown-container" ref={profileRef} style={{ position: 'relative' }}>
          <div className="kfpl-header-profile" onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
            <div className="kfpl-header-avatar">{adminName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div className="kfpl-header-profile-info">
              <span className="kfpl-header-profile-name">{adminName}</span>
              <span className="kfpl-header-profile-role">{roleLabel}</span>
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              width="14"
              height="14"
              style={{
                color: 'var(--color-text-muted)',
                transform: showProfileDropdown ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {showProfileDropdown && (
            <div className="kfpl-header-profile-dropdown">
              <div className="kfpl-dropdown-profile-header">
                <span className="kfpl-dropdown-profile-name">{adminName}</span>
                <span className="kfpl-dropdown-profile-email">{adminEmail}</span>
              </div>
              <div className="kfpl-dropdown-divider"></div>
              <div className="kfpl-dropdown-item" onClick={() => { setShowProfileDropdown(false); navigate('/settings'); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Settings
              </div>
              <div className="kfpl-dropdown-item kfpl-dropdown-logout-btn" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
