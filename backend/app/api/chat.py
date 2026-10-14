import asyncio
from fastapi import APIRouter, status
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.rag_service import get_rag_service

router = APIRouter(prefix="/chat", tags=["RAG Chat"])


from fastapi.responses import StreamingResponse

@router.post("", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat_with_documents(request: ChatRequest):
    """
    Query the knowledge base using Retrieval-Augmented Generation (RAG).
    Retrieves semantically relevant document chunks and synthesizes an answer via Llama 2.
    """
    rag_service = get_rag_service()
    response = await asyncio.to_thread(rag_service.generate_answer, request)
    return response


@router.post("/stream")
async def chat_with_documents_stream(request: ChatRequest):
    """
    Real-time streaming RAG endpoint.
    Emits source citations first, followed by answer tokens, and final duration metadata.
    """
    rag_service = get_rag_service()
    return StreamingResponse(
        rag_service.stream_answer(request),
        media_type="application/x-ndjson",
    )

