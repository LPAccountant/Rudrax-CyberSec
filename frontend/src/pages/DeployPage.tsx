import { useState, useEffect } from "react";
import { api } from "@/services/api";
import {
  Rocket,
  Plus,
  Play,
  Square,
  RefreshCw,
  Trash2,
  FileText,
  GitBranch,
  Terminal,
  X,
  Hammer,
} from "lucide-react";

interface Deployment {
  id: number;
  name: string;
  git_url: string;
  branch: string;
  deploy_path: string;
  build_command: string;
  run_command: string;
  port: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function DeployPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showLogs, setShowLogs] = useState<number | null>(null);
  const [logs, setLogs] = useState({ build_logs: "", runtime_logs: "" });
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    git_url: "",
    branch: "main",
    build_command: "",
    run_command: "",
    port: 0,
    env_vars: "",
  });

  useEffect(() => {
    loadDeployments();
  }, []);

  async function loadDeployments() {
    setLoading(true);
    try {
      const data = await api.deployList();
      setDeployments(Array.isArray(data) ? data : []);
    } catch {
      setDeployments([]);
    }
    setLoading(false);
  }

  async function createDeployment() {
    if (!form.name) return;
    setCreating(true);
    try {
      let envVars: Record<string, string> | undefined;
      if (form.env_vars.trim()) {
        envVars = {};
        for (const line of form.env_vars.split("\n")) {
          const idx = line.indexOf("=");
          if (idx > 0) {
            envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
          }
        }
      }
      await api.deployCreate({
        name: form.name,
        git_url: form.git_url || undefined,
        branch: form.branch,
        build_command: form.build_command,
        run_command: form.run_command,
        port: form.port,
        env_vars: envVars,
      });
      setForm({ name: "", git_url: "", branch: "main", build_command: "", run_command: "", port: 0, env_vars: "" });
      setShowCreate(false);
      loadDeployments();
    } catch (e) {
      alert("Deploy failed: " + String(e));
    }
    setCreating(false);
  }

  async function doAction(id: number, action: string) {
    setActionLoading(id);
    try {
      const res = await api.deployAction(id, action);
      if (res.error) alert(res.error);
      loadDeployments();
    } catch (e) {
      alert("Action failed: " + String(e));
    }
    setActionLoading(null);
  }

  async function viewLogs(id: number) {
    setShowLogs(id);
    try {
      const data = await api.deployLogs(id);
      setLogs(data);
    } catch {
      setLogs({ build_logs: "Failed to load logs", runtime_logs: "" });
    }
  }

  const statusColor: Record<string, string> = {
    running: "bg-green-500/10 text-green-400 border-green-500/20",
    stopped: "bg-red-500/10 text-red-400 border-red-500/20",
    ready: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Rocket className="w-6 h-6 text-cyan-400" />
            Deploy Projects
          </h1>
          <p className="text-gray-400 text-sm mt-1">Clone, build, and deploy projects on this server</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDeployments}
            className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Deployment
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Rocket className="w-4 h-4 text-cyan-400" />
              Create Deployment
            </h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Deployment Name *</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="my-web-app"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Git URL</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="https://github.com/user/repo.git"
                value={form.git_url}
                onChange={(e) => setForm({ ...form, git_url: e.target.value })}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Branch</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="main"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Port</label>
              <input
                type="number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="3000"
                value={form.port || ""}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Build Command</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="npm install && npm run build"
                value={form.build_command}
                onChange={(e) => setForm({ ...form, build_command: e.target.value })}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Run Command</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none"
                placeholder="npm start"
                value={form.run_command}
                onChange={(e) => setForm({ ...form, run_command: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Environment Variables (KEY=VALUE, one per line)</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none h-20 font-mono"
              placeholder={"NODE_ENV=production\nPORT=3000"}
              value={form.env_vars}
              onChange={(e) => setForm({ ...form, env_vars: e.target.value })}
            />
          </div>
          <button
            onClick={createDeployment}
            disabled={creating || !form.name}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Deploy
              </>
            )}
          </button>
        </div>
      )}

      {showLogs !== null && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Deployment Logs
            </h3>
            <button onClick={() => setShowLogs(null)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {logs.build_logs && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Build Logs:</p>
              <pre className="bg-black/50 rounded-lg p-3 text-xs text-green-400 font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                {logs.build_logs}
              </pre>
            </div>
          )}
          {logs.runtime_logs && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Runtime Logs:</p>
              <pre className="bg-black/50 rounded-lg p-3 text-xs text-cyan-400 font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                {logs.runtime_logs}
              </pre>
            </div>
          )}
          {!logs.build_logs && !logs.runtime_logs && (
            <p className="text-gray-500 text-sm">No logs available</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-cyan-400 animate-pulse">Loading deployments...</div>
        </div>
      ) : deployments.length === 0 ? (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
          <Rocket className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No deployments yet. Create one to get started.</p>
          <p className="text-gray-600 text-xs mt-2">
            Clone a Git repo, set build/run commands, and deploy it on this server.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deployments.map((d) => (
            <div
              key={d.id}
              className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">{d.name}</span>
                  </h4>
                  {d.git_url && (
                    <p className="text-gray-500 text-xs mt-1 flex items-center gap-1 truncate">
                      <GitBranch className="w-3 h-3 flex-shrink-0" />
                      {d.git_url} ({d.branch})
                    </p>
                  )}
                </div>
                <span
                  className={`px-2.5 py-1 text-xs rounded-full border font-medium flex-shrink-0 ml-2 ${
                    statusColor[d.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"
                  }`}
                >
                  {d.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                {d.deploy_path && <p className="font-mono truncate">{d.deploy_path}</p>}
                {d.port > 0 && <p>Port: {d.port}</p>}
                {d.run_command && (
                  <p className="truncate">
                    Run: <span className="text-gray-400 font-mono">{d.run_command}</span>
                  </p>
                )}
                <p>Created: {d.created_at?.slice(0, 16)}</p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {d.status !== "running" && d.run_command && (
                  <button
                    onClick={() => doAction(d.id, "start")}
                    disabled={actionLoading === d.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs hover:bg-green-500/20 transition-all disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" /> Start
                  </button>
                )}
                {d.status === "running" && (
                  <button
                    onClick={() => doAction(d.id, "stop")}
                    disabled={actionLoading === d.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    <Square className="w-3 h-3" /> Stop
                  </button>
                )}
                {d.run_command && (
                  <button
                    onClick={() => doAction(d.id, "restart")}
                    disabled={actionLoading === d.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" /> Restart
                  </button>
                )}
                {(d.git_url || d.build_command) && (
                  <button
                    onClick={() => doAction(d.id, "rebuild")}
                    disabled={actionLoading === d.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-xs hover:bg-purple-500/20 transition-all disabled:opacity-50"
                  >
                    <Hammer className="w-3 h-3" /> Rebuild
                  </button>
                )}
                <button
                  onClick={() => viewLogs(d.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg text-xs hover:bg-gray-700 hover:text-white transition-all"
                >
                  <FileText className="w-3 h-3" /> Logs
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this deployment?")) doAction(d.id, "delete");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
