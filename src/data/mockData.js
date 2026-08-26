/* ============================================================
   Data: mockData.js (super-admin)
   Description: Cleaned configuration constants & formatters re-exports
   ============================================================ */

export { formatCurrency, formatNumber, getCategoryFromAmount } from '../utils/formatters';

export const INVESTMENT_SEGMENTS = [
  { id: 'film-making', name: 'Film Making', color: '#F5A800' },
  { id: 'distribution', name: 'Distribution', color: '#1565C0' },
  { id: 'music', name: 'Music', color: '#2E7D32' },
  { id: 'trading', name: 'Trading & Syndication', color: '#E65100' },
  { id: 'content-ip', name: 'Content IP Bank', color: '#7B1FA2' },
  { id: 'exhibition', name: 'Film Exhibition', color: '#00838F' },
];

export const RECOGNITION_TIERS = [
  { id: 'silver', name: 'Silver', minAmount: 0, color: '#C0C0C0' },
  { id: 'gold', name: 'Gold', minAmount: 2500000, color: '#F5A800' },
  { id: 'diamond', name: 'Diamond', minAmount: 10000000, color: '#80DEEA' },
  { id: 'platinum', name: 'Platinum', minAmount: 30000000, color: '#B8C5D1' },
];

export const COMMISSION_SLABS = [
  { id: 'slab-1', label: 'Slab 1', percentage: 0.5 },
  { id: 'slab-2', label: 'Slab 2', percentage: 0.75 },
  { id: 'slab-3', label: 'Slab 3', percentage: 1.0 },
];

export const NEWS_CATEGORIES = ['Company News', 'Project Updates', 'Industry News', 'Press Release'];

export const dashboardStats = {
  totalInvestors: 0,
  investorChange: 0,
  totalInvestment: 0,
  investmentChange: 0,
  totalROIPaid: 0,
  roiChange: 0,
  totalAgents: 0,
  agentChange: 0,
  pendingApprovals: 0,
  activeInvestments: 0,
};

export const monthlyROIData = [];
export const segmentDistribution = [];
export const recentActivity = [];
export const topInvestors = [];
export const topAgents = [];
export const agentContributionData = [];
export const investmentStatusData = [];
export const candlestickData = [];
export const monthlyInvestmentData = [];
export const investors = [];
export const agents = [];
export const approvals = { deposits: [], withdrawals: [] };
export const approvalHistory = [];
export const perks = [];
export const mockNewsMedia = [];
