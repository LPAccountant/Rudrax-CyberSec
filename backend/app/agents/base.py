import asyncio
import json
import httpx
from datetime import datetime
from app.core.config import OLLAMA_BASE_URL


class AgentMessage:
    def __init__(self, agent: str, msg_type: str, content: str):
        self.agent = agent
        self.msg_type = msg_type
        self.content = content
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "agent": self.agent,
            "type": self.msg_type,
            "content": self.content,
            "timestamp": self.timestamp,
        }


class BaseAgent:
    name: str = "base"
    description: str = "Base agent"

    def __init__(self, model: str = "llama3", log_callback=None):
        self.model = model
        self.log_callback = log_callback
        self.messages: list[dict] = []

    async def log(self, msg_type: str, content: str):
        msg = AgentMessage(self.name, msg_type, content)
        if self.log_callback:
            await self.log_callback(msg.to_dict())

    async def call_llm(self, prompt: str, system_prompt: str = "") -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        await self.log("command", f"[{self.name}] Querying LLM ({self.model})...")

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json={"model": self.model, "messages": messages, "stream": False}
                )
                if response.status_code != 200:
                    err = f"Ollama error: {response.status_code}"
                    await self.log("error", err)
                    return err
                data = response.json()
                result = data.get("message", {}).get("content", "")
                await self.log("output", result[:500])
                return result
        except httpx.ConnectError:
            err = "[Ollama server not available]"
            await self.log("error", err)
            return err
        except Exception as e:
            err = f"[LLM Error: {str(e)}]"
            await self.log("error", err)
            return err

    async def execute(self, task: str, context: dict | None = None) -> dict:
        raise NotImplementedError
