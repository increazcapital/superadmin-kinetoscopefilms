/* ============================================================
   Page: ROIList.jsx
   Description: Return on Investment & Commission Payout Management
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../utils/usePermissions';
import { apiRequest } from '../../config/apiHelper';

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

const getSlabRate = (slabs, typeNorm, amount) => {
  const typeSlabs = slabs.filter(s => s.type === typeNorm);
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

export default function ROIList() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recipientTypeFilter, setRecipientTypeFilter] = useState('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');

  // ROI / Commission records state
  const [clientROI, setClientROI] = useState([]);
  const [agentCommissions, setAgentCommissions] = useState([]);

  // Modal & Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFeedback, setUploadFeedback] = useState({ validCount: 0, invalidCount: 0, previewRecords: [] });

  // Custom Mark Paid Modal state
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [markPaidItem, setMarkPaidItem] = useState(null);
  const [markPaidForm, setMarkPaidForm] = useState({ paymentMode: 'Bank Transfer', transactionRefId: '' });

  // Live database dropdown lists
  const [dbClients, setDbClients] = useState([]);
  const [dbAgents, setDbAgents] = useState([]);
  const [slabs, setSlabs] = useState([]);

  useEffect(() => {
    const fetchSlabs = async () => {
      try {
        const res = await apiRequest('/api/super-admin/commission-slabs');
        const extractArray = (r) => {
          if (!r) return [];
          if (Array.isArray(r)) return r;
          if (r.data && Array.isArray(r.data)) return r.data;
          for (const key in r) {
            if (Array.isArray(r[key])) return r[key];
            if (r[key] && typeof r[key] === 'object') {
              const nested = extractArray(r[key]);
              if (nested && nested.length > 0) return nested;
            }
          }
          return [];
        };
        const raw = extractArray(res);
        setSlabs(raw.map(s => ({
          id: s._id || s.id,
          minAmount: s.minAmount || 0,
          maxAmount: (s.maxAmount === null || s.maxAmount === undefined || s.maxAmount === 999999999) ? 999999999 : s.maxAmount,
          commissionPercentage: s.commissionPercentage !== undefined ? s.commissionPercentage : (s.percentage || 0),
          percentage: s.commissionPercentage !== undefined ? s.commissionPercentage : (s.percentage || 0),
          type: s.type || 'monthly'
        })));
      } catch (err) {
        console.error('Failed to fetch slabs in ROIList:', err);
      }
    };
    fetchSlabs();
  }, []);

  // Record Payout Confirmation Modal
  const [showRecordPayoutConfirmModal, setShowRecordPayoutConfirmModal] = useState(false);

  // Delete Payout Confirmation Modal state
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = [];
      let currentCell = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      cells.push(currentCell.trim());

      const record = {};
      headers.forEach((header, index) => {
        let val = cells[index] || '';
        val = val.replace(/^["']|["']$/g, '').trim();
        record[header] = val;
      });
      records.push(record);
    }
    return records;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSV(text);

      const validated = parsed.map((rec, index) => {
        const errors = [];
        const type = (rec['recipient type'] || rec['type'] || '').toLowerCase().trim();
        const recipientId = (rec['recipient id'] || rec['id'] || '').toUpperCase().trim();
        const month = (rec['month'] || rec['period'] || '').trim();
        const amount = parseFloat(rec['amount'] || '0');
        const mode = rec['payment mode'] || rec['mode'] || 'Bank Transfer';
        const ref = rec['transaction ref'] || rec['ref'] || `TXN-BULK-${Date.now()}-${index}`;
        const status = (rec['status'] || 'paid').toLowerCase().trim();
        const paidAt = rec['paid at'] || rec['date'] || new Date().toISOString().split('T')[0];

        if (type !== 'client' && type !== 'agent') {
          errors.push("Invalid type. Use 'client' or 'agent'.");
        }

        let name = '';
        let idInternal = '';
        if (type === 'client') {
          const inv = dbClients.find(i => {
            const code = formatClientID(i.clientCode || i.clientId || (i.profile && i.profile.clientCode) || (i.user && i.user.clientCode) || '');
            return code.toUpperCase() === formatClientID(recipientId).toUpperCase();
          });
          if (!inv) {
            errors.push(`Client ID '${recipientId}' not found.`);
          } else {
            name = inv.fullName || (inv.profile && inv.profile.fullName) || (inv.user && inv.user.name) || inv.name || '';
            idInternal = inv.id || inv._id;
          }
        } else if (type === 'agent') {
          const agt = dbAgents.find(a => {
            const code = formatAgentID((a.user && a.user.clientCode) || (a.profile && a.profile.agentId) || a.agentId || '');
            return code.toUpperCase() === formatAgentID(recipientId).toUpperCase();
          });
          if (!agt) {
            errors.push(`Agent ID '${recipientId}' not found.`);
          } else {
            name = (agt.profile && agt.profile.fullName) || (agt.user && agt.user.name) || agt.name || '';
            idInternal = agt.id || agt._id;
          }
        }

        if (isNaN(amount) || amount <= 0) {
          errors.push("Amount must be positive.");
        }

        const isClientRefUsed = clientROI.some(r => r.transactionRef?.toUpperCase() === ref.toUpperCase());
        const isAgentRefUsed = agentCommissions.some(c => c.transactionRef?.toUpperCase() === ref.toUpperCase());
        if (isClientRefUsed || isAgentRefUsed) {
          errors.push(`Reference '${ref}' already exists.`);
        }

        return {
          id: Date.now() + index,
          type,
          recipientId,
          name,
          idInternal,
          month,
          amount,
          paymentMode: mode,
          transactionRef: ref,
          status: status === 'paid' ? 'paid' : 'pending',
          paidAt: status === 'paid' ? paidAt : null,
          isValid: errors.length === 0,
          errors
        };
      });

      const validCount = validated.filter(r => r.isValid).length;
      const invalidCount = validated.filter(r => !r.isValid).length;
      setUploadFeedback({
        validCount,
        invalidCount,
        previewRecords: validated
      });
    };
    reader.readAsText(file);
  };

  const handleConfirmUpload = async () => {
    if (!uploadFile) {
      addToast('No file selected.', 'error', 'Upload Failed');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      await apiRequest('/api/super-admin/roi/payouts/bulk', {
        method: 'POST',
        body: formData
      });

      addToast(`Successfully processed and uploaded bulk payouts CSV!`, 'success', 'Upload Successful');
      setShowUploadModal(false);
      setUploadFeedback({ validCount: 0, invalidCount: 0, previewRecords: [] });
      setUploadFile(null);
      fetchPayouts();
    } catch (err) {
      console.error('Failed to upload bulk payouts:', err);
      addToast(err.message || 'Bulk upload failed.', 'error', 'Upload Failed');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Recipient Name', 'Recipient ID', 'Recipient Type', 'Month / Period', 'Payout Detail', 'Amount (₹)', 'Payment Mode', 'Transaction Ref', 'Status', 'Paid At'];
    const rows = filteredRecords.map(r => [
      r.name,
      r.subText,
      r.recordType,
      r.month,
      r.payoutDetail,
      r.amount,
      r.paymentMode || '—',
      r.transactionRef || '—',
      r.status.toUpperCase(),
      r.paidAt || '—'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KFPL_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('Standard CSV exported successfully!', 'success', 'Export Success');
  };

  // Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [recipientType, setRecipientType] = useState('client'); // 'client' | 'agent'
  const [isAmountEditable, setIsAmountEditable] = useState(false);
  const [showPayoutWarningModal, setShowPayoutWarningModal] = useState(false);
  const [showPayoutConfirmModal, setShowPayoutConfirmModal] = useState(false);
  const [showClearAllConfirmModal, setShowClearAllConfirmModal] = useState(false);

  // Form fields
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [commissionType, setCommissionType] = useState('One-Time');
  const [relatedClientId, setRelatedClientId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [transactionRef, setTransactionRef] = useState('');
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchPayouts = async () => {
    try {
      const statusParam = filter === 'all' ? 'All' : filter;
      const recipientParam = recipientTypeFilter === 'all' ? 'All' : (recipientTypeFilter === 'client' ? 'Client Return (ROI)' : 'Agent Commission');
      const searchParam = encodeURIComponent(searchQuery);

      const res = await apiRequest(`/api/super-admin/roi/payouts?status=${statusParam}&recipientType=${recipientParam}&search=${searchParam}`);
      const data = res.data || res;

      let unified = [];
      if (Array.isArray(data)) {
        unified = data;
      } else if (data.payouts && Array.isArray(data.payouts)) {
        unified = data.payouts;
      } else if (data.list && Array.isArray(data.list)) {
        unified = data.list;
      }

      const clientsList = unified.filter(r => {
        const type = String(r.recipientType || r.recordType || r.type || '').toUpperCase();
        return type === 'CLIENT' || type === 'CLIENT RETURN (ROI)';
      });
      const agentsList = unified.filter(r => {
        const type = String(r.recipientType || r.recordType || r.type || '').toUpperCase();
        return type === 'AGENT' || type === 'AGENT COMMISSION';
      });

      setClientROI(clientsList.map(r => ({
        id: r.id || r._id,
        investorName: r.recipientName || r.investorName || r.name || '—',
        clientId: r.recipientCode || r.clientId || r.subText || r.recipientId || '—',
        investorId: r.recipientId || r.investorId || r.idInternal || '',
        roiPercentage: r.roiPercentage || 0,
        month: r.month || r.period || '—',
        amount: Number(r.amount || 0),
        status: (r.status || 'pending').toLowerCase(),
        paidAt: r.paidAt || r.date || null,
        paymentMode: r.paymentMode || null,
        transactionRef: r.transactionRef || r.transactionRefId || null
      })).filter(r => r.id !== '6a54a1b54381f4b86bbb54bf'));

      setAgentCommissions(agentsList.map(r => ({
        id: r.id || r._id,
        agentName: r.recipientName || r.agentName || r.name || '—',
        agentId: r.recipientCode || r.agentId || r.subText || r.recipientId || '—',
        idInternal: r.recipientId || r.idInternal || '',
        type: r.commissionType || r.type || 'monthly',
        month: r.month || r.period || '—',
        amount: Number(r.amount || 0),
        status: (r.status || 'pending').toLowerCase(),
        paidAt: r.paidAt || r.date || null,
        paymentMode: r.paymentMode || null,
        transactionRef: r.transactionRef || r.transactionRefId || null,
        remarks: r.remarks || ''
      })).filter(r => r.id !== '6a54a1b54381f4b86bbb54bf'));
    } catch (err) {
      console.error('Failed to fetch payouts:', err);
    }
  };

  const fetchDropdownData = async () => {
    try {
      console.log("Fetching dropdown clients and agents...");

      const clientRes = await apiRequest('/api/super-admin/clients');
      console.log("Raw Clients API Response:", clientRes);

      let parsedClients = [];
      if (Array.isArray(clientRes)) {
        parsedClients = clientRes;
      } else if (clientRes.data) {
        if (Array.isArray(clientRes.data)) {
          parsedClients = clientRes.data;
        } else if (clientRes.data.clients && Array.isArray(clientRes.data.clients)) {
          parsedClients = clientRes.data.clients;
        } else if (clientRes.data.data && Array.isArray(clientRes.data.data)) {
          parsedClients = clientRes.data.data;
        }
      } else if (clientRes.clients && Array.isArray(clientRes.clients)) {
        parsedClients = clientRes.clients;
      }

      console.log("Parsed Clients list:", parsedClients);
      setDbClients(parsedClients);

      const agentRes = await apiRequest('/api/super-admin/agents');
      console.log("Raw Agents API Response:", agentRes);

      let parsedAgents = [];
      if (Array.isArray(agentRes)) {
        parsedAgents = agentRes;
      } else if (agentRes.data) {
        if (Array.isArray(agentRes.data)) {
          parsedAgents = agentRes.data;
        } else if (agentRes.data.agents && Array.isArray(agentRes.data.agents)) {
          parsedAgents = agentRes.data.agents;
        } else if (agentRes.data.data && Array.isArray(agentRes.data.data)) {
          parsedAgents = agentRes.data.data;
        }
      } else if (agentRes.agents && Array.isArray(agentRes.agents)) {
        parsedAgents = agentRes.agents;
      }

      console.log("Parsed Agents list:", parsedAgents);
      setDbAgents(parsedAgents);

    } catch (err) {
      console.error("Failed to load drop-down clients/agents:", err);
    }
  };

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [filter, recipientTypeFilter, searchQuery]);

  // Auto-calculate agent commission when agent, type, or related client changes
  useEffect(() => {
    if (recipientType === 'agent' && !isAmountEditable) {
      if (!selectedAgentId || !relatedClientId) {
        setAmountPaid('');
        return;
      }
      const agent = dbAgents.find(a => {
        const id = a.user?._id || a.profile?.userId || a._id || a.id;
        return String(id) === String(selectedAgentId);
      });
      const client = dbClients.find(c => {
        const id = c.user?._id || c.profile?.userId || c._id || c.id;
        return String(id) === String(relatedClientId);
      });
      if (agent && client) {
        const totalInv = client.totalInvestment || (client.profile && client.profile.totalPortfolioValue) || 0;
        let pct = 0;
        const typeNormalized = String(commissionType).toLowerCase().trim();
        if (typeNormalized === 'one-time' || typeNormalized === 'onetime' || typeNormalized === 'one-time onboarding') {
          pct = getSlabRate(slabs, 'one-time', totalInv);
        } else if (typeNormalized === 'monthly' || typeNormalized === 'recurring' || typeNormalized === 'monthly recurring') {
          pct = getSlabRate(slabs, 'monthly', totalInv);
        } else if (typeNormalized === 'special' || typeNormalized === 'override' || typeNormalized === 'special override') {
          pct = agent.profile?.specialCommission || agent.commissionSpecial || 0;
        }
        const calculated = Math.round((totalInv * parseFloat(pct)) / 100);
        setAmountPaid(calculated || '');
      }
    }
  }, [selectedAgentId, commissionType, relatedClientId, recipientType, dbAgents, dbClients, isAmountEditable]);

  const handleRecipientTypeChange = (type) => {
    setRecipientType(type);
    setIsAmountEditable(false);
    setSelectedClientId('');
    setSelectedAgentId('');
    setCommissionType('Monthly');
    setRelatedClientId('');
    setAmountPaid('');
    setTransactionRef('');
  };

  const handleClientChange = (id) => {
    setSelectedClientId(id);
    setIsAmountEditable(false);
    const client = dbClients.find(c => {
      const cid = c.user?._id || c.profile?.userId || c._id || c.id;
      return String(cid) === String(id);
    });
    if (client) {
      const totalInv = client.totalInvestment || (client.profile && client.profile.totalPortfolioValue) || 0;
      const roiPct = client.monthlyRoi ?? (client.profile && client.profile.monthlyRoi) ?? client.roiPercentage ?? (client.profile && client.profile.roiPercentage) ?? 0;
      const monthlyReturn = Math.round((totalInv * roiPct) / 100);
      setAmountPaid(monthlyReturn);
    } else {
      setAmountPaid('');
    }
  };

  const handleAgentChange = (id) => {
    setSelectedAgentId(id);
    setAmountPaid('');
    setRelatedClientId('');
    setIsAmountEditable(false);
  };

  const handleMarkPaidClick = (roiId, type = 'client') => {
    setMarkPaidItem({ id: roiId, type });
    setMarkPaidForm({ paymentMode: 'Bank Transfer', transactionRefId: '' });
    setShowMarkPaidModal(true);
  };

  const confirmMarkPaid = async () => {
    if (!markPaidItem) return;
    if (!markPaidForm.transactionRefId.trim()) {
      alert("Transaction Reference ID is required!");
      return;
    }

    try {
      await apiRequest(`/api/super-admin/roi/payouts/${markPaidItem.id}/pay`, {
        method: 'PATCH',
        body: {
          paymentMode: markPaidForm.paymentMode,
          transactionRefId: markPaidForm.transactionRefId.trim()
        }
      });
      addToast(`${markPaidItem.type === 'client' ? 'ROI' : 'Commission'} payout marked as paid`, 'success', 'Paid Successfully');
      setShowMarkPaidModal(false);
      setMarkPaidItem(null);
      fetchPayouts();
    } catch (err) {
      console.error('Failed to transition status:', err);
      addToast(err.message || 'Failed to transition to paid', 'error', 'Error');
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteItemId(id);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeletePayout = async () => {
    if (!deleteItemId) return;
    try {
      await apiRequest(`/api/super-admin/roi/payouts/${deleteItemId}`, {
        method: 'DELETE'
      });
      addToast('Payout record deleted successfully.', 'success', 'Record Deleted');
      setShowDeleteConfirmModal(false);
      setDeleteItemId(null);
      fetchPayouts();
    } catch (err) {
      console.error('Failed to delete record:', err);
      addToast(err.message || 'Failed to delete payout record.', 'error', 'Error');
    }
  };

  const handleRecordPayoutClick = () => {
    if (recipientType === 'client' && !selectedClientId) {
      addToast('Please select a client.', 'error', 'Validation Error');
      return;
    }
    if (recipientType === 'agent' && !selectedAgentId) {
      addToast('Please select an agent.', 'error', 'Validation Error');
      return;
    }
    const amt = parseFloat(amountPaid);
    if (isNaN(amt) || amt <= 0) {
      addToast('Please enter a valid positive payout amount.', 'error', 'Validation Error');
      return;
    }
    if (!paymentMode) {
      addToast('Please select a payment mode.', 'error', 'Validation Error');
      return;
    }
    if (!transactionRef.trim()) {
      addToast('Please enter a transaction reference ID.', 'error', 'Validation Error');
      return;
    }

    // Open the confirmation custom modal instead of native confirm
    setShowRecordPayoutConfirmModal(true);
  };

  const confirmRecordPayout = async () => {
    const amt = parseFloat(amountPaid);

    const selectedClientObj = dbClients.find(c => {
      const id = c.user?._id || c.profile?.userId || c._id || c.id;
      return String(id) === String(selectedClientId);
    });

    const selectedAgentObj = dbAgents.find(a => {
      const id = a.user?._id || a.profile?.userId || a._id || a.id;
      return String(id) === String(selectedAgentId);
    });

    const relatedClientObj = dbClients.find(c => {
      const id = c.user?._id || c.profile?.userId || c._id || c.id;
      return String(id) === String(relatedClientId);
    });

    const payload = {
      recipientType: recipientType === 'client' ? 'Client Return (ROI)' : 'Agent Commission',
      recipientId: recipientType === 'client'
        ? (selectedClientObj?.profile?._id || selectedClientObj?._id || selectedClientId)
        : (selectedAgentObj?.profile?._id || selectedAgentObj?._id || selectedAgentId),
      recipientName: recipientType === 'client'
        ? (selectedClientObj?.profile?.fullName || selectedClientObj?.name || selectedClientObj?.fullName || 'Unknown Client')
        : (selectedAgentObj?.profile?.fullName || selectedAgentObj?.name || selectedAgentObj?.fullName || 'Unknown Agent'),
      recipientCode: recipientType === 'client'
        ? (selectedClientObj?.profile?.clientCode || selectedClientObj?.clientId || selectedClientObj?.clientCode || '')
        : (selectedAgentObj?.profile?.agentCode || selectedAgentObj?.agentId || selectedAgentObj?.profile?.agentId || selectedAgentObj?.code || ''),
      commissionType: recipientType === 'agent' ? commissionType : undefined,
      clientId: recipientType === 'client'
        ? (selectedClientObj?.profile?._id || selectedClientObj?._id || selectedClientId)
        : (recipientType === 'agent' && relatedClientId
          ? (relatedClientObj?.profile?._id || relatedClientObj?._id || relatedClientId)
          : undefined),
      roiPercentage: recipientType === 'client'
        ? (selectedClientObj?.monthlyRoi ?? selectedClientObj?.summaryCards?.monthlyRoi ?? selectedClientObj?.profile?.monthlyRoi ?? selectedClientObj?.profile?.roiPercentage ?? selectedClientObj?.roiPercentage ?? 0)
        : undefined,
      amount: amt,
      payoutDate: payoutDate,
      paymentMode,
      transactionRefId: transactionRef.trim()
    };

    try {
      await apiRequest('/api/super-admin/roi/payouts', {
        method: 'POST',
        body: payload
      });
      addToast('Payout recorded successfully!', 'success', 'Payout Recorded');
      setShowRecordPayoutConfirmModal(false);
      setShowPayoutModal(false);
      setSelectedClientId('');
      setSelectedAgentId('');
      setRelatedClientId('');
      setAmountPaid('');
      setTransactionRef('');
      fetchPayouts();
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to record payout', 'error', 'Error');
    }
  };

  const handleClearAllPayouts = async () => {
    try {
      await apiRequest('/api/super-admin/roi/payouts/clear', {
        method: 'DELETE'
      });
      addToast('All ROI payouts and agent commissions cleared successfully.', 'success', 'Data Cleared');
      setShowClearAllConfirmModal(false);
      fetchPayouts();
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Failed to clear data.', 'error', 'Error');
    }
  };

  // Combine lists for unified viewing
  const unifiedRecords = [
    ...clientROI.map(r => {
      const match = dbClients.find(c => {
        const userId = (c.user && typeof c.user === 'object' ? c.user._id : c.user) ||
          c.userId ||
          (c.profile?.userId) ||
          c._id || c.id;
        const profileId = c.profile?._id || c.profile?.id || c._id || c.id;
        const code = c.clientCode || c.profile?.clientCode || c.code || '';
        const recId = String(r.recipientId || r.clientId || r.recipientCode || r.investorId || '').toLowerCase();
        return String(userId) === String(r.investorId) ||
               String(profileId) === String(r.investorId) ||
               (code && recId.includes(String(code).toLowerCase())) ||
               (c.name && recId.includes(String(c.name).toLowerCase()));
      });
      const resolvedName = r.investorName && r.investorName !== 'Unknown' && r.investorName !== '—'
        ? r.investorName
        : (match?.fullName || match?.profile?.fullName || match?.user?.name || match?.name || 'Unknown');

      const resolvedCode = formatClientID(
        r.clientId && r.clientId !== '—' && !/^[0-9a-fA-F]{24}$/.test(r.clientId)
          ? r.clientId
          : (match?.clientCode || match?.profile?.clientCode || match?.clientId || r.investorId || '')
      );

      const resolvedRoi = (match && (match.monthlyRoi !== undefined || match.profile?.monthlyRoi !== undefined))
        ? (match.monthlyRoi ?? match.profile?.monthlyRoi ?? match.summaryCards?.monthlyRoi ?? 0)
        : (r.roiPercentage || 0);

      let displayDetail = (r.type && String(r.type).startsWith('ROI') && String(r.type).includes('%'))
        ? r.type
        : `ROI (${resolvedRoi}%)`;

      return {
        ...r,
        recordType: 'Client',
        name: resolvedName,
        subText: resolvedCode,
        payoutDetail: displayDetail
      };
    }),
    ...agentCommissions.map(c => {
      const match = dbAgents.find(a => {
        const userId = (a.user && typeof a.user === 'object' ? a.user._id : a.user) ||
          a.userId ||
          (a.profile?.userId) ||
          a._id || a.id;
        const profileId = a.profile?._id || a.profile?.id || a._id || a.id;
        return String(userId) === String(c.idInternal) || String(profileId) === String(c.idInternal);
      });
      const resolvedName = c.agentName && c.agentName !== 'Unknown' && c.agentName !== '—'
        ? c.agentName
        : (match?.fullName || match?.profile?.fullName || match?.user?.name || match?.name || 'Unknown');

      const resolvedCode = formatAgentID(
        c.agentId && c.agentId !== '—' && !/^[0-9a-fA-F]{24}$/.test(c.agentId)
          ? c.agentId
          : (match?.agentId || match?.profile?.agentId || match?.user?.clientCode || c.idInternal || '')
      );

      return {
        ...c,
        recordType: 'Agent',
        name: resolvedName,
        subText: resolvedCode,
        payoutDetail: `Comm (${c.type})`
      };
    })
  ].sort((a, b) => String(b.id || '').localeCompare(String(a.id || '')));

  const uniquePaymentModes = Array.from(new Set(unifiedRecords.map(r => r.paymentMode).filter(Boolean)));

  const filteredRecords = unifiedRecords.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (recipientTypeFilter !== 'all' && r.recordType.toLowerCase() !== recipientTypeFilter.toLowerCase()) return false;
    if (paymentModeFilter !== 'all' && r.paymentMode !== paymentModeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = [
        r.name, r.subText, r.month, r.payoutDetail,
        r.paymentMode, r.transactionRef
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="kfpl-page animate-fade-slide-up">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Complete Transaction Details</h2>
          <p className="kfpl-page-subtitle">Track and record ROI returns and agent commission payouts</p>
        </div>
        <div className="kfpl-page-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={handleExportCSV}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', marginRight: '6px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          {canCreate('transactionDetails') && (
            <>
              <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => setShowUploadModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', marginRight: '6px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Bulk CSV Upload
              </button>
              <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => setShowPayoutModal(true)}>
                + Record Payout
              </button>
            </>
          )}
          {canDelete('transactionDetails') && (
            <button className="kfpl-btn kfpl-btn--danger kfpl-btn--sm" onClick={() => setShowClearAllConfirmModal(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', marginRight: '6px' }}>
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Clear All Records
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="kfpl-filter-chips" style={{ marginBottom: '20px' }}>
        {['all', 'paid', 'pending'].map(f => (
          <span
            key={f}
            className={`kfpl-filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && ` (${unifiedRecords.filter(r => r.status === f).length})`}
          </span>
        ))}
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px', flex: 1, minWidth: '240px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: 'var(--color-text-muted)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="kfpl-input"
            placeholder="Search by name, ID, month, reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <select
          value={recipientTypeFilter}
          onChange={e => setRecipientTypeFilter(e.target.value)}
          className="kfpl-select"
          style={{ width: '160px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <option value="all">All Recipients</option>
          <option value="client">Client</option>
          <option value="agent">Agent</option>
        </select>

        <select
          value={paymentModeFilter}
          onChange={e => setPaymentModeFilter(e.target.value)}
          className="kfpl-select"
          style={{ width: '180px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)' }}
        >
          <option value="all">All Payment Modes</option>
          {uniquePaymentModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="kfpl-table-container">
        <div className="kfpl-table-scroll">
          <table className="kfpl-table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Type</th>
                <th>Month / Period</th>
                <th>Payout Detail</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Payment Mode / Ref</th>
                <th>Status</th>
                <th>Paid At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>No records found</td></tr>
              ) : filteredRecords.map(rec => (
                <tr key={`${rec.recordType}-${rec.id}`}>
                  <td>
                    <div className="kfpl-table-cell-primary">{rec.name}</div>
                    <div className="kfpl-table-cell-secondary">{rec.subText}</div>
                  </td>
                  <td>
                    <Badge status={rec.recordType === 'Client' ? 'silver' : 'gold'}>
                      {rec.recordType}
                    </Badge>
                  </td>
                  <td>{rec.month}</td>
                  <td>{rec.payoutDetail}</td>
                  <td className="font-semibold" style={{ textAlign: 'right' }}>{formatCurrency(rec.amount)}</td>
                  <td>
                    {rec.paymentMode ? (
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{rec.paymentMode}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{rec.transactionRef || '—'}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td><Badge status={rec.status}>{rec.status}</Badge></td>
                  <td>{rec.paidAt || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', alignItems: 'center' }}>
                      <button
                        className="kfpl-btn kfpl-btn--danger kfpl-btn--sm"
                        style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--color-danger)' }}
                        onClick={() => handleDeleteClick(rec.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '12px', height: '12px' }}>
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payout Modal */}
      <Modal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        title="Record Payout Details"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowPayoutModal(false)}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleRecordPayoutClick}>Submit Payout</button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '16px' }}>

          {/* Recipient Type */}
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Recipient Type <span className="required">*</span></label>
            <select
              className="kfpl-select"
              value={recipientType}
              onChange={(e) => handleRecipientTypeChange(e.target.value)}
            >
              <option value="client">Client Return (ROI)</option>
              <option value="agent">Agent Commission</option>
            </select>
          </div>

          {/* Conditional Fields: CLIENT */}
          {recipientType === 'client' && (
            <>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Select Client <span className="required">*</span></label>
                <select
                  className="kfpl-select"
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                >
                  <option value="">Choose client</option>
                  {dbClients.filter(i => {
                    const status = i.status || (i.header && i.header.status) || (i.profile && i.profile.status) || 'active';
                    return status.toLowerCase() === 'active';
                  }).map(inv => {
                    const name = inv.fullName || (inv.profile && inv.profile.fullName) || (inv.user && inv.user.name) || inv.name || 'Unknown Client';
                    const code = formatClientID(inv.clientCode || inv.clientId || (inv.profile && inv.profile.clientCode) || (inv.user && inv.user.clientCode) || '');
                    const id = inv.user?._id || inv.profile?.userId || inv._id || inv.id;
                    return (
                      <option key={id} value={id}>
                        {name} {code ? `(${code})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedClientId && (
                (() => {
                  const client = dbClients.find(c => {
                    const id = c.user?._id || c.profile?.userId || c._id || c.id;
                    return String(id) === String(selectedClientId);
                  });
                  if (!client) return null;
                  const totalInv = client.totalInvestment || (client.summaryCards && client.summaryCards.totalInvestment) || (client.profile && client.profile.totalPortfolioValue) || 0;
                  const roiPct = client.monthlyRoi ?? (client.profile && client.profile.monthlyRoi) ?? client.roiPercentage ?? (client.profile && client.profile.roiPercentage) ?? 0;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--color-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Investment Amount</span>
                        <strong style={{ fontSize: '0.875rem' }}>{formatCurrency(totalInv)}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Allocated ROI %</span>
                        <strong style={{ fontSize: '0.875rem' }}>{roiPct}%</strong>
                      </div>
                    </div>
                  );
                })()
              )}
            </>
          )}

          {/* Conditional Fields: AGENT */}
          {recipientType === 'agent' && (
            <>
              <div className="kfpl-input-group">
                <label className="kfpl-input-label">Select Agent <span className="required">*</span></label>
                <select
                  className="kfpl-select"
                  value={selectedAgentId}
                  onChange={(e) => handleAgentChange(e.target.value)}
                >
                  <option value="">Choose agent</option>
                  {dbAgents.filter(a => {
                    const status = (a.profile && a.profile.status) || (a.user && (a.user.isActive ? 'active' : 'inactive')) || a.status || 'active';
                    return status.toLowerCase() === 'active';
                  }).map(agt => {
                    const name = (agt.profile && agt.profile.fullName) || (agt.user && agt.user.name) || agt.name || 'Unknown Agent';
                    const code = formatAgentID((agt.user && agt.user.clientCode) || (agt.profile && agt.profile.agentId) || agt.agentId || '');
                    const id = agt.user?._id || agt.profile?.userId || agt._id || agt.id;
                    return (
                      <option key={id} value={id}>
                        {name} {code ? `(${code})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedAgentId && (() => {
                const selectedAgentClients = dbClients.filter(c => {
                  const assignedId = c.user?.assignedAgent?._id || c.user?.assignedAgent || c.assignedAgent?._id || c.assignedAgent;
                  return assignedId && String(assignedId) === String(selectedAgentId);
                });
                return (
                  <div className="kfpl-form-row" style={selectedAgentClients.length === 0 ? { gridTemplateColumns: '1fr' } : {}}>
                    <div className="kfpl-input-group">
                      <label className="kfpl-input-label">Commission Type <span className="required">*</span></label>
                      <select
                        className="kfpl-select"
                        value={commissionType}
                        onChange={(e) => setCommissionType(e.target.value)}
                      >
                        <option value="One-Time">One-Time Slab</option>
                        <option value="Monthly">Monthly Slab</option>
                        <option value="Special">Special Incentive</option>
                      </select>
                    </div>
                    {selectedAgentClients.length > 0 && (
                      <div className="kfpl-input-group">
                        <label className="kfpl-input-label">Related Client <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Optional)</span></label>
                        <select
                          className="kfpl-select"
                          value={relatedClientId}
                          onChange={(e) => setRelatedClientId(e.target.value)}
                        >
                          <option value="">Choose client</option>
                          {selectedAgentClients.map(inv => {
                            const name = inv.fullName || (inv.profile && inv.profile.fullName) || (inv.user && inv.user.name) || inv.name || 'Unknown Client';
                            const id = inv.user?._id || inv.profile?.userId || inv._id || inv.id;
                            const code = formatClientID(inv.clientCode || inv.clientId || (inv.profile && inv.profile.clientCode) || (inv.user && inv.user.clientCode) || '');
                            return (
                              <option key={id} value={id}>{name} {code ? `(${code})` : ''}</option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* Common Payment Fields */}
          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Amount Paid (₹) <span className="required">*</span></label>
              <input
                type="number"
                className="kfpl-input"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="Enter payout amount"
                required
                readOnly={!isAmountEditable}
                style={!isAmountEditable ? { backgroundColor: 'var(--color-surface-hover)', cursor: 'not-allowed' } : {}}
              />
              {(recipientType === 'client' || recipientType === 'agent') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    id="override-amount"
                    checked={isAmountEditable}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setShowPayoutWarningModal(true);
                      } else {
                        setIsAmountEditable(false);
                        if (recipientType === 'client') {
                          const client = dbClients.find(c => {
                            const id = c.user?._id || c.profile?.userId || c._id || c.id;
                            return String(id) === String(selectedClientId);
                          });
                          if (client) {
                            const totalInv = client.totalInvestment || (client.profile && client.profile.totalPortfolioValue) || 0;
                            const roiPct = client.monthlyRoi ?? (client.profile && client.profile.monthlyRoi) ?? client.roiPercentage ?? (client.profile && client.profile.roiPercentage) ?? 0;
                            const monthlyReturn = Math.round((totalInv * roiPct) / 100);
                            setAmountPaid(monthlyReturn);
                          }
                        } else if (recipientType === 'agent') {
                          if (selectedAgentId && relatedClientId) {
                            const agent = dbAgents.find(a => {
                              const id = a.user?._id || a.profile?.userId || a._id || a.id;
                              return String(id) === String(selectedAgentId);
                            });
                            const client = dbClients.find(c => {
                              const id = c.user?._id || c.profile?.userId || c._id || c.id;
                              return String(id) === String(relatedClientId);
                            });
                            if (agent && client) {
                              const totalInv = client.totalInvestment || (client.profile && client.profile.totalPortfolioValue) || 0;
                              let pct = 0;
                              const typeNormalized = String(commissionType).toLowerCase().trim();
                              if (typeNormalized === 'one-time' || typeNormalized === 'onetime' || typeNormalized === 'one-time onboarding') {
                                pct = getSlabRate(slabs, 'one-time', totalInv);
                              } else if (typeNormalized === 'monthly' || typeNormalized === 'recurring' || typeNormalized === 'monthly recurring') {
                                pct = getSlabRate(slabs, 'monthly', totalInv);
                              } else if (typeNormalized === 'special' || typeNormalized === 'override' || typeNormalized === 'special override') {
                                pct = agent.profile?.specialCommission || agent.commissionSpecial || 0;
                              }
                              const calculated = Math.round((totalInv * parseFloat(pct)) / 100);
                              setAmountPaid(calculated || '');
                            }
                          } else {
                            setAmountPaid('');
                          }
                        }
                      }
                    }}
                  />
                  <label htmlFor="override-amount" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                    Edit Payout Amount Manually
                  </label>
                </div>
              )}
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Payout Date <span className="required">*</span></label>
              <input
                type="date"
                className="kfpl-input"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Payment Mode <span className="required">*</span></label>
              <select
                className="kfpl-select"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                required
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Transaction Reference ID <span className="required">*</span></label>
              <input
                type="text"
                className="kfpl-input"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. TXN10293847"
                required
              />
            </div>
          </div>

        </div>
      </Modal>

      {/* Bulk CSV Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFeedback({ validCount: 0, invalidCount: 0, previewRecords: [] });
        }}
        title="Bulk Payout Import (CSV)"
        footer={
          <>
            <button
              className="kfpl-btn kfpl-btn--ghost"
              onClick={() => {
                setShowUploadModal(false);
                setUploadFeedback({ validCount: 0, invalidCount: 0, previewRecords: [] });
              }}
            >
              Cancel
            </button>
            <button
              className="kfpl-btn kfpl-btn--primary"
              onClick={handleConfirmUpload}
              disabled={uploadFeedback.validCount === 0}
            >
              Process Payouts ({uploadFeedback.validCount})
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ backgroundColor: 'rgba(15, 118, 110, 0.05)', border: '1px solid rgba(15, 118, 110, 0.2)', padding: '12px 16px', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0F766E', marginBottom: '6px' }}>CSV File Template Format</h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
              Your file must contain a header row. Use the exact columns or aliases below:
            </p>
            <div style={{ backgroundColor: 'var(--color-surface, #FFFFFF)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '8px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text)', marginTop: '8px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
              Recipient Type,Recipient ID,Month,Amount,Payment Mode,Transaction Ref,Status,Paid At<br />
              client,C-1002,Jun 2026,18000,UPI,TXN-JUN-01,paid,2026-06-25<br />
              agent,A-2001,Jun 2026,4500,Bank Transfer,TXN-JUN-02,paid,2026-06-25
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              • Recipient Type: <strong>client</strong> or <strong>agent</strong><br />
              • Recipient ID: Match client/agent ID (e.g. C-1002 or A-2001)<br />
              • Status: <strong>paid</strong> or <strong>pending</strong>
            </div>
          </div>

          <div style={{ border: '2px dashed var(--color-border)', borderRadius: '12px', padding: '30px 20px', textAlign: 'center', backgroundColor: 'var(--color-surface)', cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative' }}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '40px', height: '40px', margin: '0 auto 12px', opacity: 0.8 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Click to upload or drag & drop CSV file</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Accepts only standard .csv files</span>
          </div>

          {uploadFeedback.previewRecords.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Parsing Preview</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ backgroundColor: '#D1FAE5', color: '#065F46', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                    {uploadFeedback.validCount} Valid
                  </span>
                  {uploadFeedback.invalidCount > 0 && (
                    <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      {uploadFeedback.invalidCount} Invalid
                    </span>
                  )}
                </div>
              </div>

              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px 8px', backgroundColor: 'var(--color-background-subtle, #F8FAFC)' }}>
                {uploadFeedback.previewRecords.map((record, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '8px 0',
                      borderBottom: idx === uploadFeedback.previewRecords.length - 1 ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                        Row #{idx + 1}: {record.type ? record.type.toUpperCase() : 'Unknown type'} ({record.recipientId || 'No ID'})
                      </span>
                      <span style={{ fontWeight: 600, color: record.isValid ? '#0F766E' : '#EF4444' }}>
                        {record.isValid ? 'Valid' : 'Invalid'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Period: {record.month || '—'} | Amount: ₹{(record.amount || 0).toLocaleString('en-IN')} | Ref: {record.transactionRef || '—'}
                    </div>
                    {!record.isValid && (
                      <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '2px', fontWeight: 500 }}>
                        • {record.errors.join(' • ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Payout Manual Override Warning Modal */}
      <Modal
        isOpen={showPayoutWarningModal}
        onClose={() => setShowPayoutWarningModal(false)}
        title="Override Payout Warning"
        footer={
          <>
            <button
              className="kfpl-btn kfpl-btn--ghost"
              onClick={() => setShowPayoutWarningModal(false)}
            >
              Cancel
            </button>
            <button
              className="kfpl-btn kfpl-btn--danger"
              onClick={() => {
                setShowPayoutWarningModal(false);
                setShowPayoutConfirmModal(true);
              }}
              style={{ backgroundColor: '#EF4444', color: '#FFFFFF', borderColor: 'transparent' }}
            >
              Override Payout
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#EF4444', lineHeight: '1.4', fontWeight: 500 }}>
              WARNING: You are choosing to edit the calculated ROI payout amount manually.
              This breaks the automated payout checks and should only be used for special adjustment scenarios.
            </p>
          </div>
        </div>
      </Modal>

      {/* Payout Manual Override Confirmation Modal */}
      <Modal
        isOpen={showPayoutConfirmModal}
        onClose={() => setShowPayoutConfirmModal(false)}
        title="Confirm Manual Override"
        footer={
          <>
            <button
              className="kfpl-btn kfpl-btn--ghost"
              onClick={() => setShowPayoutConfirmModal(false)}
            >
              Cancel
            </button>
            <button
              className="kfpl-btn kfpl-btn--primary"
              onClick={() => {
                setIsAmountEditable(true);
                setShowPayoutConfirmModal(false);
              }}
            >
              Unlock Field
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: '1.4' }}>
            Are you absolutely sure you want to unlock the Amount field for manual entry?
            Please double-check the final numbers before submitting.
          </p>
        </div>
      </Modal>



      {/* Confirm Record Payout Modal */}
      <Modal
        isOpen={showRecordPayoutConfirmModal}
        onClose={() => setShowRecordPayoutConfirmModal(false)}
        title="Confirm Payout Transaction"
        footer={
          <>
            <button
              className="kfpl-btn kfpl-btn--ghost"
              onClick={() => setShowRecordPayoutConfirmModal(false)}
            >
              Cancel
            </button>
            <button
              className="kfpl-btn kfpl-btn--primary"
              onClick={confirmRecordPayout}
            >
              Confirm & Record Payout
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Warning Banner */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'start', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#EF4444' }}>Transaction Warning</h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                You are about to record a manual payout. Please verify the transaction details below. **Recorded payouts cannot be undone.**
              </p>
            </div>
          </div>

          {/* Details Summary Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-surface)', padding: '16px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient Type</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  {recipientType === 'client' ? 'Client (ROI Payout)' : 'Agent (Commission)'}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name & ID</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  {recipientType === 'client'
                    ? (() => {
                      const client = dbClients.find(c => {
                        const id = c.user?._id || c.profile?.userId || c._id || c.id;
                        return String(id) === String(selectedClientId);
                      });
                      const name = client ? (client.fullName || client.profile?.fullName || client.user?.name || client.name) : '';
                      const code = client ? (client.clientCode || client.clientId || client.profile?.clientCode || client.user?.clientCode) : '';
                      return client ? `${name} (${code})` : selectedClientId;
                    })()
                    : (() => {
                      const agent = dbAgents.find(a => {
                        const id = a.user?._id || a.profile?.userId || a._id || a.id;
                        return String(id) === String(selectedAgentId);
                      });
                      const name = agent ? (agent.profile?.fullName || agent.user?.name || agent.name) : '';
                      const code = agent ? (agent.user?.clientCode || agent.profile?.agentId || agent.agentId) : '';
                      return agent ? `${name} (${code})` : selectedAgentId;
                    })()
                  }
                </strong>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payout Amount</span>
                <strong style={{ fontSize: '1rem', color: '#0F766E' }}>{formatCurrency(parseFloat(amountPaid || 0))}</strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payout Date</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{payoutDate}</strong>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Mode</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{paymentMode}</strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference ID</span>
                <strong style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{transactionRef}</strong>
              </div>
            </div>

          </div>
        </div>
      </Modal>

      {/* Confirm Clear All Records Modal */}
      <Modal
        isOpen={showClearAllConfirmModal}
        onClose={() => setShowClearAllConfirmModal(false)}
        title="Confirm Data Deletion"
        footer={
          <>
            <button
              className="kfpl-btn kfpl-btn--ghost"
              onClick={() => setShowClearAllConfirmModal(false)}
            >
              Cancel
            </button>
            <button
              className="kfpl-btn kfpl-btn--danger"
              onClick={handleClearAllPayouts}
            >
              Yes, Clear All Data
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                You are about to delete **all Return on Investment (ROI) payouts and Agent commissions** from the system. This action is irreversible and cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Payout Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setDeleteItemId(null);
        }}
        title="Confirm Record Deletion"
        footer={
          <>
            <button
              className="kfpl-btn kfpl-btn--ghost"
              onClick={() => {
                setShowDeleteConfirmModal(false);
                setDeleteItemId(null);
              }}
            >
              Cancel
            </button>
            <button
              className="kfpl-btn kfpl-btn--danger"
              onClick={confirmDeletePayout}
            >
              Yes, Delete Record
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'start', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#EF4444' }}>Delete Payout Record</h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                Are you sure you want to delete this payout record? This action will permanently remove the record from the database and cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============ END: ROIList.jsx ============ */
