import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  MapPin, Calendar, Clock, Eye, Trash2, Hand, AlertCircle, Package, ImageOff,
  Search, User, GraduationCap, Upload, X, Send
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { claimsAPI } from '../services/api';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Safe string formatter - FIX #7: Prevent "Objects are not valid as React child" error
 */
const safeString = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return format(value, 'MMM d, yyyy');
  if (typeof value === 'object') {
    // Handle date objects from backend
    if (value.$date) return format(new Date(value.$date), 'MMM d, yyyy');
    // Handle other objects - extract meaningful string
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * Format date/time safely - FIX #7
 */
const formatDateTime = (dateStr, timeStr) => {
  try {
    if (dateStr && typeof dateStr === 'object') {
      dateStr = dateStr.$date || dateStr.toString();
    }
    const date = dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : 'N/A';
    const time = safeString(timeStr) || 'N/A';
    return { date, time };
  } catch {
    return { date: safeString(dateStr) || 'N/A', time: safeString(timeStr) || 'N/A' };
  }
};

/**
 * No Image Placeholder Component
 */
const NoImagePlaceholder = ({ className = '' }) => (
  <div className={`bg-slate-100 flex flex-col items-center justify-center ${className}`}>
    <ImageOff className="w-12 h-12 text-slate-300 mb-2" />
    <p className="text-sm font-medium text-slate-400 text-center px-4">NO IMAGE ATTACHED</p>
  </div>
);

/**
 * ItemCard Component
 * 
 * UPDATED BEHAVIOR:
 * - LOST items: Show "I Found This Item" button (NOT Claim)
 * - FOUND items: Show "Claim This Item" with AI chatbot flow
 * - Owner items: Show "You reported this item" badge
 */
export const ItemCard = ({ 
  item, 
  showActions = false,
  showClaimButton = false,
  onDelete, 
  onView,
  onUpdate,
  showStudent = true,  // Default to true - always show student info
  currentUserId = null
}) => {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFoundDialog, setShowFoundDialog] = useState(false);  // NEW: "I Found This" dialog
  const [deleteReason, setDeleteReason] = useState('');
  const [foundMessage, setFoundMessage] = useState('');
  const [foundImage, setFoundImage] = useState(null);
  const [foundImagePreview, setFoundImagePreview] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Determine if current user is the owner
  const isOwner = item.is_owner === true || (currentUserId && item.student_id === currentUserId);
  
  // Safe date/time formatting - FIX #7
  const { date: displayDate, time: displayTime } = formatDateTime(
    item.created_date || item.date,
    item.approximate_time || item.time
  );

  // Get student info safely - FIX #7
  const studentName = safeString(item.student?.full_name) || 'Anonymous';
  const studentDept = safeString(item.student?.department) || '';
  const studentYear = safeString(item.student?.year) || '';

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

  // Handle "I Found This Item" for LOST items
  const handleFoundImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setFoundImage(file);
      setFoundImagePreview(URL.createObjectURL(file));
    }
  };

  const clearFoundImage = () => {
    setFoundImage(null);
    setFoundImagePreview(null);
  };

  const handleFoundSubmit = async () => {
    if (!foundMessage.trim()) {
      toast.error('Please provide details about where/how you found the item');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('message', foundMessage);
      if (foundImage) {
        formData.append('image', foundImage);
      }

      await axios.post(
        `${BACKEND_URL}/api/items/${item.id}/found-response`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Response submitted! The owner has been notified.');
      setShowFoundDialog(false);
      setFoundMessage('');
      setFoundImage(null);
      setFoundImagePreview(null);
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error('Found response failed:', error);
      const message = error.response?.data?.detail || 'Failed to submit response';
      toast.error(safeString(message));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Claim for FOUND items - Navigate to AI Chat
  const handleClaimClick = () => {
    navigate(`/student/claim/${item.id}`);
  };

  const statusColors = {
    active: item.item_type === 'lost' ? 'status-lost' : 'status-found',
    reported: item.item_type === 'lost' ? 'status-lost' : 'status-found',
    claimed: 'status-claimed',
    resolved: 'bg-slate-100 text-slate-600'
  };

  const isActive = item.status === 'active' || item.status === 'reported';

  return (
    <>
      <div className="item-card animate-fade-in" data-testid={`item-card-${item.id}`}>
        {/* Image Section */}
        <div className="relative">
          {item.image_url ? (
            <img
              src={`${BACKEND_URL}${item.image_url}`}
              alt={safeString(item.description)}
              className="item-card-image"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <NoImagePlaceholder 
            className={`item-card-image ${item.image_url ? 'hidden' : 'flex'}`}
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
        
        {/* Content Section */}
        <div className="p-4">
          {/* Item Keyword/Type */}
          {item.item_keyword && (
            <div className="mb-2">
              <Badge variant="outline" className="text-xs">
                {safeString(item.item_keyword)}
              </Badge>
            </div>
          )}

          {/* Description */}
          <p className="text-sm text-slate-800 font-medium line-clamp-2 mb-3">
            {safeString(item.description)}
          </p>
          
          {/* Location & Time - FIX #7: Safe string rendering */}
          <div className="space-y-1.5 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{safeString(item.location)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{displayDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{displayTime}</span>
            </div>
          </div>

          {/* Student Info - Always show */}
          {showStudent && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="text-slate-600">
                    Reported by: <span className="font-medium text-slate-800">{studentName}</span>
                  </p>
                  {(studentDept || studentYear) && (
                    <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                      <GraduationCap className="w-3 h-3" />
                      {studentDept} {studentYear && `• ${studentYear}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons based on item type */}
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
              {isActive && (
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
          
          {/* Owner badge - shown when user reported this item */}
          {isOwner && showClaimButton && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">You reported this item</span>
              </div>
            </div>
          )}
          
          {/* LOST items: "I Found This Item" button - for non-owners only */}
          {showClaimButton && !isOwner && item.item_type === 'lost' && isActive && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700"
                size="sm"
                onClick={() => setShowFoundDialog(true)}
                data-testid={`found-item-${item.id}`}
              >
                <Search className="w-4 h-4 mr-2" />
                I Found This Item
              </Button>
            </div>
          )}

          {/* FOUND items: "Claim This Item" button - for non-owners only */}
          {showClaimButton && !isOwner && item.item_type === 'found' && isActive && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="sm"
                onClick={handleClaimClick}
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
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "I Found This Item" Dialog for LOST items */}
      <Dialog open={showFoundDialog} onOpenChange={setShowFoundDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-orange-600" />
              I Found This Item
            </DialogTitle>
            <DialogDescription>
              Let the owner know you found their item. They will be notified immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="foundMessage">Where/How did you find it? *</Label>
              <Textarea
                id="foundMessage"
                placeholder="e.g., Found near library entrance, Found in cafeteria..."
                value={foundMessage}
                onChange={(e) => setFoundMessage(e.target.value)}
                rows={3}
              />
            </div>

            {/* Optional Image Upload */}
            <div className="space-y-2">
              <Label>Photo (Optional)</Label>
              {foundImagePreview ? (
                <div className="relative">
                  <img 
                    src={foundImagePreview} 
                    alt="Preview" 
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={clearFoundImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500">Click to upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFoundImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFoundDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleFoundSubmit} 
              disabled={!foundMessage.trim() || submitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Notify Owner
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * ItemGrid Component
 * Displays items in a responsive grid - latest items first
 */
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

  // Sort by created_at descending (latest first)
  const sortedItems = [...items].sort((a, b) => {
    const dateA = new Date(a.created_at || a.created_date || 0);
    const dateB = new Date(b.created_at || b.created_date || 0);
    return dateB - dateA;
  });

  return (
    <div className="item-grid" data-testid="item-grid">
      {sortedItems.map((item) => (
        <ItemCard key={item.id} item={item} {...props} />
      ))}
    </div>
  );
};
