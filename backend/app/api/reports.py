import json
import os
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import get_current_user
from app.services.report_generator import generate_vulnerability_report
from app.core.config import REPORTS_DIR

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportRequest(BaseModel):
    title: str
    target: str
    scan_ids: list[int] | None = None
    findings: list[dict] | None = None
    recommendations: list[str] | None = None


@router.post("/generate")
async def create_report(
    req: ReportRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    findings = req.findings or []
    if req.scan_ids:
        for scan_id in req.scan_ids:
            cursor = await db.execute(
                "SELECT results FROM scan_results WHERE id = ? AND user_id = ?",
                (scan_id, current_user["id"]),
            )
            row = await cursor.fetchone()
            if row and row["results"]:
                scan_data = json.loads(row["results"])
                if isinstance(scan_data, dict):
                    if "results" in scan_data and isinstance(scan_data["results"], list):
                        findings.extend(scan_data["results"])
                    elif "parsed" in scan_data and "ports" in scan_data["parsed"]:
                        for port in scan_data["parsed"]["ports"]:
                            findings.append({
                                "vulnerability": f"Open port {port['port']} ({port.get('service', 'unknown')})",
                                "severity": "info",
                                "detail": f"Port {port['port']} is open running {port.get('service', 'unknown')}",
                            })

    report = await generate_vulnerability_report(
        title=req.title, target=req.target, findings=findings,
        recommendations=req.recommendations,
        user_name=current_user.get("name", "RudraX User"),
    )

    await db.execute(
        "INSERT INTO vulnerability_reports (user_id, title, target, scan_ids, findings, recommendations, pdf_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')",
        (
            current_user["id"], req.title, req.target,
            json.dumps(req.scan_ids or []),
            json.dumps(findings, default=str),
            json.dumps(req.recommendations or []),
            report["report_path"],
        ),
    )
    await db.commit()
    return report


@router.get("/list")
async def list_reports(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id, title, target, status, created_at FROM vulnerability_reports WHERE user_id = ? ORDER BY created_at DESC",
        (current_user["id"],),
    )
    return [dict(row) for row in await cursor.fetchall()]


@router.get("/download/{report_id}")
async def download_report(
    report_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT pdf_path, title FROM vulnerability_reports WHERE id = ? AND user_id = ?",
        (report_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row or not row["pdf_path"]:
        return {"error": "Report not found"}
    filepath = row["pdf_path"]
    if not os.path.exists(filepath):
        return {"error": "Report file not found on disk"}
    return FileResponse(filepath, filename=f"{row['title'].replace(' ', '_')}.html", media_type="text/html")


@router.get("/{report_id}")
async def get_report(
    report_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM vulnerability_reports WHERE id = ? AND user_id = ?",
        (report_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Report not found"}
    result = dict(row)
    for field in ("findings", "recommendations", "scan_ids"):
        if result.get(field):
            try:
                result[field] = json.loads(result[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return result


@router.delete("/{report_id}")
async def delete_report(
    report_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT pdf_path FROM vulnerability_reports WHERE id = ? AND user_id = ?",
        (report_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if row and row["pdf_path"] and os.path.exists(row["pdf_path"]):
        os.remove(row["pdf_path"])
    await db.execute(
        "DELETE FROM vulnerability_reports WHERE id = ? AND user_id = ?",
        (report_id, current_user["id"]),
    )
    await db.commit()
    return {"message": "Report deleted"}
