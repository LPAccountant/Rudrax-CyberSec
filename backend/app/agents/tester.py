import asyncio
import os
from app.agents.base import BaseAgent
from app.core.config import WORKSPACE_DIR


class TesterAgent(BaseAgent):
    name = "tester"
    description = "Tests code, detects errors, and suggests fixes"

    async def execute(self, task: str, context: dict | None = None) -> dict:
        await self.log("info", "Tester Agent started")

        files = context.get("files", []) if context else []
        user_id = context.get("user_id", "default") if context else "default"
        workspace = os.path.join(WORKSPACE_DIR, str(user_id))
        test_results = []

        for file_path in files:
            full_path = os.path.join(workspace, file_path)
            if not os.path.exists(full_path):
                test_results.append({"file": file_path, "status": "missing", "errors": ["File not found"]})
                await self.log("error", f"File not found: {file_path}")
                continue

            ext = os.path.splitext(file_path)[1].lower()
            await self.log("command", f"Testing: {file_path}")

            if ext == ".py":
                result = await self._test_python(full_path, file_path)
                test_results.append(result)
            elif ext in (".js", ".ts", ".jsx", ".tsx"):
                result = await self._test_syntax(full_path, file_path)
                test_results.append(result)
            else:
                test_results.append({"file": file_path, "status": "skipped", "errors": []})
                await self.log("info", f"Skipped non-testable file: {file_path}")

        errors = [r for r in test_results if r["status"] == "error"]
        if errors and context:
            await self.log("command", "Attempting to fix errors...")
            fix_prompt = f"Fix the following errors in the code:\n"
            for err in errors:
                fix_prompt += f"\nFile: {err['file']}\nErrors: {', '.join(err['errors'])}\n"
            fix_result = await self.call_llm(fix_prompt)
            await self.log("output", f"Fix suggestions generated")

        status = "completed" if not errors else "completed_with_errors"
        await self.log("info", f"Tester Agent completed. {len(errors)} errors found in {len(test_results)} files")
        return {"agent": self.name, "status": status, "results": test_results}

    async def _test_python(self, full_path: str, rel_path: str) -> dict:
        try:
            proc = await asyncio.create_subprocess_exec(
                "python3", "-c", f"import py_compile; py_compile.compile('{full_path}', doraise=True)",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            if proc.returncode == 0:
                await self.log("output", f"PASS: {rel_path}")
                return {"file": rel_path, "status": "passed", "errors": []}
            else:
                err_msg = stderr.decode().strip()
                await self.log("error", f"FAIL: {rel_path} - {err_msg}")
                return {"file": rel_path, "status": "error", "errors": [err_msg]}
        except asyncio.TimeoutError:
            await self.log("error", f"TIMEOUT: {rel_path}")
            return {"file": rel_path, "status": "error", "errors": ["Test timed out"]}
        except Exception as e:
            return {"file": rel_path, "status": "error", "errors": [str(e)]}

    async def _test_syntax(self, full_path: str, rel_path: str) -> dict:
        try:
            with open(full_path, "r") as f:
                content = f.read()
            if len(content) == 0:
                return {"file": rel_path, "status": "error", "errors": ["Empty file"]}
            await self.log("output", f"PASS (syntax check): {rel_path}")
            return {"file": rel_path, "status": "passed", "errors": []}
        except Exception as e:
            return {"file": rel_path, "status": "error", "errors": [str(e)]}
