import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import get_current_user
from app.services.osint_service import (
    deep_osint, whois_lookup, dns_enumeration,
    subdomain_enumeration, http_recon, email_harvester, tech_stack_detection,
)
from app.services.report_generator import generate_osint_report

router = APIRouter(prefix="/api/osint", tags=["osint"])


class OsintRequest(BaseModel):
    target: str
    model: str = "llama3"
    confirmed: bool = False


@router.post("/deep-scan")
async def run_deep_osint(
    req: OsintRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not req.confirmed:
        return {"warning": "Deep OSINT scan will enumerate the target thoroughly. Please confirm.", "requires_confirmation": True}
    results = await deep_osint(req.target, req.model)
    await db.execute(
        "INSERT INTO osint_results (user_id, target, osint_type, results, status) VALUES (?, ?, 'deep', ?, 'completed')",
        (current_user["id"], req.target, json.dumps(results, default=str)),
    )
    await db.commit()
    return results


@router.post("/whois")
async def run_whois(req: OsintRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": "Whois lookup on target. Please confirm.", "requires_confirmation": True}
    return await whois_lookup(req.target)


@router.post("/dns")
async def run_dns(req: OsintRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": "DNS enumeration on target. Please confirm.", "requires_confirmation": True}
    return await dns_enumeration(req.target)


@router.post("/subdomains")
async def run_subdomains(req: OsintRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": "Subdomain enumeration on target. Please confirm.", "requires_confirmation": True}
    return await subdomain_enumeration(req.target)


@router.post("/http-recon")
async def run_http_recon(req: OsintRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": "HTTP reconnaissance on target. Please confirm.", "requires_confirmation": True}
    return await http_recon(req.target)


@router.post("/emails")
async def run_email_harvest(req: OsintRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": "Email harvesting on target. Please confirm.", "requires_confirmation": True}
    return await email_harvester(req.target)


@router.post("/tech-stack")
async def run_tech_detect(req: OsintRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": "Tech stack detection on target. Please confirm.", "requires_confirmation": True}
    return await tech_stack_detection(req.target)


@router.get("/history")
async def get_osint_history(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id, target, osint_type, status, created_at FROM osint_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        (current_user["id"],),
    )
    return [dict(row) for row in await cursor.fetchall()]


@router.post("/generate-report")
async def generate_report(
    req: OsintRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT results FROM osint_results WHERE user_id = ? AND target = ? ORDER BY created_at DESC LIMIT 1",
        (current_user["id"], req.target),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "No OSINT data found for this target. Run a scan first."}
    osint_data = json.loads(row["results"])
    report = await generate_osint_report(req.target, osint_data, current_user.get("name", "RudraX User"))
    return report
