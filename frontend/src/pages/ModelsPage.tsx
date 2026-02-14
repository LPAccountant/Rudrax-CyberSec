import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { Cpu, RefreshCw, Wifi, WifiOff } from "lucide-react";

interface ModelInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  modified_at: string;
  details: Record<string, unknown>;
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([api.getModels(), api.getOllamaStatus()]);
      setModels(m);
      setOnline(s.online);
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "N/A";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-cyan-400" /> Ollama Models
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage local LLM models</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${online ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? "Ollama Online" : "Ollama Offline"}
          </div>
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {models.length === 0 && !loading && (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
          <Cpu className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No models found. Make sure Ollama is running and has models installed.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((m) => (
          <div key={m.name} className="bg-gray-900/50 rounded-xl border border-gray-800 p-5 hover:border-cyan-500/30 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold">{m.name}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{m.digest?.slice(0, 12)}</p>
              </div>
              <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded-full border border-cyan-500/20">
                {formatSize(m.size)}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-400">
              {m.details && typeof m.details === "object" && (
                <>
                  {(m.details as Record<string, unknown>).family && <p>Family: <span className="text-gray-300">{String((m.details as Record<string, unknown>).family)}</span></p>}
                  {(m.details as Record<string, unknown>).parameter_size && <p>Parameters: <span className="text-gray-300">{String((m.details as Record<string, unknown>).parameter_size)}</span></p>}
                  {(m.details as Record<string, unknown>).quantization_level && <p>Quantization: <span className="text-gray-300">{String((m.details as Record<string, unknown>).quantization_level)}</span></p>}
                </>
              )}
              {m.modified_at && <p className="text-xs text-gray-600">Modified: {new Date(m.modified_at).toLocaleDateString()}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
