from typing import List, Tuple, Optional
from langchain_core.documents import Document
from app.config import get_settings
from app.services.vector_store import get_vector_store_service
from app.schemas.chat import SourceReference


class RetrievalService:
    """Handles semantic search and extraction of supporting source references."""

    def __init__(self):
        self.vector_store_service = get_vector_store_service()
        self.settings = get_settings()

    def retrieve_relevant_chunks(
        self,
        query: str,
        top_k: Optional[int] = None,
        filter_doc_ids: Optional[List[str]] = None,
    ) -> Tuple[List[Document], List[SourceReference]]:
        """
        Retrieves top-k relevant chunks from ChromaDB for the query.
        Returns a tuple of (List of Document objects, List of SourceReference objects).
        """
        k = top_k or self.settings.TOP_K_RESULTS
        search_results = self.vector_store_service.search_similar(
            query=query,
            k=k,
            filter_doc_ids=filter_doc_ids,
        )

        documents: List[Document] = []
        sources: List[SourceReference] = []

        for idx, (doc, distance) in enumerate(search_results, start=1):
            # In Chroma with cosine space: distance in [0, 2]
            # Convert to normalized similarity score [0.0, 1.0]: 1 - (distance / 2)
            similarity = round(max(0.0, min(1.0, 1.0 - (distance / 2.0))), 3)

            documents.append(doc)

            full_text = doc.page_content.strip()
            # Excerpt snippet: first 300 characters of chunk
            excerpt = full_text
            if len(excerpt) > 300:
                excerpt = excerpt[:297] + "..."

            doc_name = str(doc.metadata.get("document_name", "Unknown"))
            page_num = doc.metadata.get("page_number")

            sources.append(
                SourceReference(
                    id=idx,
                    document_id=str(doc.metadata.get("document_id", "")),
                    document_name=doc_name,
                    document=doc_name,
                    page_number=page_num,
                    page=page_num,
                    chunk_id=str(doc.metadata.get("chunk_id", "")),
                    excerpt=excerpt,
                    text=full_text,
                    relevance_score=similarity,
                    score=similarity,
                )
            )

        return documents, sources


def get_retrieval_service() -> RetrievalService:
    """Returns RetrievalService instance."""
    return RetrievalService()
