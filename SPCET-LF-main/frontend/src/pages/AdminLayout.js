import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import { Toaster } from '../components/ui/sonner';

const AdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      
      <Toaster position="top-right" />
    </div>
  );
};

export default AdminLayout;
