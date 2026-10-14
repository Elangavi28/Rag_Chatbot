import React, { useState } from 'react';
import { FileText, Trash2, RefreshCw, Layers, Database } from 'lucide-react';
import { apiService } from '../services/api';

export default function DocumentList({ documents, totalChunks, onRefresh, onDeleteSuccess }) {
  const [deletingId, setDeletingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleDelete = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}" and all of its associated vector chunks from ChromaDB?`)) {
      return;
    }

    setDeletingId(docId);
    try {
      await apiService.deleteDocument(docId);
      if (onDeleteSuccess) {
        onDeleteSuccess(docId);
      }
    } catch (err) {
      alert(`Failed to delete document: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  return (
    <div className="documents-card">
      <div className="section-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={15} color="#818cf8" />
          <span>Knowledge Base ({documents.length})</span>
        </div>
        <button
          className="btn-icon-danger"
          onClick={handleRefresh}
          title="Refresh Documents Catalog"
          style={{ color: '#94a3b8' }}
        >
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state-card">
          No documents indexed yet. Upload a PDF or TXT document above to initialize your vector store.
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((doc) => {
            const ext = doc.file_type ? doc.file_type.replace('.', '') : 'txt';
            const isDeleting = deletingId === doc.document_id;

            return (
              <div key={doc.document_id} className="doc-item">
                <div className="doc-info">
                  <div className={`doc-icon-badge ${ext}`}>
                    {ext.toUpperCase()}
                  </div>
                  <div className="doc-details">
                    <div className="doc-title" title={doc.filename}>
                      {doc.filename}
                    </div>
                    <div className="doc-meta">
                      <span>{doc.chunk_count} chunks</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.file_size_bytes)}</span>
                    </div>
                  </div>
                </div>

                <button
                  className="btn-icon-danger"
                  onClick={() => handleDelete(doc.document_id, doc.filename)}
                  disabled={isDeleting}
                  title="Delete Document"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
