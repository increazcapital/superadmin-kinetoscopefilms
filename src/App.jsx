/* ============================================================
   Component: App.jsx
   Description: Root app with all routes for Super Admin Portal.
                Sub-admins are restricted to only the routes
                matching their granted module permissions.
   ============================================================ */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './components/layout/MainLayout';

// ── Auth Pages ───────────────────────
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';

// ── Dashboard ───────────────────────
import Dashboard from './pages/dashboard/Dashboard';

// ── Investor Pages ───────────────────────
import InvestorList from './pages/investors/InvestorList';
import AddInvestor from './pages/investors/AddInvestor';
import EditInvestor from './pages/investors/EditInvestor';
import InvestorDetail from './pages/investors/InvestorDetail';

// ── Investment Pages ───────────────────────
import InvestmentList from './pages/investments/InvestmentList';
import AssignInvestment from './pages/investments/AssignInvestment';
import InvestmentStatus from './pages/investments/InvestmentStatus';

// ── ROI Pages ───────────────────────
import ROIList from './pages/roi/ROIList';
import ROIDetail from './pages/roi/ROIDetail';

// ── Portfolio Pages ───────────────────────
import PortfolioManagement from './pages/portfolio/PortfolioManagement';

// ── Agent Pages ───────────────────────
import AgentList from './pages/agents/AgentList';
import AddAgent from './pages/agents/AddAgent';
import EditAgent from './pages/agents/EditAgent';
import AgentDetail from './pages/agents/AgentDetail';
import AgentClientsView from './pages/agents/AgentClientsView';

// ── Approval Pages ───────────────────────
import ApprovalsQueue from './pages/approvals/ApprovalsQueue';
import ApprovalHistory from './pages/approvals/ApprovalHistory';

// ── Perks ───────────────────────
import PerkManagement from './pages/perks/PerkManagement';

// ── Email Notifications ───────────────────────
import EmailNotifications from './pages/email/EmailNotifications';

// ── Settings ───────────────────────
import Settings from './pages/settings/Settings';
import CommissionConfig from './pages/settings/CommissionConfig';
import RewardConfig from './pages/settings/RewardConfig';

// ── Portals ────────────────────────
import ClientPortalMock from './pages/portals/ClientPortalMock';
import AgentPortalMock from './pages/portals/AgentPortalMock';

// ── Service Requests ───────────────────────
import ServiceRequestsPage from './pages/service-requests/ServiceRequestsPage';

// ── News & Media ───────────────────────
import NewsMediaList from './pages/news-media/NewsMediaList';
import NewsMediaForm from './pages/news-media/NewsMediaForm';

// ── FAQ ───────────────────────
import FAQManagement from './pages/faq/FAQManagement';

// ── Sub Admin Management ───────────────────────
import SubAdminPage from './pages/sub-admins/SubAdminPage';

// ── 404 ───────────────────────
import NotFound from './pages/NotFound';

import { getAuthData } from './utils/authStorage';

// ── Protected Route Wrapper ───────────────────────
function ProtectedRoute({ children }) {
  const auth = getAuthData();
  if (!auth) return <Navigate to="/login" replace />;
  return children;
}

// ── Permission Route Wrapper ───────────────────────
// Checks if the logged-in user has the specified action permission for a module.
// Super admins always have access. Sub-admins need explicit permission.
// permissionKey = null means always accessible (e.g., Dashboard).
function PermissionRoute({ permissionKey, action = 'view', children }) {
  // No permission required — always accessible
  if (!permissionKey) return children;

  try {
    const parsed = getAuthData();
    if (!parsed) return <Navigate to="/login" replace />;
    const admin = parsed?.admin || parsed;
    const role = admin?.role || 'super-admin';

    // Super Admin → full access
    if (role === 'super-admin') return children;

    // Sub Admin → check permissions
    const permissions = admin?.permissions;
    const mod = permissions?.[permissionKey];
    if (mod) {
      if (action === 'view' && (mod.view || mod.create || mod.edit || mod.delete)) {
        return children;
      }
      if (action === 'create' && mod.create) {
        return children;
      }
      if (action === 'edit' && mod.edit) {
        return children;
      }
      if (action === 'delete' && mod.delete) {
        return children;
      }
    }

    // No permission → redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  } catch {
    return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected routes inside MainLayout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Manage Investors Profile — permissionKey: manageClients */}
            <Route path="investors" element={<PermissionRoute permissionKey="manageClients" action="view"><InvestorList /></PermissionRoute>} />
            <Route path="investors/add" element={<PermissionRoute permissionKey="manageClients" action="create"><AddInvestor /></PermissionRoute>} />
            <Route path="investors/:id" element={<PermissionRoute permissionKey="manageClients" action="view"><InvestorDetail /></PermissionRoute>} />
            <Route path="investors/:id/edit" element={<PermissionRoute permissionKey="manageClients" action="edit"><EditInvestor /></PermissionRoute>} />

            {/* Manage Investments — permissionKey: manageInvestments */}
            <Route path="investments" element={<PermissionRoute permissionKey="manageInvestments" action="view"><InvestmentList /></PermissionRoute>} />
            <Route path="investments/assign" element={<PermissionRoute permissionKey="manageInvestments" action="create"><AssignInvestment /></PermissionRoute>} />

            {/* Return on Investment — permissionKey: transactionDetails */}
            <Route path="roi" element={<PermissionRoute permissionKey="transactionDetails" action="view"><ROIList /></PermissionRoute>} />
            <Route path="roi/:id" element={<PermissionRoute permissionKey="transactionDetails" action="view"><ROIDetail /></PermissionRoute>} />

            {/* Status of Investment */}
            <Route path="investment-status" element={<PermissionRoute permissionKey="portfolio" action="view"><InvestmentStatus /></PermissionRoute>} />

            {/* Portfolio Management — permissionKey: portfolio */}
            <Route path="portfolio" element={<PermissionRoute permissionKey="portfolio" action="view"><PortfolioManagement /></PermissionRoute>} />

            {/* Manage Agents — permissionKey: manageAgents */}
            <Route path="agents" element={<PermissionRoute permissionKey="manageAgents" action="view"><AgentList /></PermissionRoute>} />
            <Route path="agents/add" element={<PermissionRoute permissionKey="manageAgents" action="create"><AddAgent /></PermissionRoute>} />
            <Route path="agents/:id" element={<PermissionRoute permissionKey="manageAgents" action="view"><AgentDetail /></PermissionRoute>} />
            <Route path="agents/:id/edit" element={<PermissionRoute permissionKey="manageAgents" action="edit"><EditAgent /></PermissionRoute>} />
            <Route path="agents/:id/clients" element={<PermissionRoute permissionKey="manageAgents" action="view"><AgentClientsView /></PermissionRoute>} />

            {/* Approval for Deposit & Withdrawal — permissionKey: depositWithdrawal */}
            <Route path="approvals" element={<PermissionRoute permissionKey="depositWithdrawal" action="view"><ApprovalsQueue /></PermissionRoute>} />
            <Route path="approvals/history" element={<PermissionRoute permissionKey="depositWithdrawal" action="view"><ApprovalHistory /></PermissionRoute>} />

            {/* Investors Perks & Recognition — permissionKey: perksRecognition */}
            <Route path="perks" element={<PermissionRoute permissionKey="perksRecognition" action="view"><PerkManagement /></PermissionRoute>} />

            {/* Email Notifications — permissionKey: emailNotifications */}
            <Route path="email-notifications" element={<PermissionRoute permissionKey="emailNotifications" action="view"><EmailNotifications /></PermissionRoute>} />

            {/* Service Requests — permissionKey: serviceRequests */}
            <Route path="service-requests" element={<PermissionRoute permissionKey="serviceRequests" action="view"><ServiceRequestsPage /></PermissionRoute>} />

            {/* News & Media — permissionKey: newsMedia */}
            <Route path="news-media" element={<PermissionRoute permissionKey="newsMedia" action="view"><NewsMediaList /></PermissionRoute>} />
            <Route path="news-media/add" element={<PermissionRoute permissionKey="newsMedia" action="create"><NewsMediaForm /></PermissionRoute>} />
            <Route path="news-media/:id/edit" element={<PermissionRoute permissionKey="newsMedia" action="edit"><NewsMediaForm /></PermissionRoute>} />

            {/* FAQ Management — permissionKey: faqManagement */}
            <Route path="faq" element={<PermissionRoute permissionKey="faqManagement" action="view"><FAQManagement /></PermissionRoute>} />

            {/* Sub Admin Management — permissionKey: subAdmins */}
            <Route path="sub-admins" element={<PermissionRoute permissionKey="subAdmins" action="view"><SubAdminPage /></PermissionRoute>} />

            {/* Settings — permissionKey: settings */}
            <Route path="settings" element={<PermissionRoute permissionKey="settings" action="view"><Settings /></PermissionRoute>} />
            <Route path="settings/commission-slabs" element={<PermissionRoute permissionKey="commissionSlabs" action="view"><CommissionConfig /></PermissionRoute>} />
            <Route path="settings/rewards" element={<PermissionRoute permissionKey="rewardsConfig" action="view"><RewardConfig /></PermissionRoute>} />

            {/* Portals — tied to client/agent permissions */}
            <Route path="portals/client" element={<PermissionRoute permissionKey="manageClients" action="view"><ClientPortalMock /></PermissionRoute>} />
            <Route path="portals/agent" element={<PermissionRoute permissionKey="manageAgents" action="view"><AgentPortalMock /></PermissionRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}

/* ============ END: App.jsx ============ */
