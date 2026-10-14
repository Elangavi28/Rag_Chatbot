from typing import List
from pydantic import BaseModel, Field


class DocumentInfo(BaseModel):
    """Metadata describing an indexed document."""
    document_id: str = Field(..., description="Unique document ID (SHA256 or UUID)")
    filename: str = Field(..., description="Original filename")
    file_type: str = Field(..., description="File extension, e.g., '.pdf', '.txt'")
    file_size_bytes: int = Field(..., description="File size in bytes")
    chunk_count: int = Field(..., description="Number of text chunks indexed for this document")
    uploaded_at: str = Field(..., description="ISO 8601 timestamp of upload")


class DocumentUploadResponse(BaseModel):
    """Response returned upon successful document ingestion."""
    message: str = Field(..., description="Human-readable success message")
    document: DocumentInfo = Field(..., description="Details of the processed document")


class DocumentListResponse(BaseModel):
    """Response returned when querying the catalog of indexed documents."""
    documents: List[DocumentInfo] = Field(default_factory=list, description="List of all indexed documents")
    total_documents: int = Field(..., description="Total count of documents")
    total_chunks: int = Field(..., description="Total number of chunks in the vector collection")


class DocumentDeleteResponse(BaseModel):
    """Response returned when a document is deleted."""
    message: str = Field(..., description="Confirmation message")
    document_id: str = Field(..., description="ID of the deleted document")
    deleted_chunks_count: int = Field(..., description="Number of vector records deleted")
