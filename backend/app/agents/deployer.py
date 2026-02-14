import asyncio
import os
from app.agents.base import BaseAgent
from app.core.config import WORKSPACE_DIR


class DeployerAgent(BaseAgent):
    name = "deployer"
    description = "Handles git operations and deployment"

    async def execute(self, task: str, context: dict | None = None) -> dict:
        await self.log("info", "Deployer Agent started")

        user_id = context.get("user_id", "default") if context else "default"
        workspace = os.path.join(WORKSPACE_DIR, str(user_id))

        if not os.path.exists(workspace):
            await self.log("error", "Workspace not found")
            return {"agent": self.name, "status": "error", "message": "No workspace found"}

        steps_completed = []

        git_dir = os.path.join(workspace, ".git")
        if not os.path.exists(git_dir):
            await self.log("command", "git init")
            result = await self._run_command("git init", workspace)
            steps_completed.append({"step": "git_init", "output": result})

        await self.log("command", "git add -A")
        result = await self._run_command("git add -A", workspace)
        steps_completed.append({"step": "git_add", "output": result})

        await self.log("command", 'git commit -m "Auto-commit by RudraX Deployer Agent"')
        result = await self._run_command(
            'git commit -m "Auto-commit by RudraX Deployer Agent" --allow-empty',
            workspace
        )
        steps_completed.append({"step": "git_commit", "output": result})

        remote_url = context.get("remote_url") if context else None
        if remote_url:
            await self.log("command", f"git remote add origin {remote_url}")
            await self._run_command(f"git remote add origin {remote_url}", workspace)
            await self.log("command", "git push -u origin main")
            result = await self._run_command("git push -u origin main", workspace)
            steps_completed.append({"step": "git_push", "output": result})

        await self.log("info", f"Deployer Agent completed. {len(steps_completed)} steps executed.")
        return {"agent": self.name, "status": "completed", "steps": steps_completed}

    async def _run_command(self, cmd: str, cwd: str) -> str:
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
            output = stdout.decode().strip()
            errors = stderr.decode().strip()
            combined = f"{output}\n{errors}".strip()
            await self.log("output", combined[:500] if combined else "(no output)")
            return combined
        except asyncio.TimeoutError:
            await self.log("error", f"Command timed out: {cmd}")
            return "Command timed out"
        except Exception as e:
            await self.log("error", f"Command failed: {str(e)}")
            return str(e)
