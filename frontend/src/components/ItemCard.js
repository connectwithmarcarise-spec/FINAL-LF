import { useState } from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar, Clock, Eye, Trash2, Hand, AlertCircle, Package } from 'lucide-react';
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
  showClaimButton = false,
  onDelete, 
  onView,
  onUpdate,
  showStudent = false,
  currentUserId = null  // FIX #3: Pass current user ID to check ownership
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [claimDetails, setClaimDetails] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // FIX #3: Determine if current user is the owner
  const isOwner = item.is_owner === true || (currentUserId && item.student_id === currentUserId);

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

  const handleClaim = async () => {
    if (!claimDetails.trim()) {
      toast.error('Please provide claim details');
      return;
    }
    
    setClaiming(true);
    try {
      await claimsAPI.createClaim({
        item_id: item.id,
        details: claimDetails
      });
      toast.success('Claim submitted successfully!');
      setShowClaimDialog(false);
      setClaimDetails('');
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error('Claim failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit claim');
    } finally {
      setClaiming(false);
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
          
          {/* FIX #3: Owner badge - users should NOT see claim option for their own items */}
          {isOwner && showClaimButton && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">You reported this item</span>
              </div>
            </div>
          )}
          
          {/* FIX #3: Claim button - ONLY for non-owners viewing found items */}
          {showClaimButton && !isOwner && item.item_type === 'found' && (item.status === 'active' || item.status === 'reported') && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="sm"
                onClick={() => setShowClaimDialog(true)}
                data-testid={`claim-item-${item.id}`}
              >
                <Hand className="w-4 h-4 mr-2" />
                Claim This Item
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
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

      {/* Claim Dialog */}
      <Dialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim This Item</DialogTitle>
            <DialogDescription>
              Please provide details explaining why this item belongs to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="claimDetails">Claim Details *</Label>
              <Textarea
                id="claimDetails"
                placeholder="Describe the item, where you lost it, unique features, etc."
                value={claimDetails}
                onChange={(e) => setClaimDetails(e.target.value)}
                rows={4}
                data-testid="claim-details-input"
              />
              <p className="text-xs text-slate-500">
                Provide specific details to help verify your claim
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowClaimDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleClaim} 
              disabled={!claimDetails.trim() || claiming}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="confirm-claim-btn"
            >
              {claiming ? 'Submitting...' : 'Submit Claim'}
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
