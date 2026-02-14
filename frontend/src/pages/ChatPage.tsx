import { useState, useEffect, useRef } from "react";
import { api } from "@/services/api";
import { Send, Plus, Trash2, Loader2 } from "lucide-react";

interface Message {
  id?: number;
  role: string;
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("llama3");
  const [models, setModels] = useState<{ name: string }[]>([]);
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [sessions, setSessions] = useState<{ session_id: string; started_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getModels().then((m) => { if (m.length) { setModels(m); setModel(m[0].name); } });
    api.getChatSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (sid: string) => {
    setSessionId(sid);
    const history = await api.getChatHistory(sid);
    setMessages(history);
  };

  const newSession = () => {
    setSessionId(`session-${Date.now()}`);
    setMessages([]);
  };

  const deleteSession = async (sid: string) => {
    await api.deleteSession(sid);
    setSessions((prev) => prev.filter((s) => s.session_id !== sid));
    if (sid === sessionId) newSession();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const data = await api.sendChat(userMsg, model, sessionId);
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      api.getChatSessions().then(setSessions).catch(() => {});
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: Failed to get response" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      <div className="w-56 bg-gray-900/50 rounded-xl border border-gray-800 flex flex-col">
        <div className="p-3 border-b border-gray-800">
          <button onClick={newSession} className="flex items-center gap-2 w-full px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-all">
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <div key={s.session_id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-all ${s.session_id === sessionId ? "bg-cyan-500/10 text-cyan-400" : "text-gray-400 hover:bg-gray-800/50"}`}>
              <span onClick={() => loadSession(s.session_id)} className="truncate flex-1">{s.session_id.slice(0, 16)}...</span>
              <button onClick={() => deleteSession(s.session_id)} className="text-gray-600 hover:text-red-400 ml-1"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-900/30 rounded-xl border border-gray-800">
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-white font-semibold">Chat</h2>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500">
            {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
            {models.length === 0 && <option>No models available</option>}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center text-gray-600">
                <p className="text-lg font-medium">Start a conversation</p>
                <p className="text-sm mt-1">Select a model and type your message below</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-200 border border-gray-700"}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-all">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
