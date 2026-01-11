import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Search, Package, ClipboardList, User, LogOut } from 'lucide-react';

const navItems = [
  { to: '/student', icon: Home, label: 'Home', exact: true },
  { to: '/student/report-lost', icon: Search, label: 'Report Lost' },
  { to: '/student/report-found', icon: Package, label: 'Report Found' },
  { to: '/student/my-items', icon: ClipboardList, label: 'My Items' },
  { to: '/student/profile', icon: User, label: 'Profile' },
];

export const StudentMobileNav = () => {
  return (
    <nav className="mobile-nav md:hidden" data-testid="student-mobile-nav">
      <div className="flex justify-around">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `mobile-nav-item ${isActive ? 'active' : ''}`
            }
            data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export const StudentDesktopNav = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="hidden md:flex items-center gap-1 bg-white border-b border-slate-200 px-4" data-testid="student-desktop-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              isActive 
                ? 'text-slate-900 border-b-2 border-slate-900' 
                : 'text-slate-600 hover:text-slate-900'
            }`
          }
          data-testid={`desktop-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <item.icon className="w-4 h-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button
        onClick={handleLogout}
        className="ml-auto flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        data-testid="logout-btn"
      >
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </button>
    </nav>
  );
};
