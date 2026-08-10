/* ============================================================
   Component: FileDropzone.jsx
   Description: Reusable drag-and-drop + click-to-browse file upload
   ============================================================ */

import { useState, useRef } from 'react';

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileIcon(type) {
  if (type === 'application/pdf') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

export default function FileDropzone({ onFilesChange, multiple = false, label = 'Document Upload', existingFileUrl = '', onDeleteExisting }) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const validateAndAdd = (newFiles) => {
    setError('');
    const validFiles = [];

    for (const file of newFiles) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`"${file.name}" — Invalid file type. Only PDF, JPG, PNG allowed.`);
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError(`"${file.name}" — File too large. Max ${MAX_SIZE_MB}MB allowed.`);
        continue;
      }
      if (files.some(f => f.name === file.name && f.size === file.size)) continue;
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      const updated = multiple ? [...files, ...validFiles] : validFiles.slice(0, 1);
      setFiles(updated);
      onFilesChange?.(updated);
    }
  };

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesChange?.(updated);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) validateAndAdd(droppedFiles);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) validateAndAdd(selected);
    e.target.value = '';
  };

  return (
    <div className="kfpl-form-section" style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '10px', background: '#F8FAFC' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--color-navy)' }}>{label}</div>
        {existingFileUrl && files.length === 0 && (
          <span style={{ fontSize: '0.7rem', color: '#16A34A', fontWeight: '700', background: '#DCFCE7', padding: '2px 8px', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
            ✓ File Uploaded
          </span>
        )}
      </div>

      {/* Show Existing File Box if uploaded & no new file selected */}
      {existingFileUrl && files.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #CBD5E1', marginBottom: '8px' }}>
          {existingFileUrl.match(/\.(jpeg|jpg|png|webp)/i) ? (
            <img src={existingFileUrl} alt={label} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }} />
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📄
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Existing Document
            </div>
            <a href={existingFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#0284C7', textDecoration: 'underline' }}>
              View Current File ↗
            </a>
          </div>
          {onDeleteExisting && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteExisting();
              }}
              style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Delete this document"
            >
              🗑️ Delete
            </button>
          )}
        </div>
      )}

      <div
        className={`kfpl-dropzone ${isDragging ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{ padding: '14px', borderRadius: '8px', border: '1.5px dashed #CBD5E1', textAlign: 'center', cursor: 'pointer', background: '#FFFFFF' }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple={multiple}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        <div className="kfpl-dropzone-icon" style={{ marginBottom: '4px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="28" height="28">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
          {isDragging ? 'Drop file here…' : existingFileUrl ? 'Click to replace document' : 'Click or drag file to upload'}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>PDF, JPG, PNG (Max 10MB)</div>
      </div>

      {error && (
        <div style={{
          fontSize: '0.75rem',
          color: '#EF4444',
          padding: '6px 10px',
          background: 'rgba(239, 68, 68, 0.08)',
          borderRadius: '6px',
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* New Selected Files Live Preview */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {files.map((file, i) => {
            const isImage = file.type.startsWith('image/');
            const previewBlobUrl = isImage ? URL.createObjectURL(file) : null;
            return (
              <div key={`${file.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#FFFFFF', borderRadius: '6px', border: '1px solid #10B981' }}>
                {isImage && previewBlobUrl ? (
                  <img src={previewBlobUrl} alt="Preview" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                ) : (
                  getFileIcon(file.type)
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatFileSize(file.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#EF4444',
                    padding: '2px 6px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ END: FileDropzone.jsx ============ */
