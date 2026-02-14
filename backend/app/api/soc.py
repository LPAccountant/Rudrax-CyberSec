import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import get_current_user
from app.services.soc_service import analyze_soc_event, get_soc_dashboard_stats, generate_auto_patch

router = APIRouter(prefix="/api/soc", tags=["soc"])


class SocEventRequest(BaseModel):
    event_type: str
    severity: str = "info"
    source: str | None = None
    description: str
    raw_data: str | None = None


class AnalyzeEventRequest(BaseModel):
    event_id: int | None = None
    event_data: dict | None = None
    model: str = "llama3"


class AutoPatchRequest(BaseModel):
    finding: dict
    model: str = "llama3"


@router.get("/dashboard")
async def soc_dashboard(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    return await get_soc_dashboard_stats(db)


@router.post("/events")
async def create_soc_event(
    req: SocEventRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "INSERT INTO soc_events (event_type, severity, source, description, raw_data) VALUES (?, ?, ?, ?, ?)",
        (req.event_type, req.severity, req.source, req.description, req.raw_data),
    )
    await db.commit()
    return {"id": cursor.lastrowid, "message": "Event created"}


@router.get("/events")
async def list_soc_events(
    severity: str | None = None,
    resolved: bool | None = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    query = "SELECT * FROM soc_events WHERE 1=1"
    params: list = []
    if severity:
        query += " AND severity = ?"
        params.append(severity)
    if resolved is not None:
        query += " AND is_resolved = ?"
        params.append(1 if resolved else 0)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    cursor = await db.execute(query, params)
    return [dict(row) for row in await cursor.fetchall()]


@router.put("/events/{event_id}/resolve")
async def resolve_event(
    event_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE soc_events SET is_resolved = 1, resolved_by = ? WHERE id = ?",
        (current_user["id"], event_id),
    )
    await db.commit()
    return {"message": "Event resolved"}


@router.post("/analyze")
async def analyze_event(
    req: AnalyzeEventRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    if req.event_id:
        cursor = await db.execute("SELECT * FROM soc_events WHERE id = ?", (req.event_id,))
        row = await cursor.fetchone()
        if not row:
            return {"error": "Event not found"}
        event_data = dict(row)
    elif req.event_data:
        event_data = req.event_data
    else:
        return {"error": "Provide event_id or event_data"}
    return await analyze_soc_event(event_data, req.model)


@router.post("/auto-patch")
async def auto_patch(
    req: AutoPatchRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    patch = await generate_auto_patch(req.finding, req.model)
    await db.execute(
        "INSERT INTO patch_suggestions (title, description, severity, status) VALUES (?, ?, ?, 'pending')",
        (patch["title"], patch["description"], patch["severity"]),
    )
    await db.commit()
    return patch


@router.get("/patches")
async def list_patches(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM patch_suggestions ORDER BY created_at DESC LIMIT 50"
    )
    return [dict(row) for row in await cursor.fetchall()]


@router.put("/patches/{patch_id}/apply")
async def apply_patch(
    patch_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE patch_suggestions SET status = 'applied', applied_by = ? WHERE id = ?",
        (current_user["id"], patch_id),
    )
    await db.commit()
    return {"message": "Patch marked as applied"}
