import { useState, useEffect } from "react";
import { api } from "@/services/api";
import { Users, Plus, Trash2, Check, X } from "lucide-react";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: number;
  is_approved: number;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", role: "developer" });
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadUsers(); }, []);

  const createUser = async () => {
    setError("");
    try {
      await api.createUser(newUser.email, newUser.password, newUser.name, newUser.role);
      setNewUser({ email: "", password: "", name: "", role: "developer" });
      setShowCreate(false);
      loadUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const toggleApproval = async (user: User) => {
    await api.updateUser(user.id, { is_approved: !user.is_approved });
    loadUsers();
  };

  const toggleActive = async (user: User) => {
    await api.updateUser(user.id, { is_active: !user.is_active });
    loadUsers();
  };

  const changeRole = async (user: User, role: string) => {
    await api.updateUser(user.id, { role });
    loadUsers();
  };

  const deleteUser = async (id: number) => {
    try {
      await api.deleteUser(id);
      loadUsers();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400" /> Admin Panel
          </h1>
          <p className="text-gray-500 text-sm mt-1">User management and system settings</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-all">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {showCreate && (
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5 space-y-3">
          <h3 className="text-white font-semibold">Create New User</h3>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Full Name" className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
            <input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
            <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Password" className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500">
              <option value="developer">Developer</option>
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button onClick={createUser} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-all">Create User</button>
        </div>
      )}

      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Approved</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-800/30 transition-all">
                <td className="px-5 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{u.name}</p>
                    <p className="text-gray-500 text-xs">{u.email}</p>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="developer">Developer</option>
                    <option value="analyst">Analyst</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => toggleApproval(u)} className={`p-1.5 rounded-lg transition-all ${u.is_approved ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {u.is_approved ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-5 py-3 text-center">
                  <button onClick={() => toggleActive(u)} className={`p-1.5 rounded-lg transition-all ${u.is_active ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {u.is_active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => deleteUser(u.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-all" title="Delete user">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center text-gray-700 text-xs pt-4">
        RudraX CyberSec - A Lalit Pandit Project
      </div>
    </div>
  );
}
