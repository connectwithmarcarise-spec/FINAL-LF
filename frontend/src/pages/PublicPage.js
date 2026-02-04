import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search, MapPin, Clock, Package, User2, GraduationCap, Calendar, ArrowLeft, Hand, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent } from '../components/ui/card';
import { StudentHeader, RoleBadge } from '../components/Header';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * PublicPage (Common Lobby)
 * DESIGN FIX: Now requires authentication - no public browsing
 * 
 * SEMANTIC FIX:
 * - FOUND items → "Claim This Item" (ownership verification)
 * - LOST items → "I Found This" (reporting found instance)
 */
const PublicPage = () => {
  const { isAuthenticated, user, token, role } = useAuth();
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchItems();
    }
  }, [isAuthenticated, token]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/lobby/items`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const items = response.data;
      
      setLostItems(items.filter(item => item.item_type === 'lost'));
      setFoundItems(items.filter(item => item.item_type === 'found'));
    } catch (error) {
      console.error('Failed to fetch items:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const allItems = [...lostItems, ...foundItems].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  const filterItems = (items) => {
    if (!searchQuery) return items;
    return items.filter(item =>
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_keyword?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const ItemCard = ({ item }) => {
    // SEMANTIC FIX: Different actions for LOST vs FOUND items
    const isLostItem = item.item_type === 'lost';
    const isFoundItem = item.item_type === 'found';
    
    const handleAction = () => {
      if (isFoundItem) {
        // FOUND items → Claim (ownership verification)
        navigate(`/student/claim/${item.id}`);
      } else {
        // LOST items → I Found This response
        navigate(`/student/found-response/${item.id}`);
      }
    };
    
    return (
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
        <div className="relative">
          {item.image_url ? (
            <img 
              src={`${BACKEND_URL}${item.image_url}`}
              alt={item.item_keyword}
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
              <Package className="w-12 h-12 text-slate-300" />
              <span className="text-xs text-slate-400 absolute bottom-2">No image</span>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Badge className={isLostItem ? 'bg-orange-500' : 'bg-emerald-500'}>
              {isLostItem ? 'Lost' : 'Found'}
            </Badge>
          </div>
          {item.status && item.status !== 'reported' && (
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className={`
                ${item.status === 'found_reported' ? 'bg-blue-100 text-blue-700' : ''}
                ${item.status === 'claimed' ? 'bg-green-100 text-green-700' : ''}
              `}>
                {item.status === 'found_reported' ? 'Found!' : item.status}
              </Badge>
            </div>
          )}
          {item.item_keyword && item.status === 'reported' && (
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="bg-white/90 backdrop-blur">
                {item.item_keyword}
              </Badge>
            </div>
          )}
        </div>
        
        <CardContent className="p-5 space-y-3">
          {/* Description */}
          <p className="text-sm text-slate-700 line-clamp-2">
            {item.description}
          </p>

          {/* Location & Time */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{item.location}</span>
            </div>
            {item.approximate_time && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{item.approximate_time}</span>
              </div>
            )}
          </div>

          {/* Date */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{item.created_date}</span>
          </div>

          {/* Student Info - PUBLIC SAFE */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Reported by:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <User2 className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-slate-700">{item.student?.full_name || 'Anonymous'}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>{item.student?.department || 'N/A'}</span>
                </div>
                <span>•</span>
                <span>Year {item.student?.year || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* SEMANTIC ACTION BUTTONS */}
          {isAuthenticated && role === 'student' && (
            <div className="pt-3 border-t border-slate-100">
              {isFoundItem ? (
                /* FOUND items → Claim (I am the owner) */
                <Button 
                  onClick={handleAction}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Claim This Item
                </Button>
              ) : (
                /* LOST items → I Found This */
                <Button 
                  onClick={handleAction}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                >
                  <Hand className="w-4 h-4 mr-2" />
                  I Found This Item
                </Button>
              )}
              <p className="text-xs text-slate-500 mt-2 text-center">
                {isFoundItem 
                  ? "Verify ownership to claim this item" 
                  : "Help return this item to its owner"}
              </p>
            </div>
          )}
          
          {/* Admin view - just information */}
          {isAuthenticated && (role === 'admin' || role === 'super_admin') && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Admin view - manage via Admin Dashboard</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const ItemGrid = ({ items, emptyIcon, emptyMessage }) => {
    const filtered = filterItems(items);
    
    return loading ? (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    ) : filtered.length === 0 ? (
      <div className="text-center py-12">
        {emptyIcon}
        <p className="text-slate-500 mt-3">{emptyMessage}</p>
        {searchQuery && (
          <p className="text-sm text-slate-400 mt-2">Try adjusting your search</p>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    );
  };

  // Determine header based on user role
  const renderHeader = () => {
    if (role === 'student') {
      return <StudentHeader user={user} />;
    }
    // For admin users viewing lobby
    return (
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="font-outfit font-bold text-slate-900">Common Lobby</span>
            </div>
            <div className="flex items-center gap-4">
              <RoleBadge role={role} userName={user?.full_name || user?.username} />
              <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
            </div>
          </div>
        </div>
      </header>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {renderHeader()}

      {/* Back Button for Students */}
      {role === 'student' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <button 
            onClick={() => navigate('/student')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1764885518367-e73170e2aeea?w=1920)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl">
            <h1 className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 animate-fade-in">
              Campus Lost & Found
            </h1>
            
            {/* Role-aware header text */}
            {isAuthenticated ? (
              <div className="mb-6 animate-fade-in">
                <div className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2">
                  <p className="text-sm text-white/80">You are logged in as:</p>
                  <p className="text-lg font-semibold text-white capitalize">{role?.replace('_', ' ') || 'User'}</p>
                </div>
              </div>
            ) : (
              <p className="text-lg text-slate-300 mb-6 animate-fade-in">
                Browse all lost and found items from the campus community.
              </p>
            )}
            
            {/* Search Bar */}
            <div className="relative animate-fade-in">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search items by description, location, or type..."
                className="pl-12 pr-4 py-6 text-base bg-white text-slate-900 border-0 rounded-lg shadow-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-input"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Content - Common Lobby */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="all">
              All Items ({allItems.length})
            </TabsTrigger>
            <TabsTrigger value="lost">
              <Search className="w-4 h-4 mr-2" />
              Lost ({lostItems.length})
            </TabsTrigger>
            <TabsTrigger value="found">
              <Package className="w-4 h-4 mr-2" />
              Found ({foundItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <ItemGrid 
              items={allItems}
              emptyIcon={<Package className="w-16 h-16 mx-auto text-slate-300" />}
              emptyMessage="No items reported yet"
            />
          </TabsContent>

          <TabsContent value="lost">
            <ItemGrid 
              items={lostItems}
              emptyIcon={<Search className="w-16 h-16 mx-auto text-orange-300" />}
              emptyMessage="No lost items reported"
            />
          </TabsContent>

          <TabsContent value="found">
            <ItemGrid 
              items={foundItems}
              emptyIcon={<Package className="w-16 h-16 mx-auto text-emerald-300" />}
              emptyMessage="No found items reported"
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="font-outfit font-bold mb-1">
            ST. PETERS COLLEGE OF ENGINEERING AND TECHNOLOGY
          </p>
          <p className="text-sm text-slate-400">(AN AUTONOMOUS)</p>
          <p className="text-xs text-slate-500 mt-4">
            Lost & Found Management System © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicPage;
