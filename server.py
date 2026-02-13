#!/usr/bin/env python3
"""
RudraX CyberSec - Backend Server
A Lalit Pandit Product

This is the backend API server for the RudraX CyberSec AI Agent System.
It provides:
- Ollama LLM integration
- Agent workflow management
- Terminal command execution
- File management
- Security tool orchestration
"""

import os
import json
import subprocess
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import httpx
import uvicorn

# Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
WORKSPACE_DIR = os.getenv("RUDRAX_WORKSPACE", "./workspace")
ALLOWED_COMMANDS = [
    "ls", "cat", "pwd", "whoami", "echo", "mkdir", "touch", "rm", "cp", "mv",
    "head", "tail", "grep", "find", "wc", "sort", "uniq", "diff",
    "python3", "python", "node", "npm", "npx",
    "git", "docker", "kubectl", "terraform", "ansible",
    "nmap", "gobuster", "nikto", "sqlmap", "dirb", "wfuzz",
    "curl", "wget", "http", "jq", "yq"
]

# Ensure workspace exists
os.makedirs(WORKSPACE_DIR, exist_ok=True)

app = FastAPI(
    title="RudraX CyberSec API",
    description="AI Agent System for Cybersecurity and Development",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class ChatRequest(BaseModel):
    message: str
    agent: Optional[str] = "auto"
    system_prompt: Optional[str] = None
    model: Optional[str] = "llama2"
    language: Optional[str] = "en"

class CommandRequest(BaseModel):
    command: str
    cwd: Optional[str] = None
    timeout: Optional[int] = 60

class FileRequest(BaseModel):
    filename: str
    content: str
    path: Optional[str] = ""

class TaskRequest(BaseModel):
    title: str
    description: str
    agent: str

class SecurityScanRequest(BaseModel):
    target: str
    tool: str
    options: Optional[Dict[str, Any]] = {}

# Agent System
class AgentSystem:
    def __init__(self):
        self.agents = {
            "planner": {
                "name": "Task Planner",
                "description": "Analyzes tasks and creates execution plans",
                "system_prompt": "You are a task planning agent. Break down complex tasks into actionable steps."
            },
            "coder": {
                "name": "Code Agent",
                "description": "Generates and debugs code",
                "system_prompt": "You are an expert programmer. Write clean, efficient, and well-documented code."
            },
            "security": {
                "name": "Security Agent",
                "description": "Performs security analysis and red-team ops",
                "system_prompt": "You are a cybersecurity expert. Perform security analysis, vulnerability assessments, and provide recommendations."
            },
            "tester": {
                "name": "Test Agent",
                "description": "Tests and validates outputs",
                "system_prompt": "You are a testing expert. Validate code, find bugs, and ensure quality."
            },
            "infra": {
                "name": "Infra Agent",
                "description": "Manages infrastructure and deployments",
                "system_prompt": "You are a DevOps expert. Manage infrastructure, deployments, and cloud resources."
            },
            "web": {
                "name": "Web Agent",
                "description": "Handles web and API interactions",
                "system_prompt": "You are a web development expert. Handle APIs, web scraping, and HTTP requests."
            }
        }
        self.tasks: List[Dict] = []
        
    def create_task(self, title: str, description: str, agent: str) -> Dict:
        task = {
            "id": f"task_{len(self.tasks) + 1}_{datetime.now().timestamp()}",
            "title": title,
            "description": description,
            "agent": agent,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "completed_at": None
        }
        self.tasks.append(task)
        return task
    
    def update_task(self, task_id: str, status: str) -> Optional[Dict]:
        for task in self.tasks:
            if task["id"] == task_id:
                task["status"] = status
                if status in ["completed", "failed"]:
                    task["completed_at"] = datetime.now().isoformat()
                return task
        return None
    
    def get_tasks(self) -> List[Dict]:
        return self.tasks
    
    def detect_agent(self, message: str) -> str:
        """Auto-detect which agent should handle the task"""
        msg_lower = message.lower()
        
        if any(kw in msg_lower for kw in ["security", "vulnerability", "exploit", "scan", "pentest", "hack", "nmap"]):
            return "security"
        elif any(kw in msg_lower for kw in ["test", "debug", "validate", "check", "verify"]):
            return "tester"
        elif any(kw in msg_lower for kw in ["server", "deploy", "docker", "kubernetes", "infrastructure", "cloud"]):
            return "infra"
        elif any(kw in msg_lower for kw in ["web", "api", "http", "scraping", "curl", "request"]):
            return "web"
        elif any(kw in msg_lower for kw in ["code", "script", "program", "function", "class", "python", "javascript"]):
            return "coder"
        else:
            return "planner"

agent_system = AgentSystem()

# Ollama Integration
async def query_ollama(prompt: str, model: str = "llama2", system: str = "") -> str:
    """Query Ollama API for LLM response"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "system": system,
                    "stream": False
                },
                timeout=120.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("response", "")
            else:
                return f"Error: Ollama returned status {response.status_code}"
    except Exception as e:
        return f"Error connecting to Ollama: {str(e)}"

async def stream_ollama(prompt: str, model: str = "llama2", system: str = ""):
    """Stream Ollama response"""
    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "system": system,
                    "stream": True
                },
                timeout=120.0
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            continue
    except Exception as e:
        yield f"Error: {str(e)}"

# API Routes

@app.get("/")
async def root():
    return {
        "name": "RudraX CyberSec API",
        "version": "1.0.0",
        "developer": "Lalit Pandit",
        "status": "running",
        "ollama_url": OLLAMA_URL
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    ollama_status = "unknown"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
            ollama_status = "connected" if response.status_code == 200 else "error"
    except:
        ollama_status = "disconnected"
    
    return {
        "status": "healthy",
        "ollama": ollama_status,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/models")
async def list_models():
    """List available Ollama models"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags", timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                models = [model["name"] for model in data.get("models", [])]
                return {"models": models}
            else:
                return {"models": ["llama2", "codellama", "mistral"], "error": "Using defaults"}
    except:
        return {"models": ["llama2", "codellama", "mistral"], "error": "Ollama not connected"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Process chat message with agent system"""
    # Detect agent if auto
    agent_id = request.agent
    if agent_id == "auto":
        agent_id = agent_system.detect_agent(request.message)
    
    agent = agent_system.agents.get(agent_id, agent_system.agents["planner"])
    
    # Create task
    task = agent_system.create_task(
        f"Processing: {request.message[:50]}...",
        request.message,
        agent_id
    )
    
    # Build system prompt
    system = request.system_prompt or agent["system_prompt"]
    if request.language == "hi":
        system += "\nRespond in Hindi language."
    
    # Query Ollama
    agent_system.update_task(task["id"], "in_progress")
    response = await query_ollama(request.message, request.model, system)
    agent_system.update_task(task["id"], "completed")
    
    return {
        "response": response,
        "agent": agent_id,
        "agent_name": agent["name"],
        "task_id": task["id"],
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Stream chat response"""
    agent_id = request.agent
    if agent_id == "auto":
        agent_id = agent_system.detect_agent(request.message)
    
    agent = agent_system.agents.get(agent_id, agent_system.agents["planner"])
    system = request.system_prompt or agent["system_prompt"]
    
    if request.language == "hi":
        system += "\nRespond in Hindi language."
    
    return StreamingResponse(
        stream_ollama(request.message, request.model, system),
        media_type="text/plain"
    )

@app.post("/api/execute")
async def execute_command(request: CommandRequest):
    """Execute terminal command"""
    # Security check
    cmd_parts = request.command.split()
    if not cmd_parts:
        raise HTTPException(status_code=400, detail="Empty command")
    
    base_cmd = cmd_parts[0]
    
    # Check if command is allowed
    if base_cmd not in ALLOWED_COMMANDS:
        # Check for absolute paths
        if base_cmd.startswith("/"):
            base_cmd = os.path.basename(base_cmd)
        
        if base_cmd not in ALLOWED_COMMANDS:
            return {
                "output": f"Command '{base_cmd}' is not in the allowed list. For security, only specific commands are permitted.",
                "status": "blocked",
                "command": request.command
            }
    
    # Set working directory
    cwd = request.cwd or WORKSPACE_DIR
    if not os.path.isabs(cwd):
        cwd = os.path.join(WORKSPACE_DIR, cwd)
    
    # Ensure cwd is within workspace
    real_cwd = os.path.realpath(cwd)
    real_workspace = os.path.realpath(WORKSPACE_DIR)
    if not real_cwd.startswith(real_workspace):
        cwd = WORKSPACE_DIR
    
    try:
        # Execute command
        process = await asyncio.create_subprocess_shell(
            request.command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env={**os.environ, "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"}
        )
        
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=request.timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            return {
                "output": f"Command timed out after {request.timeout} seconds",
                "status": "timeout",
                "command": request.command
            }
        
        output = stdout.decode() if stdout else ""
        error = stderr.decode() if stderr else ""
        
        if error:
            output += f"\n[STDERR]:\n{error}"
        
        return {
            "output": output or "Command executed successfully (no output)",
            "status": "success" if process.returncode == 0 else "error",
            "return_code": process.returncode,
            "command": request.command
        }
        
    except Exception as e:
        return {
            "output": f"Error executing command: {str(e)}",
            "status": "error",
            "command": request.command
        }

@app.get("/api/files")
async def list_files(path: str = ""):
    """List files in workspace"""
    target_path = os.path.join(WORKSPACE_DIR, path)
    real_target = os.path.realpath(target_path)
    real_workspace = os.path.realpath(WORKSPACE_DIR)
    
    if not real_target.startswith(real_workspace):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not os.path.exists(target_path):
        return {"files": []}
    
    files = []
    for item in os.listdir(target_path):
        item_path = os.path.join(target_path, item)
        rel_path = os.path.relpath(item_path, WORKSPACE_DIR)
        stat = os.stat(item_path)
        
        files.append({
            "name": item,
            "path": rel_path,
            "type": "directory" if os.path.isdir(item_path) else "file",
            "size": stat.st_size if os.path.isfile(item_path) else None,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    
    return {"files": files, "path": path}

@app.post("/api/files")
async def create_file(request: FileRequest):
    """Create or update file"""
    file_path = os.path.join(WORKSPACE_DIR, request.path, request.filename)
    real_path = os.path.realpath(file_path)
    real_workspace = os.path.realpath(WORKSPACE_DIR)
    
    if not real_path.startswith(real_workspace):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create directory if needed
    os.makedirs(os.path.dirname(real_path), exist_ok=True)
    
    with open(real_path, "w") as f:
        f.write(request.content)
    
    return {
        "message": "File created successfully",
        "path": os.path.relpath(real_path, WORKSPACE_DIR),
        "size": len(request.content)
    }

@app.get("/api/files/content")
async def get_file_content(path: str):
    """Get file content"""
    file_path = os.path.join(WORKSPACE_DIR, path)
    real_path = os.path.realpath(file_path)
    real_workspace = os.path.realpath(WORKSPACE_DIR)
    
    if not real_path.startswith(real_workspace):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not os.path.exists(real_path) or not os.path.isfile(real_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(real_path, "r") as f:
        content = f.read()
    
    return {"content": content, "path": path}

@app.delete("/api/files")
async def delete_file(path: str):
    """Delete file"""
    file_path = os.path.join(WORKSPACE_DIR, path)
    real_path = os.path.realpath(file_path)
    real_workspace = os.path.realpath(WORKSPACE_DIR)
    
    if not real_path.startswith(real_workspace):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if os.path.exists(real_path):
        if os.path.isfile(real_path):
            os.remove(real_path)
        else:
            import shutil
            shutil.rmtree(real_path)
        return {"message": "Deleted successfully"}
    
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/tasks")
async def get_tasks():
    """Get all tasks"""
    return {"tasks": agent_system.get_tasks()}

@app.get("/api/agents")
async def get_agents():
    """Get available agents"""
    return {"agents": agent_system.agents}

@app.post("/api/security/scan")
async def security_scan(request: SecurityScanRequest, background_tasks: BackgroundTasks):
    """Run security scan"""
    task = agent_system.create_task(
        f"Security scan: {request.tool} on {request.target}",
        f"Running {request.tool} against {request.target}",
        "security"
    )
    
    # This would integrate with actual security tools
    # For now, return a simulated response
    return {
        "task_id": task["id"],
        "tool": request.tool,
        "target": request.target,
        "status": "started",
        "message": f"{request.tool} scan started on {request.target}"
    }

# WebSocket for real-time updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle WebSocket messages
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif data.get("type") == "subscribe_tasks":
                await websocket.send_json({
                    "type": "tasks",
                    "data": agent_system.get_tasks()
                })
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   RudraX CyberSec - AI Agent System                          ║
║   A Lalit Pandit Product                                     ║
║                                                              ║
║   Starting server on http://localhost:8000                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=8000)
