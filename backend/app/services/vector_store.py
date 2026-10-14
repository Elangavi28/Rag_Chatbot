import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from functools import lru_cache
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from fastapi import HTTPException, status
from app.config import get_settings
from app.services.embedding_service import get_embedding_service
from app.schemas.document import DocumentInfo, DocumentListResponse


class VectorStoreService:
    """Manages persistent ChromaDB vector store, document chunk indexing, and deletion."""

    def __init__(self):
        settings = get_settings()
        self.persist_dir = str(settings.resolved_chroma_dir)
        self.collection_name = settings.CHROMA_COLLECTION_NAME
        self.embedding_service = get_embedding_service()

        # Initialize persistent ChromaDB client
        self.chroma_client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

        # Initialize LangChain Chroma integration with persistent client
        self.vector_store = Chroma(
            client=self.chroma_client,
            collection_name=self.collection_name,
            embedding_function=self.embedding_service.embeddings,
        )

        # Ensure collection exists
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def is_document_indexed(self, document_id: str) -> bool:
        """Check if any chunks with this document_id already exist."""
        result = self.collection.get(
            where={"document_id": document_id},
            limit=1,
            include=["metadatas"],
        )
        return bool(result and result.get("ids"))

    def get_document_by_name(self, filename: str) -> Optional[str]:
        """Check if any document with this filename exists. Returns document_id if found."""
        result = self.collection.get(
            where={"document_name": filename},
            limit=1,
            include=["metadatas"],
        )
        if result and result.get("metadatas"):
            return result["metadatas"][0].get("document_id")
        return None

    def add_documents(
        self,
        documents: List[Document],
        document_id: str,
        filename: str,
        file_size_bytes: int,
        uploaded_at: str,
    ) -> int:
        """
        Embeds and stores document chunks with complete metadata in ChromaDB.
        """
        if not documents:
            return 0

        # Inject consistent document-level metadata into all chunk metadata
        ids = []
        for doc in documents:
            doc.metadata["document_id"] = document_id
            doc.metadata["document_name"] = filename
            doc.metadata["file_size_bytes"] = file_size_bytes
            doc.metadata["uploaded_at"] = uploaded_at
            # Use deterministic chunk id
            chunk_id = doc.metadata.get("chunk_id") or f"{document_id}_{len(ids)}"
            ids.append(chunk_id)

        # Add to vector store
        self.vector_store.add_documents(documents=documents, ids=ids)
        return len(documents)

    def list_documents(self) -> DocumentListResponse:
        """
        Retrieves all indexed documents aggregated from chunk metadata.
        """
        result = self.collection.get(include=["metadatas"])
        metadatas = result.get("metadatas") or []

        # Aggregate chunks by document_id
        docs_map: Dict[str, Dict[str, Any]] = {}
        for meta in metadatas:
            if not meta:
                continue
            doc_id = meta.get("document_id")
            if not doc_id:
                continue

            if doc_id not in docs_map:
                docs_map[doc_id] = {
                    "document_id": doc_id,
                    "filename": meta.get("document_name", "Unknown"),
                    "file_type": meta.get("file_type", ".txt"),
                    "file_size_bytes": meta.get("file_size_bytes", 0),
                    "chunk_count": 0,
                    "uploaded_at": meta.get("uploaded_at", ""),
                }
            docs_map[doc_id]["chunk_count"] += 1

        doc_list = [DocumentInfo(**info) for info in docs_map.values()]
        # Sort documents by uploaded_at descending
        doc_list.sort(key=lambda d: d.uploaded_at, reverse=True)

        total_chunks = len(metadatas)
        return DocumentListResponse(
            documents=doc_list,
            total_documents=len(doc_list),
            total_chunks=total_chunks,
        )

    def delete_document(self, document_id: str) -> int:
        """
        Deletes all chunks associated with a document_id from the vector store.
        Also removes stored file from uploads folder if present.
        """
        # Fetch chunk IDs for this document
        existing = self.collection.get(
            where={"document_id": document_id},
            include=["metadatas"],
        )
        ids_to_delete = existing.get("ids") or []
        count = len(ids_to_delete)

        if count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID '{document_id}' not found in the vector database.",
            )

        # Delete by IDs from collection
        self.collection.delete(ids=ids_to_delete)

        # Attempt to delete physical file from disk if stored
        try:
            settings = get_settings()
            upload_dir = settings.resolved_upload_dir
            for file_path in upload_dir.glob(f"{document_id}_*"):
                if file_path.exists():
                    file_path.unlink()
        except Exception:
            pass

        return count

    def search_similar(
        self,
        query: str,
        k: Optional[int] = None,
        filter_doc_ids: Optional[List[str]] = None,
    ) -> List[Tuple[Document, float]]:
        """
        Performs semantic similarity search with cosine distance/score.
        Supports document scoping via filter_doc_ids.
        Returns list of (Document, score) pairs.
        """
        settings = get_settings()
        top_k = k or settings.TOP_K_RESULTS
        if self.collection.count() == 0:
            return []

        filter_dict = None
        if filter_doc_ids and len(filter_doc_ids) > 0:
            if len(filter_doc_ids) == 1:
                filter_dict = {"document_id": filter_doc_ids[0]}
            else:
                filter_dict = {"document_id": {"$in": filter_doc_ids}}

        # similarity_search_with_score returns (doc, distance)
        results = self.vector_store.similarity_search_with_score(query, k=top_k, filter=filter_dict)
        return results


@lru_cache()
def get_vector_store_service() -> VectorStoreService:
    """Returns singleton instance of VectorStoreService."""
    return VectorStoreService()
