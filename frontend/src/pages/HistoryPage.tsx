import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { History, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  agent_type: string;
  model_used: string;
  result: string | null;
  logs: string | null;
  created_at: string;
  updated_at: string;
}

interface LogEntry {
  id: number;
  task_id: number;
  agent_name: string;
  log_type: string;
  message: string;
  created_at: string;
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [taskLogs, setTaskLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.getTasks().then(setTasks).catch(() => {});
  }, []);

  const toggleTask = async (taskId: number) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      return;
    }
    setExpandedTask(taskId);
    const logs = await api.getTaskLogs(taskId);
    setTaskLogs(logs);
  };

  const deleteTask = async (id: number) => {
    await api.deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: "text-green-400 bg-green-500/10 border-green-500/20",
      running: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      failed: "text-red-400 bg-red-500/10 border-red-500/20",
      pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    };
    return colors[status] || "text-gray-400 bg-gray-500/10 border-gray-500/20";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-cyan-400" /> Task History
        </h1>
        <p className="text-gray-500 text-sm mt-1">Past agent executions and logs</p>
      </div>

      {tasks.length === 0 && (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
          <History className="w-10 h-10 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500">No tasks yet. Run an agent task to see history.</p>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center px-5 py-4 cursor-pointer hover:bg-gray-800/30 transition-all" onClick={() => toggleTask(task.id)}>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-medium text-sm">{task.title}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(task.status)}`}>{task.status}</span>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Model: {task.model_used || "N/A"} | {new Date(task.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-1.5 text-gray-600 hover:text-red-400 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
                {expandedTask === task.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </div>

            {expandedTask === task.id && (
              <div className="border-t border-gray-800 px-5 py-4">
                {task.description && <p className="text-gray-400 text-sm mb-3">{task.description}</p>}
                <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                  {taskLogs.length === 0 && <p className="text-gray-600">No logs available</p>}
                  {taskLogs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-gray-600">{new Date(log.created_at).toLocaleTimeString()}</span>
                      <span className="text-cyan-400">[{log.agent_name}]</span>
                      <span className={log.log_type === "error" ? "text-red-400" : "text-gray-300"}>{log.message.slice(0, 200)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
