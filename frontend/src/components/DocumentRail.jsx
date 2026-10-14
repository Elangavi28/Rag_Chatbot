import React, { useState, useRef } from 'react';
import { Search, FileText, Trash2, Plus, X, ChevronLeft } from 'lucide-react';
import HealthPill from './HealthPill';

export default function DocumentRail({
  documents,
  totalChunks,
  selectedDocIds,
  onToggleDoc,
  onSelectAllDocs,
  onDeleteDoc,
  onUploadFiles,
  uploadingFiles,
  backendOnline,
  ollamaHealth,
  searchInputRef,
  isOpenMobile,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${Math.round(kb)} KB`;
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const isAllSelected = documents.length > 0 && selectedDocIds.length === documents.length;

  return (
    <aside className={`library-rail ${isCollapsed ? 'collapsed' : ''} ${isOpenMobile ? 'open-mobile' : ''}`}>
      {/* Header */}
      <div className="library-header">
        <div className="app-brand">
          <span className="brand-dot" />
          <span className="brand-title">NexusRAG</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <HealthPill
            backendOnline={backendOnline}
            ollamaHealth={ollamaHealth}
            totalChunks={totalChunks}
          />

          {isOpenMobile ? (
            <button className="btn-ghost" onClick={onCloseMobile} aria-label="Close library">
              <X size={16} />
            </button>
          ) : (
            onToggleCollapse && (
              <button
                className="btn-ghost"
                style={{ padding: '4px 6px' }}
                onClick={onToggleCollapse}
                aria-label="Collapse library rail"
                title="Collapse library rail"
              >
                <ChevronLeft size={16} />
              </button>
            )
          )}
        </div>
      </div>

      {/* Search Filter */}
      <div className="library-search">
        <div className="search-input-box">
          <Search size={14} />
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search documents... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Documents List */}
      <div className="library-documents">
        <div className="library-section-label">
          <span>Documents ({documents.length})</span>
          {documents.length > 0 && (
            <button
              className="btn-edit-resend"
              style={{ fontSize: '0.72rem' }}
              onClick={onSelectAllDocs}
            >
              {isAllSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {filteredDocs.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.82rem' }}>
            {documents.length === 0 ? 'No documents added yet.' : 'No matching documents.'}
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isChecked = selectedDocIds.includes(doc.document_id);
            return (
              <div
                key={doc.document_id}
                className={`doc-row ${isChecked ? 'selected' : ''}`}
                onClick={() => onToggleDoc(doc.document_id)}
              >
                <input
                  type="checkbox"
                  className="doc-checkbox"
                  checked={isChecked}
                  onChange={() => {}} // Controlled by row click
                  onClick={(e) => e.stopPropagation()}
                />
                <FileText size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                <div className="doc-info">
                  <div className="doc-name" title={doc.filename}>
                    {doc.filename}
                  </div>
                  <div className="doc-sub">
                    <span>{doc.chunk_count} chunks</span>
                    <span>·</span>
                    <span>{formatFileSize(doc.file_size_bytes)}</span>
                  </div>
                </div>

                <button
                  className="doc-delete-btn"
                  title="Delete Document"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${doc.filename}" and its vector chunks?`)) {
                      onDeleteDoc(doc.document_id);
                    }
                  }}
                  aria-label={`Delete ${doc.filename}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Ingest Progress Stack */}
      {uploadingFiles.length > 0 && (
        <div className="upload-progress-list">
          {uploadingFiles.map((up) => (
            <div key={up.id} className="upload-progress-card">
              <div className="progress-header">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                  {up.name}
                </span>
                <span className="progress-stage">{up.stage}</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${up.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer / Upload Trigger */}
      <div className="library-footer">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="btn-upload-trigger"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={16} />
          <span>Upload documents</span>
        </button>
      </div>
    </aside>
  );
}
