import React, { useRef, useEffect, useState } from 'react';
import {
  Menu,
  Sun,
  Moon,
  PlusCircle,
  Trash2,
  BookOpen,
  ArrowRight,
  Upload,
} from 'lucide-react';
import ChatMessage from './ChatMessage';
import Composer from './Composer';

export default function ChatWindow({
  messages,
  conversationTitle,
  setConversationTitle,
  onNewChat,
  onClearChat,
  theme,
  onToggleTheme,
  modelName = 'llama2',
  sourcesOpen,
  onToggleSources,
  libraryOpen,
  onToggleLibrary,
  isGenerating,
  streamingContent,
  streamingSources,
  onStopGenerating,
  onSendMessage,
  onEditSubmit,
  onRegenerateMessage,
  onSelectCitation,
  onViewSources,
  documents = [],
  selectedDocIds = [],
  onToggleDoc,
  onSelectAllDocs,
  onTriggerUpload,
  composerInput,
  setComposerInput,
  composerRef,
}) {
  const messagesEndRef = useRef(null);

  // Auto-scroll on new message or streaming token
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isGenerating]);

  // Generate 3 contextual prompt suggestions
  const getSuggestions = () => {
    if (documents.length === 0) return [];
    const doc1 = documents[0]?.filename?.replace(/\.[^/.]+$/, '') || 'document';
    const doc2 = documents[1]?.filename?.replace(/\.[^/.]+$/, '') || null;

    const list = [
      `Summarize the key takeaways and conclusions from ${doc1}`,
      doc2
        ? `What are the core differences or connections between ${doc1} and ${doc2}?`
        : `What are the most important concepts and methodologies discussed in ${doc1}?`,
      `Extract any action items, technical specifications, or notable citations from the text.`,
    ];
    return list;
  };

  const suggestions = getSuggestions();

  return (
    <main className="chat-workspace">
      {/* Slim Top Bar */}
      <header className="chat-top-bar">
        <div className="top-bar-left">
          {onToggleLibrary && (
            <button
              className={`btn-ghost ${!libraryOpen ? 'active' : ''}`}
              onClick={onToggleLibrary}
              aria-label={libraryOpen ? 'Collapse library' : 'Expand library'}
              title={libraryOpen ? 'Collapse library rail' : 'Expand library rail'}
            >
              <Menu size={16} />
            </button>
          )}

          <input
            type="text"
            className="chat-title-input"
            value={conversationTitle}
            onChange={(e) => setConversationTitle(e.target.value)}
            aria-label="Conversation title"
            title="Edit conversation title"
          />

          <span className="model-badge" title="Active local LLM">
            {modelName}
          </span>
        </div>

        <div className="top-bar-actions">
          <button
            className="btn-ghost"
            onClick={onNewChat}
            aria-label="New chat session"
            title="Start new conversation"
          >
            <PlusCircle size={15} />
            <span>New chat</span>
          </button>

          <button
            className="btn-ghost"
            onClick={onClearChat}
            aria-label="Clear chat history"
            title="Clear current messages"
          >
            <Trash2 size={15} />
            <span>Clear</span>
          </button>

          <button
            className="btn-ghost"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <button
            className={`btn-ghost ${sourcesOpen ? 'active' : ''}`}
            onClick={onToggleSources}
            aria-label="Toggle retrieved sources panel"
            title="Toggle sources side panel"
          >
            <BookOpen size={15} />
            <span>Sources</span>
          </button>
        </div>
      </header>

      {/* Message Thread Scroll Container */}
      <div className="chat-thread">
        <div className="chat-thread-inner">
          {/* Empty State Welcome Card */}
          {messages.length === 0 && !isGenerating && (
            <div className="welcome-card">
              <h2 className="welcome-title">Ask anything about your documents</h2>
              <p className="welcome-subtitle">
                Synthesize findings, verify citations, and explore research grounded in your local vector library.
              </p>

              {documents.length === 0 ? (
                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn-upload-trigger"
                    style={{ margin: '0 auto', maxWidth: '240px' }}
                    onClick={onTriggerUpload}
                  >
                    <Upload size={14} />
                    <span>Upload your first document</span>
                  </button>
                </div>
              ) : (
                <div className="suggestions-list">
                  {suggestions.map((promptText, idx) => (
                    <div
                      key={idx}
                      className="suggestion-card"
                      onClick={() => onSendMessage(promptText)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && onSendMessage(promptText)}
                    >
                      <span>{promptText}</span>
                      <ArrowRight size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past Chat Messages */}
          {messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              index={idx}
              message={msg}
              onEditSubmit={onEditSubmit}
              onRegenerateMessage={onRegenerateMessage}
              onSelectCitation={onSelectCitation}
              onViewSources={onViewSources}
            />
          ))}

          {/* Active Generating / Streaming State */}
          {isGenerating && (
            <div className="message-entry assistant" aria-live="polite">
              {streamingContent ? (
                // Streaming token-by-token
                <div className="assistant-block">
                  <ChatMessage
                    message={{
                      role: 'assistant',
                      content: streamingContent,
                      sources: streamingSources,
                      timestamp: 'Generating...',
                      model: modelName,
                    }}
                    onSelectCitation={onSelectCitation}
                    onViewSources={onViewSources}
                  />
                </div>
              ) : (
                // Step Indicator & Skeleton Loading State
                <div className="generating-state-card">
                  <div className="thought-steps">
                    <span className="pulse-spinner" />
                    <span>Searching documents → Reading passages → Writing answer</span>
                  </div>
                  <div className="skeleton-lines">
                    <div className="skeleton-line" style={{ width: '85%' }} />
                    <div className="skeleton-line" style={{ width: '95%' }} />
                    <div className="skeleton-line" style={{ width: '70%' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} style={{ height: 1 }} />
        </div>
      </div>

      {/* Sticky Bottom Composer */}
      <Composer
        input={composerInput}
        setInput={setComposerInput}
        onSend={() => onSendMessage(composerInput)}
        onStop={onStopGenerating}
        isGenerating={isGenerating}
        documents={documents}
        selectedDocIds={selectedDocIds}
        onToggleDoc={onToggleDoc}
        onSelectAllDocs={onSelectAllDocs}
        textareaRef={composerRef}
      />
    </main>
  );
}
