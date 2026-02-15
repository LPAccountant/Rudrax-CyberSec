import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { FileText, Download, Trash2, Plus } from "lucide-react";

interface Report {
  id: number;
  title: string;
  target: string;
  status: string;
  created_at: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", target: "", findings: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await api.reportsList();
      setReports(data);
    } catch {
      /* empty */
    }
    setLoading(false);
  }

  async function createReport() {
    if (!form.title || !form.target) return;
    setCreating(true);
    try {
      let findings: Array<Record<string, unknown>> = [];
      if (form.findings) {
        try {
          findings = JSON.parse(form.findings);
        } catch {
          findings = [{ vulnerability: form.findings, severity: "info", detail: form.findings }];
        }
      }
      await api.reportsGenerate({ title: form.title, target: form.target, findings });
      setForm({ title: "", target: "", findings: "" });
      setShowCreate(false);
      loadReports();
    } catch {
      /* empty */
    }
    setCreating(false);
  }

  async function deleteReport(id: number) {
    await api.reportsDelete(id);
    loadReports();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            Vulnerability Reports
          </h1>
          <p className="text-gray-400 text-sm mt-1">Generate and manage security assessment reports</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Report
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold">Generate Report</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
              placeholder="Report title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
              placeholder="Target (e.g., example.com)"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </div>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm h-32 resize-none"
            placeholder='Findings JSON array or description (e.g., [{"vulnerability": "Open port 22", "severity": "info"}])'
            value={form.findings}
            onChange={(e) => setForm({ ...form, findings: e.target.value })}
          />
          <button
            onClick={createReport}
            disabled={creating}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {creating ? "Generating..." : "Generate Report"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-cyan-400 animate-pulse">Loading reports...</div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <FileText className="w-8 h-8 text-cyan-400" />
                <div>
                  <h4 className="text-white font-medium">{report.title}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-gray-500 text-xs">{report.target}</span>
                    <span className={`text-xs font-medium ${report.status === "completed" ? "text-green-400" : "text-yellow-400"}`}>
                      {report.status}
                    </span>
                    <span className="text-gray-600 text-xs">{report.created_at?.slice(0, 16)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(`${import.meta.env.VITE_API_URL || ""}/api/reports/download/${report.id}`, "_blank")}
                  className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded-lg transition-all"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteReport(report.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No reports yet. Run scans and generate reports from findings.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
