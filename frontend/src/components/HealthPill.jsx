import React, { useState, useRef, useEffect } from 'react';
import { Activity, Server, Cpu, HardDrive } from 'lucide-react';

export default function HealthPill({ backendOnline, ollamaHealth, totalChunks }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  // Determine aggregate health state
  const isAllHealthy = backendOnline && ollamaHealth.connected;
  const isPartiallyHealthy = backendOnline && !ollamaHealth.connected;

  let dotColor = 'green';
  let pillText = 'All systems online';

  if (!backendOnline) {
    dotColor = 'red';
    pillText = 'Backend offline';
  } else if (!ollamaHealth.connected) {
    dotColor = 'amber';
    pillText = 'Ollama unavailable';
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="health-pill-wrapper" ref={popoverRef}>
      <button
        className="health-pill"
        onClick={() => setOpen(!open)}
        aria-label="System status"
        title="Click to view detailed system health"
      >
        <span className={`status-dot ${dotColor}`} />
        <span>{pillText}</span>
      </button>

      {open && (
        <div className="health-popover">
          <div className="health-popover-title">System Infrastructure</div>

          <div className="health-item">
            <span>FastAPI Server</span>
            <span className="health-item-status">
              <span className={`status-dot ${backendOnline ? 'green' : 'red'}`} />
              {backendOnline ? 'Port 8000' : 'Offline'}
            </span>
          </div>

          <div className="health-item">
            <span>ChromaDB Vector Store</span>
            <span className="health-item-status">
              <span className={`status-dot ${backendOnline ? 'green' : 'red'}`} />
              {totalChunks} vectors
            </span>
          </div>

          <div className="health-item">
            <span>Ollama Engine</span>
            <span className="health-item-status">
              <span className={`status-dot ${ollamaHealth.connected ? 'green' : 'amber'}`} />
              {ollamaHealth.connected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="health-item">
            <span>LLM Model</span>
            <span className="health-item-status" style={{ color: 'var(--text-main)' }}>
              {ollamaHealth.llm || 'llama2'}
            </span>
          </div>

          <div className="health-item">
            <span>Embedding Model</span>
            <span className="health-item-status" style={{ color: 'var(--text-main)' }}>
              {ollamaHealth.embed || 'nomic-embed-text'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
