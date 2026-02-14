import json
import os
import asyncio
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import WORKSPACE_DIR

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectRequest(BaseModel):
    name: str
    description: str | None = None
    git_url: str | None = None


@router.post("/")
async def create_project(
    req: ProjectRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    project_path = os.path.join(WORKSPACE_DIR, "projects", req.name)
    os.makedirs(project_path, exist_ok=True)

    if req.git_url:
        try:
            proc = await asyncio.create_subprocess_exec(
                "git", "clone", req.git_url, project_path,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=120)
        except Exception:
            pass

    cursor = await db.execute(
        "INSERT INTO projects (user_id, name, description, path, git_url) VALUES (?, ?, ?, ?, ?)",
        (current_user["id"], req.name, req.description, project_path, req.git_url),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "name": req.name, "path": project_path}


@router.get("/")
async def list_projects(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM projects WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC",
        (current_user["id"],),
    )
    return [dict(row) for row in await cursor.fetchall()]


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM projects WHERE id = ? AND user_id = ?",
        (project_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Project not found"}
    return dict(row)


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE projects SET status = 'deleted' WHERE id = ? AND user_id = ?",
        (project_id, current_user["id"]),
    )
    await db.commit()
    return {"message": "Project deleted"}


@router.post("/{project_id}/git-pull")
async def git_pull_project(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT path FROM projects WHERE id = ? AND user_id = ?",
        (project_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row or not row["path"]:
        return {"error": "Project not found"}
    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "pull",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            cwd=row["path"],
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        return {"output": stdout.decode(), "error": stderr.decode() if stderr else None}
    except Exception as e:
        return {"error": str(e)}
