import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { itemsAPI, claimsAPI } from '../services/api';
import { ItemGrid } from '../components/ItemCard';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Search, Package, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [recentItems, setRecentItems] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, claimsRes] = await Promise.all([
        itemsAPI.getMyItems(),
        claimsAPI.getClaims()
      ]);
      setRecentItems(itemsRes.data.slice(0, 4));
      setMyClaims(claimsRes.data.slice(0, 3));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClaimStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'status-found';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'under_review': return 'status-claimed';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" data-testid="student-dashboard">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h1 className="font-outfit text-2xl font-bold text-slate-900 mb-2">
          Welcome back, {user?.full_name?.split(' ')[0] || 'Student'}!
        </h1>
        <p className="text-slate-500">
          {user?.department} • {user?.year} Year • {user?.roll_number}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/student/report-lost">
          <Card className="card-hover cursor-pointer border-orange-200 bg-orange-50/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Search className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Report Lost Item</h3>
                  <p className="text-sm text-slate-500">Lost something? Report it here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/student/report-found">
          <Card className="card-hover cursor-pointer border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Report Found Item</h3>
                  <p className="text-sm text-slate-500">Found something? Help return it</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-outfit text-xl">My Recent Reports</CardTitle>
          <Link to="/student/my-items">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner" />
            </div>
          ) : recentItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">You haven't reported any items yet</p>
              <Link to="/student/report-lost">
                <Button className="mt-4" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Report an Item
                </Button>
              </Link>
            </div>
          ) : (
            <ItemGrid items={recentItems} />
          )}
        </CardContent>
      </Card>

      {/* My Claims */}
      <Card>
        <CardHeader>
          <CardTitle className="font-outfit text-xl">My Claims Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner" />
            </div>
          ) : myClaims.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No claims yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myClaims.map((claim) => (
                <div 
                  key={claim.id} 
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                  data-testid={`claim-${claim.id}`}
                >
                  {claim.item?.image_url && (
                    <img 
                      src={`${process.env.REACT_APP_BACKEND_URL}${claim.item.image_url}`}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover"
                      onError={(e) => {
                        e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100';
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {claim.item?.description || 'Item'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Claimed on {new Date(claim.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={getClaimStatusColor(claim.status)}>
                    {claim.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentDashboard;
