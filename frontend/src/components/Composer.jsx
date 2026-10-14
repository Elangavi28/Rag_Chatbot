import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Square, Layers, Check, ChevronDown } from 'lucide-react';

const MAX_CHAR_LIMIT = 2000;

export default function Composer({
  input,
  setInput,
  onSend,
  onStop,
  isGenerating,
  documents = [],
  selectedDocIds = [],
  onToggleDoc,
  onSelectAllDocs,
  textareaRef,
}) {
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Cap at ~150px (approx 6 lines)
      textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`;
    }
  }, [input, textareaRef]);

  // Close scope dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setScopeDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && input.trim() && documents.length > 0) {
        onSend();
      }
    }
  };

  const hasDocuments = documents.length > 0;
  const isAllSelected = hasDocuments && selectedDocIds.length === documents.length;

  let scopeLabel = 'All documents';
  if (!hasDocuments) {
    scopeLabel = 'No documents';
  } else if (isAllSelected) {
    scopeLabel = `All documents (${documents.length})`;
  } else {
    scopeLabel = `${selectedDocIds.length} of ${documents.length} scoped`;
  }

  const showCharCounter = input.length > 1400;

  return (
    <div className="chat-composer-wrapper">
      <div className="chat-composer">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          rows={1}
          placeholder={
            !hasDocuments
              ? 'Upload a document in the library rail to begin asking questions...'
              : 'Ask a question about your documents... (Press Enter to send, / to focus)'
          }
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_CHAR_LIMIT))}
          onKeyDown={handleKeyDown}
          disabled={!hasDocuments || isGenerating}
          aria-label="Ask a question"
        />

        <div className="composer-toolbar">
          {/* Document Scope Picker */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              className="scope-chip"
              onClick={() => hasDocuments && setScopeDropdownOpen(!scopeDropdownOpen)}
              disabled={!hasDocuments}
              aria-label="Filter documents scope"
            >
              <Layers size={12} />
              <span>{scopeLabel}</span>
              {hasDocuments && <ChevronDown size={11} />}
            </button>

            {scopeDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: 0,
                  width: '280px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-dropdown)',
                  padding: '10px',
                  zIndex: 100,
                  fontSize: '0.82rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: '1px solid var(--border-color)',
                    fontWeight: 600,
                  }}
                >
                  <span>Scope query to:</span>
                  <button
                    className="btn-edit-resend"
                    style={{ fontSize: '0.72rem' }}
                    onClick={onSelectAllDocs}
                  >
                    {isAllSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {documents.map((doc) => {
                    const isChecked = selectedDocIds.includes(doc.document_id);
                    return (
                      <label
                        key={doc.document_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          backgroundColor: isChecked ? 'var(--bg-surface-subtle)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          className="doc-checkbox"
                          checked={isChecked}
                          onChange={() => onToggleDoc(doc.document_id)}
                        />
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={doc.filename}
                        >
                          {doc.filename}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="composer-actions">
            {showCharCounter && (
              <span className="char-counter">
                {input.length} / {MAX_CHAR_LIMIT}
              </span>
            )}

            {isGenerating ? (
              <button
                type="button"
                className="btn-stop-action"
                onClick={onStop}
                aria-label="Stop generating answer"
                title="Stop generation"
              >
                <Square size={11} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-send-action"
                onClick={onSend}
                disabled={!input.trim() || !hasDocuments}
                aria-label="Send question"
                title="Send (Enter)"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
