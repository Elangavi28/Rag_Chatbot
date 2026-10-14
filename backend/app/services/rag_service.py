import time
from typing import List
from app.config import get_settings
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessage, SourceReference
from app.services.retrieval_service import get_retrieval_service
from app.services.ollama_service import get_ollama_service
from app.services.vector_store import get_vector_store_service


class RagService:
    """Orchestrates end-to-end Retrieval-Augmented Generation pipeline."""

    def __init__(self):
        self.settings = get_settings()
        self.retrieval_service = get_retrieval_service()
        self.ollama_service = get_ollama_service()
        self.vector_store_service = get_vector_store_service()

    def format_context(self, docs) -> str:
        """Formats retrieved document chunks into numbered context blocks."""
        context_blocks = []
        for i, doc in enumerate(docs, start=1):
            doc_name = doc.metadata.get("document_name", "Unknown Document")
            page_num = doc.metadata.get("page_number")
            page_info = f", Page {page_num}" if page_num else ""
            header = f"[Source {i}: {doc_name}{page_info}]"
            context_blocks.append(f"{header}\n{doc.page_content.strip()}")
        return "\n\n".join(context_blocks)

    def format_history(self, history: List[ChatMessage]) -> str:
        """Formats the last few conversation turns."""
        if not history:
            return "No previous conversation."
        # Keep at most last 4 messages to avoid distracting context window
        recent = history[-4:]
        formatted = []
        for msg in recent:
            role_label = "User" if msg.role.lower() == "user" else "Assistant"
            formatted.append(f"{role_label}: {msg.content.strip()}")
        return "\n".join(formatted)

    def generate_answer(self, request: ChatRequest) -> ChatResponse:
        """
        Executes complete RAG pipeline:
        1. Checks vector database status
        2. Retrieves top-k matching chunks
        3. Constructs prompt
        4. Invokes Llama 2 model
        5. Returns structured response with verified sources
        """
        start_time = time.time()
        question = request.question.strip()

        # Check if vector collection has any documents
        total_indexed_chunks = self.vector_store_service.collection.count()
        if total_indexed_chunks == 0:
            return ChatResponse(
                question=question,
                answer=(
                    "No documents have been uploaded yet. Please upload a PDF or TXT file "
                    "using the document panel to ask questions based on your files."
                ),
                sources=[],
                model=self.settings.LLM_MODEL,
                duration_seconds=round(time.time() - start_time, 2),
            )

        # Retrieve relevant chunks
        docs, sources = self.retrieval_service.retrieve_relevant_chunks(
            query=question,
            top_k=self.settings.TOP_K_RESULTS,
            filter_doc_ids=request.document_ids,
        )

        if not docs:
            return ChatResponse(
                question=question,
                answer="I could not find any relevant information in the uploaded documents to answer your question.",
                sources=[],
                model=self.settings.LLM_MODEL,
                duration_seconds=round(time.time() - start_time, 2),
                duration_ms=int((time.time() - start_time) * 1000),
            )

        context_text = self.format_context(docs)
        history_text = self.format_history(request.history)

        prompt = f"""[INST] <<SYS>>
Answer directly. Do not restate the question or mention 'the provided context'. Cite sources as [1], [2]. If the answer is not in the documents, say so.
<</SYS>>

Context:
{context_text}

Conversation History:
{history_text}

Question:
{question}

Answer:[/INST]"""

        # Generate response from Llama 2 via Ollama
        answer = self.ollama_service.generate_response(prompt)
        duration = round(time.time() - start_time, 2)

        return ChatResponse(
            question=question,
            answer=answer,
            sources=sources,
            model=self.settings.LLM_MODEL,
            duration_seconds=duration,
            duration_ms=int(duration * 1000),
        )

    def stream_answer(self, request: ChatRequest):
        """
        Streams RAG response tokens via JSON lines / SSE for real-time frontend rendering.
        """
        import json
        start_time = time.time()
        question = request.question.strip()

        total_indexed_chunks = self.vector_store_service.collection.count()
        if total_indexed_chunks == 0:
            yield json.dumps({
                "type": "error",
                "message": "No documents uploaded yet. Please upload a PDF or TXT file to begin."
            }) + "\n"
            return

        # Retrieve relevant chunks
        docs, sources = self.retrieval_service.retrieve_relevant_chunks(
            query=question,
            top_k=self.settings.TOP_K_RESULTS,
            filter_doc_ids=request.document_ids,
        )

        # Emit sources first so the frontend can immediately mount the Sources panel!
        yield json.dumps({
            "type": "sources",
            "sources": [s.model_dump() for s in sources]
        }) + "\n"

        if not docs:
            yield json.dumps({
                "type": "token",
                "token": "I could not find any relevant information in the uploaded documents to answer your question."
            }) + "\n"
            duration = round(time.time() - start_time, 2)
            yield json.dumps({
                "type": "done",
                "duration_seconds": duration,
                "duration_ms": int(duration * 1000),
                "model": self.settings.LLM_MODEL
            }) + "\n"
            return

        context_text = self.format_context(docs)
        history_text = self.format_history(request.history)

        prompt = f"""[INST] <<SYS>>
Answer directly. Do not restate the question or mention 'the provided context'. Cite sources as [1], [2]. If the answer is not in the documents, say so.
<</SYS>>

Context:
{context_text}

Conversation History:
{history_text}

Question:
{question}

Answer:[/INST]"""

        # Stream tokens from Ollama LLM
        try:
            for chunk in self.ollama_service.llm.stream(prompt):
                if chunk:
                    yield json.dumps({"type": "token", "token": chunk}) + "\n"
        except Exception as e:
            logger.error(f"Error during Ollama LLM stream: {e}")
            yield json.dumps({
                "type": "error",
                "message": f"LLM error: {str(e)}"
            }) + "\n"
            return

        duration = round(time.time() - start_time, 2)
        yield json.dumps({
            "type": "done",
            "duration_seconds": duration,
            "duration_ms": int(duration * 1000),
            "model": self.settings.LLM_MODEL
        }) + "\n"


def get_rag_service() -> RagService:
    """Returns RagService instance."""
    return RagService()
