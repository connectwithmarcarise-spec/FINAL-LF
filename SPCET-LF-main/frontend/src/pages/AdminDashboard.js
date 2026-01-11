import { useState, useEffect } from 'react';
import { statsAPI } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Search, Package, CheckCircle, Trash2, Users, AlertCircle } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await statsAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { 
      label: 'Total Students', 
      value: stats?.total_students || 0, 
      icon: Users, 
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    { 
      label: 'Lost Items', 
      value: stats?.total_lost || 0, 
      icon: Search, 
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50'
    },
    { 
      label: 'Found Items', 
      value: stats?.total_found || 0, 
      icon: Package, 
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50'
    },
    { 
      label: 'Pending Claims', 
      value: stats?.pending_claims || 0, 
      icon: AlertCircle, 
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50'
    },
    { 
      label: 'Resolved Items', 
      value: stats?.resolved_items || 0, 
      icon: CheckCircle, 
      color: 'bg-green-500',
      bgColor: 'bg-green-50'
    },
    { 
      label: 'Deleted Items', 
      value: stats?.deleted_items || 0, 
      icon: Trash2, 
      color: 'bg-red-500',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in" data-testid="admin-dashboard">
      <div>
        <h1 className="font-outfit text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome to the Lost & Found Admin Panel</p>
      </div>

      {/* College Info */}
      <Card className="bg-slate-900 text-white">
        <CardContent className="p-6">
          <h2 className="font-outfit text-xl font-bold mb-1">
            ST. PETERS COLLEGE OF ENGINEERING AND TECHNOLOGY
          </h2>
          <p className="text-slate-400">(AN AUTONOMOUS)</p>
          <p className="text-sm text-slate-400 mt-2">Lost & Found Management System</p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="card-hover" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="stat-value mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-outfit text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a 
              href="/admin/students" 
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Users className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium">Manage Students</span>
            </a>
            <a 
              href="/admin/ai-matches" 
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Package className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium">View AI Matches</span>
            </a>
            <a 
              href="/admin/claims" 
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <CheckCircle className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium">Review Claims</span>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-outfit text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <span className="flex items-center gap-2 text-sm text-emerald-600">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">AI Matching</span>
                <span className="flex items-center gap-2 text-sm text-emerald-600">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">File Storage</span>
                <span className="flex items-center gap-2 text-sm text-emerald-600">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Healthy
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
