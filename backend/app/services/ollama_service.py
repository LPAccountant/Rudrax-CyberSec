import httpx
import json
from app.core.config import OLLAMA_BASE_URL


async def query_ollama(prompt: str, model: str = "llama3", system: str = "", timeout: float = 120.0) -> str:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": model, "prompt": prompt, "system": system, "stream": False},
                timeout=timeout,
            )
            if response.status_code == 200:
                return response.json().get("response", "")
            return f"Error: Ollama returned status {response.status_code}"
    except Exception as e:
        return f"Error connecting to Ollama: {str(e)}"


async def chat_ollama(messages: list[dict], model: str = "llama3", timeout: float = 120.0) -> str:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
                timeout=timeout,
            )
            if response.status_code == 200:
                return response.json().get("message", {}).get("content", "")
            return f"Error: Ollama returned status {response.status_code}"
    except Exception as e:
        return f"Error connecting to Ollama: {str(e)}"


async def stream_ollama(prompt: str, model: str = "llama3", system: str = ""):
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/generate",
                json={"model": model, "prompt": prompt, "system": system, "stream": True},
                timeout=120.0,
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"Error: {str(e)}"


async def list_ollama_models() -> list[str]:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10.0)
            if response.status_code == 200:
                return [m["name"] for m in response.json().get("models", [])]
    except Exception:
        pass
    return []


async def get_ollama_status() -> dict:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
            if response.status_code == 200:
                models = response.json().get("models", [])
                return {"status": "connected", "models_count": len(models)}
    except Exception:
        pass
    return {"status": "disconnected", "models_count": 0}


async def auto_select_model(task_type: str) -> str:
    models = await list_ollama_models()
    if not models:
        return "llama3"

    model_names_lower = [m.lower() for m in models]
    preference_map = {
        "code": ["codellama", "deepseek-coder", "starcoder", "codegemma", "qwen2.5-coder"],
        "security": ["llama3", "mixtral", "mistral", "gemma2"],
        "analysis": ["llama3", "mixtral", "mistral", "phi3"],
        "general": ["llama3", "mixtral", "mistral", "gemma2"],
    }

    preferences = preference_map.get(task_type, preference_map["general"])
    for pref in preferences:
        for i, name in enumerate(model_names_lower):
            if pref in name:
                return models[i]
    return models[0]
