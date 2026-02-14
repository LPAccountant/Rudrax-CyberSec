import json
from datetime import datetime
from app.services.ollama_service import query_ollama


async def analyze_soc_event(event_data: dict, model: str = "llama3") -> dict:
    prompt = f"""Analyze this security event and provide:
1. Threat classification
2. Severity assessment (Critical/High/Medium/Low/Info)
3. Recommended response actions
4. IOCs (Indicators of Compromise) if any

Event data:
{json.dumps(event_data, indent=2, default=str)[:3000]}"""

    analysis = await query_ollama(
        prompt, model=model,
        system="You are a SOC analyst. Provide concise, actionable security event analysis.",
    )
    return {
        "event": event_data,
        "analysis": analysis,
        "analyzed_at": datetime.now().isoformat(),
    }


async def get_soc_dashboard_stats(db) -> dict:
    cursor = await db.execute(
        "SELECT severity, COUNT(*) as count FROM soc_events GROUP BY severity"
    )
    severity_stats = {row["severity"]: row["count"] for row in await cursor.fetchall()}

    cursor = await db.execute(
        "SELECT COUNT(*) as total FROM soc_events WHERE is_resolved = 0"
    )
    unresolved = (await cursor.fetchone())["total"]

    cursor = await db.execute(
        "SELECT COUNT(*) as total FROM soc_events WHERE created_at >= datetime('now', '-24 hours')"
    )
    last_24h = (await cursor.fetchone())["total"]

    cursor = await db.execute(
        "SELECT COUNT(*) as total FROM soc_events WHERE created_at >= datetime('now', '-7 days')"
    )
    last_7d = (await cursor.fetchone())["total"]

    cursor = await db.execute(
        "SELECT event_type, COUNT(*) as count FROM soc_events GROUP BY event_type ORDER BY count DESC LIMIT 10"
    )
    top_events = [dict(row) for row in await cursor.fetchall()]

    cursor = await db.execute(
        """SELECT date(created_at) as day, COUNT(*) as count
        FROM soc_events WHERE created_at >= datetime('now', '-30 days')
        GROUP BY day ORDER BY day"""
    )
    timeline = [dict(row) for row in await cursor.fetchall()]

    cursor = await db.execute(
        "SELECT * FROM soc_events ORDER BY created_at DESC LIMIT 20"
    )
    recent = [dict(row) for row in await cursor.fetchall()]

    cursor = await db.execute("SELECT COUNT(*) as total FROM scan_results")
    total_scans = (await cursor.fetchone())["total"]

    cursor = await db.execute("SELECT COUNT(*) as total FROM vulnerability_reports")
    total_reports = (await cursor.fetchone())["total"]

    cursor = await db.execute("SELECT COUNT(*) as total FROM tasks WHERE status = 'completed'")
    completed_tasks = (await cursor.fetchone())["total"]

    return {
        "severity_stats": severity_stats,
        "unresolved_count": unresolved,
        "events_last_24h": last_24h,
        "events_last_7d": last_7d,
        "top_event_types": top_events,
        "timeline": timeline,
        "recent_events": recent,
        "total_scans": total_scans,
        "total_reports": total_reports,
        "completed_tasks": completed_tasks,
    }


async def generate_auto_patch(finding: dict, model: str = "llama3") -> dict:
    prompt = f"""Based on this security finding, generate a patch suggestion:

Finding: {json.dumps(finding, indent=2, default=str)}

Provide:
1. Patch title
2. Description of the fix
3. Shell commands to apply the fix (if applicable)
4. Configuration changes needed
5. Risk level of applying this patch"""

    suggestion = await query_ollama(
        prompt, model=model,
        system="You are a security patch engineer. Generate safe, tested patch suggestions for vulnerabilities.",
    )

    severity = finding.get("severity", "medium")
    return {
        "title": f"Fix: {finding.get('vulnerability', finding.get('finding', 'Security Issue'))}",
        "description": suggestion,
        "severity": severity,
        "auto_generated": True,
        "generated_at": datetime.now().isoformat(),
    }
