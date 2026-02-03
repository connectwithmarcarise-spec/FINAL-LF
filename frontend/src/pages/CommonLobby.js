import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Package, Search, MapPin, Clock, User2, GraduationCap, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CommonLobby = () => {
  const { isAuthenticated } = useAuth();
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

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
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur">
            {item.item_keyword}
          </Badge>
        </div>
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
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{item.approximate_time}</span>
          </div>
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
            <p className="text-xs text-center text-slate-500">
              <a href="/student/login" className="text-blue-600 hover:underline font-medium">
                Login
              </a> to contact or claim this item
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const ItemGrid = ({ items, emptyIcon, emptyMessage }) => (
    loading ? (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    ) : items.length === 0 ? (
      <div className="text-center py-12">
        {emptyIcon}
        <p className="text-slate-500 mt-3">{emptyMessage}</p>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    )
  );

  const allItems = [...lostItems, ...foundItems].sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-bold text-slate-900 font-outfit">
                Common Lobby
              </h1>
              {!isAuthenticated && (
                <div className="flex gap-3">
                  <a 
                    href="/student/login"
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                  >
                    Student Login
                  </a>
                  <a 
                    href="/admin/login"
                    className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm"
                  >
                    Admin
                  </a>
                </div>
              )}
            </div>
            <p className="text-slate-600">
              Browse all lost and found items from the campus community
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
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
    </div>
  );
};

export default CommonLobby;
