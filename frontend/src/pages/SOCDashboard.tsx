import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { Shield, AlertTriangle, CheckCircle, Activity, FileText, Search, Brain } from "lucide-react";

interface DashboardStats {
  severity_stats: Record<string, number>;
  unresolved_count: number;
  events_last_24h: number;
  events_last_7d: number;
  top_event_types: Array<{ event_type: string; count: number }>;
  timeline: Array<{ day: string; count: number }>;
  recent_events: Array<Record<string, unknown>>;
  total_scans: number;
  total_reports: number;
  completed_tasks: number;
}

interface PatchSuggestion {
  id: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
}

export default function SOCDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [patches, setPatches] = useState<PatchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "patches">("overview");
  const [eventForm, setEventForm] = useState({ event_type: "", severity: "info", description: "", source: "" });
  const [analyzeData, setAnalyzeData] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [dashData, patchData] = await Promise.all([
        api.socDashboard(),
        api.socPatches(),
      ]);
      setStats(dashData);
      setPatches(patchData);
    } catch {
      /* empty */
    }
    setLoading(false);
  }

  async function createEvent() {
    if (!eventForm.event_type || !eventForm.description) return;
    await api.socCreateEvent(eventForm);
    setEventForm({ event_type: "", severity: "info", description: "", source: "" });
    loadDashboard();
  }

  async function analyzeEvent() {
    if (!analyzeData) return;
    setAnalyzing(true);
    try {
      const result = await api.socAnalyze({ event_data: JSON.parse(analyzeData) });
      setAnalysisResult(result.analysis || JSON.stringify(result, null, 2));
    } catch (e) {
      setAnalysisResult("Error: " + String(e));
    }
    setAnalyzing(false);
  }

  async function generatePatch(finding: Record<string, unknown>) {
    await api.socAutoPatch({ finding });
    const patchData = await api.socPatches();
    setPatches(patchData);
  }

  const sevColors: Record<string, string> = {
    critical: "text-red-500 bg-red-500/10",
    high: "text-orange-500 bg-orange-500/10",
    medium: "text-yellow-500 bg-yellow-500/10",
    low: "text-blue-500 bg-blue-500/10",
    info: "text-gray-400 bg-gray-500/10",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-cyan-400 animate-pulse">Loading SOC Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-cyan-400" />
            AI SOC Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">Security Operations Center - Real-time threat monitoring</p>
        </div>
        <div className="flex gap-2">
          {(["overview", "events", "patches"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<AlertTriangle className="w-5 h-5 text-red-400" />} label="Unresolved" value={stats?.unresolved_count || 0} color="red" />
            <StatCard icon={<Activity className="w-5 h-5 text-yellow-400" />} label="Last 24h" value={stats?.events_last_24h || 0} color="yellow" />
            <StatCard icon={<Search className="w-5 h-5 text-blue-400" />} label="Total Scans" value={stats?.total_scans || 0} color="blue" />
            <StatCard icon={<FileText className="w-5 h-5 text-green-400" />} label="Reports" value={stats?.total_reports || 0} color="green" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Severity Distribution</h3>
              <div className="space-y-3">
                {["critical", "high", "medium", "low", "info"].map((sev) => (
                  <div key={sev} className="flex items-center gap-3">
                    <span className={`text-xs font-medium w-16 ${sevColors[sev]?.split(" ")[0]}`}>{sev.toUpperCase()}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${sev === "critical" ? "bg-red-500" : sev === "high" ? "bg-orange-500" : sev === "medium" ? "bg-yellow-500" : sev === "low" ? "bg-blue-500" : "bg-gray-500"}`}
                        style={{ width: `${Math.min(100, ((stats?.severity_stats[sev] || 0) / Math.max(1, stats?.events_last_7d || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-sm w-8 text-right">{stats?.severity_stats[sev] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">AI Event Analysis</h3>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm h-24 resize-none"
                placeholder='Paste event JSON to analyze, e.g. {"event_type": "ssh_brute_force", "source_ip": "192.168.1.100"}'
                value={analyzeData}
                onChange={(e) => setAnalyzeData(e.target.value)}
              />
              <button
                onClick={analyzeEvent}
                disabled={analyzing}
                className="mt-2 w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Brain className="w-4 h-4" />
                {analyzing ? "Analyzing..." : "Analyze with AI"}
              </button>
              {analysisResult && (
                <pre className="mt-3 bg-gray-800 p-3 rounded-lg text-xs text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap">{analysisResult}</pre>
              )}
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Recent Events</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(stats?.recent_events || []).map((ev, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${sevColors[String(ev.severity)] || sevColors.info}`}>
                      {String(ev.severity || "info").toUpperCase()}
                    </span>
                    <span className="text-white text-sm">{String(ev.event_type)}</span>
                    <span className="text-gray-500 text-xs">{String(ev.description).slice(0, 60)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!ev.is_resolved && (
                      <button
                        onClick={() => generatePatch({ vulnerability: String(ev.event_type), severity: String(ev.severity), description: String(ev.description) })}
                        className="text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        Auto-Patch
                      </button>
                    )}
                    <span className="text-gray-600 text-xs">{String(ev.created_at).slice(0, 16)}</span>
                  </div>
                </div>
              ))}
              {(!stats?.recent_events || stats.recent_events.length === 0) && (
                <p className="text-gray-500 text-sm text-center py-4">No events yet. Create events from scan results or manually.</p>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === "events" && (
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">Create Security Event</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
                placeholder="Event type (e.g. ssh_brute_force)"
                value={eventForm.event_type}
                onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
              />
              <select
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
                value={eventForm.severity}
                onChange={(e) => setEventForm({ ...eventForm, severity: e.target.value })}
              >
                <option value="info">Info</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <input
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
                placeholder="Source (e.g. IP address)"
                value={eventForm.source}
                onChange={(e) => setEventForm({ ...eventForm, source: e.target.value })}
              />
              <input
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
                placeholder="Description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
              />
            </div>
            <button onClick={createEvent} className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm font-medium">
              Create Event
            </button>
          </div>
        </div>
      )}

      {activeTab === "patches" && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold">Auto-Patch Suggestions</h3>
          {patches.map((patch) => (
            <div key={patch.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-medium">{patch.title}</h4>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${sevColors[patch.severity] || sevColors.info}`}>
                  {patch.severity.toUpperCase()}
                </span>
              </div>
              <pre className="text-gray-400 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">{patch.description}</pre>
              <div className="flex items-center justify-between mt-3">
                <span className="text-gray-600 text-xs">{patch.created_at}</span>
                <span className={`text-xs font-medium ${patch.status === "applied" ? "text-green-400" : "text-yellow-400"}`}>
                  {patch.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
          {patches.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No patch suggestions yet. Run scans and generate patches from findings.</p>}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = { red: "border-red-500/20", yellow: "border-yellow-500/20", blue: "border-blue-500/20", green: "border-green-500/20" };
  return (
    <div className={`bg-gray-900/50 border ${bgMap[color] || "border-gray-800"} rounded-xl p-4`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
