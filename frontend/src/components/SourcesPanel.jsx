import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, X, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function SourcesPanel({
  sources = [],
  isOpen = true,
  onClose,
  highlightedSourceId,
}) {
  const [expandedCards, setExpandedCards] = useState({});
  const cardRefs = useRef({});

  const toggleExpand = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Scroll to and highlight card when highlightedSourceId changes
  useEffect(() => {
    if (highlightedSourceId && cardRefs.current[highlightedSourceId]) {
      const el = cardRefs.current[highlightedSourceId];
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedSourceId]);

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="sources-panel" aria-label="Retrieved Sources">
      <div className="sources-header-bar">
        <div className="sources-heading">
          <BookOpen size={16} />
          <span>Retrieved Sources ({sources.length})</span>
        </div>
        {onClose && (
          <button
            className="btn-ghost"
            onClick={onClose}
            aria-label="Close sources panel"
            title="Close panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="sources-content">
        {sources.length === 0 ? (
          <div className="sources-empty-state">
            <p>Sources for an answer will appear here.</p>
          </div>
        ) : (
          sources.map((src) => {
            const isHighlighted = highlightedSourceId === src.id;
            const isExpanded = !!expandedCards[src.id];
            const scorePercent = Math.round((src.score ?? 0.8) * 100);

            return (
              <div
                key={src.id}
                ref={(el) => (cardRefs.current[src.id] = el)}
                id={`source-card-${src.id}`}
                className={`source-card ${isHighlighted ? 'highlighted' : ''}`}
              >
                <div className="source-card-header">
                  <div className="source-title-meta">
                    <FileText size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span title={src.document || src.source_name || 'Document'}>
                      {src.document || src.source_name || 'Document'}
                    </span>
                    {src.page && (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                        · p. {src.page}
                      </span>
                    )}
                  </div>

                  <div className="source-relevance-meter" title={`Relevance score: ${scorePercent}%`}>
                    <div className="relevance-mini-bar">
                      <div
                        className="relevance-fill"
                        style={{ width: `${Math.min(100, Math.max(0, scorePercent))}%` }}
                      />
                    </div>
                    <span>{scorePercent}%</span>
                  </div>
                </div>

                <div className={`source-chunk-text ${isExpanded ? '' : 'clamped'}`}>
                  {src.text || src.chunk_text || ''}
                </div>

                <button
                  className="btn-toggle-expand"
                  onClick={() => toggleExpand(src.id)}
                  aria-label={isExpanded ? 'Show less text' : 'Show more text'}
                >
                  {isExpanded ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      Show less <ChevronUp size={12} />
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      Show more <ChevronDown size={12} />
                    </span>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
