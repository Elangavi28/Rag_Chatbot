import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

const MAX_FILE_SIZE_MB = 15;
const ALLOWED_EXTENSIONS = ['.pdf', '.txt'];

export default function DocumentUpload({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!file) return 'No file selected.';

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Invalid format. Allowed file types: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }

    if (file.size === 0) {
      return 'File is empty (0 bytes).';
    }

    const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File exceeds maximum size limit of ${MAX_FILE_SIZE_MB}MB.`;
    }

    return null;
  };

  const processUpload = async (file) => {
    const error = validateFile(file);
    if (error) {
      setStatusMessage({ type: 'error', text: error });
      return;
    }

    setUploading(true);
    setStatusMessage(null);

    try {
      const response = await apiService.uploadDocument(file);
      setStatusMessage({
        type: 'success',
        text: response.message || `Indexed '${file.name}' successfully!`,
      });
      if (onUploadSuccess) {
        onUploadSuccess(response.document);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to process and index document.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
    }
  };

  return (
    <div className="upload-card">
      <div className="section-title">
        <span>Ingest Knowledge</span>
        {uploading && <Loader2 size={16} className="spin" color="#6366f1" />}
      </div>

      <div
        className={`dropzone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={uploading}
        />

        <div className="dropzone-icon">
          {uploading ? (
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <UploadCloud size={32} />
          )}
        </div>

        <div className="dropzone-text">
          {uploading ? 'Processing & Chunking...' : 'Click or drag document to upload'}
        </div>
        <div className="dropzone-hint">
          Supports PDF and TXT (Max {MAX_FILE_SIZE_MB}MB)
        </div>
      </div>

      {statusMessage && (
        <div className={`upload-feedback ${statusMessage.type}`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
