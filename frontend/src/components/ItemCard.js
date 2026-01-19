import { useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar, Clock, Eye, Trash2, Hand } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { claimsAPI } from '../services/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const ItemCard = ({ 
  item, 
  showActions = false, 
  onDelete, 
  onView,
  showStudent = false 
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteReason.trim()) return;
    setDeleting(true);
    try {
      await onDelete(item.id, deleteReason);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  const statusColors = {
    active: item.item_type === 'lost' ? 'status-lost' : 'status-found',
    claimed: 'status-claimed',
    resolved: 'bg-slate-100 text-slate-600'
  };

  return (
    <>
      <div className="item-card animate-fade-in" data-testid={`item-card-${item.id}`}>
        <div className="relative">
          <img
            src={item.image_url ? `${BACKEND_URL}${item.image_url}` : '/placeholder-item.jpg'}
            alt={item.description}
            className="item-card-image"
            onError={(e) => {
              e.target.src = 'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg?auto=compress&cs=tinysrgb&w=400';
            }}
          />
          <div className="absolute top-2 left-2">
            <Badge className={statusColors[item.status] || statusColors.active}>
              {item.item_type === 'lost' ? 'LOST' : 'FOUND'}
            </Badge>
          </div>
          {item.status === 'claimed' && (
            <div className="absolute top-2 right-2">
              <Badge className="status-claimed">CLAIMED</Badge>
            </div>
          )}
        </div>
        
        <div className="p-4">
          <p className="text-sm text-slate-800 font-medium line-clamp-2 mb-3">
            {item.description}
          </p>
          
          <div className="space-y-1.5 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">{item.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>{item.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              <span>{item.time}</span>
            </div>
          </div>

          {showStudent && item.student && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Reported by: <span className="font-medium text-slate-700">{item.student.full_name}</span>
              </p>
              <p className="text-xs text-slate-400 mono">{item.student.roll_number}</p>
            </div>
          )}

          {showActions && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => onView?.(item)}
                data-testid={`view-item-${item.id}`}
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              {item.status === 'active' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`delete-item-${item.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Please provide a reason for deleting this item. This action can be reviewed by admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deleteReason">Reason for deletion *</Label>
              <Textarea
                id="deleteReason"
                placeholder="e.g., Found the item, Posted by mistake, etc."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                data-testid="delete-reason-input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleDelete} 
              disabled={!deleteReason.trim() || deleting}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-btn"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ItemGrid = ({ items, ...props }) => {
  if (!items?.length) {
    return (
      <div className="empty-state" data-testid="empty-items">
        <Package className="empty-state-icon mx-auto" />
        <p className="text-lg font-medium">No items found</p>
        <p className="text-sm text-slate-400">Items will appear here when reported</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} {...props} />
      ))}
    </div>
  );
};
