/* ============================================================
   Page: SubAdminPage.jsx
   Description: Sub Admin management — list, create, edit, delete
                with granular module permission matrix
   ============================================================ */

import { useState, useEffect, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../../config/apiHelper';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../utils/usePermissions';

// ── KFPL Module Definitions ───────────────────────
const MODULE_GROUPS = [
  {
    group: 'People & Accounts',
    modules: [
      { key: 'manageClients', label: 'Manage Clients' },
      { key: 'manageAgents',  label: 'Manage Agents' },
    ],
  },
  {
    group: 'Portals',
    modules: [
      { key: 'clientPortal', label: 'Client Portal View' },
      { key: 'agentPortal',  label: 'Agent Portal View' },
    ],
  },
  {
    group: 'Investment Management',
    modules: [
      { key: 'manageInvestments',  label: 'Manage Investments' },
      { key: 'transactionDetails', label: 'Transaction Details (ROI)' },
      { key: 'investmentStatus',   label: 'Investment Status' },
      { key: 'portfolio',          label: 'Portfolio' },
    ],
  },
  {
    group: 'Finance & Rewards',
    modules: [
      { key: 'depositWithdrawal', label: 'Deposit & Withdrawal' },
      { key: 'perksRecognition',  label: 'Perks & Recognition' },
      { key: 'commissionSlabs',   label: 'Commission Slabs' },
      { key: 'rewardsConfig',     label: 'Rewards Config' },
    ],
  },
  {
    group: 'Operations',
    modules: [
      { key: 'emailNotifications', label: 'Email Notifications' },
      { key: 'serviceRequests',    label: 'Service Requests' },
      { key: 'newsMedia',          label: 'News & Media' },
      { key: 'faqManagement',      label: 'FAQ Management' },
      { key: 'subAdmins',         label: 'Sub Admins' },
      { key: 'settings',          label: 'Settings' },
    ],
  },
];

const ALL_MODULE_KEYS = MODULE_GROUPS.flatMap(g => g.modules.map(m => m.key));
const PERM_COLS = ['view', 'create', 'edit', 'delete'];

const emptyPermissions = () =>
  Object.fromEntries(ALL_MODULE_KEYS.map(k => [k, { view: false, create: false, edit: false, delete: false }]));

const normalizePermissions = (rawPerms) => {
  const base = emptyPermissions();
  if (!rawPerms || typeof rawPerms !== 'object') return base;
  
  const merged = { ...base };
  Object.keys(rawPerms).forEach(k => {
    const mod = rawPerms[k] || {};
    const view = !!mod.view || !!mod.create || !!mod.edit || !!mod.delete;
    merged[k] = {
      view,
      create: !!mod.create,
      edit: !!mod.edit,
      delete: !!mod.delete
    };
  });
  return merged;
};

// ── Permission Matrix ───────────────────────
function PermissionMatrix({ permissions, onChange, moduleSearch }) {
  const toggle = (modKey, col) => {
    const current = permissions[modKey] || { view: false, create: false, edit: false, delete: false };
    const newVal = !current[col];
    const updated = { ...current, [col]: newVal };

    // Auto-check View when Create, Edit, or Delete is turned ON
    if (newVal && (col === 'create' || col === 'edit' || col === 'delete')) {
      updated.view = true;
    }

    // Auto-uncheck Create, Edit, and Delete when View is turned OFF
    if (!newVal && col === 'view') {
      updated.create = false;
      updated.edit = false;
      updated.delete = false;
    }

    onChange({ ...permissions, [modKey]: updated });
  };
  const toggleAll = (modKey) => {
    const allOn = PERM_COLS.every(c => permissions[modKey]?.[c]);
    const newVal = !allOn;
    onChange({
      ...permissions,
      [modKey]: { view: newVal, create: newVal, edit: newVal, delete: newVal }
    });
  };

  const filteredGroups = MODULE_GROUPS.map(g => ({
    ...g,
    modules: g.modules.filter(m => !moduleSearch || m.label.toLowerCase().includes(moduleSearch.toLowerCase())),
  })).filter(g => g.modules.length > 0);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid var(--color-border)` }}>
            <th style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', width: '40%' }}>MODULE</th>
            {PERM_COLS.map(c => (
              <th key={c} style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {c.toUpperCase()}
              </th>
            ))}
            <th style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--color-gold-dark)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>ALL</th>
          </tr>
        </thead>
        <tbody>
          {filteredGroups.map(g => (
            <Fragment key={g.group}>
              <tr>
                <td colSpan={6} style={{
                  padding: '10px 14px 6px',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  borderTop: '1px solid var(--color-border-light)',
                }}>
                  {g.group}
                </td>
              </tr>
              {g.modules.map(m => (
                <tr key={m.key} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <td style={{ padding: '10px 14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{m.label}</td>
                  {PERM_COLS.map(c => (
                    <td key={c} style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <input
                        type="checkbox"
                        checked={!!permissions[m.key]?.[c]}
                        onChange={() => toggle(m.key, c)}
                        style={{ width: 15, height: 15, accentColor: 'var(--color-gold)', cursor: 'pointer' }}
                      />
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                    <input
                      type="checkbox"
                      checked={PERM_COLS.every(c => !!permissions[m.key]?.[c])}
                      onChange={() => toggleAll(m.key)}
                      style={{ width: 15, height: 15, accentColor: 'var(--color-gold-dark)', cursor: 'pointer' }}
                    />
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────
function SubAdminModal({ mode, initial, onClose, onSaved }) {
  const addToast = useToast();
  const [saving, setSaving] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    password: '',
    permissions: normalizePermissions(initial?.permissions),
  });

  const handleField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const grantAll = () => setForm(f => ({
    ...f,
    permissions: Object.fromEntries(ALL_MODULE_KEYS.map(k => [k, { view: true, create: true, edit: true, delete: true }])),
  }));
  const clearAll = () => setForm(f => ({ ...f, permissions: emptyPermissions() }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return addToast('Name is required.', 'warning', 'Validation');
    if (!form.email.trim()) return addToast('Email is required.', 'warning', 'Validation');
    if (mode === 'create' && !form.password.trim()) return addToast('Password is required.', 'warning', 'Validation');
    if (mode === 'create' && form.password.trim().length < 8) return addToast('Password must be at least 8 characters.', 'warning', 'Validation');

    setSaving(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), permissions: form.permissions };
      if (form.password.trim()) payload.password = form.password.trim();

      if (mode === 'create') {
        const res = await apiRequest('/api/super-admin/sub-admins', { method: 'POST', body: JSON.stringify(payload) });
        addToast('Sub admin created successfully.', 'success', 'Created');
        onSaved(res.data);
      } else {
        const res = await apiRequest(`/api/super-admin/sub-admins/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        addToast('Sub admin updated successfully.', 'success', 'Updated');
        onSaved(res.data);
      }
      onClose();
    } catch (err) {
      addToast(err.message || 'Operation failed.', 'error', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="kfpl-modal-overlay" onClick={onClose}>
      <div
        className="kfpl-modal"
        style={{ maxWidth: 840, maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="kfpl-modal-header">
          <div>
            <h3 className="kfpl-modal-title">{mode === 'create' ? 'Create Sub Admin' : 'Edit Sub Admin'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Assign only the permissions this admin should have access to.
            </p>
          </div>
          <button className="kfpl-modal-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="kfpl-modal-body">
          {/* Basic info fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Full Name</label>
              <input type="text" value={form.name} onChange={e => handleField('name', e.target.value)} placeholder="e.g. Rahul Sharma" className="kfpl-input" style={{ width: '100%' }} />
            </div>
            {/* Email Address */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email Address</label>
              <input type="email" value={form.email} onChange={e => handleField('email', e.target.value)} placeholder="e.g. rahul@kfpl.in" className="kfpl-input" style={{ width: '100%' }} />
            </div>
            {/* Password with eye toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {mode === 'create' ? 'Password' : 'New Password'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => handleField('password', e.target.value)}
                  placeholder={mode === 'create' ? 'Min. 8 characters' : 'Leave blank to keep'}
                  className="kfpl-input"
                  style={{ width: '100%', paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                >
                  {showPassword ? (
                    /* Eye-off icon */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    /* Eye icon */
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Permissions header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>Module Permissions</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={moduleSearch}
                onChange={e => setModuleSearch(e.target.value)}
                placeholder="Find module..."
                className="kfpl-input"
                style={{ width: 160, padding: '7px 12px' }}
              />
              <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={grantAll}>Grant All</button>
              <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={clearAll}>Clear</button>
            </div>
          </div>

          {/* Matrix table */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-white)' }}>
            <PermissionMatrix
              permissions={form.permissions}
              onChange={p => handleField('permissions', p)}
              moduleSearch={moduleSearch}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="kfpl-modal-footer">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={onClose}>Cancel</button>
          <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={handleSubmit} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            {saving && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
            {mode === 'create' ? 'Create Sub Admin' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Delete Confirm Modal ───────────────────────
function DeleteModal({ name, onConfirm, onCancel }) {
  return createPortal(
    <div className="kfpl-modal-overlay" onClick={onCancel}>
      <div className="kfpl-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="kfpl-modal-header">
          <h3 className="kfpl-modal-title">Delete Sub Admin</h3>
          <button className="kfpl-modal-close" onClick={onCancel} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="kfpl-modal-body" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.2)', padding: '14px 16px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-danger)' }}>Permanent Deletion</h4>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete <strong style={{ color: 'var(--color-text-primary)' }}>{name}</strong>? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="kfpl-modal-footer">
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={onCancel}>Cancel</button>
          <button className="kfpl-btn kfpl-btn--danger kfpl-btn--sm" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Status Badge ───────────────────────
function StatusBadge({ isActive }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
      borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700,
      background: isActive ? 'var(--color-success-bg)' : 'rgba(100,116,139,0.1)',
      color: isActive ? 'var(--color-success)' : 'var(--color-text-muted)',
      border: `1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'var(--color-border)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Permission Summary ───────────────────────
function PermissionSummary({ permissions }) {
  if (!permissions) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>None</span>;
  const granted = ALL_MODULE_KEYS.filter(k => Object.values(permissions[k] || {}).some(Boolean));
  if (granted.length === 0) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No permissions</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--color-gold-glow)', color: 'var(--color-gold-dark)',
      border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-full)',
      fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px',
    }}>
      {granted.length} module{granted.length > 1 ? 's' : ''} granted
    </span>
  );
}

// ── Main Page ───────────────────────
export default function SubAdminPage() {
  const addToast = useToast();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalMode, setModalMode] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const fetchSubAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await apiRequest(`/api/super-admin/sub-admins${q}`);
      setSubAdmins(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      addToast(err.message || 'Failed to load sub admins.', 'error', 'Error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchSubAdmins(); }, [fetchSubAdmins]);

  const handleToggleStatus = async (sa) => {
    setTogglingId(sa.id);
    const prev = [...subAdmins];
    setSubAdmins(list => list.map(s => s.id === sa.id ? { ...s, isActive: !s.isActive } : s));
    try {
      await apiRequest(`/api/super-admin/sub-admins/${sa.id}/status`, { method: 'PATCH' });
      addToast(`${sa.name} ${sa.isActive ? 'deactivated' : 'activated'}.`, 'success', 'Status Updated');
    } catch (err) {
      setSubAdmins(prev);
      addToast(err.message || 'Failed to update status.', 'error', 'Error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    const id = deleteTarget.id;
    const name = deleteTarget.name;
    setDeleteTarget(null);
    setSubAdmins(list => list.filter(s => s.id !== id));
    try {
      await apiRequest(`/api/super-admin/sub-admins/${id}`, { method: 'DELETE' });
      addToast(`${name} deleted.`, 'success', 'Deleted');
    } catch (err) {
      addToast(err.message || 'Failed to delete.', 'error', 'Error');
      fetchSubAdmins();
    }
  };

  const handleSaved = (saved) => {
    if (modalMode === 'create') setSubAdmins(l => [saved, ...l]);
    else setSubAdmins(l => l.map(s => s.id === saved.id ? saved : s));
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="kfpl-page">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Page Header */}
      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Sub Admins</h2>
          <p className="kfpl-page-subtitle">Manage team members with limited, role-based access to the KFPL portal.</p>
        </div>
        <div className="kfpl-page-header-actions" style={{ flexWrap: 'nowrap' }}>
          <select
            className="kfpl-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '140px', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '8px', border: '1px solid var(--color-border)', marginRight: '8px' }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={fetchSubAdmins} style={{ marginRight: '8px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.41"/>
            </svg>
            Refresh
          </button>
          {canCreate('subAdmins') && (
            <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => { setEditTarget(null); setModalMode('create'); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Sub Admin
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          {
            label: 'Total Sub Admins', value: subAdmins.length,
            icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
            iconBg: 'var(--color-gold-glow)', iconColor: 'var(--color-gold-dark)',
          },
          {
            label: 'Active', value: subAdmins.filter(s => s.isActive).length,
            icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><polyline points="20 6 9 17 4 12"/></svg>),
            iconBg: 'var(--color-success-bg)', iconColor: 'var(--color-success)',
          },
          {
            label: 'Inactive', value: subAdmins.filter(s => !s.isActive).length,
            icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>),
            iconBg: 'var(--color-warning-bg)', iconColor: 'var(--color-warning)',
          },
        ].map(stat => (
          <div key={stat.label} className="kfpl-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: stat.iconBg, color: stat.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="kfpl-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border-light)' }}>
              {['Name', 'Email', 'Status', 'Permissions', 'Created On', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '13px 16px', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading sub admins...</span>
                </td>
              </tr>
            ) : subAdmins.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '70px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-gold-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-gold-dark)" strokeWidth="1.5" style={{ width: 28, height: 28 }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>No sub admins yet</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Click "Add Sub Admin" to create your first one.</div>
                </td>
              </tr>
            ) : (
              subAdmins.map(sa => (
                <tr
                  key={sa.id}
                  style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Avatar + Name */}
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--color-navy-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-gold)', fontWeight: 800, fontSize: 13,
                      }}>
                        {sa.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{sa.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Sub Admin</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '13px 16px', color: 'var(--color-text-secondary)' }}>{sa.email}</td>
                  <td style={{ padding: '13px 16px' }}><StatusBadge isActive={sa.isActive} /></td>
                  <td style={{ padding: '13px 16px' }}><PermissionSummary permissions={sa.permissions} /></td>
                  <td style={{ padding: '13px 16px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{formatDate(sa.createdAt)}</td>

                  {/* Actions */}
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {/* Toggle Active & Edit */}
                      {canEdit('subAdmins') && (
                        <>
                          <button
                            title={sa.isActive ? 'Deactivate' : 'Activate'}
                            onClick={() => handleToggleStatus(sa)}
                            disabled={togglingId === sa.id}
                            style={{
                              width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                              background: sa.isActive ? 'var(--color-success-bg)' : 'transparent',
                              color: sa.isActive ? 'var(--color-success)' : 'var(--color-text-muted)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            {sa.isActive ? (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                                <polygon points="5 3 19 12 5 21 5 3"/>
                              </svg>
                            )}
                          </button>

                          <button
                            title="Edit"
                            onClick={() => { setEditTarget(sa); setModalMode('edit'); }}
                            style={{
                              width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                              background: 'transparent', color: 'var(--color-gold-dark)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        </>
                      )}

                      {/* Delete */}
                      {canDelete('subAdmins') && (
                        <button
                          title="Delete"
                          onClick={() => setDeleteTarget(sa)}
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: '1px solid var(--color-border)',
                            background: 'transparent', color: 'var(--color-danger)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <SubAdminModal
          mode={modalMode}
          initial={editTarget}
          onClose={() => { setModalMode(null); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
