import json
import aiosqlite
from app.agents.planner import PlannerAgent
from app.agents.coder import CoderAgent
from app.agents.tester import TesterAgent
from app.agents.deployer import DeployerAgent
from app.core.config import DB_PATH


class AgentOrchestrator:
    def __init__(self, model: str = "llama3", log_callback=None):
        self.model = model
        self.log_callback = log_callback
        self.planner = PlannerAgent(model=model, log_callback=log_callback)
        self.coder = CoderAgent(model=model, log_callback=log_callback)
        self.tester = TesterAgent(model=model, log_callback=log_callback)
        self.deployer = DeployerAgent(model=model, log_callback=log_callback)

    async def run(self, task_id: int, task_description: str, user_id: int, mode: str = "full"):
        context = {"user_id": user_id, "task_id": task_id}

        await self._update_task_status(task_id, "running")

        try:
            if self.log_callback:
                await self.log_callback({
                    "agent": "orchestrator",
                    "type": "info",
                    "content": f"Starting autonomous execution: {task_description}",
                })

            plan_result = await self.planner.execute(task_description, context)
            context["plan"] = plan_result.get("plan", {})
            await self._save_log(task_id, "planner", "info", json.dumps(plan_result, default=str))

            if mode in ("full", "code"):
                code_result = await self.coder.execute(task_description, context)
                context["files"] = code_result.get("files", [])
                await self._save_log(task_id, "coder", "info", json.dumps(code_result, default=str))

            if mode in ("full", "test"):
                test_result = await self.tester.execute(task_description, context)
                await self._save_log(task_id, "tester", "info", json.dumps(test_result, default=str))

            if mode == "full":
                deploy_result = await self.deployer.execute(task_description, context)
                await self._save_log(task_id, "deployer", "info", json.dumps(deploy_result, default=str))

            await self._update_task_status(task_id, "completed")

            if self.log_callback:
                await self.log_callback({
                    "agent": "orchestrator",
                    "type": "info",
                    "content": "All agents completed successfully",
                })

            return {"status": "completed", "context": {k: v for k, v in context.items() if k != "task_id"}}

        except Exception as e:
            await self._update_task_status(task_id, "failed")
            error_msg = str(e)
            if self.log_callback:
                await self.log_callback({
                    "agent": "orchestrator",
                    "type": "error",
                    "content": f"Execution failed: {error_msg}",
                })
            return {"status": "failed", "error": error_msg}

    async def _update_task_status(self, task_id: int, status: str):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?",
                (status, task_id)
            )
            await db.commit()

    async def _save_log(self, task_id: int, agent_name: str, log_type: str, message: str):
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO agent_logs (task_id, agent_name, log_type, message) VALUES (?, ?, ?, ?)",
                (task_id, agent_name, log_type, message[:5000])
            )
            await db.commit()
