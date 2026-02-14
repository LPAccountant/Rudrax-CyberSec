import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  MessageSquare,
  Bot,
  Cpu,
  Shield,
  FolderOpen,
  History,
  Users,
  LogOut,
  Terminal,
  Mic,
  Globe,
  Eye,
  Wifi,
  FileText,
  FolderGit2,
  Activity,
} from "lucide-react";

const navItems = [
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/agent", icon: Bot, label: "Agent Mode" },
  { to: "/soc", icon: Activity, label: "SOC Dashboard" },
  { to: "/voice", icon: Mic, label: "Voice Agent" },
  { to: "/browser-agent", icon: Globe, label: "Browser & API" },
  { to: "/osint", icon: Eye, label: "OSINT Agent" },
  { to: "/network", icon: Wifi, label: "Network Tools" },
  { to: "/pentest", icon: Shield, label: "Pentest Tools" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/projects", icon: FolderGit2, label: "Projects" },
  { to: "/models", icon: Cpu, label: "Models" },
  { to: "/files", icon: FolderOpen, label: "File Manager" },
  { to: "/history", icon: History, label: "Task History" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-7 h-7 text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">RudraX CyberSec</h1>
            <p className="text-xs text-gray-500">A Lalit Pandit Project</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
        {user?.role === "admin" && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`
            }
          >
            <Users className="w-4 h-4" />
            Admin Panel
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
