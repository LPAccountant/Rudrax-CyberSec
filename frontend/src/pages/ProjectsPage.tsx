import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { FolderGit2, Plus, Trash2, GitPullRequest } from "lucide-react";

interface Project {
  id: number;
  name: string;
  description: string;
  path: string;
  git_url: string;
  status: string;
  created_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", git_url: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await api.projectsList();
      setProjects(data);
    } catch {
      /* empty */
    }
    setLoading(false);
  }

  async function createProject() {
    if (!form.name) return;
    setCreating(true);
    try {
      await api.projectsCreate(form);
      setForm({ name: "", description: "", git_url: "" });
      setShowCreate(false);
      loadProjects();
    } catch {
      /* empty */
    }
    setCreating(false);
  }

  async function deleteProject(id: number) {
    await api.projectsDelete(id);
    loadProjects();
  }

  async function gitPull(id: number) {
    try {
      const res = await api.projectsGitPull(id);
      alert(res.output || res.error || "Pull complete");
    } catch (e) {
      alert("Error: " + String(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-cyan-400" />
            Projects
          </h1>
          <p className="text-gray-400 text-sm mt-1">Multi-project workspace management</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-semibold">Create Project</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
              placeholder="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <input
              className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm"
              placeholder="Git URL (optional)"
              value={form.git_url}
              onChange={(e) => setForm({ ...form, git_url: e.target.value })}
            />
          </div>
          <button
            onClick={createProject}
            disabled={creating}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="text-cyan-400 animate-pulse">Loading projects...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-medium flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-cyan-400" />
                  {project.name}
                </h4>
                <div className="flex items-center gap-1">
                  {project.git_url && (
                    <button
                      onClick={() => gitPull(project.id)}
                      className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded-lg transition-all"
                      title="Git Pull"
                    >
                      <GitPullRequest className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {project.description && <p className="text-gray-400 text-sm mb-2">{project.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{project.path}</span>
                {project.git_url && <span className="text-cyan-400/60">{project.git_url}</span>}
              </div>
              <div className="text-gray-600 text-xs mt-2">{project.created_at?.slice(0, 16)}</div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="col-span-2 text-center py-12">
              <FolderGit2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No projects yet. Create one to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
