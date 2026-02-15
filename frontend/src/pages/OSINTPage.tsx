import { useState } from "react";
import { api } from "@/services/api";
import { Eye, Search, Globe, Mail, Server, Code, FileText } from "lucide-react";

export default function OSINTPage() {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<"deep" | "whois" | "dns" | "subdomains" | "http" | "emails" | "tech">("deep");

  const tools = [
    { key: "deep", label: "Deep OSINT", icon: Eye, desc: "Full intelligence gathering" },
    { key: "whois", label: "WHOIS", icon: Globe, desc: "Domain registration info" },
    { key: "dns", label: "DNS Enum", icon: Server, desc: "DNS record enumeration" },
    { key: "subdomains", label: "Subdomains", icon: Search, desc: "Subdomain discovery" },
    { key: "http", label: "HTTP Recon", icon: Globe, desc: "HTTP reconnaissance" },
    { key: "emails", label: "Email Harvest", icon: Mail, desc: "Email address discovery" },
    { key: "tech", label: "Tech Stack", icon: Code, desc: "Technology detection" },
  ] as const;

  async function runScan() {
    if (!target) return;
    setLoading(true);
    setResult(null);
    try {
      const apiMap: Record<string, (args: { target: string; confirmed: boolean }) => Promise<Record<string, unknown>>> = {
        deep: api.osintDeepScan,
        whois: api.osintWhois,
        dns: api.osintDns,
        subdomains: api.osintSubdomains,
        http: api.osintHttpRecon,
        emails: api.osintEmails,
        tech: api.osintTechStack,
      };
      const fn = apiMap[activeTab];
      if (fn) {
        const res = await fn({ target, confirmed: true });
        setResult(res);
      }
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  async function generateReport(){
    if (!target) return;
    setLoading(true);
    try {
      const res = await api.osintGenerateReport({ target, confirmed: true });
      setResult(res);
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Eye className="w-6 h-6 text-cyan-400" />
          OSINT Agent
        </h1>
        <p className="text-gray-400 text-sm mt-1">One-click deep intelligence gathering</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tools.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === key ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
            placeholder="Enter domain (e.g., example.com)"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <button
            onClick={runScan}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Scan"}
          </button>
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Report
          </button>
        </div>
        <p className="text-gray-500 text-xs">
          {tools.find((t) => t.key === activeTab)?.desc}
        </p>
      </div>

      {result && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3">Results</h3>
          {result.report_path ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-green-400 text-sm">Report generated successfully!</p>
              <p className="text-gray-400 text-xs mt-1">File: {String(result.filename)}</p>
            </div>
          ) : (
            <pre className="text-gray-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-800 rounded-lg p-4">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
