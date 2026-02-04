import { Link } from 'react-router-dom';
import { Building2, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export const CollegeLogo = ({ className = '' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
        <Building2 className="w-6 h-6 text-white" />
      </div>
      <div className="hidden sm:block">
        <h1 className="font-outfit text-sm font-bold text-slate-900 leading-tight">
          ST. PETERS COLLEGE OF ENGINEERING
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          AND TECHNOLOGY (AN AUTONOMOUS)
        </p>
      </div>
    </div>
  );
};

/**
 * Role Badge Component - Shows logged-in role in top-right
 */
export const RoleBadge = ({ role, userName }) => {
  const getRoleDisplay = () => {
    switch (role) {
      case 'student': return { label: 'Student', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'admin': return { label: 'Admin', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'super_admin': return { label: 'Super Admin', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      default: return { label: 'Guest', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };
  
  const { label, color } = getRoleDisplay();
  
  return (
    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${color} flex items-center gap-2`}>
      <User className="w-3.5 h-3.5" />
      <span>{label}</span>
      {userName && <span className="text-slate-500">• {userName.split(' ')[0]}</span>}
    </div>
  );
};

/**
 * PublicHeader - For unauthenticated pages (landing, login)
 * DESIGN FIX: No "Common Lobby" link before login
 */
export const PublicHeader = () => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center">
            <CollegeLogo />
          </Link>
          <nav className="flex items-center gap-4">
            {/* NO Common Lobby link - requires authentication */}
            <Link 
              to="/student/login"
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors btn-press shadow-sm"
              data-testid="student-login-link"
            >
              Student Login
            </Link>
            <Link 
              to="/admin/login"
              className="px-4 py-2 text-slate-600 border border-slate-300 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
              data-testid="admin-login-link"
            >
              Admin
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

/**
 * AuthenticatedHeader - Shows role badge and user info
 */
export const AuthenticatedHeader = ({ children }) => {
  const { user, role, logout } = useAuth();
  
  const getUserName = () => {
    if (role === 'student') return user?.full_name;
    return user?.full_name || user?.username;
  };
  
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={role === 'student' ? '/student' : '/admin'} className="flex items-center">
            <CollegeLogo />
          </Link>
          
          <div className="flex items-center gap-4">
            {/* Role Badge - TOP RIGHT */}
            <RoleBadge role={role} userName={getUserName()} />
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                    {user?.profile_picture ? (
                      <img 
                        src={`${process.env.REACT_APP_BACKEND_URL}${user.profile_picture}`} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium text-slate-600">
                        {getUserName()?.charAt(0) || 'U'}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{getUserName()}</div>
                  <div className="text-xs text-slate-500 capitalize">{role?.replace('_', ' ')}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {children}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export const StudentHeader = ({ user, unreadCount = 0 }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 glass">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/student" className="flex items-center">
            <CollegeLogo />
          </Link>
          <div className="flex items-center gap-4">
            <Link 
              to="/student/notifications" 
              className="relative p-2 text-slate-600 hover:text-slate-900"
              data-testid="notifications-link"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="notification-badge" data-testid="unread-count">{unreadCount}</span>
              )}
            </Link>
            <Link to="/student/profile" className="flex items-center gap-2" data-testid="profile-link">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                {user?.profile_picture ? (
                  <img 
                    src={`${process.env.REACT_APP_BACKEND_URL}${user.profile_picture}`} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-600">
                    {user?.full_name?.charAt(0) || 'S'}
                  </span>
                )}
              </div>
              <span className="hidden sm:block text-sm font-medium text-slate-700">
                {user?.full_name || 'Student'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
