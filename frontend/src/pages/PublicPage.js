import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Search, MapPin, Clock, Package, User2, GraduationCap, Calendar, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent } from '../components/ui/card';
import { PublicHeader } from '../components/Header';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PublicPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();

  const getRoleDisplay = () => {
    if (!user) return null;
    if (user.role === 'student') return 'Student';
    if (user.role === 'super_admin') return 'Super Admin';
    if (user.role === 'admin') return 'Admin';
    return user.role;
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${BACKEND_URL}/api/lobby/items`);
      const items = response.data;
      
      setLostItems(items.filter(item => item.item_type === 'lost'));
      setFoundItems(items.filter(item => item.item_type === 'found'));
    } catch (error) {
      console.error('Failed to fetch items:', error);
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

  const ItemCard = ({ item }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative">
        {item.image_url && (
          <img 
            src={`${BACKEND_URL}${item.image_url}`}
            alt={item.item_keyword}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="absolute top-3 left-3">
          <Badge className={item.item_type === 'lost' ? 'bg-orange-500' : 'bg-emerald-500'}>
            {item.item_type === 'lost' ? 'Lost' : 'Found'}
          </Badge>
        </div>
        {item.item_keyword && (
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

        {/* Login CTA for non-authenticated users */}
        {!isAuthenticated && (
          <div className="pt-3 border-t border-slate-100">
            <Button 
              onClick={() => navigate('/student/login')}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              Login to Claim Item
            </Button>
          </div>
        )}

        {/* Claim button for authenticated users */}
        {isAuthenticated && (
          <div className="pt-3 border-t border-slate-100">
            <Button 
              onClick={() => navigate(`/student/claim/${item.id}`)}
              className="w-full"
              size="sm"
              variant="outline"
            >
              Claim This Item
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <PublicHeader />

      {/* Back Button for Authenticated Users */}
      {isAuthenticated && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
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
            {isAuthenticated && getRoleDisplay() ? (
              <div className="mb-6 animate-fade-in">
                <div className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2">
                  <p className="text-sm text-white/80">You are logged in as:</p>
                  <p className="text-lg font-semibold text-white">{getRoleDisplay()}</p>
                </div>
              </div>
            ) : (
              <p className="text-lg text-slate-300 mb-6 animate-fade-in">
                Browse all lost and found items from the campus community. Report what you've lost or found to help others.
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
