import React, { useState } from 'react';
import { Copy, Check, RotateCcw, ThumbsUp, ThumbsDown, AlertCircle, BookOpen, Pencil } from 'lucide-react';
import MarkdownView from './MarkdownView';

export default function ChatMessage({
  message,
  index,
  onEditSubmit,
  onRegenerateMessage,
  onSelectCitation,
  onViewSources,
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      onEditSubmit?.(index, trimmed);
    }
    setIsEditing(false);
  };

  if (isUser) {
    return (
      <div className="message-entry user">
        <div className="user-bubble">
          {isEditing ? (
            <div className="user-bubble-edit-form">
              <textarea
                className="user-edit-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditText(message.content);
                  }
                }}
                autoFocus
                rows={Math.min(6, Math.max(2, editText.split('\n').length))}
              />
              <div className="user-edit-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(message.content);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-save-edit"
                  onClick={handleSaveEdit}
                  disabled={!editText.trim()}
                >
                  <Pencil size={11} />
                  <span>Save</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {message.content}
              </div>
              <div className="user-bubble-actions">
                <span>{message.timestamp}</span>
                {onEditSubmit && (
                  <>
                    <span>·</span>
                    <button
                      className="btn-edit-icon"
                      onClick={() => {
                        setEditText(message.content);
                        setIsEditing(true);
                      }}
                      title="Edit question"
                      aria-label="Edit question"
                    >
                      <Pencil size={12} />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  const sources = message.sources || [];
  // Low confidence check: if sources exist but maximum relevance score is below 0.40
  const maxScore = sources.length > 0 ? Math.max(...sources.map((s) => s.score ?? 0.8)) : 1.0;
  const isLowConfidence = sources.length > 0 && maxScore < 0.45;

  const durationText = message.durationSeconds
    ? `${message.durationSeconds}s`
    : message.duration_ms
    ? `${(message.duration_ms / 1000).toFixed(1)}s`
    : null;

  return (
    <div className="message-entry assistant" aria-live="polite">
      <div className="assistant-block">
        {/* Low confidence banner */}
        {isLowConfidence && (
          <div className="low-confidence-banner">
            <AlertCircle size={15} style={{ color: 'var(--status-amber)', flexShrink: 0 }} />
            <span>Low confidence: sources only loosely match this question.</span>
          </div>
        )}

        {/* Markdown Content */}
        <MarkdownView
          content={message.content}
          onSelectCitation={(id) => {
            onViewSources?.(sources);
            onSelectCitation?.(id);
          }}
        />

        {/* Footer Actions & Metadata */}
        <div className="assistant-footer">
          <div className="assistant-actions">
            <button
              className="btn-icon-action"
              onClick={handleCopy}
              title="Copy answer"
              aria-label="Copy answer to clipboard"
            >
              {copied ? (
                <Check size={14} style={{ color: 'var(--status-green)' }} />
              ) : (
                <Copy size={14} />
              )}
            </button>

            {onRegenerateMessage && (
              <button
                className="btn-icon-action"
                onClick={() => onRegenerateMessage(index)}
                title="Regenerate answer"
                aria-label="Regenerate answer"
              >
                <RotateCcw size={14} />
              </button>
            )}

            <button
              className="btn-icon-action"
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              style={{ color: feedback === 'up' ? 'var(--accent-primary)' : undefined }}
              title="Helpful response"
              aria-label="Thumbs up"
            >
              <ThumbsUp size={14} />
            </button>

            <button
              className="btn-icon-action"
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              style={{ color: feedback === 'down' ? 'var(--status-red)' : undefined }}
              title="Not helpful"
              aria-label="Thumbs down"
            >
              <ThumbsDown size={14} />
            </button>

            {sources.length > 0 && (
              <button
                className="btn-icon-action"
                style={{ fontSize: '0.74rem', gap: 4, padding: '3px 6px' }}
                onClick={() => onViewSources?.(sources)}
                title="View retrieved source passages"
              >
                <BookOpen size={13} />
                <span>{sources.length} sources</span>
              </button>
            )}
          </div>

          <div className="assistant-metadata">
            <span>{message.timestamp}</span>
            {durationText && <span> · {durationText}</span>}
            {message.model && <span> · {message.model}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
