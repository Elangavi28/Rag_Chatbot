from datetime import datetime
from fastapi import APIRouter, status
from app.config import get_settings
from app.services.ollama_service import get_ollama_service
from app.services.vector_store import get_vector_store_service

router = APIRouter(prefix="/health", tags=["Health Checks"])


@router.get("", status_code=status.HTTP_200_OK)
async def check_backend_health():
    """
    Check whether the FastAPI backend is running and operational.
    """
    settings = get_settings()
    vector_store = get_vector_store_service()
    total_chunks = vector_store.collection.count()

    return {
        "status": "healthy",
        "service": "rag-chatbot-backend",
        "timestamp": datetime.utcnow().isoformat(),
        "vector_db": {
            "status": "connected",
            "collection": settings.CHROMA_COLLECTION_NAME,
            "total_indexed_chunks": total_chunks,
        },
    }


@router.get("/ollama", status_code=status.HTTP_200_OK)
async def check_ollama_health():
    """
    Check Ollama connectivity and whether required LLM and embedding models are loaded.
    """
    ollama_service = get_ollama_service()
    health_info = await ollama_service.check_health()
    return health_info
