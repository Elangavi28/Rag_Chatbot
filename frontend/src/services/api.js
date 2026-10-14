const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function handleResponse(response) {
  if (!response.ok) {
    let errorDetail = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.detail) {
        errorDetail = errorJson.detail;
      } else if (errorJson.message) {
        errorDetail = errorJson.message;
      }
    } catch {
      // Non-JSON response fallback
    }
    throw new Error(errorDetail);
  }
  return await response.json();
}

export const apiService = {
  async getHealth() {
    const res = await fetch(`${API_BASE_URL}/health`);
    return handleResponse(res);
  },

  async getOllamaHealth() {
    const res = await fetch(`${API_BASE_URL}/health/ollama`);
    return handleResponse(res);
  },

  async listDocuments() {
    const res = await fetch(`${API_BASE_URL}/documents`);
    return handleResponse(res);
  },

  async uploadDocument(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  async deleteDocument(documentId) {
    const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },

  async sendChat(question, history = [], documentIds = null) {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history, document_ids: documentIds }),
    });
    return handleResponse(res);
  },

  /**
   * Real-time streaming generator with AbortController signal
   */
  async streamChat({
    question,
    history = [],
    documentIds = null,
    onSources,
    onToken,
    onDone,
    onError,
    signal,
  }) {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, document_ids: documentIds }),
        signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'sources' && onSources) {
              onSources(data.sources);
            } else if (data.type === 'token' && onToken) {
              onToken(data.token);
            } else if (data.type === 'done' && onDone) {
              onDone(data);
            } else if (data.type === 'error' && onError) {
              onError(new Error(data.message));
            }
          } catch {
            // Partial JSON ignore
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (onDone) onDone({ aborted: true });
      } else if (onError) {
        onError(err);
      }
    }
  },
};
