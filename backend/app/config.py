import os
from pathlib import Path
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # Server Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True

    # Ollama Service Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    LLM_MODEL: str = "llama2"
    EMBEDDING_MODEL: str = "nomic-embed-text"

    # ChromaDB Configuration
    CHROMA_PERSIST_DIRECTORY: str = "./data/chroma"
    CHROMA_COLLECTION_NAME: str = "rag_knowledge_base"

    # Document Ingestion & Chunking
    UPLOAD_DIRECTORY: str = "./data/uploads"
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    MAX_FILE_SIZE_MB: int = 15
    ALLOWED_EXTENSIONS: str = "pdf,txt,docx"

    # Retrieval Configuration
    TOP_K_RESULTS: int = 4
    SIMILARITY_THRESHOLD: float = 0.35

    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Convert comma-separated CORS origins to a trimmed list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_extensions_list(self) -> List[str]:
        """Convert comma-separated allowed extensions into a list with leading dot."""
        exts = []
        for item in self.ALLOWED_EXTENSIONS.split(","):
            cleaned = item.strip().lower()
            if cleaned:
                if not cleaned.startswith("."):
                    cleaned = f".{cleaned}"
                exts.append(cleaned)
        return exts

    @property
    def max_file_size_bytes(self) -> int:
        """Return maximum file size converted to bytes."""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def resolved_upload_dir(self) -> Path:
        """Absolute path to uploads directory, automatically resolved."""
        base_dir = Path(__file__).parent.parent
        upload_path = (base_dir / self.UPLOAD_DIRECTORY).resolve()
        upload_path.mkdir(parents=True, exist_ok=True)
        return upload_path

    @property
    def resolved_chroma_dir(self) -> Path:
        """Absolute path to ChromaDB persist directory, automatically resolved."""
        base_dir = Path(__file__).parent.parent
        chroma_path = (base_dir / self.CHROMA_PERSIST_DIRECTORY).resolve()
        chroma_path.mkdir(parents=True, exist_ok=True)
        return chroma_path


@lru_cache()
def get_settings() -> Settings:
    """Return cached Settings singleton instance."""
    return Settings()
