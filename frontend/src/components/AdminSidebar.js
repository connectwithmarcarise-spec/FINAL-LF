import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Search, 
  Package, 
  Users, 
  MessageSquare, 
  Trash2, 
  Settings, 
  LogOut,
  Sparkles,
  UserCog,
  Building2,
  Globe,
  Folder
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/lobby', icon: Globe, label: 'Common Lobby' },
  { to: '/admin/lost-items', icon: Search, label: 'Lost Items' },
  { to: '/admin/found-items', icon: Package, label: 'Found Items' },
  { to: '/admin/ai-matches', icon: Sparkles, label: 'AI Matches' },
  { to: '/admin/claims', icon: Package, label: 'Claims' },
  { to: '/admin/students', icon: Users, label: 'Students' },
  { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/deleted-items', icon: Trash2, label: 'Deleted Items' },
];

const superAdminItems = [
  { to: '/admin/manage-admins', icon: UserCog, label: 'Manage Admins' },
  { to: '/admin/folders', icon: Folder, label: 'Folder Management' },
];

export const AdminSidebar = () => {
  const { logout, isSuperAdmin, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <aside className="sidebar flex flex-col" data-testid="admin-sidebar">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight font-outfit">
              ST. PETERS COLLEGE
            </h1>
            <p className="text-xs text-slate-400">Lost & Found Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">
            Main Menu
          </p>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {isSuperAdmin && (
          <>
            <div className="px-3 mt-6 mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">
                Super Admin
              </p>
            </div>
            {superAdminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User & Settings */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.full_name?.charAt(0) || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.full_name || 'Admin'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <NavLink
            to="/admin/settings"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            data-testid="nav-settings"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </NavLink>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            data-testid="logout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
