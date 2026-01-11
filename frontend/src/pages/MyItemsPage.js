import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsAPI } from '../services/api';
import { ItemCard } from '../components/ItemCard';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Package, Search, Plus } from 'lucide-react';

const MyItemsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await itemsAPI.getMyItems();
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId, reason) => {
    try {
      await itemsAPI.deleteItem(itemId, reason);
      toast.success('Item deleted successfully');
      fetchItems();
    } catch (error) {
      toast.error('Failed to delete item');
      throw error;
    }
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'all') return true;
    return item.item_type === activeTab;
  });

  const lostCount = items.filter(i => i.item_type === 'lost').length;
  const foundCount = items.filter(i => i.item_type === 'found').length;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="my-items-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900">My Items</h1>
          <p className="text-slate-500">Manage your reported lost and found items</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/student/report-lost')}
            className="border-orange-200 text-orange-600 hover:bg-orange-50"
            data-testid="report-lost-btn"
          >
            <Search className="w-4 h-4 mr-2" />
            Report Lost
          </Button>
          <Button 
            onClick={() => navigate('/student/report-found')}
            className="bg-emerald-600 hover:bg-emerald-700"
            data-testid="report-found-btn"
          >
            <Package className="w-4 h-4 mr-2" />
            Report Found
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All ({items.length})
          </TabsTrigger>
          <TabsTrigger value="lost" data-testid="tab-lost">
            Lost ({lostCount})
          </TabsTrigger>
          <TabsTrigger value="found" data-testid="tab-found">
            Found ({foundCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
              <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">
                {activeTab === 'all' 
                  ? "You haven't reported any items yet" 
                  : `No ${activeTab} items`
                }
              </h3>
              <p className="text-slate-500 mb-4">
                Report a lost or found item to get started
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/student/report-lost')}
                >
                  Report Lost
                </Button>
                <Button onClick={() => navigate('/student/report-found')}>
                  Report Found
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <ItemCard 
                  key={item.id} 
                  item={item} 
                  showActions 
                  onDelete={handleDelete}
                  onView={() => navigate(`/student/item/${item.id}`)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyItemsPage;
