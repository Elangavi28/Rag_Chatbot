import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', margin: '12px 0' }}>
      <button
        onClick={handleCopy}
        aria-label="Copy code"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          fontSize: '0.72rem',
          padding: '3px 8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 2,
        }}
      >
        {copied ? (
          <>
            <Check size={12} style={{ color: 'var(--status-green)' }} />
            <span>Copied</span>
          </>
        ) : (
          <>
            <Copy size={12} />
            <span>Copy</span>
          </>
        )}
      </button>
      <pre style={{ margin: 0, padding: '12px 14px' }}>
        <code {...props}>{children}</code>
      </pre>
    </div>
  );
}

export default function MarkdownView({ content, onSelectCitation }) {
  // Helper to replace [1], [2], [1, 2] in text nodes with interactive citation chips
  const renderTextWithCitations = (children) => {
    if (typeof children === 'string') {
      const parts = children.split(/(\[\d+(?:,\s*\d+)*\])/g);
      return parts.map((part, index) => {
        const match = part.match(/^\[(.*)\]$/);
        if (match) {
          const ids = match[1].split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
          if (ids.length > 0) {
            return (
              <span key={index} style={{ display: 'inline-flex', gap: 2 }}>
                {ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="citation-chip"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectCitation?.(id);
                    }}
                    title={`View Source [${id}]`}
                    aria-label={`Citation [${id}]`}
                  >
                    [{id}]
                  </button>
                ))}
              </span>
            );
          }
        }
        return part;
      });
    }

    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <React.Fragment key={i}>
          {renderTextWithCitations(child)}
        </React.Fragment>
      ));
    }

    return children;
  };

  return (
    <div className="assistant-prose">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p>{renderTextWithCitations(children)}</p>,
          li: ({ children }) => <li>{renderTextWithCitations(children)}</li>,
          h1: ({ children }) => <h1>{renderTextWithCitations(children)}</h1>,
          h2: ({ children }) => <h2>{renderTextWithCitations(children)}</h2>,
          h3: ({ children }) => <h3>{renderTextWithCitations(children)}</h3>,
          strong: ({ children }) => <strong>{renderTextWithCitations(children)}</strong>,
          em: ({ children }) => <em>{renderTextWithCitations(children)}</em>,
          pre: ({ children }) => {
            // Fenced code block wrapper
            return <CodeBlock>{children.props?.children || children}</CodeBlock>;
          },
          code: ({ inline, children, ...props }) => {
            if (inline) {
              return <code>{children}</code>;
            }
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
