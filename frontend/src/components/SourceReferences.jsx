import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText } from 'lucide-react';

export default function SourceReferences({ sources }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="sources-container">
      <div 
        className="sources-header" 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <BookOpen size={14} color="#818cf8" />
        <span>Grounded in {sources.length} Verified Sources</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>

      {isOpen && (
        <div className="sources-list">
          {sources.map((src, index) => {
            const matchPercent = src.relevance_score 
              ? `${Math.round(src.relevance_score * 100)}% Match` 
              : 'Relevant';

            return (
              <div key={src.chunk_id || index} className="source-item">
                <div className="source-badge">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} color="#94a3b8" />
                    <span>{src.document_name}</span>
                    {src.page_number && (
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                        (Page {src.page_number})
                      </span>
                    )}
                  </div>
                  <span className="source-score">{matchPercent}</span>
                </div>
                {src.excerpt && (
                  <div className="source-excerpt">
                    "{src.excerpt}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
