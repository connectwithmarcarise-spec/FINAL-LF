import { useState, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StudentHeader } from '../components/Header';
import { StudentMobileNav, StudentDesktopNav } from '../components/StudentNav';
import { messagesAPI } from '../services/api';
import { Toaster } from '../components/ui/sonner';

const StudentLayout = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await messagesAPI.getUnreadCount();
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <StudentHeader user={user} unreadCount={unreadCount} />
      <StudentDesktopNav />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet context={{ unreadCount, refreshUnread: fetchUnreadCount }} />
      </main>
      
      <StudentMobileNav />
      <Toaster position="top-right" />
    </div>
  );
};

export default StudentLayout;
