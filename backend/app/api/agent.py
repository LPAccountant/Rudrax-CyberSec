import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import decode_access_token
from app.core.config import DB_PATH
from app.agents.orchestrator import AgentOrchestrator

router = APIRouter(prefix="/api/agent", tags=["agent"])

active_connections: dict[int, list[WebSocket]] = {}

class AgentTaskRequest(BaseModel):
    task: str
    model: str = "llama3"
    mode: str = "full"

@router.post("/execute")
async def execute_agent_task(
    req: AgentTaskRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "INSERT INTO tasks (user_id, title, description, status, agent_type, model_used) VALUES (?, ?, ?, 'pending', 'orchestrator', ?)",
        (current_user["id"], req.task[:100], req.task, req.model)
    )
    await db.commit()
    task_id = cursor.lastrowid

    async def log_callback(msg: dict):
        user_id = current_user["id"]
        if user_id in active_connections:
            data = json.dumps({"task_id": task_id, **msg})
            disconnected = []
            for ws in active_connections[user_id]:
                try:
                    await ws.send_text(data)
                except Exception:
                    disconnected.append(ws)
            for ws in disconnected:
                active_connections[user_id].remove(ws)

    orchestrator = AgentOrchestrator(model=req.model, log_callback=log_callback)
    asyncio.create_task(orchestrator.run(task_id, req.task, current_user["id"], req.mode))

    return {"task_id": task_id, "status": "started", "message": "Agent execution started"}

@router.websocket("/ws/{token}")
async def agent_websocket(websocket: WebSocket, token: str):
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = int(payload.get("sub", 0))
    if not user_id:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    if user_id not in active_connections:
        active_connections[user_id] = []
    active_connections[user_id].append(websocket)

    try:
        await websocket.send_text(json.dumps({"type": "connected", "message": "WebSocket connected"}))
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if user_id in active_connections and websocket in active_connections[user_id]:
            active_connections[user_id].remove(websocket)
            if not active_connections[user_id]:
                del active_connections[user_id]
