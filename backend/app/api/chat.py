from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import aiosqlite
import httpx
import json
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import OLLAMA_BASE_URL

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    model: str = "llama3"
    session_id: str | None = None

class ChatHistoryRequest(BaseModel):
    session_id: str

@router.post("/send")
async def send_message(req: ChatRequest, current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute(
        "INSERT INTO chat_messages (user_id, role, content, model, session_id) VALUES (?, 'user', ?, ?, ?)",
        (current_user["id"], req.message, req.model, req.session_id)
    )
    await db.commit()

    cursor = await db.execute(
        "SELECT role, content FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC",
        (current_user["id"], req.session_id)
    )
    history = await cursor.fetchall()
    messages = [{"role": r["role"], "content": r["content"]} for r in history]

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={"model": req.model, "messages": messages, "stream": False}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Ollama error: {response.text}")
            data = response.json()
            assistant_msg = data.get("message", {}).get("content", "No response from model")
    except httpx.ConnectError:
        assistant_msg = "[Ollama server not available. Please ensure Ollama is running on the server.]"
    except Exception as e:
        assistant_msg = f"[Error communicating with Ollama: {str(e)}]"

    await db.execute(
        "INSERT INTO chat_messages (user_id, role, content, model, session_id) VALUES (?, 'assistant', ?, ?, ?)",
        (current_user["id"], assistant_msg, req.model, req.session_id)
    )
    await db.commit()
    return {"response": assistant_msg, "model": req.model}

@router.get("/history")
async def get_chat_history(session_id: str, current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT id, role, content, model, created_at FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC",
        (current_user["id"], session_id)
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.get("/sessions")
async def get_sessions(current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT DISTINCT session_id, MIN(created_at) as started_at FROM chat_messages WHERE user_id = ? AND session_id IS NOT NULL GROUP BY session_id ORDER BY started_at DESC",
        (current_user["id"],)
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute(
        "DELETE FROM chat_messages WHERE user_id = ? AND session_id = ?",
        (current_user["id"], session_id)
    )
    await db.commit()
    return {"message": "Session deleted"}
