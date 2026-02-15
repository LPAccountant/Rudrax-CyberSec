import json
import os
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.config import WORKSPACE_DIR

router = APIRouter(prefix="/api/deploy", tags=["deploy"])

DEPLOY_DIR = os.path.join(WORKSPACE_DIR, "deployments")
os.makedirs(DEPLOY_DIR, exist_ok=True)


class DeployRequest(BaseModel):
    project_id: int | None = None
    name: str
    git_url: str | None = None
    branch: str = "main"
    build_command: str = ""
    run_command: str = ""
    port: int = 0
    env_vars: dict[str, str] | None = None


class DeployActionRequest(BaseModel):
    action: str


async def _run_cmd(cmd: str, cwd: str, timeout: int = 120) -> tuple[str, str, int]:
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return (
            stdout.decode(errors="replace"),
            stderr.decode(errors="replace"),
            proc.returncode or 0,
        )
    except asyncio.TimeoutError:
        return "", "Command timed out", 1
    except Exception as e:
        return "", str(e), 1


@router.post("/")
async def create_deployment(
    req: DeployRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    deploy_path = os.path.join(DEPLOY_DIR, req.name)
    os.makedirs(deploy_path, exist_ok=True)

    logs = []

    if req.git_url:
        logs.append(f"Cloning {req.git_url} (branch: {req.branch})...")
        stdout, stderr, code = await _run_cmd(
            f"git clone --branch {req.branch} --single-branch {req.git_url} .",
            cwd=deploy_path,
            timeout=180,
        )
        if code != 0 and "already exists" in stderr:
            stdout, stderr, code = await _run_cmd("git pull", cwd=deploy_path)
        logs.append(stdout + stderr)
    elif req.project_id:
        cursor = await db.execute(
            "SELECT path, git_url FROM projects WHERE id = ? AND user_id = ?",
            (req.project_id, current_user["id"]),
        )
        row = await cursor.fetchone()
        if row and row["path"]:
            stdout, stderr, code = await _run_cmd(
                f"cp -r {row['path']}/. {deploy_path}/", cwd=deploy_path
            )
            logs.append(f"Copied from project: {row['path']}")

    if req.build_command:
        logs.append(f"Building: {req.build_command}")
        stdout, stderr, code = await _run_cmd(req.build_command, cwd=deploy_path, timeout=300)
        logs.append(stdout + stderr)
        if code != 0:
            logs.append("Build failed!")

    env_json = json.dumps(req.env_vars) if req.env_vars else "{}"

    cursor = await db.execute(
        """INSERT INTO deployments
        (user_id, name, git_url, branch, deploy_path, build_command, run_command,
         port, env_vars, status, logs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)""",
        (
            current_user["id"],
            req.name,
            req.git_url or "",
            req.branch,
            deploy_path,
            req.build_command,
            req.run_command,
            req.port,
            env_json,
            "\n".join(logs),
        ),
    )
    await db.commit()
    deploy_id = cursor.lastrowid

    if req.run_command:
        await _start_deployment(db, deploy_id, deploy_path, req.run_command, req.env_vars, req.port)

    return {
        "id": deploy_id,
        "name": req.name,
        "status": "running" if req.run_command else "ready",
        "path": deploy_path,
        "logs": "\n".join(logs),
    }


async def _start_deployment(
    db: aiosqlite.Connection,
    deploy_id: int,
    deploy_path: str,
    run_command: str,
    env_vars: dict[str, str] | None,
    port: int,
) -> None:
    env_str = ""
    if env_vars:
        for k, v in env_vars.items():
            env_str += f"export {k}='{v}' && "

    pid_file = os.path.join(deploy_path, ".deploy.pid")
    log_file = os.path.join(deploy_path, ".deploy.log")

    cmd = f"cd {deploy_path} && {env_str}nohup {run_command} > {log_file} 2>&1 & echo $! > {pid_file}"

    try:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=10)
    except Exception:
        pass

    pid = ""
    try:
        if os.path.exists(pid_file):
            with open(pid_file) as f:
                pid = f.read().strip()
    except Exception:
        pass

    await db.execute(
        "UPDATE deployments SET status = 'running', pid = ? WHERE id = ?",
        (pid, deploy_id),
    )
    await db.commit()


@router.get("/")
async def list_deployments(
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM deployments WHERE user_id = ? ORDER BY created_at DESC",
        (current_user["id"],),
    )
    rows = await cursor.fetchall()
    deployments = []
    for row in rows:
        d = dict(row)
        if d.get("pid") and d["status"] == "running":
            try:
                os.kill(int(d["pid"]), 0)
            except (ProcessLookupError, ValueError):
                d["status"] = "stopped"
                await db.execute(
                    "UPDATE deployments SET status = 'stopped' WHERE id = ?", (d["id"],)
                )
                await db.commit()
        deployments.append(d)
    return deployments


@router.get("/{deploy_id}")
async def get_deployment(
    deploy_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM deployments WHERE id = ? AND user_id = ?",
        (deploy_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Deployment not found"}
    return dict(row)


@router.get("/{deploy_id}/logs")
async def get_deployment_logs(
    deploy_id: int,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT deploy_path, logs FROM deployments WHERE id = ? AND user_id = ?",
        (deploy_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Deployment not found", "logs": ""}

    runtime_logs = ""
    log_file = os.path.join(row["deploy_path"], ".deploy.log")
    if os.path.exists(log_file):
        try:
            with open(log_file) as f:
                runtime_logs = f.read()[-10000:]
        except Exception:
            pass

    return {
        "build_logs": row["logs"] or "",
        "runtime_logs": runtime_logs,
    }


@router.post("/{deploy_id}/action")
async def deployment_action(
    deploy_id: int,
    req: DeployActionRequest,
    current_user: dict = Depends(get_current_user),
    db: aiosqlite.Connection = Depends(get_db),
):
    cursor = await db.execute(
        "SELECT * FROM deployments WHERE id = ? AND user_id = ?",
        (deploy_id, current_user["id"]),
    )
    row = await cursor.fetchone()
    if not row:
        return {"error": "Deployment not found"}

    d = dict(row)

    if req.action == "start":
        if not d["run_command"]:
            return {"error": "No run command configured"}
        env_vars = json.loads(d["env_vars"]) if d["env_vars"] else None
        await _start_deployment(db, deploy_id, d["deploy_path"], d["run_command"], env_vars, d["port"])
        return {"status": "running", "message": "Deployment started"}

    elif req.action == "stop":
        if d.get("pid"):
            try:
                os.kill(int(d["pid"]), 15)
            except (ProcessLookupError, ValueError):
                pass
        await db.execute(
            "UPDATE deployments SET status = 'stopped', pid = NULL WHERE id = ?",
            (deploy_id,),
        )
        await db.commit()
        return {"status": "stopped", "message": "Deployment stopped"}

    elif req.action == "restart":
        if d.get("pid"):
            try:
                os.kill(int(d["pid"]), 15)
            except (ProcessLookupError, ValueError):
                pass
            await asyncio.sleep(1)
        if d["run_command"]:
            env_vars = json.loads(d["env_vars"]) if d["env_vars"] else None
            await _start_deployment(db, deploy_id, d["deploy_path"], d["run_command"], env_vars, d["port"])
        return {"status": "running", "message": "Deployment restarted"}

    elif req.action == "rebuild":
        logs = []
        if d["git_url"]:
            logs.append("Pulling latest code...")
            stdout, stderr, code = await _run_cmd("git pull", cwd=d["deploy_path"])
            logs.append(stdout + stderr)
        if d["build_command"]:
            logs.append(f"Building: {d['build_command']}")
            stdout, stderr, code = await _run_cmd(d["build_command"], cwd=d["deploy_path"], timeout=300)
            logs.append(stdout + stderr)

        await db.execute(
            "UPDATE deployments SET logs = ?, updated_at = ? WHERE id = ?",
            ("\n".join(logs), datetime.utcnow().isoformat(), deploy_id),
        )
        await db.commit()
        return {"status": "rebuilt", "logs": "\n".join(logs)}

    elif req.action == "delete":
        if d.get("pid"):
            try:
                os.kill(int(d["pid"]), 15)
            except (ProcessLookupError, ValueError):
                pass
        await db.execute("DELETE FROM deployments WHERE id = ?", (deploy_id,))
        await db.commit()
        return {"status": "deleted", "message": "Deployment removed"}

    return {"error": f"Unknown action: {req.action}"}
