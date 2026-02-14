import { useState, useEffect, useRef } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { Play, Terminal, Bot, Loader2 } from "lucide-react";

interface LogEntry {
  agent: string;
  type: string;
  content: string;
  timestamp?: string;
}

export default function AgentPage() {
  const { token } = useAuth();
  const [task, setTask] = useState("");
  const [model, setModel] = useState("llama3");
  const [mode, setMode] = useState("full");
  const [models, setModels] = useState<{ name: string }[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getModels().then((m) => { if (m.length) { setModels(m); setModel(m[0].name); } });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(api.getWsUrl(token));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;
        if (data.type === "pong") return;
        setLogs((prev) => [...prev, data]);
        if (data.agent === "orchestrator" && data.content?.includes("completed")) {
          setRunning(false);
        }
        if (data.agent === "orchestrator" && data.content?.includes("failed")) {
          setRunning(false);
        }
      } catch {
        /* ignore parse errors */
      }
    };
    ws.onclose = () => {};
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [token]);

  const executeTask = async () => {
    if (!task.trim() || running) return;
    setLogs([]);
    setRunning(true);
    try {
      const data = await api.executeAgent(task, model, mode);
      setTaskId(data.task_id);
      setLogs((prev) => [...prev, { agent: "system", type: "info", content: `Task #${data.task_id} started` }]);
    } catch {
      setRunning(false);
      setLogs((prev) => [...prev, { agent: "system", type: "error", content: "Failed to start task" }]);
    }
  };

  const getAgentColor = (agent: string) => {
    const colors: Record<string, string> = {
      planner: "text-blue-400",
      coder: "text-green-400",
      tester: "text-yellow-400",
      deployer: "text-purple-400",
      orchestrator: "text-cyan-400",
      system: "text-gray-400",
    };
    return colors[agent] || "text-gray-400";
  };

  const getTypeIcon = (type: string) => {
    if (type === "error") return "text-red-400";
    if (type === "warning") return "text-yellow-400";
    if (type === "command") return "text-cyan-300";
    return "text-gray-300";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-400" /> Agent Mode
          </h1>
          <p className="text-gray-500 text-sm mt-1">Autonomous multi-agent task execution</p>
        </div>
      </div>

      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4 space-y-4">
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe your task... (e.g., 'Create a Python Flask REST API with user authentication')"
          className="w-full h-24 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none transition-all"
        />
        <div className="flex items-center gap-3">
          <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500">
            {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
            {models.length === 0 && <option>No models</option>}
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500">
            <option value="full">Full Pipeline</option>
            <option value="code">Plan + Code</option>
            <option value="test">Plan + Test</option>
          </select>
          <button onClick={executeTask} disabled={running || !task.trim()} className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium rounded-lg transition-all">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running..." : "Execute"}
          </button>
        </div>
      </div>

      <div className="bg-gray-950 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/50">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-gray-300">Live Terminal</span>
          {running && <span className="ml-auto flex items-center gap-1 text-xs text-green-400"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Running</span>}
          {taskId && <span className="text-xs text-gray-600 ml-2">Task #{taskId}</span>}
        </div>
        <div className="h-96 overflow-y-auto p-4 font-mono text-sm space-y-1">
          {logs.length === 0 && (
            <div className="text-gray-600 text-center py-12">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Waiting for task execution...</p>
            </div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className={`font-semibold ${getAgentColor(log.agent)}`}>[{log.agent}]</span>
              <span className={getTypeIcon(log.type)}>{log.content}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
