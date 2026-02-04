import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

// Pages
import LandingPage from "./pages/LandingPage";  // NEW: Landing page (no public lobby)
import PublicPage from "./pages/PublicPage";  // Now requires auth
import StudentLoginPage from "./pages/StudentLoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import StudentLayout from "./pages/StudentLayout";
import StudentDashboard from "./pages/StudentDashboard";
import StudentLostItems from "./pages/StudentLostItems";
import StudentFoundItems from "./pages/StudentFoundItems";
import ReportLostPage from "./pages/ReportLostPage";
import ReportFoundPage from "./pages/ReportFoundPage";
import AIClaimChat from "./components/AIClaimChat";
import MyItemsPage from "./pages/MyItemsPage";
import StudentProfilePage from "./pages/StudentProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import AdminLayout from "./pages/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLostItems from "./pages/AdminLostItems";
import AdminFoundItems from "./pages/AdminFoundItems";
import AdminAIMatches from "./pages/AdminAIMatches";
import AdminClaims from "./pages/AdminClaims";
import AdminStudents from "./pages/AdminStudents";
import AdminMessages from "./pages/AdminMessages";
import AdminDeletedItems from "./pages/AdminDeletedItems";
import AdminManageAdmins from "./pages/AdminManageAdmins";
import AdminSettings from "./pages/AdminSettings";
import AdminClaimRequests from "./pages/AdminClaimRequests";

// Protected Route Components
const StudentRoute = ({ children }) => {
  const { isAuthenticated, isStudent, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isStudent) {
    return <Navigate to="/student/login" replace />;
  }
  
  return children;
};

// NEW: Protected route for Common Lobby (requires any authentication)
const AuthenticatedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;  // Redirect to landing page
  }
  
  return children;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }
  
  return children;
};

function AppRoutes() {
  const { isAuthenticated, isStudent, isAdmin } = useAuth();
  
  // Smart home redirect based on authentication
  // DESIGN FIX: Unauthenticated users see LandingPage, not PublicPage
  const getHomeRedirect = () => {
    if (isAuthenticated) {
      if (isStudent) return <Navigate to="/student" replace />;
      if (isAdmin) return <Navigate to="/admin" replace />;
    }
    return <LandingPage />;  // NEW: Landing page with login options only
  };
  
  return (
    <Routes>
      {/* Landing Page - No public browsing before login */}
      <Route path="/" element={getHomeRedirect()} />
      
      {/* Common Lobby - NOW REQUIRES AUTHENTICATION */}
      <Route path="/lobby" element={
        <AuthenticatedRoute>
          <PublicPage />
        </AuthenticatedRoute>
      } />
      
      {/* Auth Routes */}
      <Route path="/student/login" element={<StudentLoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <StudentRoute>
            <StudentLayout />
          </StudentRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="lost-items" element={<StudentLostItems />} />
        <Route path="found-items" element={<StudentFoundItems />} />
        <Route path="report-lost" element={<ReportLostPage />} />
        <Route path="report-found" element={<ReportFoundPage />} />
        <Route path="claim/:itemId" element={<AIClaimChat />} />
        <Route path="my-items" element={<MyItemsPage />} />
        <Route path="profile" element={<StudentProfilePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="lost-items" element={<AdminLostItems />} />
        <Route path="found-items" element={<AdminFoundItems />} />
        <Route path="ai-matches" element={<AdminAIMatches />} />
        <Route path="claims" element={<AdminClaims />} />
        <Route path="claim-requests" element={<AdminClaimRequests />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="deleted-items" element={<AdminDeletedItems />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route
          path="manage-admins"
          element={
            <SuperAdminRoute>
              <AdminManageAdmins />
            </SuperAdminRoute>
          }
        />
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
