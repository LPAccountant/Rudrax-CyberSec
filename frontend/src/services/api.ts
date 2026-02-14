const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getToken(): string | null {
  return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...((options.headers as Record<string, string>) || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  return res;
}

export const api = {
  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Login failed");
    }
    return res.json();
  },

  async register(email: string, password: string, name: string) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Registration failed");
    }
    return res.json();
  },

  async getMe() {
    const res = await request("/api/auth/me");
    return res.json();
  },

  async getModels() {
    const res = await request("/api/models/");
    return res.json();
  },

  async getOllamaStatus() {
    const res = await request("/api/models/status");
    return res.json();
  },

  async sendChat(message: string, model: string, sessionId: string) {
    const res = await request("/api/chat/send", {
      method: "POST",
      body: JSON.stringify({ message, model, session_id: sessionId }),
    });
    return res.json();
  },

  async getChatHistory(sessionId: string) {
    const res = await request(`/api/chat/history?session_id=${sessionId}`);
    return res.json();
  },

  async getChatSessions() {
    const res = await request("/api/chat/sessions");
    return res.json();
  },

  async deleteSession(sessionId: string) {
    const res = await request(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
    return res.json();
  },

  async executeAgent(task: string, model: string, mode: string) {
    const res = await request("/api/agent/execute", {
      method: "POST",
      body: JSON.stringify({ task, model, mode }),
    });
    return res.json();
  },

  async getTasks() {
    const res = await request("/api/tasks/");
    return res.json();
  },

  async getTask(id: number) {
    const res = await request(`/api/tasks/${id}`);
    return res.json();
  },

  async getTaskLogs(id: number) {
    const res = await request(`/api/tasks/${id}/logs`);
    return res.json();
  },

  async deleteTask(id: number) {
    const res = await request(`/api/tasks/${id}`, { method: "DELETE" });
    return res.json();
  },

  async listFiles(path: string = "") {
    const res = await request(`/api/files/list?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async readFile(path: string) {
    const res = await request(`/api/files/read?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async writeFile(path: string, content: string) {
    const res = await request("/api/files/write", {
      method: "POST",
      body: JSON.stringify({ path, content }),
    });
    return res.json();
  },

  async deleteFile(path: string) {
    const res = await request(`/api/files/delete?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    return res.json();
  },

  async runPentest(tool: string, target: string, confirmed: boolean, ports?: string) {
    const res = await request(`/api/pentest/${tool}`, {
      method: "POST",
      body: JSON.stringify({ target, confirmed, ports }),
    });
    return res.json();
  },

  async getAdminUsers() {
    const res = await request("/api/admin/users");
    return res.json();
  },

  async updateUser(id: number, data: Record<string, unknown>) {
    const res = await request(`/api/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteUser(id: number) {
    const res = await request(`/api/admin/users/${id}`, { method: "DELETE" });
    return res.json();
  },

  async createUser(email: string, password: string, name: string, role: string) {
    const res = await request("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, name, role }),
    });
    return res.json();
  },

  async getSettings() {
    const res = await request("/api/admin/settings");
    return res.json();
  },

  async updateSetting(key: string, value: string) {
    const res = await request("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    });
    return res.json();
  },

  getWsUrl(token: string) {
    const wsBase = API_URL.replace("http", "ws");
    return `${wsBase}/api/agent/ws/${token}`;
  },
};
