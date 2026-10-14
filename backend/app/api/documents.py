import asyncio
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.config import get_settings
from app.utils.file_validation import (
    validate_uploaded_file,
    sanitize_filename,
    generate_document_id,
)
from app.services.document_processor import DocumentProcessor
from app.services.vector_store import get_vector_store_service
from app.schemas.document import (
    DocumentUploadResponse,
    DocumentListResponse,
    DocumentDeleteResponse,
    DocumentInfo,
)

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload, validate, extract, chunk, embed, and index a PDF or TXT document into ChromaDB.
    """
    settings = get_settings()
    vector_store = get_vector_store_service()
    doc_processor = DocumentProcessor()

    # 1. Validate file format and size
    content_bytes = await validate_uploaded_file(file)
    clean_filename = sanitize_filename(file.filename or "uploaded_file")
    doc_id = generate_document_id(clean_filename, content_bytes)
    file_type = Path(clean_filename).suffix.lower()
    file_size = len(content_bytes)
    uploaded_at = datetime.utcnow().isoformat()

    # 2. Check if identical document is already indexed
    if vector_store.is_document_indexed(doc_id):
        # Already indexed - return info without re-embedding
        list_res = vector_store.list_documents()
        existing_doc = next((d for d in list_res.documents if d.document_id == doc_id), None)
        if existing_doc:
            return DocumentUploadResponse(
                message=f"Document '{clean_filename}' is already indexed in the knowledge base.",
                document=existing_doc,
            )

    # 3. Save physical file to uploads directory
    saved_path = settings.resolved_upload_dir / f"{doc_id}_{clean_filename}"
    with open(saved_path, "wb") as f:
        f.write(content_bytes)

    # 4. Extract text and generate chunks with metadata
    chunks = await asyncio.to_thread(
        doc_processor.process_and_chunk,
        content_bytes=content_bytes,
        filename=clean_filename,
        document_id=doc_id,
    )

    # 5. Embed and store chunks in ChromaDB
    stored_count = await asyncio.to_thread(
        vector_store.add_documents,
        documents=chunks,
        document_id=doc_id,
        filename=clean_filename,
        file_size_bytes=file_size,
        uploaded_at=uploaded_at,
    )

    doc_info = DocumentInfo(
        document_id=doc_id,
        filename=clean_filename,
        file_type=file_type,
        file_size_bytes=file_size,
        chunk_count=stored_count,
        uploaded_at=uploaded_at,
    )

    return DocumentUploadResponse(
        message=f"Successfully indexed '{clean_filename}' into {stored_count} vector chunks.",
        document=doc_info,
    )


@router.get("", response_model=DocumentListResponse, status_code=status.HTTP_200_OK)
async def list_documents():
    """
    Retrieve list of all indexed documents in the vector knowledge base.
    """
    vector_store = get_vector_store_service()
    return vector_store.list_documents()


@router.delete("/{document_id}", response_model=DocumentDeleteResponse, status_code=status.HTTP_200_OK)
async def delete_document(document_id: str):
    """
    Remove a document and all of its associated vector chunks from ChromaDB.
    """
    vector_store = get_vector_store_service()
    deleted_chunks = await asyncio.to_thread(vector_store.delete_document, document_id)

    return DocumentDeleteResponse(
        message=f"Document '{document_id}' and all associated chunks were successfully deleted.",
        document_id=document_id,
        deleted_chunks_count=deleted_chunks,
    )
