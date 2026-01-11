import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Calendar, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { PublicHeader } from '../components/Header';
import { itemsAPI } from '../services/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PublicPage = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = items.filter(item =>
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  }, [searchQuery, items]);

  const fetchItems = async () => {
    try {
      const response = await itemsAPI.getPublicItems();
      setItems(response.data);
      setFilteredItems(response.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

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
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="font-outfit text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 animate-fade-in">
              Campus Lost & Found
            </h1>
            <p className="text-lg text-slate-300 mb-8 animate-fade-in">
              Browse recently found items on campus. If you've lost something, 
              login to report it or claim a found item.
            </p>
            
            {/* Search Bar */}
            <div className="relative animate-fade-in">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search found items by description or location..."
                className="pl-12 pr-4 py-6 text-base bg-white text-slate-900 border-0 rounded-lg shadow-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="public-search-input"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Items Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-outfit text-2xl font-bold text-slate-900">
              Recently Found Items
            </h2>
            <p className="text-slate-500 mt-1">
              {filteredItems.length} items available for claim
            </p>
          </div>
          <Button 
            onClick={() => navigate('/student/login')}
            className="bg-slate-900 hover:bg-slate-800"
            data-testid="login-to-claim-btn"
          >
            Login to Claim
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">No items found</h3>
            <p className="text-slate-500">
              {searchQuery ? 'Try a different search term' : 'Check back later for found items'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item, index) => (
              <div 
                key={item.id} 
                className="item-card animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
                data-testid={`public-item-${item.id}`}
              >
                <div className="relative">
                  <img
                    src={item.image_url ? `${BACKEND_URL}${item.image_url}` : 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400'}
                    alt={item.description}
                    className="item-card-image"
                    onError={(e) => {
                      e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400';
                    }}
                  />
                  <Badge className="absolute top-3 left-3 status-found">
                    FOUND
                  </Badge>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-800 font-medium line-clamp-2 mb-3">
                    {item.description}
                  </p>
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{item.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
