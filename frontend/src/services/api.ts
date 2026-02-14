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

  async voiceProcess(data: { text: string; model?: string; context?: string; language?: string }) {
    const res = await request("/api/voice/process", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async voiceDetectLanguage(data: { text: string }) {
    const res = await request("/api/voice/detect-language", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async voiceTranslate(data: { text: string; target_language: string; model?: string }) {
    const res = await request("/api/voice/translate", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },

  async browserBrowse(data: { url: string; extract_type?: string }) {
    const res = await request("/api/browser/browse", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async browserCrawl(data: { url: string; max_pages?: number }) {
    const res = await request("/api/browser/crawl", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async browserApiTest(data: { url: string; method?: string; headers?: Record<string, string>; body?: string }) {
    const res = await request("/api/browser/api-test", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async browserApiAnalyze(data: { url: string; model?: string }) {
    const res = await request("/api/browser/api-analyze", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },

  async osintDeepScan(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/deep-scan", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async osintWhois(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/whois", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async osintDns(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/dns", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async osintSubdomains(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/subdomains", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async osintHttpRecon(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/http-recon", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async osintEmails(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/emails", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async osintTechStack(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/tech-stack", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async osintHistory() {
    const res = await request("/api/osint/history");
    return res.json();
  },
  async osintGenerateReport(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/osint/generate-report", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },

  async networkNmap(data: { target: string; scan_type?: string; ports?: string; confirmed: boolean }) {
    const res = await request("/api/network/nmap", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkNikto(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/network/nikto", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkTraceroute(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/network/traceroute", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkBannerGrab(data: { target: string; ports?: string; confirmed: boolean }) {
    const res = await request("/api/network/banner-grab", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkWafDetect(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/network/waf-detect", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkCmsDetect(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/network/cms-detect", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkDiscovery(data: { target: string; confirmed: boolean }) {
    const res = await request("/api/network/discovery", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkPasswordAudit(data: { hash_value: string; hash_type?: string }) {
    const res = await request("/api/network/password-audit", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkPasswordStrength(data: { password: string }) {
    const res = await request("/api/network/password-strength", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async networkScanHistory() {
    const res = await request("/api/network/scan-history");
    return res.json();
  },

  async socDashboard() {
    const res = await request("/api/soc/dashboard");
    return res.json();
  },
  async socCreateEvent(data: { event_type: string; severity?: string; source?: string; description: string }) {
    const res = await request("/api/soc/events", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async socEvents(params?: { severity?: string; resolved?: boolean }) {
    const query = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    const res = await request(`/api/soc/events${query}`);
    return res.json();
  },
  async socResolveEvent(eventId: number) {
    const res = await request(`/api/soc/events/${eventId}/resolve`, { method: "PUT" });
    return res.json();
  },
  async socAnalyze(data: { event_id?: number; event_data?: Record<string, unknown>; model?: string }) {
    const res = await request("/api/soc/analyze", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async socAutoPatch(data: { finding: Record<string, unknown>; model?: string }) {
    const res = await request("/api/soc/auto-patch", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async socPatches() {
    const res = await request("/api/soc/patches");
    return res.json();
  },

  async reportsGenerate(data: { title: string; target: string; scan_ids?: number[]; findings?: Array<Record<string, unknown>>; recommendations?: string[] }) {
    const res = await request("/api/reports/generate", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async reportsList() {
    const res = await request("/api/reports/list");
    return res.json();
  },
  async reportsGet(id: number) {
    const res = await request(`/api/reports/${id}`);
    return res.json();
  },
  async reportsDelete(id: number) {
    const res = await request(`/api/reports/${id}`, { method: "DELETE" });
    return res.json();
  },

  async projectsList() {
    const res = await request("/api/projects/");
    return res.json();
  },
  async projectsCreate(data: { name: string; description?: string; git_url?: string }) {
    const res = await request("/api/projects/", { method: "POST", body: JSON.stringify(data) });
    return res.json();
  },
  async projectsDelete(id: number) {
    const res = await request(`/api/projects/${id}`, { method: "DELETE" });
    return res.json();
  },
  async projectsGitPull(id: number) {
    const res = await request(`/api/projects/${id}/git-pull`, { method: "POST" });
    return res.json();
  },
};
