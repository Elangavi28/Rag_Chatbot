import io
from pathlib import Path
from typing import List, Dict, Any, Tuple
from fastapi import HTTPException, status
from pypdf import PdfReader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.config import get_settings


class DocumentProcessor:
    """Handles text extraction and chunking for various document formats."""

    def __init__(self):
        settings = get_settings()
        self.chunk_size = settings.CHUNK_SIZE
        self.chunk_overlap = settings.CHUNK_OVERLAP

        # Text splitter preserving natural paragraph/sentence breaks
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ". ", "! ", "? ", "; ", " ", ""],
            length_function=len,
        )

    def extract_text_from_pdf(self, content_bytes: bytes, filename: str) -> List[Tuple[int, str]]:
        """
        Extracts text from PDF bytes page by page.
        Returns a list of tuples: (page_number_1_indexed, page_text).
        """
        pages_content: List[Tuple[int, str]] = []
        try:
            pdf_stream = io.BytesIO(content_bytes)
            reader = PdfReader(pdf_stream)

            if len(reader.pages) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF '{filename}' contains 0 pages.",
                )

            total_extracted_chars = 0
            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                cleaned_text = page_text.strip()
                if cleaned_text:
                    pages_content.append((idx + 1, cleaned_text))
                    total_extracted_chars += len(cleaned_text)

            if total_extracted_chars == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"No extractable text found in '{filename}'. "
                        "If this is a scanned document or image-based PDF, "
                        "it requires OCR (Optical Character Recognition) to extract text."
                    ),
                )

            return pages_content
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse PDF document '{filename}': {str(e)}",
            )

    def extract_text_from_txt(self, content_bytes: bytes, filename: str) -> List[Tuple[int, str]]:
        """
        Extracts text from TXT bytes, trying UTF-8 then Latin-1.
        Returns a list with a single tuple: (1, text).
        """
        for encoding in ["utf-8", "latin-1", "cp1252"]:
            try:
                text = content_bytes.decode(encoding).strip()
                if not text:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"The text document '{filename}' is empty.",
                    )
                return [(1, text)]
            except UnicodeDecodeError:
                continue

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to decode text document '{filename}'. Unsupported text encoding.",
        )

    def extract_text(self, content_bytes: bytes, filename: str) -> List[Tuple[int, str]]:
        """Routes document extraction based on file extension."""
        ext = Path(filename).suffix.lower()
        if ext == ".pdf":
            return self.extract_text_from_pdf(content_bytes, filename)
        elif ext in [".txt", ".text"]:
            return self.extract_text_from_txt(content_bytes, filename)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported format '{ext}'. Only PDF and TXT are supported.",
            )

    def process_and_chunk(
        self,
        content_bytes: bytes,
        filename: str,
        document_id: str,
    ) -> List[Document]:
        """
        Extracts text and chunks it into LangChain Document instances
        with complete metadata including page numbers and chunk identifiers.
        """
        pages = self.extract_text(content_bytes, filename)
        ext = Path(filename).suffix.lower()
        chunked_docs: List[Document] = []

        global_chunk_idx = 0
        for page_num, page_text in pages:
            raw_chunks = self.text_splitter.split_text(page_text)
            for chunk_idx, chunk_text in enumerate(raw_chunks):
                chunk_id = f"{document_id}_p{page_num}_c{chunk_idx}"
                doc = Document(
                    page_content=chunk_text,
                    metadata={
                        "document_id": document_id,
                        "document_name": filename,
                        "page_number": page_num,
                        "chunk_id": chunk_id,
                        "chunk_index": global_chunk_idx,
                        "file_type": ext,
                    },
                )
                chunked_docs.append(doc)
                global_chunk_idx += 1

        if not chunked_docs:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No valid text chunks could be produced from '{filename}'.",
            )

        return chunked_docs
