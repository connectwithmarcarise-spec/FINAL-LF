import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
  Megaphone,
  ClipboardCheck,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Storage keys for viewed state
const ADMIN_VIEWED_LOST_KEY = 'admin_viewed_lost';
const ADMIN_VIEWED_FOUND_KEY = 'admin_viewed_found';
const ADMIN_VIEWED_CLAIMS_KEY = 'admin_viewed_claims';

/**
 * Admin Sidebar with:
 * - Real-time notification badges
 * - Mobile hamburger menu support
 * - Logout confirmation
 */

const superAdminItems = [
  { to: '/admin/manage-admins', icon: UserCog, label: 'Manage Admins' },
];

// Sidebar Content Component (shared between desktop and mobile)
const SidebarContent = ({ 
  navItems, 
  isSuperAdmin, 
  user, 
  onLogoutClick, 
  onNavClick 
}) => (
  <>
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
          onClick={onNavClick}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''} ${item.highlight ? 'bg-purple-900/20' : ''}`
          }
          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <item.icon className="w-5 h-5 mr-3" />
          <span className="flex-1">{item.label}</span>
          {item.count > 0 && (
            <span className={`min-w-[22px] h-[22px] flex items-center justify-center text-xs font-bold text-white rounded-full px-1.5 ${
              item.color === 'orange' ? 'bg-orange-500' :
              item.color === 'emerald' ? 'bg-emerald-500' :
              item.color === 'red' ? 'bg-red-500 animate-pulse' :
              'bg-slate-500'
            }`}>
              {item.count > 99 ? '99+' : item.count}
            </span>
          )}
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
              onClick={onNavClick}
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
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
          <span className="text-sm font-medium text-white">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
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
          onClick={onNavClick}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
          data-testid="nav-settings"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={onLogoutClick}
          className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  </>
);

export const AdminSidebar = () => {
  const { logout, isSuperAdmin, user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [itemCounts, setItemCounts] = useState({ lost: 0, found: 0 });
  const [viewedCounts, setViewedCounts] = useState({ lost: 0, found: 0, claims: 0 });
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch all counts
  const fetchCounts = useCallback(async () => {
    try {
      const authToken = token || localStorage.getItem('token');
      if (!authToken) return;

      const claimsResponse = await axios.get(`${BACKEND_URL}/api/claims?status=pending`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setPendingCount(claimsResponse.data?.length || 0);

      const itemsResponse = await axios.get(`${BACKEND_URL}/api/items/public`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const items = itemsResponse.data || [];
      const lost = items.filter(item => item.item_type === 'lost').length;
      const found = items.filter(item => item.item_type === 'found').length;
      setItemCounts({ lost, found });
    } catch (error) {
      console.error('Failed to fetch counts:', error);
    }
  }, [token]);

  useEffect(() => {
    const viewedLost = parseInt(localStorage.getItem(ADMIN_VIEWED_LOST_KEY) || '0', 10);
    const viewedFound = parseInt(localStorage.getItem(ADMIN_VIEWED_FOUND_KEY) || '0', 10);
    const viewedClaims = parseInt(localStorage.getItem(ADMIN_VIEWED_CLAIMS_KEY) || '0', 10);
    setViewedCounts({ lost: viewedLost, found: viewedFound, claims: viewedClaims });
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  useEffect(() => {
    if (location.pathname === '/admin/lost-items') {
      localStorage.setItem(ADMIN_VIEWED_LOST_KEY, itemCounts.lost.toString());
      setViewedCounts(prev => ({ ...prev, lost: itemCounts.lost }));
    } else if (location.pathname === '/admin/found-items') {
      localStorage.setItem(ADMIN_VIEWED_FOUND_KEY, itemCounts.found.toString());
      setViewedCounts(prev => ({ ...prev, found: itemCounts.found }));
    } else if (location.pathname === '/admin/claim-requests') {
      localStorage.setItem(ADMIN_VIEWED_CLAIMS_KEY, pendingCount.toString());
      setViewedCounts(prev => ({ ...prev, claims: pendingCount }));
    }
  }, [location.pathname, itemCounts, pendingCount]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const newLostCount = Math.max(0, itemCounts.lost - viewedCounts.lost);
  const newFoundCount = Math.max(0, itemCounts.found - viewedCounts.found);
  const newClaimsCount = Math.max(0, pendingCount - viewedCounts.claims);

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const handleLogoutConfirm = () => {
    setLoggingOut(true);
    setTimeout(() => {
      logout();
      navigate('/admin/login');
    }, 500);
  };

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/feed', icon: Megaphone, label: 'Campus Feed' },
    { to: '/admin/lost-items', icon: Search, label: 'Lost Items', count: newLostCount, color: 'orange' },
    { to: '/admin/found-items', icon: Package, label: 'Found Items', count: newFoundCount, color: 'emerald' },
    { to: '/admin/ai-matches', icon: Sparkles, label: 'AI Matches' },
    { to: '/admin/claim-requests', icon: ClipboardCheck, label: 'Claim Requests', count: newClaimsCount, color: 'red', highlight: true },
    { to: '/admin/claims', icon: Package, label: 'Claims' },
    { to: '/admin/students', icon: Users, label: 'Students' },
    { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
    { to: '/admin/deleted-items', icon: Trash2, label: 'Deleted Items' },
  ];

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="mobile-header md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="hamburger-btn"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-700" />
          <span className="font-semibold text-slate-900 text-sm">Admin Panel</span>
        </div>
        <div className="w-6" /> {/* Spacer for alignment */}
      </div>

      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside 
        className={`sidebar flex flex-col ${mobileOpen ? 'open' : ''}`} 
        data-testid="admin-sidebar"
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-4 right-4 p-1 text-white/70 hover:text-white"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        <SidebarContent
          navItems={navItems}
          isSuperAdmin={isSuperAdmin}
          user={user}
          onLogoutClick={handleLogoutClick}
          onNavClick={handleNavClick}
        />
      </aside>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Logout
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to logout from the admin panel? Any unsaved changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
              disabled={loggingOut}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogoutConfirm}
              disabled={loggingOut}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loggingOut ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Logging out...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Yes, Logout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
