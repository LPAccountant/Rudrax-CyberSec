import { useState } from "react";
import { api } from "@/services/api";
import { Globe, Search, Link2, TestTube } from "lucide-react";

export default function BrowserAgentPage() {
  const [activeTab, setActiveTab] = useState<"browse" | "crawl" | "api-test" | "api-analyze">("browse");
  const [url, setUrl] = useState("");
  const [extractType, setExtractType] = useState("text");
  const [crawlPages, setCrawlPages] = useState(10);
  const [apiMethod, setApiMethod] = useState("GET");
  const [apiHeaders, setApiHeaders] = useState("");
  const [apiBody, setApiBody] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function browse() {
    if (!url) return;
    setLoading(true);
    try {
      setResult(await api.browserBrowse({ url, extract_type: extractType }));
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  async function crawl() {
    if (!url) return;
    setLoading(true);
    try {
      setResult(await api.browserCrawl({ url, max_pages: crawlPages }));
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  async function apiTest() {
    if (!url) return;
    setLoading(true);
    try {
      const headers = apiHeaders ? JSON.parse(apiHeaders) : undefined;
      setResult(await api.browserApiTest({ url, method: apiMethod, headers, body: apiBody || undefined }));
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  async function apiAnalyze() {
    if (!url) return;
    setLoading(true);
    try {
      setResult(await api.browserApiAnalyze({ url }));
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe className="w-6 h-6 text-cyan-400" />
          Browser & API Agent
        </h1>
        <p className="text-gray-400 text-sm mt-1">Web browsing automation and API testing</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([
          { key: "browse", label: "Browse URL", icon: Search },
          { key: "crawl", label: "Crawl Site", icon: Link2 },
          { key: "api-test", label: "API Tester", icon: TestTube },
          { key: "api-analyze", label: "API Analyze", icon: Globe },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === key ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          {activeTab === "browse" && (
            <select className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm" value={extractType} onChange={(e) => setExtractType(e.target.value)}>
              <option value="text">Text</option>
              <option value="headers">Headers</option>
              <option value="links">Links</option>
              <option value="forms">Forms</option>
            </select>
          )}
          {activeTab === "crawl" && (
            <input
              type="number"
              className="w-24 bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm"
              placeholder="Pages"
              value={crawlPages}
              onChange={(e) => setCrawlPages(Number(e.target.value))}
            />
          )}
          {activeTab === "api-test" && (
            <select className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm" value={apiMethod} onChange={(e) => setApiMethod(e.target.value)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          )}
        </div>

        {activeTab === "api-test" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Headers (JSON)</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm h-24 resize-none"
                placeholder='{"Authorization": "Bearer ..."}'
                value={apiHeaders}
                onChange={(e) => setApiHeaders(e.target.value)}
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Body</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm h-24 resize-none"
                placeholder='{"key": "value"}'
                value={apiBody}
                onChange={(e) => setApiBody(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          onClick={activeTab === "browse" ? browse : activeTab === "crawl" ? crawl : activeTab === "api-test" ? apiTest : apiAnalyze}
          disabled={loading}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Processing..." : "Execute"}
        </button>
      </div>

      {result && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3">Results</h3>
          <pre className="text-gray-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-800 rounded-lg p-4">
            {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
