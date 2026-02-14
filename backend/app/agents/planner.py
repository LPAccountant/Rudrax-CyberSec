from app.agents.base import BaseAgent


class PlannerAgent(BaseAgent):
    name = "planner"
    description = "Breaks down tasks into actionable steps and defines architecture"

    async def execute(self, task: str, context: dict | None = None) -> dict:
        await self.log("info", f"Planner Agent started for task: {task}")

        system_prompt = """You are an expert software architect and project planner.
Your job is to break down the given task into clear, actionable steps.
For each step, provide:
1. A brief description
2. The type of work (design, code, test, deploy)
3. Dependencies on other steps
4. Estimated complexity (low, medium, high)

Output your plan as a JSON object with a "steps" array.
Each step should have: "id", "title", "description", "type", "dependencies", "complexity"
Only output valid JSON, no markdown."""

        await self.log("command", "Generating project plan...")
        result = await self.call_llm(task, system_prompt)

        await self.log("info", "Plan generation complete")

        try:
            import json
            plan = json.loads(result)
        except (json.JSONDecodeError, ValueError):
            plan = {
                "steps": [
                    {"id": 1, "title": "Analysis", "description": result[:200], "type": "design", "dependencies": [], "complexity": "medium"},
                    {"id": 2, "title": "Implementation", "description": "Implement the solution based on analysis", "type": "code", "dependencies": [1], "complexity": "high"},
                    {"id": 3, "title": "Testing", "description": "Test the implementation", "type": "test", "dependencies": [2], "complexity": "medium"},
                    {"id": 4, "title": "Deployment", "description": "Deploy the solution", "type": "deploy", "dependencies": [3], "complexity": "low"},
                ],
                "raw_response": result
            }

        await self.log("output", f"Plan created with {len(plan.get('steps', []))} steps")
        return {"agent": self.name, "status": "completed", "plan": plan}
