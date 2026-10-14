import os
import re
import hashlib
from pathlib import Path
from fastapi import UploadFile, HTTPException, status
from app.config import get_settings


def sanitize_filename(filename: str) -> str:
    """
    Remove potentially dangerous characters and path traversal components
    from the filename, preserving standard characters and extensions.
    """
    clean_name = os.path.basename(filename)
    # Replace non-alphanumeric (except dots, dashes, underscores) with underscore
    clean_name = re.sub(r"[^\w\.\-]", "_", clean_name)
    return clean_name or "uploaded_document"


async def validate_uploaded_file(file: UploadFile) -> bytes:
    """
    Validates uploaded file against allowed extensions, empty content, and size limits.
    Returns the file content bytes if valid.
    """
    settings = get_settings()

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a valid filename.",
        )

    clean_name = sanitize_filename(file.filename)
    file_ext = Path(clean_name).suffix.lower()

    if file_ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type: '{file_ext}'. Allowed types: "
                f"{', '.join(settings.allowed_extensions_list)}"
            ),
        )

    # Read content to check size and non-empty status
    content = await file.read()
    if not content or len(content.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty (0 bytes).",
        )

    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File size exceeds the limit of {settings.MAX_FILE_SIZE_MB}MB. "
                f"Uploaded file size is {len(content) / (1024 * 1024):.2f}MB."
            ),
        )

    return content


def generate_document_id(filename: str, content: bytes) -> str:
    """
    Generates a deterministic unique document identifier based on content hash and name.
    """
    hasher = hashlib.sha256()
    hasher.update(filename.encode("utf-8"))
    hasher.update(content)
    return hasher.hexdigest()[:16]
