from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

class CreateTaskRequest(BaseModel):
    title: str
    description: str | None = None
    agent_type: str = "planner"
    model: str = "llama3"

@router.get("/")
async def list_tasks(current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC",
        (current_user["id"],)
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.get("/{task_id}")
async def get_task(task_id: int, current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, current_user["id"])
    )
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return dict(row)

@router.get("/{task_id}/logs")
async def get_task_logs(task_id: int, current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, current_user["id"])
    )
    task = await cursor.fetchone()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    cursor = await db.execute(
        "SELECT * FROM agent_logs WHERE task_id = ? ORDER BY created_at ASC",
        (task_id,)
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.delete("/{task_id}")
async def delete_task(task_id: int, current_user: dict = Depends(get_current_user), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM agent_logs WHERE task_id = ?", (task_id,))
    await db.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, current_user["id"]))
    await db.commit()
    return {"message": "Task deleted"}
