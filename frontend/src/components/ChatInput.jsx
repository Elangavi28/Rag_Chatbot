import React, { useState, useRef, useEffect } from 'react';
import { Send, CornerDownLeft } from 'lucide-react';

export default function ChatInput({ onSendMessage, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;

    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-area">
      <form onSubmit={handleSubmit} className="input-box-wrapper">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question grounded in your uploaded documents..."
          className="chat-textarea"
          rows={1}
          disabled={disabled}
        />
        <button
          type="submit"
          className="btn-send"
          disabled={!text.trim() || disabled}
          title="Send Question"
        >
          <Send size={18} />
        </button>
      </form>
      <div className="input-hints">
        <span>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</span>
        <span>Grounded by ChromaDB & Llama 2</span>
      </div>
    </div>
  );
}
