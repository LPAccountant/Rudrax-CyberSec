from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
import json
from app.core.database import get_db
from app.core.deps import get_current_user
from app.services.network_tools import (
    nmap_scan, nikto_scan, traceroute, banner_grab,
    waf_detect, cms_detect, network_discovery,
    password_audit, password_strength_check,
)

router = APIRouter(prefix="/api/network", tags=["network"])


class ScanRequest(BaseModel):
    target: str
    scan_type: str = "basic"
    ports: str = ""
    confirmed: bool = False


class PasswordAuditRequest(BaseModel):
    hash_value: str
    hash_type: str = "auto"


class PasswordStrengthRequest(BaseModel):
    password: str


@router.post("/nmap")
async def run_nmap(
    req: ScanRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not req.confirmed:
        return {"warning": f"Nmap {req.scan_type} scan on {req.target}. Please confirm.", "requires_confirmation": True}
    result = await nmap_scan(req.target, req.scan_type, req.ports)
    await db.execute(
        "INSERT INTO scan_results (user_id, scan_type, target, results, status) VALUES (?, 'nmap', ?, ?, ?)",
        (current_user["id"], req.target, json.dumps(result, default=str), result.get("status", "completed")),
    )
    await db.commit()
    return result


@router.post("/nikto")
async def run_nikto(
    req: ScanRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not req.confirmed:
        return {"warning": f"Nikto scan on {req.target}. Please confirm.", "requires_confirmation": True}
    result = await nikto_scan(req.target)
    await db.execute(
        "INSERT INTO scan_results (user_id, scan_type, target, results, status) VALUES (?, 'nikto', ?, ?, ?)",
        (current_user["id"], req.target, json.dumps(result, default=str), result.get("status", "completed")),
    )
    await db.commit()
    return result


@router.post("/traceroute")
async def run_traceroute(req: ScanRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": f"Traceroute to {req.target}. Please confirm.", "requires_confirmation": True}
    return await traceroute(req.target)


@router.post("/banner-grab")
async def run_banner_grab(req: ScanRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": f"Banner grab on {req.target}. Please confirm.", "requires_confirmation": True}
    port = int(req.ports) if req.ports and req.ports.isdigit() else 80
    return await banner_grab(req.target, port)


@router.post("/waf-detect")
async def run_waf_detect(req: ScanRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": f"WAF detection on {req.target}. Please confirm.", "requires_confirmation": True}
    return await waf_detect(req.target)


@router.post("/cms-detect")
async def run_cms_detect(req: ScanRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": f"CMS detection on {req.target}. Please confirm.", "requires_confirmation": True}
    return await cms_detect(req.target)


@router.post("/discovery")
async def run_network_discovery(req: ScanRequest, current_user: dict = Depends(get_current_user)):
    if not req.confirmed:
        return {"warning": f"Network discovery on {req.target}. Please confirm.", "requires_confirmation": True}
    return await network_discovery(req.target)


@router.post("/password-audit")
async def run_password_audit(req: PasswordAuditRequest, current_user: dict = Depends(get_current_user)):
    return await password_audit(req.hash_value, req.hash_type)


@router.post("/password-strength")
async def run_password_strength(req: PasswordStrengthRequest, current_user: dict = Depends(get_current_user)):
    return await password_strength_check(req.password)


@router.get("/scan-history")
async def get_scan_history(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT id, scan_type, target, status, severity_summary, created_at FROM scan_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        (current_user["id"],),
    )
    return [dict(row) for row in await cursor.fetchall()]


@router.get("/scan/{scan_id}")
async def get_scan_result(
    scan_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM scan_results WHERE id = ? AND user_id = ?",
        (scan_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Scan not found"}
    result = dict(row)
    if result.get("results"):
        result["results"] = json.loads(result["results"])
    return result
