import { useState, useEffect } from 'react';
import { itemsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Package, Eye, MapPin, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminFoundItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await itemsAPI.getItems({ item_type: 'found' });
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.student?.roll_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return <Badge className="status-found">Active</Badge>;
      case 'claimed': return <Badge className="status-claimed">Claimed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-found-items">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-outfit text-2xl font-bold text-slate-900">Found Items</h1>
          <p className="text-slate-500">{items.length} items reported</p>
        </div>
        <div className="relative max-w-xs">
          <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="search-input"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No found items</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Found By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="table-row-hover" data-testid={`item-row-${item.id}`}>
                    <TableCell>
                      <img
                        src={item.image_url ? `${BACKEND_URL}${item.image_url}` : 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100';
                        }}
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">{item.description}</p>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3" />
                        {item.location}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm mono">
                        <Calendar className="w-3 h-3" />
                        {item.date}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.student && (
                        <div>
                          <p className="text-sm font-medium">{item.student.full_name}</p>
                          <p className="text-xs text-slate-500 mono">{item.student.roll_number}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                        data-testid={`view-item-${item.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Found Item Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <img
                src={selectedItem.image_url ? `${BACKEND_URL}${selectedItem.image_url}` : 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400'}
                alt=""
                className="w-full max-h-64 object-cover rounded-lg"
                onError={(e) => {
                  e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400';
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Description</p>
                  <p className="text-sm">{selectedItem.description}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="text-sm">{selectedItem.location}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="text-sm mono">{selectedItem.date}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Time</p>
                  <p className="text-sm mono">{selectedItem.time}</p>
                </div>
                {selectedItem.student && (
                  <>
                    <div>
                      <p className="text-xs text-slate-500">Found By</p>
                      <p className="text-sm">{selectedItem.student.full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Roll Number</p>
                      <p className="text-sm mono">{selectedItem.student.roll_number}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFoundItems;
