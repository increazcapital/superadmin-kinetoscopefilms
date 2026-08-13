/* ============================================================
   Page: CommissionConfig.jsx
   Description: Configuration dashboard for commission slabs and overrides
   ============================================================ */

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import Modal from '../../components/ui/Modal';
import { apiRequest } from '../../config/apiHelper';



export default function CommissionConfig() {
  const addToast = useToast();
  
  // Tabs: 'one-time' | 'monthly' | 'overrides'
  const [activeTab, setActiveTab] = useState('one-time');

  // State
  const [oneTimeSlabs, setOneTimeSlabs] = useState([]);
  const [monthlySlabs, setMonthlySlabs] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [calcAmount, setCalcAmount] = useState('');
  const [calcResult, setCalcResult] = useState(null);
  const [agentsList, setAgentsList] = useState([]);

  // Modal State
  const [showSlabModal, setShowSlabModal] = useState(false);
  const [slabModalType, setSlabModalType] = useState('add'); // 'add' | 'edit'
  const [slabForm, setSlabForm] = useState({ id: '', minAmount: '', maxAmount: '', percentage: '' });

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideModalType, setOverrideModalType] = useState('add'); // 'add' | 'edit'
  const [overrideForm, setOverrideForm] = useState({ id: '', agentId: '', incentiveName: '', targetAmount: '', completeWithin: '', cashReward: '', giftOption: '' });

  const extractArray = (res) => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.data && Array.isArray(res.data)) return res.data;
    for (const key in res) {
      if (Array.isArray(res[key])) {
        return res[key];
      }
      if (res[key] && typeof res[key] === 'object') {
        const nested = extractArray(res[key]);
        if (nested && nested.length > 0) return nested;
      }
    }
    return [];
  };

  const loadConfigData = async () => {
    // 1. Load Slabs
    try {
      const res = await apiRequest('/api/super-admin/commission-slabs');
      console.log('Commission Slabs API Response:', res);
      const rawSlabs = extractArray(res);
      
      const mapSlab = s => ({
        id: s._id || s.id,
        minAmount: s.minAmount || 0,
        maxAmount: (s.maxAmount === null || s.maxAmount === undefined || s.maxAmount === 999999999) ? 999999999 : s.maxAmount,
        percentage: s.commissionPercentage !== undefined ? s.commissionPercentage : (s.percentage || 0),
        type: s.type || 'monthly'
      });
      
      const parsedSlabs = rawSlabs.map(mapSlab);
      const ot = parsedSlabs.filter(s => s.type === 'one-time');
      const m = parsedSlabs.filter(s => s.type === 'monthly');
      
      setOneTimeSlabs(ot.sort((a, b) => a.minAmount - b.minAmount));
      setMonthlySlabs(m.sort((a, b) => a.minAmount - b.minAmount));
    } catch (err) {
      console.error('Failed to load slabs from backend:', err);
      setOneTimeSlabs([]);
      setMonthlySlabs([]);
    }

    // 2. Load Overrides
    try {
      const res = await apiRequest('/api/super-admin/commission-slabs/overrides');
      console.log('Overrides API Response:', res);
      const rawOverrides = extractArray(res);
      const mapped = rawOverrides.map(o => {
        let incentiveName = 'Legacy Override';
        let targetAmount = '—';
        let completeWithin = '—';
        let cashReward = '—';
        let giftOption = '—';
        let isIncentive = false;

        if (o.reason && o.reason.startsWith('{')) {
          try {
            const parsed = JSON.parse(o.reason);
            if (parsed.isIncentive) {
              incentiveName = parsed.name || '—';
              targetAmount = parsed.targetAmount || 0;
              completeWithin = parsed.completeWithin || '—';
              cashReward = parsed.cashReward || 0;
              giftOption = parsed.giftOption || '—';
              isIncentive = true;
            }
          } catch (e) {}
        }

        if (!isIncentive) {
          incentiveName = o.reason || 'Special Override';
          cashReward = `${o.commissionOverride !== undefined ? o.commissionOverride : (o.percentage || 0)}% Override`;
        }

        return {
          id: o._id || o.id,
          agentId: o.agentId?._id || o.agentId?.id || o.agentId || '',
          agentCode: o.agentId?.agentId || o.agentCode || '',
          agentName: o.agentId?.name || o.agentId?.fullName || o.agentName || 'Agent',
          percentage: o.commissionOverride !== undefined ? o.commissionOverride : (o.percentage || 0),
          reason: o.reason || '',
          incentiveName,
          targetAmount,
          completeWithin,
          cashReward,
          giftOption,
          isIncentive
        };
      });
      setOverrides(mapped);
    } catch (err) {
      console.error('Failed to load overrides from backend:', err);
      setOverrides([]);
    }
  };

  // Load from backend/localStorage on mount
  useEffect(() => {
    loadConfigData();

    const fetchAgents = async () => {
      try {
        const res = await apiRequest('/api/super-admin/agents');
        console.log('Agents List API Response:', res);
        const extractAgents = (r) => {
          if (!r) return [];
          if (Array.isArray(r)) return r;
          if (r.data) {
            if (Array.isArray(r.data)) return r.data;
            if (r.data.agents && Array.isArray(r.data.agents)) return r.data.agents;
          }
          if (r.agents && Array.isArray(r.agents)) return r.agents;
          return [];
        };
        const list = extractAgents(res);
        setAgentsList(list);
      } catch (err) {
        console.error('Failed to load agents in config:', err);
      }
    };
    fetchAgents();
  }, []);

  // Debounced API calculator hook
  useEffect(() => {
    const amount = parseFloat(calcAmount);
    if (isNaN(amount) || amount <= 0) {
      setCalcResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest('/api/super-admin/commission-slabs/calculate', {
          method: 'POST',
          body: JSON.stringify({
            amount,
            type: activeTab === 'one-time' ? 'one-time' : 'monthly'
          })
        });
        const matchedData = res.data || res;
        if (matchedData) {
          setCalcResult({
            slab: {
              minAmount: matchedData.slab?.minAmount !== undefined ? matchedData.slab.minAmount : (matchedData.minAmount || 0),
              maxAmount: matchedData.slab?.maxAmount !== undefined ? matchedData.slab.maxAmount : (matchedData.maxAmount || 999999999),
              percentage: matchedData.slab?.commissionPercentage !== undefined ? matchedData.slab.commissionPercentage : (matchedData.commissionPercentage || matchedData.percentage || 0)
            },
            amount: matchedData.amount !== undefined ? matchedData.amount : (matchedData.commissionAmount || 0)
          });
        }
      } catch (err) {
        console.error('Failed to calculate commission via API:', err);
        // Fallback to local calculation
        const local = getCalculatedCommission(activeTab === 'one-time' ? oneTimeSlabs : monthlySlabs, calcAmount);
        setCalcResult(local);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [calcAmount, activeTab, oneTimeSlabs, monthlySlabs]);

  // Helper to check overlap
  const hasOverlap = (slabs, min, max, excludeId) => {
    return slabs.some(slab => {
      if (slab.id === excludeId) return false;
      // Overlap logic: min1 <= max2 AND min2 <= max1
      return min <= slab.maxAmount && slab.minAmount <= max;
    });
  };

  // Slab handlers
  const handleOpenAddSlab = () => {
    setSlabModalType('add');
    setSlabForm({ id: '', minAmount: '', maxAmount: '', percentage: '' });
    setShowSlabModal(true);
  };

  const handleOpenEditSlab = (slab) => {
    setSlabModalType('edit');
    setSlabForm({
      id: slab.id,
      minAmount: slab.minAmount,
      maxAmount: slab.maxAmount === 999999999 ? '' : slab.maxAmount,
      percentage: slab.percentage
    });
    setShowSlabModal(true);
  };

  const handleDeleteSlab = async (id) => {
    if (window.confirm('Are you sure you want to delete this slab?')) {
      try {
        await apiRequest(`/api/super-admin/commission-slabs/${id}`, {
          method: 'DELETE'
        });
        addToast('Slab deleted successfully', 'success', 'Slab Removed');
        await loadConfigData();
      } catch (err) {
        console.error('Failed to delete slab:', err);
        alert(err.message || 'Failed to delete slab.');
      }
    }
  };

  const handleSaveSlab = async () => {
    const min = parseFloat(slabForm.minAmount);
    let max = parseFloat(slabForm.maxAmount);
    const pct = parseFloat(slabForm.percentage);

    if (isNaN(min) || min < 0) {
      alert('Please enter a valid Minimum Amount.');
      return;
    }
    if (slabForm.maxAmount === '' || isNaN(max)) {
      max = 999999999;
    }
    if (max <= min) {
      alert('Maximum Amount must be greater than Minimum Amount.');
      return;
    }
    if (isNaN(pct) || pct < 0 || pct > 100) {
      alert('Percentage must be between 0% and 100%.');
      return;
    }

    try {
      const type = activeTab === 'one-time' ? 'one-time' : 'monthly';
      const slabPayload = {
        type,
        minAmount: min,
        maxAmount: max === 999999999 ? null : max,
        commissionPercentage: pct
      };

      if (slabModalType === 'add') {
        await apiRequest('/api/super-admin/commission-slabs', {
          method: 'POST',
          body: JSON.stringify(slabPayload)
        });
        addToast('New slab added successfully', 'success', 'Slab Created');
      } else {
        await apiRequest(`/api/super-admin/commission-slabs/${slabForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            minAmount: min,
            maxAmount: max === 999999999 ? null : max,
            commissionPercentage: pct
          })
        });
        addToast('Slab updated successfully', 'success', 'Slab Updated');
      }
      await loadConfigData();
      setShowSlabModal(false);
    } catch (err) {
      console.error('Failed to save slab:', err);
      alert(err.message || 'Failed to save slab.');
    }
  };

  // Override handlers
  const handleOpenAddOverride = () => {
    setOverrideModalType('add');
    setOverrideForm({ id: '', agentId: '', incentiveName: '', targetAmount: '', completeWithin: '', cashReward: '', giftOption: '' });
    setShowOverrideModal(true);
  };

  const handleOpenEditOverride = (ov) => {
    setOverrideModalType('edit');
    let parsed = { name: '', targetAmount: '', completeWithin: '', cashReward: '', giftOption: '' };
    if (ov.reason && ov.reason.startsWith('{')) {
      try {
        parsed = JSON.parse(ov.reason);
      } catch (e) {}
    }
    setOverrideForm({
      id: ov.id,
      agentId: ov.agentId,
      incentiveName: parsed.name || ov.incentiveName || '',
      targetAmount: parsed.targetAmount || ov.targetAmount || '',
      completeWithin: parsed.completeWithin || ov.completeWithin || '',
      cashReward: parsed.cashReward || ov.cashReward || '',
      giftOption: parsed.giftOption || ov.giftOption || ''
    });
    setShowOverrideModal(true);
  };

  const handleDeleteOverride = async (id) => {
    if (window.confirm('Are you sure you want to delete this special incentive?')) {
      try {
        await apiRequest(`/api/super-admin/commission-slabs/overrides/${id}`, {
          method: 'DELETE'
        });
        addToast('Special incentive removed successfully', 'success', 'Incentive Deleted');
        await loadConfigData();
      } catch (err) {
        console.error('Failed to delete override:', err);
        alert(err.message || 'Failed to delete override.');
      }
    }
  };

  const handleSaveOverride = async () => {
    if (!overrideForm.agentId) {
      alert('Please select an agent.');
      return;
    }
    if (!overrideForm.incentiveName || !overrideForm.incentiveName.trim()) {
      alert('Incentive Name is required.');
      return;
    }
    const targetAmt = parseFloat(overrideForm.targetAmount);
    if (isNaN(targetAmt) || targetAmt <= 0) {
      alert('Please enter a valid target amount.');
      return;
    }
    const cashRew = parseFloat(overrideForm.cashReward);
    if (isNaN(cashRew) && (!overrideForm.giftOption || !overrideForm.giftOption.trim())) {
      alert('Please specify either a Cash Reward or a Gift Option.');
      return;
    }

    try {
      const serializedReason = JSON.stringify({
        isIncentive: true,
        name: overrideForm.incentiveName,
        targetAmount: targetAmt,
        completeWithin: overrideForm.completeWithin || 'No Limit',
        cashReward: isNaN(cashRew) ? 0 : cashRew,
        giftOption: overrideForm.giftOption || 'None'
      });

      const payload = {
        agentId: overrideForm.agentId,
        commissionOverride: 0,
        reason: serializedReason
      };

      if (overrideModalType === 'add') {
        await apiRequest('/api/super-admin/commission-slabs/overrides', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        addToast('Special incentive added successfully', 'success', 'Incentive Created');
      } else {
        if (overrideForm.id) {
          try {
            await apiRequest(`/api/super-admin/commission-slabs/overrides/${overrideForm.id}`, {
              method: 'DELETE'
            });
          } catch (e) {
            console.warn('Old override delete failed:', e);
          }
        }
        await apiRequest('/api/super-admin/commission-slabs/overrides', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        addToast('Special incentive updated successfully', 'success', 'Incentive Updated');
      }
      await loadConfigData();
      setShowOverrideModal(false);
    } catch (err) {
      console.error('Failed to save override:', err);
      alert(err.message || 'Failed to save incentive.');
    }
  };

  const formatCurrencyLocal = (val) => {
    if (val === 999999999) return 'Unlimited / No Limit';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const getCalculatedCommission = (slabs, amountStr) => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount < 0) return null;
    
    const matched = slabs.find(slab => {
      if (slab.maxAmount === 999999999) {
        return amount >= slab.minAmount;
      }
      return amount >= slab.minAmount && amount < slab.maxAmount;
    });
    
    if (!matched) return null;
    
    const commission = (amount * matched.percentage) / 100;
    return {
      slab: matched,
      amount: commission
    };
  };

  const renderCalculator = () => {
    const slabs = activeTab === 'one-time' ? oneTimeSlabs : monthlySlabs;
    const calcResult = getCalculatedCommission(slabs, calcAmount);
    
    return (
      <div style={{
        marginTop: '24px',
        paddingTop: '20px',
        borderTop: '1px dashed var(--color-border)',
      }}>
        <h4 style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--color-navy)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18" style={{ color: 'var(--color-gold-dark)' }}>
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="12" y1="9" x2="12" y2="17"/>
          </svg>
          Commission Amount Calculator
        </h4>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          alignItems: 'start'
        }}>
          <div className="kfpl-input-group" style={{ marginBottom: 0 }}>
            <label className="kfpl-input-label">Enter Investment Amount (₹)</label>
            <input
              type="number"
              className="kfpl-input"
              value={calcAmount}
              onChange={(e) => setCalcAmount(e.target.value)}
              placeholder="e.g. 15,00,000"
              style={{ width: '100%' }}
            />
          </div>
          
          {calcResult ? (
            <div style={{
              background: 'rgba(201, 168, 76, 0.05)',
              border: '1px solid rgba(201, 168, 76, 0.2)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Matched Slab ({formatCurrencyLocal(calcResult.slab.minAmount)} - {formatCurrencyLocal(calcResult.slab.maxAmount)})
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  Commission Rate: <strong style={{ color: 'var(--color-success)' }}>{calcResult.slab.percentage}%</strong>
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success)' }}>
                  {formatCurrencyLocal(calcResult.amount)}
                </span>
              </div>
            </div>
          ) : calcAmount ? (
            <div style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: 'var(--color-text-muted)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              height: '100%'
            }}>
              No matching slab found for this amount.
            </div>
          ) : (
            <div style={{
              background: 'var(--color-surface-hover)',
              border: '1px dashed var(--color-border)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: 'var(--color-text-muted)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              height: '100%'
            }}>
              Enter an investment amount above to auto-calculate commission.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="kfpl-page animate-fade-slide-up">
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Commission Slab Configuration</h2>
          <p className="kfpl-page-subtitle">Configure investment-linked commission slabs and manual agent overrides</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="kfpl-tabs" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '24px', paddingBottom: '2px', overflowX: 'auto', maxWidth: '100%' }}>
        <button
          className={`kfpl-btn ${activeTab === 'one-time' ? 'kfpl-btn--primary' : 'kfpl-btn--ghost'}`}
          onClick={() => setActiveTab('one-time')}
          style={{ borderRadius: '8px 8px 0 0', padding: '10px 20px', flexShrink: 0, borderBottom: activeTab === 'one-time' ? 'none' : '' }}
        >
          One-Time slabs
        </button>
        <button
          className={`kfpl-btn ${activeTab === 'monthly' ? 'kfpl-btn--primary' : 'kfpl-btn--ghost'}`}
          onClick={() => setActiveTab('monthly')}
          style={{ borderRadius: '8px 8px 0 0', padding: '10px 20px', flexShrink: 0, borderBottom: activeTab === 'monthly' ? 'none' : '' }}
        >
          Monthly slabs
        </button>
        <button
          className={`kfpl-btn ${activeTab === 'overrides' ? 'kfpl-btn--primary' : 'kfpl-btn--ghost'}`}
          onClick={() => setActiveTab('overrides')}
          style={{ borderRadius: '8px 8px 0 0', padding: '10px 20px', flexShrink: 0, borderBottom: activeTab === 'overrides' ? 'none' : '' }}
        >
          Special Overrides
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'one-time' && (
        <div className="kfpl-card animate-fade-slide-up">
          <div className="kfpl-card-header-responsive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-navy)', margin: 0 }}>One-Time Commission Slab Mapping</h3>
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={handleOpenAddSlab}>
              + Add One-Time Slab
            </button>
          </div>

          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>Min Amount</th>
                  <th>Max Amount</th>
                  <th style={{ textAlign: 'right' }}>Commission Rate (%)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {oneTimeSlabs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '30px' }}>No One-Time slabs configured.</td>
                  </tr>
                ) : (
                  oneTimeSlabs.map(slab => (
                    <tr key={slab.id}>
                      <td>{formatCurrencyLocal(slab.minAmount)}</td>
                      <td>{formatCurrencyLocal(slab.maxAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{slab.percentage}%</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ padding: '4px 8px' }} onClick={() => handleOpenEditSlab(slab)}>
                            Edit
                          </button>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ padding: '4px 8px', color: 'var(--color-danger)' }} onClick={() => handleDeleteSlab(slab.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {renderCalculator()}
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="kfpl-card animate-fade-slide-up">
          <div className="kfpl-card-header-responsive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-navy)', margin: 0 }}>Monthly Recurring Commission Slab Mapping</h3>
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={handleOpenAddSlab}>
              + Add Monthly Slab
            </button>
          </div>

          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>Min Amount</th>
                  <th>Max Amount</th>
                  <th style={{ textAlign: 'right' }}>Commission Rate (%)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthlySlabs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '30px' }}>No Monthly slabs configured.</td>
                  </tr>
                ) : (
                  monthlySlabs.map(slab => (
                    <tr key={slab.id}>
                      <td>{formatCurrencyLocal(slab.minAmount)}</td>
                      <td>{formatCurrencyLocal(slab.maxAmount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{slab.percentage}%</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ padding: '4px 8px' }} onClick={() => handleOpenEditSlab(slab)}>
                            Edit
                          </button>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ padding: '4px 8px', color: 'var(--color-danger)' }} onClick={() => handleDeleteSlab(slab.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {renderCalculator()}
        </div>
      )}

      {activeTab === 'overrides' && (
        <div className="kfpl-card animate-fade-slide-up">
          <div className="kfpl-card-header-responsive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-navy)', margin: 0 }}>Special Manual Commission Incentives</h3>
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={handleOpenAddOverride}>
              + Add Special Incentive
            </button>
          </div>

          <div className="kfpl-table-scroll">
            <table className="kfpl-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Incentive Name</th>
                  <th>Target Amount</th>
                  <th>Complete Within (days/month)</th>
                  <th>Cash Reward</th>
                  <th>Gift Option</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overrides.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '30px' }}>No special incentives configured.</td>
                  </tr>
                ) : (
                  overrides.map(ov => (
                    <tr key={ov.id}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{ov.agentName}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{ov.agentCode || ov.agentId}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{ov.incentiveName}</td>
                      <td>{ov.isIncentive && typeof ov.targetAmount === 'number' ? formatCurrencyLocal(ov.targetAmount) : ov.targetAmount}</td>
                      <td>{ov.completeWithin}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                        {ov.isIncentive && typeof ov.cashReward === 'number' ? (ov.cashReward > 0 ? formatCurrencyLocal(ov.cashReward) : '—') : ov.cashReward}
                      </td>
                      <td>{ov.giftOption}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ padding: '4px 8px' }} onClick={() => handleOpenEditOverride(ov)}>
                            Edit
                          </button>
                          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" style={{ padding: '4px 8px', color: 'var(--color-danger)' }} onClick={() => handleDeleteOverride(ov.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slab Form Modal */}
      <Modal
        isOpen={showSlabModal}
        onClose={() => setShowSlabModal(false)}
        title={slabModalType === 'add' ? `Add ${activeTab === 'one-time' ? 'One-Time' : 'Monthly'} Slab` : `Edit Slab`}
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowSlabModal(false)}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleSaveSlab}>Save Slab</button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '16px' }}>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Minimum Investment (₹) <span className="required">*</span></label>
            <input
              type="number"
              className="kfpl-input"
              value={slabForm.minAmount}
              onChange={(e) => setSlabForm(prev => ({ ...prev, minAmount: e.target.value }))}
              placeholder="e.g. 0"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Maximum Investment (₹) <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Leave empty for Unlimited)</span></label>
            <input
              type="number"
              className="kfpl-input"
              value={slabForm.maxAmount}
              onChange={(e) => setSlabForm(prev => ({ ...prev, maxAmount: e.target.value }))}
              placeholder="e.g. 1000000"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Commission Percentage (%) <span className="required">*</span></label>
            <input
              type="number"
              step="0.01"
              className="kfpl-input"
              value={slabForm.percentage}
              onChange={(e) => setSlabForm(prev => ({ ...prev, percentage: e.target.value }))}
              placeholder="e.g. 1.25"
            />
          </div>
        </div>
      </Modal>

      {/* Override Form Modal */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title={overrideModalType === 'add' ? 'Add Special Agent Incentive' : 'Edit Special Agent Incentive'}
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowOverrideModal(false)}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleSaveOverride}>Save Incentive</button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '16px' }}>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Select Agent <span className="required">*</span></label>
            <select
              className="kfpl-select"
              value={overrideForm.agentId}
              onChange={(e) => setOverrideForm(prev => ({ ...prev, agentId: e.target.value }))}
              disabled={overrideModalType === 'edit'}
            >
              <option value="">Choose Agent</option>
              {agentsList.map(a => (
                <option key={a.id || a._id} value={a._id || a.id || a.agentId}>{a.name || a.fullName} ({a.agentId})</option>
              ))}
            </select>
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Incentive Name <span className="required">*</span></label>
            <input
              type="text"
              className="kfpl-input"
              value={overrideForm.incentiveName || ''}
              onChange={(e) => setOverrideForm(prev => ({ ...prev, incentiveName: e.target.value }))}
              placeholder="e.g. Premium Target Reward"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Target Amount (₹) <span className="required">*</span></label>
            <input
              type="number"
              className="kfpl-input"
              value={overrideForm.targetAmount || ''}
              onChange={(e) => setOverrideForm(prev => ({ ...prev, targetAmount: e.target.value }))}
              placeholder="e.g. 5000000"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Complete Within (days/month) <span className="required">*</span></label>
            <input
              type="text"
              className="kfpl-input"
              value={overrideForm.completeWithin || ''}
              onChange={(e) => setOverrideForm(prev => ({ ...prev, completeWithin: e.target.value }))}
              placeholder="e.g. 30 days or 2 months"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Cash Reward (₹) <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Optional if Gift is set)</span></label>
            <input
              type="number"
              className="kfpl-input"
              value={overrideForm.cashReward || ''}
              onChange={(e) => setOverrideForm(prev => ({ ...prev, cashReward: e.target.value }))}
              placeholder="e.g. 50000"
            />
          </div>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Gift Option <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Optional if Cash is set)</span></label>
            <input
              type="text"
              className="kfpl-input"
              value={overrideForm.giftOption || ''}
              onChange={(e) => setOverrideForm(prev => ({ ...prev, giftOption: e.target.value }))}
              placeholder="e.g. iPhone 15 Pro Max"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============ END: CommissionConfig.jsx ============ */
