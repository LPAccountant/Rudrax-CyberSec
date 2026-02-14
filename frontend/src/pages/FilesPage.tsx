import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { FolderOpen, File, Trash2, Download, Save, ArrowLeft, Plus } from "lucide-react";

interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [editing, setEditing] = useState<{ path: string; content: string } | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [showNew, setShowNew] = useState(false);

  const loadFiles = async (path: string = "") => {
    const data = await api.listFiles(path);
    setFiles(data);
    setCurrentPath(path);
    setEditing(null);
  };

  useEffect(() => { loadFiles(); }, []);

  const openFile = async (item: FileItem) => {
    if (item.is_dir) {
      loadFiles(item.path);
    } else {
      const data = await api.readFile(item.path);
      setEditing({ path: data.path, content: data.content });
    }
  };

  const saveFile = async () => {
    if (!editing) return;
    await api.writeFile(editing.path, editing.content);
    setEditing(null);
    loadFiles(currentPath);
  };

  const deleteItem = async (path: string) => {
    await api.deleteFile(path);
    loadFiles(currentPath);
  };

  const goUp = () => {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    loadFiles(parts.join("/"));
  };

  const createFile = async () => {
    if (!newFileName.trim()) return;
    const path = currentPath ? `${currentPath}/${newFileName}` : newFileName;
    await api.writeFile(path, "");
    setNewFileName("");
    setShowNew(false);
    loadFiles(currentPath);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-cyan-400" /> File Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">Workspace: /{currentPath || "root"}</p>
        </div>
        <div className="flex gap-2">
          {currentPath && (
            <button onClick={goUp} className="flex items-center gap-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-all">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-all">
            <Plus className="w-4 h-4" /> New File
          </button>
        </div>
      </div>

      {showNew && (
        <div className="flex gap-2 bg-gray-900/50 rounded-xl border border-gray-800 p-3">
          <input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.txt"
            className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => e.key === "Enter" && createFile()}
          />
          <button onClick={createFile} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg">Create</button>
        </div>
      )}

      {editing ? (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/80">
            <span className="text-sm text-gray-300 font-mono">{editing.path}</span>
            <div className="flex gap-2">
              <button onClick={saveFile} className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded-lg">
                <Save className="w-3 h-3" /> Save
              </button>
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg">Close</button>
            </div>
          </div>
          <textarea
            value={editing.content}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            className="w-full h-96 p-4 bg-gray-950 text-gray-200 font-mono text-sm resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
          {files.length === 0 ? (
            <div className="p-12 text-center text-gray-600">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No files in workspace</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {files.map((f) => (
                <div key={f.path} className="flex items-center px-4 py-3 hover:bg-gray-800/30 transition-all group">
                  <button onClick={() => openFile(f)} className="flex items-center gap-3 flex-1 text-left">
                    {f.is_dir ? <FolderOpen className="w-4 h-4 text-cyan-400" /> : <File className="w-4 h-4 text-gray-500" />}
                    <span className={`text-sm ${f.is_dir ? "text-cyan-400" : "text-gray-300"}`}>{f.name}</span>
                  </button>
                  <span className="text-xs text-gray-600 mr-4">{f.is_dir ? "DIR" : formatSize(f.size)}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!f.is_dir && (
                      <a href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/files/download?path=${encodeURIComponent(f.path)}`} className="p-1.5 text-gray-500 hover:text-cyan-400 transition-all">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => deleteItem(f.path)} className="p-1.5 text-gray-500 hover:text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
