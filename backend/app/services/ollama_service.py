from functools import lru_cache
from typing import Dict, Any, List
import httpx
from fastapi import HTTPException, status
from langchain_ollama import OllamaLLM
from app.config import get_settings


class OllamaService:
    """Manages Ollama LLM integration, health verification, and inference."""

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model_name = settings.LLM_MODEL
        self.embedding_model_name = settings.EMBEDDING_MODEL

        # Initialize LangChain Ollama LLM
        self.llm = OllamaLLM(
            base_url=self.base_url,
            model=self.model_name,
            temperature=0.2,  # Low temperature for factual, grounded answers
        )

    async def check_health(self) -> Dict[str, Any]:
        """
        Queries Ollama API to verify connectivity and availability of both
        the generation model (Llama 2) and embedding model.
        """
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)

            if response.status_code != 200:
                return {
                    "status": "error",
                    "connected": False,
                    "error": f"Ollama returned HTTP status {response.status_code}",
                    "models_available": [],
                }

            data = response.json()
            models: List[str] = [m.get("name", "") for m in data.get("models", [])]

            # Model names might appear as "llama2:latest" or "llama2"
            has_llm = any(self.model_name in m for m in models)
            has_embed = any(self.embedding_model_name in m for m in models)

            return {
                "status": "ok" if (has_llm and has_embed) else "warning",
                "connected": True,
                "base_url": self.base_url,
                "llm_model": self.model_name,
                "llm_installed": has_llm,
                "embedding_model": self.embedding_model_name,
                "embedding_installed": has_embed,
                "installed_models": models,
            }
        except httpx.ConnectError:
            return {
                "status": "error",
                "connected": False,
                "error": f"Cannot connect to Ollama at {self.base_url}. Ensure Ollama is running (`ollama serve`).",
                "models_available": [],
            }
        except Exception as e:
            return {
                "status": "error",
                "connected": False,
                "error": f"Ollama health check failed: {str(e)}",
                "models_available": [],
            }

    def generate_response(self, prompt: str) -> str:
        """
        Invokes Llama 2 with the prompt.
        Handles runtime connection failures gracefully.
        """
        try:
            response = self.llm.invoke(prompt)
            return response.strip()
        except Exception as e:
            err_str = str(e)
            if "connection refused" in err_str.lower() or "connect" in err_str.lower():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=(
                        f"Failed to communicate with Ollama service at {self.base_url}. "
                        "Please verify Ollama is active (`ollama serve`)."
                    ),
                )
            elif "not found" in err_str.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        f"Model '{self.model_name}' not found in Ollama. "
                        f"Please pull the model: `ollama pull {self.model_name}`."
                    ),
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error generating LLM response: {err_str}",
                )


@lru_cache()
def get_ollama_service() -> OllamaService:
    """Returns singleton instance of OllamaService."""
    return OllamaService()
