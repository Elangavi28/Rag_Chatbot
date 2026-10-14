import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { apiService } from './services/api';
import DocumentRail from './components/DocumentRail';
import ChatWindow from './components/ChatWindow';
import SourcesPanel from './components/SourcesPanel';

export default function App() {
  // Theme state: defaults to 'light', remembers choice, respects prefers-color-scheme
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('nexusrag_theme');
    if (saved) return saved;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexusrag_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Infrastructure Health States
  const [backendOnline, setBackendOnline] = useState(false);
  const [ollamaHealth, setOllamaHealth] = useState({
    connected: false,
    llm: 'llama2',
    embed: 'nomic-embed-text',
  });

  // Library & Documents States
  const [documents, setDocuments] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  // Chat States
  const [conversationTitle, setConversationTitle] = useState('Research Workspace');
  const [messages, setMessages] = useState([]);
  const [composerInput, setComposerInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState([]);
  const [activeSources, setActiveSources] = useState([]);
  const [highlightedSourceId, setHighlightedSourceId] = useState(null);

  // UI Panels & Drawers
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [dragOverlayActive, setDragOverlayActive] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Refs
  const abortControllerRef = useRef(null);
  const searchInputRef = useRef(null);
  const composerRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Toast notification helper
  const addToast = (type, message, action = null) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Health and document fetching
  const refreshDocuments = async () => {
    try {
      const data = await apiService.listDocuments();
      const docs = data.documents || [];
      setDocuments(docs);
      setTotalChunks(data.total_chunks || 0);
      // Default: select all documents
      setSelectedDocIds((prev) => {
        if (prev.length === 0) return docs.map((d) => d.document_id);
        // keep only docs that still exist
        const valid = prev.filter((id) => docs.some((d) => d.document_id === id));
        return valid.length > 0 ? valid : docs.map((d) => d.document_id);
      });
    } catch (err) {
      console.error('Failed to list documents:', err);
    }
  };

  const checkHealth = async () => {
    try {
      const health = await apiService.getHealth();
      setBackendOnline(health.status === 'healthy');
    } catch {
      setBackendOnline(false);
    }

    try {
      const ollama = await apiService.getOllamaHealth();
      setOllamaHealth({
        connected: ollama.connected && ollama.llm_installed && ollama.embedding_installed,
        llm: ollama.llm_model || 'llama2',
        embed: ollama.embedding_model || 'nomic-embed-text',
      });
    } catch {
      setOllamaHealth({ connected: false, llm: 'llama2', embed: 'nomic-embed-text' });
    }
  };

  useEffect(() => {
    checkHealth();
    refreshDocuments();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // '/' focuses composer (if not in another input)
      if (
        e.key === '/' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        composerRef.current?.focus();
      }

      // 'Ctrl+K' or 'Cmd+K' focuses document search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // 'Esc' closes drawers and clears active source highlight
      if (e.key === 'Escape') {
        setMobileLibraryOpen(false);
        setHighlightedSourceId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Document scoping toggles
  const handleToggleDoc = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAllDocs = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.document_id));
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await apiService.deleteDocument(docId);
      addToast('success', 'Document deleted successfully');
      refreshDocuments();
    } catch (err) {
      addToast('error', `Failed to delete: ${err.message}`);
    }
  };

  // Upload handler with staged ingest progress
  const handleUploadFiles = async (files) => {
    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
    const validExtensions = ['.pdf', '.txt'];

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!validExtensions.includes(ext)) {
        addToast('error', `Unsupported file type: ${file.name}. Only PDF and TXT allowed.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        addToast('error', `File too large: ${file.name} exceeds 15 MB limit.`);
        continue;
      }

      const fileId = `${Date.now()}-${file.name}`;
      setUploadingFiles((prev) => [
        ...prev,
        { id: fileId, name: file.name, stage: 'Uploading', progress: 20 },
      ]);

      // Stage progression simulation while backend processes
      const t1 = setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.map((item) => (item.id === fileId ? { ...item, stage: 'Parsing', progress: 45 } : item))
        );
      }, 700);

      const t2 = setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.map((item) => (item.id === fileId ? { ...item, stage: 'Chunking', progress: 70 } : item))
        );
      }, 1600);

      const t3 = setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.map((item) => (item.id === fileId ? { ...item, stage: 'Embedding', progress: 90 } : item))
        );
      }, 2600);

      try {
        const res = await apiService.uploadDocument(file);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);

        setUploadingFiles((prev) =>
          prev.map((item) => (item.id === fileId ? { ...item, stage: 'Ready', progress: 100 } : item))
        );

        addToast(
          'success',
          `${res.filename || file.name} added, ${res.chunk_count || 0} chunks indexed`
        );

        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((item) => item.id !== fileId));
        }, 1200);

        refreshDocuments();
      } catch (err) {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileId ? { ...item, stage: 'Error', progress: 100 } : item
          )
        );

        addToast('error', `Failed to ingest ${file.name}: ${err.message}`, {
          label: 'Retry',
          onClick: () => handleUploadFiles([file]),
        });

        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((item) => item.id !== fileId));
        }, 3000);
      }
    }
  };

  // Drag and Drop Full Window Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOverlayActive(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOverlayActive(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragOverlayActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
    }
  };

  // Core Chat Execution (Streaming with fallback)
  const executeChatQuery = async (question, historyPayload, newMessagesList) => {
    const startTime = Date.now();
    setIsGenerating(true);
    setStreamingContent('');
    setStreamingSources([]);

    const scopedDocs = selectedDocIds.length > 0 ? selectedDocIds : null;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedAnswer = '';
    let retrievedSources = [];

    await apiService.streamChat({
      question,
      history: historyPayload,
      documentIds: scopedDocs,
      signal: controller.signal,
      onSources: (sources) => {
        retrievedSources = sources || [];
        setStreamingSources(retrievedSources);
        setActiveSources(retrievedSources);
        if (retrievedSources.length > 0 && !sourcesOpen) {
          setSourcesOpen(true);
        }
      },
      onToken: (token) => {
        accumulatedAnswer += token;
        setStreamingContent(accumulatedAnswer);
      },
      onDone: (data) => {
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
        setIsGenerating(false);
        setStreamingContent('');
        setStreamingSources([]);
        abortControllerRef.current = null;

        if (data?.aborted) {
          if (accumulatedAnswer) {
            setMessages([
              ...newMessagesList,
              {
                role: 'assistant',
                content: `${accumulatedAnswer}\n\n*(Generation stopped by user)*`,
                sources: retrievedSources,
                durationSeconds: durationSec,
                model: ollamaHealth.llm,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          }
          return;
        }

        const finalAnswer = data?.answer || accumulatedAnswer;
        const finalSources = data?.sources || retrievedSources;

        const assistantMsg = {
          role: 'assistant',
          content: finalAnswer,
          sources: finalSources,
          durationSeconds: data?.duration_seconds || durationSec,
          model: data?.model || ollamaHealth.llm,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages([...newMessagesList, assistantMsg]);
        setActiveSources(finalSources);
      },
      onError: (err) => {
        setIsGenerating(false);
        setStreamingContent('');
        setStreamingSources([]);
        abortControllerRef.current = null;

        addToast('error', `Generation failed: ${err.message}`);
        const errorMsg = {
          role: 'assistant',
          content: `Unable to complete response: ${err.message}`,
          sources: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([...newMessagesList, errorMsg]);
      },
    });
  };

  // 1. Regular Send
  const handleSendMessage = async (textToSend) => {
    const question = textToSend?.trim() || composerInput.trim();
    if (!question || isGenerating) return;

    if (documents.length === 0) {
      addToast('error', 'Please upload at least one document before asking questions.');
      return;
    }

    setComposerInput('');

    // Update conversation title from first question if untouched
    if (messages.length === 0 && conversationTitle === 'Research Workspace') {
      const cleanTitle = question.slice(0, 32).trim();
      setConversationTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
    }

    const userMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    executeChatQuery(question, historyPayload, newMessages);
  };

  // 2. Inline Edit & Re-search (Modifies older question in-place, replaces following response)
  const handleEditSubmit = (messageIndex, newQuestion) => {
    const trimmed = newQuestion.trim();
    if (!trimmed || isGenerating) return;

    // Messages prior to this question form the history context
    const precedingMessages = messages.slice(0, messageIndex);
    const historyPayload = precedingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // If editing the first question, update title as well
    if (messageIndex === 0) {
      const cleanTitle = trimmed.slice(0, 32).trim();
      setConversationTitle(cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
    }

    const updatedUserMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...precedingMessages, updatedUserMessage];
    setMessages(newMessages);

    executeChatQuery(trimmed, historyPayload, newMessages);
  };

  // 3. Regenerate
  const handleRegenerateMessage = (index) => {
    if (isGenerating) return;
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const questionToRegen = messages[i].content;
        const precedingMessages = messages.slice(0, i);
        const historyPayload = precedingMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const newMessages = [...precedingMessages, messages[i]];
        setMessages(newMessages);
        executeChatQuery(questionToRegen, historyPayload, newMessages);
        break;
      }
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setActiveSources([]);
    setHighlightedSourceId(null);
    setConversationTitle('Research Workspace');
    setComposerInput('');
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (window.confirm('Clear all messages in the current conversation?')) {
      setMessages([]);
      setActiveSources([]);
      setHighlightedSourceId(null);
    }
  };

  const handleSelectCitation = (citationId) => {
    setHighlightedSourceId(citationId);
    setSourcesOpen(true);
  };

  const handleViewSources = (sources) => {
    setActiveSources(sources || []);
    setSourcesOpen(true);
  };

  const handleToggleLibrary = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobileLibraryOpen((prev) => !prev);
    } else {
      setLibraryOpen((prev) => !prev);
    }
  };

  return (
    <div
      className="nexus-app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full Window Drag-and-Drop Overlay */}
      {dragOverlayActive && (
        <div className="drop-overlay">
          <UploadCloud size={48} />
          <div>Drop PDF or TXT to add to NexusRAG</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 400, opacity: 0.85 }}>
            Up to 15 MB per file
          </div>
        </div>
      )}

      {/* Pane 1: Left Rail (Library) */}
      <DocumentRail
        documents={documents}
        totalChunks={totalChunks}
        selectedDocIds={selectedDocIds}
        onToggleDoc={handleToggleDoc}
        onSelectAllDocs={handleSelectAllDocs}
        onDeleteDoc={handleDeleteDoc}
        onUploadFiles={handleUploadFiles}
        uploadingFiles={uploadingFiles}
        backendOnline={backendOnline}
        ollamaHealth={ollamaHealth}
        searchInputRef={searchInputRef}
        isOpenMobile={mobileLibraryOpen}
        onCloseMobile={() => setMobileLibraryOpen(false)}
        isCollapsed={!libraryOpen}
        onToggleCollapse={() => setLibraryOpen(false)}
      />

      {/* Pane 2: Center Chat Workspace */}
      <ChatWindow
        messages={messages}
        conversationTitle={conversationTitle}
        setConversationTitle={setConversationTitle}
        onNewChat={handleNewChat}
        onClearChat={handleClearChat}
        theme={theme}
        onToggleTheme={toggleTheme}
        modelName={ollamaHealth.llm}
        sourcesOpen={sourcesOpen}
        onToggleSources={() => setSourcesOpen(!sourcesOpen)}
        libraryOpen={libraryOpen}
        onToggleLibrary={handleToggleLibrary}
        isGenerating={isGenerating}
        streamingContent={streamingContent}
        streamingSources={streamingSources}
        onStopGenerating={handleStopGenerating}
        onSendMessage={handleSendMessage}
        onEditSubmit={handleEditSubmit}
        onRegenerateMessage={handleRegenerateMessage}
        onSelectCitation={handleSelectCitation}
        onViewSources={handleViewSources}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleDoc={handleToggleDoc}
        onSelectAllDocs={handleSelectAllDocs}
        onTriggerUpload={() => {
          // Open file selector
          const input = document.querySelector('.library-footer input[type="file"]');
          input?.click();
        }}
        composerInput={composerInput}
        setComposerInput={setComposerInput}
        composerRef={composerRef}
      />

      {/* Pane 3: Right Collapsible Sources Panel */}
      <SourcesPanel
        sources={activeSources}
        isOpen={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        highlightedSourceId={highlightedSourceId}
      />

      {/* Toast Notification Stack */}
      <div className="toast-container" aria-live="assertive">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? (
              <CheckCircle size={15} style={{ color: 'var(--status-green)', flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={15} style={{ color: 'var(--status-red)', flexShrink: 0 }} />
            )}
            <span style={{ flex: 1 }}>{toast.message}</span>
            {toast.action && (
              <button
                className="btn-edit-resend"
                onClick={toast.action.onClick}
                style={{ marginLeft: 8 }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              className="btn-ghost"
              style={{ padding: 2 }}
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss toast"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
