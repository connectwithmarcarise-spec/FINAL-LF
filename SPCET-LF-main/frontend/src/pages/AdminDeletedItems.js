import { useState, useEffect } from 'react';
import { itemsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Trash2, RotateCcw, AlertTriangle, Eye } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AdminDeletedItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await itemsAPI.getDeletedItems();
      setItems(response.data);
    } catch (error) {
      console.error('Failed to fetch items:', error);
      toast.error('Failed to load deleted items');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (itemId) => {
    try {
      await itemsAPI.restoreItem(itemId);
      toast.success('Item restored successfully');
      fetchItems();
    } catch (error) {
      toast.error('Failed to restore item');
    }
  };

  const handlePermanentDelete = async () => {
    try {
      await itemsAPI.permanentDeleteItem(itemToDelete.id);
      toast.success('Item permanently deleted');
      setShowDeleteDialog(false);
      setItemToDelete(null);
      fetchItems();
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="admin-deleted-items">
      <div>
        <h1 className="font-outfit text-2xl font-bold text-slate-900">Deleted Items</h1>
        <p className="text-slate-500">
          {items.length} items deleted by students
        </p>
      </div>

      {/* Warning Card */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Review Deleted Items</p>
              <p className="text-sm text-yellow-700 mt-1">
                Items deleted by students appear here for review. You can restore items or permanently delete them.
                Check delete reasons for potential misuse patterns.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No deleted items</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Deleted By</TableHead>
                  <TableHead>Delete Reason</TableHead>
                  <TableHead>Deleted At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="table-row-hover deleted-overlay" data-testid={`deleted-item-${item.id}`}>
                    <TableCell>
                      <img
                        src={item.image_url ? `${BACKEND_URL}${item.image_url}` : 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100'}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover opacity-60"
                        onError={(e) => {
                          e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=100';
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge className={item.item_type === 'lost' ? 'status-lost' : 'status-found'}>
                        {item.item_type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">{item.description}</p>
                    </TableCell>
                    <TableCell>
                      {item.student && (
                        <div>
                          <p className="text-sm font-medium">{item.student.full_name}</p>
                          <p className="text-xs text-slate-500 mono">{item.student.roll_number}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-red-600 truncate">{item.delete_reason}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm mono">
                        {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedItem(item)}
                          data-testid={`view-deleted-${item.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(item.id)}
                          className="text-emerald-600"
                          title="Restore item"
                          data-testid={`restore-item-${item.id}`}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setItemToDelete(item);
                            setShowDeleteDialog(true);
                          }}
                          className="text-red-600"
                          title="Permanently delete"
                          data-testid={`permanent-delete-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
            <DialogTitle>Deleted Item Details</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <img
                src={selectedItem.image_url ? `${BACKEND_URL}${selectedItem.image_url}` : 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400'}
                alt=""
                className="w-full max-h-64 object-cover rounded-lg opacity-60"
                onError={(e) => {
                  e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400';
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <Badge className={selectedItem.item_type === 'lost' ? 'status-lost' : 'status-found'}>
                    {selectedItem.item_type.toUpperCase()}
                  </Badge>
                </div>
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
                {selectedItem.student && (
                  <>
                    <div>
                      <p className="text-xs text-slate-500">Deleted By</p>
                      <p className="text-sm">{selectedItem.student.full_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Roll Number</p>
                      <p className="text-sm mono">{selectedItem.student.roll_number}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-600 font-medium mb-1">Delete Reason</p>
                <p className="text-sm text-red-800">{selectedItem.delete_reason}</p>
                <p className="text-xs text-red-500 mt-2">
                  Deleted at: {selectedItem.deleted_at ? new Date(selectedItem.deleted_at).toLocaleString() : '-'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Item?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The item and its image will be permanently removed from the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handlePermanentDelete}
              data-testid="confirm-permanent-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDeletedItems;
