import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import ChatPage from "@/pages/ChatPage";
import AgentPage from "@/pages/AgentPage";
import ModelsPage from "@/pages/ModelsPage";
import PentestPage from "@/pages/PentestPage";
import FilesPage from "@/pages/FilesPage";
import HistoryPage from "@/pages/HistoryPage";
import AdminPage from "@/pages/AdminPage";
import SOCDashboard from "@/pages/SOCDashboard";
import VoiceAgentPage from "@/pages/VoiceAgentPage";
import BrowserAgentPage from "@/pages/BrowserAgentPage";
import OSINTPage from "@/pages/OSINTPage";
import NetworkToolsPage from "@/pages/NetworkToolsPage";
import ReportsPage from "@/pages/ReportsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import DeployPage from "@/pages/DeployPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-lg">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/chat" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/chat" /> : <LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/soc" element={<SOCDashboard />} />
        <Route path="/voice" element={<VoiceAgentPage />} />
        <Route path="/browser-agent" element={<BrowserAgentPage />} />
        <Route path="/osint" element={<OSINTPage />} />
        <Route path="/network" element={<NetworkToolsPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/pentest" element={<PentestPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/deploy" element={<DeployPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/chat" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
