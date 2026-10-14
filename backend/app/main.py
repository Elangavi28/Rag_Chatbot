import sys
from pathlib import Path
from contextlib import asynccontextmanager
import logging

# Ensure backend directory is always in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.api.health import router as health_router
from app.api.documents import router as documents_router
from app.api.chat import router as chat_router
from app.services.vector_store import get_vector_store_service
from app.services.ollama_service import get_ollama_service

# Configure application logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rag_chatbot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown routines."""
    settings = get_settings()
    logger.info("Initializing RAG Chatbot Backend...")
    logger.info(f"Ollama Base URL: {settings.OLLAMA_BASE_URL}")
    logger.info(f"LLM Model: {settings.LLM_MODEL}")
    logger.info(f"Embedding Model: {settings.EMBEDDING_MODEL}")
    logger.info(f"Chroma DB Path: {settings.resolved_chroma_dir}")
    logger.info(f"Uploads Path: {settings.resolved_upload_dir}")

    # Ensure vector store connection is initialized and collection is ready
    vs = get_vector_store_service()
    total_docs = vs.collection.count()
    logger.info(f"ChromaDB initialized. Currently storing {total_docs} chunk vectors.")

    yield

    logger.info("RAG Chatbot Backend is shutting down.")


settings = get_settings()

app = FastAPI(
    title="RAG Chatbot API",
    description=(
        "Production-grade FastAPI backend for an End-to-End Retrieval-Augmented Generation (RAG) "
        "chatbot using ChromaDB, Ollama (Llama 2), and LangChain."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS for local React development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global unhandled exception handler to avoid leaking internal system paths
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error at {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred while processing your request.",
        },
    )

# Include API Routers
app.include_router(health_router)
app.include_router(documents_router)
app.include_router(chat_router)


@app.get("/", tags=["Root"])
async def root():
    """Welcome endpoint with API documentation links."""
    return {
        "message": "Welcome to the RAG Chatbot API",
        "documentation": "/docs",
        "health": "/health",
        "ollama_status": "/health/ollama",
    }
