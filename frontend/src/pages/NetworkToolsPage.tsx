import { useState } from "react";
import { api } from "@/services/api";
import { Wifi, Search, Shield, Route, Radio, Lock, Server, Eye } from "lucide-react";

export default function NetworkToolsPage() {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState("basic");
  const [ports, setPorts] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [activeTool, setActiveTool] = useState("nmap");
  const [hashValue, setHashValue] = useState("");
  const [hashType, setHashType] = useState("auto");
  const [password, setPassword] = useState("");

  const tools = [
    { key: "nmap", label: "Nmap Scan", icon: Search },
    { key: "nikto", label: "Nikto", icon: Shield },
    { key: "traceroute", label: "Traceroute", icon: Route },
    { key: "banner", label: "Banner Grab", icon: Radio },
    { key: "waf", label: "WAF Detect", icon: Shield },
    { key: "cms", label: "CMS Detect", icon: Server },
    { key: "discovery", label: "Network Scan", icon: Wifi },
    { key: "password-audit", label: "Password Audit", icon: Lock },
    { key: "password-strength", label: "Password Check", icon: Eye },
  ];

  async function runTool() {
    setLoading(true);
    setResult(null);
    try {
      let res: Record<string, unknown>;
      switch (activeTool) {
        case "nmap":
          res = await api.networkNmap({ target, scan_type: scanType, ports, confirmed: true });
          break;
        case "nikto":
          res = await api.networkNikto({ target, confirmed: true });
          break;
        case "traceroute":
          res = await api.networkTraceroute({ target, confirmed: true });
          break;
        case "banner":
          res = await api.networkBannerGrab({ target, ports: ports || "80", confirmed: true });
          break;
        case "waf":
          res = await api.networkWafDetect({ target, confirmed: true });
          break;
        case "cms":
          res = await api.networkCmsDetect({ target, confirmed: true });
          break;
        case "discovery":
          res = await api.networkDiscovery({ target, confirmed: true });
          break;
        case "password-audit":
          res = await api.networkPasswordAudit({ hash_value: hashValue, hash_type: hashType });
          break;
        case "password-strength":
          res = await api.networkPasswordStrength({ password });
          break;
        default:
          res = { error: "Unknown tool" };
      }
      setResult(res);
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  const isPasswordTool = activeTool.startsWith("password");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wifi className="w-6 h-6 text-cyan-400" />
          Network Tools
        </h1>
        <p className="text-gray-400 text-sm mt-1">Comprehensive networking and security scanning toolkit</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tools.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTool === key ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
        {!isPasswordTool ? (
          <>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
                placeholder={activeTool === "discovery" ? "192.168.1.0/24" : "target.com or IP address"}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              {activeTool === "nmap" && (
                <>
                  <select className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm" value={scanType} onChange={(e) => setScanType(e.target.value)}>
                    <option value="basic">Basic</option>
                    <option value="stealth">Stealth</option>
                    <option value="aggressive">Aggressive</option>
                    <option value="vuln">Vuln Scan</option>
                    <option value="os_detect">OS Detect</option>
                    <option value="service">Service</option>
                    <option value="full">Full</option>
                  </select>
                  <input
                    className="w-32 bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm"
                    placeholder="Ports"
                    value={ports}
                    onChange={(e) => setPorts(e.target.value)}
                  />
                </>
              )}
            </div>
          </>
        ) : activeTool === "password-audit" ? (
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
              placeholder="Enter hash value (MD5/SHA1/SHA256/SHA512)"
              value={hashValue}
              onChange={(e) => setHashValue(e.target.value)}
            />
            <select className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm" value={hashType} onChange={(e) => setHashType(e.target.value)}>
              <option value="auto">Auto Detect</option>
              <option value="md5">MD5</option>
              <option value="sha1">SHA1</option>
              <option value="sha256">SHA256</option>
              <option value="sha512">SHA512</option>
            </select>
          </div>
        ) : (
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
            placeholder="Enter password to check strength"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="text"
          />
        )}

        <button
          onClick={runTool}
          disabled={loading}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Running..." : "Execute"}
        </button>
      </div>

      {result && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Results</h3>
            {result.status && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${result.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {String(result.status).toUpperCase()}
              </span>
            )}
          </div>

          {activeTool === "password-strength" && result.strength && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-white text-sm">Strength:</span>
                <span className={`font-bold ${
                  result.strength === "excellent" || result.strength === "very_strong" ? "text-green-400" :
                  result.strength === "strong" ? "text-blue-400" :
                  result.strength === "medium" ? "text-yellow-400" : "text-red-400"
                }`}>
                  {String(result.strength).toUpperCase()}
                </span>
                <span className="text-gray-500 text-xs">({String(result.score)}/{String(result.max_score)})</span>
              </div>
              <div className="bg-gray-800 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    Number(result.score) >= 6 ? "bg-green-500" : Number(result.score) >= 4 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${(Number(result.score) / Number(result.max_score)) * 100}%` }}
                />
              </div>
              {Array.isArray(result.feedback) && result.feedback.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(result.feedback as string[]).map((f, i) => (
                    <li key={i} className="text-gray-400 text-xs flex items-center gap-1">
                      <span className="text-yellow-500">!</span> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <pre className="text-gray-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-800 rounded-lg p-4">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
