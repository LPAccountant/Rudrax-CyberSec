import { useState } from "react";
import { api } from "@/services/api";
import { Mic, Globe, Languages, Send } from "lucide-react";

export default function VoiceAgentPage() {
  const [text, setText] = useState("");
  const [model, setModel] = useState("llama3");
  const [context, setContext] = useState("cybersecurity");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "translate" | "detect">("chat");
  const [translateText, setTranslateText] = useState("");
  const [targetLang, setTargetLang] = useState("en");
  const [translateResult, setTranslateResult] = useState("");

  async function processVoice() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await api.voiceProcess({ text, model, context });
      setResult(res);
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  async function detectLanguage() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await api.voiceDetectLanguage({ text });
      setResult(res);
    } catch (e) {
      setResult({ error: String(e) });
    }
    setLoading(false);
  }

  async function translate() {
    if (!translateText.trim()) return;
    setLoading(true);
    try {
      const res = await api.voiceTranslate({ text: translateText, target_language: targetLang, model });
      setTranslateResult(res.translated);
    } catch (e) {
      setTranslateResult("Error: " + String(e));
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Mic className="w-6 h-6 text-cyan-400" />
          Voice Agent
        </h1>
        <p className="text-gray-400 text-sm mt-1">Hindi / English / Hinglish AI Assistant</p>
      </div>

      <div className="flex gap-2">
        {(["chat", "translate", "detect"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
            }`}
          >
            {tab === "chat" ? "Voice Chat" : tab === "translate" ? "Translate" : "Detect Language"}
          </button>
        ))}
      </div>

      {activeTab === "chat" && (
        <div className="space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
            <div className="flex gap-4 mb-4">
              <select className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm flex-1" value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="llama3">Llama 3</option>
                <option value="mistral">Mistral</option>
                <option value="codellama">CodeLlama</option>
              </select>
              <select className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm flex-1" value={context} onChange={(e) => setContext(e.target.value)}>
                <option value="cybersecurity">Cybersecurity</option>
                <option value="coding">Coding</option>
                <option value="general">General</option>
                <option value="networking">Networking</option>
              </select>
            </div>
            <div className="flex gap-2">
              <textarea
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm resize-none h-24"
                placeholder="Type in Hindi, English, or Hinglish... (e.g., 'Mujhe ek nmap scan karna hai target pe')"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={processVoice}
                disabled={loading}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {loading ? "Processing..." : "Send"}
              </button>
              <button
                onClick={detectLanguage}
                disabled={loading}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Detect
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                  {typeof result.detected_language === "string" && (
                    <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-xs font-medium">
                      {result.detected_language.toUpperCase()}
                    </span>
                  )}
              </div>
              <div className="text-gray-300 text-sm whitespace-pre-wrap">
                {result.response ? String(result.response) : JSON.stringify(result, null, 2)}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "translate" && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-gray-400 text-xs mb-1 block">Input Text</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm h-32 resize-none"
                placeholder="Enter text to translate..."
                value={translateText}
                onChange={(e) => setTranslateText(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-gray-400 text-xs mb-1 block">Translation</label>
              <div className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-gray-300 text-sm h-32 overflow-y-auto">
                {translateResult || "Translation will appear here..."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select className="bg-gray-800 border border-gray-700 rounded-lg p-2 text-white text-sm" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </select>
            <button onClick={translate} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              <Languages className="w-4 h-4" />
              {loading ? "Translating..." : "Translate"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "detect" && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm h-32 resize-none"
            placeholder="Enter text to detect language..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button onClick={detectLanguage} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {loading ? "Detecting..." : "Detect Language"}
          </button>
          {result && (
            <div className="bg-gray-800 rounded-lg p-4">
              <pre className="text-gray-300 text-sm">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
