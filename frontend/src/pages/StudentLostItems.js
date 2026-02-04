import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { itemsAPI } from '../services/api';
import { ItemGrid } from '../components/ItemCard';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const StudentLostItems = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);  // Separate error state
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLostItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [searchQuery, items]);

  const fetchLostItems = async () => {
    setLoading(true);
    setError(null);  // Reset error on retry
    try {
      const response = await itemsAPI.getPublicItems();
      // Filter only lost items - ALL lost items visible to ALL students
      const lostItems = (response.data || []).filter(item => item.item_type === 'lost');
      setItems(lostItems);
      setFilteredItems(lostItems);
    } catch (err) {
      console.error('Failed to fetch lost items:', err);
      setError('Failed to load lost items. Please try again.');
      // Only show toast on real network/server errors
      if (err.response?.status >= 500) {
        toast.error('Server error. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = items.filter(item =>
      item.description?.toLowerCase().includes(query) ||
      item.location?.toLowerCase().includes(query) ||
      item.item_keyword?.toLowerCase().includes(query) ||
      item.created_date?.includes(query)
    );
    setFilteredItems(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    );
  }

  // ERROR STATE - Only show when API actually fails
  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-7 h-7 text-orange-600" />
            Lost Items
          </h1>
        </div>
        <div className="text-center py-16 bg-white rounded-lg border border-red-200">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">Failed to Load Items</h3>
          <p className="text-slate-500 mb-4">{error}</p>
          <Button onClick={fetchLostItems} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-7 h-7 text-orange-600" />
            Lost Items
          </h1>
          <p className="text-slate-500 mt-1">
            Browse items reported as lost on campus
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {filteredItems.length} {filteredItems.length === 1 ? 'Item' : 'Items'}
        </Badge>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by description, location, or date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* EMPTY STATE - Only when API succeeds but no items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">No Lost Items Found</h3>
          <p className="text-slate-500">
            {searchQuery ? 'Try adjusting your search' : 'No lost items have been reported yet'}
          </p>
        </div>
      ) : (
        <ItemGrid items={filteredItems} onUpdate={fetchLostItems} />
      )}
    </div>
  );
};

export default StudentLostItems;
