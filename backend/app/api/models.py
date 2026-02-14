from fastapi import APIRouter, Depends, HTTPException
import httpx
from app.core.deps import get_current_user
from app.core.config import OLLAMA_BASE_URL

router = APIRouter(prefix="/api/models", tags=["models"])

@router.get("/")
async def list_models(current_user: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to fetch models from Ollama")
            data = response.json()
            models = data.get("models", [])
            return [
                {
                    "name": m.get("name", ""),
                    "model": m.get("model", ""),
                    "size": m.get("size", 0),
                    "digest": m.get("digest", ""),
                    "modified_at": m.get("modified_at", ""),
                    "details": m.get("details", {}),
                }
                for m in models
            ]
    except httpx.ConnectError:
        return []
    except Exception:
        return []

@router.get("/running")
async def running_models(current_user: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/ps")
            if response.status_code == 200:
                return response.json()
            return {"models": []}
    except Exception:
        return {"models": []}

@router.get("/status")
async def ollama_status(current_user: dict = Depends(get_current_user)):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/")
            return {"online": response.status_code == 200}
    except Exception:
        return {"online": False}
