/* ============================================================
   Page: FAQManagement.jsx
   Description: Professional CRUD interface for managing FAQs with 
                native modal classes and global body-blur syncing.
   ============================================================ */

import { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';

const emptyForm = {
  question: '',
  answer: '',
  target: 'both',
  priority: 0,
};

export default function FAQManagement() {
  const addToast = useToast();
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filterTarget, setFilterTarget] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state with body class for global blur
  useEffect(() => {
    if (showModal || deleteConfirm) {
      document.body.classList.add('global-modal-blur');
    } else {
      document.body.classList.remove('global-modal-blur');
    }
    return () => {
      document.body.classList.remove('global-modal-blur');
    };
  }, [showModal, deleteConfirm]);

  const fetchFAQs = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/super-admin/faqs');
      if (res.success && res.data) {
        // Map backend targetPortal to frontend target
        const mapped = res.data.map(faq => ({
          id: faq._id,
          question: faq.question,
          answer: faq.answer,
          target: faq.targetPortal === 'Both Portals (Client & Agent)' ? 'both' :
                  faq.targetPortal === 'Client Dashboard Only' ? 'client' :
                  faq.targetPortal === 'Agent Dashboard Only' ? 'agent' : 'both',
          priority: faq.priority ?? 0,
          createdAt: faq.createdAt,
          updatedAt: faq.updatedAt
        }));
        // Sort by priority rank
        mapped.sort((a, b) => a.priority - b.priority);
        setFaqs(mapped);
      }
    } catch (err) {
      addToast(err.message || 'Failed to fetch FAQs', 'error', 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFAQs();
  }, []);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const filtered = faqs
    .filter(f => {
      if (filterTarget === 'all') return true;
      return f.target === filterTarget || f.target === 'both';
    })
    .filter(f => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query);
    });

  const openAdd = () => {
    setForm({ ...emptyForm, priority: faqs.length });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (faq) => {
    setForm({ question: faq.question, answer: faq.answer, target: faq.target, priority: faq.priority });
    setEditingId(faq.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      addToast('Please fill in both Question and Answer', 'error', 'Validation');
      return;
    }

    const payload = {
      question: form.question,
      answer: form.answer,
      targetPortal: form.target === 'both' ? 'Both Portals (Client & Agent)' :
                    form.target === 'client' ? 'Client Dashboard Only' :
                    form.target === 'agent' ? 'Agent Dashboard Only' : 'Both Portals (Client & Agent)',
      priority: form.priority
    };

    try {
      if (editingId) {
        const res = await apiRequest(`/api/super-admin/faqs/${editingId}`, {
          method: 'PATCH',
          body: payload
        });
        
        const updatedFaq = res.data || res.faq;
        const updatedMapped = {
          id: editingId,
          question: updatedFaq?.question || payload.question,
          answer: updatedFaq?.answer || payload.answer,
          target: updatedFaq?.targetPortal === 'Both Portals (Client & Agent)' ? 'both' :
                  updatedFaq?.targetPortal === 'Client Dashboard Only' ? 'client' :
                  updatedFaq?.targetPortal === 'Agent Dashboard Only' ? 'agent' : form.target,
          priority: updatedFaq?.priority ?? form.priority,
          updatedAt: updatedFaq?.updatedAt || new Date().toISOString()
        };

        const updatedList = faqs.map(f => f.id === editingId ? { ...f, ...updatedMapped } : f);
        updatedList.sort((a, b) => a.priority - b.priority);
        setFaqs(updatedList);
        addToast('FAQ updated successfully', 'success', 'Updated');
      } else {
        const res = await apiRequest('/api/super-admin/faqs', {
          method: 'POST',
          body: payload
        });

        const createdFaq = res.data || res.faq;
        const newMapped = {
          id: createdFaq?._id || Date.now().toString(36),
          question: createdFaq?.question || payload.question,
          answer: createdFaq?.answer || payload.answer,
          target: createdFaq?.targetPortal === 'Both Portals (Client & Agent)' ? 'both' :
                  createdFaq?.targetPortal === 'Client Dashboard Only' ? 'client' :
                  createdFaq?.targetPortal === 'Agent Dashboard Only' ? 'agent' : form.target,
          priority: createdFaq?.priority ?? form.priority,
          createdAt: createdFaq?.createdAt || new Date().toISOString(),
          updatedAt: createdFaq?.updatedAt || new Date().toISOString()
        };

        const updatedList = [...faqs, newMapped];
        updatedList.sort((a, b) => a.priority - b.priority);
        setFaqs(updatedList);
        addToast('FAQ added successfully', 'success', 'Created');
      }
      closeModal();
    } catch (err) {
      addToast(err.message || 'Failed to save FAQ', 'error', 'Error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiRequest(`/api/super-admin/faqs/${id}`, {
        method: 'DELETE'
      });
      setFaqs(prev => prev.filter(f => f.id !== id));
      setDeleteConfirm(null);
      addToast('FAQ deleted', 'success', 'Deleted');
    } catch (err) {
      addToast(err.message || 'Failed to delete FAQ', 'error', 'Error');
    }
  };

  const swapPriority = async (index1, index2) => {
    const item1 = faqs[index1];
    const item2 = faqs[index2];
    
    // Swap priorities in memory
    const updated = [...faqs];
    const tempPriority = item1.priority;
    item1.priority = item2.priority;
    item2.priority = tempPriority;
    [updated[index1], updated[index2]] = [updated[index2], updated[index1]];
    
    setFaqs(updated);
    
    try {
      await Promise.all([
        apiRequest(`/api/super-admin/faqs/${item1.id}`, {
          method: 'PATCH',
          body: { priority: item1.priority }
        }),
        apiRequest(`/api/super-admin/faqs/${item2.id}`, {
          method: 'PATCH',
          body: { priority: item2.priority }
        })
      ]);
      addToast('FAQ order updated', 'success', 'Saved');
    } catch (err) {
      addToast(err.message || 'Failed to save order', 'error', 'Error');
      fetchFAQs();
    }
  };

  const moveUp = (index) => {
    if (index === 0) return;
    swapPriority(index, index - 1);
  };

  const moveDown = (index) => {
    if (index === faqs.length - 1) return;
    swapPriority(index, index + 1);
  };

  const targetBadge = (target) => {
    const colors = {
      client: { bg: '#e0f2fe', color: '#0369a1', label: 'Client' },
      agent: { bg: '#fef3c7', color: '#d97706', label: 'Agent' },
      both: { bg: '#d1fae5', color: '#059669', label: 'Both' },
    };
    const c = colors[target] || colors.both;
    return (
      <span style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: '30px',
        fontSize: '0.725rem', fontWeight: 700, letterSpacing: '0.5px',
        background: c.bg, color: c.color, textTransform: 'uppercase'
      }}>
        {c.label}
      </span>
    );
  };

  // Icons
  const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  );
  const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  );
  const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  );
  const ChevronIcon = ({ up }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
  );

  return (
    <div className="kfpl-page">
      {/* Page Header */}
      <div className="kfpl-page-header" style={{ marginBottom: '28px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title" style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--color-navy)' }}>FAQ Control Board</h2>
          <p className="kfpl-page-subtitle" style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>Draft and organize frequently asked questions displayed in Client and Agent portals.</p>
        </div>
        <div className="kfpl-page-header-actions">
          <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px' }}>
            <PlusIcon /> New Question
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="kfpl-filter-bar-responsive" style={{
        display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
      }}>
        {/* Left Side: Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0', overflowX: 'auto', maxWidth: '100%' }}>
          {['all', 'client', 'agent', 'both'].map(t => (
            <button
              key={t}
              onClick={() => setFilterTarget(t)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', flexShrink: 0,
                background: filterTarget === t ? '#fff' : 'transparent',
                color: filterTarget === t ? 'var(--color-navy)' : '#64748b',
                boxShadow: filterTarget === t ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {t === 'all' ? 'All Channels' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Right Side: Search Box */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search FAQs..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="kfpl-input"
            style={{ paddingLeft: '38px', height: '38px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* FAQ Accordion List */}
      {loading ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'var(--color-surface)', borderRadius: '16px',
          border: '1px solid var(--color-border)', margin: '10px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="spinner" style={{
            border: '4px solid rgba(0, 0, 0, 0.1)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            borderLeftColor: 'var(--color-emerald)',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Loading FAQs from server...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 20px',
          background: 'var(--color-surface)', borderRadius: '16px',
          border: '1.5px dashed var(--color-border)', margin: '10px 0'
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>❓</div>
          <h3 style={{ color: 'var(--color-navy)', fontWeight: 800, marginBottom: '6px', fontSize: '1.15rem' }}>No matching FAQs found</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', maxWidth: '320px', margin: '0 auto' }}>
            Try adjusting your search query or filter target channel to see options.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map((faq, idx) => {
            const isExpanded = expandedId === faq.id;
            const originalIndex = faqs.indexOf(faq);
            return (
              <div
                key={faq.id}
                style={{
                  background: 'var(--color-surface)',
                  border: isExpanded ? '1.5px solid var(--color-emerald)' : '1px solid var(--color-border)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isExpanded ? '0 10px 30px rgba(16, 185, 129, 0.06)' : '0 2px 8px rgba(0, 0, 0, 0.01)'
                }}
              >
                {/* Accordion Trigger Row */}
                <div
                  className="kfpl-faq-trigger-row"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                    padding: '16px 20px', cursor: 'pointer',
                    userSelect: 'none'
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                >
                  <span style={{
                    width: '30px', height: '30px', borderRadius: '10px',
                    background: isExpanded ? 'linear-gradient(135deg, var(--color-emerald) 0%, var(--color-emerald-dark) 100%)' : 'rgba(16, 185, 129, 0.08)',
                    color: isExpanded ? '#fff' : 'var(--color-emerald)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.8rem', flexShrink: 0,
                    transition: 'all 0.2s'
                  }}>
                    {idx + 1}
                  </span>
                  <span style={{
                    flex: 1, fontWeight: 700,
                    color: isExpanded ? 'var(--color-navy)' : 'var(--color-navy-dark, #1e293b)',
                    fontSize: '0.975rem',
                    lineHeight: '1.4'
                  }}>
                    {faq.question}
                  </span>
                  {targetBadge(faq.target)}
                  <span style={{
                    transition: 'transform 0.25s',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                    color: isExpanded ? 'var(--color-emerald)' : 'var(--color-text-muted)',
                    marginLeft: '8px'
                  }}>
                    <ChevronIcon />
                  </span>
                </div>

                {/* Body Content */}
                <div style={{
                  maxHeight: isExpanded ? '500px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}>
                  <div style={{
                    padding: '0 24px 20px 70px',
                    color: '#475569',
                    fontSize: '0.9rem',
                    lineHeight: '1.7',
                    borderTop: '1px solid var(--color-border)'
                  }}>
                    <div style={{ paddingTop: '16px', whiteSpace: 'pre-wrap' }}>{faq.answer}</div>
                    
                    {/* Actions and Sorting */}
                    <div style={{
                      display: 'flex', gap: '10px', marginTop: '20px',
                      justifyContent: 'flex-end', alignItems: 'center',
                      borderTop: '1px solid #f1f5f9', paddingTop: '14px'
                    }}>
                      <span style={{ marginRight: 'auto', fontSize: '0.75rem', color: '#94a3b8' }}>
                        Priority Rank: {faq.priority + 1}
                      </span>
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); moveUp(originalIndex); }}
                        disabled={originalIndex === 0}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)',
                          background: '#fff', cursor: 'pointer', color: 'var(--color-text-muted)',
                          opacity: originalIndex === 0 ? 0.35 : 1, display: 'inline-flex', alignItems: 'center'
                        }}
                        title="Move Up Priority"
                      >
                        <ChevronIcon up />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveDown(originalIndex); }}
                        disabled={originalIndex === faqs.length - 1}
                        style={{
                          padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)',
                          background: '#fff', cursor: 'pointer', color: 'var(--color-text-muted)',
                          opacity: originalIndex === faqs.length - 1 ? 0.35 : 1, display: 'inline-flex', alignItems: 'center'
                        }}
                        title="Move Down Priority"
                      >
                        <ChevronIcon />
                      </button>
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(faq); }}
                        className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px' }}
                      >
                        <EditIcon /> Edit
                      </button>
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(faq.id); }}
                        className="kfpl-btn kfpl-btn--sm"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px', height: '32px',
                          background: '#fff1f1', color: '#e11d48', border: '1px solid #ffe4e6'
                        }}
                      >
                        <TrashIcon /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal (Centered + Backdrop Blur with native kfpl-modal-overlay) */}
      {showModal && (
        <div className="kfpl-modal-overlay" style={{ background: 'rgba(0, 0, 0, 0.02)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <div className="kfpl-modal" style={{ maxWidth: '580px' }}>
            <div className="kfpl-modal-header">
              <h3 className="kfpl-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-navy)' }}>
                {editingId ? 'Modify FAQ Entry' : 'Create New FAQ Entry'}
              </h3>
              <div className="kfpl-modal-close" onClick={closeModal} style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>&times;</div>
            </div>

            <div className="kfpl-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="kfpl-input-group" style={{ margin: 0 }}>
                <label className="kfpl-input-label" style={{ fontWeight: 700 }}>Question Prompt <span className="required">*</span></label>
                <input
                  className="kfpl-input"
                  value={form.question}
                  onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                  placeholder="e.g., How can I request a payment payout?"
                  style={{ height: '42px', fontSize: '0.9rem', borderRadius: '10px' }}
                />
              </div>

              <div className="kfpl-input-group" style={{ margin: 0 }}>
                <label className="kfpl-input-label" style={{ fontWeight: 700 }}>Detailed Answer <span className="required">*</span></label>
                <textarea
                  className="kfpl-input"
                  rows={6}
                  value={form.answer}
                  onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
                  placeholder="Provide a clear, formatted answer for the user portal..."
                  style={{ resize: 'vertical', minHeight: '120px', fontSize: '0.9rem', borderRadius: '10px', padding: '12px' }}
                />
              </div>

              <div className="kfpl-input-group" style={{ margin: 0 }}>
                <label className="kfpl-input-label" style={{ fontWeight: 700 }}>Target Portal Channel</label>
                <select
                  className="kfpl-select"
                  value={form.target}
                  onChange={e => setForm(p => ({ ...p, target: e.target.value }))}
                  style={{ height: '42px', fontSize: '0.9rem', borderRadius: '10px', background: '#f8fafc' }}
                >
                  <option value="both">Both Portals (Client & Agent)</option>
                  <option value="client">Client Dashboard Only</option>
                  <option value="agent">Agent Dashboard Only</option>
                </select>
              </div>
            </div>

            <div className="kfpl-modal-footer">
              <button className="kfpl-btn kfpl-btn--ghost" onClick={closeModal} style={{ height: '42px', padding: '0 24px', borderRadius: '10px', fontWeight: 600 }}>Cancel</button>
              <button className="kfpl-btn kfpl-btn--primary" onClick={handleSave} style={{ height: '42px', padding: '0 24px', borderRadius: '10px', fontWeight: 700 }}>
                {editingId ? 'Save Changes' : 'Publish FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Centered + Backdrop Blur with native kfpl-modal-overlay) */}
      {deleteConfirm && (
        <div className="kfpl-modal-overlay" style={{ background: 'rgba(0, 0, 0, 0.02)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <div className="kfpl-modal" style={{ maxWidth: '420px', padding: '10px 0' }}>
            <div className="kfpl-modal-body" style={{ textAlign: 'center', padding: '36px 36px 16px 36px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2',
                color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', marginBottom: '18px'
              }}>
                ⚠️
              </div>
              <h3 style={{ fontWeight: 800, color: 'var(--color-navy)', fontSize: '1.2rem', marginBottom: '8px' }}>Delete FAQ entry?</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '10px', lineHeight: '1.5' }}>
                Are you sure you want to delete this question? This action will remove it from all portal views.
              </p>
            </div>
            <div className="kfpl-modal-footer" style={{ justifyContent: 'center', border: 'none', paddingBottom: '24px' }}>
              <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setDeleteConfirm(null)} style={{ height: '40px', padding: '0 20px', borderRadius: '8px' }}>Cancel</button>
              <button
                className="kfpl-btn"
                style={{
                  background: '#e11d48', color: '#fff', border: 'none', padding: '0 24px',
                  borderRadius: '8px', fontWeight: 700, cursor: 'pointer', height: '40px'
                }}
                onClick={() => handleDelete(deleteConfirm)}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
