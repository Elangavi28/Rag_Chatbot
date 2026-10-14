from functools import lru_cache
from typing import List
from langchain_ollama import OllamaEmbeddings
from app.config import get_settings


class EmbeddingService:
    """Provides Ollama embedding models for document and query vectorization."""

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.OLLAMA_BASE_URL
        self.model_name = settings.EMBEDDING_MODEL
        self._embeddings = OllamaEmbeddings(
            base_url=self.base_url,
            model=self.model_name,
        )

    @property
    def embeddings(self) -> OllamaEmbeddings:
        """Returns underlying LangChain OllamaEmbeddings instance."""
        return self._embeddings

    def embed_query(self, text: str) -> List[float]:
        """Generates embedding vector for a user query."""
        return self._embeddings.embed_query(text)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generates embedding vectors for a batch of text chunks."""
        return self._embeddings.embed_documents(texts)


@lru_cache()
def get_embedding_service() -> EmbeddingService:
    """Returns singleton instance of EmbeddingService."""
    return EmbeddingService()
