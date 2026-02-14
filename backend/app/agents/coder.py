import os
import aiofiles
from app.agents.base import BaseAgent
from app.core.config import WORKSPACE_DIR


class CoderAgent(BaseAgent):
    name = "coder"
    description = "Generates complete code based on plan and requirements"

    async def execute(self, task: str, context: dict | None = None) -> dict:
        await self.log("info", f"Coder Agent started for task: {task}")

        plan_info = ""
        if context and "plan" in context:
            import json
            plan_info = f"\n\nProject Plan:\n{json.dumps(context['plan'], indent=2)}"

        system_prompt = f"""You are an expert software developer. Generate complete, production-ready code.
Rules:
- Generate COMPLETE files with NO placeholders or TODOs
- Include all imports and dependencies
- Use best practices and proper error handling
- Output as JSON with a "files" array
- Each file should have: "path" (relative), "content" (full file content), "language"
- Only output valid JSON, no markdown
{plan_info}"""

        await self.log("command", "Generating code...")
        result = await self.call_llm(task, system_prompt)

        files_created = []
        try:
            import json
            data = json.loads(result)
            files = data.get("files", [])
            user_id = context.get("user_id", "default") if context else "default"
            workspace = os.path.join(WORKSPACE_DIR, str(user_id))
            os.makedirs(workspace, exist_ok=True)

            for file_info in files:
                file_path = os.path.join(workspace, file_info["path"])
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                async with aiofiles.open(file_path, "w") as f:
                    await f.write(file_info["content"])
                files_created.append(file_info["path"])
                await self.log("output", f"Created: {file_info['path']}")
        except (json.JSONDecodeError, ValueError):
            await self.log("warning", "Could not parse structured output, saving raw response")
            user_id = context.get("user_id", "default") if context else "default"
            workspace = os.path.join(WORKSPACE_DIR, str(user_id))
            os.makedirs(workspace, exist_ok=True)
            raw_path = os.path.join(workspace, "generated_output.txt")
            async with aiofiles.open(raw_path, "w") as f:
                await f.write(result)
            files_created.append("generated_output.txt")

        await self.log("info", f"Coder Agent completed. Files created: {len(files_created)}")
        return {"agent": self.name, "status": "completed", "files": files_created}
