/* ============================================================
   Page: InvestmentStatus.jsx
   Description: Project-wise segment-wise status updates with full CRUD,
                segment management, and media upload capabilities.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { INVESTMENT_SEGMENTS } from '../../data/mockData';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../components/ui/Toast';
import { apiRequest } from '../../config/apiHelper';

// ── Default status updates ──────────────────
const DEFAULT_STATUS_UPDATES = [
  {
    id: 1,
    segment: 'Film Making',
    project: 'Project Astra',
    status: 'In Production',
    progress: 65,
    lastUpdate: '2025-04-10',
    note: 'Post-production phase begins next week',
    media: [
      {
        id: 'mock-1',
        name: 'astra_poster.png',
        type: 'image/png',
        size: 154200,
        dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="100%" height="100%" fill="%230b3020"/><circle cx="150" cy="150" r="80" fill="%2310b981"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23061d13" font-family="sans-serif" font-weight="bold" font-size="24">PROJECT ASTRA</text></svg>',
        uploadedAt: '2025-04-10T12:00:00.000Z'
      },
      {
        id: 'mock-2',
        name: 'distribution_agreement.pdf',
        type: 'application/pdf',
        size: 2458000,
        dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJdPr6gogMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nIC9QYWdlcyAyIDAgUiA+PiBlbmRvYmoKMiAwIG9iagogIDw8IC9UeXBlIC9QYWdlcyAvS2lkcyBbIDMgMCBSIF0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmoKICA8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUgODQyIF0gL1Jlc291cmNlcyA8PCA+PiA+PiBlbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNzAgMDAwMDAgbiAKMDAwMDAwMDEzNCAwMDAwMCBuIAp0cmFpbGVyCiAgPDwgL1NpemUgNCAvUm9vdCAxIDAgUiA+PgpzdGFydHhyZWYKMjI4CiUlRU9GCg==',
        uploadedAt: '2025-04-10T12:05:00.000Z'
      }
    ]
  },
  { id: 2, segment: 'Distribution', project: 'Meridian Release', status: 'Active', progress: 80, lastUpdate: '2025-04-08', note: 'Distribution across 3 states confirmed', media: [] },
  { id: 3, segment: 'Music', project: 'Rhythm Series', status: 'Recording', progress: 40, lastUpdate: '2025-04-05', note: '4 tracks completed, 6 remaining', media: [] },
  { id: 4, segment: 'Trading & Syndication', project: 'Content Deal Q2', status: 'Negotiation', progress: 30, lastUpdate: '2025-04-12', note: 'Final terms under discussion', media: [] },
  { id: 5, segment: 'Content IP Bank', project: 'Archive Digitization', status: 'Ongoing', progress: 55, lastUpdate: '2025-04-09', note: '550 titles digitized so far', media: [] },
  { id: 6, segment: 'Film Exhibition', project: 'Screen Network', status: 'Planning', progress: 15, lastUpdate: '2025-04-11', note: '3 new screen locations identified', media: [] },
];

const SEGMENT_COLORS = {
  'Film Making': '#10B981', Distribution: '#1565C0', Music: '#7C3AED',
  'Trading & Syndication': '#F59E0B', 'Content IP Bank': '#0F766E', 'Film Exhibition': '#0891B2',
};

const LS_KEY = 'kfpl_investment_status';
const LS_CUSTOM_SEGMENTS_KEY = 'kfpl_custom_segments';
const LS_HISTORY_KEY = 'kfpl_investment_status_history';

const DEFAULT_SEGMENTS_CONFIG = [
  { name: 'Film Making', statuses: ['Planning', 'In Production', 'Active', 'Ongoing', 'Completed'], isDefault: true },
  { name: 'Distribution', statuses: ['Planning', 'Active', 'Ongoing', 'Negotiation', 'Completed'], isDefault: true },
  { name: 'Music', statuses: ['Planning', 'Recording', 'Active', 'Ongoing', 'Completed', 'Released'], isDefault: true },
  { name: 'Trading & Syndication', statuses: ['Planning', 'Negotiation', 'Active', 'Ongoing', 'Completed'], isDefault: true },
  { name: 'Content IP Bank', statuses: ['Planning', 'Ongoing', 'Active', 'Completed'], isDefault: true },
  { name: 'Film Exhibition', statuses: ['Planning', 'Ongoing', 'Active', 'Completed'], isDefault: true },
];

export default function InvestmentStatus() {
  const addToast = useToast();
  const fileInputRef = useRef(null);

  // ── State ──────────────────────────────
  const [statusUpdates, setStatusUpdates] = useState([]);
  const [segmentsConfig, setSegmentsConfig] = useState([]);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [allHistoryLogs, setAllHistoryLogs] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [expandedMediaCards, setExpandedMediaCards] = useState({});
  const [editId, setEditId] = useState(null);
  const [updateNote, setUpdateNote] = useState('');
  const [inlineStatus, setInlineStatus] = useState('');
  const [inlineProgress, setInlineProgress] = useState(0);
  const [isSegmentWidePost, setIsSegmentWidePost] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [showHistoryLogModal, setShowHistoryLogModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historySegmentFilter, setHistorySegmentFilter] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    isSegmentWide: false,
    project: '',
    segment: '',
    status: 'Planning',
    progress: 0,
    minInvestment: 200000,
    targetFunding: 25000000,
    fundedAmount: 0,
    totalSlots: 20,
    slotsAvailable: 20,
    note: '',
  });
  const [newSegmentName, setNewSegmentName] = useState('');

  // ── Fetch from APIs ────────────────────────
  const loadDashboardData = async () => {
    try {
      const data = await apiRequest('/api/super-admin/projects');
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data.projects && Array.isArray(data.projects)) {
        list = data.projects;
      } else if (data.data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data.data?.projects && Array.isArray(data.data.projects)) {
        list = data.data.projects;
      }

      const mapped = list
        .filter(p => p.name !== '__KFPL_DUMMY__')
        .map(p => ({
          id: p._id || p.id,
          project: p.name || '',
          segment: p.segment || '',
          status: p.status || 'Planning',
          progress: p.milestoneProgress !== undefined ? p.milestoneProgress : (p.progress !== undefined ? p.progress : 0),
          minInvestment: p.minInvestment !== undefined ? p.minInvestment : 200000,
          targetFunding: p.targetFunding !== undefined ? p.targetFunding : 25000000,
          fundedAmount: p.fundedAmount !== undefined ? p.fundedAmount : 0,
          totalSlots: p.totalSlots !== undefined ? p.totalSlots : 20,
          slotsAvailable: p.slotsAvailable !== undefined ? p.slotsAvailable : 20,
          lastUpdate: p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : '—',
          note: p.currentUpdate || p.update || p.summary || '',
          bannerImg: p.bannerImage || p.bannerImg || '',
          media: (p.mediaFiles || []).map((url, idx) => ({
            id: url,
            name: url.split('/').pop() || `File ${idx + 1}`,
            type: url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? 'image/png' : 'application/pdf',
            size: 0,
            dataUrl: url,
            uploadedAt: new Date().toISOString()
          }))
        }));
      setStatusUpdates(mapped);
    } catch (err) {
      console.error('Failed to load investment status from API', err);
    }
  };

  const loadSegments = async () => {
    try {
      const data = await apiRequest('/api/super-admin/segments');
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data.segments && Array.isArray(data.segments)) {
        list = data.segments;
      } else if (data.data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data.data?.segments && Array.isArray(data.data.segments)) {
        list = data.data.segments;
      }

      const mapped = (list || []).map(s => ({
        id: s._id || s.id,
        name: s.name || '',
        statuses: s.statuses && s.statuses.length > 0 ? s.statuses : ['Planning', 'Active', 'Ongoing', 'Completed'],
        isDefault: !!s.isDefault
      }));

      setSegmentsConfig(mapped);
    } catch (err) {
      console.error('Failed to load segments from API:', err);
      setSegmentsConfig([]);
    }
  };

  const fetchAllHistory = async () => {
    try {
      const data = await apiRequest('/api/super-admin/projects/updates/history?segment=All Segments');
      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data.history && Array.isArray(data.history)) {
        list = data.history;
      } else if (data.data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data.data?.history && Array.isArray(data.data.history)) {
        list = data.data.history;
      }

      const mapped = list.map(h => ({
        id: h._id || h.id,
        type: h.type || 'project',
        segment: h.segment || '',
        project: h.project || h.projectName || '',
        status: h.status || '',
        progress: h.progress || 0,
        note: h.notes || h.note || '',
        date: h.date || (h.createdAt ? new Date(h.createdAt).toISOString().split('T')[0] : '—'),
      }));
      setAllHistoryLogs(mapped);
    } catch (err) {
      console.error('Failed to fetch all history logs:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const segFilter = historySegmentFilter === 'all' ? 'All Segments' : historySegmentFilter;
      const searchFilter = historySearch.trim();
      const query = `segment=${encodeURIComponent(segFilter)}&search=${encodeURIComponent(searchFilter)}`;
      const data = await apiRequest(`/api/super-admin/projects/updates/history?${query}`);

      let list = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data.history && Array.isArray(data.history)) {
        list = data.history;
      } else if (data.data && Array.isArray(data.data)) {
        list = data.data;
      } else if (data.data?.history && Array.isArray(data.data.history)) {
        list = data.data.history;
      }

      const mapped = list.map(h => ({
        id: h._id || h.id,
        type: h.type || 'project',
        segment: h.segment || '',
        project: h.project || h.projectName || '',
        status: h.status || '',
        progress: h.progress || 0,
        note: h.notes || h.note || '',
        date: h.date || (h.createdAt ? new Date(h.createdAt).toISOString().split('T')[0] : '—'),
        media: (h.attachments || h.media || []).map((url, idx) => ({
          id: url,
          name: url.split('/').pop() || `File ${idx + 1}`,
          url: url,
          dataUrl: url
        }))
      }));
      setHistoryLogs(mapped);
    } catch (err) {
      console.error('Failed to load history logs:', err);
    }
  };

  // Initial load
  useEffect(() => {
    loadDashboardData();
    loadSegments();
    fetchAllHistory();
  }, []);

  // Update history load on filter changes
  useEffect(() => {
    if (showHistoryLogModal) {
      loadHistory();
    }
  }, [historySegmentFilter, historySearch, showHistoryLogModal]);

  // ── All available segments ─────────────────
  const allSegments = segmentsConfig.map(s => s.name);

  // Derive customSegments list from segmentsConfig
  const customSegments = segmentsConfig
    .filter(c => !c.isDefault)
    .map(c => c.name);

  // ── CRUD Handlers ─────────────────────────
  const resetForm = () => {
    setFormData({
      isSegmentWide: false,
      project: '',
      segment: '',
      status: 'Planning',
      progress: 0,
      minInvestment: 200000,
      targetFunding: 25000000,
      fundedAmount: 0,
      totalSlots: 20,
      slotsAvailable: 20,
      note: ''
    });
  };

  const openAddModal = () => {
    resetForm();
    setEditingItem(null);
    setShowAddModal(true);
  };

  const openEditModal = async (item) => {
    setEditingItem(item);
    setShowAddModal(true);
    
    // Set initial values from the list first
    setFormData({
      isSegmentWide: !!item.isSegmentWide,
      project: item.project || '',
      segment: item.segment || '',
      status: item.status || 'Planning',
      progress: item.progress || 0,
      minInvestment: item.minInvestment !== undefined ? item.minInvestment : 200000,
      targetFunding: item.targetFunding !== undefined ? item.targetFunding : 25000000,
      fundedAmount: item.fundedAmount !== undefined ? item.fundedAmount : 0,
      totalSlots: item.totalSlots !== undefined ? item.totalSlots : 20,
      slotsAvailable: item.slotsAvailable !== undefined ? item.slotsAvailable : 20,
      note: item.note || '',
    });

    // If it's a specific project, fetch fresh full details from GET /api/super-admin/projects/:id
    if (item.id && !item.isSegmentWide) {
      try {
        const details = await apiRequest(`/api/super-admin/projects/${item.id}`);
        const p = details?.project || details?.data?.project || details?.data || details;
        if (p) {
          setFormData({
            isSegmentWide: false,
            project: p.name || item.project || '',
            segment: p.segment || item.segment || '',
            status: p.status || item.status || 'Planning',
            progress: p.milestoneProgress !== undefined ? p.milestoneProgress : (p.progress || item.progress || 0),
            minInvestment: p.minInvestment !== undefined ? p.minInvestment : (item.minInvestment || 200000),
            targetFunding: p.targetFunding !== undefined ? p.targetFunding : (item.targetFunding || 25000000),
            fundedAmount: p.fundedAmount !== undefined ? p.fundedAmount : (item.fundedAmount || 0),
            totalSlots: p.totalSlots !== undefined ? p.totalSlots : (item.totalSlots || 20),
            slotsAvailable: p.slotsAvailable !== undefined ? p.slotsAvailable : (item.slotsAvailable || 20),
            note: p.summary || p.notes || p.currentUpdate || item.note || ''
          });
        }
      } catch (err) {
        console.error('Failed to fetch project details from API:', err);
      }
    }
  };

  const handleSaveProject = async () => {
    if (!formData.isSegmentWide && !formData.project.trim()) {
      addToast('Please fill in project name', 'error', 'Validation Error');
      return;
    }
    if (!formData.segment) {
      addToast('Please select segment', 'error', 'Validation Error');
      return;
    }

    try {
      const payload = {
        name: formData.project,
        segment: formData.segment,
        status: formData.status,
        milestoneProgress: Number(formData.progress) || 0,
        minInvestment: Number(formData.minInvestment) || 200000,
        targetFunding: Number(formData.targetFunding) || 25000000,
        fundedAmount: Number(formData.fundedAmount) || 0,
        totalSlots: Number(formData.totalSlots) || 20,
        slotsAvailable: Number(formData.slotsAvailable) || 20,
        portfolioValue: `₹${((Number(formData.targetFunding) || 25000000) / 10000000).toFixed(1)} Cr`,
        monthlyRoi: '1.0%',
        riskLevel: 'Medium',
        health: 'On Track',
        summary: formData.note || '',
        currentUpdate: formData.note || '',
        scope: formData.isSegmentWide ? 'segment' : 'project',
        applySegmentWide: formData.isSegmentWide
      };

      if (editingItem) {
        if (formData.isSegmentWide) {
          delete payload.name;
        }
        await apiRequest(`/api/super-admin/projects/${editingItem.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        addToast(`${editingItem.project || formData.segment} updated successfully`, 'success', 'Updated');
      } else {
        await apiRequest('/api/super-admin/projects', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        addToast(`${formData.project || formData.segment} added successfully`, 'success', 'Added');
      }

      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
      await loadDashboardData();
      await fetchAllHistory();
    } catch (err) {
      console.error('Failed to save project:', err);
      addToast(err.message || 'Failed to save project.', 'error', 'Error');
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      await apiRequest(`/api/super-admin/projects/${id}`, {
        method: 'DELETE'
      });
      addToast('Project deleted', 'success', 'Deleted');
      setDeleteConfirm(null);
      loadDashboardData();
    } catch (err) {
      console.error('Failed to delete project:', err);
      addToast(err.message || 'Failed to delete project.', 'error', 'Error');
      setDeleteConfirm(null);
    }
  };

  const handlePostUpdate = async (item) => {
    const noteToPost = updateNote.trim() || item.note || 'Status updated';
    const attachmentsList = (item.media || []).map(m => m.dataUrl || m.url || m.id).filter(Boolean);

    try {
      await apiRequest(`/api/super-admin/projects/${item.id}/updates`, {
        method: 'POST',
        body: JSON.stringify({
          status: inlineStatus || item.status,
          progress: parseInt(inlineProgress) !== undefined && !isNaN(parseInt(inlineProgress)) ? parseInt(inlineProgress) : (parseInt(item.progress) || 0),
          notes: noteToPost,
          attachments: attachmentsList,
          applySegmentWide: isSegmentWidePost
        })
      });

      addToast(`Status update posted for ${isSegmentWidePost ? item.segment : item.project}`, 'success', 'Update Posted');
      setEditId(null);
      setUpdateNote('');
      setIsSegmentWidePost(false);
      await loadDashboardData();
      await fetchAllHistory();
    } catch (err) {
      console.error('Failed to post status update:', err);
      addToast(err.message || 'Failed to post status update.', 'error', 'Error');
    }
  };

  // ── Segment Management ─────────────────────
  const handleAddSegment = async () => {
    if (!newSegmentName.trim()) {
      addToast('Please enter a segment name', 'error', 'Validation Error');
      return;
    }
    if (allSegments.some(s => s.toLowerCase() === newSegmentName.trim().toLowerCase())) {
      addToast('Segment already exists', 'error', 'Duplicate');
      return;
    }

    try {
      await apiRequest('/api/super-admin/segments', {
        method: 'POST',
        body: JSON.stringify({
          name: newSegmentName.trim(),
          statuses: ['Planning', 'Active', 'Ongoing', 'Completed']
        })
      });
      addToast(`Segment "${newSegmentName.trim()}" added`, 'success', 'Segment Added');
      setNewSegmentName('');
      loadSegments();
    } catch (err) {
      console.error('Failed to add segment:', err);
      addToast(err.message || 'Failed to add segment.', 'error', 'Error');
    }
  };

  const handleRemoveSegment = async (seg) => {
    const target = segmentsConfig.find(s => s.name === seg);
    if (!target) return;

    try {
      await apiRequest(`/api/super-admin/segments/${target.id}`, {
        method: 'DELETE'
      });
      addToast(`Segment "${seg}" removed`, 'success', 'Segment Removed');
      loadSegments();
    } catch (err) {
      console.error('Failed to remove segment:', err);
      addToast(err.message || 'Failed to remove segment.', 'error', 'Error');
    }
  };

  // ── Media Upload ──────────────────────────
  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!uploadTarget || files.length === 0) return;

    const file = files[0];
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const extractUrl = (res) => {
      if (typeof res === 'string') return res;
      if (!res) return '';
      const url = res.url || 
                  res.secure_url || 
                  res.fileUrl || 
                  res.dataUrl || 
                  res.data?.url || 
                  res.data?.secure_url || 
                  res.data?.fileUrl ||
                  '';
      if (url) return url;
      
      const proj = res.project || res.data?.project || res.data || res;
      if (proj && Array.isArray(proj.mediaFiles) && proj.mediaFiles.length > 0) {
        return proj.mediaFiles[proj.mediaFiles.length - 1];
      }
      if (Array.isArray(res.mediaFiles) && res.mediaFiles.length > 0) {
        return res.mediaFiles[res.mediaFiles.length - 1];
      }
      return '';
    };

    try {
      addToast('Uploading attachment...', 'info', 'Uploading');
      
      let uploadResult = null;
      let fileUrl = '';
      
      try {
        // Try the working media route first to ensure it updates project.mediaFiles (visible to clients)
        uploadResult = await apiRequest(`/api/super-admin/projects/${uploadTarget}/media`, {
          method: 'POST',
          body: uploadFormData
        });
        fileUrl = extractUrl(uploadResult);
      } catch (primaryErr) {
        console.warn('Primary media route upload failed, trying updates attachment route fallback:', primaryErr);
        
        // Fallback to the updates attachment route
        uploadResult = await apiRequest(`/api/super-admin/projects/${uploadTarget}/updates/attachments`, {
          method: 'POST',
          body: uploadFormData
        });
        fileUrl = extractUrl(uploadResult);
      }

      if (fileUrl) {
        const mediaItem = {
          id: fileUrl,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: fileUrl,
          uploadedAt: new Date().toISOString()
        };

        setStatusUpdates(prev => prev.map(item => {
          if (item.id === uploadTarget) {
            return { ...item, media: [...(item.media || []), mediaItem] };
          }
          return item;
        }));
        addToast('File uploaded successfully!', 'success', 'Upload Complete');
      } else {
        throw new Error('No URL returned from backend upload');
      }
    } catch (err) {
      console.error('Failed to upload media:', err);
      addToast(err.message || 'Failed to upload attachment.', 'error', 'Error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadTarget(null);
    }
  };

  const handleRemoveMedia = async (itemId, mediaId) => {
    // Optimistically update the UI state immediately
    setStatusUpdates(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, media: (item.media || []).filter(m => m.id !== mediaId) };
      }
      return item;
    }));
    addToast('Media removed successfully', 'success', 'Success');

    try {
      await apiRequest(`/api/super-admin/projects/${itemId}/media`, {
        method: 'DELETE',
        body: JSON.stringify({
          url: mediaId
        })
      });
      loadDashboardData(); // Sync in background
    } catch (err) {
      console.error('Failed to remove media:', err);
      addToast(err.message || 'Failed to remove media', 'error', 'Error');
      loadDashboardData(); // Revert/sync on error
    }
  };

  const filteredUpdates = statusUpdates.filter(item => {
    const proj = item.isSegmentWide ? `${item.segment} Segment Update` : (item.project || '');
    const seg = item.segment || '';
    return proj.toLowerCase().includes(searchTerm.toLowerCase()) ||
           seg.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="kfpl-page animate-fade-slide-up">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleMediaUpload} />

      <div className="kfpl-page-header">
        <div className="kfpl-page-header-left">
          <h2 className="kfpl-page-title">Investment Status</h2>
          <p className="kfpl-page-subtitle">Project-wise segment-wise investment status updates</p>
        </div>
        <div className="kfpl-page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => setShowHistoryLogModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            View Update History
          </button>
          <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => setShowSegmentModal(true)}>
            + Add Segment
          </button>
          <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={openAddModal}>
            + Add Project
          </button>
        </div>
      </div>

      {/* Search Filter Row */}
      <div className="kfpl-search-filter-row" style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            className="kfpl-input"
            placeholder="Search updates by project or segment name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--color-text-muted)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        {filteredUpdates.length === 0 ? (
          <div className="kfpl-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', gridColumn: '1 / -1' }}>
            No updates found.
          </div>
        ) : filteredUpdates.map(item => {
          const accent = SEGMENT_COLORS[item.segment] || '#10B981';
          const cardUpdates = allHistoryLogs.filter(h => {
            if (item.isSegmentWide) {
              return h.segment === item.segment && h.type === 'segment';
            } else {
              return h.project === item.project;
            }
          });
          const sortedUpdates = [...cardUpdates].sort((a, b) => new Date(b.date) - new Date(a.date));
          const displayUpdates = sortedUpdates.length > 0
            ? sortedUpdates
            : [{ id: 'current', note: item.note || 'No activity update has been posted yet.', date: item.lastUpdate || '—', status: item.status, progress: item.progress }];

          const isExpanded = !!expandedCards[item.id];
          const firstTwo = displayUpdates.slice(0, 2);
          const remaining = displayUpdates.slice(2);

          // Extract project banner or first uploaded image attachment as fallback
          const projectImageItem = (item.media || []).find(m =>
            m.type?.startsWith('image/') ||
            m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i)
          );
          const historyImageItem = cardUpdates
            .flatMap(h => h.media || [])
            .find(m => m.type?.startsWith('image/') || m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i));

          const imageSrc = item.bannerImg || projectImageItem?.dataUrl || historyImageItem?.dataUrl || '';

          return (
            <div
              className="kfpl-status-card animate-fade-slide-up"
              key={item.id}
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              {/* ── IMAGE SECTION WITH ROUNDED EDGES ── */}
              {imageSrc ? (
                <div style={{ margin: '14px 14px 0', borderRadius: '12px', height: '230px', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={imageSrc}
                    alt={item.project}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 100%)'
                  }} />
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 2 }}>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                      letterSpacing: '0.05em',
                      padding: '4px 12px', borderRadius: '20px',
                      background: accent, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      display: 'inline-block',
                      backdropFilter: 'blur(4px)'
                    }}>{item.segment}</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  margin: '14px 14px 0',
                  borderRadius: '12px',
                  height: '190px',
                  background: `linear-gradient(135deg, ${accent}0d 0%, ${accent}03 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #f1f5f9',
                  position: 'relative'
                }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 900, color: accent, opacity: 0.18, letterSpacing: '-1px' }}>
                    {item.project ? item.project.substring(0, 2).toUpperCase() : item.segment.substring(0, 2).toUpperCase()}
                  </span>
                  <div style={{ position: 'absolute', bottom: '12px', left: '12px' }}>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                      letterSpacing: '0.05em',
                      padding: '4px 12px', borderRadius: '20px',
                      background: accent, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      display: 'inline-block',
                      backdropFilter: 'blur(4px)'
                    }}>{item.segment}</span>
                  </div>
                </div>
              )}

              {/* ── CARD BODY ── */}
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Title + Badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{
                      fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0,
                      letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {item.isSegmentWide ? `${item.segment} Segment Update` : item.project}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500, marginTop: '2px', display: 'block' }}>
                      Last Active: {item.lastUpdate}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flexShrink: 0 }}>
                    <Badge status={['Active', 'Ongoing', 'In Production'].includes(item.status) ? 'active' : 'pending'}>{item.status}</Badge>
                    {item.isSegmentWide && <Badge status="info">Segment Wide</Badge>}
                  </div>
                </div>

                {/* Progress bar container */}
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>Milestone Progress</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: accent }}>{item.progress}%</span>
                  </div>
                  <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '3.5px', overflow: 'hidden' }}>
                    <div style={{ width: `${item.progress}%`, height: '100%', background: accent, borderRadius: '3.5px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Updates Accordion Section */}
                {/* ── HIGHLIGHTED TIMELINE LOGS & UPDATES CONTAINER ── */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '14px',
                  borderRadius: '12px',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
                }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                    Timeline Logs & Updates
                  </span>
                  
                  {/* First 2 updates */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {firstTwo.map((up, idx) => (
                      <div key={up.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: accent, marginTop: '6px', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{up.date}</span>
                            {up.status && <span style={{ fontSize: '0.58rem', color: accent, background: `${accent}10`, padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>{up.status}</span>}
                          </div>
                          <p style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.5, margin: '2px 0 0' }}>
                            {up.note}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Accordion panel for remaining updates */}
                  {remaining.length > 0 && (
                    <div>
                      <div
                        style={{
                          maxHeight: isExpanded ? '1000px' : '0px',
                          overflow: 'hidden',
                          transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: isExpanded ? '8px' : '0'
                        }}
                      >
                        {remaining.map((up, idx) => (
                          <div key={up.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1', marginTop: '6px', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{up.date}</span>
                                {up.status && <span style={{ fontSize: '0.58rem', color: '#64748b', background: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>{up.status}</span>}
                              </div>
                              <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, margin: '2px 0 0' }}>
                                {up.note}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Accordion Toggle Trigger Button */}
                      <button
                        onClick={() => setExpandedCards(prev => ({ ...prev, [item.id]: !isExpanded }))}
                        style={{
                          background: 'none', border: 'none', color: accent, fontSize: '0.72rem',
                          fontWeight: 700, cursor: 'pointer', padding: '4px 0 0', display: 'flex',
                          alignItems: 'center', gap: '3px', outline: 'none'
                        }}
                      >
                        {isExpanded ? 'Show Less' : `View More Updates (+${remaining.length})`}
                        <svg
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{ width: 10, height: 10, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* ── HIGHLIGHTED FILES & ATTACHMENTS GRID & ACCORDION ── */}
                {(item.media || []).length > 0 && (() => {
                  const mediaList = item.media || [];
                  const firstEight = mediaList.slice(0, 8);
                  const remainingMedia = mediaList.slice(8);
                  const isMediaExpanded = !!expandedMediaCards[item.id];

                  return (
                    <div style={{
                      marginTop: '12px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Files & Attachments
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>
                          {mediaList.length} File(s)
                        </span>
                      </div>

                      {/* Main 4x2 Grid (up to 8 items) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {firstEight.map(m => (
                          <div key={m.id} style={{
                            position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '10px',
                            overflow: 'hidden', cursor: 'pointer', background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                          }} onClick={() => setPreviewMedia(m)}>
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveMedia(item.id, m.id); }}
                              style={{
                                position: 'absolute', top: '4px', right: '4px', zIndex: 10,
                                background: 'rgba(239,68,68,0.95)', color: '#fff', border: 'none',
                                borderRadius: '50%', width: '18px', height: '18px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                              }} aria-label="Remove">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ width: 8, height: 8 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                            {m.type?.startsWith('image/') || m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                              <img src={m.dataUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>{m.name?.split('.').pop()?.toUpperCase() || 'FILE'}</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Accordion list for elements past the 4x2 grid (> 8 items) */}
                      {remainingMedia.length > 0 && (
                        <div>
                          <div style={{
                            maxHeight: isMediaExpanded ? '2000px' : '0px',
                            overflow: 'hidden',
                            transition: 'max-height 0.3s ease-in-out',
                            marginTop: isMediaExpanded ? '8px' : '0'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                              {remainingMedia.map(m => (
                                <div key={m.id} style={{
                                  position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '10px',
                                  overflow: 'hidden', cursor: 'pointer', background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                                }} onClick={() => setPreviewMedia(m)}>
                                  <button onClick={(e) => { e.stopPropagation(); handleRemoveMedia(item.id, m.id); }}
                                    style={{
                                      position: 'absolute', top: '4px', right: '4px', zIndex: 10,
                                      background: 'rgba(239,68,68,0.95)', color: '#fff', border: 'none',
                                      borderRadius: '50%', width: '18px', height: '18px', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} aria-label="Remove">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ width: 8, height: 8 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                  </button>
                                  {m.type?.startsWith('image/') || m.dataUrl?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                    <img src={m.dataUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>{m.name?.split('.').pop()?.toUpperCase() || 'FILE'}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => setExpandedMediaCards(prev => ({ ...prev, [item.id]: !isMediaExpanded }))}
                            style={{
                              background: 'none', border: 'none', color: accent, fontSize: '0.72rem',
                              fontWeight: 700, cursor: 'pointer', padding: '8px 0 0', display: 'flex',
                              alignItems: 'center', gap: '3px', outline: 'none'
                            }}
                          >
                            {isMediaExpanded ? 'Show Less Files' : `View More Files (+${remainingMedia.length})`}
                            <svg
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                              style={{ width: 10, height: 10, transform: isMediaExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── Beautiful individual pill-buttons action row ── */}
              <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fafbfc', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => {
                    if (editId === item.id) {
                      setEditId(null);
                    } else {
                      setEditId(item.id);
                      setUpdateNote(item.note || '');
                      setInlineStatus(item.status || 'Planning');
                      setInlineProgress(item.progress || 0);
                      setIsSegmentWidePost(false);
                    }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '8px', border: `1px solid ${editId === item.id ? accent : '#e2e8f0'}`,
                    background: editId === item.id ? `${accent}10` : '#fff', color: editId === item.id ? accent : '#475569',
                    fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
                  onMouseLeave={e => { if (editId !== item.id) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; } }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {editId === item.id ? 'Cancel' : 'Update'}
                </button>

                <button
                  onClick={() => openEditModal(item)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                    background: '#fff', color: '#475569', fontSize: '0.72rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Edit
                </button>

                <button
                  onClick={() => { setUploadTarget(item.id); setTimeout(() => fileInputRef.current?.click(), 50); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                    background: '#fff', color: '#475569', fontSize: '0.72rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  Attach
                </button>

                <button
                  onClick={() => setDeleteConfirm(item)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid #fecaca',
                    background: '#fff5f5', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fecaca'; }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                  Delete
                </button>
              </div>

              {/* Inline edit note panel */}
              {editId === item.id && (
                <div style={{ padding: '14px 18px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Status</label>
                      <select
                        className="kfpl-select"
                        value={inlineStatus}
                        onChange={e => setInlineStatus(e.target.value)}
                        style={{ fontSize: '0.78rem', padding: '4px 8px', height: '32px' }}
                      >
                        {((segmentsConfig.find(s => s.name === item.segment)?.statuses) || ['Planning', 'Active', 'In Production', 'Ongoing', 'Completed']).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: '100px' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Progress (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        className="kfpl-input"
                        value={inlineProgress}
                        onChange={e => setInlineProgress(e.target.value)}
                        style={{ fontSize: '0.78rem', padding: '4px 8px', height: '32px' }}
                      />
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '10px', fontSize: '0.75rem', color: '#64748b' }}>
                    <input type="checkbox" checked={isSegmentWidePost} onChange={(e) => setIsSegmentWidePost(e.target.checked)} style={{ cursor: 'pointer' }} />
                    Segment-wide update for <strong>{item.segment}</strong>
                  </label>
                  <textarea className="kfpl-textarea" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)}
                    placeholder="Write status note update..."
                    rows="2" style={{ fontSize: '0.82rem', width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={() => handlePostUpdate(item)} style={{ fontWeight: 700, fontSize: '0.78rem' }}>Publish</button>
                    <button className="kfpl-btn kfpl-btn--ghost kfpl-btn--sm" onClick={() => setEditId(null)} style={{ fontSize: '0.78rem' }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════ Add / Edit Project Modal ═══════ */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingItem(null); resetForm(); }}
        title={editingItem ? (formData.isSegmentWide ? 'Edit Segment Update' : 'Edit Project') : (formData.isSegmentWide ? 'Add Segment Update' : 'Add New Project')}
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => { setShowAddModal(false); setEditingItem(null); resetForm(); }}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" onClick={handleSaveProject}>{editingItem ? 'Update' : (formData.isSegmentWide ? 'Add Update' : 'Add Project')}</button>
          </>
        }
      >
        <div className="kfpl-form" style={{ gap: '16px' }}>
          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Update Scope</label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="radio"
                  name="updateScope"
                  checked={!formData.isSegmentWide}
                  onChange={() => setFormData({ ...formData, isSegmentWide: false })}
                />
                Specific Project
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="radio"
                  name="updateScope"
                  checked={formData.isSegmentWide}
                  onChange={() => setFormData({ ...formData, isSegmentWide: true })}
                />
                Segment-Wide Update
              </label>
            </div>
          </div>
          
          {!formData.isSegmentWide && (
            <div className="kfpl-input-group animate-fade-slide-up">
              <label className="kfpl-input-label">Project Name <span className="required">*</span></label>
              <input type="text" className="kfpl-input" value={formData.project} onChange={e => setFormData({ ...formData, project: e.target.value })} placeholder="Enter project name" />
            </div>
          )}

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Segment <span className="required">*</span></label>
              <select
                className="kfpl-select"
                value={formData.segment}
                onChange={e => {
                  const selectedSeg = e.target.value;
                  const segConfig = segmentsConfig.find(s => s.name === selectedSeg);
                  const defaultStatus = segConfig && segConfig.statuses.length > 0 ? segConfig.statuses[0] : '';
                  setFormData({ ...formData, segment: selectedSeg, status: defaultStatus });
                }}
              >
                <option value="">Select segment</option>
                {allSegments.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Status</label>
              <select
                className="kfpl-select"
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                disabled={!formData.segment}
              >
                <option value="">Select status</option>
                {((segmentsConfig.find(s => s.name === formData.segment)?.statuses) || []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
                {formData.status && !((segmentsConfig.find(s => s.name === formData.segment)?.statuses) || []).includes(formData.status) && (
                  <option value={formData.status}>{formData.status} (Current)</option>
                )}
              </select>
            </div>
          </div>
          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Min. Investment (₹)</label>
              <input type="number" className="kfpl-input" min="0" value={formData.minInvestment} onChange={e => setFormData({ ...formData, minInvestment: e.target.value })} placeholder="e.g. 500000" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Target Funding (₹)</label>
              <input type="number" className="kfpl-input" min="0" value={formData.targetFunding} onChange={e => setFormData({ ...formData, targetFunding: e.target.value })} placeholder="e.g. 25000000" />
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Funded Amount (₹)</label>
              <input type="number" className="kfpl-input" min="0" value={formData.fundedAmount} onChange={e => setFormData({ ...formData, fundedAmount: e.target.value })} placeholder="e.g. 15000000" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Milestone Progress (%)</label>
              <input type="number" className="kfpl-input" min="0" max="100" value={formData.progress} onChange={e => setFormData({ ...formData, progress: e.target.value })} />
            </div>
          </div>

          <div className="kfpl-form-row">
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Total Slots</label>
              <input type="number" className="kfpl-input" min="1" value={formData.totalSlots} onChange={e => setFormData({ ...formData, totalSlots: e.target.value })} placeholder="20" />
            </div>
            <div className="kfpl-input-group">
              <label className="kfpl-input-label">Slots Available</label>
              <input type="number" className="kfpl-input" min="0" value={formData.slotsAvailable} onChange={e => setFormData({ ...formData, slotsAvailable: e.target.value })} placeholder="20" />
            </div>
          </div>

          <div className="kfpl-input-group">
            <label className="kfpl-input-label">Notes / Description</label>
            <textarea className="kfpl-textarea" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder="Brief description or status note..." rows="3" />
          </div>
        </div>
      </Modal>

      {/* ═══════ Add Segment Modal ═══════ */}
      <Modal
        isOpen={showSegmentModal}
        onClose={() => { setShowSegmentModal(false); setNewSegmentName(''); }}
        title="Manage Segments"
        size="sm"
        footer={
          <button className="kfpl-btn kfpl-btn--ghost" onClick={() => { setShowSegmentModal(false); setNewSegmentName(''); }}>Close</button>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <div className="kfpl-input-group" style={{ marginBottom: '12px' }}>
            <label className="kfpl-input-label">New Segment Name</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" className="kfpl-input" value={newSegmentName} onChange={e => setNewSegmentName(e.target.value)} placeholder="e.g. OTT Platform" style={{ flex: 1 }} />
              <button className="kfpl-btn kfpl-btn--primary kfpl-btn--sm" onClick={handleAddSegment}>Add</button>
            </div>
          </div>

          {/* Existing segments */}
          <div>
            <label className="kfpl-input-label" style={{ marginBottom: '8px', display: 'block' }}>Active Segments ({segmentsConfig.length})</label>
            {segmentsConfig.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>No segments configured yet. Add a segment above.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {segmentsConfig.map(seg => (
                  <span key={seg.id || seg.name} style={{
                    padding: '5px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px',
                  }}>
                    {seg.name}
                    <button
                      style={{
                        background: 'none', border: 'none', color: 'var(--color-danger)',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                        justifyContent: 'center', padding: 0, marginLeft: '2px'
                      }}
                      onClick={() => handleRemoveSegment(seg.name)}
                      title={`Remove segment ${seg.name}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 12, height: 12 }}>
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ═══════ Delete Confirmation Modal ═══════ */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirm Delete"
        size="sm"
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="kfpl-btn kfpl-btn--primary" style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleDeleteProject(deleteConfirm.id)}>Delete</button>
          </>
        }
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          Are you sure you want to delete <strong>{deleteConfirm?.project}</strong>? This action cannot be undone.
        </p>
      </Modal>

      {/* ═══════ Media Preview Modal ═══════ */}
      <Modal
        isOpen={!!previewMedia}
        onClose={() => setPreviewMedia(null)}
        title={previewMedia?.name || 'File Preview'}
        size={previewMedia?.type?.startsWith('image/') || previewMedia?.type?.startsWith('video/') ? 'lg' : 'md'}
        footer={
          <>
            <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setPreviewMedia(null)}>Close</button>
            {previewMedia?.dataUrl && (
              <a
                href={previewMedia.dataUrl}
                download={previewMedia.name}
                className="kfpl-btn kfpl-btn--primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download File
              </a>
            )}
          </>
        }
      >
        {previewMedia && (
          <div className="kfpl-media-preview-container">
            {previewMedia.type?.startsWith('image/') ? (
              <img
                src={previewMedia.dataUrl}
                alt={previewMedia.name}
                className="kfpl-media-preview-content"
              />
            ) : previewMedia.type?.startsWith('video/') ? (
              <video
                src={previewMedia.dataUrl}
                controls
                autoPlay
                className="kfpl-media-preview-content"
                style={{ outline: 'none' }}
              />
            ) : (
              <div className="kfpl-media-preview-doc">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="kfpl-media-preview-doc-icon">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div className="kfpl-media-preview-info">
                  <span className="kfpl-media-preview-filename">{previewMedia.name}</span>
                  <span className="kfpl-media-preview-filesize">
                    File Type: {previewMedia.type || 'Unknown'} • Size: {(previewMedia.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══════ History Log Modal ═══════ */}
      <Modal
        isOpen={showHistoryLogModal}
        onClose={() => setShowHistoryLogModal(false)}
        title="Investment Status Update History"
        size="lg"
        footer={
          <button className="kfpl-btn kfpl-btn--ghost" onClick={() => setShowHistoryLogModal(false)}>Close</button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              className="kfpl-input"
              placeholder="Search history by project or note..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="kfpl-select"
              value={historySegmentFilter}
              onChange={e => setHistorySegmentFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="all">All Segments</option>
              {allSegments.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* List of historical records */}
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
            {historyLogs
              .filter(log => {
                const matchesSearch =
                  (log.project || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                  (log.note || '').toLowerCase().includes(historySearch.toLowerCase());
                const matchesSegment =
                  historySegmentFilter === 'all' || log.segment === historySegmentFilter;
                return matchesSearch && matchesSegment;
              })
              .length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px' }}>
                No update history found matching your filters.
              </div>
            ) : historyLogs
                .filter(log => {
                  const matchesSearch =
                    (log.project || '').toLowerCase().includes(historySearch.toLowerCase()) ||
                    (log.note || '').toLowerCase().includes(historySearch.toLowerCase());
                  const matchesSegment =
                    historySegmentFilter === 'all' || log.segment === historySegmentFilter;
                  return matchesSearch && matchesSegment;
                })
                .map(log => {
                  const accent = SEGMENT_COLORS[log.segment] || '#10B981';
                  return (
                    <div key={log.id} style={{
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="kfpl-badge" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}30` }}>{log.segment}</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                            {log.type === 'segment' || !log.project ? 'Segment-Wide Update' : log.project}
                          </strong>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{log.date}</span>
                      </div>
                      
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0, fontStyle: 'italic' }}>
                        "{log.note || 'No notes posted.'}"
                      </p>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-light)', paddingTop: '6px', marginTop: '2px' }}>
                        <span>Status: <strong>{log.status}</strong> • Progress: <strong>{log.progress}%</strong></span>
                        {(log.media || []).length > 0 && (
                          <span style={{ color: 'var(--color-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                            </svg>
                            {log.media.length} File(s)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ============ END: InvestmentStatus.jsx ============ */
